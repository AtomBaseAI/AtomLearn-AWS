"use client";

import React from "react";
import { motion } from "framer-motion";
import { SERVICES } from "@/lib/services-data";

export function Hero() {
  return (
    <section className="relative overflow-hidden" aria-label="Intro">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 pt-8 pb-6 sm:pt-12 sm:pb-8">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="max-w-3xl">
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.35em] text-aws/90 mb-3"
            >
              {"//"} EXPERIENCE THE CLOUD — VISUALLY
            </motion.p>

            <div className="relative">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="text-3xl sm:text-5xl lg:text-6xl font-extrabold uppercase tracking-[0.06em] leading-[1.05] text-foreground"
              >
                MASTER AWS
              </motion.h1>
              {/* glitch echo layers */}
              <motion.span
                aria-hidden="true"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.75 }}
                transition={{ delay: 0.4 }}
                className="glitch-layer absolute inset-0 text-3xl sm:text-5xl lg:text-6xl font-extrabold uppercase tracking-[0.06em] leading-[1.05] text-aws text-glow pointer-events-none select-none"
              >
                MASTER AWS
              </motion.span>
            </div>

            <motion.h2
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="mt-2 text-xl sm:text-3xl font-bold uppercase tracking-[0.1em] text-aws neon-flicker text-glow"
            >
              IN 11 INTERACTIVE DIMENSIONS_
              <span className="blink-cursor">▊</span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55 }}
              className="mt-4 text-[11px] sm:text-sm text-muted-foreground leading-relaxed max-w-2xl"
            >
              A fully graphical, simulation-driven console for the AWS services that matter —
              real-time <span className="text-aws">Three.js 3D</span>,{" "}
              <span className="text-aws">Framer Motion</span> flow diagrams, live packet traces and
              hands-on what-if sims. Glass. Steel. Orange.
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-2 lg:min-w-[300px]"
          >
            {[
              { label: "MODULES", value: "11" },
              { label: "3D ENGINE", value: "R3F" },
              { label: "SIMS", value: "LIVE" },
              { label: "COST", value: "$0.00" },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.65 + i * 0.08 }}
                className="glass cyber-cut-sm px-3 py-2.5"
              >
                <p className="text-[7px] uppercase tracking-[0.25em] text-muted-foreground">{s.label}</p>
                <p className="text-lg font-extrabold text-aws text-glow">{s.value}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* marquee strip */}
      <div className="relative border-y border-aws/20 bg-black/50 backdrop-blur-sm overflow-hidden py-1.5" aria-hidden="true">
        <div className="marquee-track flex whitespace-nowrap w-max">
          {[0, 1].map((dup) => (
            <span key={dup} className="flex">
              {SERVICES.map((s) => (
                <span
                  key={`${dup}-${s.id}`}
                  className="mx-4 text-[8px] sm:text-[9px] uppercase tracking-[0.3em] text-muted-foreground"
                >
                  <span className="text-aws">◈</span> {s.name} <span className="text-magenta/70">::{s.abbr}</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
