"use client";

import React from "react";
import { motion } from "framer-motion";
import { Play, Pause, RotateCcw, Zap } from "lucide-react";

interface SimControlsProps {
  running: boolean;
  onToggle: () => void;
  onReset: () => void;
  status?: string;
  hint?: string;
  disabled?: boolean;
  accent?: "aws" | "mint" | "magenta";
}

export function SimControls({
  running,
  onToggle,
  onReset,
  status,
  hint,
  disabled,
  accent = "aws",
}: SimControlsProps) {
  const accentCls =
    accent === "mint"
      ? "border-mint/60 text-mint shadow-[0_0_14px_rgba(0,255,163,0.25)]"
      : accent === "magenta"
        ? "border-magenta/60 text-magenta shadow-[0_0_14px_rgba(255,45,120,0.25)]"
        : "border-aws/60 text-aws shadow-[0_0_14px_rgba(255,153,0,0.25)]";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status && (
        <motion.span
          key={status}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-[62vw] sm:max-w-none min-w-0 truncate text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-bold flex items-center gap-1.5"
        >
          <Zap className="w-3 h-3 text-aws" />
          {status}
        </motion.span>
      )}
      <div className="flex items-center gap-1.5 ml-auto">
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.93 }}
          onClick={onToggle}
          disabled={disabled}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.18em] border bg-black/50 backdrop-blur-md cyber-cut-sm transition-colors disabled:opacity-40 ${accentCls} hover:bg-aws/10`}
          aria-label={running ? "Pause simulation" : "Run simulation"}
        >
          {running ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          {running ? "PAUSE" : "RUN"}
        </motion.button>
        <motion.button
          type="button"
          whileHover={{ scale: 1.05, rotate: -8 }}
          whileTap={{ scale: 0.93 }}
          onClick={onReset}
          className="flex items-center justify-center rounded-full p-2 border border-foreground/25 text-foreground/70 bg-black/50 backdrop-blur-md hover:border-aws/50 hover:text-aws transition-colors"
          aria-label="Reset simulation"
          title="Reset"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </motion.button>
      </div>
      {hint && <p className="w-full text-[8px] text-muted-foreground/70 tracking-wider uppercase">{hint}</p>}
    </div>
  );
}
