"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassPanel } from "@/components/shared/glass-panel";
import { FlowCanvas, FlowNode, FlowLink, FlowLabel } from "@/components/shared/flow";
import { Callout } from "@/components/shared/callout";
import { SimControls } from "@/components/shared/sim-controls";
import { StatChip } from "@/components/shared/typography";
import { EC2Icon, ELBIcon, UserIcon } from "@/components/aws-icons";
import { Lock, Route, Skull } from "lucide-react";

/* ------------------------------------------------------------------ */
/* types + static data                                                 */
/* ------------------------------------------------------------------ */

type TargetState = "healthy" | "draining" | "recovering";

interface Target {
  id: string;
  count: number;
  state: TargetState;
  ticks: number;
}

interface ReqDot {
  id: number;
  path: string | null;
  tx: number;
  ty: number;
}

const WEB_POS: Record<string, { x: number; y: number }> = {
  "tg-web-01": { x: 70, y: 62 },
  "tg-web-02": { x: 88, y: 62 },
  "tg-web-03": { x: 70, y: 83 },
  "tg-web-04": { x: 88, y: 83 },
};

const IMG_POS: Record<string, { x: number; y: number }> = {
  "tg-img-01": { x: 72, y: 18 },
  "tg-img-02": { x: 88, y: 18 },
};

const freshWeb = (): Target[] => [
  { id: "tg-web-01", count: 0, state: "healthy", ticks: 0 },
  { id: "tg-web-02", count: 0, state: "healthy", ticks: 0 },
  { id: "tg-web-03", count: 0, state: "healthy", ticks: 0 },
  { id: "tg-web-04", count: 0, state: "healthy", ticks: 0 },
];

const freshImg = (): Target[] => [
  { id: "tg-img-01", count: 0, state: "healthy", ticks: 0 },
  { id: "tg-img-02", count: 0, state: "healthy", ticks: 0 },
];

const BTN =
  "flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] border bg-black/50 backdrop-blur-md cyber-cut-sm disabled:opacity-35 disabled:cursor-not-allowed transition-colors";

/* ------------------------------------------------------------------ */
/* ELB — TRAFFIC SPLITTER                                              */
/* ------------------------------------------------------------------ */

export default function ELBVisualizer() {
  const [targets, setTargets] = useState<Target[]>(freshWeb);
  const [imgTargets, setImgTargets] = useState<Target[]>(freshImg);
  const [total, setTotal] = useState(0);
  const [conns, setConns] = useState(24);
  const [dots, setDots] = useState<ReqDot[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pathChip, setPathChip] = useState<{ id: number; label: string } | null>(null);
  const [pathRules, setPathRules] = useState(false);
  const [running, setRunning] = useState(false);

  const targetsRef = useRef<Target[]>(freshWeb());
  const imgRef = useRef<Target[]>(freshImg());
  const totalRef = useRef(0);
  const connsRef = useRef(24);
  const rrRef = useRef(0);
  const pathRef = useRef(false);
  const dotIdRef = useRef(1);
  const timersRef = useRef<number[]>([]);

  useEffect(
    () => () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
    },
    []
  );

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
  };

  /* one routing + health tick (~700 ms of "live traffic") */
  const tick = () => {
    const web = targetsRef.current;
    const img = imgRef.current;

    /* 1. health countdown: draining → recovering → healthy */
    web.forEach((t) => {
      if (t.state === "draining") {
        t.ticks -= 1;
        if (t.ticks <= 0) {
          t.state = "recovering";
          t.ticks = 1;
        }
      } else if (t.state === "recovering") {
        t.ticks -= 1;
        if (t.ticks <= 0) t.state = "healthy";
      }
    });

    /* 2. random infrastructure failure while under load */
    const healthy = web.filter((t) => t.state === "healthy");
    if (healthy.length === 4 && Math.random() < 0.06) {
      const victim = healthy[Math.floor(Math.random() * healthy.length)];
      victim.state = "draining";
      victim.ticks = 4;
    }

    /* 3. route one request — round robin over the live pool */
    totalRef.current += 1;
    const useImg = pathRef.current && rrRef.current % 2 === 1;
    const pool = (useImg ? img : web).filter((t) => t.state === "healthy");
    const arr = pool.length > 0 ? pool : useImg ? img : web;
    const target = arr[rrRef.current % arr.length];
    rrRef.current += 1;
    if (target) {
      target.count += 1;
      const pos = (useImg ? IMG_POS : WEB_POS)[target.id];
      const dot: ReqDot = {
        id: dotIdRef.current++,
        path: pathRef.current ? (useImg ? "/img/*" : "/api/*") : null,
        tx: pos.x,
        ty: pos.y,
      };
      setDots((prev) => [...prev.slice(-2), dot]);
      setActiveId(target.id);
      if (pathRef.current) setPathChip({ id: dot.id, label: dot.path ?? "" });
      later(() => setDots((prev) => prev.filter((d) => d.id !== dot.id)), 900);
      later(() => setActiveId((cur) => (cur === target.id ? null : cur)), 650);
    }

    /* 4. connection count drifts with traffic */
    connsRef.current = Math.min(96, Math.max(8, connsRef.current + Math.round(Math.random() * 14 - 7)));

    setTargets([...web]);
    setImgTargets([...img]);
    setTotal(totalRef.current);
    setConns(connsRef.current);
  };

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(tick, 700);
    return () => window.clearInterval(timer);
  }, [running]);

  const killTarget = () => {
    const web = targetsRef.current;
    const healthy = web.filter((t) => t.state === "healthy");
    if (healthy.length === 0) return;
    const victim = healthy[Math.floor(Math.random() * healthy.length)];
    victim.state = "draining";
    victim.ticks = 4;
    setTargets([...web]);
  };

  const reset = () => {
    setRunning(false);
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
    targetsRef.current = freshWeb();
    imgRef.current = freshImg();
    totalRef.current = 0;
    connsRef.current = 24;
    rrRef.current = 0;
    setTargets(freshWeb());
    setImgTargets(freshImg());
    setTotal(0);
    setConns(24);
    setDots([]);
    setActiveId(null);
    setPathChip(null);
  };

  const togglePathRules = () => {
    const v = !pathRef.current;
    pathRef.current = v;
    setPathRules(v);
    if (!v) setPathChip(null);
  };

  const healthyCount = targets.filter((t) => t.state === "healthy").length;
  const maxCount = Math.max(1, ...targets.map((t) => t.count), ...imgTargets.map((t) => t.count));

  const linkStatus = (t: Target, isActive: boolean): "idle" | "flowing" | "success" | "error" =>
    t.state === "draining" ? "error" : t.state === "recovering" ? "success" : isActive ? "flowing" : "idle";

  return (
    <div className="flex flex-col gap-4">
      {/* MAIN GRID — ANIMATION LEFT / RAIL RIGHT */}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
        <GlassPanel
          title="FLOW VIEW // TRAFFIC SPLITTER"
          subtitle="USERS → ALB :443 → TARGET GROUPS — ROUND ROBIN"
          className="!p-0 overflow-hidden"
          delay={0.05}
        >
          <FlowCanvas className="h-[440px] sm:h-[540px] lg:h-[560px]" ariaLabel="Elastic Load Balancing traffic flow diagram">
            {/* TARGET GROUP BOUNDARIES */}
            <div className="absolute border border-dashed border-aws/35 bg-aws/[0.02]" style={{ left: "61%", top: "48%", width: "37%", height: "47%" }} aria-hidden="true" />
            {pathRules && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute border border-dashed border-magenta/40 bg-magenta/[0.03]"
                style={{ left: "61%", top: "5%", width: "37%", height: "30%" }}
                aria-hidden="true"
              />
            )}

            {/* LINKS — CLIENTS → LISTENER → ALB */}
            <FlowLink d="M12,50 L21,50" status={running ? "flowing" : "idle"} dotDuration={1.1} />
            <FlowLink d="M33,50 L41,50" status={running ? "flowing" : "idle"} dotDuration={1.0} />

            {/* LINKS — ALB → WEB TARGETS */}
            {targets.map((t) => {
              const pos = WEB_POS[t.id];
              const paths: Record<string, string> = {
                "tg-web-01": "M51,53 C58,56 62,58 66,61",
                "tg-web-02": "M51,52 C64,55 74,58 84,61",
                "tg-web-03": "M51,55 C58,64 62,74 66,81",
                "tg-web-04": "M51,55 C64,64 74,75 84,81",
              };
              return (
                <FlowLink
                  key={t.id}
                  d={paths[t.id]}
                  status={linkStatus(t, activeId === t.id)}
                  dot={t.state === "healthy" && running}
                  dotDuration={1.5}
                  dotDelay={0.2}
                  dashed={t.state === "draining"}
                />
              );
            })}

            {/* LINKS — ALB → IMAGE TARGET GROUP */}
            {pathRules &&
              imgTargets.map((t) => (
                <FlowLink
                  key={t.id}
                  d={t.id === "tg-img-01" ? "M50,45 C56,37 63,27 69,20" : "M50,44 C64,35 77,25 85,20"}
                  status={activeId === t.id ? "cyber" : "idle"}
                  dot={running}
                  dotDuration={1.5}
                  dotDelay={0.35}
                />
              ))}

            {/* USERS — CLOUD OF 3 CLIENT DOTS */}
            <motion.div
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
              style={{ left: "9%", top: "50%" }}
            >
              <div className="glass cyber-cut-sm px-2 py-2">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      animate={running ? { y: [0, -3, 0] } : {}}
                      transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
                      className="text-aws"
                    >
                      <UserIcon className="w-3 h-3" />
                    </motion.span>
                  ))}
                </div>
                <p className="mt-1 text-center text-[6.5px] font-bold uppercase tracking-[0.18em] text-muted-foreground">USERS</p>
              </div>
            </motion.div>

            {/* LISTENER :443 */}
            <FlowNode x={27} y={50} icon={<Lock className="w-3 h-3" />} label="LISTENER" sub=":443 · TLS" status={running ? "active" : "idle"} pulse={running} size="sm" delay={0.2} />

            {/* ALB — DIAMOND CORE */}
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
              style={{ left: "47%", top: "50%" }}
            >
              <div className="relative flex flex-col items-center">
                <div
                  className={`flex h-11 w-11 rotate-45 items-center justify-center border-2 bg-black/70 backdrop-blur-md ${
                    running ? "border-aws box-glow" : "border-aws/50"
                  }`}
                >
                  <span className="-rotate-45 text-aws">
                    <ELBIcon className="w-5 h-5" />
                  </span>
                </div>
                <p className="mt-1.5 text-[7px] font-bold uppercase tracking-[0.18em] text-aws">ALB</p>
                <p className="text-[6.5px] tracking-wider text-muted-foreground">app-nexus-7f</p>
                <AnimatePresence>
                  {pathChip && (
                    <motion.span
                      key={pathChip.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap border border-magenta/50 bg-black/80 px-1 py-0.5 text-[6.5px] font-bold tracking-wider text-magenta"
                    >
                      {pathChip.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* LABELS */}
            <FlowLabel x={27} y={41} tone="aws">TLS 1.3</FlowLabel>
            <FlowLabel x={79} y={50} tone="aws">TG-WEB-PROD</FlowLabel>
            {pathRules && <FlowLabel x={79} y={7} tone="magenta">TG-IMG-CACHE</FlowLabel>}
            <FlowLabel x={47} y={68} tone="default">ROUND ROBIN</FlowLabel>

            {/* WEB TARGET NODES */}
            {targets.map((t, i) => (
              <FlowNode
                key={t.id}
                x={WEB_POS[t.id].x}
                y={WEB_POS[t.id].y}
                icon={<EC2Icon className="w-3 h-3" />}
                label={t.id.toUpperCase()}
                sub={t.state === "draining" ? "UNHEALTHY — DRAINING" : t.state === "recovering" ? "CHK 200 — OK" : `${t.count} REQ`}
                status={t.state === "draining" ? "error" : t.state === "recovering" ? "success" : activeId === t.id ? "active" : "idle"}
                pulse={activeId === t.id || t.state === "draining"}
                size="sm"
                delay={0.4 + i * 0.08}
              />
            ))}

            {/* IMG TARGET NODES */}
            {pathRules &&
              imgTargets.map((t, i) => (
                <FlowNode
                  key={t.id}
                  x={IMG_POS[t.id].x}
                  y={IMG_POS[t.id].y}
                  icon={<EC2Icon className="w-3 h-3" />}
                  label={t.id.toUpperCase()}
                  sub={`${t.count} REQ`}
                  status={activeId === t.id ? "cyber" : "idle"}
                  pulse={activeId === t.id}
                  size="sm"
                  delay={0.6 + i * 0.08}
                />
              ))}

            {/* PER-TARGET REQUEST BARS */}
            {targets.map((t) => (
              <div key={t.id} className="absolute z-[6]" style={{ left: `${WEB_POS[t.id].x}%`, top: `calc(${WEB_POS[t.id].y}% + 25px)` }}>
                <div className="-translate-x-1/2 h-1 w-14 overflow-hidden border border-aws/20 bg-black/70">
                  <motion.div
                    className={`h-full ${t.state === "draining" ? "bg-danger" : "bg-aws"}`}
                    animate={{ width: `${(t.count / maxCount) * 100}%` }}
                    transition={{ duration: 0.45 }}
                  />
                </div>
              </div>
            ))}
            {pathRules &&
              imgTargets.map((t) => (
                <div key={t.id} className="absolute z-[6]" style={{ left: `${IMG_POS[t.id].x}%`, top: `calc(${IMG_POS[t.id].y}% + 25px)` }}>
                  <div className="-translate-x-1/2 h-1 w-14 overflow-hidden border border-magenta/25 bg-black/70">
                    <motion.div className="h-full bg-magenta" animate={{ width: `${(t.count / maxCount) * 100}%` }} transition={{ duration: 0.45 }} />
                  </div>
                </div>
              ))}

            {/* REQUEST DOTS — USERS → ALB → TARGET */}
            {dots.map((d) => (
              <React.Fragment key={d.id}>
                <motion.span
                  className="absolute z-20 h-1.5 w-1.5 bg-aws shadow-[0_0_8px_rgba(255,153,0,0.9)]"
                  initial={{ left: "12%", top: "50%" }}
                  animate={{ left: ["12%", "47%", `${d.tx}%`], top: ["50%", "50%", `${d.ty}%`] }}
                  transition={{ duration: 0.85, ease: "easeInOut" }}
                />
                {d.path && (
                  <motion.span
                    className="absolute z-20 -translate-x-1/2 border border-magenta/40 bg-black/80 px-0.5 text-[6px] font-bold tracking-wider text-magenta"
                    initial={{ left: "12%", top: "45%" }}
                    animate={{ left: ["12%", "47%", `${d.tx}%`], top: ["45%", "45%", `${Math.max(2, d.ty - 5)}%`] }}
                    transition={{ duration: 0.85, ease: "easeInOut" }}
                  >
                    {d.path}
                  </motion.span>
                )}
              </React.Fragment>
            ))}
          </FlowCanvas>
        </GlassPanel>

        {/* RIGHT RAIL — LIVE STATS + TARGET HEALTH */}
        <div className="flex flex-col gap-4 min-w-0">
          <GlassPanel title="LIVE STATS" className="!p-0" delay={0.1}>
            <div className="p-3 grid grid-cols-2 gap-2">
              <StatChip label="REQUESTS SENT" value={String(total)} />
              <StatChip label="HEALTHY TARGETS" value={`${healthyCount}/4`} tone={healthyCount < 4 ? "magenta" : "mint"} delay={0.05} />
              <StatChip label="ALGORITHM" value="ROUND ROBIN" tone="neutral" delay={0.1} />
              <StatChip label="ACTIVE CONNECTIONS" value={String(conns)} tone="magenta" delay={0.15} />
            </div>
          </GlassPanel>

          <GlassPanel title="CONTROLS" className="!p-0" delay={0.12}>
            <div className="p-3 flex flex-col gap-2.5">
              <SimControls
                running={running}
                onToggle={() => setRunning((r) => !r)}
                onReset={reset}
                status={running ? "ALB LIVE — ROUND ROBIN DISPATCHING" : "ALB IDLE — PRESS RUN"}
              />
              <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">LISTENER &amp; TARGETS</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={togglePathRules}
                  aria-label="Toggle path-based listener rules"
                  className={`flex items-center gap-1.5 ${BTN} ${pathRules ? "border-magenta/60 text-magenta shadow-[0_0_14px_rgba(255,45,120,0.25)]" : "border-aws/50 text-aws"}`}
                >
                  <Route className="w-3 h-3" />
                  {pathRules ? "PATH RULES: ON" : "PATH RULES: OFF"}
                </button>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={killTarget}
                  disabled={healthyCount === 0}
                  className={`${BTN} border-danger/60 text-danger hover:bg-danger/10`}
                  aria-label="Kill a random healthy target to trigger health-check failover"
                >
                  <Skull className="w-3 h-3" />
                  KILL TARGET
                </motion.button>
              </div>
              <span className="text-[8px] tracking-wider text-muted-foreground uppercase">
                health check: GET /health every 10s — 2 strikes = unhealthy
              </span>
            </div>
          </GlassPanel>

          <GlassPanel title="TARGET HEALTH" className="!p-0" delay={0.15}>
            <div className="p-3">
              <div className="glass-inset p-2.5 max-h-40 overflow-y-auto cyber-scroll flex flex-col gap-1">
                {targets.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2">
                    <span className="text-[8px] font-bold tracking-wider text-foreground/85">{t.id}</span>
                    <span
                      className={`text-[7px] font-extrabold uppercase tracking-[0.15em] px-1.5 py-0.5 border ${
                        t.state === "healthy"
                          ? "border-mint/50 text-mint"
                          : t.state === "draining"
                            ? "border-danger/60 text-danger"
                            : "border-neon/60 text-neon"
                      }`}
                    >
                      {t.state === "healthy" ? "HEALTHY" : t.state === "draining" ? "UNHEALTHY" : "RECOVERING"}
                    </span>
                  </div>
                ))}
                {pathRules &&
                  imgTargets.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-2">
                      <span className="text-[8px] font-bold tracking-wider text-foreground/85">{t.id}</span>
                      <span
                        className={`text-[7px] font-extrabold uppercase tracking-[0.15em] px-1.5 py-0.5 border ${
                          t.state === "healthy"
                            ? "border-mint/50 text-mint"
                            : t.state === "draining"
                              ? "border-danger/60 text-danger"
                              : "border-neon/60 text-neon"
                        }`}
                      >
                        {t.state === "healthy" ? "HEALTHY" : t.state === "draining" ? "UNHEALTHY" : "RECOVERING"}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </GlassPanel>
        </div>
      </div>

      {/* ══════════ KNOWLEDGE ══════════ */}
      <div className="grid md:grid-cols-3 gap-3">
        <Callout type="exam" title="ALB is Layer 7, NLB is Layer 4">
          ALB routes on HTTP semantics — path, host, headers. NLB forwards raw TCP/UDP with static IPs, ultra-low
          latency and support for millions of requests per second. Exam loves this split.
        </Callout>
        <Callout type="info" title="Cross-zone load balancing spreads evenly">
          With cross-zone load balancing enabled, each ALB node distributes across targets in ALL AZs — not just its
          own. Without it, an AZ with fewer targets per node receives proportionally more traffic per instance.
        </Callout>
        <Callout type="tip" title="Health checks drain targets gracefully">
          The ALB probes each target on a health check path; after the unhealthy threshold it stops routing and puts
          the target in connection draining — in-flight requests finish, new ones go elsewhere. Zero dropped requests.
        </Callout>
      </div>
    </div>
  );
}
