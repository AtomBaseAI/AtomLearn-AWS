"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BackgroundFX } from "@/components/layout/background-fx";
import { ServiceNav } from "@/components/layout/service-nav";
import { BootOverlay } from "@/components/layout/boot-overlay";
import { MODULE_COMPONENTS } from "@/components/services/registry";
import { AWS_ARCH_ICONS, AWSIconTile } from "@/components/aws-icons";
import { SERVICE_MAP, SERVICES } from "@/lib/services-data";

export default function Home() {
  const [booted, setBooted] = useState(false);
  const [activeId, setActiveId] = useState<string>("global-infrastructure");
  const [renderKey, setRenderKey] = useState(0);

  const meta = useMemo(() => SERVICE_MAP[activeId], [activeId]);
  const ActiveModule = MODULE_COMPONENTS[activeId];

  const select = useCallback((id: string) => {
    setActiveId(id);
    setRenderKey((k) => k + 1);
  }, []);

  // keyboard: module hotkeys — 1..9, 0, -, =, [, ]
  useEffect(() => {
    const KEYS = ["1","2","3","4","5","6","7","8","9","0","-","=","[","]"];
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const idx = KEYS.indexOf(e.key);
      if (idx >= 0 && idx < SERVICES.length) select(SERVICES[idx].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [select]);

  return (
    <div className="min-h-screen flex flex-col scanlines relative">
      <BackgroundFX />

      <AnimatePresence>
        {!booted && <BootOverlay onDone={() => setBooted(true)} />}
      </AnimatePresence>

      <main className="flex-1 flex flex-col" role="main">
        <div className="flex-1 w-full px-3 sm:px-5 py-5 flex flex-col lg:flex-row gap-5 items-start">
          {/* NAV RAIL — 96vh height, fixed with 2vh top / 2vh bottom inset (desktop) */}
          <div className="w-full lg:w-auto lg:sticky lg:top-[2vh] lg:h-[96vh] lg:-mt-1.5">
            <ServiceNav activeId={activeId} onSelect={select} />
          </div>

          {/* MODULE VIEWPORT */}
          <div className="flex-1 min-w-0 w-full">
            {/* module header bar */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`meta-${activeId}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35 }}
                className="glass-deep corner-brackets p-4 sm:p-5 mb-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <span className="flex items-center justify-center w-11 h-11 border border-aws/50 bg-black/40 box-glow shrink-0">
                      <AWSIconTile
                        key={meta.iconId}
                        src={AWS_ARCH_ICONS[meta.iconId]}
                        className="w-8 h-8"
                        alt={`${meta.name} official AWS icon`}
                      />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[8px] uppercase tracking-[0.3em] text-magenta font-bold">
                        MODULE {meta.index} {"//"} {meta.category} — CODENAME: {meta.codename}
                      </p>
                      <h2 className="text-base sm:text-xl font-extrabold uppercase tracking-[0.12em] text-foreground mt-0.5">
                        {meta.name}
                      </h2>
                      <p className="text-[10px] sm:text-xs text-aws/90 mt-1 font-bold uppercase tracking-[0.14em]">
                        {meta.tagline}
                      </p>
                    </div>
                  </div>
                  <div className="hidden sm:grid grid-cols-4 gap-2">
                    {meta.stats.map((st) => (
                      <div key={st.label} className="glass-inset px-2 py-1.5 min-w-[76px]">
                        <p className="text-[7px] uppercase tracking-[0.18em] text-muted-foreground">{st.label}</p>
                        <p className="text-[11px] font-extrabold text-aws">{st.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="mt-3 text-[10px] sm:text-[11px] text-muted-foreground leading-relaxed max-w-4xl">
                  {meta.description}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* active module */}
            <div className="glass-deep corner-brackets p-4 sm:p-6 min-h-[560px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${activeId}-${renderKey}`}
                  initial={{ opacity: 0, scale: 0.985, filter: "blur(6px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 0.99, filter: "blur(6px)" }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="w-full"
                >
                  {ActiveModule ? <ActiveModule /> : null}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
