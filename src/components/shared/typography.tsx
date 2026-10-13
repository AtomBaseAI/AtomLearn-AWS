"use client";

import React from "react";
import { motion } from "framer-motion";

export function SectionTitle({
  kicker,
  title,
  desc,
  className = "",
}: {
  kicker: string;
  title: string;
  desc?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <motion.span
        initial={{ opacity: 0, x: -10 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        className="text-[9px] font-bold uppercase tracking-[0.3em] text-aws/80"
      >
        {"//"} {kicker}
      </motion.span>
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.08 }}
        className="text-base sm:text-lg font-extrabold uppercase tracking-[0.12em] text-foreground"
      >
        {title}
      </motion.h2>
      {desc && (
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.16 }}
          className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed max-w-2xl"
        >
          {desc}
        </motion.p>
      )}
    </div>
  );
}

export function StatChip({
  label,
  value,
  tone = "aws",
  delay = 0,
}: {
  label: string;
  value: string;
  tone?: "aws" | "mint" | "magenta" | "neutral";
  delay?: number;
}) {
  const toneCls =
    tone === "mint"
      ? "text-mint border-mint/35"
      : tone === "magenta"
        ? "text-magenta border-magenta/35"
        : tone === "neutral"
          ? "text-foreground/80 border-foreground/20"
          : "text-aws border-aws/35";
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.4 }}
      className={`flex flex-col gap-0.5 px-2.5 py-1.5 border bg-black/40 backdrop-blur-sm ${toneCls}`}
    >
      <span className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground font-bold">{label}</span>
      <span className="text-xs sm:text-sm font-extrabold tracking-wider">{value}</span>
    </motion.div>
  );
}
