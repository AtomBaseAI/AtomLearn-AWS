"use client";

import React from "react";
import { Maximize, Minimize } from "lucide-react";

interface FullscreenToggleProps {
  active: boolean;
  onToggle: () => void;
}

/**
 * Fullscreen / exit-fullscreen button — icon + text label.
 * Rendered inside a GlassPanel header via the `actions` slot — sits at the
 * right end of the title row, vertically centered.
 */
export function FullscreenToggle({ active, onToggle }: FullscreenToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={active ? "Exit fullscreen immersive view" : "Enter fullscreen immersive view"}
      aria-pressed={active}
      title={active ? "EXIT FULLSCREEN — ESC" : "FULLSCREEN VIEW"}
      className={`shrink-0 h-7 px-2.5 flex items-center gap-1.5 border bg-black/50 backdrop-blur-md cyber-cut-sm transition-colors duration-200 ${
        active
          ? "border-aws/70 text-aws bg-aws/10 box-glow"
          : "border-foreground/25 text-muted-foreground hover:border-aws/60 hover:text-aws"
      }`}
    >
      {active ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
      <span className="text-[8px] font-bold uppercase tracking-[0.18em] leading-none whitespace-nowrap">
        {active ? "EXIT FULLSCREEN" : "FULLSCREEN"}
      </span>
    </button>
  );
}
