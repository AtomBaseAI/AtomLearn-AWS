"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { CloudFormationIcon } from "@/components/aws-icons";
import { logTs, type AutoLogLine } from "@/components/shared/auto-log";
import { FlowCanvas, FlowLabel, FlowLink, FlowNode, type NodeStatus } from "@/components/shared/flow";
import {
  StepBadge,
  UCButton,
  UCStat,
  UCToggle,
  UseCaseNote,
  UseCaseShell,
  VerdictFlash,
  useScenarioRunner,
  useTicker,
} from "@/components/shared/use-case";

/* ================================================================== */
/* CLOUDFORMATION — BEST-USE-CASE TABS                                  */
/* 02 INFRA AS CODE · 03 CHANGE SETS · 04 AUTO ROLLBACK ·               */
/* 05 DRIFT DETECTION · 06 STACKSETS                                    */
/* ================================================================== */

export type CfnUseCaseId = "IAC" | "CHANGE_SETS" | "ROLLBACK" | "DRIFT" | "STACKSETS";

interface CfnUseCasesProps {
  id?: CfnUseCaseId;
  immersiveActive?: boolean;
  immersiveToggle?: () => void;
}

/* ------------------------------------------------------------------ */
/* shared micro-hooks (lint-safe push/flash helpers)                    */
/* ------------------------------------------------------------------ */

function useLog() {
  const [lines, setLines] = useState<AutoLogLine[]>([]);
  const idRef = useRef(1);
  const push = useCallback((text: string, tone?: string) => {
    setLines((prev) => [...prev.slice(-46), { id: idRef.current++, text: `${logTs()} ${text}`, tone }]);
  }, []);
  const clear = useCallback(() => setLines([]), []);
  return { lines, push, clear };
}

type FlashKind = null | "ok" | "deny" | "aws";

function useFlash() {
  const [flash, setFlash] = useState<FlashKind>(null);
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((f: Exclude<FlashKind, null>) => {
    if (tRef.current) clearTimeout(tRef.current);
    setFlash(f);
    tRef.current = setTimeout(() => setFlash(null), 1500);
  }, []);
  useEffect(() => () => {
    if (tRef.current) clearTimeout(tRef.current);
  }, []);
  return { flash, show };
}

type ResUi = "pending" | "in_progress" | "complete" | "failed" | "updated" | "drifted" | "restored" | "creating" | "created" | "stopped";

const RES_STATUS: Record<ResUi, { status: NodeStatus; label: string }> = {
  pending: { status: "idle", label: "PENDING" },
  in_progress: { status: "active", label: "IN_PROGRESS" },
  complete: { status: "success", label: "COMPLETE" },
  failed: { status: "error", label: "FAILED" },
  updated: { status: "success", label: "MODIFIED" },
  drifted: { status: "cyber", label: "DRIFTED" },
  restored: { status: "success", label: "RESTORED" },
  creating: { status: "active", label: "CREATING" },
  created: { status: "success", label: "CREATED" },
  stopped: { status: "error", label: "STOPPED" },
};

const STATUS_PILL_CLS: Record<string, string> = {
  pending: "text-muted-foreground border-foreground/20",
  in_progress: "text-aws border-aws/60",
  complete: "text-mint border-mint/60",
  failed: "text-danger border-danger/60",
  updated: "text-mint border-mint/60",
  drifted: "text-magenta border-magenta/60",
  restored: "text-mint border-mint/60",
  creating: "text-aws border-aws/60",
  created: "text-mint border-mint/60",
  stopped: "text-danger border-danger/60",
};

/* ================================================================== */
/* TAB 02 — INFRA AS CODE: one template, dependency waves, repeatable   */
/* ================================================================== */

interface IacRes {
  key: string;
  logical: string;
  type: string;
  label: string;
  wave: 1 | 2 | 3;
  x: number;
  y: number;
}

const IAC_RES: IacRes[] = [
  { key: "role", logical: "AppRole", type: "AWS::IAM::Role", label: "IAM ROLE", wave: 1, x: 68, y: 18 },
  { key: "bucket", logical: "Artifacts", type: "AWS::S3::Bucket", label: "S3 BUCKET", wave: 1, x: 91, y: 18 },
  { key: "table", logical: "OrdersTable", type: "AWS::DynamoDB::Table", label: "DYNAMODB", wave: 2, x: 68, y: 50 },
  { key: "logs", logical: "MetricsLog", type: "AWS::Logs::LogGroup", label: "LOG GROUP", wave: 2, x: 91, y: 50 },
  { key: "fn", logical: "OrderFn", type: "AWS::Lambda::Function", label: "LAMBDA FN", wave: 3, x: 68, y: 82 },
  { key: "api", logical: "ApiEdge", type: "AWS::ApiGatewayV2::Api", label: "HTTP API", wave: 3, x: 91, y: 82 },
];

const IAC_WAVES: Record<1 | 2 | 3, IacRes[]> = {
  1: IAC_RES.filter((r) => r.wave === 1),
  2: IAC_RES.filter((r) => r.wave === 2),
  3: IAC_RES.filter((r) => r.wave === 3),
};

const IAC_TICK_MS = 700;

function IacUseCase({ immersiveActive, immersiveToggle }: CfnUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [resState, setResState] = useState<Record<string, ResUi>>(Object.fromEntries(IAC_RES.map((r) => [r.key, "pending"])));
  const [done, setDone] = useState(false);
  const [ticks, setTicks] = useState(0);
  const [showEdges, setShowEdges] = useState(true);
  const [serial, setSerial] = useState(false);
  const [activeWave, setActiveWave] = useState<1 | 2 | 3>(1);
  const { lines, push, clear } = useLog();

  /* engine truth lives in refs — state below is the render mirror */
  const waveRef = useRef<1 | 2 | 3>(1);
  const subRef = useRef(0);
  const serialIdxRef = useRef(0);
  const serialRef = useRef(false);
  useEffect(() => {
    serialRef.current = serial;
  }, [serial]);

  const finish = useCallback(
    (elapsed: string, refTime: string) => {
      push(`CREATE_COMPLETE AWS::CloudFormation::Stack app-stack — wall time ${elapsed} (serial would need ${refTime})`, "mint");
      push("same template re-deployed to staging + prod — identical result every run", "aws");
      setDone(true);
      setRunning(false);
    },
    [push]
  );

  const tick = useCallback(() => {
    if (subRef.current === 0) {
      if (serialRef.current) {
        const r = IAC_RES[serialIdxRef.current];
        if (!r) return;
        setResState((p) => ({ ...p, [r.key]: "in_progress" }));
        push(`CREATE_IN_PROGRESS ${r.type} ${r.logical} (serial #${serialIdxRef.current + 1})`, "dim");
      } else {
        const w = IAC_WAVES[waveRef.current];
        setResState((p) => {
          const n = { ...p };
          w.forEach((r) => (n[r.key] = "in_progress"));
          return n;
        });
        push(`CREATE_IN_PROGRESS wave ${waveRef.current} — ${w.map((r) => r.logical).join(" · ")} (parallel)`, "dim");
        setActiveWave(waveRef.current);
      }
      subRef.current = 1;
      setTicks((t) => t + 1);
      return;
    }
    /* sub 1 — mark complete */
    if (serialRef.current) {
      const r = IAC_RES[serialIdxRef.current];
      setResState((p) => ({ ...p, [r.key]: "complete" }));
      push(`CREATE_COMPLETE ${r.type} ${r.logical}`, "mint");
      serialIdxRef.current += 1;
      if (serialIdxRef.current >= IAC_RES.length) {
        finish("8.4s", "8.4s");
        return;
      }
    } else {
      const w = IAC_WAVES[waveRef.current];
      setResState((p) => {
        const n = { ...p };
        w.forEach((r) => (n[r.key] = "complete"));
        return n;
      });
      push(`CREATE_COMPLETE wave ${waveRef.current} — ${w.length} resources provisioned in parallel`, "mint");
      if (waveRef.current === 3) {
        finish("4.2s", "8.4s");
        return;
      }
      waveRef.current = (waveRef.current + 1) as 1 | 2 | 3;
    }
    subRef.current = 0;
    setTicks((t) => t + 1);
  }, [finish, push]);

  useTicker(running && !done, tick, IAC_TICK_MS);

  const start = useCallback(() => {
    clear();
    push(`PARSING template.yaml — ${IAC_RES.length} resources declared`, "aws");
    push("DEPENDENCY GRAPH RESOLVED — 3 waves: {role,bucket} → {table,logs} → {fn,api}", "aws");
    setResState(Object.fromEntries(IAC_RES.map((r) => [r.key, "pending"])));
    waveRef.current = 1;
    subRef.current = 0;
    serialIdxRef.current = 0;
    setTicks(0);
    setDone(false);
    setActiveWave(1);
    setRunning(true);
  }, [clear, push]);

  const reset = useCallback(() => {
    setRunning(false);
    setDone(false);
    setResState(Object.fromEntries(IAC_RES.map((r) => [r.key, "pending"])));
    waveRef.current = 1;
    subRef.current = 0;
    serialIdxRef.current = 0;
    setTicks(0);
    setActiveWave(1);
    clear();
  }, [clear]);

  const created = IAC_RES.filter((r) => resState[r.key] === "complete").length;
  const elapsed = (ticks * IAC_TICK_MS) / 1000;
  const waveNow = IAC_WAVES[activeWave].some((r) => resState[r.key] === "in_progress");

  const linkStat = (k: string): "idle" | "flowing" | "success" | "error" | "cyber" => {
    const s = resState[k];
    if (s === "in_progress" || s === "creating") return "flowing";
    if (s === "complete" || s === "created") return "success";
    if (s === "failed") return "error";
    return "idle";
  };

  return (
    <UseCaseShell
      title="USE CASE 02 // INFRASTRUCTURE AS CODE"
      subtitle="ONE TEMPLATE → DEPENDENCY WAVES → THE SAME STACK, EVERY TIME"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      logLines={lines}
      logTitle="DEPLOY LOG // template.yaml → app-stack"
      stats={
        <>
          <UCStat label="RESOURCES" value={`${created}/${IAC_RES.length}`} tone={done ? "mint" : "aws"} />
          <UCStat label="STRATEGY" value={serial ? "SERIAL" : "PARALLEL WAVES"} tone={serial ? "neutral" : "aws"} />
          <UCStat label="WALL CLOCK" value={done ? (serial ? "8.4s" : "4.2s") : `${elapsed.toFixed(1)}s`} tone={done ? "mint" : "aws"} />
          <UCStat label="REPEATABLE" value="100% IDEMPOTENT" tone="magenta" />
        </>
      }
      controls={
        <>
          <div className="flex flex-wrap gap-2">
            <UCButton onClick={start} disabled={running && !done} ariaLabel="Run template deployment">
              {done ? "RE-DEPLOY" : "RUN DEPLOY"}
            </UCButton>
            <UCButton onClick={reset} tone="neutral" ariaLabel="Reset deployment">
              RESET
            </UCButton>
          </div>
          <div className="flex flex-wrap gap-2">
            <UCToggle on={!serial} onClick={() => setSerial(false)} accent="aws" ariaLabel="Parallel wave mode">
              PARALLEL WAVES
            </UCToggle>
            <UCToggle on={serial} onClick={() => setSerial(true)} accent="magenta" ariaLabel="Serial mode">
              SERIAL (NO CFN)
            </UCToggle>
          </div>
          <UCToggle on={showEdges} onClick={() => setShowEdges((v) => !v)} ariaLabel="Toggle DependsOn edges">
            DependsOn EDGES
          </UCToggle>
          <p className="text-[8px] leading-relaxed tracking-wider text-muted-foreground uppercase">
            CFN reads the graph and provisions everything that CAN run in parallel — half the wall time of scripted serial deploys, and byte-identical on every re-run.
          </p>
        </>
      }
    >
      <FlowCanvas ariaLabel="Infrastructure as code dependency wave deployment" className="h-full">
        <div className="absolute left-3 top-9 z-[6] flex items-center gap-1.5 border border-aws/40 bg-black/70 px-2 py-1 backdrop-blur-sm">
          <CloudFormationIcon className="w-3 h-3 text-aws" />
          <span className="text-[8px] font-bold tracking-[0.2em] text-aws uppercase">template.yaml × 3 ENVIRONMENTS</span>
        </div>
        <StepBadge step={Math.min(3, Math.ceil(created / 2))} total={3} text={done ? "STACK DEPLOYED" : waveNow ? "WAVE PROVISIONING" : "GRAPH RESOLVED"} />
        <UseCaseNote>
          ONE DECLARATION = DEV + STAGE + PROD. CFN RESOLVES DependsOn FOR YOU — WAVE 1 ROLES/BUCKETS, WAVE 2 DATA, WAVE 3 COMPUTE.
        </UseCaseNote>

        {/* template card */}
        <div className="absolute left-[3%] top-[16%] w-[24%] z-[6] glass-inset cyber-cut-sm p-2 text-[7.5px] leading-[13px] font-bold tracking-wider" aria-hidden="true">
          <p className="text-aws">Resources:</p>
          {IAC_RES.map((r) => (
            <motion.p
              key={r.key}
              animate={{ opacity: resState[r.key] === "pending" ? 0.55 : 1 }}
              className={resState[r.key] === "complete" ? "text-mint" : resState[r.key] === "in_progress" ? "text-aws" : "text-foreground/70"}
            >
              {"  "}
              {r.logical} <span className="text-muted-foreground">W{r.wave}</span>
            </motion.p>
          ))}
        </div>

        {/* orchestrator core */}
        <div className="absolute z-10 -translate-x-1/2 -translate-y-1/2 w-[26%] min-w-[190px]" style={{ left: "37%", top: "50%" }}>
          <div className={`relative border backdrop-blur-md bg-black/60 p-3 flex flex-col gap-2 cyber-cut ${running && !done ? "border-aws/70 box-glow" : done ? "border-mint/50" : "border-foreground/25"}`}>
            <div className="flex items-center gap-2">
              <CloudFormationIcon className="w-5 h-5 text-aws shrink-0" />
              <p className="text-[9px] font-extrabold tracking-[0.16em] text-aws uppercase">app-stack</p>
            </div>
            <div className={`border px-2 py-1 text-[8px] font-extrabold tracking-[0.16em] text-center ${done ? "text-mint border-mint/60" : running ? "text-aws border-aws/60" : "text-muted-foreground border-foreground/25"}`}>
              {done ? "CREATE_COMPLETE" : running ? "CREATE_IN_PROGRESS" : "AWAITING DEPLOY"}
            </div>
            <div className="h-1.5 w-full bg-black/60 border border-foreground/15 overflow-hidden">
              <motion.div className="h-full bg-aws" animate={{ width: `${(created / IAC_RES.length) * 100}%` }} transition={{ type: "spring", stiffness: 90, damping: 20 }} />
            </div>
            <p className="text-[7px] tracking-[0.18em] text-muted-foreground uppercase">
              {serial ? "serial engine — 1 worker" : "parallel engine — wave scheduler"}
            </p>
          </div>
        </div>

        {/* wave labels */}
        {([1, 2, 3] as const).map((w) => (
          <FlowLabel key={w} x={57} y={w === 1 ? 18 : w === 2 ? 50 : 82} tone={activeWave === w && !done ? "aws" : "default"}>
            WAVE {w}
          </FlowLabel>
        ))}

        {/* resource nodes */}
        {IAC_RES.map((r) => {
          const s = RES_STATUS[resState[r.key]];
          return (
            <FlowNode
              key={r.key}
              x={r.x}
              y={r.y}
              size="sm"
              label={r.label}
              sub={`${r.logical} · ${s.label}`}
              status={s.status}
              pulse={resState[r.key] === "in_progress"}
            />
          );
        })}

        {/* wave links from orchestrator */}
        {IAC_RES.map((r) => (
          <FlowLink key={`l-${r.key}`} d={`M 50 50 C 58 50, 58 ${r.y}, 62 ${r.y}`} status={linkStat(r.key)} dotDuration={1.2} />
        ))}

        {/* DependsOn edges */}
        {showEdges && (
          <>
            <FlowLink d="M 68 20 C 58 26, 58 42, 64 46" status="idle" dashed dot={false} strokeWidth={1} />
            <FlowLink d="M 68 52 C 58 58, 58 74, 64 78" status="idle" dashed dot={false} strokeWidth={1} />
            <FlowLink d="M 91 18 C 80 30, 74 40, 70 46" status="idle" dashed dot={false} strokeWidth={1} />
            <FlowLink d="M 72 82 C 76 88, 84 88, 87 84" status="idle" dashed dot={false} strokeWidth={1} />
          </>
        )}
      </FlowCanvas>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* TAB 03 — CHANGE SETS: preview the diff, then approve execution       */
/* ================================================================== */

interface CsChange {
  key: string;
  action: "ADD" | "MODIFY" | "REPLACE";
  logical: string;
  type: string;
  detail: string;
  x: number;
  y: number;
}

const CS_CHANGES: CsChange[] = [
  { key: "logs", action: "ADD", logical: "LogsBucket", type: "AWS::S3::Bucket", detail: "+ new bucket for access logs", x: 70, y: 15 },
  { key: "table", action: "MODIFY", logical: "OrdersTable", type: "AWS::DynamoDB::Table", detail: "BillingMode → PAY_PER_REQUEST · no interruption", x: 70, y: 37 },
  { key: "fn", action: "MODIFY", logical: "OrderFn", type: "AWS::Lambda::Function", detail: "Memory 512MB → 1024MB · in-place", x: 70, y: 59 },
  { key: "web", action: "REPLACE", logical: "WebServer", type: "AWS::EC2::Instance", detail: "InstanceType t3.micro → t3.large · DELETE + RECREATE", x: 70, y: 81 },
];

const CS_STEP_TEXT = ["DIFFING template v1 → v2", "CHANGE SET CREATED — REVIEW", "REVIEWING ACTIONS", "EXECUTING CHANGE SET", "EXECUTE_COMPLETE"];

const CS_ACTION_CLS: Record<CsChange["action"], string> = {
  ADD: "text-mint border-mint/50 bg-mint/[0.06]",
  MODIFY: "text-aws border-aws/50 bg-aws/[0.06]",
  REPLACE: "text-danger border-danger/60 bg-danger/[0.08]",
};

const CS_DIFF_LINES: { text: string; cls: string }[] = [
  { text: "template v1 → v2", cls: "text-muted-foreground/60" },
  { text: "  OrdersTable:", cls: "text-foreground/60" },
  { text: "-   BillingMode: PROVISIONED", cls: "text-danger" },
  { text: "+   BillingMode: PAY_PER_REQUEST", cls: "text-mint" },
  { text: "  WebServer:", cls: "text-foreground/60" },
  { text: "-   InstanceType: t3.micro", cls: "text-danger" },
  { text: "+   InstanceType: t3.large", cls: "text-mint" },
  { text: "+ LogsBucket:", cls: "text-mint" },
  { text: "+   Type: AWS::S3::Bucket", cls: "text-mint" },
  { text: "+ OrderFn Props:", cls: "text-mint" },
  { text: "+   MemorySize: 1024", cls: "text-mint" },
];

function ChangeSetsUseCase({ immersiveActive, immersiveToggle }: CfnUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [executed, setExecuted] = useState(false);
  const [discarded, setDiscarded] = useState(false);
  const [highlightReplace, setHighlightReplace] = useState(true);
  const [runSeq, setRunSeq] = useState(0);
  const [resState, setResState] = useState<Record<string, ResUi>>(Object.fromEntries(CS_CHANGES.map((c) => [c.key, "pending"])));
  const { lines, push, clear } = useLog();
  const { flash, show } = useFlash();

  const { step, reset: resetStep } = useScenarioRunner(CS_STEP_TEXT.length, running && !executed && !discarded, 1500, (s) => {
    if (s === 1) push("change-set-9f2c created — 4 changes detected (3 no-interruption · 1 REPLACEMENT)", "aws");
    if (s === 2) push("REPLACEMENT flagged: WebServer will be DELETED and RECREATED — ephemeral storage lost", "danger");
  });

  /* execution engine: flip each change to applied, replace one */
  const execIdx = useRef(0);
  const execTicker = useCallback(() => {
    const c = CS_CHANGES[execIdx.current];
    if (!c) return;
    setResState((p) => ({ ...p, [c.key]: c.action === "REPLACE" ? "failed" : "updated" }));
    if (c.action === "REPLACE") {
      push(`DELETE_IN_PROGRESS ${c.type} ${c.logical} (replacement)`, "danger");
      push(`CREATE_IN_PROGRESS ${c.type} ${c.logical} — new instance id i-0f9e…`, "dim");
      push(`CREATE_COMPLETE ${c.type} ${c.logical} — replacement finished`, "mint");
    } else {
      push(`${c.action === "ADD" ? "CREATE" : "UPDATE"}_COMPLETE ${c.type} ${c.logical} — ${c.action.toLowerCase()} applied`, "mint");
    }
    execIdx.current += 1;
    if (execIdx.current >= CS_CHANGES.length) {
      push("EXECUTE_COMPLETE AWS::CloudFormation::Stack — 4 changes applied, 0 failed", "mint");
      show("ok");
      setExecuted(true);
      setRunning(false);
    }
  }, [push, show]);
  useTicker(running && step >= 3 && !executed, execTicker, 700);

  /* announce execution start when the scenario reaches the execution step */
  useEffect(() => {
    if (running && step >= 3 && !executed && !discarded && execIdx.current === 0) {
      push("EXECUTE change-set-9f2c — applying only the changed resources", "aws");
    }
  }, [step, running, executed, discarded, push]);

  const startPreview = useCallback(() => {
    resetStep();
    execIdx.current = 0;
    clear();
    setExecuted(false);
    setDiscarded(false);
    setResState(Object.fromEntries(CS_CHANGES.map((c) => [c.key, "pending"])));
    setRunSeq((v) => v + 1);
    push("reading template v2 — diffing logical ids against deployed stack", "aws");
    setRunning(true);
  }, [clear, push, resetStep]);

  const discard = useCallback(() => {
    if (!running && !executed) return;
    setRunning(false);
    setDiscarded(true);
    resetStep();
    push("DELETE change-set-9f2c — discarded, zero changes applied to the stack", "magenta");
    show("deny");
  }, [executed, push, resetStep, running, show]);

  const reset = useCallback(() => {
    setRunning(false);
    setExecuted(false);
    setDiscarded(false);
    resetStep();
    execIdx.current = 0;
    setResState(Object.fromEntries(CS_CHANGES.map((c) => [c.key, "pending"])));
    setRunSeq(0);
    clear();
  }, [clear, resetStep]);

  const added = CS_CHANGES.filter((c) => c.action === "ADD").length;
  const modified = CS_CHANGES.filter((c) => c.action === "MODIFY").length;
  const replaced = CS_CHANGES.filter((c) => c.action === "REPLACE").length;

  return (
    <UseCaseShell
      title="USE CASE 03 // CHANGE SETS — PREVIEW BEFORE APPLY"
      subtitle="SEE EVERY ADD / MODIFY / REPLACEMENT BEFORE IT TOUCHES PRODUCTION"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      logLines={lines}
      logTitle="CHANGE SET LOG // change-set-9f2c"
      stats={
        <>
          <UCStat label="CHANGES" value={String(CS_CHANGES.length)} tone="aws" />
          <UCStat label="ADDS" value={String(added)} tone="mint" />
          <UCStat label="MODIFIES" value={String(modified)} tone="aws" />
          <UCStat label="REPLACEMENTS" value={String(replaced)} tone={highlightReplace ? "danger" : "neutral"} />
        </>
      }
      controls={
        <>
          <div className="flex flex-wrap gap-2">
            <UCButton onClick={startPreview} disabled={running && !executed && !discarded} ariaLabel="Create change set preview">
              {executed || discarded ? "NEW PREVIEW" : "CREATE PREVIEW"}
            </UCButton>
            <UCButton onClick={discard} tone="danger" disabled={executed || discarded || !running} ariaLabel="Discard change set">
              DISCARD
            </UCButton>
          </div>
          <UCToggle on={highlightReplace} onClick={() => setHighlightReplace((v) => !v)} accent="magenta" ariaLabel="Highlight replacements">
            FLAG REPLACEMENTS
          </UCToggle>
          <p className="text-[8px] leading-relaxed tracking-wider text-muted-foreground uppercase">
            A REPLACEMENT deletes and recreates the resource — data on it is gone. Preview makes that visible BEFORE execution, not after.
          </p>
        </>
      }
    >
      <FlowCanvas ariaLabel="Change set preview and execution" className="h-full">
        <div className="absolute left-3 top-9 z-[6] flex items-center gap-1.5 border border-aws/40 bg-black/70 px-2 py-1 backdrop-blur-sm">
          <CloudFormationIcon className="w-3 h-3 text-aws" />
          <span className="text-[8px] font-bold tracking-[0.2em] text-aws uppercase">DIFF → REVIEW → EXECUTE</span>
        </div>
        <StepBadge step={step} total={CS_STEP_TEXT.length} text={CS_STEP_TEXT[step]} />
        <UseCaseNote>
          DEPLOY BLIND = INCIDENT RETRO. CHANGE SETS TURN DEPLOYS INTO CODE REVIEWS — APPROVE THE DIFF, THEN EXECUTE.
        </UseCaseNote>
        <VerdictFlash show={flash === "ok"} text="EXECUTE_COMPLETE" tone="ok" />
        <VerdictFlash show={flash === "deny"} text="DISCARDED — 0 CHANGES" tone="deny" />

        {/* diff panel — staggered line reveal on every new preview */}
        <div
          key={`diff-${runSeq}`}
          className="absolute left-[2.5%] top-[14%] w-[30%] z-[6] glass-inset cyber-cut-sm p-2 text-[7.5px] leading-[14px] font-bold tracking-wider"
          aria-hidden="true"
        >
          {CS_DIFF_LINES.map((l, i) => (
            <motion.p
              key={`${runSeq}-${i}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.065, duration: 0.28, ease: "easeOut" }}
              className={l.cls}
            >
              {l.text}
            </motion.p>
          ))}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: CS_DIFF_LINES.length * 0.065 + 0.1 }}
            className="text-aws/90"
          >
            {"  → change-set-9f2c ready"}
          </motion.p>
        </div>

        {/* change set core */}
        <div className="absolute z-10 -translate-x-1/2 -translate-y-1/2 w-[27%] min-w-[196px]" style={{ left: "36%", top: "46%" }}>
          <div className={`relative border backdrop-blur-md bg-black/60 p-3 flex flex-col gap-2 cyber-cut ${running ? "border-aws/70 box-glow" : executed ? "border-mint/50" : discarded ? "border-magenta/60" : "border-foreground/25"}`}>
            <div className="flex items-center gap-2">
              <CloudFormationIcon className="w-5 h-5 text-aws shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] font-extrabold tracking-[0.14em] text-aws uppercase truncate">change-set-9f2c</p>
                <p className="text-[7px] tracking-[0.16em] text-muted-foreground uppercase">review before execute</p>
              </div>
            </div>
            <div className={`border px-2 py-1 text-[8px] font-extrabold tracking-[0.14em] text-center ${executed ? "text-mint border-mint/60" : discarded ? "text-magenta border-magenta/60" : running ? "text-aws border-aws/60" : "text-muted-foreground border-foreground/25"}`}>
              {executed ? "EXECUTE_COMPLETE" : discarded ? "DISCARDED" : running ? (step >= 3 ? "EXECUTING" : "REVIEW_IN_PROGRESS") : "AWAITING PREVIEW"}
            </div>
            <p className="text-[7px] tracking-[0.16em] text-muted-foreground uppercase">
              {highlightReplace ? "1 REPLACEMENT FLAGGED IN RED" : "4 CHANGES QUEUED"}
            </p>
          </div>
        </div>

        {/* change rows */}
        {CS_CHANGES.map((c) => {
          const st = resState[c.key];
          const pillCls = STATUS_PILL_CLS[st];
          const isReplace = c.action === "REPLACE";
          const urgent = isReplace && highlightReplace && st === "pending";
          return (
            <motion.div
              key={c.key}
              className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 w-[26%] min-w-[188px] border backdrop-blur-md bg-black/60 p-2 flex flex-col gap-1 cyber-cut-sm ${urgent ? "border-danger/70 shadow-[0_0_18px_rgba(255,51,85,0.35)]" : "border-foreground/20"}`}
              style={{ left: `${c.x}%`, top: `${c.y}%` }}
              animate={urgent ? { scale: [1, 1.03, 1] } : {}}
              transition={{ repeat: Infinity, duration: 1.6 }}
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className={`px-1.5 py-0.5 text-[7.5px] font-extrabold tracking-[0.14em] border ${CS_ACTION_CLS[c.action]}`}>{c.action}</span>
                <span className={`px-1.5 py-0.5 text-[7px] font-bold tracking-[0.12em] border ${executed ? pillCls : "text-muted-foreground border-foreground/20"}`}>{executed ? RES_STATUS[st].label : "QUEUED"}</span>
              </div>
              <p className="text-[8px] font-extrabold tracking-[0.12em] text-foreground/85 uppercase truncate">{c.logical}</p>
              <p className={`text-[7px] leading-snug tracking-wider ${isReplace ? "text-danger" : "text-muted-foreground"}`}>{c.detail}</p>
            </motion.div>
          );
        })}

        {/* links core → rows */}
        {CS_CHANGES.map((c) => (
          <FlowLink
            key={`cs-${c.key}`}
            d={`M 50 46 C 58 46, 58 ${c.y}, 64 ${c.y}`}
            status={executed ? (c.action === "REPLACE" ? "error" : "success") : running ? "flowing" : "idle"}
            dotDuration={1.3}
          />
        ))}
      </FlowCanvas>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* TAB 04 — AUTOMATIC ROLLBACK: fail mid-update, restore last good      */
/* ================================================================== */

interface RbRes {
  key: string;
  logical: string;
  type: string;
  label: string;
  x: number;
  y: number;
}

const RB_RES: RbRes[] = [
  { key: "web", logical: "WebServer", type: "AWS::EC2::Instance", label: "EC2 WEB", x: 70, y: 14 },
  { key: "table", logical: "OrdersTable", type: "AWS::DynamoDB::Table", label: "DYNAMODB", x: 70, y: 37 },
  { key: "fn", logical: "OrderFn", type: "AWS::Lambda::Function", label: "LAMBDA FN", x: 70, y: 60 },
  { key: "policy", logical: "DbPolicy", type: "AWS::IAM::ManagedPolicy", label: "IAM POLICY", x: 70, y: 83 },
];

const RB_FAIL_REASONS: Record<string, string> = {
  web: "launch-template validation error — AMI not found",
  table: "billing mode change requires global-table lock",
  fn: "CreateRole failed — s3 artifact permission denied",
  policy: "policy document exceeds size quota",
};

type RbPhase = "idle" | "updating" | "failed" | "rolling" | "done";

function RollbackUseCase({ immersiveActive, immersiveToggle }: CfnUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [failAt, setFailAt] = useState(2); // 1..4
  const [phase, setPhase] = useState<RbPhase>("idle");
  const [resState, setResState] = useState<Record<string, ResUi>>(Object.fromEntries(RB_RES.map((r) => [r.key, "pending"])));
  const [liveVersion, setLiveVersion] = useState("v1.7.2");
  const [reverted, setReverted] = useState(0);
  const { lines, push, clear } = useLog();
  const { flash, show } = useFlash();

  const idxRef = useRef(0);
  const changedRef = useRef<string[]>([]);
  const revertIdxRef = useRef(0);
  const phaseRef = useRef<RbPhase>("idle");
  const failAtRef = useRef(failAt);
  useEffect(() => {
    failAtRef.current = failAt;
  }, [failAt]);

  const tick = useCallback(() => {
    const ph = phaseRef.current;
    if (ph === "updating") {
      const i = idxRef.current;
      const r = RB_RES[i];
      if (!r) return;
      if (i === failAtRef.current - 1) {
        setResState((p) => ({ ...p, [r.key]: "failed" }));
        push(`UPDATE_FAILED ${r.type} ${r.logical} — ${RB_FAIL_REASONS[r.key]}`, "danger");
        push("UPDATE_ROLLBACK_IN_PROGRESS AWS::CloudFormation::Stack — restoring last known good state", "danger");
        revertIdxRef.current = changedRef.current.length - 1;
        phaseRef.current = "rolling";
        setPhase("rolling");
        show("deny");
        return;
      }
      setResState((p) => ({ ...p, [r.key]: "updated" }));
      changedRef.current.push(r.key);
      push(`UPDATE_COMPLETE ${r.type} ${r.logical} — moved to v1.8.0`, "dim");
      idxRef.current += 1;
      return;
    }
    if (ph === "rolling") {
      const i = revertIdxRef.current;
      if (i < 0) {
        push("UPDATE_ROLLBACK_COMPLETE AWS::CloudFormation::Stack — stack restored to v1.7.2, zero downtime", "mint");
        setLiveVersion("v1.7.2");
        setReverted(changedRef.current.length);
        phaseRef.current = "done";
        setPhase("done");
        setRunning(false);
        show("ok");
        return;
      }
      const key = changedRef.current[i];
      const r = RB_RES.find((x) => x.key === key);
      if (r) {
        setResState((p) => ({ ...p, [key]: "restored" }));
        push(`UPDATE_ROLLBACK_COMPLETE ${r.type} ${r.logical} — reverted to v1.7.2 definition`, "aws");
      }
      revertIdxRef.current -= 1;
      return;
    }
  }, [push, show]);

  useTicker(running, tick, 820);

  const start = useCallback(() => {
    clear();
    idxRef.current = 0;
    changedRef.current = [];
    revertIdxRef.current = 0;
    phaseRef.current = "updating";
    setPhase("updating");
    setResState(Object.fromEntries(RB_RES.map((r) => [r.key, "pending"])));
    setLiveVersion("v1.8.0 (rolling…)");
    setReverted(0);
    push("UPDATE_IN_PROGRESS AWS::CloudFormation::Stack app-stack — target v1.8.0 (4 changed resources)", "aws");
    setRunning(true);
  }, [clear, push]);

  const reset = useCallback(() => {
    setRunning(false);
    phaseRef.current = "idle";
    setPhase("idle");
    idxRef.current = 0;
    changedRef.current = [];
    revertIdxRef.current = 0;
    setResState(Object.fromEntries(RB_RES.map((r) => [r.key, "pending"])));
    setLiveVersion("v1.7.2");
    setReverted(0);
    clear();
  }, [clear]);

  const updatedCount = RB_RES.filter((r) => resState[r.key] === "updated").length;
  const restoredCount = RB_RES.filter((r) => resState[r.key] === "restored").length;

  return (
    <UseCaseShell
      title="USE CASE 04 // AUTOMATIC ROLLBACK — LAST KNOWN GOOD"
      subtitle="A FAILED UPDATE NEVER LEAVES A BROKEN STACK BEHIND"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      logLines={lines}
      logTitle="UPDATE LOG // app-stack v1.8.0 → rollback"
      stats={
        <>
          <UCStat label="LIVE VERSION" value={liveVersion} tone={phase === "done" ? "mint" : "aws"} />
          <UCStat label="MODIFIED" value={String(updatedCount)} tone="aws" />
          <UCStat label="REVERTED" value={String(restoredCount || reverted)} tone={phase === "done" ? "mint" : "neutral"} />
          <UCStat label="DOWNTIME" value="0 SECONDS" tone="mint" />
        </>
      }
      controls={
        <>
          <div className="flex flex-wrap gap-2">
            <UCButton onClick={start} disabled={running || phase === "done"} ariaLabel="Run failing update">
              RUN FAILED UPDATE
            </UCButton>
            <UCButton onClick={reset} tone="neutral" ariaLabel="Reset scenario">
              RESET
            </UCButton>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-[7.5px] font-bold uppercase tracking-[0.2em] text-muted-foreground">INJECT FAILURE AT RESOURCE #{failAt}</p>
            <div className="flex flex-wrap gap-1.5">
              {RB_RES.map((r, i) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setFailAt(i + 1)}
                  aria-pressed={failAt === i + 1}
                  aria-label={`Fail at ${r.label}`}
                  className={`px-2 py-1.5 text-[8px] font-bold uppercase tracking-[0.12em] border transition-colors ${
                    failAt === i + 1 ? "border-danger/70 text-danger bg-danger/10" : "border-foreground/20 text-muted-foreground hover:border-danger/40"
                  }`}
                >
                  {i + 1}·{r.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[8px] leading-relaxed tracking-wider text-muted-foreground uppercase">
            CFN ABORTS AT THE FIRST FAILURE, THEN REVERTS EVERY ALREADY-CHANGED RESOURCE IN REVERSE ORDER — USERS NEVER SEE THE BROKEN VERSION.
          </p>
        </>
      }
    >
      <FlowCanvas ariaLabel="Automatic rollback scenario" className="h-full">
        <div className="absolute left-3 top-2.5 z-[6] flex items-center gap-1.5 border border-aws/40 bg-black/70 px-2 py-1 backdrop-blur-sm">
          <CloudFormationIcon className="w-3 h-3 text-aws" />
          <span className="text-[8px] font-bold tracking-[0.2em] text-aws uppercase">app-stack · v1.7.2 → v1.8.0</span>
        </div>
        <UseCaseNote>
          UPDATE_ROLLBACK_IS_THE_SAFETY_NET: THE STACK EITHER GOES FORWARD OR BACK — NEVER SIDEWAYS.
        </UseCaseNote>
        <VerdictFlash show={flash === "deny"} text="UPDATE_FAILED" tone="deny" />
        <VerdictFlash show={flash === "ok"} text="ROLLBACK COMPLETE · v1.7.2" tone="ok" />

        {/* stack core */}
        <div className="absolute z-10 -translate-x-1/2 -translate-y-1/2 w-[28%] min-w-[200px]" style={{ left: "34%", top: "48%" }}>
          <div className={`relative border backdrop-blur-md bg-black/60 p-3 flex flex-col gap-2 cyber-cut ${phase === "updating" ? "border-aws/70 box-glow" : phase === "rolling" ? "border-danger/70" : phase === "done" ? "border-mint/50" : "border-foreground/25"}`}>
            <div className="flex items-center gap-2">
              <CloudFormationIcon className="w-5 h-5 text-aws shrink-0" />
              <p className="text-[9px] font-extrabold tracking-[0.16em] text-aws uppercase">app-stack</p>
            </div>
            <div className={`border px-2 py-1 text-[8px] font-extrabold tracking-[0.14em] text-center ${
              phase === "done" ? "text-mint border-mint/60" : phase === "rolling" || phase === "failed" ? "text-danger border-danger/60" : phase === "updating" ? "text-aws border-aws/60" : "text-muted-foreground border-foreground/25"
            }`}>
              {phase === "idle" ? "STABLE v1.7.2" : phase === "updating" ? "UPDATE_IN_PROGRESS" : phase === "rolling" ? "UPDATE_ROLLBACK_IN_PROGRESS" : "UPDATE_ROLLBACK_COMPLETE"}
            </div>
            <div className="h-1.5 w-full bg-black/60 border border-foreground/15 overflow-hidden">
              <motion.div
                className={`h-full ${phase === "rolling" ? "bg-danger" : phase === "done" ? "bg-mint" : "bg-aws"}`}
                animate={{ width: phase === "done" ? "100%" : `${(updatedCount / RB_RES.length) * 100}%` }}
                transition={{ type: "spring", stiffness: 90, damping: 20 }}
              />
            </div>
            <p className="text-[7px] tracking-[0.16em] text-muted-foreground uppercase">production traffic: NEVER interrupted</p>
          </div>
        </div>

        <FlowLabel x={34} y={22} tone="aws">UPDATE v1.8.0</FlowLabel>

        {RB_RES.map((r, i) => {
          const st = resState[r.key];
          const s = RES_STATUS[st];
          const failHere = failAt === i + 1 && phase === "idle";
          return (
            <div key={r.key} className="contents">
              <AnimatePresence>
                {failHere && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.6, x: "-50%", y: "-50%" }}
                    animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
                    exit={{ opacity: 0, scale: 0.6, x: "-50%", y: "-50%" }}
                    transition={{ type: "spring", stiffness: 320, damping: 18 }}
                    className="absolute z-[7] px-1.5 py-0.5 text-[7px] sm:text-[8px] uppercase tracking-[0.18em] border border-danger/40 bg-black/70 backdrop-blur-sm font-bold text-danger whitespace-nowrap"
                    style={{ left: `${r.x - 13}%`, top: `${r.y}%` }}
                  >
                    FAILS HERE
                  </motion.div>
                )}
              </AnimatePresence>
              <FlowNode x={r.x} y={r.y} size="sm" label={r.label} sub={`${r.logical} · ${s.label}`} status={s.status} pulse={st === "in_progress"} />
            </div>
          );
        })}

        {RB_RES.map((r) => (
          <FlowLink
            key={`rb-${r.key}`}
            d={`M 48 48 C 56 48, 58 ${r.y}, 63 ${r.y}`}
            status={resState[r.key] === "failed" ? "error" : resState[r.key] === "pending" ? "idle" : "success"}
            dotDuration={1.2}
          />
        ))}
      </FlowCanvas>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* TAB 05 — DRIFT DETECTION: out-of-band changes, revert or adopt       */
/* ================================================================== */

interface DrRes {
  key: string;
  logical: string;
  type: string;
  label: string;
  x: number;
  y: number;
  reason: string;
}

const DR_RES: DrRes[] = [
  { key: "ec2", logical: "WebServer", type: "AWS::EC2::Instance", label: "EC2 WEB", x: 70, y: 14, reason: "instance stopped from the console (template says RUNNING)" },
  { key: "sg", logical: "SgWeb", type: "AWS::EC2::SecurityGroup", label: "SG RULES", x: 70, y: 37, reason: "tcp/22 opened to 0.0.0.0/0 via console" },
  { key: "bucket", logical: "Artifacts", type: "AWS::S3::Bucket", label: "S3 BUCKET", x: 70, y: 60, reason: "bucket policy deleted manually" },
  { key: "fn", logical: "OrderFn", type: "AWS::Lambda::Function", label: "LAMBDA FN", x: 70, y: 83, reason: "environment variable edited out-of-band" },
];

type DrStatus = "sync" | "checking" | "drifted" | "resolved";

function DriftUseCase({ immersiveActive, immersiveToggle }: CfnUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<Record<string, DrStatus>>(Object.fromEntries(DR_RES.map((r) => [r.key, "sync"])));
  const [scanDone, setScanDone] = useState(false);
  const [resolution, setResolution] = useState<"NONE" | "REVERTED" | "ADOPTED">("NONE");
  const [lastScan, setLastScan] = useState("--:--:--");
  const { lines, push, clear } = useLog();
  const { flash, show } = useFlash();

  const scanIdx = useRef(0);
  const driftedKeysRef = useRef<string[]>([]);
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const scanTick = useCallback(() => {
    const r = DR_RES[scanIdx.current];
    if (!r) {
      setRunning(false);
      setScanDone(true);
      const n = driftedKeysRef.current.length;
      push(`DRIFT DETECTION COMPLETE — ${n} drifted · ${DR_RES.length - n} in sync`, n > 0 ? "magenta" : "mint");
      if (n > 0) show("aws");
      return;
    }
    const isDrifted = driftedKeysRef.current.includes(r.key);
    setStatus((p) => ({ ...p, [r.key]: isDrifted ? "drifted" : "sync" }));
    if (isDrifted) push(`${r.logical}: DRIFTED — ${r.reason}`, "magenta");
    else push(`${r.logical}: IN_SYNC — matches template definition`, "mint");
    scanIdx.current += 1;
  }, [push, show]);
  useTicker(running, scanTick, 620);

  const causeDrift = useCallback(
    (k: string) => {
      const r = DR_RES.find((x) => x.key === k);
      if (!r) return;
      driftedKeysRef.current = Array.from(new Set([...driftedKeysRef.current, k]));
      setStatus((p) => ({ ...p, [k]: "drifted" }));
      setScanDone(false);
      setResolution("NONE");
      push(`CONSOLE (out-of-band): ${r.reason} — template no longer matches reality`, "magenta");
    },
    [push]
  );

  const detect = useCallback(() => {
    if (running) return;
    scanIdx.current = 0;
    setStatus(Object.fromEntries(DR_RES.map((r) => [r.key, "checking"])));
    setScanDone(false);
    setResolution("NONE");
    setLastScan(new Date().toLocaleTimeString("en-GB", { hour12: false }));
    push("drift detection started — polling every resource against the template", "aws");
    setRunning(true);
  }, [push, running]);

  const revert = useCallback(() => {
    if (!scanDone) return;
    setStatus((p) => {
      const n = { ...p };
      driftedKeysRef.current.forEach((k) => (n[k] = "resolved"));
      return n;
    });
    driftedKeysRef.current.forEach((k) => {
      const r = DR_RES.find((x) => x.key === k);
      if (r) push(`REVERT ${r.type} ${r.logical} — template state re-applied, manual change erased`, "mint");
    });
    setResolution("REVERTED");
    push("stack is IN SYNC again — CloudFormation is the single source of truth", "mint");
    show("ok");
  }, [push, scanDone, show]);

  const adopt = useCallback(() => {
    if (!scanDone) return;
    setStatus((p) => {
      const n = { ...p };
      driftedKeysRef.current.forEach((k) => (n[k] = "resolved"));
      return n;
    });
    driftedKeysRef.current.forEach((k) => {
      const r = DR_RES.find((x) => x.key === k);
      if (r) push(`ADOPT ${r.type} ${r.logical} — resource state copied into template v1.7.3, drift cleared`, "aws");
    });
    setResolution("ADOPTED");
    show("aws");
  }, [push, scanDone, show]);

  const reset = useCallback(() => {
    setRunning(false);
    scanIdx.current = 0;
    driftedKeysRef.current = [];
    setStatus(Object.fromEntries(DR_RES.map((r) => [r.key, "sync"])));
    setScanDone(false);
    setResolution("NONE");
    setLastScan("--:--:--");
    clear();
  }, [clear]);

  const driftedN = DR_RES.filter((r) => status[r.key] === "drifted").length;
  const syncN = DR_RES.filter((r) => status[r.key] === "sync" || status[r.key] === "resolved").length;

  return (
    <UseCaseShell
      title="USE CASE 05 // DRIFT DETECTION & RESOLUTION"
      subtitle="CONSOLE EDITS HAPPEN — DETECT THEM, THEN REVERT OR ADOPT"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      logLines={lines}
      logTitle="DRIFT LOG // detection timeline"
      stats={
        <>
          <UCStat label="IN SYNC" value={`${syncN}/${DR_RES.length}`} tone={driftedN === 0 ? "mint" : "neutral"} />
          <UCStat label="DRIFTED" value={String(driftedN)} tone={driftedN > 0 ? "magenta" : "mint"} />
          <UCStat label="RESOLUTION" value={resolution} tone={resolution === "NONE" ? "neutral" : "mint"} />
          <UCStat label="LAST SCAN" value={lastScan} tone="aws" />
        </>
      }
      controls={
        <>
          <div className="flex flex-wrap gap-2">
            <UCButton onClick={detect} disabled={running} ariaLabel="Run drift detection">
              RUN DETECTION
            </UCButton>
            <UCButton onClick={reset} tone="neutral" ariaLabel="Reset scenario">
              RESET
            </UCButton>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-[7.5px] font-bold uppercase tracking-[0.2em] text-muted-foreground">SIMULATE CONSOLE EDITS</p>
            <div className="flex flex-wrap gap-1.5">
              <UCButton tone="danger" onClick={() => causeDrift("ec2")} ariaLabel="Stop EC2 instance manually">
                STOP EC2
              </UCButton>
              <UCButton tone="danger" onClick={() => causeDrift("sg")} ariaLabel="Open port 22 manually">
                OPEN SSH :22
              </UCButton>
              <UCButton tone="danger" onClick={() => causeDrift("bucket")} ariaLabel="Delete bucket policy manually">
                DELETE POLICY
              </UCButton>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <UCButton tone="mint" onClick={revert} disabled={!scanDone || driftedN === 0 || resolution !== "NONE"} ariaLabel="Revert drift to template state">
              REVERT (CFN WINS)
            </UCButton>
            <UCButton onClick={adopt} disabled={!scanDone || driftedN === 0 || resolution !== "NONE"} ariaLabel="Adopt drift into template">
              ADOPT (UPDATE TEMPLATE)
            </UCButton>
          </div>
          <p className="text-[8px] leading-relaxed tracking-wider text-muted-foreground uppercase">
            SECURITY TEAMS REVERT (CONSOLE EDIT = POLICY VIOLATION). EVOLVING TEAMS ADOPT (THE EDIT WAS RIGHT, THE TEMPLATE WAS STALE).
          </p>
        </>
      }
    >
      <FlowCanvas ariaLabel="Drift detection and resolution" className="h-full">
        <div className="absolute left-3 top-2.5 z-[6] flex items-center gap-1.5 border border-aws/40 bg-black/70 px-2 py-1 backdrop-blur-sm">
          <CloudFormationIcon className="w-3 h-3 text-aws" />
          <span className="text-[8px] font-bold tracking-[0.2em] text-aws uppercase">TEMPLATE TRUTH vs LIVE STATE</span>
        </div>
        <UseCaseNote>
          DRIFT = SOMEONE EDITED THE CLOUD WITHOUT EDITING THE CODE. DETECTION MAKES IT VISIBLE IN MINUTES, NOT AT THE NEXT DEPLOY.
        </UseCaseNote>
        <VerdictFlash show={flash === "ok"} text="STACK IN SYNC" tone="ok" />
        <VerdictFlash show={flash === "aws"} text="DRIFT DETECTED" tone="aws" />

        {/* scan sweep — a radar line riding the canvas while detection runs */}
        {running && (
          <>
            <motion.div
              className="absolute left-0 right-0 z-[7] h-[2px] bg-magenta shadow-[0_0_14px_rgba(255,45,120,0.65)] pointer-events-none"
              initial={{ top: "4%", opacity: 0 }}
              animate={{ top: ["4%", "94%"], opacity: [0, 1, 1, 0] }}
              transition={{ repeat: Infinity, duration: 2.4, ease: "linear" }}
              aria-hidden="true"
            />
            <motion.div
              className="absolute right-3 z-[7] border border-magenta/40 bg-black/70 px-1.5 py-0.5 text-[7px] font-bold tracking-[0.2em] text-magenta uppercase pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.35, 1, 0.35] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
              style={{ top: "12%" }}
              aria-hidden="true"
            >
              SCANNING RESOURCES…
            </motion.div>
          </>
        )}

        {/* truth core */}
        <div className="absolute z-10 -translate-x-1/2 -translate-y-1/2 w-[28%] min-w-[200px]" style={{ left: "34%", top: "48%" }}>
          <div className={`relative border backdrop-blur-md bg-black/60 p-3 flex flex-col gap-2 cyber-cut ${driftedN > 0 ? "border-magenta/70" : "border-mint/50"}`}>
            <div className="flex items-center gap-2">
              <CloudFormationIcon className="w-5 h-5 text-aws shrink-0" />
              <p className="text-[9px] font-extrabold tracking-[0.16em] text-aws uppercase">app-stack</p>
            </div>
            <div className={`border px-2 py-1 text-[8px] font-extrabold tracking-[0.14em] text-center ${driftedN > 0 ? "text-magenta border-magenta/60" : "text-mint border-mint/60"}`}>
              {driftedN > 0 ? `DRIFTED · ${driftedN} RESOURCE${driftedN > 1 ? "S" : ""}` : "IN_SYNC"}
            </div>
            <div className="flex items-center justify-between text-[7px] tracking-[0.16em] text-muted-foreground uppercase">
              <span>template v1.7.2</span>
              <span>{resolution !== "NONE" ? resolution : "—"}</span>
            </div>
          </div>
        </div>

        {DR_RES.map((r) => {
          const st = status[r.key];
          const nodeStatus: NodeStatus = st === "drifted" ? "cyber" : st === "checking" ? "active" : st === "resolved" ? "success" : "success";
          const label =
            st === "drifted" ? "DRIFTED" : st === "checking" ? "CHECKING…" : st === "resolved" ? (resolution === "ADOPTED" ? "ADOPTED" : "REVERTED") : "IN_SYNC";
          return (
            <div key={r.key}>
              <FlowNode x={r.x} y={r.y} size="sm" label={r.label} sub={`${r.logical} · ${label}`} status={nodeStatus} pulse={st === "checking"} />
              <AnimatePresence>
                {st === "drifted" && (
                  <motion.div
                    initial={{ opacity: 0, y: -5, x: "-50%" }}
                    animate={{ opacity: 1, y: 0, x: "-50%" }}
                    exit={{ opacity: 0, y: -5, x: "-50%" }}
                    transition={{ duration: 0.22 }}
                    className="absolute z-[7] border border-magenta/50 bg-black/80 px-1.5 py-0.5 text-[6.5px] font-bold tracking-wider text-magenta uppercase whitespace-nowrap"
                    style={{ left: `${r.x}%`, top: `${r.y + 6.5}%` }}
                  >
                    {r.reason}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {DR_RES.map((r) => (
          <FlowLink
            key={`dr-${r.key}`}
            d={`M 48 48 C 56 48, 58 ${r.y}, 63 ${r.y}`}
            status={status[r.key] === "drifted" ? "cyber" : status[r.key] === "checking" ? "flowing" : "success"}
            dotDuration={1.2}
          />
        ))}
      </FlowCanvas>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* TAB 06 — STACKSETS: one template → every account × region            */
/* ================================================================== */

interface Acct {
  id: string;
  name: string;
}

const SS_ACCTS: Acct[] = [
  { id: "111122223333", name: "AUDIT" },
  { id: "444455556666", name: "PROD" },
  { id: "777788889999", name: "SANDBOX" },
];

const SS_REGIONS = ["US-EAST-1", "EU-WEST-1"];

type SsCellState = "pending" | "creating" | "created" | "failed" | "stopped";

function StackSetsUseCase({ immersiveActive, immersiveToggle }: CfnUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [cells, setCells] = useState<Record<string, SsCellState>>(
    Object.fromEntries(SS_REGIONS.flatMap((_, ri) => SS_ACCTS.map((a, ai) => [`${ri}-${ai}`, "pending" as SsCellState])))
  );
  const [failInject, setFailInject] = useState(false);
  const [tolerance, setTolerance] = useState<"STOP" | "CONTINUE">("STOP");
  const [done, setDone] = useState<null | "COMPLETE" | "STOPPED">(null);
  const { lines, push, clear } = useLog();
  const { flash, show } = useFlash();

  const waveRef = useRef(0); // region wave 0/1
  const subRef = useRef(0);
  const failRef = useRef(false);
  const tolRef = useRef<"STOP" | "CONTINUE">("STOP");
  useEffect(() => {
    failRef.current = failInject;
    tolRef.current = tolerance;
  }, [failInject, tolerance]);

  /* failure target: region 1 (eu-west-1), account 2 (SANDBOX) */
  const FAIL_CELL = "1-2";

  const tick = useCallback(() => {
    if (subRef.current === 0) {
      const wave = SS_ACCTS.map((_a, ai) => `${waveRef.current}-${ai}`);
      setCells((p) => {
        const n = { ...p };
        wave.forEach((k) => (n[k] = "creating"));
        return n;
      });
      push(`region ${SS_REGIONS[waveRef.current]} — deploying to ${SS_ACCTS.length} accounts concurrently`, "aws");
      subRef.current = 1;
      return;
    }
    const wave = SS_ACCTS.map((_a, ai) => `${waveRef.current}-${ai}`);
    const failedCell = failRef.current && wave.includes(FAIL_CELL);
    setCells((p) => {
      const n = { ...p };
      wave.forEach((k) => {
        n[k] = k === FAIL_CELL && failRef.current ? "failed" : "created";
      });
      return n;
    });
    wave.forEach((k, i) => {
      if (k === FAIL_CELL && failRef.current) {
        push(`CREATE_FAILED account ${SS_ACCTS[i].id} (${SS_ACCTS[i].name}) — ${SS_REGIONS[waveRef.current]}: AccessDenied on trusted access`, "danger");
      } else {
        push(`CREATE_COMPLETE stack instance → account ${SS_ACCTS[i].id} (${SS_ACCTS[i].name}) · ${SS_REGIONS[waveRef.current]}`, "mint");
      }
    });
    if (failedCell && tolRef.current === "STOP") {
      /* stop: remaining regions cancelled */
      const remaining = SS_REGIONS.slice(waveRef.current + 1).flatMap((_r, off) => SS_ACCTS.map((_a, ai) => `${waveRef.current + 1 + off}-${ai}`));
      setCells((p) => {
        const n = { ...p };
        remaining.forEach((k) => (n[k] = "stopped"));
        return n;
      });
      push(`FAILURE TOLERANCE = STOP — deployment halted, ${remaining.length} stack instances not attempted`, "danger");
      setDone("STOPPED");
      show("deny");
      setRunning(false);
      return;
    }
    if (waveRef.current === SS_REGIONS.length - 1) {
      push(failRef.current ? "CONTINUE tolerance — failed instance skipped, org rollout finished" : "ALL STACK INSTANCES CREATED — org baseline live everywhere", "mint");
      setDone("COMPLETE");
      show("ok");
      setRunning(false);
      return;
    }
    waveRef.current += 1;
    subRef.current = 0;
  }, [push, show]);
  useTicker(running, tick, 900);

  const deploy = useCallback(() => {
    clear();
    waveRef.current = 0;
    subRef.current = 0;
    setCells(Object.fromEntries(SS_REGIONS.flatMap((_, ri) => SS_ACCTS.map((a, ai) => [`${ri}-${ai}`, "pending" as SsCellState]))));
    setDone(null);
    push(`CREATE_STACKINSTANCES audit-baseline — ${SS_ACCTS.length} accounts × ${SS_REGIONS.length} regions`, "aws");
    setRunning(true);
  }, [clear, push]);

  const reset = useCallback(() => {
    setRunning(false);
    waveRef.current = 0;
    subRef.current = 0;
    setCells(Object.fromEntries(SS_REGIONS.flatMap((_, ri) => SS_ACCTS.map((a, ai) => [`${ri}-${ai}`, "pending" as SsCellState]))));
    setDone(null);
    clear();
  }, [clear]);

  const created = Object.values(cells).filter((v) => v === "created").length;
  const failedN = Object.values(cells).filter((v) => v === "failed").length;
  const stoppedN = Object.values(cells).filter((v) => v === "stopped").length;

  /* per-region connector state for the core → column links */
  const waveState = (ri: number): "idle" | "flowing" | "success" | "error" => {
    const states = SS_ACCTS.map((_a, ai) => cells[`${ri}-${ai}`]);
    if (states.every((s) => s === "created")) return "success";
    if (states.some((s) => s === "failed" || s === "stopped")) return "error";
    if (running && states.some((s) => s === "creating")) return "flowing";
    return "idle";
  };

  return (
    <UseCaseShell
      title="USE CASE 06 // STACKSETS — ORG-WIDE ROLLOUT"
      subtitle="ONE TEMPLATE → EVERY ACCOUNT × EVERY REGION, GOVERNED"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      logLines={lines}
      logTitle="STACKSET LOG // audit-baseline"
      stats={
        <>
          <UCStat label="INSTANCES" value={`${created}/6`} tone={done ? "mint" : "aws"} />
          <UCStat label="FAILED" value={String(failedN)} tone={failedN ? "danger" : "mint"} />
          <UCStat label="TOLERANCE" value={tolerance} tone={tolerance === "STOP" ? "danger" : "aws"} />
          <UCStat label="COVERAGE" value={`${SS_ACCTS.length} ACCT × ${SS_REGIONS.length} REG`} tone="magenta" />
        </>
      }
      controls={
        <>
          <div className="flex flex-wrap gap-2">
            <UCButton onClick={deploy} disabled={running} ariaLabel="Deploy stackset everywhere">
              DEPLOY ALL
            </UCButton>
            <UCButton onClick={reset} tone="neutral" ariaLabel="Reset rollout">
              RESET
            </UCButton>
          </div>
          <div className="flex flex-wrap gap-2">
            <UCToggle on={failInject} onClick={() => setFailInject((v) => !v)} accent="magenta" ariaLabel="Toggle failure injection">
              FAIL SANDBOX·EU
            </UCToggle>
            <UCToggle on={tolerance === "STOP"} onClick={() => setTolerance((v) => (v === "STOP" ? "CONTINUE" : "STOP"))} ariaLabel="Toggle failure tolerance">
              TOLERANCE: {tolerance}
            </UCToggle>
          </div>
          <p className="text-[8px] leading-relaxed tracking-wider text-muted-foreground uppercase">
            STOP = STRICT COMPLIANCE (NO ACCOUNT LEFT HALF-DEPLOYED). CONTINUE = SPEED (SKIP THE BROKEN ACCOUNT, FINISH THE ROLLOUT).
          </p>
        </>
      }
    >
      <div className="relative h-full w-full bg-black/40 border border-aws/12 bg-cyber-grid-fine overflow-hidden" role="img" aria-label="StackSets org rollout grid">
        <span className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-aws/60" aria-hidden="true" />
        <span className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-aws/60" aria-hidden="true" />
        <span className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l border-aws/60" aria-hidden="true" />
        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-aws/60" aria-hidden="true" />

        <div className="absolute left-3 top-2.5 z-[6] flex items-center gap-1.5 border border-aws/40 bg-black/70 px-2 py-1 backdrop-blur-sm">
          <CloudFormationIcon className="w-3 h-3 text-aws" />
          <span className="text-[8px] font-bold tracking-[0.2em] text-aws uppercase">STACKSET: audit-baseline</span>
        </div>
        <UseCaseNote>
          COMPLIANCE BASELINES, LOGGING, GUARDRAILS — ONE TEMPLATE ENFORCED IN EVERY ACCOUNT BY THE ORG, NOT BY 40 CONSOLE SESSIONS.
        </UseCaseNote>
        <VerdictFlash show={flash === "ok"} text="6/6 STACK INSTANCES LIVE" tone="ok" />
        <VerdictFlash show={flash === "deny"} text="ROLLOUT STOPPED — TOLERANCE" tone="deny" />

        {/* stackset core */}
        <div className="absolute left-1/2 top-[19%] -translate-x-1/2 z-10 w-[46%] min-w-[230px]">
          <div className={`relative border backdrop-blur-md bg-black/60 p-2.5 flex items-center gap-2 cyber-cut ${running ? "border-aws/70 box-glow" : done ? "border-mint/50" : "border-foreground/25"}`}>
            <CloudFormationIcon className="w-5 h-5 text-aws shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-extrabold tracking-[0.14em] text-aws uppercase truncate">audit-baseline</p>
              <p className="text-[7px] tracking-[0.14em] text-muted-foreground uppercase">stackset · org master account</p>
            </div>
            <div className={`px-1.5 py-1 text-[7.5px] font-extrabold tracking-[0.12em] border ${done ? (done === "COMPLETE" ? "text-mint border-mint/60" : "text-danger border-danger/60") : running ? "text-aws border-aws/60" : "text-muted-foreground border-foreground/25"}`}>
              {done ?? (running ? "RUNNING" : "IDLE")}
            </div>
          </div>
        </div>

        {/* rollout connectors — core fans out to each region column */}
        <div className="absolute inset-0 z-[4] pointer-events-none" aria-hidden="true">
          <FlowLink d="M 50 22 C 43 25, 35 27, 28 31" status={waveState(0)} dotDuration={1.1} />
          <FlowLink d="M 50 22 C 57 25, 65 27, 72 31" status={waveState(1)} dotDuration={1.1} dotDelay={0.35} />
        </div>

        {/* org grid: 2 region columns × 3 account rows */}
        <div className="absolute inset-x-[6%] top-[32%] bottom-[8%] grid grid-cols-2 gap-3 z-[5]">
          {SS_REGIONS.map((reg, ri) => (
            <div key={reg} className="border border-dashed border-foreground/20 bg-white/[0.02] p-2 flex flex-col gap-2">
              <p className="text-[8px] font-extrabold tracking-[0.2em] text-aws uppercase">{reg}</p>
              {SS_ACCTS.map((a, ai) => {
                const st = cells[`${ri}-${ai}`];
                const cls =
                  st === "created"
                    ? "border-mint/60 text-mint"
                    : st === "creating"
                      ? "border-aws/70 text-aws box-glow"
                      : st === "failed"
                        ? "border-danger/70 text-danger"
                        : st === "stopped"
                          ? "border-danger/40 text-danger/70"
                          : "border-foreground/20 text-muted-foreground";
                return (
                  <motion.div
                    key={a.id}
                    animate={st === "creating" ? { scale: [1, 1.02, 1] } : {}}
                    transition={{ repeat: st === "creating" ? Infinity : 0, duration: 0.9 }}
                    className={`flex-1 border bg-black/50 px-2 py-1.5 flex flex-col justify-center gap-0.5 ${cls}`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[8px] font-extrabold tracking-[0.14em] uppercase truncate">{a.name}</span>
                      <span className="text-[7px] tabular-nums opacity-70">{a.id}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {st === "created" && <Check className="w-2.5 h-2.5" aria-hidden="true" />}
                      {(st === "failed" || st === "stopped") && <X className="w-2.5 h-2.5" aria-hidden="true" />}
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                          key={st}
                          initial={{ opacity: 0, y: 3 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -3 }}
                          transition={{ duration: 0.16 }}
                          className="text-[7px] font-bold tracking-[0.16em] uppercase"
                        >
                          {st === "pending" ? "PENDING" : st === "creating" ? "CREATE_IN_PROGRESS" : st === "created" ? "STACK INSTANCE LIVE" : st === "failed" ? "CREATE_FAILED" : "NOT ATTEMPTED"}
                        </motion.span>
                      </AnimatePresence>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* ROUTER                                                              */
/* ================================================================== */

export function CfnUseCases({ id, immersiveActive, immersiveToggle }: CfnUseCasesProps) {
  if (id === "IAC") return <IacUseCase immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
  if (id === "CHANGE_SETS") return <ChangeSetsUseCase immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
  if (id === "ROLLBACK") return <RollbackUseCase immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
  if (id === "DRIFT") return <DriftUseCase immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
  return <StackSetsUseCase immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
}
