"use client";

import type { HealingContext } from "../lib/types";

const CONTEXTS: HealingContext[] = [
  "职场焦虑",
  "学业压力",
  "容貌焦虑",
  "年龄焦虑",
  "亲密关系",
  "孤独感",
  "深夜疲惫",
  "自我怀疑",
];

export function ContextSelector({
  value,
  onChange,
}: {
  value: HealingContext;
  onChange: (next: HealingContext) => void;
}) {
  return (
    <div className="w-full">
      <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
        {CONTEXTS.map((c) => {
          const selected = c === value;
          return (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              className={[
                "rounded-full px-3 py-1.5 text-sm leading-6 transition-colors",
                "border backdrop-blur",
                selected
                  ? "border-amber-200 bg-amber-50 text-stone-900 shadow-sm ring-1 ring-amber-100"
                  : "border-stone-200 bg-white/50 text-stone-600 hover:border-stone-300 hover:bg-white/70",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50",
              ].join(" ")}
              aria-pressed={selected}
            >
              {c}
            </button>
          );
        })}
      </div>
    </div>
  );
}
