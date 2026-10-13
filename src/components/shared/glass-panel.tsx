"use client";

import React from "react";
import { motion } from "framer-motion";

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  deep?: boolean;
  brackets?: boolean;
  delay?: number;
  id?: string;
}

export function GlassPanel({
  children,
  className = "",
  title,
  subtitle,
  actions,
  deep = false,
  brackets = true,
  delay = 0,
  id,
}: GlassPanelProps) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`relative ${deep ? "glass-deep" : "glass"} ${
        brackets ? "corner-brackets" : ""
      } ${className}`}
      aria-label={title}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 pt-3 pb-2 border-b border-aws/15 sm:px-5">
          <div className="min-w-0">
            {title && (
              <h3 className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.22em] text-aws text-glow">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="mt-1 text-[10px] sm:text-[11px] text-muted-foreground uppercase tracking-wider truncate">
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div className="min-w-0 max-w-full flex items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </motion.section>
  );
}
