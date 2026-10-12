"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { NEXUS_LOGO, AWS_ARCH_ICONS, AWSIconTile } from "@/components/aws-icons";
import { SERVICES } from "@/lib/services-data";

const BOOT_LINES = [
  "> INITIALIZING NEXUS KERNEL v2.0.77",
  "> ESTABLISHING UPLINK :: us-east-1",
  "> HANDSHAKE OK — TLS 1.3 / 12ms",
  `> MOUNTING ${SERVICES.length} SERVICE MODULES`,
  "> COMPILING NEURAL FLOW GRAPHS",
  "> SPINNING UP WEBGL RENDERER",
  "> ACCESS GRANTED — WELCOME, BUILDER",
];

export function BootOverlay({ onDone }: { onDone: () => void }) {
  const [lineCount, setLineCount] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const lineTimer = setInterval(() => {
      setLineCount((c) => {
        if (c >= BOOT_LINES.length) {
          clearInterval(lineTimer);
          return c;
        }
        return c + 1;
      });
    }, 240);
    const progTimer = setInterval(() => {
      setProgress((p) => Math.min(100, p + Math.random() * 9 + 3));
    }, 90);
    const done = setTimeout(onDone, 2400);
    return () => {
      clearInterval(lineTimer);
      clearInterval(progTimer);
      clearTimeout(done);
    };
  }, [onDone]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] bg-void flex flex-col items-center justify-center cursor-pointer crt-flicker"
      exit={{ opacity: 0, scale: 1.04, filter: "blur(8px)" }}
      transition={{ duration: 0.5 }}
      onClick={onDone}
      role="button"
      aria-label="Skip boot sequence"
    >
      <div className="absolute inset-0 bg-cyber-grid opacity-40" aria-hidden="true" />
      <div className="scanlines absolute inset-0" aria-hidden="true" />
      <div className="relative flex flex-col items-center w-full max-w-md px-6">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <NEXUS_LOGO className="w-16 h-16" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-2xl font-extrabold tracking-[0.35em] text-aws text-glow"
        >
          AWS//NEXUS
        </motion.h1>
        <p className="mt-2 text-[9px] tracking-[0.4em] text-muted-foreground uppercase">
          VISUAL CLOUD CONSOLE — BOOT SEQUENCE
        </p>

        {/* official AWS service tiles mounting in sequence */}
        <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">
          {Object.values(AWS_ARCH_ICONS).map((src, i) => (
            <motion.div
              key={src}
              initial={{ opacity: 0, y: 6, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.9 + i * 0.11, duration: 0.3 }}
            >
              <AWSIconTile src={src} className="w-5 h-5" />
            </motion.div>
          ))}
        </div>

        <div className="mt-8 w-full h-40 sm:h-44 glass-inset p-3 overflow-hidden text-[9px] sm:text-[10px] leading-[1.7]">
          {BOOT_LINES.slice(0, lineCount).map((line, i) => (
            <motion.p
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className={i === BOOT_LINES.length - 1 ? "text-mint" : "text-aws/80"}
            >
              {line}
              {i === lineCount - 1 && <span className="blink-cursor text-aws">▊</span>}
            </motion.p>
          ))}
        </div>

        <div className="mt-5 w-full flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-white/5 border border-aws/25 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-ember to-aws box-glow"
              style={{ width: `${progress}%` }}
              transition={{ ease: "linear" }}
            />
          </div>
          <span className="text-[9px] text-aws font-bold w-9 text-right">{Math.floor(progress)}%</span>
        </div>
        <p className="mt-4 text-[8px] tracking-[0.3em] text-muted-foreground/60 uppercase">
          CLICK ANYWHERE TO SKIP
        </p>
      </div>
    </motion.div>
  );
}
