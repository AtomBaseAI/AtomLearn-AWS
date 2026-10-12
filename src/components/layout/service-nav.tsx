"use client";

import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { AWS_ARCH_ICONS, AWSIconTile } from "@/components/aws-icons";
import { SERVICES } from "@/lib/services-data";
import { cn } from "@/lib/utils";

interface ServiceNavProps {
  activeId: string;
  onSelect: (id: string) => void;
}

interface TipState {
  id: string;
  top: number;
  left: number;
}

/**
 * Desktop: vertical rail of modules — COLLAPSIBLE.
 *   • Shrink mode (default): icons only, full label on hover via portal tooltip.
 *   • Expanded mode: icons + labels + codenames + live UTC clock.
 * Mobile: horizontal scroll chips.
 */
export function ServiceNav({ activeId, onSelect }: ServiceNavProps) {
  const [expanded, setExpanded] = useState(false); // DEFAULT: shrink mode
  const [mounted, setMounted] = useState(false);
  const [tip, setTip] = useState<TipState | null>(null);
  const [utc, setUtc] = useState("--:--:--");

  // restore preference (default stays shrunk) — deferred to avoid sync setState in effect
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        if (localStorage.getItem("awsnexus-rail") === "1") setExpanded(true);
      } catch {
        /* noop */
      }
      setMounted(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  // live UTC clock — runtime detail
  useEffect(() => {
    const tick = () =>
      setUtc(new Date().toLocaleTimeString("en-GB", { timeZone: "UTC", hour12: false }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const toggle = useCallback(() => {
    setExpanded((v) => {
      const next = !v;
      try {
        localStorage.setItem("awsnexus-rail", next ? "1" : "0");
      } catch {
        /* noop */
      }
      return next;
    });
  }, []);

  const showTip = useCallback(
    (id: string, el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      setTip({ id, top: r.top, left: r.right });
    },
    []
  );

  const railWidth = expanded ? 248 : 60;

  return (
    <>
      {/* ================= DESKTOP COLLAPSIBLE RAIL ================= */}
      <motion.nav
        initial={false}
        animate={{ width: railWidth }}
        transition={{ type: "spring", stiffness: 260, damping: 28 }}
        className="hidden lg:flex relative z-20 flex-col gap-1 glass-deep corner-brackets p-2.5 shrink-0 sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto overflow-x-visible cyber-scroll"
        aria-label="Service modules"
      >
        {/* header row: title + expand/collapse toggle */}
        <div className="flex items-center justify-between px-1 pb-2 border-b border-aws/15 min-h-[30px]">
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.p
                key="rail-title"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
                className="text-[8px] font-bold uppercase tracking-[0.28em] text-muted-foreground whitespace-nowrap"
              >
                SERVICE MODULES <span className="text-aws">[{SERVICES.length}]</span>
              </motion.p>
            )}
          </AnimatePresence>
          <button
            type="button"
            onClick={toggle}
            aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
            className="flex items-center justify-center w-7 h-7 border border-aws/40 text-aws hover:bg-aws/10 hover:border-aws/70 transition-colors shrink-0"
          >
            {expanded ? <ChevronsLeft className="w-3.5 h-3.5" /> : <ChevronsRight className="w-3.5 h-3.5" />}
          </button>
        </div>

        {SERVICES.map((s, i) => {
          const active = s.id === activeId;
          return (
            <motion.button
              key={s.id}
              type="button"
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: mounted ? 0 : 0.04 * i, duration: 0.35 }}
              whileHover={{ x: 2 }}
              onClick={() => onSelect(s.id)}
              onMouseEnter={(e) => {
                if (!expanded) showTip(s.id, e.currentTarget);
              }}
              onMouseMove={(e) => {
                if (!expanded) showTip(s.id, e.currentTarget);
              }}
              onMouseLeave={() => setTip(null)}
              className={cn(
                "group relative flex items-center gap-2.5 border text-left transition-colors overflow-hidden",
                expanded ? "px-2.5 py-2" : "justify-center px-0 py-2",
                active
                  ? "border-aws/70 bg-aws/10 box-glow"
                  : "border-transparent hover:border-aws/30 hover:bg-aws/[0.04]"
              )}
              aria-current={active ? "page" : undefined}
              aria-label={`${s.name} — ${s.codename}`}
            >
              {active && (
                <motion.span
                  layoutId="nav-rail-marker"
                  className="absolute left-0 top-0 bottom-0 w-[3px] bg-aws box-glow"
                  aria-hidden="true"
                />
              )}
              <span
                className={cn(
                  "flex items-center justify-center w-8 h-8 border shrink-0 transition-colors bg-black/30",
                  active
                    ? "border-aws/60"
                    : "border-foreground/15 group-hover:border-aws/40"
                )}
              >
                <AWSIconTile
                  src={AWS_ARCH_ICONS[s.id]}
                  className={cn(
                    "w-[22px] h-[22px] transition-transform duration-200 group-hover:scale-110",
                    !active && "opacity-80 group-hover:opacity-100"
                  )}
                  alt=""
                />
              </span>
              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.span
                    key="rail-labels"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.18 }}
                    className="flex flex-col min-w-0 leading-tight"
                  >
                    <span
                      className={cn(
                        "text-[9px] font-bold tracking-[0.18em] uppercase truncate whitespace-nowrap",
                        active ? "text-aws" : "text-foreground/80"
                      )}
                    >
                      {s.index} {"//"} {s.short}
                    </span>
                    <span className="text-[7px] tracking-[0.2em] text-muted-foreground uppercase truncate whitespace-nowrap">
                      {s.codename}
                    </span>
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}

        {/* footer: uplink status + live UTC clock */}
        <div className="mt-1 pt-2 border-t border-aws/15 px-1 flex items-center justify-between text-[7px] uppercase tracking-[0.22em] text-muted-foreground min-h-[24px]">
          <AnimatePresence initial={false}>
            {expanded ? (
              <motion.span
                key="uplink"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="whitespace-nowrap"
              >
                UPLINK <span className="flex items-center gap-1 text-mint mt-0.5">
                  <span className="w-1 h-1 bg-mint animate-pulse" aria-hidden="true" />
                  STABLE
                </span>
              </motion.span>
            ) : (
              <motion.span
                key="dot"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-1.5 h-1.5 bg-mint animate-pulse mx-auto"
                aria-label="Uplink stable"
              />
            )}
          </AnimatePresence>
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.span
                key="utc"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-aws whitespace-nowrap tabular-nums"
                title="Live UTC clock"
              >
                {utc} UTC
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </motion.nav>

      {/* hover tooltip (portal — escapes rail overflow) */}
      {mounted &&
        tip &&
        !expanded &&
        createPortal(
          <AnimatePresence>
            <motion.div
              key={tip.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14, delay: 0.05 }}
              className="fixed z-[9999] pointer-events-none glass-deep border border-aws/50 px-2.5 py-1.5 box-glow"
              style={{ top: tip.top, left: tip.left + 10 }}
              role="tooltip"
            >
              {(() => {
                const s = SERVICES.find((x) => x.id === tip.id);
                if (!s) return null;
                return (
                  <div className="flex items-center gap-2">
                    <AWSIconTile
                      src={AWS_ARCH_ICONS[s.id]}
                      className="w-6 h-6 shrink-0"
                      alt=""
                    />
                    <div className="flex flex-col">
                      <p className="text-[9px] font-bold tracking-[0.18em] text-aws uppercase whitespace-nowrap leading-tight">
                        {s.index} {"//"} {s.short}
                      </p>
                      <p className="text-[7px] tracking-[0.2em] text-muted-foreground uppercase whitespace-nowrap mt-0.5">
                        {s.codename}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </AnimatePresence>,
          document.body
        )}

      {/* ================= MOBILE HORIZONTAL CHIPS ================= */}
      <nav
        className="lg:hidden flex gap-2 overflow-x-auto cyber-scroll pb-1 -mx-3 px-3"
        aria-label="Service modules"
      >
        {SERVICES.map((s) => {
          const active = s.id === activeId;
          return (
            <motion.button
              key={s.id}
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => onSelect(s.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 border text-[9px] font-bold uppercase tracking-[0.16em] whitespace-nowrap backdrop-blur-md",
                active
                  ? "border-aws/70 bg-aws/12 text-aws box-glow"
                  : "border-foreground/15 bg-black/40 text-foreground/70"
              )}
              aria-current={active ? "page" : undefined}
            >
              <AWSIconTile src={AWS_ARCH_ICONS[s.id]} className="w-4 h-4" alt="" />
              {s.index}{"//"}{s.short}
            </motion.button>
          );
        })}
      </nav>
    </>
  );
}
