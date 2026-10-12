"use client";

import React from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Lightbulb, ShieldAlert, Info, GraduationCap } from "lucide-react";

type CalloutType = "info" | "tip" | "warn" | "critical" | "exam";

const CALLOUT_CONFIG: Record<
  CalloutType,
  { border: string; title: string; icon: React.ReactNode; bg: string; text: string }
> = {
  info: {
    border: "border-l-2 border-aws",
    title: "text-aws",
    icon: <Info className="w-3.5 h-3.5" />,
    bg: "bg-aws/[0.05]",
    text: "INTEL",
  },
  tip: {
    border: "border-l-2 border-mint",
    title: "text-mint",
    icon: <Lightbulb className="w-3.5 h-3.5" />,
    bg: "bg-mint/[0.05]",
    text: "PRO TIP",
  },
  warn: {
    border: "border-l-2 border-neon",
    title: "text-neon",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    bg: "bg-neon/[0.05]",
    text: "WARNING",
  },
  critical: {
    border: "border-l-2 border-danger",
    title: "text-danger",
    icon: <ShieldAlert className="w-3.5 h-3.5" />,
    bg: "bg-danger/[0.06]",
    text: "CRITICAL",
  },
  exam: {
    border: "border-l-2 border-magenta",
    title: "text-magenta",
    icon: <GraduationCap className="w-3.5 h-3.5" />,
    bg: "bg-magenta/[0.05]",
    text: "EXAM FREQUENCY",
  },
};

interface CalloutProps {
  type?: CalloutType;
  title: string;
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export function Callout({ type = "info", title, children, delay = 0, className = "" }: CalloutProps) {
  const c = CALLOUT_CONFIG[type];
  return (
    <motion.aside
      initial={{ opacity: 0, x: -14 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.45, delay }}
      className={`relative ${c.border} ${c.bg} p-3 pr-4 flex gap-3 items-start ${className}`}
      role="note"
    >
      <span className={`mt-0.5 shrink-0 ${c.title}`}>{c.icon}</span>
      <div className="min-w-0">
        <p className={`text-[9px] font-bold uppercase tracking-[0.22em] ${c.title}`}>
          {c.text} <span className="text-muted-foreground">{"//"}</span> {title}
        </p>
        <p className="mt-1 text-[10px] sm:text-[11px] leading-relaxed text-foreground/80">{children}</p>
      </div>
    </motion.aside>
  );
}
