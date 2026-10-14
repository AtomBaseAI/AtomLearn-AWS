"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Delete,
  FileCode2,
  GitCompare,
  Layers,
  Radar,
  Undo2,
  Network,
} from "lucide-react";
import { CloudFormationIcon } from "@/components/aws-icons";
import { Callout } from "@/components/shared/callout";
import { AutoLog, logTs, type AutoLogLine } from "@/components/shared/auto-log";
import { FlowCanvas, FlowLabel, FlowLink, FlowNode, type NodeStatus } from "@/components/shared/flow";
import { GlassPanel } from "@/components/shared/glass-panel";
import { FullscreenToggle } from "@/components/shared/fullscreen-toggle";
import { SimControls } from "@/components/shared/sim-controls";
import { StatChip } from "@/components/shared/typography";
import { UseCaseTabs, type UcTabDef } from "@/components/shared/use-case";
import { CfnUseCases, type CfnUseCaseId } from "@/components/services/cloudformation-usecases";
import { useImmersiveView } from "@/hooks/use-immersive";

/* ------------------------------------------------------------------ */
/* CLOUDFORMATION — STACK WEAVER                                        */
/* Template → Stack Orchestrator → dependency-ordered resources.        */
/* Create / update / rollback / drift, all event-driven like real CFN.  */
/* ------------------------------------------------------------------ */

const BTN_BASE =
  "flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] border bg-black/50 backdrop-blur-md cyber-cut-sm";

const CFN_TABS = [
  { id: "GENERAL", label: "GENERAL", num: "01", icon: Layers },
  { id: "IAC", label: "INFRA AS CODE", num: "02", icon: FileCode2 },
  { id: "CHANGE_SETS", label: "CHANGE SETS", num: "03", icon: GitCompare },
  { id: "ROLLBACK", label: "AUTO ROLLBACK", num: "04", icon: Undo2 },
  { id: "DRIFT", label: "DRIFT DETECTION", num: "05", icon: Radar },
  { id: "STACKSETS", label: "STACKSETS", num: "06", icon: Network },
] as const satisfies readonly UcTabDef[];

type CfnTabId = (typeof CFN_TABS)[number]["id"];

/* ------------------------------------------------------------------ */
/* resource model                                                       */
/* ------------------------------------------------------------------ */

type ResKey = "role" | "bucket" | "table" | "lambda" | "alb";

interface ResDef {
  key: ResKey;
  logical: string;
  type: string;
  label: string;
  sub: string;
}

const RESOURCES: ResDef[] = [
  { key: "role", logical: "AppRole", type: "AWS::IAM::Role", label: "IAM ROLE", sub: "AppRole" },
  { key: "bucket", logical: "Artifacts", type: "AWS::S3::Bucket", label: "S3 BUCKET", sub: "Artifacts" },
  { key: "table", logical: "OrdersTable", type: "AWS::DynamoDB::Table", label: "DYNAMODB", sub: "OrdersTable" },
  { key: "lambda", logical: "OrderFn", type: "AWS::Lambda::Function", label: "LAMBDA FN", sub: "OrderFn" },
  { key: "alb", logical: "PublicApi", type: "AWS::ElasticLoadBalancingV2", label: "ALB", sub: "PublicApi" },
];

const RES_BY_KEY: Record<ResKey, ResDef> = Object.fromEntries(RESOURCES.map((r) => [r.key, r])) as Record<ResKey, ResDef>;

type ResStatus = "pending" | "in_progress" | "complete" | "failed" | "updating" | "drifted";

type StackPhase =
  | "IDLE"
  | "CREATE"
  | "CREATE_SUB"
  | "CREATE_COMPLETE"
  | "UPDATE"
  | "UPDATE_COMPLETE"
  | "ROLLBACK_CREATE"
  | "ROLLBACK_COMPLETE"
  | "DELETING"
  | "DELETE_COMPLETE";

const PHASE_PILL: Record<StackPhase, { text: string; cls: string }> = {
  IDLE: { text: "NO STACK", cls: "text-muted-foreground border-foreground/25" },
  CREATE: { text: "CREATE_IN_PROGRESS", cls: "text-aws border-aws/60 box-glow" },
  CREATE_SUB: { text: "CREATE_IN_PROGRESS", cls: "text-aws border-aws/60 box-glow" },
  CREATE_COMPLETE: { text: "CREATE_COMPLETE", cls: "text-mint border-mint/60" },
  UPDATE: { text: "UPDATE_IN_PROGRESS", cls: "text-aws border-aws/60 box-glow" },
  UPDATE_COMPLETE: { text: "UPDATE_COMPLETE", cls: "text-mint border-mint/60" },
  ROLLBACK_CREATE: { text: "ROLLBACK_IN_PROGRESS", cls: "text-danger border-danger/60" },
  ROLLBACK_COMPLETE: { text: "ROLLBACK_COMPLETE", cls: "text-danger border-danger/60" },
  DELETING: { text: "DELETE_IN_PROGRESS", cls: "text-neon border-neon/60" },
  DELETE_COMPLETE: { text: "DELETE_COMPLETE", cls: "text-muted-foreground border-foreground/25" },
};

const RES_TONE: Record<ResStatus, { status: NodeStatus; label: string }> = {
  pending: { status: "idle", label: "PENDING" },
  in_progress: { status: "active", label: "CREATE_IN_PROGRESS" },
  complete: { status: "success", label: "CREATE_COMPLETE" },
  failed: { status: "error", label: "CREATE_FAILED" },
  updating: { status: "active", label: "UPDATE_IN_PROGRESS" },
  drifted: { status: "cyber", label: "DRIFTED" },
};

const TICK_MS = 760;

/* compact status readout for the LIVE STATS rail */
const STATUS_SHORT: Record<StackPhase, string> = {
  IDLE: "NO STACK",
  CREATE: "CREATING",
  CREATE_SUB: "CREATING",
  CREATE_COMPLETE: "LIVE",
  UPDATE: "UPDATING",
  UPDATE_COMPLETE: "LIVE",
  ROLLBACK_CREATE: "ROLLBACK",
  ROLLBACK_COMPLETE: "ROLLED BACK",
  DELETING: "DELETING",
  DELETE_COMPLETE: "DELETED",
};

/* ------------------------------------------------------------------ */
/* visualizer                                                           */
/* ------------------------------------------------------------------ */

export default function CloudFormationVisualizer() {
  const immersive = useImmersiveView();
  const [tab, setTab] = useState<CfnTabId>("GENERAL");

  /* ---- engine state (mirrors of refs) ---- */
  const [phase, setPhase] = useState<StackPhase>("IDLE");
  const [busy, setBusy] = useState(false);
  const [resState, setResState] = useState<Record<ResKey, ResStatus>>({
    role: "pending",
    bucket: "pending",
    table: "pending",
    lambda: "pending",
    alb: "pending",
  });
  const [events, setEvents] = useState<AutoLogLine[]>([]);
  const [failInject, setFailInject] = useState(false);
  const [driftedKey, setDriftedKey] = useState<ResKey | null>(null);

  /* ---- refs (engine truth) ---- */
  const phaseRef = useRef<StackPhase>("IDLE");
  const resRef = useRef<Record<ResKey, ResStatus>>({ role: "pending", bucket: "pending", table: "pending", lambda: "pending", alb: "pending" });
  const idxRef = useRef(0);
  const rollbackRef = useRef<ResKey[]>([]);
  const subRef = useRef(0);
  const eventId = useRef(1);
  const failRef = useRef(false);

  useEffect(() => {
    failRef.current = failInject;
  }, [failInject]);

  const pushEvent = useCallback((text: string, tone?: string) => {
    setEvents((prev) => [...prev.slice(-46), { id: eventId.current++, text: `${logTs()} ${text}`, tone }]);
  }, []);

  const flush = useCallback(() => {
    setPhase(phaseRef.current);
    setResState({ ...resRef.current });
  }, []);

  const setRes = useCallback((k: ResKey, s: ResStatus) => {
    resRef.current[k] = s;
  }, []);

  /* ---- engine tick: one discrete CFN action per tick ---- */
  const engineTick = useCallback(() => {
    const ph = phaseRef.current;

    if (ph === "CREATE") {
      const def = RESOURCES[idxRef.current];
      if (!def) {
        phaseRef.current = "CREATE_COMPLETE";
        pushEvent(`STACK ${"→"} CREATE_COMPLETE — 5/5 resources provisioned`, "mint");
        flush();
        setBusy(false);
        return;
      }
      if (def.key === "lambda" && failRef.current) {
        setRes("lambda", "failed");
        pushEvent(`CREATE_IN_PROGRESS ${def.type} ${def.logical}`, "dim");
        pushEvent(`CREATE_FAILED ${def.type} ${def.logical} — handler error: permission denied on PassRole`, "danger");
        phaseRef.current = "ROLLBACK_CREATE";
        rollbackRef.current = RESOURCES.slice(0, idxRef.current + 1).map((r) => r.key).reverse();
        subRef.current = 0;
        flush();
        return;
      }
      setRes(def.key, "in_progress");
      pushEvent(`CREATE_IN_PROGRESS ${def.type} ${def.logical}`, "dim");
      subRef.current = 1;
      phaseRef.current = "CREATE_SUB";
      flush();
      return;
    }

    if (ph === "CREATE_SUB") {
      const def = RESOURCES[idxRef.current];
      setRes(def.key, "complete");
      pushEvent(`CREATE_COMPLETE ${def.type} ${def.logical}`, "mint");
      idxRef.current += 1;
      phaseRef.current = "CREATE";
      flush();
      return;
    }

    if (ph === "ROLLBACK_CREATE") {
      const k = rollbackRef.current.shift();
      if (!k) {
        phaseRef.current = "ROLLBACK_COMPLETE";
        pushEvent("ROLLBACK_COMPLETE — stack returned to pre-create state", "danger");
        flush();
        return;
      }
      const def = RES_BY_KEY[k];
      setRes(k, resRef.current[k] === "failed" ? "failed" : "pending");
      pushEvent(`DELETE_IN_PROGRESS ${def.type} ${def.logical} (rollback)`, "dim");
      pushEvent(`DELETE_COMPLETE ${def.type} ${def.logical}`, "dim");
      flush();
      return;
    }

    if (ph === "ROLLBACK_COMPLETE") {
      pushEvent("DELETE_COMPLETE AWS::CloudFormation::Stack my-app-stack — failed create cleaned up", "muted");
      RESOURCES.forEach((r) => setRes(r.key, "pending"));
      idxRef.current = 0;
      phaseRef.current = "IDLE";
      flush();
      setBusy(false);
      return;
    }

    if (ph === "UPDATE") {
      if (subRef.current === 0) {
        pushEvent("UPDATE_IN_PROGRESS AWS::CloudFormation::Stack my-app-stack", "dim");
        setRes("table", "updating");
        pushEvent("UPDATE_IN_PROGRESS AWS::DynamoDB::Table OrdersTable — BillingMode → PAY_PER_REQUEST", "dim");
        subRef.current = 1;
        flush();
        return;
      }
      setRes("table", "complete");
      pushEvent("UPDATE_COMPLETE AWS::DynamoDB::Table OrdersTable — changed resources only: 1", "mint");
      phaseRef.current = "UPDATE_COMPLETE";
      pushEvent("STACK → UPDATE_COMPLETE — no replacement, zero downtime", "mint");
      flush();
      setBusy(false);
      return;
    }

    if (ph === "DELETING") {
      const k = rollbackRef.current.shift();
      if (!k) {
        pushEvent("DELETE_COMPLETE AWS::CloudFormation::Stack my-app-stack — teardown complete", "muted");
        idxRef.current = 0;
        phaseRef.current = "IDLE";
        flush();
        setBusy(false);
        return;
      }
      const def = RES_BY_KEY[k];
      setRes(k, "pending");
      pushEvent(`DELETE_IN_PROGRESS ${def.type} ${def.logical}`, "dim");
      pushEvent(`DELETE_COMPLETE ${def.type} ${def.logical}`, "muted");
      flush();
      return;
    }

    /* terminal — engine should be stopped */
    setBusy(false);
  }, [flush, pushEvent, setRes]);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(engineTick, TICK_MS);
    return () => clearInterval(t);
  }, [busy, engineTick]);

  /* ---- actions ---- */
  const startEngine = useCallback(() => setBusy(true), []);

  const deploy = useCallback(() => {
    if (busy || phaseRef.current !== "IDLE") return;
    RESOURCES.forEach((r) => setRes(r.key, "pending"));
    idxRef.current = 0;
    subRef.current = 0;
    phaseRef.current = "CREATE";
    pushEvent(`CREATE_IN_PROGRESS AWS::CloudFormation::Stack my-app-stack — template.yaml (${RESOURCES.length} resources)`, "aws");
    flush();
    startEngine();
  }, [busy, flush, pushEvent, setRes, startEngine]);

  const update = useCallback(() => {
    if (busy || phaseRef.current !== "CREATE_COMPLETE") return;
    subRef.current = 0;
    phaseRef.current = "UPDATE";
    flush();
    startEngine();
  }, [busy, flush, startEngine]);

  const deleteStack = useCallback(() => {
    if (busy) return;
    const ph = phaseRef.current;
    if (ph !== "CREATE_COMPLETE" && ph !== "UPDATE_COMPLETE") return;
    rollbackRef.current = RESOURCES.map((r) => r.key).reverse();
    phaseRef.current = "DELETING";
    pushEvent("DELETE_IN_PROGRESS AWS::CloudFormation::Stack my-app-stack — reverse dependency order", "aws");
    setDriftedKey(null);
    flush();
    startEngine();
  }, [busy, flush, pushEvent, startEngine]);

  const injectDrift = useCallback(() => {
    if (busy || phaseRef.current !== "CREATE_COMPLETE") return;
    setDriftedKey("bucket");
    setRes("bucket", "drifted");
    pushEvent("CONSOLE (out-of-band): aws s3api put-bucket-policy on Artifacts — template no longer matches reality", "magenta");
    pushEvent("stack status: CREATE_COMPLETE but DRIFTED — run drift detection to resolve", "magenta");
    flush();
  }, [busy, flush, pushEvent, setRes]);

  const reset = useCallback(() => {
    setBusy(false);
    phaseRef.current = "IDLE";
    idxRef.current = 0;
    subRef.current = 0;
    rollbackRef.current = [];
    RESOURCES.forEach((r) => setRes(r.key, "pending"));
    setDriftedKey(null);
    setEvents([]);
    flush();
  }, [flush, setRes]);

  /* ---- autopilot: endless lifecycle loop (IDLE→create→update→delete) ---- */
  const [auto, setAuto] = useState(false);
  const autoTick = useCallback(() => {
    const ph = phaseRef.current;
    if (ph === "IDLE") deploy();
    else if (ph === "CREATE_COMPLETE") update();
    else if (ph === "UPDATE_COMPLETE") deleteStack();
  }, [deploy, deleteStack, update]);
  /* autopilot scheduler — interval only while auto is on */
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => {
      if (!busy) autoTick();
    }, 1500);
    return () => clearInterval(t);
  }, [auto, busy, autoTick]);

  /* ---- derived ---- */
  const createdCount = RESOURCES.filter((r) => resState[r.key] === "complete" || resState[r.key] === "drifted").length;
  const progress = phase === "IDLE" ? 0 : Math.round((createdCount / RESOURCES.length) * 100);
  const pill = PHASE_PILL[phase];

  const resNodeStatus = (k: ResKey): NodeStatus => RES_TONE[resState[k]].status;

  const linkStatus = (k: ResKey): "idle" | "flowing" | "success" | "error" | "cyber" => {
    const s = resState[k];
    if (s === "in_progress" || s === "updating") return "flowing";
    if (s === "complete") return "success";
    if (s === "failed") return "error";
    if (s === "drifted") return "cyber";
    return "idle";
  };

  const coreLink = "M 22 13 C 31 14, 29 28, 34 35";

  return (
    <div
      className={
        immersive.active
          ? "fixed inset-0 z-[70] bg-background p-3 sm:p-5 flex flex-col gap-3 sm:gap-4 overflow-y-auto cyber-scroll"
          : "flex flex-col gap-4"
      }
    >
      {/* MODULE TABS — sits directly below the module title card */}
      <UseCaseTabs tabs={CFN_TABS} active={tab} onChange={(t) => setTab(t as CfnTabId)} label="CloudFormation views" />

      {tab !== "GENERAL" && (
        <CfnUseCases id={tab as CfnUseCaseId} immersiveActive={immersive.active} immersiveToggle={immersive.toggle} />
      )}

      {tab === "GENERAL" && (
        <>
          {/* FLOW VIEW + RIGHT RAIL */}
          <div className={`grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start ${immersive.active ? "flex-1" : ""}`}>
            <GlassPanel
              title="FLOW VIEW // STACK LIFECYCLE"
              subtitle="TEMPLATE → STACK ORCHESTRATOR → DEPENDENCY-ORDERED RESOURCES"
              className="!p-0 overflow-hidden"
              delay={0.05}
              actions={<FullscreenToggle active={immersive.active} onToggle={immersive.toggle} />}
            >
              <FlowCanvas
                className={immersive.active ? "h-[min(560px,58vh)]" : "h-[440px] sm:h-[540px] lg:h-[560px]"}
                ariaLabel="CloudFormation stack lifecycle flow diagram"
                links={
                  <>
                    {/* template → orchestrator */}
                    <FlowLink d={coreLink} status={busy ? "flowing" : "idle"} dotDuration={1.4} />
                    {/* orchestrator → each resource */}
                    {RESOURCES.map((r, i) => {
                      const y = 13 + i * 18.5;
                      return (
                        <FlowLink
                          key={r.key}
                          d={`M 56 44 C 63 44, 64 ${y}, 70 ${y}`}
                          status={linkStatus(r.key)}
                          dotDuration={1.2}
                        />
                      );
                    })}
                    {/* DependsOn: AppRole → OrderFn */}
                    <FlowLink d="M 90 13 C 97 20, 97 62, 90 68" status="idle" dashed dot={false} strokeWidth={1} />
                  </>
                }
              >
                {/* HEADER CHIP */}
                <div className="absolute left-3 top-2.5 z-[6] flex items-center gap-1.5 border border-aws/40 bg-black/70 px-2 py-1 backdrop-blur-sm">
                  <CloudFormationIcon className="w-3 h-3 text-aws" />
                  <span className="text-[8px] font-bold tracking-[0.2em] text-aws uppercase">CFN — IAC</span>
                </div>

                {/* TEMPLATE node + code block */}
                <FlowNode x={15} y={11} size="sm" icon={<FileCode2 className="w-3 h-3" />} label="template.yaml" sub={`${RESOURCES.length} RESOURCES`} status={phase === "IDLE" ? "idle" : "active"} />
                <div className="absolute left-[3%] top-[20%] w-[27%] z-[6] glass-inset cyber-cut-sm p-2 text-[7.5px] leading-[13px] font-bold tracking-wider" aria-hidden="true">
                  <p className="text-muted-foreground/60"># AWSTemplateFormatVersion: 2010-09-09</p>
                  <p className="text-aws">Resources:</p>
                  {RESOURCES.map((r) => {
                    const hot = (resState[r.key] === "in_progress" || resState[r.key] === "updating");
                    return (
                      <motion.p
                        key={r.key}
                        animate={{ opacity: hot ? 1 : 0.55, x: hot ? 3 : 0 }}
                        transition={{ duration: 0.25 }}
                        className={hot ? "text-aws" : "text-foreground/70"}
                      >
                        {"  "}
                        {r.logical}:
                        <br />
                        {"    "}Type: {r.type}
                      </motion.p>
                    );
                  })}
                </div>

                {/* CFN CORE — orchestrator block */}
                <div
                  className="absolute z-10 -translate-x-1/2 -translate-y-1/2 w-[34%] min-w-[218px]"
                  style={{ left: "40%", top: "44%" }}
                >
                  <div
                    className={`relative border backdrop-blur-md bg-black/60 p-3 flex flex-col gap-2 cyber-cut ${
                      phase === "CREATE" || phase === "CREATE_SUB" || phase === "UPDATE"
                        ? "border-aws/70 box-glow"
                        : phase === "ROLLBACK_CREATE" || phase === "ROLLBACK_COMPLETE"
                          ? "border-danger/70"
                          : phase === "CREATE_COMPLETE" || phase === "UPDATE_COMPLETE"
                            ? "border-mint/50"
                            : "border-foreground/25"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <CloudFormationIcon className="w-5 h-5 text-aws shrink-0" />
                      <div className="min-w-0 leading-tight">
                        <p className="text-[10px] font-extrabold tracking-[0.16em] text-aws uppercase truncate">my-app-stack</p>
                        <p className="text-[7px] tracking-[0.18em] text-muted-foreground uppercase">arn: aws:cloudformation:us-east-1</p>
                      </div>
                    </div>
                    <div className={`border px-2 py-1 text-[8px] font-extrabold tracking-[0.18em] text-center ${pill.cls}`}>
                      {pill.text}
                    </div>
                    <div className="h-1.5 w-full bg-black/60 border border-foreground/15 overflow-hidden">
                      <motion.div
                        className={`h-full ${phase === "ROLLBACK_CREATE" || phase === "ROLLBACK_COMPLETE" ? "bg-danger" : "bg-aws"}`}
                        animate={{ width: `${progress}%` }}
                        transition={{ type: "spring", stiffness: 90, damping: 20 }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[7px] tracking-[0.18em] text-muted-foreground uppercase">
                      <span>{createdCount}/{RESOURCES.length} resources</span>
                      <span className={driftedKey ? "text-magenta" : ""}>{driftedKey ? "DRIFT DETECTED" : "IN SYNC"}</span>
                    </div>
                  </div>
                </div>

                <FlowLabel x={40} y={12} tone="aws">ORCHESTRATOR</FlowLabel>
                <FlowLabel x={80} y={4.5}>RESOURCE LAYER</FlowLabel>
                <FlowLabel x={96} y={40}>DependsOn</FlowLabel>

                {/* resource column — created in dependency order */}
                {RESOURCES.map((r, i) => (
                  <FlowNode
                    key={r.key}
                    x={81}
                    y={13 + i * 18.5}
                    size="sm"
                    label={r.label}
                    sub={`${r.logical} · ${RES_TONE[resState[r.key]].label}`}
                    status={resNodeStatus(r.key)}
                    pulse={resState[r.key] === "in_progress" || resState[r.key] === "updating"}
                  />
                ))}
              </FlowCanvas>
            </GlassPanel>

            {/* RIGHT RAIL */}
            <div className="flex flex-col gap-4 min-w-0">
              <GlassPanel title="LIVE STATS" className="!p-0" delay={0.1}>
                <div className="p-3 grid grid-cols-2 gap-2">
                  <StatChip label="STACK STATUS" value={STATUS_SHORT[phase]} tone={phase === "CREATE_COMPLETE" || phase === "UPDATE_COMPLETE" ? "mint" : "aws"} />
                  <StatChip label="RESOURCES" value={`${createdCount}/${RESOURCES.length}`} tone="neutral" />
                  <StatChip label="EVENTS" value={String(events.length)} tone="aws" />
                  <StatChip label="DRIFT" value={driftedKey ? "1 DRIFTED" : "0"} tone={driftedKey ? "magenta" : "mint"} />
                </div>
              </GlassPanel>

              <GlassPanel title="CONTROLS" className="!p-0" delay={0.15}>
                <div className="p-3 flex flex-col gap-2.5">
                  <SimControls
                    running={auto}
                    onToggle={() => setAuto((v) => !v)}
                    onReset={reset}
                    status={
                      phase === "IDLE"
                        ? "NO STACK — DEPLOY template.yaml"
                        : phase === "CREATE_COMPLETE" || phase === "UPDATE_COMPLETE"
                          ? "STACK LIVE — UPDATE · DRIFT · DELETE"
                          : `ENGINE BUSY — ${pill.text}`
                    }
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={deploy} disabled={busy || phase !== "IDLE"} aria-label="Deploy stack" className={`${BTN_BASE} border-aws/60 text-aws hover:bg-aws/10 disabled:opacity-35`}>
                      DEPLOY STACK
                    </button>
                    <button type="button" onClick={update} disabled={busy || phase !== "CREATE_COMPLETE"} aria-label="Update stack" className={`${BTN_BASE} border-aws/60 text-aws hover:bg-aws/10 disabled:opacity-35`}>
                      UPDATE STACK
                    </button>
                    <button
                      type="button"
                      onClick={() => setFailInject((v) => !v)}
                      aria-pressed={failInject}
                      aria-label="Toggle failure injection"
                      className={`${BTN_BASE} ${failInject ? "border-danger/70 text-danger" : "border-foreground/20 text-muted-foreground hover:border-danger/50"}`}
                    >
                      FAIL LAMBDA {failInject ? "ON" : "OFF"}
                    </button>
                    <button type="button" onClick={injectDrift} disabled={busy || phase !== "CREATE_COMPLETE"} aria-label="Inject out-of-band drift" className={`${BTN_BASE} border-magenta/60 text-magenta hover:bg-magenta/10 disabled:opacity-35`}>
                      CAUSE DRIFT
                    </button>
                    <button type="button" onClick={deleteStack} disabled={busy || (phase !== "CREATE_COMPLETE" && phase !== "UPDATE_COMPLETE")} aria-label="Delete stack" className={`${BTN_BASE} border-neon/60 text-neon hover:bg-neon/10 disabled:opacity-35 col-span-2`}>
                      <Delete className="w-3 h-3" /> DELETE STACK
                    </button>
                  </div>
                </div>
              </GlassPanel>
            </div>
          </div>

          {/* STACK EVENTS LOG */}
          <GlassPanel title="STACK EVENTS // CLOUDFORMATION EVENT STREAM" className="!p-0" delay={0.2}>
            <div className="p-3">
              <AutoLog lines={events} visibleLines={6} emptyText="PRESS DEPLOY STACK — CFN EVENTS WILL STREAM HERE…" />
            </div>
          </GlassPanel>

          {/* KNOWLEDGE */}
          <div className={immersive.active ? "hidden" : "grid gap-3 md:grid-cols-3"}>
            <Callout type="exam" title="Rollback is automatic" delay={0.05}>
              A failed resource aborts the operation and every already-created resource is deleted in reverse order. A stack left in ROLLBACK_COMPLETE must be deleted before you can create it again.
            </Callout>
            <Callout type="tip" title="Change sets = deploy previews" delay={0.15}>
              Run a change set before every production update. It lists every ADD / MODIFY / REPLACEMENT action up front — REPLACEMENT means delete + recreate, which destroys data on stateful resources.
            </Callout>
            <Callout type="critical" title="Never touch stacks by hand" delay={0.25}>
              Console edits bypass the template and cause drift. Either revert to the template state or adopt the change into the template — one source of truth, always.
            </Callout>
          </div>
        </>
      )}
    </div>
  );
}
