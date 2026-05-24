"use client";

import { useMemo, useState } from "react";

type ActionKey = "hit" | "tooSoup" | "dislike" | "save";

export function FeedbackBar({
  saved,
  onHit,
  onTooSoup,
  onDislike,
  onToggleSave,
}: {
  saved: boolean;
  onHit: () => void;
  onTooSoup: () => void;
  onDislike: () => void;
  onToggleSave: () => void;
}) {
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [pressed, setPressed] = useState<{ id: number; key: ActionKey } | null>(
    null
  );

  const base = useMemo(
    () =>
      [
        "rounded-full px-3 py-1.5 text-sm leading-6",
        "border backdrop-blur",
        "transition-[transform,background-color,border-color,box-shadow,color] duration-300",
        "active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50",
      ].join(" "),
    []
  );

  const subtle = useMemo(
    () =>
      "border-stone-200 bg-white/55 text-stone-700 hover:border-stone-300 hover:bg-white/80 hover:text-stone-900",
    []
  );

  const pulseClass = (key: ActionKey) => {
    if (!pressed || pressed.key !== key) return "";
    return "animate-[fb-tap_420ms_ease-out]";
  };

  const triggerPress = (key: ActionKey) => {
    const id = Date.now();
    setPressed({ id, key });
    window.setTimeout(() => {
      setPressed((p) => (p?.id === id ? null : p));
    }, 450);
  };

  const triggerToast = (text: string) => {
    setToast({ id: Date.now(), text });
  };

  return (
    <div className="w-full">
      <style jsx>{`
        @keyframes fb-tap {
          0% {
            transform: translate3d(0, 0, 0) scale(1);
            box-shadow: 0 0 0 rgba(0, 0, 0, 0);
          }
          35% {
            transform: translate3d(0, -1px, 0) scale(1.04);
            box-shadow: 0 14px 34px -26px rgba(120, 53, 15, 0.55);
          }
          100% {
            transform: translate3d(0, 0, 0) scale(1);
            box-shadow: 0 0 0 rgba(0, 0, 0, 0);
          }
        }

        @keyframes fb-fly {
          0% {
            opacity: 0;
            transform: translate3d(0, 10px, 0) scale(0.98);
            filter: blur(1px);
          }
          55% {
            opacity: 1;
            transform: translate3d(0, -8px, 0) scale(1);
            filter: blur(0px);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
            filter: blur(0px);
          }
        }
      `}</style>

      <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
        <button
          type="button"
          onClick={() => {
            triggerPress("hit");
            onHit();
            triggerToast("我会记住这种语气。");
          }}
          className={[base, subtle, pulseClass("hit")].join(" ")}
        >
          被击中了
        </button>
        <button
          type="button"
          onClick={() => {
            triggerPress("tooSoup");
            onTooSoup();
            triggerToast("下一句会更克制一点。");
          }}
          className={[base, subtle, pulseClass("tooSoup")].join(" ")}
        >
          太鸡汤了
        </button>
        <button
          type="button"
          onClick={() => {
            triggerPress("dislike");
            onDislike();
            setToast(null);
          }}
          className={[base, subtle, pulseClass("dislike")].join(" ")}
        >
          不想看这个
        </button>
        <button
          type="button"
          onClick={() => {
            triggerPress("save");
            onToggleSave();
            setToast(null);
          }}
          className={[
            base,
            saved
              ? "border-amber-200 bg-amber-50/70 text-stone-900 shadow-sm hover:bg-amber-50/80"
              : subtle,
            pulseClass("save"),
          ].join(" ")}
          aria-pressed={saved}
        >
          {saved ? "已收藏" : "收藏"}
        </button>
      </div>

      {toast ? (
        <div className="mt-3 flex justify-center sm:justify-start">
          <div
            key={toast.id}
            className={[
              "inline-flex items-center gap-2 rounded-full",
              "border border-white/60 bg-white/60 px-3 py-1 text-xs leading-6 text-stone-600 shadow-sm backdrop-blur",
              "animate-[fb-fly_520ms_ease-out]",
            ].join(" ")}
          >
            <span className="text-amber-700/70">·</span>
            <span>{toast.text}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
