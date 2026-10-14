"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Ban,
  Fingerprint,
  KeyRound,
  ShieldCheck,
  User,
  Zap,
} from "lucide-react";
import { FlowCanvas, FlowLabel, FlowLink, FlowNode } from "@/components/shared/flow";
import { SimControls } from "@/components/shared/sim-controls";
import {
  StepBadge,
  UCButton,
  UCToggle,
  UCStat,
  UseCaseNote,
  UseCaseShell,
  VerdictFlash,
  useScenarioRunner,
  useTicker,
} from "@/components/shared/use-case";
import { DynamoDBIcon, IAMIcon, S3Icon } from "@/components/aws-icons";

/* ================================================================== */
/* SHARED TYPES + HELPERS                                              */
/* ================================================================== */

export type IamUseCaseId = "FEDERATION" | "LEAST_PRIV" | "CROSS_ACCOUNT";

interface IamUseCasesProps {
  id: IamUseCaseId;
  immersiveActive?: boolean;
  immersiveToggle?: () => void;
}

interface UCLine {
  id: number;
  text: string;
  tone?: string;
}

const fmtTtl = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

const FED_STEPS = ["SSO REDIRECT", "IDP AUTHENTICATES", "STS ASSUME-ROLE", "S3 API CALL", "DYNAMODB QUERY", "SESSION ACTIVE"];

/* ================================================================== */
/* TAB 02 — FEDERATED ACCESS (IDENTITY FEDERATION VIA STS)             */
/* ================================================================== */

function FederationUseCase({ immersiveActive, immersiveToggle }: IamUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [proto, setProto] = useState<"SAML" | "OIDC">("SAML");
  const [ttl, setTtl] = useState(900);
  const [revoked, setRevoked] = useState(false);
  const [sessions, setSessions] = useState(0);
  const [assumes, setAssumes] = useState(0);
  const [forbidden, setForbidden] = useState(0);
  const [flash, setFlash] = useState<null | "deny">(null);
  const [lines, setLines] = useState<UCLine[]>([]);
  const idRef = useRef(1);
  const ttlRef = useRef(900);
  const flashT = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: idRef.current++, text, tone }]);

  // 15:00 TTL countdown — decrements every second while a live session runs,
  // snaps back to 15:00 when it burns down (re-federation)
  useTicker(running && !revoked, () => {
    const next = ttlRef.current - 1;
    if (next <= 0) {
      ttlRef.current = 900;
      setTtl(900);
      push("TOKEN TTL EXPIRED — re-federating with the IdP for fresh STS credentials", "magenta");
      return;
    }
    ttlRef.current = next;
    setTtl(next);
  }, 1000);

  const assumeNow = () => {
    setRevoked(false);
    setAssumes((n) => n + 1);
    setSessions((n) => n + 1);
    ttlRef.current = 900;
    setTtl(900);
    push(
      `STS AssumeRoleWith${proto === "SAML" ? "SAML" : "WebIdentity"} OK — role/app-federated-role assumed — temp creds ASIA•••${String(1000 + Math.floor(Math.random() * 8999))} issued · TTL 15:00`,
      "mint"
    );
  };

  // scenario: SSO click → IdP auth → STS assume → S3 → DynamoDB → idle
  const { step, reset: resetStep } = useScenarioRunner(6, running, 2100, (s) => {
    if (s === 0) push("employee clicks 'SIGN IN WITH CORPORATE SSO' — browser redirects to the IdP", "aws");
    else if (s === 1) push(`IDP authenticated the employee — ${proto === "SAML" ? "signed SAML 2.0 assertion" : "OIDC id_token"} minted`, "neon");
    else if (s === 2) assumeNow();
    else if (s === 3) push("GET s3://nexus-app/reports/q1.pdf — request signed with temp creds — 200 OK", "aws");
    else if (s === 4) push("DynamoDB Query sessions — 12 items — 200 OK (federated principal)", "neon");
    else push("session parked — token valid until TTL — zero long-lived keys were ever created", "dim");
  });

  const revokeNow = () => {
    setRevoked(true);
    setSessions(0);
    setForbidden((n) => n + 1);
    ttlRef.current = 0;
    setTtl(0);
    setFlash("deny");
    if (flashT.current) clearTimeout(flashT.current);
    flashT.current = setTimeout(() => setFlash(null), 2000);
    push("REVOKE NOW — temp credentials revoked — session terminated", "danger");
    push("403 Forbidden — every in-flight request signed with the dead token fails closed", "danger");
  };

  const reset = () => {
    setRunning(false);
    resetStep();
    ttlRef.current = 900;
    setTtl(900);
    setRevoked(false);
    setSessions(0);
    setAssumes(0);
    setForbidden(0);
    setFlash(null);
    setLines([]);
  };

  useEffect(() => () => { if (flashT.current) clearTimeout(flashT.current); }, []);

  const tokenLive = !revoked && sessions > 0;
  const flow = running && !revoked;
  const protoApi = proto === "SAML" ? "SAML" : "WEB-ID";

  return (
    <UseCaseShell
      title="USE CASE // FEDERATED ACCESS — IDENTITY FEDERATION VIA STS"
      subtitle="CORPORATE IDP → STS ASSUME-ROLE-WITH-SAML → TEMP CREDS → AWS APIs"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="TOKEN TTL" value={revoked ? "REVOKED" : fmtTtl(ttl)} tone={revoked ? "danger" : ttl <= 60 ? "magenta" : "mint"} />
          <UCStat label="ACTIVE SESSIONS" value={sessions} tone={sessions > 0 ? "mint" : "neutral"} />
          <UCStat label="ROLE ASSUMES" value={assumes} />
          <UCStat label="403S" value={forbidden} tone={forbidden > 0 ? "danger" : "neutral"} />
          <UCStat label="IDP PROTOCOL" value={proto} tone="neon" />
          <UCStat label="CRED TYPE" value="TEMP · STS" tone="neutral" />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? (revoked ? "SESSION DEAD — NEXT CYCLE RE-FEDERATES" : "FEDERATION LIVE — TOKENS IN FLIGHT") : "IDLE — PRESS RUN TO FEDERATE"}
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">CORPORATE IDP</p>
          <UCToggle
            on={proto === "SAML"}
            onClick={() => setProto((p) => (p === "SAML" ? "OIDC" : "SAML"))}
            ariaLabel="Toggle identity provider protocol between SAML and OIDC"
          >
            <Fingerprint className="w-3 h-3" /> PROTOCOL {proto} ⇄ {proto === "SAML" ? "OIDC" : "SAML"}
          </UCToggle>
          <UCButton onClick={revokeNow} tone="danger" ariaLabel="Revoke the temporary credentials immediately">
            <Ban className="w-3 h-3" /> REVOKE NOW
          </UCButton>
        </>
      }
      logLines={lines}
      logTitle="FEDERATION LOG // LIVE"
      logEmpty="PRESS RUN — WATCH A FEDERATED SESSION GET BORN, USED AND REVOKED"
    >
      <FlowCanvas ariaLabel="IAM federated access use case diagram" className="h-full">
        <FlowLink d="M14,47 C21,42 26,35 30,31" status={flow ? "flowing" : "idle"} dotDuration={1.1} />
        <FlowLink d="M40,31 C46,36 51,42 55,46" status={flow ? "flowing" : "idle"} dotDuration={1.2} dotDelay={0.25} />
        <FlowLink d="M65,46 C71,41 76,37 81,33" status={tokenLive ? "success" : flow ? "flowing" : "idle"} dotDuration={1.1} dotDelay={0.5} />
        <FlowLink d="M65,54 C71,59 76,63 81,67" status={tokenLive ? "success" : flow ? "flowing" : "idle"} dotDuration={1.2} dotDelay={0.65} />

        <FlowNode x={10} y={50} size="sm" delay={0.1} icon={<User className="w-3 h-3" />} label="USER" sub="EMPLOYEE · BROWSER" status={flow ? "active" : "idle"} pulse={flow} />
        <FlowNode x={35} y={26} size="sm" delay={0.2} icon={<Fingerprint className="w-3 h-3" />} label="CORPORATE IDP" sub={proto === "SAML" ? "SAML 2.0 ASSERTION" : "OIDC ID_TOKEN"} status={flow ? "active" : "idle"} pulse={flow} />
        <FlowNode x={60} y={50} size="sm" delay={0.3} icon={<KeyRound className="w-3 h-3" />} label="STS" sub={`ASSUME-ROLE-WITH-${protoApi}`} status={tokenLive ? "success" : flow ? "active" : "idle"} pulse={flow} />
        <FlowNode x={86} y={30} size="sm" delay={0.4} icon={<S3Icon className="w-3 h-3 text-aws" />} label="AWS API · S3" sub="GET OBJECT" status={tokenLive ? "success" : "idle"} />
        <FlowNode x={86} y={70} size="sm" delay={0.48} icon={<DynamoDBIcon className="w-3 h-3 text-aws" />} label="AWS API · DYNAMODB" sub="QUERY TABLE" status={tokenLive ? "success" : "idle"} />

        {/* STS TOKEN PACK */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="absolute left-[31%] top-[77%] -translate-x-1/2 -translate-y-1/2 z-10 w-[200px] sm:w-[240px]"
        >
          <div className={`glass cyber-cut-sm px-2.5 py-2 ${revoked ? "shadow-[0_0_18px_rgba(255,51,85,0.35)]" : tokenLive ? "box-glow" : ""}`}>
            <div className="flex items-center justify-between pb-1 border-b border-aws/15">
              <span className="flex items-center gap-1 text-[7.5px] font-bold uppercase tracking-[0.15em] text-aws">
                <IAMIcon className="w-3 h-3" /> STS TOKEN PACK
              </span>
              <span className={`text-[8px] font-extrabold tabular-nums ${revoked ? "text-danger" : tokenLive ? "text-mint" : "text-muted-foreground"}`}>
                {revoked ? "✕ DEAD" : tokenLive ? fmtTtl(ttl) : "NO TOKEN"}
              </span>
            </div>
            <div className="pt-1 flex items-center justify-between">
              <span className="text-[6.5px] tracking-wider text-muted-foreground">ASIA••••{revoked ? "××××" : "FED9"} · SIGV4</span>
              <span className={`text-[6.5px] font-bold tracking-[0.15em] ${revoked ? "text-danger" : "text-mint"}`}>
                {revoked ? "REVOKED" : tokenLive ? "TEMP · 15:00" : "AWAITING STS"}
              </span>
            </div>
          </div>
        </motion.div>

        <FlowLabel x={27} y={9} tone="aws">NO IAM USERS · NO STATIC KEYS — IDENTITY STAYS AT THE IDP</FlowLabel>
        <FlowLabel x={76} y={90} tone="mint">TEMP CREDS EXPIRE BY DESIGN — 15:00, THEN RE-FEDERATE</FlowLabel>
        <StepBadge step={step} total={6} text={FED_STEPS[step]} />
      </FlowCanvas>

      <VerdictFlash show={flash === "deny"} text="403 — TOKENS REVOKED" tone="deny" />
      <UseCaseNote>
        FEDERATE, DON&apos;T ACCUMULATE: NO IAM USERS, NO LONG-LIVED KEYS — EVERY CREDENTIAL EXPIRES (15M TTL) AND DIES IN ONE CLICK
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* TAB 03 — LEAST PRIVILEGE (POLICY SCOPE SIMULATOR)                   */
/* ================================================================== */

type LpVerdict = "allow" | "deny" | "over";

interface LpAction {
  action: string;
  resource: string;
  dangerous: boolean;
}

const LP_ACTIONS: LpAction[] = [
  { action: "s3:GetObject", resource: "reports/q1.pdf", dangerous: false },
  { action: "s3:PutObject", resource: "tmp/scratch.bin", dangerous: false },
  { action: "s3:DeleteObject", resource: "db/prod-backup", dangerous: true },
  { action: "iam:CreateUser", resource: "user/backdoor-*", dangerous: true },
];

function lpPolicyFor(scope: number): { mode: string; modeCls: string; actions: string[]; resources: string[] } {
  if (scope >= 80)
    return { mode: "PRECISE", modeCls: "text-mint border-mint/60", actions: ["s3:GetObject"], resources: ["arn:aws:s3:::app-bucket/reports/*"] };
  if (scope >= 40)
    return { mode: "SCOPED", modeCls: "text-neon border-neon/60", actions: ["s3:GetObject", "s3:PutObject"], resources: ["arn:aws:s3:::app-bucket/*"] };
  return { mode: "WILDCARD", modeCls: "text-danger border-danger/60", actions: ["s3:*", "iam:*"], resources: ["*"] };
}

function lpEvaluate(act: LpAction, scope: number): { verdict: LpVerdict; line: string; tone: string } {
  const pol = lpPolicyFor(scope);
  if (pol.mode === "WILDCARD") {
    const by = act.action.startsWith("iam:") ? "iam:*" : "s3:*";
    if (act.dangerous)
      return { verdict: "over", line: `OVER-PERMISSION: ${act.action} on ${act.resource} allowed by ${by} — blast radius unbounded`, tone: "danger" };
    return { verdict: "allow", line: `ALLOW ${act.action} ${act.resource} — wildcard policy says yes (that is the problem)`, tone: "aws" };
  }
  const allowed = pol.mode === "SCOPED" ? pol.actions.includes(act.action) : act.action === "s3:GetObject";
  if (allowed)
    return { verdict: "allow", line: `ALLOW ${act.action} ${act.resource} — matched [${pol.actions.join(", ")}] → ${pol.resources[0]}`, tone: "mint" };
  return { verdict: "deny", line: `IMPLICIT DENY — ${act.action} on ${act.resource} matches no statement — default deny`, tone: "neon" };
}

function ScopeSlider({ value, onChange, ariaLabel }: { value: number; onChange: (v: number) => void; ariaLabel: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[7px] font-bold uppercase tracking-[0.2em] text-muted-foreground">WILDCARD *</span>
        <span className="text-[8px] font-extrabold tabular-nums text-aws">{value}%</span>
        <span className="text-[7px] font-bold uppercase tracking-[0.2em] text-muted-foreground">ARN-PRECISE</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        aria-label={ariaLabel}
        className="w-full h-1.5 accent-[#ff9900] cursor-pointer bg-black/60 border border-foreground/20"
      />
    </div>
  );
}

const LP_RESULT_META: Record<LpVerdict, { text: string; cls: string }> = {
  allow: { text: "ALLOW", cls: "text-mint border-mint/60" },
  over: { text: "OVER-PERM", cls: "text-danger border-danger/60" },
  deny: { text: "IMP. DENY", cls: "text-neon border-neon/50" },
};

function LeastPrivUseCase({ immersiveActive, immersiveToggle }: IamUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [scope, setScope] = useState(20);
  const [results, setResults] = useState<Record<string, LpVerdict>>({});
  const [allowed, setAllowed] = useState(0);
  const [denied, setDenied] = useState(0);
  const [overs, setOvers] = useState(0);
  const [flash, setFlash] = useState<null | { text: string; tone: "ok" | "deny" | "aws" }>(null);
  const [last, setLast] = useState<string | null>(null);
  const [lines, setLines] = useState<UCLine[]>([]);
  const idRef = useRef(1);
  const flashT = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: idRef.current++, text, tone }]);

  const simulate = () => {
    const act = LP_ACTIONS[Math.floor(Math.random() * LP_ACTIONS.length)];
    const res = lpEvaluate(act, scope);
    setResults((r) => ({ ...r, [act.action]: res.verdict }));
    setLast(`${act.action} · ${act.resource}`);
    if (res.verdict === "deny") setDenied((n) => n + 1);
    else if (res.verdict === "over") setOvers((n) => n + 1);
    else setAllowed((n) => n + 1);
    setFlash(res.verdict === "deny" ? { text: "DENY", tone: "deny" } : res.verdict === "over" ? { text: "ALLOW ⚠", tone: "aws" } : { text: "ALLOW", tone: "ok" });
    if (flashT.current) clearTimeout(flashT.current);
    flashT.current = setTimeout(() => setFlash(null), 1800);
    push(`SIM ${act.action} ${act.resource} ⇒ ${res.line}`, res.tone);
  };

  // ambient traffic — auto-fires random requests while RUN is engaged
  useTicker(running, simulate, 2200);

  const reset = () => {
    setRunning(false);
    setResults({});
    setAllowed(0);
    setDenied(0);
    setOvers(0);
    setFlash(null);
    setLast(null);
    setLines([]);
  };

  useEffect(() => () => { if (flashT.current) clearTimeout(flashT.current); }, []);

  const pol = lpPolicyFor(scope);
  const risk = 100 - scope;

  return (
    <UseCaseShell
      title="USE CASE // LEAST PRIVILEGE — SCOPE THE POLICY, STARVE THE ATTACK"
      subtitle="WILDCARD s3:* → RESOURCE-PRECISE ARNS — WATCH EVERY VERDICT FLIP"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="SCOPE %" value={`${scope}%`} tone={scope >= 80 ? "mint" : scope >= 40 ? "neon" : "danger"} />
          <UCStat label="POLICY MODE" value={pol.mode} tone={scope >= 80 ? "mint" : scope >= 40 ? "neon" : "danger"} />
          <UCStat label="ALLOWED" value={allowed} tone="mint" />
          <UCStat label="DENIED" value={denied} tone="neon" />
          <UCStat label="OVER-PERMISSIONS" value={overs} tone={overs > 0 ? "danger" : "neutral"} />
          <UCStat label="RISK SCORE" value={risk} tone={risk > 60 ? "danger" : risk > 30 ? "magenta" : "mint"} />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? `LIVE FIRE — RANDOM REQUESTS @ ${pol.mode} POLICY` : "IDLE — SLIDE THE SCOPE, THEN SIMULATE"}
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">POLICY SCOPE</p>
          <ScopeSlider value={scope} onChange={setScope} ariaLabel="Policy scope slider from wildcard to resource-precise" />
          <UCButton onClick={simulate} ariaLabel="Simulate a random API request against the current policy">
            <Zap className="w-3 h-3" /> SIMULATE REQUEST
          </UCButton>
        </>
      }
      logLines={lines}
      logTitle="POLICY EVALUATION LOG // LIVE"
      logEmpty="SLIDE THE SCOPE — THEN HIT SIMULATE REQUEST"
    >
      <FlowCanvas ariaLabel="IAM least privilege policy scope simulator" className="h-full">
        <FlowLink d="M13,50 C19,50 21,50 26,50" status={flash ? "flowing" : "idle"} dotDuration={0.9} />
        <FlowLink d="M58,50 C64,50 66,50 71,50" status={flash ? (flash.tone === "deny" ? "error" : "success") : "idle"} dotDuration={0.9} dotDelay={0.18} />

        <FlowNode x={8} y={50} size="sm" delay={0.1} icon={<Zap className="w-3 h-3" />} label="RANDOM REQUEST" sub="4 POSSIBLE ACTIONS" status={flash ? "active" : "idle"} pulse={!!flash} />

        {/* POLICY DOCUMENT — morphs with the slider */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25 }}
          className="absolute left-[41%] top-[48%] -translate-x-1/2 -translate-y-1/2 z-10 w-[218px] sm:w-[266px]"
        >
          <div className={`glass cyber-cut p-2.5 ${pol.mode === "WILDCARD" ? "shadow-[0_0_18px_rgba(255,51,85,0.25)]" : pol.mode === "PRECISE" ? "box-glow" : ""}`}>
            <div className="flex items-center justify-between pb-1.5 border-b border-aws/15">
              <span className="flex items-center gap-1 text-[7.5px] font-bold uppercase tracking-[0.15em] text-aws">
                <ShieldCheck className="w-3 h-3" /> IDENTITY POLICY
              </span>
              <span className={`text-[6.5px] font-extrabold px-1 py-0.5 border tracking-[0.15em] ${pol.modeCls}`}>{pol.mode}</span>
            </div>
            <div className="pt-1.5 h-1.5 bg-black/60 border border-foreground/15 mb-1.5">
              <motion.div className={`h-full ${scope >= 80 ? "bg-mint" : scope >= 40 ? "bg-neon" : "bg-danger"}`} animate={{ width: `${scope}%` }} transition={{ duration: 0.35 }} />
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-[6.5px] tracking-wider text-muted-foreground">{"{"}</p>
              <p className="text-[7px] font-bold tracking-wider text-foreground/85 pl-2">&quot;Effect&quot;: <span className="text-mint">&quot;Allow&quot;</span>,</p>
              <p className="text-[7px] font-bold tracking-wider text-foreground/85 pl-2 truncate">
                &quot;Action&quot;: <span className={scope >= 80 ? "text-mint" : scope >= 40 ? "text-neon" : "text-danger"}>[{pol.actions.join(", ")}]</span>,
              </p>
              <p className="text-[7px] font-bold tracking-wider text-foreground/85 pl-2 truncate">
                &quot;Resource&quot;: <span className={scope >= 80 ? "text-mint" : scope >= 40 ? "text-neon" : "text-danger"}>[{pol.resources.join(", ")}]</span>
              </p>
              <p className="text-[6.5px] tracking-wider text-muted-foreground">{"}"}</p>
            </div>
            <div className="border-t border-aws/15 mt-1.5 pt-1.5 flex flex-col gap-0.5">
              {LP_ACTIONS.map((a) => {
                const meta = results[a.action] ? LP_RESULT_META[results[a.action]] : null;
                return (
                  <div key={a.action} className="flex items-center justify-between gap-1">
                    <span className={`text-[6.5px] font-bold tracking-wider truncate ${a.dangerous ? "text-danger/90" : "text-foreground/70"}`}>
                      {a.action}
                    </span>
                    <span className={`shrink-0 text-[6px] font-extrabold px-1 py-0.5 border tracking-[0.1em] ${meta ? meta.cls : "border-foreground/10 text-foreground/30"}`}>
                      {meta ? meta.text : "· · ·"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>

        <FlowNode x={85} y={50} size="sm" delay={0.35} icon={<ShieldCheck className="w-3 h-3" />} label="AUTHZ DECISION" sub={last ?? "AWAITING SIM"} status={flash?.tone === "deny" ? "error" : flash ? "success" : "idle"} />

        <FlowLabel x={26} y={12} tone="aws">SLIDE THE SCOPE — WILDCARD * BECOMES A RESOURCE-PRECISE ARN</FlowLabel>
        <FlowLabel x={72} y={88} tone="danger">EVERY WILDCARD STATEMENT IS A FUTURE INCIDENT REPORT</FlowLabel>
      </FlowCanvas>

      <VerdictFlash show={!!flash} text={flash?.text ?? ""} tone={flash?.tone ?? "deny"} />
      <UseCaseNote>
        START AT s3:*, END AT ONE GETOBJECT ON ONE PREFIX — SAME APP, 0% BLAST RADIUS. IF A STATEMENT NEEDS *, IT NEEDS A SECOND LOOK
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* TAB 04 — CROSS-ACCOUNT ROLE (TRUST POLICY + EXTERNAL ID)            */
/* ================================================================== */

function CrossAccountUseCase({ immersiveActive, immersiveToggle }: IamUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [requireExtId, setRequireExtId] = useState(true);
  const [sessions, setSessions] = useState(0);
  const [assumes, setAssumes] = useState(0);
  const [denied, setDenied] = useState(0);
  const [flash, setFlash] = useState<null | { text: string; tone: "ok" | "deny" }>(null);
  const [link, setLink] = useState<"idle" | "success" | "error">("idle");
  const [lastReq, setLastReq] = useState<null | { hasExtId: boolean; verdict: "allow" | "deny" }>(null);
  const [lines, setLines] = useState<UCLine[]>([]);
  const idRef = useRef(1);
  const parityRef = useRef(0); // even = partner WITH external id · odd = confused deputy WITHOUT
  const flashT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const linkT = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: idRef.current++, text, tone }]);

  const armTimers = () => {
    if (flashT.current) clearTimeout(flashT.current);
    flashT.current = setTimeout(() => setFlash(null), 2000);
    if (linkT.current) clearTimeout(linkT.current);
    linkT.current = setTimeout(() => setLink("idle"), 2300);
  };

  const runAttempt = (hasExtId: boolean) => {
    parityRef.current += 1;
    const n = String(parityRef.current).padStart(3, "0");
    push(`sts:AssumeRole #${n} — principal 4444-8888-7777 ${hasExtId ? "PRESENTS sts:ExternalId" : "WITHOUT sts:ExternalId"}`, "aws");
    if (!hasExtId && requireExtId) {
      setLastReq({ hasExtId, verdict: "deny" });
      setDenied((d) => d + 1);
      setLink("error");
      setFlash({ text: "CONFUSED DEPUTY — DENIED", tone: "deny" });
      armTimers();
      push("✕ AccessDenied — trust policy Condition sts:ExternalId not satisfied — attacker role-chain blocked", "danger");
      return;
    }
    setLastReq({ hasExtId, verdict: "allow" });
    setAssumes((a) => a + 1);
    setSessions((s) => s + 1);
    setLink("success");
    setFlash({ text: "ROLE ASSUMED", tone: "ok" });
    armTimers();
    if (!hasExtId) push("⚠ trust policy has NO ExternalId condition — request assumed anyway (confused-deputy exposure)", "magenta");
    push("arn:aws:iam::5555-1234-9999:role/acct-b-ops-role assumed — temp creds ASIA•••XACT issued · TTL 15:00", "mint");
  };

  // auto scenario: request → trust eval → verdict → bucket access
  const { step, reset: resetStep } = useScenarioRunner(4, running, 2300, (s) => {
    if (s === 0) runAttempt(parityRef.current % 2 === 0);
    else if (s === 2) {
      if (lastReq?.verdict === "allow") push("GET s3://acct-b-data/cross-acct/q1.parquet — 200 OK signed with cross-account temp creds", "mint");
      else push("no session — nothing reached account B — the border held", "dim");
    } else if (s === 3) push("cycle complete — the trust policy is the ONLY gate between the accounts", "dim");
  });

  const revokeSession = () => {
    setSessions(0);
    setFlash({ text: "SESSION REVOKED", tone: "deny" });
    armTimers();
    push("REVOKE SESSION — cross-account temp creds invalidated — bucket access cut mid-flight", "danger");
  };

  const toggleExtId = () => {
    const turningOn = !requireExtId;
    setRequireExtId(turningOn);
    push(
      turningOn
        ? "trust policy updated — sts:ExternalId condition ADDED — confused-deputy chains cut"
        : "trust policy updated — ExternalId condition REMOVED — every request from 4444-… now passes",
      turningOn ? "mint" : "danger"
    );
  };

  const reset = () => {
    setRunning(false);
    resetStep();
    setSessions(0);
    setAssumes(0);
    setDenied(0);
    setFlash(null);
    setLink("idle");
    setLastReq(null);
    setLines([]);
  };

  useEffect(() => () => {
    if (flashT.current) clearTimeout(flashT.current);
    if (linkT.current) clearTimeout(linkT.current);
  }, []);

  return (
    <UseCaseShell
      title="USE CASE // CROSS-ACCOUNT ROLE — TRUST POLICIES + EXTERNAL ID"
      subtitle="ACCOUNT A PRINCIPAL → STS ASSUME-ROLE → ACCOUNT B ROLE → B BUCKET"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="TRUSTED ACCOUNTS" value={requireExtId ? "1 · +EXT ID" : "1 · NO COND"} tone={requireExtId ? "mint" : "magenta"} />
          <UCStat label="ACTIVE SESSIONS" value={sessions} tone={sessions > 0 ? "mint" : "neutral"} />
          <UCStat label="DENIED" value={denied} tone={denied > 0 ? "danger" : "neutral"} />
          <UCStat label="ROLE ASSUMES" value={assumes} />
          <UCStat label="LAST REQUEST" value={lastReq ? (lastReq.hasExtId ? "WITH EXT ID" : "NO EXT ID") : "—"} tone={lastReq && !lastReq.hasExtId ? "magenta" : "neutral"} />
          <UCStat label="CRED TYPE" value="TEMP · STS" tone="neutral" />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? "AUTO ATTEMPTS — PARTNER ⇄ CONFUSED DEPUTY" : "IDLE — PRESS RUN OR ASSUME BY HAND"}
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">TRUST POLICY</p>
          <UCToggle on={requireExtId} onClick={toggleExtId} accent="mint" ariaLabel="Toggle the sts:ExternalId condition on the trust policy">
            <KeyRound className="w-3 h-3" /> REQUIRE EXTERNAL ID {requireExtId ? "ON" : "OFF"}
          </UCToggle>
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">SESSION ACTIONS</p>
          <div className="flex flex-wrap gap-2">
            <UCButton onClick={() => runAttempt(parityRef.current % 2 === 0)} ariaLabel="Attempt to assume the cross-account role">
              <KeyRound className="w-3 h-3" /> ASSUME ROLE
            </UCButton>
            <UCButton onClick={revokeSession} tone="danger" ariaLabel="Revoke the active cross-account session">
              <Ban className="w-3 h-3" /> REVOKE SESSION
            </UCButton>
          </div>
        </>
      }
      logLines={lines}
      logTitle="CROSS-ACCOUNT LOG // LIVE"
      logEmpty="PRESS RUN — WATCH THE TRUST POLICY JUDGE EVERY REQUEST"
    >
      <FlowCanvas ariaLabel="IAM cross-account role use case diagram" className="h-full">
        <FlowLink d="M14,26 C20,32 26,40 31,43" status={running ? "flowing" : "idle"} dotDuration={1.2} />
        <FlowLink d="M41,44 C47,38 54,30 59,26" status={link !== "idle" ? link : running ? "flowing" : "idle"} dotDuration={1.2} dotDelay={0.2} />
        <FlowLink d="M69,26 C75,32 81,40 84,44" status={sessions > 0 ? "success" : "idle"} dotDuration={1.3} dotDelay={0.4} />

        <FlowNode x={10} y={22} size="sm" delay={0.1} icon={<User className="w-3 h-3" />} label="ACCOUNT A" sub="4444-8888-7777 · APP" status={running ? "active" : "idle"} pulse={running} />
        <FlowNode x={36} y={48} size="sm" delay={0.2} icon={<KeyRound className="w-3 h-3" />} label="STS" sub="ASSUME-ROLE" status={link === "error" ? "error" : link === "success" ? "success" : running ? "active" : "idle"} pulse={running} />
        <FlowNode x={64} y={22} size="sm" delay={0.3} icon={<IAMIcon className="w-3 h-3 text-aws" />} label="ACCOUNT B · ROLE" sub="5555-1234-9999 · OPS-ROLE" status={link === "success" ? "success" : link === "error" ? "error" : "idle"} />
        <FlowNode x={88} y={48} size="sm" delay={0.4} icon={<S3Icon className="w-3 h-3 text-aws" />} label="ACCT-B DATA" sub="s3://acct-b-data" status={sessions > 0 ? "success" : "idle"} />

        {/* TRUST POLICY CARD */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="absolute left-[46%] top-[79%] -translate-x-1/2 -translate-y-1/2 z-10 w-[240px] sm:w-[320px]"
        >
          <div className={`glass cyber-cut-sm px-2.5 py-2 ${requireExtId ? "" : "shadow-[0_0_18px_rgba(255,45,120,0.3)]"}`}>
            <div className="flex items-center justify-between pb-1 border-b border-aws/15">
              <span className="text-[7.5px] font-bold uppercase tracking-[0.15em] text-aws">TRUST POLICY · ACCT-B-OPS-ROLE</span>
              <span className={`text-[6.5px] font-extrabold px-1 py-0.5 border tracking-[0.12em] ${requireExtId ? "text-mint border-mint/60" : "text-magenta border-magenta/60"}`}>
                {requireExtId ? "EXTERNAL ID" : "NO CONDITION"}
              </span>
            </div>
            <div className="pt-1.5 flex flex-col gap-0.5">
              <p className="text-[6.8px] font-bold tracking-wider text-foreground/85 truncate">
                &quot;Principal&quot;: <span className="text-neon">&quot;arn:aws:iam::4444-8888-7777:root&quot;</span>
              </p>
              <p className="text-[6.8px] font-bold tracking-wider text-foreground/85">
                &quot;Action&quot;: <span className="text-aws">&quot;sts:AssumeRole&quot;</span>
              </p>
              {requireExtId ? (
                <p className="text-[6.8px] font-bold tracking-wider text-mint truncate">
                  &quot;Condition&quot;: {"{"} &quot;sts:ExternalId&quot;: &quot;nexus-xacct-9f3&quot; {"}"}
                </p>
              ) : (
                <p className="text-[6.8px] font-bold tracking-wider text-danger">
                  ✕ NO CONDITION — ANY ROLE-CHAIN IN 4444-… (AND ANYONE IT DELEGATES TO) MAY ASSUME
                </p>
              )}
            </div>
          </div>
        </motion.div>

        <FlowLabel x={30} y={8} tone="aws">CROSS-ACCOUNT ACCESS — THE TRUST POLICY OWNS THE BORDER</FlowLabel>
        <FlowLabel x={80} y={72} tone="magenta">EXTERNAL ID = PROOF THE REQUEST CAME FROM THE EXPECTED WORKLOAD</FlowLabel>
        <StepBadge
          step={step}
          total={4}
          text={["STS REQUEST", "TRUST EVAL", lastReq?.verdict === "deny" ? "ACCESS DENIED" : "ROLE ASSUMED", "BUCKET ACCESS"][step]}
        />
      </FlowCanvas>

      <VerdictFlash show={!!flash} text={flash?.text ?? ""} tone={flash?.tone ?? "deny"} />
      <UseCaseNote>
        THIRD-PARTY AUDITORS + VENDORS: ALWAYS REQUIRE sts:ExternalId — WITHOUT IT, ANY ACCOUNT THE VENDOR TRUSTS CAN CHAIN INTO YOURS
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* ROUTER                                                              */
/* ================================================================== */

export function IamUseCases({ id, immersiveActive, immersiveToggle }: IamUseCasesProps) {
  if (id === "FEDERATION") return <FederationUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
  if (id === "LEAST_PRIV") return <LeastPrivUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
  return <CrossAccountUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
}
