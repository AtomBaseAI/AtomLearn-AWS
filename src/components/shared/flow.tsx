"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { animate, createTimer, utils } from "animejs";

/**
 * FLOW DIAGRAM SYSTEM
 *
 * Pattern: FlowCanvas provides a percentage-based coordinate space (0–100).
 * - `links` / FlowLink render as self-contained HTML overlays. Each FlowLink
 *   measures its own box with a ResizeObserver, rescales the 0–100 path into
 *   REAL PIXEL SPACE and drives every line/dot animation with anime.js.
 *   (No stretched viewBox => uniform strokes, uniform dashes, circular dots,
 *   zero sub-pixel jitter — this is what kills the old line glitching.)
 * - `children` (FlowNode / FlowLabel) are HTML layers positioned by x/y percent.
 *
 * All coordinates are percentages: x:0 = left edge, y:0 = top edge.
 */

export type NodeStatus = "idle" | "active" | "success" | "warn" | "error" | "cyber";

const STATUS_STYLES: Record<
  NodeStatus,
  { border: string; text: string; glow: string; bg: string; dot: string }
> = {
  idle: {
    border: "border-foreground/25",
    text: "text-foreground/75",
    glow: "",
    bg: "bg-white/[0.04]",
    dot: "bg-foreground/40",
  },
  active: {
    border: "border-aws/70",
    text: "text-aws",
    glow: "box-glow",
    bg: "bg-aws/[0.07]",
    dot: "bg-aws",
  },
  success: {
    border: "border-mint/60",
    text: "text-mint",
    glow: "shadow-[0_0_18px_rgba(0,255,163,0.25)]",
    bg: "bg-mint/[0.06]",
    dot: "bg-mint",
  },
  warn: {
    border: "border-neon/60",
    text: "text-neon",
    glow: "shadow-[0_0_18px_rgba(255,179,71,0.25)]",
    bg: "bg-neon/[0.06]",
    dot: "bg-neon",
  },
  error: {
    border: "border-danger/70",
    text: "text-danger",
    glow: "shadow-[0_0_18px_rgba(255,51,85,0.3)]",
    bg: "bg-danger/[0.07]",
    dot: "bg-danger",
  },
  cyber: {
    border: "border-magenta/60",
    text: "text-magenta",
    glow: "shadow-[0_0_18px_rgba(255,45,120,0.3)]",
    bg: "bg-magenta/[0.06]",
    dot: "bg-magenta",
  },
};

/* ------------------------------------------------------------------ */
/* FlowCanvas                                                          */
/* ------------------------------------------------------------------ */

interface FlowCanvasProps {
  links?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  grid?: boolean;
  ariaLabel?: string;
}

export function FlowCanvas({ links, children, className = "", grid = true, ariaLabel }: FlowCanvasProps) {
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={`relative overflow-hidden bg-black/40 border border-aws/12 ${grid ? "bg-cyber-grid-fine" : ""} ${className}`}
    >
      {/* link layer — self-contained pixel-space SVG overlays (below nodes) */}
      <div className="absolute inset-0 z-0 pointer-events-none">{links}</div>
      {/* HTML node layer */}
      <div className="absolute inset-0">{children}</div>
      {/* corner ticks */}
      <span className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-aws/60" aria-hidden="true" />
      <span className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-aws/60" aria-hidden="true" />
      <span className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l border-aws/60" aria-hidden="true" />
      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-aws/60" aria-hidden="true" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* FlowNode                                                            */
/* ------------------------------------------------------------------ */

interface FlowNodeProps {
  x: number; // percent 0-100 (center)
  y: number; // percent 0-100 (center)
  icon?: React.ReactNode;
  label: string;
  sub?: string;
  status?: NodeStatus;
  size?: "xs" | "sm" | "md" | "lg";
  pulse?: boolean;
  onClick?: () => void;
  active?: boolean;
  className?: string;
  delay?: number;
}

export function FlowNode({
  x,
  y,
  icon,
  label,
  sub,
  status = "idle",
  size = "sm",
  pulse,
  onClick,
  active,
  className = "",
  delay = 0,
}: FlowNodeProps) {
  const s = STATUS_STYLES[status];
  const sizeCls =
    size === "xs"
      ? "px-1.5 py-1 text-[7px] gap-1 min-h-[20px]"
      : size === "sm"
        ? "px-2 py-1.5 text-[8px] gap-1.5 min-h-[30px]"
        : size === "md"
          ? "px-2.5 py-2 text-[9px] gap-1.5 min-h-[40px]"
          : "px-3 py-2.5 text-[10px] gap-2 min-h-[52px]";
  const iconCls = size === "lg" ? "w-5 h-5" : size === "md" ? "w-4 h-4" : "w-3 h-3";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`absolute -translate-x-1/2 -translate-y-1/2 z-10 ${className}`}
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <motion.button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        whileHover={onClick ? { scale: 1.08 } : undefined}
        whileTap={onClick ? { scale: 0.94 } : undefined}
        className={`relative flex items-center border backdrop-blur-md font-bold uppercase tracking-[0.14em] whitespace-nowrap cyber-cut-sm ${s.border} ${s.text} ${s.bg} ${active ? s.glow : ""} ${onClick ? "cursor-pointer" : "cursor-default"} ${sizeCls}`}
        aria-label={label}
      >
        {pulse && (
          <span className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 ${s.dot} ping-ring`} aria-hidden="true" />
        )}
        {icon && <span className="shrink-0 flex [&>svg]:w-full [&>svg]:h-full">
          <span className={iconCls}>{icon}</span>
        </span>}
        <span className="flex flex-col items-start leading-tight">
          <span>{label}</span>
          {sub && <span className="text-[7px] font-normal text-muted-foreground tracking-wider">{sub}</span>}
        </span>
      </motion.button>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* FlowLink — anime.js driven pixel-space connector (0-100 coord in)   */
/* ------------------------------------------------------------------ */

interface FlowLinkProps {
  d: string; // path in the 0-100 FlowCanvas coordinate space
  status?: "idle" | "flowing" | "success" | "error" | "cyber";
  strokeWidth?: number;
  dot?: boolean;
  dotDuration?: number;
  dotDelay?: number;
  dashed?: boolean;
  showArrow?: boolean;
}

const LINK_COLOR: Record<string, string> = {
  idle: "rgba(232,230,227,0.25)",
  flowing: "#ff9900",
  success: "#00ffa3",
  error: "#ff3355",
  cyber: "#ff2d78",
};

/* One dash period of the flowing pattern (6 on + 8 off) */
const DASH_PERIOD = 14;
/* How many periods travel per second (matches the classic 1s/-28 speed) */
const DASH_SPEED = 2;

type Token = { cmd: string } | { num: number };

const PATH_TOKEN_RE = /([MmLlHhVvCcSsQqTtAaZz])|([-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?)/g;
const CMD_ARITY: Record<string, number> = {
  M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0,
  m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0,
};

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Rescale an absolute/relative SVG path from the 0-100 percentage space
 * into pixel space (sx = px per x-unit, sy = px per y-unit).
 * Handles M L H V C S Q T A Z + relative variants + implicit repeats.
 */
export function scalePathD(d: string, sx: number, sy: number): string {
  if (sx === 1 && sy === 1) return d;
  const tokens: Token[] = [];
  let m: RegExpExecArray | null;
  PATH_TOKEN_RE.lastIndex = 0;
  while ((m = PATH_TOKEN_RE.exec(d)) !== null) {
    if (m[1] !== undefined) tokens.push({ cmd: m[1] });
    else tokens.push({ num: parseFloat(m[2]) });
  }
  if (!tokens.length) return d;

  let out = "";
  let cmd = "";
  let buf: number[] = [];

  const emit = () => {
    if (!cmd || buf.length === 0) return;
    out += (out ? " " : "") + cmd + buf.map(r3).join(" ");
    buf = [];
  };

  const pair = (x: number, y: number) => [x * sx, y * sy] as const;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if ("cmd" in t) {
      emit();
      cmd = t.cmd;
      continue;
    }
    const arity = CMD_ARITY[cmd];
    if (!arity) continue;
    // gather one full command group (handles implicit repeats)
    const group: number[] = [t.num];
    while (group.length < arity && i + 1 < tokens.length && "num" in tokens[i + 1]) {
      group.push((tokens[++i] as { num: number }).num);
    }
    const lower = cmd.toLowerCase();
    let scaled: number[] = group;
    switch (lower) {
      case "m":
      case "l":
      case "t":
        scaled = [];
        for (let k = 0; k < group.length; k += 2) {
          const [x, y] = pair(group[k], group[k + 1]);
          scaled.push(x, y);
        }
        break;
      case "h":
        scaled = [group[0] * sx];
        break;
      case "v":
        scaled = [group[0] * sy];
        break;
      case "c":
        scaled = [];
        for (let k = 0; k < group.length; k += 6) {
          const [x1, y1] = pair(group[k], group[k + 1]);
          const [x2, y2] = pair(group[k + 2], group[k + 3]);
          const [x, y] = pair(group[k + 4], group[k + 5]);
          scaled.push(x1, y1, x2, y2, x, y);
        }
        break;
      case "s":
      case "q":
        scaled = [];
        for (let k = 0; k < group.length; k += 4) {
          const [x1, y1] = pair(group[k], group[k + 1]);
          const [x, y] = pair(group[k + 2], group[k + 3]);
          scaled.push(x1, y1, x, y);
        }
        break;
      case "a":
        scaled = [
          group[0] * sx, // rx
          group[1] * sy, // ry
          group[2], // x-axis-rotation
          group[3], // large-arc-flag
          group[4], // sweep-flag
          group[5] * sx, // x
          group[6] * sy, // y
        ];
        break;
      case "z":
      default:
        scaled = group;
    }
    // implicit repetition after M means lineto (per SVG spec)
    if (buf.length > 0 && cmd === "M") cmd = "L";
    if (buf.length > 0 && cmd === "m") cmd = "l";
    buf = buf.concat(scaled);
  }
  emit();
  return out;
}

type Pausable = { cancel?: () => unknown; pause?: () => unknown };

export function FlowLink({
  d,
  status = "flowing",
  strokeWidth = 1,
  dot = true,
  dotDuration = 2.2,
  dotDelay = 0,
  dashed,
  showArrow = false,
}: FlowLinkProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGGElement>(null);
  const arrowRef = useRef<SVGPathElement>(null);
  const instancesRef = useRef<Pausable[]>([]);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  const color = LINK_COLOR[status];
  const showDot = dot && status !== "idle";

  /* Measure the box so the 0-100 path can be rescaled to real pixels */
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      const w = Math.round(cr.width);
      const h = Math.round(cr.height);
      setDims((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* Build the pixel-space path + drive ALL motion with anime.js */
  useEffect(() => {
    const path = pathRef.current;
    if (!path || dims.w < 2 || dims.h < 2) return;

    // stop previous instances (cancel removes them from the engine loop)
    instancesRef.current.forEach((inst) => {
      try {
        if (typeof inst.cancel === "function") inst.cancel();
        else if (typeof inst.pause === "function") inst.pause();
      } catch {
        /* instance already dead */
      }
    });
    instancesRef.current = [];

    const sx = dims.w / 100;
    const sy = dims.h / 100;
    path.setAttribute("d", scalePathD(d, sx, sy));
    const len = path.getTotalLength();

    /* Arrow head aligned with the end tangent */
    if (arrowRef.current && len > 6) {
      const end = path.getPointAtLength(len);
      const before = path.getPointAtLength(Math.max(0, len - 2));
      const ang = (Math.atan2(end.y - before.y, end.x - before.x) * 180) / Math.PI;
      arrowRef.current.setAttribute("transform", `translate(${end.x} ${end.y}) rotate(${ang})`);
    }

    /* Base dash state */
    if (dashed) {
      path.style.strokeDasharray = "4 4";
      path.style.strokeDashoffset = "0";
    } else {
      path.style.strokeDasharray = "none";
      path.style.strokeDashoffset = "0";
    }

    /* Flowing dash — anime.js drives stroke-dashoffset in pixel space.
       One full period per loop => perfectly seamless. */
    if (status === "flowing" && !dashed && len > 0) {
      path.style.strokeDasharray = "6 8";
      const flow = animate(path, {
        strokeDashoffset: -DASH_PERIOD,
        duration: DASH_PERIOD / DASH_SPEED * 100,
        ease: "linear",
        loop: true,
      });
      instancesRef.current.push(flow);
    }

    /* Traveling packet — anime.js timer follows the REAL path geometry
       through getPointAtLength, so speed is constant and the dot is a
       perfect circle (no SMIL, no stretched viewBox artifacts). */
    const dotG = dotRef.current;
    if (dotG && showDot && len > 0) {
      const place = (p: number) => {
        if (!pathRef.current || !dotRef.current) return;
        const pt = pathRef.current.getPointAtLength(p * len);
        dotRef.current.setAttribute("transform", `translate(${pt.x} ${pt.y})`);
      };
      place(0);
      const timer = createTimer({
        duration: Math.max(180, dotDuration * 1000),
        delay: Math.max(0, dotDelay * 1000),
        loop: true,
        onUpdate: (t) => place(t.iterationProgress),
      });
      instancesRef.current.push(timer);
    }

    return () => {
      instancesRef.current.forEach((inst) => {
        try {
          if (typeof inst.cancel === "function") inst.cancel();
          else if (typeof inst.pause === "function") inst.pause();
        } catch {
          /* noop */
        }
      });
      instancesRef.current = [];
      if (pathRef.current) utils.remove(pathRef.current);
    };
  }, [d, dims.w, dims.h, status, showDot, dotDuration, dotDelay, dashed, strokeWidth]);

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 overflow-visible pointer-events-none"
      aria-hidden="true"
    >
      <svg className="block w-full h-full overflow-visible">
        <path
          ref={pathRef}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
          opacity={status === "idle" ? 0.5 : 0.85}
        />
        {showArrow && <path ref={arrowRef} d="M-6,-3 L0,0 L-6,3 Z" fill={color} opacity={0.9} transform="translate(-100 -100)" />}
        {showDot && (
          <g ref={dotRef} transform="translate(-100 -100)">
            <circle r={strokeWidth + 3.4} fill={color} opacity={0.22} />
            <circle r={strokeWidth + 0.7} fill={color} />
          </g>
        )}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* FlowLabel — tiny caption positioned on the canvas                   */
/* ------------------------------------------------------------------ */

interface FlowLabelProps {
  x: number;
  y: number;
  children: React.ReactNode;
  tone?: "default" | "aws" | "mint" | "danger" | "magenta";
  className?: string;
}

export function FlowLabel({ x, y, children, tone = "default", className = "" }: FlowLabelProps) {
  const toneCls =
    tone === "aws"
      ? "text-aws border-aws/40"
      : tone === "mint"
        ? "text-mint border-mint/40"
        : tone === "danger"
          ? "text-danger border-danger/40"
          : tone === "magenta"
            ? "text-magenta border-magenta/40"
            : "text-muted-foreground border-foreground/20";
  return (
    <div
      className={`absolute -translate-x-1/2 -translate-y-1/2 z-[5] px-1.5 py-0.5 text-[7px] sm:text-[8px] uppercase tracking-[0.18em] border bg-black/70 backdrop-blur-sm font-bold ${toneCls} ${className}`}
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {children}
    </div>
  );
}
