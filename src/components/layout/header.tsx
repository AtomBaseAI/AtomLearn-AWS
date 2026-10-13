"use client";

import React from "react";
import { motion } from "framer-motion";
import { Radio } from "lucide-react";
import { NEXUS_LOGO } from "@/components/aws-icons";

export function Header() {
  return (
    <motion.header
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
      className="sticky top-0 z-40 glass-deep border-b border-aws/20"
      role="banner"
    >
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        <a href="/" className="flex items-center gap-3 group" aria-label="AWS NEXUS home">
          <span className="relative flex items-center justify-center w-8 h-8 border border-aws/40 bg-aws/5 group-hover:box-glow transition-shadow">
            <NEXUS_LOGO className="w-6 h-6" />
            <span className="absolute inset-0 border border-aws/0 group-hover:border-aws/30 transition-colors" aria-hidden="true" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-sm font-extrabold tracking-[0.25em] text-aws text-glow">AWS//NEXUS</span>
            <span className="text-[8px] tracking-[0.3em] text-muted-foreground uppercase mt-1">
              VISUAL CLOUD CONSOLE
            </span>
          </span>
        </a>

        <nav className="hidden md:flex items-center gap-5 text-[9px] uppercase tracking-[0.25em] text-muted-foreground" aria-label="Primary">
          <span className="hover:text-aws transition-colors cursor-pointer">MODULES</span>
          <span className="hover:text-aws transition-colors cursor-pointer">FLOWS</span>
          <span className="hover:text-aws transition-colors cursor-pointer">SIMS</span>
        </nav>

        <div className="flex items-center gap-2.5">
          <span className="hidden sm:flex items-center gap-1.5 text-[8px] uppercase tracking-[0.2em] text-mint border border-mint/30 bg-mint/5 px-2 py-1">
            <Radio className="w-3 h-3 animate-pulse" />
            LIVE
          </span>
          <span className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground border border-foreground/15 px-2 py-1">
            v2.0.77
          </span>
        </div>
      </div>
      {/* scan strip */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-aws/60 to-transparent" aria-hidden="true" />
    </motion.header>
  );
}
