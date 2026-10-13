"use client";

import React, { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

/* ------------------------------------------------------------------ */
/* shared log tone map (superset — services may override via `tones`)  */
/* ------------------------------------------------------------------ */

export const LOG_TONE_CLS: Record<string, string> = {
  aws: "text-aws",
  mint: "text-mint",
  neon: "text-neon",
  magenta: "text-magenta",
  danger: "text-danger",
  dim: "text-foreground/55",
  muted: "text-muted-foreground",
};

/**
 * Wall-clock timestamp `HH:MM:SS.mmm`.
 * Prepend to log lines at push time — never compute during render.
 */
export const logTs = (): string => {
  const d = new Date();
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
};

/* ------------------------------------------------------------------ */
/* AutoLog — self-scrolling terminal log card                          */
/* ------------------------------------------------------------------ */

export interface AutoLogLine {
  id: number | string;
  text: string;
  tone?: string;
}

interface AutoLogProps {
  lines: AutoLogLine[];
  /** placeholder shown when `lines` is empty */
  emptyText?: string;
  /** visible text lines — the card height (default 4) */
  visibleLines?: number;
  /** override tone → className map (defaults to LOG_TONE_CLS) */
  tones?: Record<string, string>;
  /** derive a tone from the line text when `line.tone` is absent */
  toneOf?: (text: string) => string | undefined;
  className?: string;
}

const LINE_PX = 14; // text-[9px] + leading-[14px]

/**
 * Terminal-style log body that ALWAYS shows the newest entries:
 * fixed `visibleLines`-line height, pinned auto-scroll to the bottom,
 * animated entry, tone coloring, one truncated line per entry.
 *
 * Full width by default — wrap in the caller's GlassPanel at the bottom
 * of the animation column.
 */
export function AutoLog({
  lines,
  emptyText,
  visibleLines = 4,
  tones,
  toneOf,
  className = "",
}: AutoLogProps) {
  const boxRef = useRef<HTMLDivElement | null>(null);

  /* stick to the latest entry — zero manual scrolling */
  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const map = tones ?? LOG_TONE_CLS;

  return (
    <div
      ref={boxRef}
      role="log"
      aria-live="polite"
      aria-label="Live event log, auto-scrolling to newest entry"
      className={`glass-inset cyber-cut-sm cyber-scroll overflow-y-auto px-2.5 py-2 flex flex-col gap-0.5 ${className}`}
      style={{ height: `${visibleLines * LINE_PX + 16}px` }}
    >
      <AnimatePresence initial={false}>
        {lines.slice(-60).map((l) => (
          <motion.p
            key={l.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.16 }}
            title={l.text}
            className={`shrink-0 text-[9px] leading-[14px] tracking-wider font-bold truncate ${
              map[l.tone ?? toneOf?.(l.text) ?? ""] ?? ""
            }`}
          >
            {l.text}
          </motion.p>
        ))}
      </AnimatePresence>
      {lines.length === 0 && emptyText && (
        <p className="text-[8px] uppercase tracking-wider text-muted-foreground/60 py-0.5">{emptyText}</p>
      )}
    </div>
  );
}
