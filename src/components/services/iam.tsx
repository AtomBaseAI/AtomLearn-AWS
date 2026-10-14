"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassPanel } from "@/components/shared/glass-panel";
import { FlowCanvas, FlowNode, FlowLink, FlowLabel } from "@/components/shared/flow";
import { Callout } from "@/components/shared/callout";
import { SimControls } from "@/components/shared/sim-controls";
import { StatChip } from "@/components/shared/typography";
import { AutoLog, logTs } from "@/components/shared/auto-log";
import { FullscreenToggle } from "@/components/shared/fullscreen-toggle";
import { UseCaseTabs, type UcTabDef } from "@/components/shared/use-case";
import { IamUseCases } from "./iam-usecases";
import { useImmersiveView } from "@/hooks/use-immersive";
import { IAMIcon, UserIcon, LambdaIcon, AccountIcon } from "@/components/aws-icons";
import { KeyRound, ScanSearch, Building2, Users, Zap } from "lucide-react";

/* ------------------------------------------------------------------ */
/* IAM — LIVE POLICY EVALUATION ENGINE                                  */
/* ------------------------------------------------------------------ */

type PrincipalId = "root" | "alice" | "role";
type Badge = "pending" | "allow" | "deny" | "skip" | "halt";
type ActionId = "s3:GetObject" | "iam:DeleteUser";

interface PolicyCard {
  id: string;
  name: string;
  note: string;
  effect: "Allow" | "Deny";
  actions: string[]; // "*" matches everything
}

interface PrincipalMeta {
  label: string;
  sub: string;
  kind: string;
  policies: PolicyCard[];
}

const MFA_GUARD: PolicyCard = {
  id: "mfa",
  name: "MFA-GUARD",
  note: "DENY s3:* UNLESS MFA",
  effect: "Deny",
  actions: ["s3:GetObject"],
};
const IAM_PROTECT: PolicyCard = {
  id: "iamprot",
  name: "IAM-PROTECT",
  note: "DENY iam:DeleteUser",
  effect: "Deny",
  actions: ["iam:DeleteUser"],
};
const EC2_FULL: PolicyCard = {
  id: "ec2",
  name: "EC2-FULL",
  note: "ALLOW ec2:*",
  effect: "Allow",
  actions: [],
};
const DEV_BASE: PolicyCard = {
  id: "base",
  name: "DEV-BASE",
  note: "ALLOW s3:List*",
  effect: "Allow",
  actions: [],
};

const PRINCIPALS: Record<PrincipalId, PrincipalMeta> = {
  root: {
    label: "ROOT USER",
    sub: "ACCOUNT OWNER",
    kind: "ROOT",
    policies: [
      { id: "admin", name: "ADMIN-ACCESS", note: "ALLOW * (ROOT)", effect: "Allow", actions: ["*"] },
      MFA_GUARD,
      EC2_FULL,
      IAM_PROTECT,
      DEV_BASE,
    ],
  },
  alice: {
    label: "USER ALICE",
    sub: "USER // DEV-GROUP",
    kind: "IAM USER",
    policies: [
      { id: "s3ro", name: "S3-READONLY", note: "ALLOW s3:Get*", effect: "Allow", actions: ["s3:GetObject"] },
      MFA_GUARD,
      EC2_FULL,
      IAM_PROTECT,
      DEV_BASE,
    ],
  },
  role: {
    label: "APP-LAMBDA-ROLE",
    sub: "ROLE // TEMP CREDS",
    kind: "ROLE",
    policies: [
      { id: "ls3", name: "LAMBDA-S3-READ", note: "ALLOW s3:GetObject", effect: "Allow", actions: ["s3:GetObject"] },
      { id: "logs", name: "CW-LOGS", note: "ALLOW logs:*", effect: "Allow", actions: [] },
      MFA_GUARD,
      IAM_PROTECT,
      EC2_FULL,
    ],
  },
};

const PRINCIPAL_IDS: PrincipalId[] = ["root", "alice", "role"];
const ACTIONS: ActionId[] = ["s3:GetObject", "iam:DeleteUser"];

const PENDING_RESULTS: Badge[] = ["pending", "pending", "pending", "pending", "pending"];

const BADGE_TEXT: Record<Badge, string> = {
  pending: "· · ·",
  allow: "ALLOW",
  deny: "DENY",
  skip: "SKIP",
  halt: "HALT",
};
const BADGE_CLS: Record<Badge, string> = {
  pending: "border-foreground/15 text-foreground/30",
  allow: "border-mint/60 bg-mint/15 text-mint",
  deny: "border-danger/60 bg-danger/15 text-danger",
  skip: "border-foreground/20 text-muted-foreground/70",
  halt: "border-magenta/50 bg-magenta/10 text-magenta",
};

function evaluateCard(card: PolicyCard, act: ActionId, mfa: boolean): { badge: Badge; line: string } {
  const match = card.actions.includes("*") || card.actions.includes(act);
  if (card.id === "mfa") {
    if (!match) return { badge: "skip", line: `> ${card.name} ... not applicable to ${act} — SKIP` };
    if (mfa) return { badge: "skip", line: `> ${card.name} ... MFA present — condition satisfied — SKIP` };
    return { badge: "deny", line: `> ${card.name} ... no MFA in session context — EXPLICIT DENY` };
  }
  if (!match) return { badge: "skip", line: `> ${card.name} ... not applicable to ${act} — SKIP` };
  if (card.effect === "Deny") return { badge: "deny", line: `> ${card.name} ... matches ${act} — EXPLICIT DENY` };
  return { badge: "allow", line: `> ${card.name} ... ${card.note} — ALLOW matched` };
}

/* tone keys for the shared AutoLog (classes preserved from the legacy renderer) */
const TRACE_TONES: Record<string, string> = {
  danger: "text-danger",
  mint: "text-mint",
  skip: "text-muted-foreground/70",
  plain: "text-foreground/70",
};

function logTone(line: string): string {
  if (line.includes("EXPLICIT DENY") || line.includes("DENIED")) return "danger";
  if (line.includes("GRANTED") || line.includes("ALLOW matched")) return "mint";
  if (line.includes("SKIP") || line.includes("HALT")) return "skip";
  return "plain";
}

const armedLine = () => `[${logTs()}] > policy engine armed — press RUN or EVALUATE`;

interface EvalRequest {
  principal: PrincipalId;
  action: ActionId;
  mfa: boolean;
}

const MAX_LOG = 60;

const IAM_TABS = [
  { id: "GENERAL", label: "GENERAL", num: "01", icon: Users },
  { id: "FEDERATION", label: "FEDERATED ACCESS", num: "02", icon: KeyRound },
  { id: "LEAST_PRIV", label: "LEAST PRIVILEGE", num: "03", icon: ScanSearch },
  { id: "CROSS_ACCOUNT", label: "CROSS-ACCOUNT ROLE", num: "04", icon: Building2 },
] as const satisfies readonly UcTabDef[];

type IamTabId = (typeof IAM_TABS)[number]["id"];

export default function IAMVisualizer() {
  const immersive = useImmersiveView();
  const [tab, setTab] = useState<IamTabId>("GENERAL");
  const [principal, setPrincipal] = useState<PrincipalId>("alice");
  const [mfa, setMfa] = useState(true);
  const [action, setAction] = useState<ActionId>("s3:GetObject");
  const [running, setRunning] = useState(false);

  const [step, setStep] = useState(0);
  const [results, setResults] = useState<Badge[]>(PENDING_RESULTS);
  const [verdict, setVerdict] = useState<"ALLOW" | "DENY" | null>(null);
  const [reason, setReason] = useState("STANDBY");
  const [log, setLog] = useState<string[]>(() => [armedLine()]);
  const [evaluated, setEvaluated] = useState(0);
  const [runId, setRunId] = useState(0);
  const [request, setRequest] = useState<EvalRequest | null>(null);

  // refs-as-truth: interval mutates refs, flush once per tick
  const principalRef = useRef<PrincipalId>("alice");
  const mfaRef = useRef(true);
  const actionRef = useRef<ActionId>("s3:GetObject");
  const stepRef = useRef(0);
  const resultsRef = useRef<Badge[]>([...PENDING_RESULTS]);
  const verdictRef = useRef<"ALLOW" | "DENY" | null>(null);
  const reasonRef = useRef("STANDBY");
  const logRef = useRef<string[]>(log); // seeded from initial state — only ever replaced with fresh arrays
  const evaluatedRef = useRef(0);
  const runIdRef = useRef(0);
  const reqRef = useRef<EvalRequest | null>(null);

  const flush = useCallback(() => {
    setStep(stepRef.current);
    setResults([...resultsRef.current]);
    setVerdict(verdictRef.current);
    setReason(reasonRef.current);
    setLog([...logRef.current]);
    setEvaluated(evaluatedRef.current);
    setRunId(runIdRef.current);
    setRequest(reqRef.current);
  }, []);

  const tick = useCallback(() => {
    const pushLog = (line: string) => {
      logRef.current = [...logRef.current, `[${logTs()}] ${line}`].slice(-MAX_LOG);
    };
    const st = stepRef.current;
    const req = reqRef.current;
    if (st === 0 || !req) {
      runIdRef.current += 1;
      const snap: EvalRequest = {
        principal: principalRef.current,
        action: actionRef.current,
        mfa: mfaRef.current,
      };
      reqRef.current = snap;
      resultsRef.current = [...PENDING_RESULTS];
      verdictRef.current = null;
      reasonRef.current = "EVALUATING";
      pushLog(`> req #${String(runIdRef.current).padStart(3, "0")} — ${PRINCIPALS[snap.principal].label} @ ${snap.action} [mfa=${snap.mfa ? "ON" : "OFF"}]`);
      stepRef.current = 1;
    } else if (st <= 5) {
      const card = PRINCIPALS[req.principal].policies[st - 1];
      const res = evaluateCard(card, req.action, req.mfa);
      resultsRef.current = resultsRef.current.map((b, i) => (i === st - 1 ? res.badge : b));
      evaluatedRef.current += 1;
      pushLog(res.line);
      if (res.badge === "deny") {
        resultsRef.current = resultsRef.current.map((b, i) => (i > st - 1 ? "halt" : b));
        verdictRef.current = "DENY";
        reasonRef.current = "EXPLICIT DENY WINS";
        pushLog("> explicit deny overrides any allow — evaluation halted");
        pushLog("> VERDICT: ACCESS DENIED — explicit deny");
        stepRef.current = 7;
      } else if (st === 5) {
        const anyAllow = resultsRef.current.some((b) => b === "allow");
        verdictRef.current = anyAllow ? "ALLOW" : "DENY";
        reasonRef.current = anyAllow ? "ALLOW STATEMENT MATCHED" : "DEFAULT DENY — NO ALLOW";
        pushLog(anyAllow ? "> VERDICT: ACCESS GRANTED — allow statement matched" : "> VERDICT: ACCESS DENIED — no allow matched (default deny)");
        stepRef.current = 7;
      } else {
        stepRef.current = st + 1;
      }
    } else {
      stepRef.current = 0;
      reqRef.current = null;
      pushLog("> ─── next request queued ───");
    }
    flush();
  }, [flush]);

  const evaluateNow = useCallback(() => {
    for (let i = 0; i < 8; i++) {
      tick();
      if (verdictRef.current) break;
    }
  }, [tick]);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(tick, 900);
    return () => clearInterval(timer);
  }, [running, tick]);

  const reset = () => {
    setRunning(false);
    stepRef.current = 0;
    resultsRef.current = [...PENDING_RESULTS];
    verdictRef.current = null;
    reasonRef.current = "STANDBY";
    logRef.current = [armedLine()];
    evaluatedRef.current = 0;
    runIdRef.current = 0;
    reqRef.current = null;
    flush();
  };

  const selectPrincipal = (id: PrincipalId) => {
    setPrincipal(id);
    principalRef.current = id;
  };

  const toggleMfa = () => {
    setMfa((v) => {
      mfaRef.current = !v;
      return !v;
    });
  };

  const selectAction = (a: ActionId) => {
    setAction(a);
    actionRef.current = a;
  };

  const displayPrincipal = request?.principal ?? principal;
  const policies = PRINCIPALS[displayPrincipal].policies;
  const evaluating = step >= 1 && step <= 5;
  const evalIdx = evaluating ? step - 1 : -1;
  const reqActive = request !== null && step >= 1 && step <= 7;

  return (
    <div
      className={
        immersive.active
          ? "fixed inset-0 z-[70] bg-background p-3 sm:p-5 flex flex-col gap-3 sm:gap-4 overflow-y-auto cyber-scroll"
          : "flex flex-col gap-4"
      }
    >
      {/* MODULE TABS — sits directly below the module title card */}
      <UseCaseTabs tabs={IAM_TABS} active={tab} onChange={(t) => setTab(t as IamTabId)} label="IAM views" />

      {tab !== "GENERAL" && (
        <IamUseCases id={tab} immersiveActive={immersive.active} immersiveToggle={immersive.toggle} />
      )}

      {tab === "GENERAL" && (
        <>
      {/* MAIN GRID — ANIMATION LEFT / RAIL RIGHT */}
      <div className={`grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start ${immersive.active ? "flex-1" : ""}`}>
        <GlassPanel
          title="FLOW VIEW // POLICY EVALUATION"
          subtitle="PRINCIPAL → POLICY ENGINE → ALLOW / DENY VERDICT"
          className="!p-0 overflow-hidden"
          delay={0.05}
          actions={<FullscreenToggle active={immersive.active} onToggle={immersive.toggle} />}
        >
          <FlowCanvas
            className={immersive.active ? "h-[min(560px,58vh)]" : "h-[440px] sm:h-[540px] lg:h-[560px]"}
            ariaLabel="IAM policy evaluation flow diagram"
          >
            {/* LINKS — principals into the engine */}
            <FlowLink d="M17,17 C27,17 28,42 37,46" status={reqActive && request?.principal === "root" ? "cyber" : "idle"} dotDuration={1.3} />
            <FlowLink d="M17,50 C25,50 27,50 37,50" status={reqActive && request?.principal === "alice" ? "cyber" : "idle"} dotDuration={1.1} />
            <FlowLink d="M17,83 C27,83 28,58 37,54" status={reqActive && request?.principal === "role" ? "cyber" : "idle"} dotDuration={1.4} dotDelay={0.2} />
            <FlowLink
              d="M65,50 C71,50 72,50 78,50"
              status={verdict === "ALLOW" ? "success" : verdict === "DENY" ? "error" : "idle"}
              dotDuration={1}
            />

            {/* PRINCIPALS */}
            <FlowLabel x={11} y={4} tone="magenta">SELECT PRINCIPAL</FlowLabel>
            <FlowNode
              x={11}
              y={17}
              icon={<AccountIcon className="w-3 h-3" />}
              label="ROOT USER"
              sub="ACCOUNT OWNER"
              status={principal === "root" ? "cyber" : "idle"}
              active={principal === "root"}
              pulse={reqActive && request?.principal === "root"}
              onClick={() => selectPrincipal("root")}
              size="sm"
              delay={0.1}
            />
            <FlowNode
              x={11}
              y={50}
              icon={<UserIcon className="w-3 h-3" />}
              label="USER ALICE"
              sub="dev-group"
              status={principal === "alice" ? "cyber" : "idle"}
              active={principal === "alice"}
              pulse={reqActive && request?.principal === "alice"}
              onClick={() => selectPrincipal("alice")}
              size="sm"
              delay={0.18}
            />
            <FlowNode
              x={11}
              y={83}
              icon={<LambdaIcon className="w-3 h-3" />}
              label="APP-LAMBDA-ROLE"
              sub="ROLE // TEMP CREDS"
              status={principal === "role" ? "cyber" : "idle"}
              active={principal === "role"}
              pulse={reqActive && request?.principal === "role"}
              onClick={() => selectPrincipal("role")}
              size="sm"
              delay={0.26}
            />

            {/* ENGINE CORE — vertical policy stack */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.35, duration: 0.4 }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
              style={{ left: "51.5%", top: "50%" }}
            >
              <div className={`glass cyber-cut p-2 w-[168px] sm:w-[236px] ${evaluating ? "box-glow" : ""}`}>
                <div className="flex items-center justify-between px-1 pb-1.5">
                  <span className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-[0.15em] text-aws">
                    <IAMIcon className="w-3 h-3" /> POLICY ENGINE
                  </span>
                  <span className="relative flex w-1.5 h-1.5">
                    {evaluating && <span className="absolute inline-flex w-full h-full bg-mint ping-ring" aria-hidden="true" />}
                    <span className={`relative w-1.5 h-1.5 ${evaluating ? "bg-mint" : "bg-foreground/30"}`} />
                  </span>
                </div>
                <div className="px-1 pb-1 text-[6.5px] uppercase tracking-wider text-muted-foreground border-t border-aws/15 pt-1 truncate">
                  {request ? `${PRINCIPALS[request.principal].label} @ ${request.action}` : "AWAITING REQUEST…"}
                </div>
                <div className="flex flex-col gap-[3px] border-t border-aws/15 pt-1.5">
                  {policies.map((p, i) => (
                    <motion.div
                      key={p.id}
                      layout
                      className={`flex items-center justify-between gap-1.5 min-h-[22px] px-1.5 border ${
                        evalIdx === i ? "border-aws/70 bg-aws/10" : "border-foreground/10 bg-black/40"
                      }`}
                    >
                      <span className="flex flex-col leading-none min-w-0">
                        <span className="text-[7px] font-bold tracking-wider text-foreground/90 truncate">{p.name}</span>
                        <span className="text-[6px] tracking-wider text-muted-foreground truncate">{p.note}</span>
                      </span>
                      <motion.span
                        key={`${runId}-${i}-${results[i]}`}
                        initial={{ scale: 1.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        className={`shrink-0 text-[6.5px] font-extrabold px-1 py-0.5 border tracking-[0.1em] ${BADGE_CLS[results[i]]}`}
                      >
                        {BADGE_TEXT[results[i]]}
                      </motion.span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* VERDICT */}
            <FlowLabel x={75} y={38} tone="aws">DECISION OUTPUT</FlowLabel>
            <div className="absolute -translate-x-1/2 -translate-y-1/2 z-10" style={{ left: "88.5%", top: "50%" }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${runId}-${verdict ?? "standby"}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.25 }}
                  className={`glass cyber-cut-sm w-[92px] sm:w-[104px] p-2 text-center ${
                    verdict === "ALLOW"
                      ? "shadow-[0_0_22px_rgba(0,255,163,0.35)]"
                      : verdict === "DENY"
                        ? "shadow-[0_0_22px_rgba(255,51,85,0.35)]"
                        : ""
                  }`}
                >
                  <p className="text-[7px] uppercase tracking-[0.22em] text-muted-foreground">decision</p>
                  <p
                    className={`text-[11px] sm:text-[13px] font-extrabold uppercase tracking-wider mt-0.5 ${
                      verdict === "ALLOW" ? "text-mint text-glow" : verdict === "DENY" ? "text-danger" : "text-foreground/40"
                    }`}
                  >
                    {verdict === "ALLOW" ? "GRANTED" : verdict === "DENY" ? "DENIED" : "STANDBY"}
                  </p>
                  <p className="mt-1 text-[6px] uppercase tracking-wider text-muted-foreground leading-tight">
                    {verdict ? reason : "NO REQUEST IN FLIGHT"}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            <FlowLabel x={50} y={95.5} tone="magenta">
              {"EVAL ORDER — EXPLICIT DENY > ALLOW > DEFAULT DENY"}
            </FlowLabel>
          </FlowCanvas>
        </GlassPanel>

        {/* RIGHT RAIL — LIVE STATS + CONTROLS */}
        <div className="flex flex-col gap-4 min-w-0">
          <GlassPanel title="LIVE STATS" className="!p-0" delay={0.1}>
            <div className="p-3 grid grid-cols-2 gap-2">
              <StatChip label="POLICIES EVALUATED" value={String(evaluated)} />
              <StatChip
                label="VERDICT"
                value={verdict ?? "—"}
                tone={verdict === "ALLOW" ? "mint" : verdict === "DENY" ? "magenta" : "neutral"}
              />
              <StatChip label="IDENTITY TYPE" value={PRINCIPALS[principal].kind} tone="neutral" />
              <StatChip label="MFA" value={mfa ? "ON" : "OFF"} tone={mfa ? "mint" : "magenta"} />
            </div>
          </GlassPanel>

          <GlassPanel title="CONTROLS" className="!p-0" delay={0.12}>
            <div className="p-3 flex flex-col gap-2.5">
              <SimControls
                running={running}
                onToggle={() => setRunning((r) => !r)}
                onReset={reset}
                status={running ? `ENGINE LIVE — EVALUATING AS ${PRINCIPALS[displayPrincipal].label}` : "ENGINE IDLE — PRESS RUN"}
              />
              <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">MFA SESSION CONTEXT</p>
              <button
                type="button"
                onClick={toggleMfa}
                aria-label="Toggle MFA enrollment for the session context"
                className={`flex items-center gap-1.5 self-start px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] border bg-black/50 backdrop-blur-md cyber-cut-sm ${
                  mfa ? "border-mint/60 text-mint" : "border-danger/60 text-danger"
                }`}
              >
                <KeyRound className="w-3 h-3" />
                {"MFA ENROLLED: "}
                {mfa ? "ON" : "OFF"}
              </button>
              <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">ACTION UNDER TEST</p>
              <div className="flex flex-wrap gap-2">
                {ACTIONS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => selectAction(a)}
                    aria-pressed={action === a}
                    aria-label={`Set action under test to ${a}`}
                    className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] border bg-black/50 backdrop-blur-md cyber-cut-sm ${
                      action === a ? "border-aws/70 text-aws bg-aws/10" : "border-foreground/25 text-muted-foreground"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
              <motion.button
                type="button"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.94 }}
                onClick={evaluateNow}
                aria-label="Run one full policy evaluation immediately"
                className="flex items-center gap-1.5 self-start px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] border border-aws/60 text-aws bg-black/50 backdrop-blur-md cyber-cut-sm hover:bg-aws/10 mt-1"
              >
                <Zap className="w-3 h-3" />
                EVALUATE NOW
              </motion.button>
            </div>
          </GlassPanel>
        </div>
      </div>

      {/* ENGINE TRACE — full width below the grid */}
      <GlassPanel title="ENGINE TRACE — DECISION LOG" className="!p-0" delay={0.18}>
        <div className="p-3">
          <AutoLog
            lines={log.map((t, i) => ({ id: i, text: t }))}
            toneOf={logTone}
            tones={TRACE_TONES}
            emptyText="// trace buffer empty"
          />
        </div>
      </GlassPanel>

      {/* KNOWLEDGE — hidden in immersive fullscreen (essential data only) */}
      <div className={immersive.active ? "hidden" : "grid md:grid-cols-3 gap-3"}>
        <Callout type="exam" title="Evaluation order decides everything">
          Within a single account, IAM evaluates: {"START → explicit Deny → explicit Allow → default Deny."} An explicit
          deny in ANY policy (identity, permission boundary, SCP) always overrides every allow. If no allow matches, the
          request is denied by default — IAM has no implicit allow.
        </Callout>
        <Callout type="critical" title="Never use the root user">
          The account ROOT has unstoppable power and cannot be limited by IAM policies. Lock MFA on it, delete its access
          keys, and never use it for daily work — attach an admin IAM <span className="text-aws">role</span> instead.
          Roles issue temporary credentials; long-lived access keys are the top cause of breaches.
        </Callout>
        <Callout type="info" title="IAM is global and free">
          IAM is a <span className="text-aws">global</span> service — users and roles exist once, usable in every region.
          There is no charge for IAM itself. MFA adds a second factor (TOTP or FIDO hardware key) that condition keys like
          <span className="text-mint"> aws:MultiFactorAuthPresent</span> check at evaluation time.
        </Callout>
      </div>
        </>
      )}
    </div>
  );
}
