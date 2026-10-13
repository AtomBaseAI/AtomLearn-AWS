"use client";

import React from "react";
import { motion } from "framer-motion";

/**
 * Fixed background: cyber grid, radial glows, floating particles.
 * Pure CSS/motion — cheap, no canvas needed here.
 * (Moving scan beam removed — static ambient layers only.)
 */
export function BackgroundFX() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-void" aria-hidden="true">
      {/* base grid */}
      <div className="absolute inset-0 bg-cyber-grid opacity-70" />
      {/* perspective floor grid */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[200%] h-[45%] opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,153,0,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(255,153,0,0.14) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          transform: "translateX(-50%) perspective(500px) rotateX(62deg) scale(1.6)",
          transformOrigin: "bottom",
          maskImage: "linear-gradient(to top, rgba(0,0,0,0.9), transparent 75%)",
          WebkitMaskImage: "linear-gradient(to top, rgba(0,0,0,0.9), transparent 75%)",
        }}
      />
      {/* static glows */}
      <div className="absolute -top-40 left-1/4 w-[600px] h-[600px] bg-aws/10 blur-[140px]" />
      <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] bg-magenta/[0.07] blur-[130px]" />
      <div className="absolute bottom-0 -left-40 w-[500px] h-[400px] bg-ember/[0.06] blur-[120px]" />
      {/* breathing glow — slow, ambient (not a bar) */}
      <motion.div
        className="absolute top-1/4 left-1/2 w-[420px] h-[420px] bg-aws/[0.05] blur-[120px]"
        animate={{ scale: [1, 1.25, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* floating particles — mixed palette, gentle drift */}
      {PARTICLES.map((p, i) => (
        <motion.span
          key={i}
          className="absolute"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.s,
            height: p.s,
            background: p.c,
            boxShadow: `0 0 ${p.s * 3}px ${p.c}`,
          }}
          animate={{
            y: [0, p.rise, 0],
            x: [0, p.drift, 0],
            opacity: [0.12, p.peak, 0.12],
          }}
          transition={{ duration: p.d, repeat: Infinity, delay: p.delay, ease: "easeInOut" }}
        />
      ))}
      <div className="noise-overlay" />
    </div>
  );
}

const PARTICLES = [
  { x: 8,  y: 22, d: 9,   delay: 0,   s: 3, rise: -34, drift: 6,  peak: 0.9,  c: "rgba(255,153,0,0.8)" },
  { x: 18, y: 68, d: 11,  delay: 1.2, s: 2, rise: -26, drift: -8, peak: 0.7,  c: "rgba(255,179,71,0.75)" },
  { x: 32, y: 40, d: 10,  delay: 0.4, s: 3, rise: -40, drift: 5,  peak: 0.85, c: "rgba(255,153,0,0.8)" },
  { x: 47, y: 82, d: 12,  delay: 2,   s: 2, rise: -30, drift: -6, peak: 0.6,  c: "rgba(255,45,120,0.6)" },
  { x: 61, y: 18, d: 9.5, delay: 0.8, s: 2, rise: -36, drift: 7,  peak: 0.75, c: "rgba(255,255,255,0.55)" },
  { x: 74, y: 55, d: 11.5, delay: 1.6, s: 3, rise: -28, drift: -5, peak: 0.8,  c: "rgba(255,153,0,0.8)" },
  { x: 86, y: 30, d: 10,  delay: 0.2, s: 2, rise: -42, drift: 8,  peak: 0.7,  c: "rgba(255,179,71,0.75)" },
  { x: 93, y: 72, d: 13,  delay: 2.4, s: 2, rise: -24, drift: -7, peak: 0.55, c: "rgba(255,45,120,0.55)" },
  { x: 55, y: 65, d: 14,  delay: 3,   s: 3, rise: -38, drift: 6,  peak: 0.75, c: "rgba(255,153,0,0.8)" },
  { x: 25, y: 12, d: 12,  delay: 1,   s: 2, rise: -30, drift: -6, peak: 0.65, c: "rgba(255,255,255,0.5)" },
  { x: 40, y: 55, d: 10.5, delay: 4.2, s: 2, rise: -44, drift: 9,  peak: 0.7,  c: "rgba(255,179,71,0.7)" },
  { x: 68, y: 82, d: 12.5, delay: 5,   s: 3, rise: -32, drift: -8, peak: 0.6,  c: "rgba(255,153,0,0.75)" },
];
