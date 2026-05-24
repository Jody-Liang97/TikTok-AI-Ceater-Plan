"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ContextSelector } from "../components/ContextSelector";
import { FeedbackBar } from "../components/FeedbackBar";
import { HealingCard, type CardMeta } from "../components/HealingCard";
import { MOCK_CARDS } from "../lib/mockTexts";
import type { HealingCard as HealingCardType, HealingContext } from "../lib/types";

type SavedCard = {
  id: string;
  title: string;
  source: string;
  quote: string;
};

type GenerateCardResponse = Partial<HealingCardType> & {
  meta?: {
    mode?: "ai" | "mock";
    reason?: string;
    detail?: string;
  };
};

const SAVED_CARDS_STORAGE_KEY = "healing-feed:savedCards";
const AI_POOL_STORAGE_KEY = "healing-feed:aiPool:v1";
const AI_POOL_MAX_PER_CONTEXT = 12;

export default function Home() {
  const [context, setContext] = useState<HealingContext>("职场焦虑");
  const [cardIndex, setCardIndex] = useState(0);
  const [remoteCard, setRemoteCard] = useState<HealingCardType | null>(null);
  const [cardMeta, setCardMeta] = useState<CardMeta>(null);
  // isFetchingCard：用于“后台补货/替换”时的轻提示，不再阻塞展示
  const [isFetchingCard, setIsFetchingCard] = useState(false);
  // 注意：这里必须用固定初值，避免 SSR/CSR 首屏不一致导致 Hydration Error
  // 收藏会在客户端挂载后从 localStorage 恢复，因此“未挂载前显示 0 条占位”也自然成立。
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const didAutoFetchRef = useRef(false);
  const didLoadSavedRef = useRef(false);
  const didLoadAiPoolRef = useRef(false);
  const aiPoolRef = useRef<Record<string, HealingCardType[]>>({});
  const pendingSwapRef = useRef<string | null>(null);

  const cardsForContext = useMemo(() => {
    return MOCK_CARDS.filter((c) => c.context === context);
  }, [context]);

  useEffect(() => {
    // 仅在客户端恢复收藏；避免 Hydration mismatch
    try {
      const raw = localStorage.getItem(SAVED_CARDS_STORAGE_KEY);
      if (!raw) {
        didLoadSavedRef.current = true;
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        didLoadSavedRef.current = true;
        return;
      }

      const cleaned: SavedCard[] = parsed
        .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
        .map((x) => ({
          id: typeof x.id === "string" ? x.id : String(x.id ?? ""),
          title: typeof x.title === "string" ? x.title : String(x.title ?? ""),
          source: typeof x.source === "string" ? x.source : String(x.source ?? ""),
          quote: typeof x.quote === "string" ? x.quote : String(x.quote ?? ""),
        }))
        .filter((x) => x.id && x.title && x.source && x.quote);

      // 去重（以 id 为准）
      const unique = new Map<string, SavedCard>();
      for (const c of cleaned) unique.set(c.id, c);

      // 避免 eslint 对“effect 内同步 setState”的提示：放进 microtask
      Promise.resolve().then(() => {
        setSavedCards(Array.from(unique.values()));
        didLoadSavedRef.current = true;
      });
    } catch {
      didLoadSavedRef.current = true;
    }
  }, []);

  useEffect(() => {
    try {
      if (!didLoadSavedRef.current) return;
      localStorage.setItem(SAVED_CARDS_STORAGE_KEY, JSON.stringify(savedCards));
    } catch {
      // ignore
    }
  }, [savedCards]);

  const readAiPool = (): Record<string, HealingCardType[]> => {
    try {
      const raw = localStorage.getItem(AI_POOL_STORAGE_KEY);
      if (!raw) return {};
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return {};
      const obj = parsed as Record<string, unknown>;
      const out: Record<string, HealingCardType[]> = {};
      const isCard = (x: unknown): x is HealingCardType => {
        if (!x || typeof x !== "object") return false;
        const o = x as Record<string, unknown>;
        return (
          typeof o.id === "string" &&
          typeof o.context === "string" &&
          typeof o.title === "string" &&
          typeof o.source === "string" &&
          typeof o.quote === "string" &&
          typeof o.childhoodTake === "string" &&
          typeof o.reinterpretation === "string" &&
          typeof o.comfort === "string" &&
          typeof o.microAction === "string"
        );
      };
      for (const [k, v] of Object.entries(obj)) {
        if (!Array.isArray(v)) continue;
        out[k] = v
          .filter(isCard)
          .slice(-AI_POOL_MAX_PER_CONTEXT);
      }
      return out;
    } catch {
      return {};
    }
  };

  const writeAiPool = (pool: Record<string, HealingCardType[]>) => {
    try {
      localStorage.setItem(AI_POOL_STORAGE_KEY, JSON.stringify(pool));
    } catch {
      // ignore
    }
  };

  const poolSize = (ctx: HealingContext) => (aiPoolRef.current[ctx] ?? []).length;

  const consumeAiFromPool = (ctx: HealingContext) => {
    const arr = aiPoolRef.current[ctx] ?? [];
    if (arr.length === 0) return null;
    const next = arr.shift() ?? null;
    aiPoolRef.current[ctx] = arr;
    writeAiPool(aiPoolRef.current);
    return next;
  };

  useEffect(() => {
    // 仅在客户端恢复 AI 池（用于“秒出 AI”）
    try {
      aiPoolRef.current = readAiPool();
    } finally {
      didLoadAiPoolRef.current = true;
    }
  }, []);

  const fallbackCard = useMemo(() => {
    if (cardsForContext.length > 0) {
      return cardsForContext[cardIndex % cardsForContext.length];
    }
    return MOCK_CARDS[0];
  }, [cardsForContext, cardIndex]);

  const card = useMemo(() => {
    if (remoteCard && remoteCard.context === context) return remoteCard;
    return fallbackCard;
  }, [remoteCard, fallbackCard, context]);

  const pickLocalRandom = (avoidId?: string) => {
    const pool = cardsForContext.length > 0 ? cardsForContext : MOCK_CARDS;
    if (pool.length <= 1) return pool[0];

    let next = pool[Math.floor(Math.random() * pool.length)];
    if (avoidId) {
      let guard = 0;
      while (next.id === avoidId && guard < 10) {
        next = pool[Math.floor(Math.random() * pool.length)];
        guard += 1;
      }
    }
    return next;
  };

  const prefillOne = async (ctx: HealingContext, feedback: string | null) => {
    // 后台补货：不阻塞展示
    if (!didLoadAiPoolRef.current) return;
    if (isFetchingCard) return;
    if (poolSize(ctx) >= AI_POOL_MAX_PER_CONTEXT) return;
    const controller = new AbortController();

    setIsFetchingCard(true);
    setLastError(null);
    try {
      const res = await fetch("/api/generate-card", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ context: ctx, feedback, mode: "prefill" }),
        signal: controller.signal,
      });

      const data = (await res.json()) as GenerateCardResponse;
      const meta: CardMeta = data?.meta?.mode
        ? {
            mode: data.meta.mode,
            reason: data.meta.reason,
            detail: data.meta.detail,
          }
        : null;

      if (!res.ok) {
        setLastError(
          typeof data?.meta?.detail === "string" ? data.meta.detail : `HTTP ${res.status}`
        );
        return;
      }

      if (!data || typeof data.id !== "string" || data.context !== ctx) return;
      const aiCard = data as HealingCardType;
      // 关键：只把真正的 AI 结果放进池子。
      // 后端失败时会返回 mock（meta.mode=mock 且 id 形如 hc_xxx），不能入池，否则会出现“内容是 mock 但角标写 AI”的错配。
      const isAi = meta?.mode === "ai" || aiCard.id.startsWith("ai_");
      if (!isAi) return;

      // 入池：去重 + 截断
      const arr = aiPoolRef.current[ctx] ?? [];
      if (!arr.some((x) => x.id === aiCard.id)) arr.push(aiCard);
      aiPoolRef.current[ctx] = arr.slice(-AI_POOL_MAX_PER_CONTEXT);
      writeAiPool(aiPoolRef.current);

      // 如果此前池子为空而先展示了 mock，则补货成功后自动替换为 AI
      if (pendingSwapRef.current === ctx) {
        pendingSwapRef.current = null;
        setRemoteCard(aiCard);
        setCardMeta(meta ?? { mode: "ai" });
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setLastError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsFetchingCard(false);
    }
  };

  const showNextCardFast = (ctx: HealingContext, feedback: string | null) => {
    // 1) 优先消费 AI 池（秒出）
    const pooled = consumeAiFromPool(ctx);
    if (pooled) {
      setRemoteCard(pooled);
      setCardMeta({ mode: "ai", reason: "pool" });
      void prefillOne(ctx, feedback); // 后台补一条
      return;
    }

    // 2) 池子空：先给本地随机（不空白），同时后台补货，成功后自动替换为 AI
    const local = pickLocalRandom(card.id);
    setRemoteCard(local);
    setCardMeta({ mode: "mock", reason: "pool_empty" });
    pendingSwapRef.current = ctx;
    void prefillOne(ctx, feedback);
  };

  // 首屏自动请求一次，让“实时生成”成为默认体验（仍然是 context 模拟）
  useEffect(() => {
    if (didAutoFetchRef.current) return;
    didAutoFetchRef.current = true;
    // 首屏允许先展示本地素材，但后台补货成功后会自动替换为 AI
    showNextCardFast(context, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context]);

  const handleContextChange = (next: HealingContext) => {
    setContext(next);
    setCardIndex(0);
    setRemoteCard(null);
    setIsFetchingCard(false);
    setCardMeta(null);
    setLastError(null);
    didAutoFetchRef.current = false;
    showNextCardFast(next, null);
  };

  const saved = savedCards.some((c) => c.id === card.id);

  return (
    <div className="flex flex-1 flex-col bg-gradient-to-b from-stone-50 to-stone-100">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-6 py-16 sm:px-10 sm:py-24">
        <header className="w-full text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
            多年后的子弹
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-stone-600 sm:text-base">
            在你被信息流击中之后，递给你一句小时候读过、长大后才懂的话
          </p>
        </header>

        <section className="mt-10 w-full">
          <div className="mb-3 text-center text-xs leading-6 text-stone-500 sm:text-left">
            假设你刚刚连续刷到了这些内容……
          </div>
          <ContextSelector value={context} onChange={handleContextChange} />
        </section>

        <section className="mt-12 w-full">
          <div className="mb-4 text-center text-sm leading-7 text-stone-700 sm:text-left">
            你刚刚刷到了很多关于
            <span className="mx-1 font-medium text-stone-900">「{context}」</span>
            的内容。
          </div>

          <HealingCard
            key={card.id}
            card={card}
            meta={cardMeta}
            // 允许先展示内容（即使是本地素材），同时用轻遮罩提示“正在生成/补货”
            isLoading={isFetchingCard && (!cardMeta || cardMeta.mode === "mock")}
          />

          {lastError ? (
            <div className="mt-3 text-center text-xs leading-6 text-rose-700/80 sm:text-left">
              生成遇到问题：{lastError}
            </div>
          ) : null}

          <div className="mt-5">
            <FeedbackBar
              key={card.id}
              saved={saved}
              onHit={() => {
                showNextCardFast(context, "hit");
              }}
              onTooSoup={() => {
                showNextCardFast(context, "tooSoup");
              }}
              onDislike={() => {
                showNextCardFast(context, "dislike");
              }}
              onToggleSave={() => {
                setSavedCards((prev) => {
                  const exists = prev.some((c) => c.id === card.id);
                  if (exists) return prev.filter((c) => c.id !== card.id);
                  return [
                    ...prev,
                    {
                      id: card.id,
                      title: card.title,
                      source: card.source,
                      quote: card.quote,
                    },
                  ];
                });
              }}
            />
          </div>

          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={() => showNextCardFast(context, "reroll")}
              disabled={false}
              className={[
                "rounded-full px-5 py-2 text-sm",
                "border border-amber-200/70 bg-white/70 text-stone-800 backdrop-blur",
                "shadow-[0_10px_30px_-22px_rgba(120,53,15,0.35)]",
                "transition-colors",
                "hover:bg-amber-50/70 hover:border-amber-300/70",
                "active:scale-[0.99]",
                "disabled:cursor-not-allowed disabled:opacity-70",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50",
              ].join(" ")}
            >
              <span className="inline-flex items-center gap-2">
                {isFetchingCard ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-stone-300 border-t-transparent" />
                ) : null}
                再刷到一句
              </span>
            </button>
          </div>
        </section>

        <section className="mt-14 w-full">
          <div className="mx-auto w-full rounded-3xl border border-amber-100/70 bg-gradient-to-br from-amber-50/70 via-rose-50/55 to-stone-50/70 p-5 shadow-[0_10px_30px_-18px_rgba(120,53,15,0.28)] backdrop-blur sm:p-6">
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-sm font-medium tracking-tight text-stone-900">
                那些后来击中我的句子
              </div>
              <div className="text-xs text-stone-500">
                {savedCards.length} 条
              </div>
            </div>

            {savedCards.length === 0 ? (
              <div className="mt-3 text-xs leading-6 text-stone-500">
                你收藏的句子会在这里慢慢积起来。
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {savedCards
                  .slice()
                  .reverse()
                  .map((c) => (
                    <div
                      key={c.id}
                      className={[
                        "rounded-2xl border border-white/60 px-4 py-3 shadow-sm backdrop-blur",
                        // 随着收藏增多，整体更“稳”：卡片层略微更凝实，但仍保持轻
                        savedCards.length >= 6 ? "bg-white/70" : "bg-white/60",
                      ].join(" ")}
                    >
                      <div className="text-sm font-semibold leading-6 text-stone-900">
                        {c.title}
                      </div>
                      <div className="mt-0.5 text-xs text-stone-500">
                        {c.source}
                      </div>
                      <div className="mt-2 text-sm leading-7 text-stone-800 italic">
                        “{c.quote}”
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </section>

        <section className="mt-8 w-full pb-6">
          <div className="group relative mx-auto w-full overflow-hidden rounded-3xl border border-amber-100/70 bg-gradient-to-br from-amber-50/65 via-rose-50/55 to-stone-50/60 p-5 text-left shadow-[0_10px_30px_-20px_rgba(120,53,15,0.25)] backdrop-blur sm:p-6">
            {/* 柔和光晕（不抢主卡片） */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              <div className="absolute -top-12 -left-14 h-44 w-44 rounded-full bg-amber-200/25 blur-3xl" />
              <div className="absolute -bottom-14 -right-14 h-48 w-48 rounded-full bg-rose-200/18 blur-3xl" />
              <div className="absolute inset-0 bg-gradient-to-b from-white/35 via-white/10 to-white/40" />
              <div className="absolute inset-0 opacity-[0.05] [background-image:radial-gradient(#000_1px,transparent_1px)] [background-size:18px_18px]" />
            </div>

            <div className="relative">
              <div className="flex items-start gap-3">
                <div
                  aria-hidden="true"
                  className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-200/60 bg-white/55 shadow-sm"
                >
                  <span className="text-lg leading-none text-amber-700/70">✦</span>
                </div>
                <div>
                  <div className="text-[15px] font-semibold leading-7 tracking-tight text-stone-900 sm:text-base">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-800 via-rose-700 to-amber-700">
                      这不是一句鸡汤
                    </span>
                    <span className="text-stone-800">，而是一次信息流里的轻轻拦截</span>
                  </div>
                  <div className="mt-1 h-px w-24 bg-gradient-to-r from-amber-200/80 via-rose-200/50 to-transparent" />
                </div>
              </div>

              <p className="mt-4 text-sm leading-7 text-stone-700 sm:text-[15px]">
                当你连续刷到
                <span className="font-medium text-stone-900">焦虑、比较、内耗</span>
                的内容，它不说教，也不打断你——只是在信息流里递出一张
                <span className="font-medium text-stone-900">低负担的 AI 治愈卡</span>
                。它借童年课本与熟悉意象，重读那些
                <span className="rounded-md bg-amber-50/80 px-1.5 py-0.5 text-stone-900">
                  “小时候读过、长大后才懂”
                </span>
                的句子，让你在一秒里获得被理解的顿悟。
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
