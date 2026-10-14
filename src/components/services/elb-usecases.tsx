"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Globe, HeartPulse, Image as ImageIcon, Rocket, Skull, Terminal, Undo2 } from "lucide-react";
import { FlowCanvas, FlowLabel, FlowLink, FlowNode } from "@/components/shared/flow";
import { SimControls } from "@/components/shared/sim-controls";
import {
  StepBadge,
  UCButton,
  UCStat,
  UseCaseNote,
  UseCaseShell,
  VerdictFlash,
  useScenarioRunner,
  useTicker,
} from "@/components/shared/use-case";
import { EC2Icon, ELBIcon, UserIcon } from "@/components/aws-icons";

/* ================================================================== */
/* SHARED TYPES                                                        */
/* ================================================================== */

export type ElbUseCaseId = "PATH_ROUTING" | "HEALTH_FAILOVER" | "BLUE_GREEN";

interface ElbUseCasesProps {
  id: ElbUseCaseId;
  immersiveActive?: boolean;
  immersiveToggle?: () => void;
}

interface LogLine {
  id: number;
  text: string;
  tone?: string;
}

type FlashTone = "ok" | "deny" | "aws";

function useFlash() {
  const [flash, setFlash] = useState<{ text: string; tone: FlashTone } | null>(null);
  const flashT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fire = (text: string, tone: FlashTone) => {
    setFlash({ text, tone });
    if (flashT.current) clearTimeout(flashT.current);
    flashT.current = setTimeout(() => setFlash(null), 1500);
  };
  useEffect(
    () => () => {
      if (flashT.current) clearTimeout(flashT.current);
    },
    []
  );
  return { flash, fire };
}

/* ================================================================== */
/* TAB 02 — PATH-BASED ROUTING: ONE ALB, THREE TARGET GROUPS           */
/* ================================================================== */

type SendKind = "api" | "img" | "web";

const ROUTE_RULES: { prio: number; pattern: string; kind: SendKind; tg: string; logTone: string }[] = [
  { prio: 1, pattern: "/img/*", kind: "img", tg: "tg-static", logTone: "magenta" },
  { prio: 2, pattern: "/api/*", kind: "api", tg: "tg-api", logTone: "aws" },
  { prio: 3, pattern: "DEFAULT", kind: "web", tg: "tg-web", logTone: "mint" },
];

const TG_POS: Record<SendKind, { x: number; y: number }> = {
  api: { x: 80, y: 18 },
  img: { x: 80, y: 50 },
  web: { x: 80, y: 82 },
};

const TG_LINK: Record<SendKind, string> = {
  api: "M50,46 C59,36 65,27 72,21",
  img: "M50,50 C58,50 64,50 71,50",
  web: "M50,54 C59,64 65,73 72,79",
};

const TG_ICON: Record<SendKind, React.ReactNode> = {
  api: <Terminal className="w-3 h-3" />,
  img: <ImageIcon className="w-3 h-3" />,
  web: <Globe className="w-3 h-3" />,
};

function ListenerRulesCard({ active }: { active: SendKind | null }) {
  return (
    <div className="glass-inset cyber-cut-sm p-2 w-[46%] min-w-[190px]">
      <p className="text-[6.5px] font-extrabold uppercase tracking-[0.2em] text-aws pb-1 border-b border-aws/15">
        LISTENER :443 — RULES (PRIORITY ORDER)
      </p>
      <div className="flex flex-col gap-1 pt-1.5">
        {ROUTE_RULES.map((r) => {
          const on = active === r.kind;
          return (
            <div
              key={r.pattern}
              className={`flex items-center gap-1.5 border px-1.5 py-1 text-[6.5px] font-bold tracking-wider uppercase ${
                on
                  ? r.kind === "img"
                    ? "border-magenta/70 text-magenta box-glow"
                    : r.kind === "api"
                      ? "border-aws/70 text-aws box-glow"
                      : "border-mint/70 text-mint box-glow"
                  : "border-foreground/15 text-muted-foreground"
              }`}
            >
              <span className="tabular-nums opacity-70">#{r.prio}</span>
              <span className="border border-current px-1">{r.pattern}</span>
              <span className="opacity-60">→</span>
              <span className="truncate">{r.tg}</span>
              {on && <span className="ml-auto animate-pulse">MATCH</span>}
            </div>
          );
        })}
      </div>
      <p className="text-[6px] text-muted-foreground tracking-wider pt-1.5 uppercase">FIRST MATCH WINS — DEFAULT CATCHES THE REST</p>
    </div>
  );
}

function PathRoutingUseCase({ immersiveActive, immersiveToggle }: ElbUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [counts, setCounts] = useState({ api: 0, img: 0, web: 0 });
  const [total, setTotal] = useState(0);
  const [packet, setPacket] = useState<{ id: number; kind: SendKind } | null>(null);
  const [activeTg, setActiveTg] = useState<SendKind | null>(null);
  const [ruleChip, setRuleChip] = useState<{ id: number; text: string } | null>(null);
  const [lines, setLines] = useState<LogLine[]>([]);

  const countsRef = useRef({ api: 0, img: 0, web: 0 });
  const totalRef = useRef(0);
  const packetIdRef = useRef(1);
  const logId = useRef(1);
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

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: logId.current++, text, tone }]);

  const send = (kind: SendKind) => {
    const rule = ROUTE_RULES.find((r) => r.kind === kind) ?? ROUTE_RULES[2];
    const id = packetIdRef.current++;
    const next = { ...countsRef.current, [kind]: countsRef.current[kind] + 1 };
    countsRef.current = next;
    totalRef.current += 1;
    setCounts(next);
    setTotal(totalRef.current);
    setPacket({ id, kind });
    setActiveTg(kind);
    setRuleChip({ id, text: rule.pattern });
    const ms = 12 + Math.floor(Math.random() * 40);
    push(
      `RULE #${rule.prio} PRIORITY: path-pattern ${rule.pattern} → ${rule.tg} — 200 OK (${ms}ms)`,
      rule.logTone
    );
    later(() => {
      setPacket((p) => (p && p.id === id ? null : p));
      setRuleChip((c) => (c && c.id === id ? null : c));
    }, 950);
    later(() => setActiveTg((cur) => (cur === kind ? null : cur)), 1150);
  };

  /* background traffic while running — random paths hitting all three rules */
  useTicker(running, () => {
    const kinds: SendKind[] = ["api", "api", "web", "web", "img"];
    send(kinds[Math.floor(Math.random() * kinds.length)]);
  }, 1500);

  const reset = () => {
    setRunning(false);
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
    countsRef.current = { api: 0, img: 0, web: 0 };
    totalRef.current = 0;
    setCounts({ api: 0, img: 0, web: 0 });
    setTotal(0);
    setPacket(null);
    setActiveTg(null);
    setRuleChip(null);
    setLines([]);
  };

  const lastRule = lines.length > 0 ? lines[lines.length - 1].text.split(" — ")[0].replace("RULE ", "#").replace(" PRIORITY", "") : "—";

  return (
    <UseCaseShell
      title="USE CASE // PATH-BASED ROUTING — ONE ALB, MICROSERVICES BEHIND IT"
      subtitle="/api/* → TG-API · /img/* → TG-STATIC · DEFAULT → TG-WEB — LISTENER RULES IN PRIORITY ORDER"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="TOTAL REQUESTS" value={total} />
          <UCStat label="→ TG-API" value={counts.api} tone="aws" />
          <UCStat label="→ TG-STATIC" value={counts.img} tone="magenta" />
          <UCStat label="→ TG-WEB" value={counts.web} tone="mint" />
          <UCStat label="LAST MATCH" value={lastRule} tone="neutral" />
          <UCStat label="TARGET GROUPS" value="3 / 3" tone="neutral" />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? "LIVE TRAFFIC — RULES EVALUATED PER REQUEST" : "IDLE — PRESS RUN OR FIRE REQUESTS BY HAND"}
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">SEND A REQUEST</p>
          <div className="flex flex-wrap gap-2">
            <UCButton onClick={() => send("api")} ariaLabel="Send a request to /api/orders">
              <Terminal className="w-3 h-3" /> SEND /API/ORDERS
            </UCButton>
            <UCButton onClick={() => send("img")} tone="magenta" ariaLabel="Send a request to /img/logo.png">
              <ImageIcon className="w-3 h-3" /> SEND /IMG/LOGO.PNG
            </UCButton>
            <UCButton onClick={() => send("web")} tone="mint" ariaLabel="Send a request to the default route">
              <Globe className="w-3 h-3" /> SEND /
            </UCButton>
          </div>
          <p className="text-[7px] tracking-[0.15em] text-muted-foreground uppercase">
            each target group can scale, deploy and fail independently — one DNS name, many services
          </p>
        </>
      }
      logLines={lines}
      logTitle="LISTENER RULE LOG // LIVE"
      logEmpty="PRESS RUN — OR SEND A REQUEST AND WATCH IT MATCH A RULE"
    >
      <FlowCanvas ariaLabel="ALB path-based routing diagram" className="h-full">
        {/* client → ALB */}
        <FlowLink d="M16,50 L34,50" status={running ? "flowing" : "idle"} dotDuration={1.1} />
        {/* ALB → target groups */}
        {(Object.keys(TG_POS) as SendKind[]).map((k) => (
          <FlowLink
            key={k}
            d={TG_LINK[k]}
            status={activeTg === k ? "flowing" : "idle"}
            dot={activeTg === k}
            dotDuration={1}
          />
        ))}

        <FlowNode x={9} y={50} size="sm" delay={0.1} icon={<UserIcon className="w-3 h-3" />} label="CLIENT" sub="HTTPS" status={running ? "active" : "idle"} pulse={running} />
        <FlowNode x={42} y={50} size="md" delay={0.2} icon={<ELBIcon className="w-4 h-4" />} label="ALB" sub="app-nexus-7f · L7" status={running ? "active" : "idle"} pulse={running} />

        {(Object.keys(TG_POS) as SendKind[]).map((k, i) => (
          <FlowNode
            key={k}
            x={TG_POS[k].x}
            y={TG_POS[k].y}
            size="sm"
            delay={0.35 + i * 0.08}
            icon={TG_ICON[k]}
            label={ROUTE_RULES.find((r) => r.kind === k)?.tg.toUpperCase() ?? k}
            sub={`${counts[k]} REQ`}
            status={activeTg === k ? "active" : "idle"}
            pulse={activeTg === k}
          />
        ))}

        <FlowLabel x={42} y={38} tone="aws">EVALUATES RULES TOP-DOWN · FIRST MATCH WINS</FlowLabel>
        <FlowLabel x={22} y={88} tone="default">PATH-BASED · HOST-BASED · HEADER-BASED</FlowLabel>

        {/* listener rules card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="absolute z-10" style={{ left: "4%", top: "14%" }}>
          <ListenerRulesCard active={activeTg} />
        </motion.div>

        {/* rule chip above ALB */}
        <AnimatePresence>
          {ruleChip && (
            <motion.span
              key={ruleChip.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute z-20 -translate-x-1/2 whitespace-nowrap border border-magenta/50 bg-black/80 px-1 py-0.5 text-[6.5px] font-bold tracking-wider text-magenta"
              style={{ left: "42%", top: "38%" }}
            >
              {ruleChip.text}
            </motion.span>
          )}
        </AnimatePresence>

        {/* animated packet CLIENT → ALB → TG */}
        <AnimatePresence>
          {packet && (
            <motion.span
              key={packet.id}
              className="absolute z-20 h-1.5 w-1.5 bg-aws shadow-[0_0_8px_rgba(255,153,0,0.9)]"
              initial={{ left: "9%", top: "50%" }}
              animate={{ left: ["9%", "42%", `${TG_POS[packet.kind].x}%`], top: ["50%", "50%", `${TG_POS[packet.kind].y}%`] }}
              transition={{ duration: 0.9, ease: "easeInOut" }}
            />
          )}
        </AnimatePresence>
      </FlowCanvas>

      <UseCaseNote>
        one ALB fronts every microservice: /api/* scales its own TG, images go to a static pool, everything else falls to
        the default rule — ship services without touching DNS
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* TAB 03 — HEALTH CHECKS + FAILOVER: KILL → DRAIN → REDISTRIBUTE      */
/* ================================================================== */

type HfState = "healthy" | "failing" | "deregistering" | "down" | "healing";

interface HfTarget {
  id: string;
  state: HfState;
  misses: number;
  okChecks: number;
  drained: number;
  reqs: number;
}

const HF_POS = [
  { x: 76, y: 20 },
  { x: 76, y: 50 },
  { x: 76, y: 80 },
];

const freshHfTargets = (): HfTarget[] => [
  { id: "tg-web-01", state: "healthy", misses: 0, okChecks: 0, drained: 0, reqs: 0 },
  { id: "tg-web-02", state: "healthy", misses: 0, okChecks: 0, drained: 0, reqs: 0 },
  { id: "tg-web-03", state: "healthy", misses: 0, okChecks: 0, drained: 0, reqs: 0 },
];

const HF_STATE_CLS: Record<HfState, { box: string; text: string; label: string; dot: string }> = {
  healthy: { box: "border-mint/50 bg-mint/[0.06]", text: "text-mint", label: "HEALTHY", dot: "bg-mint" },
  failing: { box: "border-danger/60 bg-danger/10", text: "text-danger", label: "CHECKS FAILING", dot: "bg-danger" },
  deregistering: { box: "border-danger/60 bg-danger/10", text: "text-danger", label: "DEREGISTERING", dot: "bg-danger" },
  down: { box: "border-danger/40 bg-danger/[0.06]", text: "text-danger", label: "DEREGISTERED", dot: "bg-danger/50" },
  healing: { box: "border-neon/60 bg-neon/10", text: "text-neon", label: "CHECKS PASSING", dot: "bg-neon" },
};

function HfTargetChip({ t, pos }: { t: HfTarget; pos: { x: number; y: number } }) {
  const cls = HF_STATE_CLS[t.state];
  return (
    <motion.div
      layout
      animate={{ opacity: t.state === "down" ? 0.55 : 1 }}
      transition={{ duration: 0.4 }}
      className={`flex flex-col gap-1 px-2 py-1.5 border ${cls.box} -translate-x-1/2 -translate-y-1/2 absolute`}
      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
    >
      <div className={`flex items-center gap-1.5 text-[8px] font-bold tracking-wider uppercase whitespace-nowrap ${cls.text}`}>
        <EC2Icon className="w-3 h-3 shrink-0" />
        {t.id}
        <span className={`w-1.5 h-1.5 shrink-0 ${cls.dot} ${t.state !== "healthy" && t.state !== "down" ? "ping-ring" : ""}`} />
      </div>
      <span className={`text-[6.5px] font-extrabold tracking-[0.15em] uppercase ${cls.text}`}>
        {cls.label} · {t.reqs} REQ
        {t.state === "deregistering" ? ` · DRAIN ${t.drained}/24` : ""}
      </span>
    </motion.div>
  );
}

function HealthFailoverUseCase({ immersiveActive, immersiveToggle }: ElbUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [targets, setTargets] = useState<HfTarget[]>(freshHfTargets);
  const [total, setTotal] = useState(0);
  const [failedChecks, setFailedChecks] = useState(0);
  const [recoveries, setRecoveries] = useState(0);
  const [lines, setLines] = useState<LogLine[]>([]);
  const { flash, fire } = useFlash();

  const targetsRef = useRef<HfTarget[]>(freshHfTargets());
  const totalRef = useRef(0);
  const failedRef = useRef(0);
  const recoveredRef = useRef(0);
  const logId = useRef(1);

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: logId.current++, text, tone }]);

  const sync = (list: HfTarget[]) => {
    targetsRef.current = list;
    setTargets([...list]);
  };

  /* per-target health machine — fires from the interval callback */
  const machineActive = targets.some((t) => t.state === "failing" || t.state === "deregistering" || t.state === "healing");
  useTicker(machineActive, () => {
    const list = targetsRef.current;
    let changed = false;
    list.forEach((t) => {
      if (t.state === "failing") {
        t.misses += 1;
        failedRef.current += 1;
        setFailedChecks(failedRef.current);
        changed = true;
        if (t.misses < 3) {
          push(`health check FAILED ${t.id} (${t.misses}/3) — request timeout after 5s`, "danger");
        } else {
          t.state = "deregistering";
          t.drained = 0;
          push(`3/3 CHECKS FAILED — ${t.id} DEREGISTERING — connection draining started`, "neon");
        }
      } else if (t.state === "deregistering") {
        t.drained = Math.min(24, t.drained + 6);
        changed = true;
        if (t.drained % 12 === 0) {
          push(`draining ${t.id} — in-flight connections ${t.drained}/24`, "dim");
        }
        if (t.drained >= 24) {
          t.state = "down";
          push(`${t.id} fully drained — DEREGISTERED — traffic on the survivors`, "magenta");
          fire("TARGET REMOVED", "deny");
        }
      } else if (t.state === "healing") {
        t.okChecks += 1;
        changed = true;
        if (t.okChecks < 2) {
          push(`health check 200 OK ${t.id} (${t.okChecks}/2) — target recovering`, "neon");
        } else {
          t.state = "healthy";
          t.misses = 0;
          t.okChecks = 0;
          t.drained = 0;
          recoveredRef.current += 1;
          setRecoveries(recoveredRef.current);
          push(`${t.id} RE-REGISTERED — back in rotation`, "mint");
          fire("BACK IN ROTATION", "ok");
        }
      }
    });
    if (changed) sync(list);
  }, 850);

  /* live traffic — only healthy targets receive requests (redistribution is automatic) */
  useTicker(running, () => {
    const list = targetsRef.current;
    const healthy = list.filter((t) => t.state === "healthy");
    if (healthy.length === 0) {
      totalRef.current += 1;
      setTotal(totalRef.current);
      push(`503 SERVICE UNAVAILABLE — 0/3 healthy — ALB has nowhere to send`, "danger");
      return;
    }
    const pick = healthy[Math.floor(Math.random() * healthy.length)];
    pick.reqs += 1;
    totalRef.current += 1;
    setTotal(totalRef.current);
    sync(list);
  }, 1000);

  const killTarget = () => {
    const list = targetsRef.current;
    const healthy = list.filter((t) => t.state === "healthy");
    if (healthy.length === 0) {
      push("KILL ignored — no healthy target left to kill", "dim");
      return;
    }
    const victim = healthy[Math.floor(Math.random() * healthy.length)];
    victim.state = "failing";
    victim.misses = 0;
    sync(list);
    push(`CHAOS — ${victim.id} process killed (simulated OOM) — health checks will fail`, "danger");
    fire("TARGET KILLED", "deny");
  };

  const healTarget = () => {
    const list = targetsRef.current;
    const sick = list.find((t) => t.state === "down" || t.state === "deregistering" || t.state === "failing");
    if (!sick) {
      push("HEAL ignored — every target is already healthy", "dim");
      return;
    }
    sick.state = "healing";
    sick.okChecks = 0;
    sync(list);
    push(`HEAL — restarting process on ${sick.id} — health checks re-armed`, "aws");
  };

  const reset = () => {
    setRunning(false);
    targetsRef.current = freshHfTargets();
    totalRef.current = 0;
    failedRef.current = 0;
    recoveredRef.current = 0;
    setTargets(freshHfTargets());
    setTotal(0);
    setFailedChecks(0);
    setRecoveries(0);
    setLines([]);
  };

  const healthyCount = targets.filter((t) => t.state === "healthy").length;
  const drainingConns = targets.filter((t) => t.state === "deregistering").reduce((n, t) => n + (24 - t.drained), 0);
  const deregistered = targets.filter((t) => t.state === "down").length;

  const linkStatus = (t: HfTarget): "idle" | "flowing" | "success" | "error" => {
    if (t.state === "failing" || t.state === "deregistering") return "error";
    if (t.state === "healing") return "success";
    if (t.state === "down") return "idle";
    return running ? "flowing" : "idle";
  };

  return (
    <UseCaseShell
      title="USE CASE // HEALTH CHECKS + FAILOVER — ZERO DROPPED REQUESTS"
      subtitle="3 FAILED CHECKS → DEREGISTER → CONNECTION DRAIN → TRAFFIC REDISTRIBUTES"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="HEALTHY" value={`${healthyCount}/3`} tone={healthyCount === 3 ? "mint" : "danger"} />
          <UCStat label="FAILED CHECKS" value={failedChecks} tone={failedChecks > 0 ? "danger" : "neutral"} />
          <UCStat label="DRAINING CONNS" value={drainingConns} tone={drainingConns > 0 ? "neon" : "neutral"} />
          <UCStat label="DEREGISTERED" value={deregistered} tone={deregistered > 0 ? "magenta" : "neutral"} />
          <UCStat label="REQUESTS SERVED" value={total} tone="aws" />
          <UCStat label="RECOVERIES" value={recoveries} tone="mint" />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? "LIVE TRAFFIC — ONLY HEALTHY TARGETS RECEIVE REQUESTS" : "IDLE — PRESS RUN, THEN KILL A TARGET"}
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">CHAOS + RECOVERY</p>
          <div className="flex flex-wrap gap-2">
            <UCButton onClick={killTarget} tone="danger" ariaLabel="Kill a random healthy target to trigger health-check failover">
              <Skull className="w-3 h-3" /> KILL TARGET
            </UCButton>
            <UCButton onClick={healTarget} tone="mint" ariaLabel="Heal a deregistered target and re-register it">
              <HeartPulse className="w-3 h-3" /> HEAL
            </UCButton>
          </div>
          <p className="text-[7px] tracking-[0.15em] text-muted-foreground uppercase">
            health check: GET /health every 10s — 3 strikes = unhealthy · deregistration delay drains in-flight work
          </p>
        </>
      }
      logLines={lines}
      logTitle="HEALTH + DRAIN LOG // LIVE"
      logEmpty="PRESS RUN — OR KILL A TARGET AND WATCH THE ALB DRAIN IT GRACEFULLY"
    >
      <FlowCanvas ariaLabel="ALB health check failover diagram" className="h-full">
        {/* ALB → target links */}
        {targets.map((t, i) => (
          <FlowLink
            key={t.id}
            d={
              i === 0
                ? "M21,36 C34,30 50,25 68,21"
                : i === 1
                  ? "M21,44 C34,44 50,47 68,50"
                  : "M21,48 C34,58 50,72 68,79"
            }
            status={linkStatus(t)}
            dot={t.state === "healthy" && running}
            dotDuration={1.4}
            dotDelay={0.15 * i}
            dashed={t.state !== "healthy"}
          />
        ))}
        {/* health-check probe links */}
        {targets.map((t, i) => (
          <FlowLink
            key={`probe-${t.id}`}
            d={i === 0 ? "M49,84 C58,72 64,48 69,25" : i === 1 ? "M52,84 C58,74 63,64 69,54" : "M52,86 C58,87 62,85 68,82"}
            status={t.state === "failing" ? "error" : t.state === "healing" ? "success" : "idle"}
            dot={false}
            dashed
            strokeWidth={0.8}
          />
        ))}

        <FlowNode x={14} y={40} size="sm" delay={0.1} icon={<ELBIcon className="w-3 h-3" />} label="ALB" sub="app-nexus-7f" status={running ? "active" : "idle"} pulse={running} />
        <FlowNode x={46} y={88} size="xs" delay={0.2} icon={<HeartPulse className="w-3 h-3" />} label="HEALTH CHECKER" sub="GET /health · 10s" status={machineActive ? "warn" : "idle"} pulse={machineActive} />

        {targets.map((t, i) => (
          <HfTargetChip key={t.id} t={t} pos={HF_POS[i]} />
        ))}

        <FlowLabel x={14} y={28} tone="aws">CROSS-ZONE · ROUND ROBIN</FlowLabel>
        <FlowLabel x={50} y={8} tone="danger">3 STRIKES → DRAIN (IN-FLIGHT FINISHES) → REDISTRIBUTE</FlowLabel>
        <FlowLabel x={76} y={92} tone={healthyCount === 3 ? "mint" : "danger"}>
          {healthyCount === 3 ? "ALL TARGETS HEALTHY" : `${healthyCount}/3 HEALTHY — FAILING OVER`}
        </FlowLabel>

        <VerdictFlash show={flash !== null} text={flash?.text ?? ""} tone={flash?.tone ?? "aws"} />
      </FlowCanvas>

      <UseCaseNote>
        users never see the failure: the ALB stops routing new work after 3 missed checks, drains in-flight connections,
        and survivors absorb the load — heal and it slides back into rotation
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* TAB 04 — BLUE-GREEN DEPLOYMENT VIA WEIGHTED TARGET GROUPS           */
/* ================================================================== */

type BgPhase = "BLUE" | "WARMING" | "READY" | "PROMOTING" | "GREEN" | "ROLLING";

interface BgPacket {
  id: number;
  lane: "blue" | "green";
}

const BG_LANE_META = {
  blue: { name: "BLUE · v1.4", tone: "aws", tg: "TG-BLUE" },
  green: { name: "GREEN · v1.5", tone: "mint", tg: "TG-GREEN" },
} as const;

function BgLaneCard({
  lane,
  weight,
  reqs,
  phase,
}: {
  lane: "blue" | "green";
  weight: number;
  reqs: number;
  phase: BgPhase;
}) {
  const meta = BG_LANE_META[lane];
  const isBlue = lane === "blue";
  const status =
    phase === "WARMING" && !isBlue
      ? { text: "WARMING UP", cls: "text-neon" }
      : phase === "READY" && !isBlue
        ? { text: "READY · 0% TRAFFIC", cls: "text-mint" }
        : weight > 0
          ? { text: "SERVING", cls: isBlue ? "text-aws" : "text-mint" }
          : { text: isBlue && phase === "GREEN" ? "STANDBY (INSTANT ROLLBACK)" : "IDLE", cls: "text-muted-foreground" };
  return (
    <div className={`relative border bg-black/40 p-2.5 flex flex-col gap-1.5 ${weight > 0 ? (isBlue ? "border-aws/50 box-glow" : "border-mint/50 box-glow") : "border-foreground/15"}`}>
      <div className="flex items-center justify-between gap-1">
        <span className={`flex items-center gap-1.5 text-[8px] font-extrabold tracking-[0.15em] ${isBlue ? "text-aws" : "text-mint"}`}>
          <EC2Icon className="w-3.5 h-3.5 shrink-0" />
          {meta.name}
        </span>
        <span className={`text-[6.5px] font-extrabold tracking-[0.15em] ${status.cls}`}>{status.text}</span>
      </div>
      <div className="flex items-end gap-2">
        <motion.span key={weight} initial={{ scale: 1.2 }} animate={{ scale: 1 }} className={`text-2xl leading-none font-extrabold tabular-nums ${isBlue ? "text-aws" : "text-mint"}`}>
          {weight}
          <span className="text-[10px]">%</span>
        </motion.span>
        <span className="text-[6.5px] tracking-[0.18em] text-muted-foreground uppercase pb-0.5">TRAFFIC WEIGHT · {meta.tg}</span>
        <span className="ml-auto text-[8px] font-bold tabular-nums text-muted-foreground pb-0.5">{reqs} REQ</span>
      </div>
      <div className="h-1.5 border border-foreground/15 bg-black/60 overflow-hidden">
        <motion.div className={`h-full ${isBlue ? "bg-aws" : "bg-mint"}`} animate={{ width: `${weight}%` }} transition={{ duration: 0.6 }} />
      </div>
      {phase === "WARMING" && !isBlue && (
        <p className="text-[6.5px] tracking-[0.15em] text-neon uppercase animate-pulse">health checks running — not taking traffic yet</p>
      )}
    </div>
  );
}

function BlueGreenUseCase({ immersiveActive, immersiveToggle }: ElbUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<BgPhase>("BLUE");
  const [weights, setWeights] = useState({ blue: 100, green: 0 });
  const [rollovers, setRollovers] = useState(0);
  const [reqs, setReqs] = useState({ blue: 0, green: 0 });
  const [total, setTotal] = useState(0);
  const [packet, setPacket] = useState<BgPacket | null>(null);
  const [lines, setLines] = useState<LogLine[]>([]);
  const { flash, fire } = useFlash();

  const weightsRef = useRef({ blue: 100, green: 0 });
  const reqsRef = useRef({ blue: 0, green: 0 });
  const totalRef = useRef(0);
  const rollRef = useRef(0);
  const packetIdRef = useRef(1);
  const logId = useRef(1);
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

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: logId.current++, text, tone }]);

  const setW = (blue: number, green: number) => {
    weightsRef.current = { blue, green };
    setWeights({ blue, green });
  };

  /* DEPLOY GREEN — v1.5 warms up behind 0% traffic */
  const { step: warmStep, reset: resetWarm } = useScenarioRunner(3, phase === "WARMING", 1000, (s) => {
    if (s === 0) {
      push("GREEN fleet provisioning — 3 × v1.5 behind TG-GREEN (zero traffic)", "neon");
    } else if (s === 1) {
      push("warm-up — DB pools primed · cache preloaded · migrations verified", "dim");
    } else {
      push("health checks 3/3 PASSED — v1.5 READY at 0% traffic", "mint");
      setPhase("READY");
    }
  });

  /* PROMOTE — weights animate 100/0 → 50/50 → 0/100 */
  const { step: promoteStep, reset: resetPromote } = useScenarioRunner(3, phase === "PROMOTING", 1400, (s) => {
    if (s === 0) {
      setW(50, 50);
      push("CANARY — weights 50/50 — monitoring error rate + p99 on v1.5", "aws");
    } else if (s === 1) {
      setW(0, 100);
      push("GREEN 100% — v1.5 serving all traffic — blue on hot standby", "neon");
    } else {
      rollRef.current += 1;
      setRollovers(rollRef.current);
      setPhase("GREEN");
      push("PROMOTION COMPLETE — v1.5 ACTIVE (blue kept warm for instant rollback)", "mint");
      fire("PROMOTED v1.5", "ok");
    }
  });

  /* ROLLBACK — weights animate back to blue */
  const { step: rollbackStep, reset: resetRollback } = useScenarioRunner(2, phase === "ROLLING", 1200, (s) => {
    if (s === 0) {
      setW(50, 50);
      push("ROLLBACK — shifting traffic back to blue v1.4", "danger");
    } else {
      setW(100, 0);
      setPhase("READY");
      push("v1.4 RESTORED — 100% blue (green stays warm at 0%) — incident over", "aws");
      fire("ROLLED BACK", "aws");
    }
  });

  /* live traffic — split by weight */
  useTicker(running, () => {
    const w = weightsRef.current;
    const toGreen = w.green > 0 && (w.blue === 0 || Math.random() * 100 < w.green);
    const lane: "blue" | "green" = toGreen ? "green" : "blue";
    reqsRef.current = { ...reqsRef.current, [lane]: reqsRef.current[lane] + 1 };
    totalRef.current += 1;
    setReqs(reqsRef.current);
    setTotal(totalRef.current);
    const id = packetIdRef.current++;
    setPacket({ id, lane });
    later(() => setPacket((p) => (p && p.id === id ? null : p)), 850);
  }, 800);

  const reset = () => {
    setRunning(false);
    resetWarm();
    resetPromote();
    resetRollback();
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
    weightsRef.current = { blue: 100, green: 0 };
    reqsRef.current = { blue: 0, green: 0 };
    totalRef.current = 0;
    rollRef.current = 0;
    setPhase("BLUE");
    setWeights({ blue: 100, green: 0 });
    setRollovers(0);
    setReqs({ blue: 0, green: 0 });
    setTotal(0);
    setPacket(null);
    setLines([]);
  };

  const activeVersion = phase === "GREEN" || phase === "PROMOTING" ? "v1.5 GREEN" : "v1.4 BLUE";
  const promotePhaseText = ["SHIFT 100/0 → 50/50", "SHIFT 50/50 → 0/100", "FINALIZE"];

  return (
    <UseCaseShell
      title="USE CASE // BLUE-GREEN DEPLOY — ZERO-DOWNTIME RELEASES"
      subtitle="v1.5 WARMS AT 0% → CANARY 50/50 → GREEN 100% → INSTANT ROLLBACK PATH"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="ACTIVE VERSION" value={activeVersion} tone={phase === "GREEN" ? "mint" : "aws"} />
          <UCStat label="BLUE %" value={weights.blue} tone="aws" />
          <UCStat label="GREEN %" value={weights.green} tone="mint" />
          <UCStat label="ROLLOVERS" value={rollovers} tone="magenta" />
          <UCStat label="GREEN HEALTH" value={phase === "BLUE" ? "—" : "3/3"} tone={phase === "BLUE" ? "neutral" : "mint"} />
          <UCStat label="REQUESTS" value={total} tone="neutral" />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? `LIVE TRAFFIC SPLIT ${weights.blue}/${weights.green}` : "IDLE — PRESS RUN, THEN DEPLOY GREEN"}
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">RELEASE PIPELINE</p>
          <div className="flex flex-wrap gap-2">
            <UCButton
              onClick={() => {
                if (phase !== "BLUE") return;
                setPhase("WARMING");
                push("DEPLOY GREEN — v1.5 spinning up behind the ALB at 0% traffic", "aws");
              }}
              disabled={phase !== "BLUE"}
              ariaLabel="Deploy the green v1.5 fleet alongside blue"
            >
              <Rocket className="w-3 h-3" /> DEPLOY GREEN
            </UCButton>
            <UCButton
              onClick={() => {
                if (phase !== "READY") return;
                resetPromote();
                setPhase("PROMOTING");
              }}
              tone="mint"
              disabled={phase !== "READY"}
              ariaLabel="Promote green to 100 percent of traffic"
            >
              <Rocket className="w-3 h-3" /> PROMOTE
            </UCButton>
            <UCButton
              onClick={() => {
                if (phase !== "GREEN") return;
                resetRollback();
                setPhase("ROLLING");
              }}
              tone="danger"
              disabled={phase !== "GREEN"}
              ariaLabel="Roll traffic back to the blue v1.4 fleet"
            >
              <Undo2 className="w-3 h-3" /> ROLLBACK
            </UCButton>
          </div>
          <p className="text-[7px] tracking-[0.15em] text-muted-foreground uppercase">
            both fleets stay warm on the same ALB — cutover is a weight change, rollback is one click
          </p>
        </>
      }
      logLines={lines}
      logTitle="RELEASE LOG // LIVE"
      logEmpty="PRESS RUN — DEPLOY GREEN → PROMOTE → (ROLLBACK IF v1.5 MISBEHAVES)"
    >
      <FlowCanvas ariaLabel="Blue-green deployment diagram" className="h-full">
        {/* client → ALB */}
        <FlowLink d="M15,50 L28,50" status={running ? "flowing" : "idle"} dotDuration={1.1} />
        {/* ALB → lanes */}
        <FlowLink d="M35,46 C42,38 46,32 50,29" status={weights.blue > 0 ? (running ? "flowing" : "idle") : "idle"} dot={running && weights.blue > 0} dotDuration={1.3} />
        <FlowLink d="M35,54 C42,62 46,68 50,71" status={weights.green > 0 ? (running ? "flowing" : "idle") : "idle"} dot={running && weights.green > 0} dotDuration={1.3} dotDelay={0.2} />

        <FlowNode x={8} y={50} size="xs" delay={0.1} icon={<UserIcon className="w-3 h-3" />} label="CLIENTS" status={running ? "active" : "idle"} pulse={running} />
        <FlowNode x={32} y={50} size="sm" delay={0.2} icon={<ELBIcon className="w-3 h-3" />} label="ALB" sub="WEIGHTED GROUPS" status="active" pulse={running} />

        {/* lanes */}
        <div className="absolute" style={{ left: "52%", right: "3%", top: "12%" }}>
          <BgLaneCard lane="blue" weight={weights.blue} reqs={reqs.blue} phase={phase} />
        </div>
        <div className="absolute" style={{ left: "52%", right: "3%", top: "54%" }}>
          <BgLaneCard lane="green" weight={weights.green} reqs={reqs.green} phase={phase} />
        </div>

        <FlowLabel x={32} y={70} tone="aws">WEIGHTED TARGET GROUPS — SAME DNS NAME</FlowLabel>
        <FlowLabel x={50} y={7} tone={phase === "GREEN" ? "mint" : "aws"}>
          {phase === "GREEN" ? "v1.5 SERVING 100% — BLUE ON STANDBY" : phase === "PROMOTING" ? "CUTTING OVER — WATCH THE WEIGHTS" : "v1.4 SERVING"}
        </FlowLabel>

        {(phase === "PROMOTING" || phase === "ROLLING") && (
          <StepBadge
            step={phase === "PROMOTING" ? promoteStep : rollbackStep}
            total={phase === "PROMOTING" ? 3 : 2}
            text={phase === "PROMOTING" ? promotePhaseText[Math.min(2, promoteStep)] : "ROLLING BACK TO BLUE"}
          />
        )}

        {/* traffic packets toward the weighted lane */}
        <AnimatePresence>
          {packet && (
            <motion.span
              key={packet.id}
              className={`absolute z-20 h-1.5 w-1.5 ${packet.lane === "blue" ? "bg-aws" : "bg-mint"} shadow-[0_0_8px_rgba(255,153,0,0.6)]`}
              initial={{ left: "8%", top: "50%" }}
              animate={{ left: ["8%", "32%", "56%"], top: ["50%", "50%", packet.lane === "blue" ? "22%" : "64%"] }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            />
          )}
        </AnimatePresence>

        <VerdictFlash show={flash !== null} text={flash?.text ?? ""} tone={flash?.tone ?? "aws"} />
      </FlowCanvas>

      <UseCaseNote>
        deploy green beside blue, canary 50/50 while you watch the dashboards, then flip to 0/100 — and if p99 spikes,
        the rollback is a single weight change, not a 40-minute redeploy
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* ROUTER                                                              */
/* ================================================================== */

export function ElbUseCases({ id, immersiveActive, immersiveToggle }: ElbUseCasesProps) {
  if (id === "PATH_ROUTING") return <PathRoutingUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
  if (id === "HEALTH_FAILOVER") return <HealthFailoverUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
  return <BlueGreenUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
}
