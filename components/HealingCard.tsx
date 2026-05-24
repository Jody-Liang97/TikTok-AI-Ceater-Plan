"use client";

import Image from "next/image";
import { useState } from "react";
import type { HealingCard as HealingCardType } from "../lib/types";

export type CardMeta = {
  mode: "ai" | "mock";
  reason?: string;
  detail?: string;
} | null;

const BG_BY_KEYWORD: Array<{ keyword: string; image: string }> = [
  { keyword: "背影", image: "/illustrations/beiying.jpg" },
  { keyword: "荷塘月色", image: "/illustrations/hetang-yuese.jpg" },
  { keyword: "匆匆", image: "/illustrations/congcong.jpg" },
  { keyword: "再别康桥", image: "/illustrations/zaibie-kangqiao.jpg" },
  { keyword: "散步", image: "/illustrations/sanbu.jpg" },
  { keyword: "百草园", image: "/illustrations/baicaoyuan.jpg" },
  { keyword: "三味书屋", image: "/illustrations/baicaoyuan.jpg" },
  { keyword: "春", image: "/illustrations/chun.jpg" },
  { keyword: "岳阳楼记", image: "/illustrations/yueyanglouji.jpg" },
];

export function HealingCard({
  card,
  meta,
  isLoading,
}: {
  card: HealingCardType;
  meta?: CardMeta;
  isLoading?: boolean;
}) {
  const heroImage =
    BG_BY_KEYWORD.find(
      ({ keyword }) => card.title.includes(keyword) || card.source.includes(keyword)
    )?.image ?? "/illustrations/warm-texture.jpg";

  const [bgReady, setBgReady] = useState(false);

  const badgeText =
    meta?.mode === "ai" ? "AI 生成" : meta?.mode === "mock" ? "本地素材" : null;

  return (
    <article
      className={[
        "group relative mx-auto w-full overflow-hidden rounded-3xl",
        "border border-amber-100/70 bg-gradient-to-br from-amber-50/70 via-rose-50/60 to-stone-50/70",
        "shadow-[0_10px_30px_-18px_rgba(120,53,15,0.35)]",
        "transition-[transform,box-shadow] duration-500",
        "[transform:perspective(1200px)]",
        "hover:shadow-[0_18px_50px_-22px_rgba(120,53,15,0.45)]",
        "hover:[transform:perspective(1200px)_translateY(-4px)_rotateX(1deg)_rotateY(-1deg)]",
        "active:[transform:perspective(1200px)_scale(0.99)]",
        // 等背景图准备好再“整体出现”（避免文字先出现、底图后加载的割裂感）
        bgReady ? "animate-[hf-enter_380ms_ease-out_both]" : "opacity-0",
        isLoading ? "opacity-80" : "",
      ].join(" ")}
    >
      <style jsx>{`
        @keyframes hf-float {
          0%,
          100% {
            transform: translate3d(0, 0, 0);
          }
          50% {
            transform: translate3d(0, -6px, 0);
          }
        }
        @keyframes hf-drift {
          0% {
            transform: translate3d(-10%, 0, 0);
          }
          100% {
            transform: translate3d(10%, 0, 0);
          }
        }

        @keyframes hf-enter {
          0% {
            opacity: 0;
            transform: perspective(1200px) translate3d(0, 10px, 0) scale(0.992);
            filter: blur(1px);
          }
          100% {
            opacity: 1;
            transform: perspective(1200px) translate3d(0, 0, 0) scale(1);
            filter: blur(0px);
          }
        }
      `}</style>

      {/* 背景层：温暖纹理/意象（低存在感的水印） */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <Image
          src={heroImage}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, 640px"
          onLoadingComplete={() => setBgReady(true)}
          onError={() => setBgReady(true)}
          className={[
            "object-cover",
            // 让图片“融入”配色：降低对比与饱和，叠加混合模式
            // 同时需要“看得出来”：在不影响阅读的前提下提高可见度
            "opacity-60 mix-blend-multiply",
            "[filter:saturate(0.98)_contrast(1.03)_brightness(1.0)_blur(0.2px)]",
          ].join(" ")}
          priority={false}
        />
        {/* 用颜色膜统一风格（比单纯降透明更“融”） */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-50/42 via-rose-50/26 to-stone-50/38" />
        {/* 再加一层柔雾，把边缘压下去 */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/38 via-white/0 to-white/45" />
        {/* 轻微颗粒感 */}
        <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(#000_1px,transparent_1px)] [background-size:18px_18px]" />
      </div>

      {/* 卡片内部浮动光斑（更沉浸，但不抢内容） */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div
          className="absolute -top-10 -left-12 h-40 w-40 rounded-full bg-amber-200/25 blur-2xl"
          style={{ animation: "hf-float 7s ease-in-out infinite" }}
        />
        <div
          className="absolute -bottom-14 -right-16 h-44 w-44 rounded-full bg-rose-200/20 blur-2xl"
          style={{ animation: "hf-float 8.5s ease-in-out infinite" }}
        />
        <div
          className="absolute left-1/2 top-10 h-24 w-48 -translate-x-1/2 rounded-full bg-white/20 blur-2xl opacity-60"
          style={{ animation: "hf-drift 10s ease-in-out infinite alternate" }}
        />
      </div>

      {/* 光影扫过（hover 更明显；移动端不影响阅读） */}
      <div
        aria-hidden="true"
        className={[
          "pointer-events-none absolute inset-y-0 -left-1/2 w-1/2",
          "bg-gradient-to-r from-transparent via-white/60 to-transparent",
          "rotate-12 opacity-0 blur-sm",
          "transition-all duration-700 ease-out",
          "group-hover:translate-x-[220%] group-hover:opacity-70",
        ].join(" ")}
      />

      {/* 右上角标记：AI/本地素材 */}
      {badgeText ? (
        <div className="absolute right-4 top-4 z-10">
          <div
            className={[
              "rounded-full px-2.5 py-1 text-[11px] leading-5",
              "border border-white/60 bg-white/55 text-stone-700 shadow-sm backdrop-blur",
            ].join(" ")}
            title={meta?.reason ?? ""}
          >
            {badgeText}
          </div>
        </div>
      ) : null}

      <div className="relative p-6 sm:p-8">
        <header className="space-y-2">
          <h2 className="text-lg font-semibold leading-7 tracking-tight text-stone-900 sm:text-xl">
            {card.title}
          </h2>
          <div className="text-xs text-stone-600">{card.source}</div>
        </header>

        {/* 文学引用 */}
        <div className="mt-6">
          <blockquote className="relative rounded-2xl border border-white/60 bg-white/55 px-4 py-4 text-[15px] leading-7 text-stone-900 shadow-sm sm:px-5">
            <span
              aria-hidden="true"
              className="absolute left-3 top-2 select-none text-3xl leading-none text-amber-300/70"
            >
              “
            </span>
            <div className="absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-gradient-to-b from-amber-200/70 via-rose-200/40 to-transparent" />
            <p className="pl-5 italic text-stone-800">{card.quote}</p>
          </blockquote>
        </div>

        {/* 分块：小时候以为 → 多年后才懂（对照更明显） */}
        <section className="mt-6">
          <div className="space-y-3">
            <div className="flex items-baseline gap-2">
              <div className="h-4 w-1 rounded-full bg-gradient-to-b from-stone-300/70 to-transparent" />
              <div
                className={[
                  "text-[13px] font-semibold tracking-widest",
                  "font-serif italic",
                  "text-transparent bg-clip-text",
                  "bg-gradient-to-r from-stone-700 via-stone-600 to-stone-500",
                  "drop-shadow-[0_1px_0_rgba(255,255,255,0.55)]",
                ].join(" ")}
              >
                小时候以为
              </div>
            </div>
            <p className="text-[13.5px] leading-7 text-stone-700/90 italic">
              {card.childhoodTake}
            </p>

            <div className="h-px w-full bg-gradient-to-r from-transparent via-stone-300/40 to-transparent" />

            <div className="flex items-baseline gap-2">
              <div className="h-4 w-1 rounded-full bg-gradient-to-b from-amber-200/80 to-transparent" />
              <div
                className={[
                  "text-[13px] font-semibold tracking-widest",
                  "font-serif italic",
                  "text-transparent bg-clip-text",
                  "bg-gradient-to-r from-amber-800 via-rose-700 to-amber-700",
                  "drop-shadow-[0_1px_0_rgba(255,255,255,0.55)]",
                ].join(" ")}
              >
                长大后才懂
              </div>
            </div>
            <p className="text-sm leading-7 text-stone-800">
              {card.reinterpretation}
            </p>
          </div>
        </section>

        {/* 治愈回应：更实、更靠近人 */}
        <section className="mt-5 space-y-1 rounded-2xl border border-white/60 bg-white/55 px-4 py-3 shadow-sm">
          <div className="text-xs font-medium tracking-wide text-stone-700">
            递给你一句话
          </div>
          <p className="mt-1 text-sm leading-7 text-stone-900">{card.comfort}</p>
        </section>

        {/* microAction：轻提示，不像命令 */}
        <footer className="mt-6 rounded-2xl border border-amber-200/50 bg-amber-50/70 px-4 py-3">
          <div className="text-[13px] leading-6 text-stone-700">
            <span className="mr-2 text-amber-800/70">轻轻做一下</span>
            <span className="text-stone-700">{card.microAction}</span>
          </div>
        </footer>

        {/* 生成中遮罩（让“正在生成”变得可感知） */}
        {isLoading ? (
          <div
            aria-hidden="true"
            className={[
              "absolute inset-0 flex items-center justify-center",
              "bg-white/35 backdrop-blur-[1px]",
            ].join(" ")}
          >
            <div className="flex items-center gap-2 rounded-full border border-white/60 bg-white/60 px-3 py-1 text-xs text-stone-700 shadow-sm">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-stone-300 border-t-transparent" />
              正在生成懂你的瞬间…
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}
