import { randomUUID } from "crypto";
import { MOCK_CARDS } from "../../../lib/mockTexts";
import { generateHealingCardPrompt } from "../../../lib/prompts";
import type { HealingCard, HealingContext } from "../../../lib/types";

type Body = {
  context?: HealingContext | string;
  feedback?: unknown;
  mode?: "prefill" | "interactive" | string;
};

type CardMeta = {
  mode: "ai" | "mock";
  reason?: string;
  detail?: string;
};

function pickRandom<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function fallbackCard(context: string): HealingCard | null {
  const byContext = MOCK_CARDS.filter((c) => c.context === context);
  return (pickRandom(byContext) ?? pickRandom(MOCK_CARDS)) as HealingCard | null;
}

function jsonWithMeta(card: HealingCard | null, meta: CardMeta, status = 200) {
  // 在不破坏前端 HealingCard 结构的前提下，把 meta 作为附加字段返回
  // 前端可读取 meta 做“AI/本地素材”标记与调试提示
  return Response.json(
    {
      ...(card ?? null),
      meta,
    },
    {
      status,
      headers: {
        "cache-control": "no-store",
        "x-healing-mode": meta.mode,
        ...(meta.reason ? { "x-healing-reason": meta.reason } : {}),
      },
    }
  );
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();

  // 1) 直接解析
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  } catch {
    // ignore
  }

  // 2) 去掉 ```json ``` 包裹
  const fence = trimmed
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(fence);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  } catch {
    // ignore
  }

  // 3) 截取第一个 { 到最后一个 }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const slice = trimmed.slice(start, end + 1);
    try {
      const parsed = JSON.parse(slice);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {
      // ignore
    }
  }

  return null;
}

function validateAiPayload(obj: Record<string, unknown>) {
  const getStr = (k: string) => (typeof obj[k] === "string" ? (obj[k] as string).trim() : "");
  const title = getStr("title");
  const source = getStr("source");
  const quote = getStr("quote");
  const childhoodTake = getStr("childhoodTake");
  const reinterpretation = getStr("reinterpretation");
  const comfort = getStr("comfort");
  const microAction = getStr("microAction");

  if (
    !title ||
    !source ||
    !quote ||
    !childhoodTake ||
    !reinterpretation ||
    !comfort ||
    !microAction
  )
    return null;
  return { title, source, quote, childhoodTake, reinterpretation, comfort, microAction };
}

type OpenAIChatCompletionsMessage = {
  content?: unknown;
  // OpenAI / LiteLLM 兼容：当模型以 tool call 返回结构化数据时，content 可能为 null
  tool_calls?: Array<{
    function?: {
      arguments?: unknown;
    };
  }>;
  // 旧式 function_call（部分网关仍会返回）
  function_call?: {
    arguments?: unknown;
  };
};

type OpenAIChatCompletionsResponse = {
  choices?: Array<{
    message?: OpenAIChatCompletionsMessage;
  }>;
};

const CARD_TOOL = {
  type: "function",
  function: {
    name: "generate_healing_card",
    description:
      "生成一张中文“多年后才读懂”的治愈卡片，只返回结构化字段，不要输出额外解释。",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        source: { type: "string" },
        quote: { type: "string" },
        childhoodTake: { type: "string" },
        reinterpretation: { type: "string" },
        comfort: { type: "string" },
        microAction: { type: "string" },
      },
      required: [
        "title",
        "source",
        "quote",
        "childhoodTake",
        "reinterpretation",
        "comfort",
        "microAction",
      ],
    },
  },
} as const;

function previewText(x: unknown, limit = 200) {
  if (typeof x === "string") return x.slice(0, limit);
  try {
    return JSON.stringify(x).slice(0, limit);
  } catch {
    return String(x).slice(0, limit);
  }
}

function coerceMessageToText(message?: OpenAIChatCompletionsMessage): { text: string; source: string } {
  const content = message?.content;
  // 1) 常规：content 是 string
  if (typeof content === "string" && content.trim()) return { text: content, source: "content:string" };

  // 2) 有些兼容实现会返回 content 为“分片数组”
  if (Array.isArray(content)) {
    const joined = content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object") {
          const maybeText = (part as Record<string, unknown>).text;
          if (typeof maybeText === "string") return maybeText;
        }
        return "";
      })
      .join("");
    if (joined.trim()) return { text: joined, source: "content:array" };
  }

  // 3) tool_calls.function.arguments
  const toolArgs = message?.tool_calls?.[0]?.function?.arguments;
  if (typeof toolArgs === "string" && toolArgs.trim()) return { text: toolArgs, source: "tool_calls[0].function.arguments" };

  // 4) function_call.arguments
  const fnArgs = message?.function_call?.arguments;
  if (typeof fnArgs === "string" && fnArgs.trim()) return { text: fnArgs, source: "function_call.arguments" };

  // 5) 兜底：把 content 对象 stringify（即使是 null 也能看出来）
  if (content != null) return { text: previewText(content, 10_000), source: "content:json" };
  return { text: "", source: "empty" };
}

export async function POST(req: Request) {
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    // ignore
  }

  const context = typeof body.context === "string" ? body.context : "";
  const feedback = body.feedback;
  const mode = typeof body.mode === "string" ? body.mode : "interactive";

  const apiKey = process.env.LLM_API_KEY;
  const baseUrl = (process.env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(
    /\/$/,
    ""
  );
  const model = process.env.LLM_MODEL ?? "gpt-4.1-mini";

  // 没配 key 时直接 fallback（方便本地先跑通）
  if (!apiKey) {
    const card = fallbackCard(context);
    return jsonWithMeta(card, { mode: "mock", reason: "missing_api_key" });
  }

  const prompt = generateHealingCardPrompt({
    // 不在此处做严格校验：类型不匹配也会进入 fallback
    context: context as HealingContext,
    feedback: typeof feedback === "string" ? feedback : feedback == null ? null : String(feedback),
  });

  // 仅用于开发环境定位“为什么 JSON parse failed”
  // 注意：不要在生产环境打印/回传大模型原始内容（可能包含敏感信息）
  let rawContentPreview: string | null = null;
  let rawContentSource: string | null = null;

  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    // “信息流拦截”场景：prefill 可以稍慢但不阻塞 UI；interactive 尽量快失败
    const timeoutMs = mode === "prefill" ? 25000 : 12000;
    timeout = setTimeout(() => controller.abort(), timeoutMs);

    const callLLM = async (opts: {
      useTools: boolean;
      useResponseFormat: boolean;
      temperature: number;
    }) => {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: opts.temperature,
          // 控制输出长度：越短越快（这张卡片本身也应该短）
          max_tokens: 520,
          ...(opts.useResponseFormat ? { response_format: { type: "json_object" as const } } : {}),
          ...(opts.useTools
            ? {
                tools: [CARD_TOOL],
                tool_choice: { type: "function", function: { name: "generate_healing_card" } },
              }
            : {}),
          messages: [
            {
              role: "system",
              content:
                "你是一个写作风格克制、温柔、文学感的中文卡片写作者。无论如何只输出 JSON，不要输出解释、不要 markdown。",
            },
            { role: "user", content: prompt },
          ],
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`LLM HTTP ${res.status}: ${errorText}`);
      }

      const data = (await res.json()) as OpenAIChatCompletionsResponse;
      const message = data?.choices?.[0]?.message;
      const { text, source } = coerceMessageToText(message);
      return { message, text, source };
    };

    // 优先用 tool calling：在 LiteLLM / 多模型网关上通常比“纯 prompt JSON”更稳定
    let attempt = await callLLM({ useTools: true, useResponseFormat: false, temperature: 0.6 });

    // 开发环境打印：模型到底把 JSON 放在哪个字段（content/tool_calls/function_call）
    if (process.env.NODE_ENV !== "production") {
      rawContentPreview = previewText(attempt.text, 200);
      rawContentSource = attempt.source;
      console.log(
        "[generate-card] LLM raw content preview:",
        `source=${attempt.source}`,
        rawContentPreview
      );
      const msg = attempt.message;
      if (msg && msg.content === null) {
        console.log("[generate-card] message.content is null, keys=", Object.keys(msg));
      }
      if (msg?.tool_calls?.length) {
        console.log(
          "[generate-card] tool_calls[0].function.arguments preview:",
          previewText(msg.tool_calls[0]?.function?.arguments, 200)
        );
      }
    }

    let parsed = extractJsonObject(attempt.text);
    if (!parsed) {
      // 自动重试：不用 tools，改用 response_format + 更低温度（兼容不支持 tool calling 的模型）
      attempt = await callLLM({ useTools: false, useResponseFormat: true, temperature: 0.25 });
      if (process.env.NODE_ENV !== "production") {
        rawContentPreview = previewText(attempt.text, 200);
        rawContentSource = attempt.source;
        console.log(
          "[generate-card] LLM retry raw content preview:",
          `source=${attempt.source}`,
          rawContentPreview
        );
      }
      parsed = extractJsonObject(attempt.text);
    }

    if (!parsed) throw new Error("JSON parse failed");

    const payload = validateAiPayload(parsed);
    if (!payload) throw new Error("Missing fields");

    const card: HealingCard = {
      id: `ai_${randomUUID()}`,
      context: context as HealingContext,
      title: payload.title,
      source: payload.source,
      quote: payload.quote,
      childhoodTake: payload.childhoodTake,
      reinterpretation: payload.reinterpretation,
      comfort: payload.comfort,
      microAction: payload.microAction,
    };

    return jsonWithMeta(card, { mode: "ai" });
  } catch (err) {
    console.error("[generate-card] LLM failed:", err);

    const card = fallbackCard(context);
    const detail = err instanceof Error ? err.message : String(err);
    // 为了让前端 demo 更“可见”，这里即便失败也返回一张可展示的卡片，
    // 但用 meta 清晰标注：这是回退结果，并在开发环境附带 detail。
    return jsonWithMeta(
      card,
      {
        mode: "mock",
        reason: "llm_failed",
        detail:
          process.env.NODE_ENV !== "production"
            ? rawContentPreview
              ? `${detail}${rawContentSource ? ` | source=${rawContentSource}` : ""} | raw_preview=${rawContentPreview}`
              : detail
            : undefined,
      },
      200
    );
  } finally {
    // 确保超时定时器被清理
    if (timeout) clearTimeout(timeout);
  }
}
