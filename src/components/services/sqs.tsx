"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassPanel } from "@/components/shared/glass-panel";
import { FlowCanvas, FlowNode, FlowLink, FlowLabel } from "@/components/shared/flow";
import { Callout } from "@/components/shared/callout";
import { SimControls } from "@/components/shared/sim-controls";
import { StatChip } from "@/components/shared/typography";
import { FullscreenToggle } from "@/components/shared/fullscreen-toggle";
import { useImmersiveView } from "@/hooks/use-immersive";
import { SNSIcon, LambdaIcon, SQSIcon, EC2Icon } from "@/components/aws-icons";
import { Skull, Layers, Timer } from "lucide-react";

interface Msg {
  id: number;
  receives: number;
  poison: boolean;
}

const MAX_SHOW = 6;

export default function SQSVisualizer() {
  const immersive = useImmersiveView();
  const [queue, setQueue] = useState<Msg[]>([]);
  const [dlq, setDlq] = useState<Msg[]>([]);
  const [workers, setWorkers] = useState<(Msg | null)[]>([null, null]);
  const [processed, setProcessed] = useState(0);
  const [failed, setFailed] = useState(0);
  const [running, setRunning] = useState(false);
  const [fifo, setFifo] = useState(false);
  const [longPolling, setLongPolling] = useState(true);
  const [prodActive, setProdActive] = useState(false);
  const [consActive, setConsActive] = useState<[boolean, boolean]>([false, false]);
  const [dlqActive, setDlqActive] = useState(false);

  const idRef = useRef(1);
  const queueRef = useRef<Msg[]>([]);
  const workersRef = useRef<(Msg | null)[]>([null, null]);
  const dlqRef = useRef<Msg[]>([]);
  const processedRef = useRef(0);
  const failedRef = useRef(0);

  const reset = () => {
    setRunning(false);
    queueRef.current = [];
    workersRef.current = [null, null];
    dlqRef.current = [];
    processedRef.current = 0;
    failedRef.current = 0;
    setQueue([]);
    setDlq([]);
    setWorkers([null, null]);
    setProcessed(0);
    setFailed(0);
    setProdActive(false);
    setConsActive([false, false]);
    setDlqActive(false);
  };

  const injectPoison = () => {
    queueRef.current.push({ id: idRef.current++, receives: 0, poison: true });
    setQueue([...queueRef.current]);
    setProdActive(true);
    setTimeout(() => setProdActive(false), 500);
  };

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      // 1. PRODUCE — upstream events push messages onto the queue
      if (Math.random() < 0.75) {
        const n = Math.random() < 0.3 ? 2 : 1;
        for (let k = 0; k < n; k++) {
          queueRef.current.push({ id: idRef.current++, receives: 0, poison: false });
        }
        setProdActive(true);
      } else {
        setProdActive(false);
      }

      // 2. COMPLETE / FAIL in-flight work (poison messages always fail)
      const nextWorkers: (Msg | null)[] = [...workersRef.current];
      const returned: Msg[] = [];
      const dead: Msg[] = [];
      let done = 0;
      nextWorkers.forEach((msg, i) => {
        if (!msg) return;
        if (msg.poison || Math.random() < 0.12) {
          const updated = { ...msg, receives: msg.receives + 1 };
          if (updated.receives >= 3) dead.push(updated);
          else returned.push(updated); // visibility timeout expired → back to queue
          nextWorkers[i] = null;
        } else {
          done++;
          nextWorkers[i] = null;
        }
      });
      if (returned.length) queueRef.current.push(...returned);
      if (dead.length) {
        dlqRef.current.push(...dead);
        failedRef.current += dead.length;
        setDlqActive(true);
        setTimeout(() => setDlqActive(false), 650);
      }
      processedRef.current += done;

      // 3. POLL — consumers take messages from the queue front
      nextWorkers.forEach((slot, i) => {
        if (slot) return;
        if (Math.random() < (longPolling ? 0.05 : 0.3)) return; // empty poll response
        const msg = queueRef.current.shift();
        if (msg) nextWorkers[i] = msg;
      });

      workersRef.current = nextWorkers;

      // flush refs to render state
      setQueue([...queueRef.current]);
      setWorkers([...nextWorkers]);
      setDlq([...dlqRef.current]);
      setProcessed(processedRef.current);
      setFailed(failedRef.current);
      setConsActive([nextWorkers[0] !== null, nextWorkers[1] !== null]);
    }, 850);
    return () => clearInterval(timer);
  }, [running, longPolling]);

  const shown = queue.slice(0, MAX_SHOW);

  return (
    <div
      className={
        immersive.active
          ? "fixed inset-0 z-[70] bg-background p-3 sm:p-5 flex flex-col gap-3 sm:gap-4 overflow-y-auto cyber-scroll"
          : "flex flex-col gap-4"
      }
    >
      {/* MAIN GRID — animation left, rail right */}
      <div className={`grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start ${immersive.active ? "flex-1" : ""}`}>
        <GlassPanel
          title="FLOW VIEW // MESSAGE PIPELINE"
          subtitle="PRODUCERS → QUEUE → WORKERS — VISIBILITY TIMEOUT + DLQ REDRIVE"
          className="!p-0 overflow-hidden"
          delay={0.05}
          actions={<FullscreenToggle active={immersive.active} onToggle={immersive.toggle} />}
        >
          <FlowCanvas
            className={immersive.active ? "h-[min(560px,58vh)]" : "h-[440px] sm:h-[540px] lg:h-[560px]"}
            ariaLabel="SQS message flow diagram"
          >
            {/* LINKS */}
            <FlowLink d="M15,22 C32,22 32,34 44,34" status={prodActive ? "flowing" : "idle"} dotDuration={1.4} />
            <FlowLink d="M15,52 C32,52 32,38 44,38" status={prodActive ? "flowing" : "idle"} dotDuration={1.6} dotDelay={0.3} />
            <FlowLink d="M56,32 C70,32 70,16 82,16" status={consActive[0] ? "success" : "idle"} dotDuration={1.5} />
            <FlowLink d="M56,40 C70,40 70,46 82,46" status={consActive[1] ? "success" : "idle"} dotDuration={1.7} dotDelay={0.4} />
            <FlowLink d="M50,48 C50,62 50,66 50,72" status={dlqActive ? "error" : "idle"} dashed dot={dlqActive} dotDuration={1.2} />

            {/* PRODUCERS */}
            <FlowNode x={15} y={22} icon={<SNSIcon className="w-3 h-3" />} label="PRODUCER" sub="SNS EVENT" status={prodActive ? "active" : "idle"} pulse={prodActive} size="sm" delay={0.1} />
            <FlowNode x={15} y={52} icon={<LambdaIcon className="w-3 h-3" />} label="PRODUCER" sub="λ JOB" status={prodActive ? "active" : "idle"} pulse={prodActive} size="sm" delay={0.2} />

            <FlowLabel x={30} y={24} tone="aws">SENDMESSAGE</FlowLabel>
            <FlowLabel x={30} y={49} tone="aws">SENDMESSAGE</FlowLabel>
            <FlowLabel x={71} y={13} tone="mint">POLL</FlowLabel>
            <FlowLabel x={71} y={49} tone="mint">POLL</FlowLabel>

            {/* QUEUE CORE */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
              style={{ left: "50%", top: "36%" }}
            >
              <div className="glass box-glow cyber-cut p-2 w-[128px] sm:w-[150px]">
                <div className="flex items-center justify-between px-1 pb-1.5">
                  <span className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-[0.15em] text-aws">
                    <SQSIcon className="w-3 h-3" /> QUEUE
                  </span>
                  <motion.span
                    key={queue.length}
                    initial={{ scale: 1.4, color: "#00ffa3" }}
                    animate={{ scale: 1, color: "#ff9900" }}
                    className="text-[10px] font-extrabold"
                  >
                    {queue.length}
                  </motion.span>
                </div>
                <div className="flex flex-col-reverse gap-[3px] min-h-[96px] justify-start border-t border-aws/15 pt-1.5">
                  <AnimatePresence>
                    {shown.map((m) => (
                      <motion.div
                        key={m.id}
                        layout
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.6 }}
                        className={`h-3.5 flex items-center px-1 text-[6.5px] font-bold tracking-wider border ${
                          m.poison
                            ? "border-danger/60 bg-danger/15 text-danger"
                            : m.receives > 0
                              ? "border-neon/50 bg-neon/10 text-neon"
                              : "border-aws/40 bg-aws/10 text-aws"
                        }`}
                      >
                        MSG-{String(m.id).padStart(3, "0")}
                        {m.receives > 0 && <span className="ml-auto">×{m.receives}</span>}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {queue.length > MAX_SHOW && (
                    <span className="text-[6.5px] text-muted-foreground px-1">+{queue.length - MAX_SHOW} MORE IN BUFFER</span>
                  )}
                  {queue.length === 0 && (
                    <span className="text-[6.5px] text-muted-foreground/60 px-1 uppercase tracking-wider">EMPTY — POLLING…</span>
                  )}
                </div>
              </div>
            </motion.div>

            {/* CONSUMERS */}
            <FlowNode
              x={85}
              y={16}
              icon={<EC2Icon className="w-3 h-3" />}
              label="WORKER-1"
              sub={workers[0] ? `PROC MSG-${String(workers[0].id).padStart(3, "0")}` : "IDLE"}
              status={consActive[0] ? "success" : "idle"}
              pulse={consActive[0]}
              size="sm"
              delay={0.4}
            />
            <FlowNode
              x={85}
              y={46}
              icon={<EC2Icon className="w-3 h-3" />}
              label="WORKER-2"
              sub={workers[1] ? `PROC MSG-${String(workers[1].id).padStart(3, "0")}` : "IDLE"}
              status={consActive[1] ? "success" : "idle"}
              pulse={consActive[1]}
              size="sm"
              delay={0.5}
            />

            {/* DLQ */}
            <FlowNode
              x={50}
              y={78}
              icon={<Skull className="w-3 h-3" />}
              label={`DEAD LETTER QUEUE [${dlq.length}]`}
              sub="MAX RECEIVES EXCEEDED"
              status={dlq.length > 0 ? "error" : "idle"}
              pulse={dlqActive}
              size="sm"
              delay={0.6}
            />
            <FlowLabel x={56} y={60} tone="danger">VISIBILITY TIMEOUT EXPIRED ×3</FlowLabel>
          </FlowCanvas>
        </GlassPanel>

        <div className="flex flex-col gap-4 min-w-0">
          <GlassPanel title="LIVE STATS" className="!p-0" delay={0.1}>
            <div className="p-3 grid grid-cols-2 gap-2">
              <StatChip label="IN FLIGHT" value={String(workers.filter(Boolean).length)} tone="mint" />
              <StatChip label="QUEUE DEPTH" value={String(queue.length)} />
              <StatChip label="PROCESSED" value={String(processed)} tone="mint" />
              <StatChip label="DEAD-LETTERED" value={String(failed)} tone="magenta" />
            </div>
          </GlassPanel>

          <GlassPanel title="CONTROLS" className="!p-0" delay={0.12}>
            <div className="p-3 flex flex-col gap-2.5">
              <SimControls
                running={running}
                onToggle={() => setRunning((r) => !r)}
                onReset={reset}
                status={running ? "QUEUE ONLINE — MESSAGES FLOWING" : "SYSTEM IDLE — PRESS RUN"}
              />
              <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">QUEUE CONFIG</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFifo((v) => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] border bg-black/50 backdrop-blur-md cyber-cut-sm ${
                    fifo ? "border-magenta/60 text-magenta" : "border-aws/50 text-aws"
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  {fifo ? "FIFO MODE" : "STANDARD MODE"}
                </button>
                <button
                  type="button"
                  onClick={() => setLongPolling((v) => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] border bg-black/50 backdrop-blur-md cyber-cut-sm ${
                    longPolling ? "border-mint/60 text-mint" : "border-neon/60 text-neon"
                  }`}
                >
                  <Timer className="w-3 h-3" />
                  {longPolling ? "LONG POLLING (20s)" : "SHORT POLLING"}
                </button>
              </div>
              <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">CHAOS ACTIONS</p>
              <div className="flex flex-wrap gap-2">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={injectPoison}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] border border-danger/60 text-danger bg-black/50 backdrop-blur-md cyber-cut-sm hover:bg-danger/10"
                >
                  <Skull className="w-3 h-3" />
                  INJECT POISON MSG
                </motion.button>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel title="DLQ CONTENTS" className="!p-0" delay={0.15}>
            <div className="p-3">
              <div className="glass-inset p-2.5 max-h-40 overflow-y-auto cyber-scroll flex flex-col gap-1">
                {dlq.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-1.5 border border-danger/50 bg-danger/10 px-1.5 py-1 text-[7.5px] font-bold tracking-wider text-danger"
                  >
                    <span>MSG-{String(m.id).padStart(3, "0")}</span>
                    <span className="ml-auto text-danger/70">×{m.receives} RECEIVES</span>
                  </div>
                ))}
                {dlq.length === 0 && (
                  <p className="text-[7.5px] uppercase tracking-wider text-muted-foreground">NO DEAD LETTERS — HEALTHY QUEUE</p>
                )}
              </div>
            </div>
          </GlassPanel>
        </div>
      </div>

      {/* KNOWLEDGE — hidden in immersive fullscreen (essential data only) */}
      <div className={immersive.active ? "hidden" : "grid md:grid-cols-3 gap-3"}>
        <Callout type="tip" title="Visibility timeout is your safety net">
          When a consumer receives a message it becomes invisible for the timeout period (default 30s).
          If the worker crashes before deleting the message, the timeout expires and the message
          returns to the queue — automatically retried by another consumer.
        </Callout>
        <Callout type="critical" title="Delete after processing — always">
          Receiving does NOT remove a message. The consumer must explicitly call DeleteMessage after
          success. Forget it and every message is processed at least twice.
        </Callout>
        <Callout type="exam" title="Standard vs FIFO">
          Standard: unlimited throughput, at-least-once, possible duplicates & reordering. FIFO:
          exact order, exactly-once, 300 TPS (batched up to 3000), queue name ends in <span className="text-magenta">.fifo</span>.
          Poison messages → redrive policy ships them to a DLQ after maxReceiveCount.
        </Callout>
      </div>
    </div>
  );
}
