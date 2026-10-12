"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassPanel } from "@/components/shared/glass-panel";
import { FlowCanvas, FlowNode, FlowLink, FlowLabel } from "@/components/shared/flow";
import { Callout } from "@/components/shared/callout";
import { SimControls } from "@/components/shared/sim-controls";
import { StatChip } from "@/components/shared/typography";
import { APIGatewayIcon, LambdaIcon, S3Icon, ServerIcon, UserIcon } from "@/components/aws-icons";
import { Zap, Gauge, Database, Timer } from "lucide-react";

type LogTone = "aws" | "mint" | "danger" | "magenta" | "dim";

interface LogLine {
  id: number;
  text: string;
  tone: LogTone;
}

interface GatewayRequest {
  id: number;
  stage: number; // 0..4 while traversing the pipeline, 5 = response complete
  invalid: boolean;
  throttled: boolean;
  cacheHit: boolean;
  target: number; // 0 = lambda, 1 = http, 2 = s3
  latency: number;
}

const STAGES: Array<{ name: string; sub: string }> = [
  { name: "API KEY CHECK", sub: "USAGE PLAN" },
  { name: "AUTHORIZER", sub: "IAM / COGNITO / λ" },
  { name: "REQ VALIDATION", sub: "JSON SCHEMA" },
  { name: "THROTTLING", sub: "LIMIT 10 RPS" },
  { name: "INTEGRATION", sub: "PROXY / AWS" },
];

const TARGET_LOG = ["AWS_PROXY lambda", "HTTP_PROXY backend", "AWS s3 GET"];

const MAX_LOG = 42;
const TICK_MS = 350;

const LOG_TONE_CLS: Record<LogTone, string> = {
  aws: "text-aws",
  mint: "text-mint",
  danger: "text-danger",
  magenta: "text-magenta",
  dim: "text-muted-foreground",
};

const BTN =
  "flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] border bg-black/50 backdrop-blur-md cyber-cut-sm";

export default function APIGatewayVisualizer() {
  // control states (mirrored into refs so the sim loop stays stable)
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<"dev" | "prod">("dev");
  const [throttleOn, setThrottleOn] = useState(true);
  const [cacheOn, setCacheOn] = useState(false);
  const [ttl, setTtl] = useState(300);

  // live sim state (flushed from refs once per tick)
  const [log, setLog] = useState<LogLine[]>([]);
  const [requests, setRequests] = useState(0);
  const [ok, setOk] = useState(0);
  const [err, setErr] = useState(0);
  const [p50, setP50] = useState("—");
  const [cacheHits, setCacheHits] = useState(0);
  const [activeStage, setActiveStage] = useState(-1);
  const [reqActive, setReqActive] = useState(false);
  const [backendFlash, setBackendFlash] = useState<number | null>(null);
  const [fail400, setFail400] = useState(false);
  const [fail429, setFail429] = useState(false);
  const [cacheFlash, setCacheFlash] = useState(false);
  const [burst, setBurst] = useState(false);

  // refs as source of truth
  const logRef = useRef<LogLine[]>([]);
  const logIdRef = useRef(1);
  const reqIdRef = useRef(1);
  const tickRef = useRef(0);
  const reqRef = useRef<GatewayRequest | null>(null);
  const statsRef = useRef({ requests: 0, ok: 0, err: 0 });
  const latRef = useRef<number[]>([]);
  const cacheHitsRef = useRef(0);
  const burstRef = useRef(false);
  const stageRef = useRef<"dev" | "prod">("dev");
  const throttleRef = useRef(true);
  const cacheOnRef = useRef(false);
  const ttlRef = useRef(300);
  const logBoxRef = useRef<HTMLDivElement | null>(null);

  const pushLog = useCallback((text: string, tone: LogTone = "aws") => {
    logRef.current = [...logRef.current, { id: logIdRef.current++, text, tone }].slice(-MAX_LOG);
  }, []);

  const flush = useCallback(() => {
    setLog(logRef.current);
    setRequests(statsRef.current.requests);
    setOk(statsRef.current.ok);
    setErr(statsRef.current.err);
    setCacheHits(cacheHitsRef.current);
    const lats = [...latRef.current].sort((a, b) => a - b);
    if (lats.length === 0) {
      setP50("—");
    } else {
      const mid = Math.floor(lats.length / 2);
      const med = lats.length % 2 === 1 ? lats[mid] : Math.round((lats[mid - 1] + lats[mid]) / 2);
      setP50(`${med}ms`);
    }
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      const tick = ++tickRef.current;
      if (!reqRef.current && tick % 4 === 0) {
        // SPAWN — a client request enters the pipeline
        const invalid = Math.random() < 0.03;
        const throttled = throttleRef.current && Math.random() < 0.06;
        const baseProb = stageRef.current === "prod" ? 0.4 : 0.3;
        const cacheHit =
          cacheOnRef.current && Math.random() < baseProb * (0.6 + 0.4 * (ttlRef.current / 3600));
        reqRef.current = {
          id: reqIdRef.current++,
          stage: 0,
          invalid,
          throttled,
          cacheHit,
          target: Math.floor(Math.random() * 3),
          latency: 80 + Math.floor(Math.random() * 161),
        };
        statsRef.current.requests++;
        pushLog(`> GET /orders${stageRef.current === "dev" ? "/v1" : "/v2"} HTTP/2`, "aws");
      } else if (reqRef.current) {
        // ADVANCE — walk the request through the 5 pipeline stages
        const r = reqRef.current;
        r.stage += 1;
        let died = false;
        if (r.stage === 1) {
          pushLog("> api-key ✓", "aws");
        } else if (r.stage === 2) {
          pushLog("> lambda-authorizer ✓ policy ALLOW", "aws");
        } else if (r.stage === 3) {
          if (r.invalid) {
            pushLog("> schema INVALID ✗ 400 BAD_REQUEST", "danger");
            statsRef.current.err++;
            setFail400(true);
            setTimeout(() => setFail400(false), 900);
            died = true;
          } else {
            pushLog("> schema valid", "aws");
          }
        } else if (r.stage === 4) {
          if (r.throttled) {
            pushLog("> throttle breach ✗ 429 TOO_MANY_REQUESTS", "danger");
            statsRef.current.err++;
            setFail429(true);
            setTimeout(() => setFail429(false), 900);
            died = true;
          } else if (r.cacheHit) {
            pushLog("» cache HIT — backend bypassed", "mint");
            setCacheFlash(true);
            setTimeout(() => setCacheFlash(false), 900);
          } else {
            pushLog(`> integrated: ${TARGET_LOG[r.target]}`, "aws");
          }
        } else if (r.stage === 5) {
          // RESPONSE
          if (r.cacheHit) {
            statsRef.current.ok++;
            cacheHitsRef.current++;
            latRef.current.push(9);
            pushLog("< 200 OK CACHE HIT 9ms", "mint");
          } else {
            statsRef.current.ok++;
            latRef.current.push(r.latency);
            if (latRef.current.length > 60) latRef.current = latRef.current.slice(-60);
            pushLog(`< 200 OK ${r.latency}ms`, "mint");
            setBackendFlash(r.target);
            setTimeout(() => setBackendFlash(null), 800);
          }
          died = true;
        }
        if (died) {
          reqRef.current = null;
          setActiveStage(-1);
          setReqActive(false);
        } else {
          setActiveStage(r.stage);
        }
      }
      flush();
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [running, pushLog, flush]);

  useEffect(() => {
    const el = logBoxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  const reset = () => {
    setRunning(false);
    reqRef.current = null;
    tickRef.current = 0;
    logRef.current = [];
    statsRef.current = { requests: 0, ok: 0, err: 0 };
    latRef.current = [];
    cacheHitsRef.current = 0;
    burstRef.current = false;
    setLog([]);
    setRequests(0);
    setOk(0);
    setErr(0);
    setP50("—");
    setCacheHits(0);
    setActiveStage(-1);
    setReqActive(false);
    setBackendFlash(null);
    setFail400(false);
    setFail429(false);
    setCacheFlash(false);
    setBurst(false);
  };

  const runBurst = () => {
    if (burstRef.current) return;
    burstRef.current = true;
    setBurst(true);
    pushLog(
      `> BURST TEST · 12 req @ ~10 rps · throttle ${throttleRef.current ? "ON (10 rps)" : "OFF"}`,
      "magenta"
    );
    for (let i = 0; i < 12; i++) {
      setTimeout(() => {
        statsRef.current.requests++;
        if (throttleRef.current && i >= 10) {
          // requests beyond the 10 rps limit die at the throttling stage
          statsRef.current.err++;
          pushLog(`> burst req-${String(i + 1).padStart(2, "0")} ✗ 429 RATE EXCEEDED`, "danger");
          setFail429(true);
          setTimeout(() => setFail429(false), 700);
        } else {
          const lat = 80 + Math.floor(Math.random() * 121);
          statsRef.current.ok++;
          latRef.current.push(lat);
          pushLog(`> burst req-${String(i + 1).padStart(2, "0")} → 200 OK ${lat}ms`, "mint");
          setBackendFlash(0);
          setTimeout(() => setBackendFlash(null), 250);
        }
        flush();
      }, i * 100);
    }
    setTimeout(() => {
      burstRef.current = false;
      setBurst(false);
      flush();
    }, 1500);
    flush();
  };

  const switchStage = (s: "dev" | "prod") => {
    stageRef.current = s;
    setStage(s);
    pushLog(`> stage deploy → ${s.toUpperCase()} (${s === "dev" ? "/v1" : "/v2"})`, "magenta");
    flush();
  };

  const toggleThrottle = () => {
    const v = !throttleRef.current;
    throttleRef.current = v;
    setThrottleOn(v);
    pushLog(v ? "> throttling enabled — rate 10 rps / burst 5" : "> throttling disabled — unlimited", "magenta");
    flush();
  };

  const toggleCache = () => {
    const v = !cacheOnRef.current;
    cacheOnRef.current = v;
    setCacheOn(v);
    pushLog(v ? `> stage cache enabled — TTL ${ttlRef.current}s` : "> stage cache disabled", "magenta");
    flush();
  };

  const changeTtl = (v: number) => {
    ttlRef.current = v;
    setTtl(v);
  };

  const linkFlow = reqActive || burst;

  return (
    <div className="flex flex-col gap-4">
      {/* CONTROL DECK */}
      <GlassPanel
        title="GATE PROTOCOL // LIVE"
        subtitle={`REQUEST LIFECYCLE · execute-api.us-east-1 · ${stage.toUpperCase()} STAGE`}
        actions={
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? "GATEWAY ONLINE — REQUESTS FLOWING" : "SYSTEM IDLE — PRESS RUN"}
          />
        }
      >
        <div className="p-3 sm:p-4 flex flex-col gap-3">
          <FlowCanvas className="h-[440px] sm:h-[540px]" ariaLabel="API Gateway request lifecycle pipeline">
            {/* LINKS */}
            <FlowLink d="M13,50 C20,50 22,50 29,50" status={linkFlow ? "flowing" : "idle"} dotDuration={0.8} />
            <FlowLink
              d="M54,32 C63,32 66,16 75,16"
              status={backendFlash === 0 ? "success" : burst ? "flowing" : "idle"}
              dotDuration={1.1}
              dotDelay={0.2}
            />
            <FlowLink
              d="M54,50 C63,50 66,50 75,50"
              status={backendFlash === 1 ? "success" : "idle"}
              dotDuration={1.2}
              dotDelay={0.5}
            />
            <FlowLink
              d="M54,68 C63,68 66,84 75,84"
              status={backendFlash === 2 ? "success" : "idle"}
              dotDuration={1.3}
              dotDelay={0.8}
            />

            {/* CLIENT */}
            <FlowNode
              x={8}
              y={50}
              icon={<UserIcon className="w-3 h-3" />}
              label="CLIENT"
              sub="HTTPS/2"
              status={linkFlow ? "active" : "idle"}
              pulse={linkFlow}
              size="sm"
              delay={0.1}
            />

            {/* PIPELINE CORE */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ left: "41%", top: "50%", width: "158px" }}
            >
              <div className={`glass cyber-cut p-2 ${linkFlow ? "box-glow" : ""}`}>
                <div className="flex items-center gap-1.5 px-1 pb-1.5 border-b border-aws/15">
                  <APIGatewayIcon className="w-3.5 h-3.5 text-aws shrink-0" />
                  <div className="flex flex-col leading-none">
                    <span className="text-[8px] font-bold tracking-[0.14em] text-aws">API GATEWAY</span>
                    <span className="text-[6.5px] text-muted-foreground tracking-wider mt-0.5">
                      execute-api.us-east-1
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 pt-1.5">
                  {STAGES.map((s, i) => {
                    let state: "idle" | "active" | "done" | "fail" = "idle";
                    if (fail400 && i === 2) state = "fail";
                    else if (fail429 && i === 3) state = "fail";
                    else if (i === activeStage) state = "active";
                    else if (activeStage > i) state = "done";
                    const sub =
                      i === 3
                        ? throttleOn
                          ? "LIMIT 10 RPS"
                          : "NO LIMIT"
                        : i === 4
                          ? cacheOn
                            ? "CACHE ENABLED"
                            : "PASS-THROUGH"
                          : s.sub;
                    const cls =
                      state === "active"
                        ? "border-aws/80 bg-aws/10 text-aws box-glow"
                        : state === "done"
                          ? "border-mint/50 bg-mint/[0.06] text-mint"
                          : state === "fail"
                            ? "border-danger/80 bg-danger/15 text-danger shadow-[0_0_14px_rgba(255,51,85,0.4)]"
                            : "border-foreground/20 bg-white/[0.03] text-muted-foreground";
                    return (
                      <motion.div
                        key={s.name}
                        animate={{ scale: state === "active" ? 1.05 : 1, opacity: state === "idle" ? 0.65 : 1 }}
                        transition={{ duration: 0.2 }}
                        className={`flex items-center gap-1.5 border px-1.5 py-[3px] ${cls}`}
                      >
                        <span className="text-[6px] font-bold opacity-60">{String(i + 1).padStart(2, "0")}</span>
                        <span className="flex flex-col leading-none">
                          <span className="text-[6.5px] font-bold tracking-[0.12em] whitespace-nowrap">{s.name}</span>
                          <span className="text-[5.5px] tracking-wider opacity-80 whitespace-nowrap">{sub}</span>
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </motion.div>

            {/* BACKENDS */}
            <FlowNode
              x={84}
              y={16}
              icon={<LambdaIcon className="w-3 h-3" />}
              label="λ PROXY"
              sub={backendFlash === 0 ? "INVOKED" : "AWS_PROXY"}
              status={backendFlash === 0 ? "success" : "idle"}
              pulse={backendFlash === 0}
              size="sm"
              delay={0.4}
            />
            <FlowNode
              x={84}
              y={50}
              icon={<ServerIcon className="w-3 h-3" />}
              label="HTTP BACKEND"
              sub={backendFlash === 1 ? "200 OK" : "HTTP_PROXY"}
              status={backendFlash === 1 ? "success" : "idle"}
              pulse={backendFlash === 1}
              size="sm"
              delay={0.5}
            />
            <FlowNode
              x={84}
              y={84}
              icon={<S3Icon className="w-3 h-3" />}
              label="AWS SERVICE"
              sub="S3 GET"
              status={backendFlash === 2 ? "success" : "idle"}
              pulse={backendFlash === 2}
              size="sm"
              delay={0.6}
            />

            {/* LABELS */}
            <FlowLabel x={20} y={42} tone="aws">GET /orders</FlowLabel>
            <FlowLabel x={64} y={26} tone="default">AWS_PROXY</FlowLabel>
            <FlowLabel x={64} y={58} tone="default">HTTP_PROXY</FlowLabel>
            <FlowLabel x={64} y={74} tone="default">AWS SERVICE</FlowLabel>

            {/* TRANSIENT STATE LABELS */}
            <AnimatePresence>
              {fail429 && (
                <motion.div
                  key="rate"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute z-20"
                  style={{ left: "59%", top: "64%" }}
                >
                  <FlowLabel x={0} y={0} tone="danger">RATE EXCEEDED · 429</FlowLabel>
                </motion.div>
              )}
              {fail400 && (
                <motion.div
                  key="bad"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute z-20"
                  style={{ left: "59%", top: "52%" }}
                >
                  <FlowLabel x={0} y={0} tone="danger">400 BAD REQUEST</FlowLabel>
                </motion.div>
              )}
              {cacheFlash && (
                <motion.div
                  key="chit"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute z-20"
                  style={{ left: "59%", top: "74%" }}
                >
                  <FlowLabel x={0} y={0} tone="mint">CACHE HIT 9ms</FlowLabel>
                </motion.div>
              )}
            </AnimatePresence>
          </FlowCanvas>

          {/* STATS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatChip label="REQUESTS" value={String(requests)} tone="aws" />
            <StatChip label="2XX" value={String(ok)} tone="mint" />
            <StatChip label="4XX / 429" value={String(err)} tone="magenta" />
            <StatChip label="P50 LATENCY" value={p50} tone="aws" />
          </div>

          {/* STAGE + TOGGLES */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <div className="flex items-center gap-1">
              <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground mr-1">
                STAGE
              </span>
              {(["dev", "prod"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => switchStage(s)}
                  aria-label={`Switch to ${s} stage`}
                  className={`${BTN} ${stage === s ? "border-aws/70 text-aws box-glow" : "border-foreground/25 text-muted-foreground"}`}
                >
                  {s.toUpperCase()} {s === "dev" ? "/v1" : "/v2"}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={toggleThrottle}
              aria-label="Toggle throttle limit"
              className={`${BTN} ${throttleOn ? "border-neon/60 text-neon" : "border-foreground/25 text-muted-foreground"}`}
            >
              <Gauge className="w-3 h-3" />
              THROTTLE {throttleOn ? "10 RPS" : "OFF"}
            </button>
            <button
              type="button"
              onClick={toggleCache}
              aria-label="Toggle stage caching"
              className={`${BTN} ${cacheOn ? "border-mint/60 text-mint" : "border-foreground/25 text-muted-foreground"}`}
            >
              <Database className="w-3 h-3" />
              CACHING {cacheOn ? "ON" : "OFF"}
            </button>
            <div className="flex items-center gap-2 px-2 py-1 border border-foreground/25 bg-black/50 backdrop-blur-md cyber-cut-sm">
              <Timer className="w-3 h-3 text-muted-foreground" />
              <input
                type="range"
                min={60}
                max={3600}
                step={60}
                value={ttl}
                onChange={(e) => changeTtl(Number(e.target.value))}
                aria-label="Cache TTL seconds"
                className="w-20 h-1 cursor-pointer"
                style={{ accentColor: "#ff9900" }}
              />
              <span className="text-[8px] font-bold text-aws tracking-wider">TTL {ttl}s</span>
            </div>
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.94 }}
              onClick={runBurst}
              aria-label="Fire burst test of 12 rapid requests"
              className={`${BTN} border-danger/60 text-danger hover:bg-danger/10`}
            >
              <Zap className="w-3 h-3" />
              BURST TEST ×12
            </motion.button>
          </div>

          {/* CACHE PROFILE LINE */}
          <p className="text-[8px] uppercase tracking-[0.18em] text-muted-foreground/80 font-bold">
            CACHE PROFILE{" "}
            <span className="text-aws">
              {stage.toUpperCase()} {stage === "dev" ? "0.3x" : "0.4x"}
            </span>{" "}
            · TTL {ttl}s · HITS <span className="text-mint">{cacheHits}</span> ·{" "}
            {cacheOn ? "STAGE CACHE ARMED" : "STAGE CACHE OFF"}
          </p>

          {/* REQUEST INSPECTOR */}
          <div className="glass-inset p-2">
            <div className="flex items-center justify-between px-1 pb-1.5">
              <span className="text-[8px] font-bold uppercase tracking-[0.22em] text-aws">
                {"// REQUEST INSPECTOR"}
              </span>
              <span className="text-[7px] uppercase tracking-wider text-muted-foreground">
                {stage.toUpperCase()} · {stage === "dev" ? "/v1" : "/v2"}
              </span>
            </div>
            <div ref={logBoxRef} className="max-h-32 overflow-y-auto cyber-scroll px-1 flex flex-col gap-0.5">
              <AnimatePresence initial={false}>
                {log.map((l) => (
                  <motion.p
                    key={l.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.18 }}
                    className={`text-[8.5px] leading-snug tracking-wider font-bold whitespace-pre-wrap ${LOG_TONE_CLS[l.tone]}`}
                  >
                    {l.text}
                  </motion.p>
                ))}
              </AnimatePresence>
              {log.length === 0 && (
                <p className="text-[8px] uppercase tracking-wider text-muted-foreground/60 py-2">
                  AWAITING REQUESTS — PRESS RUN OR FIRE A BURST TEST
                </p>
              )}
            </div>
          </div>
        </div>
      </GlassPanel>

      {/* KNOWLEDGE */}
      <div className="grid md:grid-cols-3 gap-3">
        <Callout type="exam" title="REST vs HTTP vs WebSocket API">
          REST API: full feature set (API keys, usage plans, request validation, mapping templates,
          caching, WAF) at higher cost. HTTP API: up to ~70% cheaper and lower latency, with JWT/OAuth2/IAM
          auth — but no usage plans, API keys, mapping templates or caching. WebSocket API: stateful
          bidirectional connections for chat and streaming, billed per message.
        </Callout>
        <Callout type="tip" title="Usage plans + API keys = per-client throttling">
          Attach API keys to usage plans to give each client its own rate and burst limits plus a monthly
          quota. Build tiers — free, starter, enterprise — each with its own throttle envelope. When a
          client breaches its plan, API Gateway answers 429 with <span className="text-mint">RateLimit</span>{" "}
          headers, exactly like the burst test above.
        </Callout>
        <Callout type="info" title="Mapping templates transform payloads (REST only)">
          VTL mapping templates reshape requests and responses between client and integration: rename
          fields, drop headers, convert XML to JSON, or bridge non-JSON services like DynamoDB and Kinesis
          — no Lambda transform required. HTTP APIs skip this feature entirely in exchange for speed.
        </Callout>
      </div>
    </div>
  );
}
