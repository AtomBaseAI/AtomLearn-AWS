"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassPanel } from "@/components/shared/glass-panel";
import { FlowCanvas, FlowNode, FlowLink, FlowLabel } from "@/components/shared/flow";
import { Callout } from "@/components/shared/callout";
import { SimControls } from "@/components/shared/sim-controls";
import { AutoLog, logTs } from "@/components/shared/auto-log";
import { FullscreenToggle } from "@/components/shared/fullscreen-toggle";
import { useImmersiveView } from "@/hooks/use-immersive";
import { UseCaseTabs, type UcTabDef } from "@/components/shared/use-case";
import { SnsUseCases } from "./sns-usecases";
import { StatChip } from "@/components/shared/typography";
import { SNSIcon, UserIcon, SQSIcon, LambdaIcon, EmailNotificationIcon, HttpNotificationIcon } from "@/components/aws-icons";
import { Bell, Filter, RotateCw, Share2, Smartphone, Zap } from "lucide-react";

type LogTone = "aws" | "mint" | "danger" | "magenta" | "dim";
type Attr = "PURCHASE" | "REFUND";
type LinkStatus = "success" | "error" | "idle";

interface LogLine {
  id: number;
  text: string;
  tone: LogTone;
}

interface Sub {
  key: string;
  name: string;
  accepts: Attr[];
  icon: React.ReactNode;
  y: number;
  d: string;
}

const PUB_DOT_S = 0.35;
const FAN_STAGGER_S = 0.06;
const FAN_DOT_S = 0.55;
const PUB_INTERVAL_MS = 900;

const MAX_LOG = 48;

const SUBS: Sub[] = [
  {
    key: "sqs-queue",
    name: "SQS QUEUE",
    accepts: ["PURCHASE"],
    icon: <SQSIcon className="w-3 h-3" />,
    y: 9,
    d: "M59,46 C68,46 70,9 79,9",
  },
  {
    key: "lambda",
    name: "LAMBDA",
    accepts: ["PURCHASE", "REFUND"],
    icon: <LambdaIcon className="w-3 h-3" />,
    y: 29,
    d: "M59,48 C68,48 70,29 79,29",
  },
  {
    key: "email",
    name: "EMAIL",
    accepts: ["REFUND"],
    icon: <EmailNotificationIcon className="w-3 h-3" />,
    y: 50,
    d: "M59,50 C68,50 70,50 79,50",
  },
  {
    key: "webhook",
    name: "HTTPS WEBHOOK",
    accepts: ["PURCHASE", "REFUND"],
    icon: <HttpNotificationIcon className="w-3 h-3" />,
    y: 71,
    d: "M59,52 C68,52 70,71 79,71",
  },
  {
    key: "push",
    name: "MOBILE PUSH",
    accepts: ["PURCHASE", "REFUND"],
    icon: <Smartphone className="w-3 h-3" />,
    y: 91,
    d: "M59,54 C68,54 70,91 79,91",
  },
];

const IDLE_STATUSES: LinkStatus[] = ["idle", "idle", "idle", "idle", "idle"];

const BTN =
  "flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] border bg-black/50 backdrop-blur-md cyber-cut-sm";

const SNS_TABS = [
  { id: "GENERAL", label: "GENERAL", num: "01", icon: Bell },
  { id: "FAN_OUT", label: "FAN-OUT", num: "02", icon: Share2 },
  { id: "PUSH_SMS", label: "MOBILE PUSH & SMS", num: "03", icon: Smartphone },
  { id: "RETRY_DLQ", label: "RETRY & DLQ", num: "04", icon: RotateCw },
] as const satisfies readonly UcTabDef[];

type SnsTabId = (typeof SNS_TABS)[number]["id"];

export default function SNSVisualizer() {
  const immersive = useImmersiveView();
  const [tab, setTab] = useState<SnsTabId>("GENERAL");
  const [running, setRunning] = useState(false);
  const [filterOn, setFilterOn] = useState(false);

  const [fanKey, setFanKey] = useState(0);
  const [attr, setAttr] = useState<Attr>("PURCHASE");
  const [topicPulse, setTopicPulse] = useState(false);
  const [linkStatuses, setLinkStatuses] = useState<LinkStatus[]>([...IDLE_STATUSES]);
  const [subFlash, setSubFlash] = useState<boolean[]>([false, false, false, false, false]);
  const [counts, setCounts] = useState<number[]>([0, 0, 0, 0, 0]);
  const [published, setPublished] = useState(0);
  const [deliveries, setDeliveries] = useState(0);
  const [failed, setFailed] = useState(0);
  const [log, setLog] = useState<LogLine[]>([]);

  // refs as source of truth
  const logRef = useRef<LogLine[]>([]);
  const logIdRef = useRef(1);
  const fanKeyRef = useRef(0);
  const msgSeqRef = useRef(0);
  const publishedRef = useRef(0);
  const deliveriesRef = useRef(0);
  const failedRef = useRef(0);
  const countsRef = useRef<number[]>([0, 0, 0, 0, 0]);
  const filterRef = useRef(false);

  const pushLog = useCallback((text: string, tone: LogTone = "aws") => {
    logRef.current = [...logRef.current, { id: logIdRef.current++, text: `[${logTs()}] ${text}`, tone }].slice(-MAX_LOG);
  }, []);

  const flush = useCallback(() => {
    setLog(logRef.current);
    setPublished(publishedRef.current);
    setDeliveries(deliveriesRef.current);
    setFailed(failedRef.current);
    setCounts([...countsRef.current]);
  }, []);

  const publish = useCallback(() => {
    const key = ++fanKeyRef.current;
    const current: Attr = msgSeqRef.current % 2 === 0 ? "PURCHASE" : "REFUND";
    msgSeqRef.current++;
    publishedRef.current++;
    setFanKey(key);
    setAttr(current);
    setTopicPulse(true);
    pushLog(`> publish msg-${String(key).padStart(3, "0")} · order_type=${current}`, "aws");

    // pre-roll per-subscriber outcomes (match + rare 2% delivery failure)
    const outcomes = SUBS.map((s) => {
      const matched = !filterRef.current || s.accepts.includes(current);
      return { matched, failed: matched && Math.random() < 0.02 };
    });
    setLinkStatuses(
      outcomes.map((o): LinkStatus => (o.matched ? (o.failed ? "error" : "success") : "idle"))
    );

    SUBS.forEach((s, i) => {
      const o = outcomes[i];
      const arriveAt = PUB_DOT_S * 1000 + i * FAN_STAGGER_S * 1000 + FAN_DOT_S * 1000;
      if (!o.matched) {
        setTimeout(() => {
          pushLog(`> filter policy: ${s.key} skipped [${current}]`, "dim");
          flush();
        }, PUB_DOT_S * 1000 + i * FAN_STAGGER_S * 1000);
      } else if (o.failed) {
        setTimeout(() => {
          failedRef.current++;
          pushLog(`✗ delivery FAILED → ${s.name} — retrying w/ exp backoff`, "danger");
          flush();
        }, arriveAt);
      } else {
        setTimeout(() => {
          deliveriesRef.current++;
          countsRef.current[i] += 1;
          setSubFlash((p) => p.map((v, j) => (j === i ? true : v)));
          setTimeout(() => setSubFlash((p) => p.map((v, j) => (j === i ? false : v))), 800);
          pushLog(`> filter policy: ${s.key} matches [${current}] ✓ delivered`, "mint");
          flush();
        }, arriveAt);
      }
    });

    setTimeout(() => {
      setTopicPulse(false);
      flush();
    }, PUB_DOT_S * 1000 + 150);
    setTimeout(() => {
      if (fanKeyRef.current === key) {
        setLinkStatuses([...IDLE_STATUSES]);
        flush();
      }
    }, PUB_DOT_S * 1000 + (SUBS.length - 1) * FAN_STAGGER_S * 1000 + FAN_DOT_S * 1000 + 300);
    flush();
  }, [pushLog, flush]);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => publish(), PUB_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [running, publish]);

  const reset = () => {
    setRunning(false);
    logRef.current = [];
    fanKeyRef.current = 0;
    msgSeqRef.current = 0;
    publishedRef.current = 0;
    deliveriesRef.current = 0;
    failedRef.current = 0;
    countsRef.current = [0, 0, 0, 0, 0];
    setLog([]);
    setFanKey(0);
    setLinkStatuses([...IDLE_STATUSES]);
    setSubFlash([false, false, false, false, false]);
    setCounts([0, 0, 0, 0, 0]);
    setPublished(0);
    setDeliveries(0);
    setFailed(0);
    setTopicPulse(false);
  };

  const toggleFilter = () => {
    const v = !filterRef.current;
    filterRef.current = v;
    setFilterOn(v);
    pushLog(
      v
        ? "> filter policy ENFORCED — sqs-queue:[PURCHASE] email:[REFUND] others:[ALL]"
        : "> filter policy REMOVED — all subscribers receive everything",
      "magenta"
    );
    flush();
  };

  const fanOutRate = published > 0 ? `${(deliveries / published).toFixed(1)}×` : "0×";

  return (
    <div
      className={
        immersive.active
          ? "fixed inset-0 z-[70] bg-background p-3 sm:p-5 flex flex-col gap-3 sm:gap-4 overflow-y-auto cyber-scroll"
          : "flex flex-col gap-4"
      }
    >
      {/* MODULE TABS — sits directly below the module title card */}
      <UseCaseTabs tabs={SNS_TABS} active={tab} onChange={(t) => setTab(t as SnsTabId)} label="SNS views" />

      {tab !== "GENERAL" && (
        <SnsUseCases id={tab} immersiveActive={immersive.active} immersiveToggle={immersive.toggle} />
      )}

      {tab === "GENERAL" && (
        <>
      {/* MAIN GRID — animation left, stats + controls rail right */}
      <div className={`grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start ${immersive.active ? "flex-1" : ""}`}>
        <GlassPanel
          title="FLOW VIEW // TOPIC FAN-OUT"
          subtitle="1 PUBLISHER → SNS TOPIC → 5 SUBSCRIBERS"
          className="!p-0 overflow-hidden"
          delay={0.05}
          actions={<FullscreenToggle active={immersive.active} onToggle={immersive.toggle} />}
        >
          <FlowCanvas
            className={immersive.active ? "h-[min(560px,58vh)]" : "h-[440px] sm:h-[540px] lg:h-[560px]"}
            ariaLabel="SNS topic fan-out to five subscribers"
          >
            {/* LINKS */}
            <FlowLink
              key={`pub-${fanKey}`}
              d="M13,50 C21,50 23,50 31,50"
              status={topicPulse ? "flowing" : "idle"}
              dotDuration={PUB_DOT_S}
            />
            {SUBS.map((s, i) => (
              <FlowLink
                key={`fan-${i}-${fanKey}`}
                d={s.d}
                status={linkStatuses[i]}
                dotDuration={FAN_DOT_S}
                dotDelay={PUB_DOT_S + i * FAN_STAGGER_S}
              />
            ))}

            {/* PUBLISHER */}
            <FlowNode
              x={9}
              y={50}
              icon={<UserIcon className="w-3 h-3" />}
              label="ORDER SERVICE"
              sub="PUBLISHER"
              status={topicPulse ? "active" : "idle"}
              pulse={topicPulse}
              size="sm"
              delay={0.1}
            />
            <FlowLabel x={20} y={43} tone="aws">PUBLISH</FlowLabel>
            <FlowLabel x={65} y={14} tone="magenta">FAN-OUT ×5</FlowLabel>

            {/* TOPIC CORE */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ left: "45%", top: "50%", width: "150px" }}
            >
              {/* pulsing rings */}
              <motion.span
                aria-hidden="true"
                className="absolute inset-0 border border-aws/50"
                animate={{ scale: [1, 1.75], opacity: [0.65, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
              />
              <motion.span
                aria-hidden="true"
                className="absolute inset-0 border border-aws/35"
                animate={{ scale: [1, 1.75], opacity: [0.5, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 1 }}
              />
              <AnimatePresence>
                {topicPulse && (
                  <motion.span
                    key="shock"
                    className="absolute inset-0 border border-magenta/80"
                    initial={{ scale: 1, opacity: 0.9 }}
                    animate={{ scale: 2.1, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.65, ease: "easeOut" }}
                  />
                )}
              </AnimatePresence>

              <div className="glass box-glow cyber-cut p-2 relative">
                <div className="flex items-center gap-1.5 border-b border-aws/15 pb-1.5">
                  <SNSIcon className="w-3.5 h-3.5 text-aws shrink-0" />
                  <div className="flex flex-col leading-none">
                    <span className="text-[8px] font-bold tracking-[0.14em] text-aws">SNS TOPIC</span>
                    <span className="text-[6.5px] text-muted-foreground tracking-wider mt-0.5">orders-topic</span>
                  </div>
                  <motion.span
                    key={published}
                    initial={{ scale: 1.5, color: "#00ffa3" }}
                    animate={{ scale: 1, color: "#ff9900" }}
                    className="ml-auto text-[11px] font-extrabold"
                  >
                    {published}
                  </motion.span>
                </div>
                <div className="pt-1.5 flex items-center justify-between gap-1">
                  <span className="text-[6.5px] uppercase tracking-wider text-muted-foreground">order_type</span>
                  <AnimatePresence mode="wait" initial={false}>
                    {filterOn ? (
                      <motion.span
                        key={attr}
                        initial={{ opacity: 0, y: 4, scale: 0.85 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.85 }}
                        transition={{ duration: 0.16 }}
                        className={`text-[7px] font-extrabold tracking-[0.14em] border px-1.5 py-0.5 ${
                          attr === "PURCHASE"
                            ? "border-aws/50 bg-aws/10 text-aws"
                            : "border-magenta/50 bg-magenta/10 text-magenta"
                        }`}
                      >
                        {attr}
                      </motion.span>
                    ) : (
                      <motion.span
                        key="nofilter"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-[6.5px] font-bold tracking-wider text-muted-foreground/70"
                      >
                        NO FILTER
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>

            {/* SUBSCRIBERS */}
            {SUBS.map((s, i) => (
              <FlowNode
                key={s.key}
                x={87}
                y={s.y}
                icon={s.icon}
                label={`${s.name} [${counts[i]}]`}
                sub={filterOn ? (s.accepts.length === 2 ? "FILTER: ALL" : `FILTER: ${s.accepts[0]}`) : "SUBSCRIBED"}
                status={subFlash[i] ? (linkStatuses[i] === "error" ? "error" : "success") : "idle"}
                pulse={subFlash[i]}
                size="sm"
                delay={0.3 + i * 0.08}
              />
            ))}
          </FlowCanvas>
        </GlassPanel>

        {/* RIGHT RAIL — LIVE STATS + CONTROLS */}
        <div className="flex flex-col gap-4 min-w-0">
          <GlassPanel title="LIVE STATS" className="!p-0" delay={0.1}>
            <div className="p-3 grid grid-cols-2 gap-2">
              <StatChip label="MESSAGES PUBLISHED" value={String(published)} tone="aws" />
              <StatChip label="DELIVERIES TOTAL" value={String(deliveries)} tone="mint" />
              <StatChip label="FAN-OUT RATE" value={fanOutRate} tone="aws" />
              <StatChip label="FAILED" value={String(failed)} tone="magenta" />
            </div>
          </GlassPanel>

          <GlassPanel title="CONTROLS" className="!p-0" delay={0.12}>
            <div className="p-3 flex flex-col gap-2.5">
              <SimControls
                running={running}
                onToggle={() => setRunning((r) => !r)}
                onReset={reset}
                status={running ? "TOPIC LIVE — FAN-OUT STORM" : "TOPIC IDLE — PRESS RUN"}
              />
              <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">TOPIC ACTIONS</p>
              <div className="flex flex-wrap gap-2">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={publish}
                  aria-label="Publish one event to the topic"
                  className={`${BTN} border-aws/60 text-aws hover:bg-aws/10`}
                >
                  <Zap className="w-3 h-3" />
                  PUBLISH EVENT
                </motion.button>
                <button
                  type="button"
                  onClick={toggleFilter}
                  aria-label="Toggle message attributes and filter policy"
                  className={`${BTN} ${filterOn ? "border-magenta/60 text-magenta" : "border-foreground/25 text-muted-foreground"}`}
                >
                  <Filter className="w-3 h-3" />
                  MSG ATTRS + FILTER POLICY {filterOn ? "ON" : "OFF"}
                </button>
              </div>
              <p className="text-[8px] uppercase tracking-[0.18em] text-muted-foreground/80 font-bold">
                SQS <span className="text-aws">[PURCHASE]</span> · EMAIL{" "}
                <span className="text-magenta">[REFUND]</span> · λ / WEBHOOK / PUSH{" "}
                <span className="text-mint">[ALL]</span>
              </p>
            </div>
          </GlassPanel>
        </div>
      </div>

      {/* DELIVERY STREAM — full width below the grid */}
      <GlassPanel
        title="DELIVERY STREAM"
        subtitle={`orders-topic · ${SUBS.length} SUBSCRIPTIONS`}
        className="!p-0"
        delay={0.18}
      >
        <div className="p-3">
          <AutoLog lines={log} emptyText="NO SIGNALS YET — PRESS RUN OR PUBLISH AN EVENT" />
        </div>
      </GlassPanel>

      {/* KNOWLEDGE */}
      <div className={immersive.active ? "hidden" : "grid md:grid-cols-3 gap-3"}>
        <Callout type="exam" title="SNS → SQS fan-out is THE classic pattern">
          One publish fans out to N SQS queues — each consumer gets its own durable copy at its own pace,
          with independent retries and DLQs. Standard topics: unlimited throughput, 12.5M+ subscriptions
          per topic. FIFO topics (<span className="text-magenta">.fifo</span>) add exactly-once processing
          and per-MessageGroupId ordering for strict pipelines.
        </Callout>
        <Callout type="info" title="At-least-once delivery — design for idempotency">
          SNS stores messages redundantly across multiple AZs and retries transient subscriber failures
          with exponential backoff before parking them in the subscription&apos;s dead-letter queue.
          Duplicates are possible — consumers must dedupe (message IDs, idempotency keys).
        </Callout>
        <Callout type="tip" title="Filter at subscription time, not in code">
          Subscription filter policies evaluate message attributes before delivery — unmatched messages
          are never transmitted, cutting downstream cost, noise and fan-out load. Route by attribute
          (order_type, severity, tenant) instead of spinning up one topic per consumer.
        </Callout>
      </div>
        </>
      )}
    </div>
  );
}
