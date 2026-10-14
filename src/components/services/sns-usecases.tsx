"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Globe, MessageSquare, RotateCcw, Server, Smartphone, Zap } from "lucide-react";
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
import { LambdaIcon, SNSIcon, SQSIcon } from "@/components/aws-icons";

/* ================================================================== */
/* SHARED TYPES + HELPERS                                              */
/* ================================================================== */

export type SnsUseCaseId = "FAN_OUT" | "PUSH_SMS" | "RETRY_DLQ";

interface SnsUseCasesProps {
  id: SnsUseCaseId;
  immersiveActive?: boolean;
  immersiveToggle?: () => void;
}

interface UCLine {
  id: number;
  text: string;
  tone?: string;
}

const pad3 = (n: number) => String(n).padStart(3, "0");

/* ================================================================== */
/* TAB 02 — FAN-OUT: ONE PUBLISH → N PARALLEL SUBSCRIBERS              */
/* ================================================================== */

const FAN_SUBS = [
  { name: "SQS ORDERS", icon: <SQSIcon className="w-3 h-3" />, y: 20 },
  { name: "SQS ANALYTICS", icon: <SQSIcon className="w-3 h-3" />, y: 47 },
  { name: "EMAIL LAMBDA", icon: <LambdaIcon className="w-3 h-3" />, y: 74 },
];

const FAN_D = ["M54,46 C64,46 68,20 78,20", "M54,50 C64,50 68,47 78,47", "M54,54 C64,54 68,74 78,74"];

const FAN_STEPS = ["EVENT GENERATED", "TOPIC RECEIVES", "FAN-OUT ×3 PARALLEL", "SUBSCRIBERS PROCESS"];

function FanOutUseCase({ immersiveActive, immersiveToggle }: SnsUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [published, setPublished] = useState(0);
  const [delivered, setDelivered] = useState([0, 0, 0]);
  const [pubKey, setPubKey] = useState(0);
  const [topicPulse, setTopicPulse] = useState(false);
  const [linkLive, setLinkLive] = useState(false);
  const [subFlash, setSubFlash] = useState([false, false, false]);
  const [lines, setLines] = useState<UCLine[]>([]);
  const idRef = useRef(1);
  const seqRef = useRef(0);
  const pendT = useRef<ReturnType<typeof setTimeout>[]>([]);

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: idRef.current++, text, tone }]);

  const publish = () => {
    seqRef.current += 1;
    const n = seqRef.current;
    setPubKey(n);
    setPublished((p) => p + 1);
    setTopicPulse(true);
    setLinkLive(true);
    push(`PUBLISH msg-${pad3(n)} → 3 subscribers in 12ms`, "aws");
    FAN_SUBS.forEach((s, i) => {
      const t = setTimeout(() => {
        setDelivered((d) => d.map((v, j) => (j === i ? v + 1 : v)));
        setSubFlash((p) => p.map((v, j) => (j === i ? true : v)));
        push(`✓ delivered → ${s.name} — parallel copy ${i + 1}/3 (${12 + i * 4}ms)`, "mint");
        const t2 = setTimeout(() => setSubFlash((p) => p.map((v, j) => (j === i ? false : v))), 620);
        pendT.current.push(t2);
      }, 520 + i * 150);
      pendT.current.push(t);
    });
    const t3 = setTimeout(() => {
      setTopicPulse(false);
      setLinkLive(false);
    }, 1150);
    pendT.current.push(t3);
  };

  // scenario: publish → topic stores → fan-out → another publish → narration
  const { step, reset: resetStep } = useScenarioRunner(4, running, 1700, (s) => {
    if (s === 0 || s === 2) publish();
    else if (s === 1) push("topic stores msg redundantly across AZs — subscribers never poll the topic", "magenta");
    else push("each subscriber owns a durable copy — independent pace, retries and DLQs", "dim");
  });

  useEffect(
    () => () => {
      pendT.current.forEach((t) => clearTimeout(t));
    },
    []
  );

  const reset = () => {
    setRunning(false);
    resetStep();
    pendT.current.forEach((t) => clearTimeout(t));
    pendT.current = [];
    seqRef.current = 0;
    setPublished(0);
    setDelivered([0, 0, 0]);
    setPubKey(0);
    setTopicPulse(false);
    setLinkLive(false);
    setSubFlash([false, false, false]);
    setLines([]);
  };

  return (
    <UseCaseShell
      title="USE CASE // FAN-OUT — ONE EVENT, N CONSUMERS"
      subtitle="PUBLISHER → SNS TOPIC → SQS ORDERS + SQS ANALYTICS + EMAIL LAMBDA IN PARALLEL"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="PUBLISHED" value={published} />
          <UCStat label="SQS ORDERS" value={delivered[0]} tone="aws" />
          <UCStat label="SQS ANALYTICS" value={delivered[1]} tone="neon" />
          <UCStat label="EMAIL LAMBDA" value={delivered[2]} tone="mint" />
          <UCStat label="FAN-OUT RATE" value="×3" tone="magenta" />
          <UCStat label="FAN-OUT TIME" value="12ms" tone="neutral" />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? "TOPIC LIVE — AUTO-PUBLISH + FAN-OUT" : "IDLE — PRESS RUN OR PUBLISH NOW"}
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">TOPIC ACTIONS</p>
          <UCButton onClick={publish} ariaLabel="Publish one message to the topic right now">
            <Zap className="w-3 h-3" /> PUBLISH NOW
          </UCButton>
          <p className="text-[7.5px] leading-relaxed tracking-wider uppercase text-muted-foreground/80">
            every publish is fanned to all 3 subscribers simultaneously — no polling loops, no glue code
          </p>
        </>
      }
      logLines={lines}
      logTitle="FAN-OUT LOG // LIVE"
      logEmpty="PRESS RUN — OR HIT PUBLISH NOW TO FAN ONE MESSAGE OUT BY HAND"
    >
      <FlowCanvas ariaLabel="SNS fan-out use case diagram" className="h-full">
        <FlowLink key={`pub-${pubKey}`} d="M17,50 C24,50 27,50 33,50" status={topicPulse ? "flowing" : "idle"} dotDuration={0.5} />
        {FAN_D.map((d, i) => (
          <FlowLink key={`fan-${i}-${pubKey}`} d={d} status={linkLive ? "flowing" : "idle"} dotDuration={0.65} dotDelay={0.18 + i * 0.12} />
        ))}

        <FlowNode
          x={10}
          y={50}
          size="sm"
          delay={0.1}
          icon={<Server className="w-3 h-3" />}
          label="ORDER SERVICE"
          sub="PUBLISHER"
          status={topicPulse ? "active" : "idle"}
          pulse={topicPulse}
        />

        {/* SNS TOPIC CORE */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="absolute z-10 -translate-x-1/2 -translate-y-1/2 w-[140px] sm:w-[164px]"
          style={{ left: "43%", top: "50%" }}
        >
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 border border-aws/50"
            animate={{ scale: [1, 1.7], opacity: [0.6, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
          />
          {topicPulse && (
            <motion.span
              key={`shock-${pubKey}`}
              aria-hidden="true"
              className="absolute inset-0 border border-magenta/80"
              initial={{ scale: 1, opacity: 0.9 }}
              animate={{ scale: 2.1, opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          )}
          <div className="relative glass box-glow cyber-cut p-2">
            <div className="flex items-center gap-1.5 border-b border-aws/15 pb-1.5">
              <SNSIcon className="w-3.5 h-3.5 text-aws shrink-0" />
              <div className="flex flex-col leading-none">
                <span className="text-[8px] font-bold tracking-[0.14em] text-aws">SNS TOPIC</span>
                <span className="text-[6.5px] text-muted-foreground tracking-wider mt-0.5">orders-topic</span>
              </div>
              <motion.span
                key={published}
                initial={{ scale: 1.45, color: "#00ffa3" }}
                animate={{ scale: 1, color: "#ff9900" }}
                className="ml-auto text-[11px] font-extrabold tabular-nums"
              >
                {published}
              </motion.span>
            </div>
            <p className="pt-1.5 text-[6.5px] uppercase tracking-wider text-muted-foreground">
              FAN-OUT ×3 · AT-LEAST-ONCE · <span className="text-magenta">PARALLEL</span>
            </p>
          </div>
        </motion.div>

        {FAN_SUBS.map((s, i) => (
          <FlowNode
            key={s.name}
            x={87}
            y={s.y}
            size="sm"
            delay={0.35 + i * 0.08}
            icon={s.icon}
            label={`${s.name} [${delivered[i]}]`}
            sub="SUBSCRIBER"
            status={subFlash[i] ? "success" : "idle"}
            pulse={subFlash[i]}
          />
        ))}

        <FlowLabel x={20} y={42} tone="aws">PUBLISH</FlowLabel>
        <FlowLabel x={67} y={8} tone="magenta">FAN-OUT ×3 — PARALLEL COPIES</FlowLabel>
        <FlowLabel x={62} y={90} tone="mint">3 DURABLE COPIES — INDEPENDENT RETRIES · DLQS · PACE</FlowLabel>
        <StepBadge step={step} total={4} text={FAN_STEPS[step]} />
      </FlowCanvas>

      <UseCaseNote>
        ONE PUBLISH, EVERY CONSUMER: SQS queues buffer their own copy, the Lambda fires instantly — decouple producers from every consumer forever
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* TAB 03 — MOBILE PUSH & SMS (PLATFORM ENDPOINTS + COST)              */
/* ================================================================== */

const PUSH_RATE = 0.5 / 1_000_000; // $0.50 per 1M pushes
const SMS_RATE = 0.00645; // $ per SMS delivered

const AND_IDS = ["AND-01", "AND-02", "AND-03"];
const IOS_IDS = ["IOS-01", "IOS-02"];
const SMS_IDS = ["+1-555-0142", "+1-555-0198"];

const MSG_TPL = ["ORDER-SHIPPED #8412", "OTP 8842 — DO NOT SHARE", "FLASH SALE — 2H LEFT"];

const PS_STEPS = ["BROADCAST SENT", "PUSH DELIVERED", "SMS CHANNEL", "COST SETTLED"];

const fmtCost = (c: number) => (c >= 0.01 ? `$${c.toFixed(4)}` : `$${c.toFixed(7)}`);

function DeviceChip({ id, on }: { id: string; on: boolean }) {
  return (
    <span
      className={`px-1 py-0.5 border text-[6.5px] font-bold tracking-wider tabular-nums ${
        on ? "border-mint/80 bg-mint/15 text-mint box-glow" : "border-foreground/25 bg-black/50 text-muted-foreground"
      }`}
    >
      {id}
    </span>
  );
}

function PushSmsUseCase({ immersiveActive, immersiveToggle }: SnsUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [smsOn, setSmsOn] = useState(true);
  const [publishes, setPublishes] = useState(0);
  const [pushSent, setPushSent] = useState(0);
  const [smsSent, setSmsSent] = useState(0);
  const [cost, setCost] = useState(0);
  const [chipFlash, setChipFlash] = useState<Record<string, boolean>>({});
  const [ep, setEp] = useState({ gcm: false, apns: false, sms: false });
  const [lines, setLines] = useState<UCLine[]>([]);
  const idRef = useRef(1);
  const pendT = useRef<ReturnType<typeof setTimeout>[]>([]);

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: idRef.current++, text, tone }]);

  const flashChips = (ids: string[]) => {
    setChipFlash((p) => {
      const q = { ...p };
      ids.forEach((id) => (q[id] = true));
      return q;
    });
    const t = setTimeout(() => {
      setChipFlash((p) => {
        const q = { ...p };
        ids.forEach((id) => (q[id] = false));
        return q;
      });
    }, 700);
    pendT.current.push(t);
  };

  const flashEp = (which: "push" | "sms") => {
    setEp(which === "push" ? { gcm: true, apns: true, sms: false } : { gcm: false, apns: false, sms: true });
    const t = setTimeout(() => setEp({ gcm: false, apns: false, sms: false }), 800);
    pendT.current.push(t);
  };

  // scenario: broadcast → push delivery → sms delivery → settle cost
  const { step, reset: resetStep } = useScenarioRunner(4, running, 2000, (s) => {
    if (s === 0) {
      const tpl = MSG_TPL[publishes % MSG_TPL.length];
      setPublishes((p) => p + 1);
      push(`BROADCAST "${tpl}" → orders-topic — fan-out to ${smsOn ? "GCM + APNS + SMS" : "GCM + APNS (SMS off)"}`, "aws");
    } else if (s === 1) {
      setPushSent((v) => v + 5);
      setCost((c) => c + 5 * PUSH_RATE);
      flashChips([...AND_IDS, ...IOS_IDS]);
      flashEp("push");
      push(`push ×5 delivered — GCM 3 · APNS 2 — +$${(5 * PUSH_RATE).toFixed(7)}`, "mint");
    } else if (s === 2) {
      if (smsOn) {
        setSmsSent((v) => v + 2);
        setCost((c) => c + 2 * SMS_RATE);
        flashChips(SMS_IDS);
        flashEp("sms");
        push(`sms ×2 delivered — ${SMS_IDS.join(" · ")} — +$${(2 * SMS_RATE).toFixed(6)}`, "mint");
      } else {
        push("SMS channel disabled — push-only broadcast (0 SMS, $0.00 SMS spend)", "dim");
      }
    } else {
      push(`running bill: ${pushSent + 5} pushes × $0.50/M · ${smsOn ? smsSent + 2 : smsSent} SMS × $0.00645 — SNS meters per channel`, "magenta");
    }
  });

  useEffect(
    () => () => {
      pendT.current.forEach((t) => clearTimeout(t));
    },
    []
  );

  const toggleSms = () => {
    const next = !smsOn;
    setSmsOn(next);
    push(
      next
        ? "SMS CHANNEL ENABLED — transactional sms now costs $0.00645/message"
        : "SMS CHANNEL DISABLED — push-only mode — big $ saving on the same fan-out",
      next ? "mint" : "magenta"
    );
  };

  const reset = () => {
    setRunning(false);
    resetStep();
    pendT.current.forEach((t) => clearTimeout(t));
    pendT.current = [];
    setPublishes(0);
    setPushSent(0);
    setSmsSent(0);
    setCost(0);
    setChipFlash({});
    setEp({ gcm: false, apns: false, sms: false });
    setLines([]);
  };

  return (
    <UseCaseShell
      title="USE CASE // MOBILE PUSH & SMS — PLATFORM ENDPOINTS"
      subtitle="TOPIC → GCM (ANDROID) + APNS (IOS) + SMS CHANNEL — PER-CHANNEL COSTING"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="PUSH SENT" value={pushSent} tone="aws" />
          <UCStat label="SMS SENT" value={smsSent} tone="magenta" />
          <UCStat label="EST COST $" value={fmtCost(cost)} tone="neon" />
          <UCStat label="SMS GATE" value={smsOn ? "ON" : "OFF"} tone={smsOn ? "mint" : "danger"} />
          <UCStat label="BROADCASTS" value={publishes} tone="neutral" />
          <UCStat label="DEVICE TARGETS" value={smsOn ? 7 : 5} tone="neutral" />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? "BROADCASTING — DEVICES FLASH ON DELIVERY" : "IDLE — PRESS RUN TO BROADCAST"}
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">CHANNELS</p>
          <UCToggle on={smsOn} onClick={toggleSms} accent="magenta" ariaLabel="Toggle the SMS channel on or off">
            <MessageSquare className="w-3 h-3" /> SMS ENABLED {smsOn ? "ON" : "OFF"}
          </UCToggle>
          <p className="text-[7.5px] leading-relaxed tracking-wider uppercase text-muted-foreground/80">
            push $0.50 / 1M · sms $0.00645 / msg — flip the SMS gate and watch the $ counter react
          </p>
        </>
      }
      logLines={lines}
      logTitle="DELIVERY + COST LOG // LIVE"
      logEmpty="PRESS RUN — DEVICES FLASH AS EACH COPY LANDS"
    >
      <FlowCanvas ariaLabel="SNS mobile push and SMS use case diagram" className="h-full">
        <FlowLink d="M17,47 C34,47 50,16 80,16" status={ep.gcm ? "success" : "idle"} dotDuration={0.8} />
        <FlowLink d="M17,50 C34,50 50,40 80,40" status={ep.apns ? "success" : "idle"} dotDuration={0.8} dotDelay={0.1} />
        <FlowLink d="M17,53 C34,53 50,78 80,78" dashed status={ep.sms ? "success" : "idle"} dotDuration={0.9} dotDelay={0.15} />

        <FlowNode
          x={11}
          y={50}
          size="sm"
          delay={0.1}
          icon={<SNSIcon className="w-3 h-3" />}
          label="SNS TOPIC"
          sub="BROADCAST"
          status={running ? "active" : "idle"}
          pulse={running}
        />

        {/* DEVICE FARM — badge chips flash on delivery */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="absolute z-10 -translate-x-1/2 -translate-y-1/2 w-[196px] sm:w-[224px]"
          style={{ left: "46%", top: "52%" }}
        >
          <div className="glass box-glow cyber-cut p-2">
            <p className="text-[7px] font-bold uppercase tracking-[0.15em] text-aws border-b border-aws/15 pb-1">
              DEVICE FARM · {smsOn ? 7 : 5} TARGETS
            </p>
            <div className="flex flex-col gap-1 pt-1.5">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[6px] font-bold tracking-wider text-muted-foreground w-[52px] shrink-0">GCM · DROID</span>
                {AND_IDS.map((id) => (
                  <DeviceChip key={id} id={id} on={!!chipFlash[id]} />
                ))}
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[6px] font-bold tracking-wider text-muted-foreground w-[52px] shrink-0">APNS · IOS</span>
                {IOS_IDS.map((id) => (
                  <DeviceChip key={id} id={id} on={!!chipFlash[id]} />
                ))}
              </div>
              <div className={`flex items-center gap-1 flex-wrap ${smsOn ? "" : "opacity-40"}`}>
                <span className="text-[6px] font-bold tracking-wider text-muted-foreground w-[52px] shrink-0">SMS</span>
                {SMS_IDS.map((id) => (
                  <DeviceChip key={id} id={id} on={!!chipFlash[id]} />
                ))}
                {!smsOn && <span className="text-[6px] font-bold tracking-wider text-danger">CHANNEL OFF</span>}
              </div>
            </div>
          </div>
        </motion.div>

        <FlowNode x={88} y={16} size="sm" delay={0.4} icon={<Smartphone className="w-3 h-3" />} label="GCM · ANDROID" sub="PUSH ENDPOINT" status={ep.gcm ? "success" : "idle"} pulse={ep.gcm} />
        <FlowNode x={88} y={40} size="sm" delay={0.48} icon={<Smartphone className="w-3 h-3" />} label="APNS · IOS" sub="PUSH ENDPOINT" status={ep.apns ? "success" : "idle"} pulse={ep.apns} />
        <FlowNode x={88} y={78} size="sm" delay={0.56} icon={<MessageSquare className="w-3 h-3" />} label="SMS CHANNEL" sub={smsOn ? "ENABLED · $0.00645" : "DISABLED"} status={ep.sms ? "success" : smsOn ? "idle" : "idle"} pulse={ep.sms} />

        <FlowLabel x={24} y={38} tone="aws">BROADCAST</FlowLabel>
        <FlowLabel x={78} y={6} tone="aws">PLATFORM ENDPOINTS — ONE PER DEVICE</FlowLabel>
        <FlowLabel x={45} y={90} tone="default">PUSH $0.50/M · SMS $0.00645/MSG — TOGGLE THE SMS GATE</FlowLabel>
        <StepBadge step={step} total={4} text={PS_STEPS[step]} />
      </FlowCanvas>

      <UseCaseNote>
        MOBILE PUSH & SMS IN ONE TOPIC: register platform endpoints once, broadcast once — SNS routes GCM, APNS and SMS and meters each channel separately
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* TAB 04 — RETRY & DLQ (BACKOFF → DEAD LETTER QUEUE → REDRIVE)        */
/* ================================================================== */

const BACKOFF = [1, 2, 4]; // seconds, compressed ×10 in the sim
const EP_URL = "https://api.nexus.dev/hooks";

function RetryDlqUseCase({ immersiveActive, immersiveToggle }: SnsUseCasesProps) {
  const [running, setRunning] = useState(false);
  const [failing, setFailing] = useState(false);
  const [deliveries, setDeliveries] = useState(0);
  const [retries, setRetries] = useState(0);
  const [dlq, setDlq] = useState(0);
  const [redriven, setRedriven] = useState(0);
  const [retryNo, setRetryNo] = useState(0);
  const [http, setHttp] = useState<"200" | "500" | "—">("—");
  const [linkStatus, setLinkStatus] = useState<"idle" | "success" | "error">("idle");
  const [dlqPulse, setDlqPulse] = useState(false);
  const [flash, setFlash] = useState<null | "deny" | "ok">(null);
  const [lines, setLines] = useState<UCLine[]>([]);
  const idRef = useRef(1);
  const busyRef = useRef(false);
  const pendT = useRef<ReturnType<typeof setTimeout>[]>([]);
  const flashT = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: idRef.current++, text, tone }]);

  const attempt = () => {
    if (busyRef.current) return;
    if (!failing) {
      setDeliveries((v) => v + 1);
      setHttp("200");
      setLinkStatus("success");
      push(`POST ${EP_URL} — 200 OK — notification delivered`, "mint");
      const t = setTimeout(() => setLinkStatus("idle"), 900);
      pendT.current.push(t);
      return;
    }
    busyRef.current = true;
    setHttp("500");
    setLinkStatus("error");
    push(`POST ${EP_URL} — 500 Internal Server Error — subscription retry policy engaged`, "danger");
    const t1 = setTimeout(() => {
      setRetryNo(1);
      setRetries((v) => v + 1);
      push(`RETRY 1/3 — backoff ${BACKOFF[0]}s — still 500`, "neon");
    }, 700);
    const t2 = setTimeout(() => {
      setRetryNo(2);
      setRetries((v) => v + 1);
      push(`RETRY 2/3 — backoff ${BACKOFF[1]}s — still 500`, "neon");
    }, 1900);
    const t3 = setTimeout(() => {
      setRetryNo(3);
      setRetries((v) => v + 1);
      push(`RETRY 3/3 — backoff ${BACKOFF[2]}s — still 500 — retry policy exhausted`, "neon");
    }, 3300);
    const t4 = setTimeout(() => {
      setDlq((v) => v + 1);
      setDlqPulse(true);
      setFlash("deny");
      push("moved to DLQ after 3 failed attempts — message preserved for inspection", "danger");
      busyRef.current = false;
      setRetryNo(0);
      setLinkStatus("idle");
      const t5 = setTimeout(() => setDlqPulse(false), 900);
      const t6 = setTimeout(() => setFlash(null), 2000);
      pendT.current.push(t5, t6);
    }, 4100);
    pendT.current.push(t1, t2, t3, t4);
  };

  useTicker(running, attempt, 2600);

  useEffect(() => {
    return () => {
      pendT.current.forEach((t) => clearTimeout(t));
      if (flashT.current) clearTimeout(flashT.current);
    };
  }, []);

  const toggleFailing = () => {
    const next = !failing;
    setFailing(next);
    push(
      next
        ? `ENDPOINT FAILING — ${EP_URL} now returns 500s (chaos injected)`
        : "endpoint HEALED — 200 OK restored — deliveries resume normally",
      next ? "danger" : "mint"
    );
  };

  const redrive = () => {
    if (dlq === 0) {
      push("DLQ empty — nothing to redrive — endpoint healthy", "dim");
      return;
    }
    const n = dlq;
    if (failing) {
      push(`REDRIVE batch of ${n} — endpoint STILL returning 500 — messages bounce straight back to the DLQ`, "danger");
      setFlash("deny");
    } else {
      setDlq(0);
      setRedriven((v) => v + n);
      setDeliveries((v) => v + n);
      push(`REDRIVE batch of ${n} — re-injected from DLQ — 200 OK delivered ✓ — DLQ drained`, "mint");
      setFlash("ok");
    }
    if (flashT.current) clearTimeout(flashT.current);
    flashT.current = setTimeout(() => setFlash(null), 2000);
  };

  const reset = () => {
    setRunning(false);
    pendT.current.forEach((t) => clearTimeout(t));
    pendT.current = [];
    if (flashT.current) clearTimeout(flashT.current);
    busyRef.current = false;
    setFailing(false);
    setDeliveries(0);
    setRetries(0);
    setDlq(0);
    setRedriven(0);
    setRetryNo(0);
    setHttp("—");
    setLinkStatus("idle");
    setDlqPulse(false);
    setFlash(null);
    setLines([]);
  };

  const phaseIdx = retryNo > 0 ? 2 : linkStatus === "error" ? 1 : dlq > 0 ? 3 : 0;
  const phaseText = ["DELIVERING", "ENDPOINT FAILING", "RETRY BACKOFF", "PARKED IN DLQ"][phaseIdx];

  return (
    <UseCaseShell
      title="USE CASE // RETRY & DLQ — FAILURE IS A FIRST-CLASS CITIZEN"
      subtitle="DELIVERY FAILS → BACKOFF 1S → 2S → 4S → 3 ATTEMPTS → DEAD LETTER QUEUE → REDRIVE"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="DELIVERIES" value={deliveries} tone="mint" />
          <UCStat label="RETRIES" value={retries} tone="neon" />
          <UCStat label="DLQ DEPTH" value={dlq} tone={dlq > 0 ? "danger" : "neutral"} />
          <UCStat label="REDRIVEN" value={redriven} tone="magenta" />
          <UCStat label="ENDPOINT" value={failing ? "FAILING" : "HEALTHY"} tone={failing ? "danger" : "mint"} />
          <UCStat label="LAST HTTP" value={http} tone={http === "500" ? "danger" : http === "200" ? "mint" : "neutral"} />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? (failing ? "ENDPOINT DOWN — BACKOFF CYCLING" : "DELIVERING — 200 OK FLOW") : "IDLE — PRESS RUN TO DELIVER"}
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">CHAOS + RECOVERY</p>
          <UCToggle on={failing} onClick={toggleFailing} accent="magenta" ariaLabel="Toggle the endpoint between failing and healthy">
            <Globe className="w-3 h-3" /> ENDPOINT FAILING? {failing ? "YES · 500" : "NO · 200"}
          </UCToggle>
          <UCButton onClick={redrive} tone={dlq > 0 ? "aws" : "neutral"} ariaLabel="Redrive the dead letter queue back to the endpoint">
            <RotateCcw className="w-3 h-3" /> REDRIVE {dlq > 0 ? `(${dlq})` : ""}
          </UCButton>
          <p className="text-[7.5px] leading-relaxed tracking-wider uppercase text-muted-foreground/80">
            heal the endpoint first, then redrive — otherwise messages bounce straight back
          </p>
        </>
      }
      logLines={lines}
      logTitle="RETRY / DLQ LOG // LIVE"
      logEmpty="PRESS RUN — THEN FLIP ENDPOINT FAILING? TO WATCH THE BACKOFF + DLQ CYCLE"
    >
      <FlowCanvas ariaLabel="SNS retry and dead letter queue use case diagram" className="h-full">
        <FlowLink d="M18,40 C26,40 34,40 47,40" status={linkStatus === "success" ? "success" : linkStatus === "error" ? "error" : "idle"} dotDuration={0.7} />
        <FlowLink d="M58,46 C58,58 58,62 58,72" dashed status={dlqPulse ? "error" : "idle"} dotDuration={1.1} />

        <FlowNode
          x={12}
          y={40}
          size="sm"
          delay={0.1}
          icon={<SNSIcon className="w-3 h-3" />}
          label="SNS TOPIC"
          sub="orders-topic"
          status={running ? "active" : "idle"}
          pulse={running}
        />
        <FlowNode
          x={58}
          y={40}
          size="sm"
          delay={0.25}
          icon={<Globe className="w-3 h-3" />}
          label="HTTP ENDPOINT"
          sub={retryNo > 0 ? `RETRY ${retryNo}/3 · BACKOFF ${BACKOFF[retryNo - 1]}S` : failing ? "500 — FAILING" : "api.nexus.dev/hooks"}
          status={linkStatus === "error" ? "error" : linkStatus === "success" ? "success" : "idle"}
          pulse={linkStatus !== "idle"}
        />
        <FlowNode
          x={58}
          y={80}
          size="sm"
          delay={0.4}
          icon={<Globe className="w-3 h-3" />}
          label={`DEAD LETTER QUEUE [${dlq}]`}
          sub="REDRIVE POLICY · MAX 3"
          status={dlq > 0 ? "error" : "idle"}
          pulse={dlqPulse}
        />

        {/* ENDPOINT HEALTH CARD */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="absolute z-10 -translate-x-1/2 -translate-y-1/2 w-[190px] sm:w-[220px]"
          style={{ left: "26%", top: "76%" }}
        >
          <div className={`glass cyber-cut p-2 ${failing ? "shadow-[0_0_18px_rgba(255,51,85,0.3)]" : ""}`}>
            <div className="flex items-center justify-between pb-1 border-b border-aws/15">
              <span className="text-[6.5px] font-bold tracking-wider text-muted-foreground truncate">{EP_URL}</span>
              <span className={`text-[8px] font-extrabold px-1 border ${http === "500" ? "text-danger border-danger/60" : http === "200" ? "text-mint border-mint/60" : "text-muted-foreground border-foreground/20"}`}>
                {http === "—" ? "IDLE" : http}
              </span>
            </div>
            <div className="flex items-center gap-1.5 pt-1.5">
              <span className="text-[6px] font-bold tracking-wider text-muted-foreground">BACKOFF</span>
              {BACKOFF.map((b, i) => (
                <span
                  key={b}
                  className={`px-1.5 py-0.5 border text-[6.5px] font-bold tracking-wider tabular-nums ${
                    retryNo === i + 1
                      ? "border-neon/70 bg-neon/15 text-neon box-glow"
                      : retryNo > i + 1
                        ? "border-danger/60 text-danger"
                        : "border-foreground/20 text-muted-foreground/60"
                  }`}
                >
                  {b}S
                </span>
              ))}
              <span className="ml-auto text-[6px] font-bold tracking-wider text-muted-foreground/70">×10 COMPRESSED</span>
            </div>
          </div>
        </motion.div>

        <FlowLabel x={44} y={14} tone="aws">AT-LEAST-ONCE — RETRIES W/ EXPONENTIAL BACKOFF 1S → 2S → 4S</FlowLabel>
        <FlowLabel x={73} y={64} tone="danger">PARKED UNTIL REDRIVE</FlowLabel>
        <StepBadge step={phaseIdx} total={4} text={phaseText} />
      </FlowCanvas>

      <VerdictFlash show={flash === "deny"} text="MOVED TO DLQ — 3 ATTEMPTS FAILED" tone="deny" />
      <VerdictFlash show={flash === "ok"} text="REDELIVERED — DLQ DRAINED" tone="ok" />
      <UseCaseNote>
        DON&apos;T LOSE POISON: SNS retries transient failures with backoff, then parks dead messages in the DLQ — fix the endpoint, hit REDRIVE, zero data loss
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* ROUTER                                                              */
/* ================================================================== */

export function SnsUseCases({ id, immersiveActive, immersiveToggle }: SnsUseCasesProps) {
  if (id === "FAN_OUT") return <FanOutUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
  if (id === "PUSH_SMS") return <PushSmsUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
  return <RetryDlqUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
}
