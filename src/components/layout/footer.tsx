"use client";

import React from "react";
import { Activity, Terminal, Cpu } from "lucide-react";

export function Footer() {
  return (
    <footer
      className="mt-auto relative z-30 border-t border-aws/20 glass-deep"
      role="contentinfo"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-[8px] sm:text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
        <span className="flex items-center gap-2">
          <Terminal className="w-3 h-3 text-aws" />
          AWS//NEXUS — BUILT FOR CLOUD BUILDERS
        </span>
        <span className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-mint animate-pulse" aria-hidden="true" />
            ALL SYSTEMS OPERATIONAL
          </span>
          <span className="hidden sm:flex items-center gap-1.5">
            <Cpu className="w-3 h-3 text-aws" />
            WEBGL // THREE.JS
          </span>
          <span className="hidden md:flex items-center gap-1.5">
            <Activity className="w-3 h-3 text-magenta" />
            60 FPS
          </span>
        </span>
      </div>
    </footer>
  );
}
