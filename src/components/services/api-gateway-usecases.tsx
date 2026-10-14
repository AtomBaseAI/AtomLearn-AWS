"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Database,
  Globe,
  KeyRound,
  ShieldBan,
  ShieldOff,
  Zap,
} from "lucide-react";
import { FlowCanvas, FlowLabel, FlowLink, FlowNode } from "@/components/shared/flow";
import { SimControls } from "@/components/shared/sim-controls";
import {
  StepBadge,
  UCButton,
  UCStat,
  UseCaseNote,
  UseCaseShell,
  VerdictFlash,
  useTicker,
} from "@/components/shared/use-case";
import { APIGatewayIcon } from "@/components/aws-icons";

/* ================================================================== */
/* SHARED TYPES                                                        */
/* ================================================================== */

export type ApigwUseCaseId = "THROTTLING" | "USAGE_PLANS" | "CACHING";

interface ApigwUseCasesProps {
  id: ApigwUseCaseId;
  immersiveActive?: boolean;
  immersiveToggle?: () => void;
}

type UCLog = { id: number; text: string; tone?: string };
type FlashTone = "ok" | "deny" | "aws";

/* ================================================================== */
/* HOISTED PRIMITIVES (never nested inside components)                 */
/* ================================================================== */

function AGSlider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
  ariaLabel,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  ariaLabel: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[7.5px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
        <span className="text-[8px] font-extrabold tabular-nums text-aws">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        aria-label={ariaLabel}
        className="w-full h-1.5 accent-[#ff9900] cursor-pointer bg-black/60 border border-foreground/20"
      />
    </div>
  );
}

const bucketCls = (pct: number) =>
  pct > 50 ? "bg-mint" : pct > 20 ? "bg-neon" : "bg-danger";

const quotaCls = (pct: number) =>
  pct > 50 ? "bg-mint/80" : pct > 20 ? "bg-neon/80" : "bg-danger/80";

/* ================================================================== */
/* TAB 02 — THROTTLING & 429 (TOKEN BUCKET)                            */
/* ================================================================== */

interface ThrWave {
  id: number;
  ok: number;
  thr: number;
}

const WAVE_DOT_CAP = 44;

function WaveRow({ wave }: { wave: ThrWave }) {
  const okShown = Math.min(wave.ok, WAVE_DOT_CAP);
  const thrShown = Math.min(wave.thr, WAVE_DOT_CAP - okShown);
  const hidden = wave.ok + wave.thr - okShown - thrShown;
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-8 shrink-0 text-[6px] font-extrabold tracking-[0.14em] text-muted-foreground/60">W{String(wave.id).padStart(2, "0")}</span>
      <div className="flex flex-wrap gap-[3px] min-w-0">
        {Array.from({ length: okShown }, (_, i) => (
          <motion.span
            key={`o${i}`}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.18, delay: i * 0.006 }}
            className="h-[6px] w-[6px] bg-mint shadow-[0_0_5px_rgba(0,255,163,0.7)]"
          />
        ))}
        {Array.from({ length: thrShown }, (_, i) => (
          <motion.span
            key={`t${i}`}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.18, delay: 0.05 + i * 0.012 }}
            className="h-[6px] w-[6px] bg-danger shadow-[0_0_5px_rgba(255,51,85,0.8)]"
          />
        ))}
        {hidden > 0 && <span className="text-[6px] font-bold text-muted-foreground/60 self-center">+{hidden}</span>}
      </div>
      <span className="ml-auto shrink-0 text-[6.5px] font-extrabold tabular-nums">
        <span className="text-mint">{wave.ok}</span>
        <span className="text-muted-foreground/50"> / </span>
        <span className={wave.thr > 0 ? "text-danger" : "text-muted-foreground/40"}>{wave.thr}×429</span>
      </span>
    </div>
  );
}

function ThrottlingUseCase({ immersiveActive, immersiveToggle }: ApigwUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [limit, setLimit] = useState(800);
  const [waves, setWaves] = useState<ThrWave[]>([]);
  const [bucketPct, setBucketPct] = useState(100);
  const [totals, setTotals] = useState({ sent: 0, allowed: 0, throttled: 0 });
  const [flash, setFlash] = useState(false);
  const [lines, setLines] = useState<UCLog[]>([]);
  const idRef = useRef(1);
  const waveIdRef = useRef(0);
  const tokensRef = useRef(800);
  const totalsRef = useRef({ sent: 0, allowed: 0, throttled: 0 });
  const limitRef = useRef(800);
  const flashT = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    limitRef.current = limit;
    tokensRef.current = Math.min(tokensRef.current, limit);
  }, [limit]);

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: idRef.current++, text, tone }]);

  const showFlash = () => {
    setFlash(true);
    if (flashT.current) clearTimeout(flashT.current);
    flashT.current = setTimeout(() => setFlash(false), 780);
  };

  // one burst wave every ~420ms — token bucket evaluates every request
  useTicker(running, () => {
    const lim = limitRef.current;
    tokensRef.current = Math.min(lim, tokensRef.current + lim * 0.5); // refill 0.5s worth per wave
    const burst = Math.round(lim * (0.35 + Math.random() * 1.65)); // 0.35x–2.0x of the rate
    const allowed = Math.min(burst, Math.floor(tokensRef.current));
    tokensRef.current -= allowed;
    const thr = burst - allowed;

    waveIdRef.current += 1;
    totalsRef.current = {
      sent: totalsRef.current.sent + burst,
      allowed: totalsRef.current.allowed + allowed,
      throttled: totalsRef.current.throttled + thr,
    };
    setTotals({ ...totalsRef.current });
    setWaves((prev) => [...prev.slice(-4), { id: waveIdRef.current, ok: allowed, thr }]);
    setBucketPct(Math.round((tokensRef.current / lim) * 100));

    if (thr > 0) {
      push(
        `wave #${waveIdRef.current}: ${allowed} req → 200 ALLOWED · ${thr} req → 429 THROTTLED (bucket ${(tokensRef.current / lim * 100).toFixed(0)}%)`,
        thr > burst * 0.4 ? "danger" : "magenta"
      );
      if (Math.random() < 0.55) showFlash();
    } else {
      push(`wave #${waveIdRef.current}: ${allowed} req → 200 ALLOWED · bucket refilling`, "mint");
    }
  }, 420);

  useEffect(
    () => () => {
      if (flashT.current) clearTimeout(flashT.current);
    },
    []
  );

  const reset = () => {
    setRunning(false);
    setWaves([]);
    setBucketPct(100);
    setTotals({ sent: 0, allowed: 0, throttled: 0 });
    setFlash(false);
    setLines([]);
    tokensRef.current = limitRef.current;
    totalsRef.current = { sent: 0, allowed: 0, throttled: 0 };
    waveIdRef.current = 0;
  };

  const rate429 = totals.sent > 0 ? Math.round((totals.throttled / totals.sent) * 100) : null;
  const lastWaveAllowed = waves.length > 0 ? waves[waves.length - 1].ok : 0;

  return (
    <UseCaseShell
      title="USE CASE // THROTTLING — TOKEN BUCKET & 429"
      subtitle="BURST WAVES HIT THE LIMITER → ALLOWED (MINT) VS THROTTLED 429 (DANGER)"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="SENT" value={totals.sent} />
          <UCStat label="ALLOWED" value={totals.allowed} tone="mint" />
          <UCStat label="THROTTLED 429" value={totals.throttled} tone={totals.throttled > 0 ? "danger" : "neutral"} />
          <UCStat label="LIMIT" value={`${limit} REQ/S`} tone="neon" />
          <UCStat label="TOKEN BUCKET" value={`${bucketPct}%`} tone={bucketPct > 50 ? "mint" : bucketPct > 20 ? "neon" : "danger"} />
          <UCStat label="429 RATE" value={rate429 === null ? "—" : `${rate429}%`} tone={rate429 !== null && rate429 > 20 ? "danger" : "neutral"} />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? "BURST WAVES STREAMING — TOKENS DRAIN & REFILL" : "IDLE — PRESS RUN TO OPEN THE FIREHOSE"}
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">ACCOUNT RATE LIMIT</p>
          <AGSlider
            label="RATE LIMIT"
            value={limit}
            min={100}
            max={2000}
            step={50}
            unit=" REQ/S"
            onChange={setLimit}
            ariaLabel="Account level rate limit requests per second"
          />
        </>
      }
      logLines={lines}
      logTitle="LIMITER DECISION LOG // LIVE"
      logEmpty="PRESS RUN — EVERY DOT IS ONE REQUEST EVALUATED BY THE BUCKET"
    >
      <FlowCanvas ariaLabel="API Gateway throttling use case diagram" className="h-full">
        <FlowLink d="M17,40 C26,40 28,38 35,38" status={running ? "flowing" : "idle"} dotDuration={0.7} />
        <FlowLink
          d="M62,42 C70,42 72,42 79,42"
          status={running ? (lastWaveAllowed > 0 ? "success" : "idle") : "idle"}
          dot={running && lastWaveAllowed > 0}
          dotDuration={0.9}
        />

        <FlowNode
          x={11}
          y={40}
          size="sm"
          delay={0.1}
          icon={<Globe className="w-3 h-3" />}
          label="BURST CLIENT"
          sub="SPIKY TRAFFIC"
          status={running ? "active" : "idle"}
          pulse={running}
        />

        {/* LIMITER CARD */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25 }}
          className="absolute -translate-x-1/2 -translate-y-1/2 z-10 w-[190px] sm:w-[220px]"
          style={{ left: "48%", top: "40%" }}
        >
          <div className={`glass cyber-cut p-2.5 ${flash ? "border-danger/70 shadow-[0_0_22px_rgba(255,51,85,0.5)]" : ""}`}>
            <div className="flex items-center justify-between pb-1.5 border-b border-aws/15">
              <span className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.15em] text-aws">
                <APIGatewayIcon className="w-3.5 h-3.5" /> THROTTLE
              </span>
              <span className="text-[6.5px] font-extrabold px-1 py-0.5 border tracking-wider border-neon/50 text-neon">{limit} REQ/S</span>
            </div>
            <div className="pt-1.5">
              <div className="flex items-center justify-between text-[6.5px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
                <span>token bucket</span>
                <span className="tabular-nums text-foreground/80">{Math.round((bucketPct / 100) * limit)}/{limit}</span>
              </div>
              <div className="mt-1 h-2 border border-foreground/20 bg-black/70">
                <motion.div
                  className={`h-full ${bucketCls(bucketPct)}`}
                  animate={{ width: `${bucketPct}%` }}
                  transition={{ duration: 0.25, ease: "linear" }}
                />
              </div>
            </div>
            <div className="flex gap-1 pt-1.5">
              <span className="flex-1 border border-mint/40 bg-mint/10 px-1 py-0.5 text-[6.5px] font-bold tracking-wider text-mint text-center tabular-nums">
                ✓ {totals.allowed}
              </span>
              <span className={`flex-1 border px-1 py-0.5 text-[6.5px] font-bold tracking-wider text-center tabular-nums ${totals.throttled > 0 ? "border-danger/60 bg-danger/10 text-danger" : "border-foreground/15 text-muted-foreground"}`}>
                ✕ 429 · {totals.throttled}
              </span>
            </div>
          </div>
        </motion.div>

        <FlowNode
          x={87}
          y={42}
          size="sm"
          delay={0.45}
          icon={<Zap className="w-3 h-3" />}
          label="BACKEND"
          sub="λ PROXY"
          status={running && lastWaveAllowed > 0 ? "success" : "idle"}
          pulse={running && lastWaveAllowed > 0}
        />

        {/* REQUEST STREAM — wave dots */}
        <div className="absolute left-[4%] right-[4%] top-[60%] bottom-[8%] border border-foreground/10 bg-black/40 px-2 py-1.5 flex flex-col gap-1 overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[6.5px] font-extrabold tracking-[0.18em] text-muted-foreground uppercase">
              request stream — each square = 1 request
            </span>
            <span className="text-[6px] font-bold tracking-wider text-muted-foreground/60 uppercase">
              <span className="text-mint">■ allowed</span> · <span className="text-danger">■ 429 throttled</span>
            </span>
          </div>
          {waves.length === 0 && (
            <p className="text-[7px] tracking-wider text-muted-foreground/50 uppercase">no waves yet — press run</p>
          )}
          {waves.map((w) => (
            <WaveRow key={w.id} wave={w} />
          ))}
        </div>

        <FlowLabel x={50} y={13} tone="aws">TOKEN BUCKET — REFILLS AT {limit} REQ/S · BURSTS BORROW, THEN PAY</FlowLabel>
        <StepBadge step={running ? 1 : 0} total={2} text={running ? "EVALUATING REQUESTS" : "LIMITER ARMED"} />
      </FlowCanvas>

      <VerdictFlash show={flash} text="429 TOO MANY REQUESTS" tone="deny" />

      <UseCaseNote>
        429 IS A FEATURE, NOT A BUG: THE BUCKET ABSORBS SPIKES, REFILLS SMOOTHLY, AND PROTECTS YOUR BACKEND — RAISE THE LIMIT AND THE WAVE SURVIVES
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* TAB 03 — USAGE PLANS & API KEYS                                     */
/* ================================================================== */

interface UpClientMeta {
  name: string;
  keyId: string;
  plan: string;
  rate: string;
  quota: number;
  minReq: number;
  maxReq: number;
}

const UP_CLIENTS: UpClientMeta[] = [
  { name: "MOBILE-APP", keyId: "api-key · mob-7f3a2b9c", plan: "BASIC · 10K/MO", rate: "10 RPS BURST", quota: 10000, minReq: 2, maxReq: 5 },
  { name: "PARTNER", keyId: "api-key · prt-99d1c04e", plan: "ENTERPRISE · 1M/MO", rate: "50 RPS BURST", quota: 100000, minReq: 1, maxReq: 3 },
];

function ClientCard({
  name,
  keyId,
  plan,
  rate,
  req,
  quotaLeftPct,
  suspended,
}: {
  name: string;
  keyId: string;
  plan: string;
  rate: string;
  req: number;
  quotaLeftPct: number;
  suspended: boolean;
}) {
  return (
    <div className={`border px-2.5 py-2 w-[240px] sm:w-[280px] ${suspended ? "border-danger/60 bg-danger/[0.05]" : "border-foreground/15 bg-black/45"}`}>
      <div className="flex items-center gap-1.5 pb-1 border-b border-foreground/10">
        <KeyRound className={`w-3 h-3 ${suspended ? "text-danger" : "text-aws"}`} />
        <span className={`text-[8px] font-extrabold uppercase tracking-[0.16em] ${suspended ? "text-danger" : "text-aws"}`}>{name}</span>
        <span className={`ml-auto text-[6.5px] font-extrabold px-1 py-0.5 border tracking-wider ${suspended ? "text-danger border-danger/60" : "text-mint border-mint/50"}`}>
          {suspended ? "SUSPENDED" : "LIVE"}
        </span>
      </div>
      <p className="pt-1 text-[6.5px] font-bold tracking-[0.12em] text-muted-foreground uppercase">{keyId}</p>
      <div className="flex flex-wrap gap-1 pt-1">
        <span className="border border-neon/40 bg-neon/10 px-1 py-0.5 text-[6px] font-bold tracking-wider text-neon">{plan}</span>
        <span className="border border-foreground/20 px-1 py-0.5 text-[6px] font-bold tracking-wider text-muted-foreground">{rate}</span>
      </div>
      <div className="pt-1.5 flex items-center justify-between text-[6.5px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
        <span>monthly quota</span>
        <span className={`tabular-nums ${quotaLeftPct < 20 ? "text-danger" : "text-foreground/80"}`}>{quotaLeftPct}% LEFT</span>
      </div>
      <div className="mt-1 h-2 border border-foreground/20 bg-black/70">
        <motion.div
          className={`h-full ${quotaCls(quotaLeftPct)}`}
          animate={{ width: `${quotaLeftPct}%` }}
          transition={{ duration: 0.3, ease: "linear" }}
        />
      </div>
      <p className="pt-1 text-[6.5px] font-bold tracking-wider text-muted-foreground/70 uppercase tabular-nums">
        {req} requests this session
      </p>
    </div>
  );
}

function UsagePlansUseCase({ immersiveActive, immersiveToggle }: ApigwUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [suspended, setSuspended] = useState(false);
  const [stats, setStats] = useState({ mobileReq: 0, partnerReq: 0, mobileUsed: 0, partnerUsed: 0, forbidden: 0 });
  const [flash, setFlash] = useState(false);
  const [lines, setLines] = useState<UCLog[]>([]);
  const idRef = useRef(1);
  const suspendedRef = useRef(false);
  const statsRef = useRef(stats);
  const flashT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flipRef = useRef(false);
  useEffect(() => {
    suspendedRef.current = suspended;
  }, [suspended]);
  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: idRef.current++, text, tone }]);

  const showFlash = () => {
    setFlash(true);
    if (flashT.current) clearTimeout(flashT.current);
    flashT.current = setTimeout(() => setFlash(false), 720);
  };

  // traffic per client every ~900ms — suspended keys bounce with 403
  useTicker(running, () => {
    const [mobile, partner] = UP_CLIENTS;
    const mN = mobile.minReq + Math.floor(Math.random() * (mobile.maxReq - mobile.minReq + 1));
    const pN = partner.minReq + Math.floor(Math.random() * (partner.maxReq - partner.minReq + 1));
    const s = statsRef.current;
    flipRef.current = !flipRef.current;

    let next = { ...s };
    if (suspendedRef.current) {
      next.forbidden += mN;
      if (flipRef.current) {
        push(`403 Forbidden — key mob-7f3a2b9c DISABLED via usage plan — ${mN} requests bounced`, "danger");
        showFlash();
      }
    } else {
      next.mobileReq += mN;
      next.mobileUsed += mN;
      const pctLeft = Math.max(0, Math.round((1 - next.mobileUsed / mobile.quota) * 100));
      if (flipRef.current) {
        push(`MOBILE-APP key mob-7f3a2b9c → 200 OK ×${mN} — quota ${pctLeft}% left`, "aws");
      }
    }
    next.partnerReq += pN;
    next.partnerUsed += pN;
    const pPctLeft = Math.max(0, Math.round((1 - next.partnerUsed / partner.quota) * 100));
    if (flipRef.current) {
      push(`PARTNER key prt-99d1c04e → 200 OK ×${pN} — quota ${pPctLeft}% left`, "mint");
    }
    setStats(next);
  }, 900);

  useEffect(
    () => () => {
      if (flashT.current) clearTimeout(flashT.current);
    },
    []
  );

  const toggleSuspend = () => {
    const v = !suspended;
    setSuspended(v);
    if (v) {
      push("POST /usage-plans/basic/keys/mob-7f3a2b9c — key DISABLED — client starts eating 403s", "danger");
      showFlash();
    } else {
      push("POST /usage-plans/basic/keys/mob-7f3a2b9c — key RE-ENABLED — 200s resume", "mint");
    }
  };

  const reset = () => {
    setRunning(false);
    setStats({ mobileReq: 0, partnerReq: 0, mobileUsed: 0, partnerUsed: 0, forbidden: 0 });
    setFlash(false);
    setLines([]);
    flipRef.current = false;
  };

  const mobilePct = Math.max(0, Math.round((1 - stats.mobileUsed / UP_CLIENTS[0].quota) * 100));
  const partnerPct = Math.max(0, Math.round((1 - stats.partnerUsed / UP_CLIENTS[1].quota) * 100));

  return (
    <UseCaseShell
      title="USE CASE // USAGE PLANS & API KEYS — PER-CLIENT METERING"
      subtitle="TWO CLIENTS · TWO QUOTAS · SUSPEND A KEY AND WATCH IT EAT 403S"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="MOBILE-APP REQ" value={stats.mobileReq} tone={suspended ? "danger" : "aws"} />
          <UCStat label="PARTNER REQ" value={stats.partnerReq} tone="mint" />
          <UCStat label="403S" value={stats.forbidden} tone={stats.forbidden > 0 ? "danger" : "neutral"} />
          <UCStat label="MOBILE QUOTA" value={`${mobilePct}%`} tone={mobilePct > 50 ? "aws" : mobilePct > 20 ? "neon" : "danger"} />
          <UCStat label="PARTNER QUOTA" value={`${partnerPct}%`} tone="mint" />
          <UCStat label="KEY STATE" value={suspended ? "DISABLED" : "LIVE"} tone={suspended ? "danger" : "mint"} />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? "CLIENTS POUNDING THE API — QUOTAS DRAINING" : "IDLE — PRESS RUN TO START THE TRAFFIC"}
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">KEY MANAGEMENT</p>
          <UCButton
            onClick={toggleSuspend}
            tone={suspended ? "mint" : "danger"}
            ariaLabel={suspended ? "Re-enable the mobile app API key" : "Suspend the mobile app API key"}
          >
            {suspended ? <ShieldOff className="w-3 h-3" /> : <ShieldBan className="w-3 h-3" />}
            {suspended ? "RE-ENABLE MOBILE-APP KEY" : "SUSPEND MOBILE-APP KEY"}
          </UCButton>
        </>
      }
      logLines={lines}
      logTitle="KEY & QUOTA LOG // LIVE"
      logEmpty="PRESS RUN — OR SUSPEND THE MOBILE-APP KEY TO SEE 403S"
    >
      <FlowCanvas ariaLabel="API Gateway usage plans use case diagram" className="h-full">
        <FlowLink
          d="M56,20 C66,20 72,40 78,45"
          status={suspended ? "error" : running ? "flowing" : "idle"}
          dot={running && !suspended}
          dotDuration={0.8}
        />
        <FlowLink d="M56,68 C66,68 72,56 78,52" status={running ? "flowing" : "idle"} dotDuration={0.9} dotDelay={0.2} />

        <div className="absolute left-[5%] top-[10%] z-10">
          <ClientCard
            name={UP_CLIENTS[0].name}
            keyId={UP_CLIENTS[0].keyId}
            plan={UP_CLIENTS[0].plan}
            rate={UP_CLIENTS[0].rate}
            req={stats.mobileReq}
            quotaLeftPct={mobilePct}
            suspended={suspended}
          />
        </div>
        <div className="absolute left-[5%] top-[56%] z-10">
          <ClientCard
            name={UP_CLIENTS[1].name}
            keyId={UP_CLIENTS[1].keyId}
            plan={UP_CLIENTS[1].plan}
            rate={UP_CLIENTS[1].rate}
            req={stats.partnerReq}
            quotaLeftPct={partnerPct}
            suspended={false}
          />
        </div>

        <FlowNode
          x={85}
          y={49}
          size="sm"
          delay={0.35}
          icon={<APIGatewayIcon className="w-3 h-3" />}
          label="API GATEWAY"
          sub="USAGE PLAN CHECK"
          status={running ? "active" : "idle"}
          pulse={running}
        />

        <AnimatePresence>
          {suspended && (
            <motion.div
              key="e403"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute z-20"
              style={{ left: "64%", top: "36%" }}
            >
              <FlowLabel x={0} y={0} tone="danger">403 · KEY DISABLED</FlowLabel>
            </motion.div>
          )}
        </AnimatePresence>

        <FlowLabel x={62} y={10} tone="aws">USAGE PLAN = RATE LIMIT + BURST + MONTHLY QUOTA PER KEY</FlowLabel>
        <FlowLabel x={30} y={92} tone="default">SUSPENDED KEYS FAIL CLOSED AT THE GATEWAY — THE BACKEND NEVER SEES THEM</FlowLabel>
        <StepBadge step={suspended ? 2 : running ? 1 : 0} total={3} text={suspended ? "KEY DISABLED — 403S FLOWING" : running ? "METERING TRAFFIC" : "PLANS ARMED"} />
      </FlowCanvas>

      <VerdictFlash show={flash} text="403 FORBIDDEN — KEY SUSPENDED" tone="deny" />

      <UseCaseNote>
        BUILD TIERS: FREE 10K/MO, STARTER 100K, ENTERPRISE 1M — EACH KEY GETS ITS OWN THROTTLE ENVELOPE, SO ONE NOISY CUSTOMER CAN NEVER STARVE THE OTHERS
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* TAB 04 — EDGE CACHING (HIT / MISS / TTL / INVALIDATION)             */
/* ================================================================== */

const CACHE_HIT_MS = 18;
const CACHE_MISS_MS = 240;

function CachingUseCase({ immersiveActive, immersiveToggle }: ApigwUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [ttl, setTtl] = useState(60);
  const [ttlLeft, setTtlLeft] = useState(0);
  const [cached, setCached] = useState(false);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [invalidations, setInvalidations] = useState(0);
  const [avgLat, setAvgLat] = useState<number | null>(null);
  const [last, setLast] = useState<{ kind: "HIT" | "MISS"; ms: number } | null>(null);
  const [originBusy, setOriginBusy] = useState(false);
  const [reqNo, setReqNo] = useState(0);
  const [flash, setFlash] = useState<{ text: string; tone: FlashTone } | null>(null);
  const [lines, setLines] = useState<UCLog[]>([]);
  const idRef = useRef(1);
  const ttlRef = useRef(60);
  const ttlLeftRef = useRef(0);
  const cachedRef = useRef(false);
  const latRef = useRef<number[]>([]);
  const reqNoRef = useRef(0);
  const flipRef = useRef(false);
  const flashT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    ttlRef.current = ttl;
  }, [ttl]);

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: idRef.current++, text, tone }]);

  const showFlash = (text: string, tone: FlashTone) => {
    setFlash({ text, tone });
    if (flashT.current) clearTimeout(flashT.current);
    flashT.current = setTimeout(() => setFlash(null), 1400);
  };

  // request stream — one GET /products every ~1.1s
  useTicker(running, () => {
    const t = ttlRef.current;
    flipRef.current = !flipRef.current;
    reqNoRef.current += 1;
    setReqNo(reqNoRef.current);

    if (cachedRef.current && ttlLeftRef.current > 0) {
      const n = hits + 1;
      setHits(n);
      setLast({ kind: "HIT", ms: CACHE_HIT_MS });
      latRef.current = [...latRef.current.slice(-59), CACHE_HIT_MS];
      setAvgLat(Math.round(latRef.current.reduce((a, b) => a + b, 0) / latRef.current.length));
      if (flipRef.current) {
        push(`GET /products → CACHE HIT ${CACHE_HIT_MS}ms (age ${t - ttlLeftRef.current}s/${t}s) — origin untouched`, "mint");
      }
      return;
    }

    // MISS — integration hop to the origin, then fill the cache
    const ms = CACHE_MISS_MS - 12 + Math.floor(Math.random() * 24);
    const n = misses + 1;
    setMisses(n);
    setLast({ kind: "MISS", ms });
    latRef.current = [...latRef.current.slice(-59), ms];
    setAvgLat(Math.round(latRef.current.reduce((a, b) => a + b, 0) / latRef.current.length));
    setOriginBusy(true);
    timersRef.current.push(setTimeout(() => setOriginBusy(false), 340));
    push(`GET /products → MISS → λ/products integration ${ms}ms — caching entry (TTL ${t}s)`, "aws");
    if (flipRef.current) showFlash("CACHE MISS — ORIGIN FETCH", "aws");

    cachedRef.current = true;
    ttlLeftRef.current = t;
    setCached(true);
    setTtlLeft(t);
  }, 1100);

  // TTL countdown — one demo second per tick
  useTicker(running && cached, () => {
    const next = ttlLeftRef.current - 1;
    ttlLeftRef.current = Math.max(0, next);
    setTtlLeft(Math.max(0, next));
    if (next <= 0) {
      cachedRef.current = false;
      setCached(false);
      push(`TTL ${ttlRef.current}s EXPIRED — entry evicted at edge — next GET will MISS`, "danger");
    }
  }, 1000);

  useEffect(
    () => () => {
      if (flashT.current) clearTimeout(flashT.current);
      timersRef.current.forEach((tm) => clearTimeout(tm));
    },
    []
  );

  const invalidate = () => {
    if (!cachedRef.current) {
      push("invalidate ignored — edge cache already cold, nothing to purge", "dim");
      return;
    }
    setInvalidations((n) => n + 1);
    cachedRef.current = false;
    ttlLeftRef.current = 0;
    setCached(false);
    setTtlLeft(0);
    push("POST /stages/prod/cache/invalidate — edge entry PURGED — next GET is a MISS", "danger");
    showFlash("CACHE INVALIDATED", "deny");
  };

  const reset = () => {
    setRunning(false);
    setTtlLeft(0);
    setCached(false);
    setHits(0);
    setMisses(0);
    setInvalidations(0);
    setAvgLat(null);
    setLast(null);
    setOriginBusy(false);
    setReqNo(0);
    setFlash(null);
    setLines([]);
    ttlLeftRef.current = 0;
    cachedRef.current = false;
    latRef.current = [];
    reqNoRef.current = 0;
    flipRef.current = false;
  };

  const totalGets = hits + misses;
  const hitRatio = totalGets > 0 ? Math.round((hits / totalGets) * 100) : null;

  return (
    <UseCaseShell
      title="USE CASE // EDGE CACHING — 18MS HITS AT THE BORDER"
      subtitle="GET /PRODUCTS → TTL COUNTDOWN → MISS PAYS THE 240MS ORIGIN HOP"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="HIT RATIO" value={hitRatio === null ? "—" : `${hitRatio}%`} tone={hitRatio !== null && hitRatio >= 60 ? "mint" : "neutral"} />
          <UCStat label="AVG LATENCY" value={avgLat === null ? "—" : `${avgLat} MS`} tone={avgLat !== null && avgLat < 60 ? "mint" : "neon"} />
          <UCStat label="INVALIDATIONS" value={invalidations} tone={invalidations > 0 ? "magenta" : "neutral"} />
          <UCStat label="TTL LEFT" value={cached ? `${ttlLeft}S` : totalGets > 0 ? "EXPIRED" : "—"} tone={cached ? "aws" : totalGets > 0 ? "danger" : "neutral"} />
          <UCStat label="GETS SERVED" value={totalGets} tone="neutral" />
          <UCStat label="CACHE STATE" value={cached ? `WARM · ${hits}H/${misses}M` : "COLD"} tone={cached ? "mint" : "neutral"} />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? "TRAFFIC STREAMING — HITS AT 18MS · MISSES AT 240MS" : "IDLE — PRESS RUN TO START REQUESTS"}
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">CACHE CONFIG</p>
          <AGSlider
            label="CACHE TTL"
            value={ttl}
            min={30}
            max={300}
            step={10}
            unit="S"
            onChange={(v) => {
              setTtl(v);
              push(`stage cache TTL updated → ${v}s — applies to the next cache fill`, "magenta");
            }}
            ariaLabel="Edge cache time to live in demo seconds"
          />
          <UCButton onClick={invalidate} tone="danger" ariaLabel="Invalidate the edge cache">
            <Database className="w-3 h-3" /> INVALIDATE CACHE
          </UCButton>
        </>
      }
      logLines={lines}
      logTitle="EDGE CACHE LOG // LIVE"
      logEmpty="PRESS RUN — FIRST GET WARMS THE EDGE, THE REST FLY AT 18MS"
    >
      <FlowCanvas ariaLabel="API Gateway edge caching use case diagram" className="h-full">
        <FlowLink d="M18,50 C26,50 28,48 33,48" status={running ? "flowing" : "idle"} dotDuration={0.8} />
        <FlowLink
          d="M58,52 C66,53 70,53 77,53"
          status={originBusy ? "flowing" : "idle"}
          dot={originBusy}
          dotDuration={0.55}
        />

        <FlowNode
          x={12}
          y={50}
          size="sm"
          delay={0.1}
          icon={<Globe className="w-3 h-3" />}
          label="CLIENT"
          sub="GET /PRODUCTS"
          status={running ? "active" : "idle"}
          pulse={running}
        />

        {/* EDGE CACHE CARD */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25 }}
          className="absolute -translate-x-1/2 -translate-y-1/2 z-10 w-[180px] sm:w-[210px]"
          style={{ left: "45%", top: "46%" }}
        >
          <div className={`glass cyber-cut p-2.5 ${last?.kind === "HIT" ? "border-mint/60" : last?.kind === "MISS" ? "border-aws/60 box-glow" : ""}`}>
            <div className="flex items-center justify-between pb-1.5 border-b border-aws/15">
              <span className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.15em] text-aws">
                <APIGatewayIcon className="w-3.5 h-3.5" /> EDGE CACHE
              </span>
              <span className={`text-[6.5px] font-extrabold px-1 py-0.5 border tracking-wider ${cached ? "text-mint border-mint/60" : "text-muted-foreground border-foreground/25"}`}>
                {cached ? "WARM" : "COLD"}
              </span>
            </div>
            <div className="pt-1.5 flex items-center justify-between text-[6.5px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
              <span>ttl countdown</span>
              <span className={`tabular-nums ${cached ? "text-aws" : "text-muted-foreground/60"}`}>{cached ? `${ttlLeft}s / ${ttl}s` : "—"}</span>
            </div>
            <div className="mt-1 h-2 border border-foreground/20 bg-black/70">
              <motion.div
                className={`h-full ${ttlLeft > ttl * 0.25 ? "bg-aws/80" : "bg-danger/80"}`}
                animate={{ width: cached ? `${(ttlLeft / ttl) * 100}%` : "0%" }}
                transition={{ duration: 0.4, ease: "linear" }}
              />
            </div>
            <div className="pt-1.5 flex gap-1">
              <span className="flex-1 border border-mint/40 bg-mint/10 px-1 py-0.5 text-[6.5px] font-bold tracking-wider text-mint text-center tabular-nums">
                HIT {hits} · {CACHE_HIT_MS}MS
              </span>
              <span className="flex-1 border border-neon/40 bg-neon/10 px-1 py-0.5 text-[6.5px] font-bold tracking-wider text-neon text-center tabular-nums">
                MISS {misses} · ~{CACHE_MISS_MS}MS
              </span>
            </div>
            <p className="pt-1 text-[6px] font-bold tracking-[0.14em] text-muted-foreground/70 uppercase">
              last: {last ? `${last.kind} ${last.ms}ms` : "—"} · req #{reqNo || 0}
            </p>
          </div>
        </motion.div>

        {/* ORIGIN with integration hop bar */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="absolute -translate-x-1/2 -translate-y-1/2 z-10 w-[140px] sm:w-[160px]"
          style={{ left: "86%", top: "46%" }}
        >
          <div className={`border px-2 py-1.5 ${originBusy ? "border-aws/70 bg-aws/[0.07] box-glow" : "border-foreground/20 bg-black/45"}`}>
            <div className="flex items-center gap-1.5">
              <Zap className={`w-3 h-3 ${originBusy ? "text-aws" : "text-muted-foreground"}`} />
              <span className={`text-[8px] font-extrabold uppercase tracking-[0.14em] ${originBusy ? "text-aws" : "text-muted-foreground"}`}>λ PRODUCTS</span>
            </div>
            <p className="text-[6px] font-bold tracking-[0.16em] text-muted-foreground/70 uppercase pt-0.5">INTEGRATION · AWS_PROXY</p>
            <div className="mt-1 h-1.5 border border-foreground/15 bg-black/60">
              {originBusy ? (
                <motion.div
                  key={`hop-${reqNo}`}
                  className="h-full bg-aws"
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 0.24, ease: "linear" }}
                />
              ) : (
                <div className="h-full w-0" />
              )}
            </div>
            <p className={`text-[6px] font-bold tracking-wider pt-0.5 uppercase ${originBusy ? "text-aws" : "text-muted-foreground/50"}`}>
              {originBusy ? "ORIGIN HOP ~240MS…" : "IDLE — CACHE SERVES"}
            </p>
          </div>
        </motion.div>

        <FlowLabel x={50} y={13} tone="aws">CACHED AT THE EDGE — THE ORIGIN SLEEPS WHILE THE TTL TICKS</FlowLabel>
        <FlowLabel x={50} y={88} tone="magenta">INVALIDATION = INSTANT MISS — USE PATH-BY-PATH, NEVER WILDCARDS</FlowLabel>
        <StepBadge step={cached ? 1 : 0} total={2} text={cached ? `WARM — ${ttlLeft}S LEFT` : running ? "FILLING CACHE" : "CACHE COLD"} />
      </FlowCanvas>

      <VerdictFlash show={flash !== null} text={flash?.text ?? ""} tone={flash?.tone ?? "aws"} />

      <UseCaseNote>
        A 60S TTL ON /PRODUCTS TURNS 240MS ORIGIN HOPS INTO 18MS EDGE HITS — HIT RATIO PAYS YOUR BILL, INVALIDATION SPENDS IT
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* ROUTER                                                              */
/* ================================================================== */

export function ApigwUseCases({ id, immersiveActive, immersiveToggle }: ApigwUseCasesProps) {
  if (id === "THROTTLING") return <ThrottlingUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
  if (id === "USAGE_PLANS") return <UsagePlansUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
  return <CachingUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
}
