"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useSpring, useTransform } from "framer-motion";
import {
  Archive,
  BarChart3,
  CloudUpload,
  Database,
  FileJson,
  FileWarning,
  Globe,
  History,
  Image as ImageIcon,
  Layers,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  Video,
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
import { logTs } from "@/components/shared/auto-log";
import { S3Icon } from "@/components/aws-icons";

/* ================================================================== */
/* SHARED TYPES                                                        */
/* ================================================================== */

export type S3UseCaseId = "DATA_LAKE" | "VERSIONING" | "HOSTING" | "POLICY" | "LIFECYCLE";

interface S3UseCasesProps {
  id: S3UseCaseId;
  immersiveActive?: boolean;
  immersiveToggle?: () => void;
}

/* ================================================================== */
/* TAB 02 — S3 AS A DATA LAKE                                          */
/* ================================================================== */

type LakeKind = "structured" | "semi" | "unstructured";

const LAKE_SOURCES: { kind: LakeKind; label: string; sub: string; y: number; ext: string }[] = [
  { kind: "structured", label: "RDBMS EXPORT", sub: "STRUCTURED · CSV/PARQUET", y: 20, ext: "csv" },
  { kind: "semi", label: "APP + IOT LOGS", sub: "SEMI-STRUCTURED · JSON", y: 44, ext: "json" },
  { kind: "unstructured", label: "MEDIA + DOCS", sub: "UNSTRUCTURED · IMG/VID", y: 68, ext: "jpg" },
];

function DataLakeUseCase({ immersiveActive, immersiveToggle }: S3UseCasesProps) {
  const [running, setRunning] = useState(false);
  const [src, setSrc] = useState<Record<LakeKind, boolean>>({ structured: true, semi: true, unstructured: true });
  const [counts, setCounts] = useState({ ingested: 0, raw: 0, clean: 0, curated: 0, runs: 0, queries: 0 });
  const [etlFlash, setEtlFlash] = useState<"clean" | "curated" | null>(null);
  const [lines, setLines] = useState<{ id: number; text: string; tone?: string }[]>([]);
  const idRef = useRef(1);
  const flashT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const etlFlip = useRef(false);
  const countsRef = useRef({ ingested: 0, raw: 0, clean: 0, curated: 0, runs: 0, queries: 0 });
  useEffect(() => {
    countsRef.current = counts;
  }, [counts]);

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: idRef.current++, text, tone }]);

  // ingestion — one packet of each enabled source every tick
  useTicker(running, () => {
    const active = LAKE_SOURCES.filter((s) => src[s.kind]);
    if (active.length === 0) return;
    const s = active[Math.floor(Math.random() * active.length)];
    const mb = (Math.random() * 8 + 0.4).toFixed(1);
    setCounts((c) => ({ ...c, ingested: c.ingested + 1, raw: c.raw + 1 }));
    push(`PUT s3://nexus-lake/raw/${s.kind}/batch-${Math.floor(100 + Math.random() * 899)}.${s.ext} — ${mb}MB`, "aws");
  }, 1150);

  // medallion ETL — raw → clean → curated, alternating every tick
  useTicker(running, () => {
    const c = countsRef.current;
    if (!etlFlip.current && c.raw > 0) {
      const moved = Math.min(c.raw, 3);
      setCounts((p) => ({ ...p, raw: p.raw - moved, clean: p.clean + moved, runs: p.runs + 1 }));
      setEtlFlash("clean");
      push(`GLUE ETL JOB — ${moved} objects raw → clean (schema-fixed parquet)`, "magenta");
    } else if (etlFlip.current && c.clean > 0) {
      const moved = Math.min(c.clean, 2);
      setCounts((p) => ({ ...p, clean: p.clean - moved, curated: p.curated + moved }));
      setEtlFlash("curated");
      push(`AGGREGATION — ${moved} tables clean → curated (query-optimized)`, "mint");
    }
    etlFlip.current = !etlFlip.current;
    if (flashT.current) clearTimeout(flashT.current);
    flashT.current = setTimeout(() => setEtlFlash(null), 900);
  }, 2600);

  // analytics consumption
  useTicker(running, () => {
    if (countsRef.current.curated === 0) return;
    setCounts((c) => ({ ...c, queries: c.queries + 1 }));
    push(`ATHENA — query#${countsRef.current.queries} scanned ${(Math.random() * 40 + 2).toFixed(0)}MB curated data`, "neon");
  }, 3400);

  useEffect(() => () => { if (flashT.current) clearTimeout(flashT.current); }, []);

  const reset = () => {
    setRunning(false);
    setCounts({ ingested: 0, raw: 0, clean: 0, curated: 0, runs: 0, queries: 0 });
    setLines([]);
    setEtlFlash(null);
    etlFlip.current = false;
  };

  return (
    <UseCaseShell
      title="USE CASE // S3 AS A DATA LAKE"
      subtitle="STRUCTURED + SEMI-STRUCTURED + UNSTRUCTURED → ONE LAKE → ANALYTICS"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="OBJECTS INGESTED" value={counts.ingested} />
          <UCStat label="RAW ZONE" value={counts.raw} tone="magenta" />
          <UCStat label="CLEAN ZONE" value={counts.clean} tone="neon" />
          <UCStat label="CURATED ZONE" value={counts.curated} tone="mint" />
          <UCStat label="ETL PIPELINES" value={counts.runs} tone="neutral" />
          <UCStat label="ANALYTICS QUERIES" value={counts.queries} tone="neutral" />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? "LAKE ONLINE — INGEST + ETL STREAMING" : "LAKE IDLE — PRESS RUN"}
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">DATA SOURCES</p>
          <div className="flex flex-wrap gap-2">
            {LAKE_SOURCES.map((s) => (
              <UCToggle
                key={s.kind}
                on={src[s.kind]}
                onClick={() => setSrc((p) => ({ ...p, [s.kind]: !p[s.kind] }))}
                accent={s.kind === "structured" ? "aws" : s.kind === "semi" ? "mint" : "magenta"}
                ariaLabel={`Toggle ${s.kind} data source`}
              >
                {s.kind === "structured" ? <Database className="w-3 h-3" /> : s.kind === "semi" ? <FileJson className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                {s.kind === "structured" ? "STRUCTURED" : s.kind === "semi" ? "SEMI-STRUCT." : "UNSTRUCTURED"} {src[s.kind] ? "ON" : "OFF"}
              </UCToggle>
            ))}
          </div>
        </>
      }
      logLines={lines}
      logTitle="LAKE PIPELINE LOG // LIVE"
      logEmpty="PRESS RUN — OR TOGGLE SOURCES AND WATCH THE LAKE FILL"
    >
      <FlowCanvas ariaLabel="S3 data lake use case diagram" className="h-full">
        {/* source → lake links */}
        <FlowLink d="M17,21 C24,21 26,28 31,33" status={running && src.structured ? "flowing" : "idle"} dotDuration={1.3} />
        <FlowLink d="M17,45 C24,45 26,45 31,45" status={running && src.semi ? "flowing" : "idle"} dotDuration={1.1} />
        <FlowLink d="M17,69 C24,69 26,62 31,57" status={running && src.unstructured ? "flowing" : "idle"} dotDuration={1.4} />
        {/* lake → analytics links */}
        <FlowLink d="M58,33 C66,27 70,27 76,27" status={running && counts.curated > 0 ? "flowing" : "idle"} dotDuration={1.5} />
        <FlowLink d="M58,57 C66,63 70,63 76,63" status={running && counts.curated > 0 ? "flowing" : "idle"} dotDuration={1.6} dotDelay={0.4} />

        {LAKE_SOURCES.map((s, i) => (
          <FlowNode
            key={s.kind}
            x={9}
            y={s.y}
            size="sm"
            delay={0.1 + i * 0.08}
            icon={s.kind === "structured" ? <Database className="w-3 h-3" /> : s.kind === "semi" ? <FileJson className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
            label={s.label}
            sub={s.sub}
            status={src[s.kind] ? (running ? "active" : "idle") : "idle"}
            pulse={running && src[s.kind]}
          />
        ))}

        {/* THE LAKE — medallion architecture */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
          style={{ left: "44%", top: "45%" }}
        >
          <div className="glass box-glow cyber-cut p-2.5 w-[150px] sm:w-[176px]">
            <div className="flex items-center gap-1.5 pb-1.5 border-b border-aws/15">
              <S3Icon className="w-3.5 h-3.5 text-aws" />
              <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-aws">S3 DATA LAKE</span>
            </div>
            <div className="flex flex-col gap-1 pt-1.5">
              {[
                { key: "raw" as const, name: "RAW · BRONZE", n: counts.raw, cls: "text-magenta border-magenta/40", flash: false },
                { key: "clean" as const, name: "CLEAN · SILVER", n: counts.clean, cls: "text-neon border-neon/40", flash: etlFlash === "clean" },
                { key: "curated" as const, name: "CURATED · GOLD", n: counts.curated, cls: "text-mint border-mint/40", flash: etlFlash === "curated" },
              ].map((z, i) => (
                <div key={z.key} className={`flex items-center justify-between border px-1.5 py-1 ${z.cls} ${z.flash ? "box-glow" : ""}`}>
                  <span className="text-[6.5px] font-bold tracking-wider">{z.name}</span>
                  <motion.span key={z.n} initial={{ scale: 1.35 }} animate={{ scale: 1 }} transition={{ delay: i * 0.02 }} className="text-[9px] font-extrabold tabular-nums">
                    {z.n}
                  </motion.span>
                </div>
              ))}
            </div>
            <p className="text-[6px] text-muted-foreground tracking-wider pt-1.5 uppercase">11 NINES · INFINITE SCALE · ANY FORMAT</p>
          </div>
        </motion.div>

        <FlowNode x={84} y={27} size="sm" delay={0.5} icon={<Search className="w-3 h-3" />} label="ATHENA" sub="SQL ON S3" status={running && counts.curated > 0 ? "active" : "idle"} pulse={running && counts.curated > 0} />
        <FlowNode x={84} y={63} size="sm" delay={0.58} icon={<BarChart3 className="w-3 h-3" />} label="QUICKSIGHT · ML" sub="BI + TRAINING" status={running && counts.curated > 0 ? "active" : "idle"} pulse={running && counts.curated > 0} />

        <FlowLabel x={44} y={14} tone="aws">MEDALLION LAKE — RAW → CLEAN → CURATED</FlowLabel>
        <FlowLabel x={67} y={19} tone="default">ZERO COPIES — QUERY IN PLACE</FlowLabel>
      </FlowCanvas>

      <UseCaseNote>
        ONE bucket, ALL data shapes: no schema upfront, decouple storage from compute, pay $0.023/GB instead of a data warehouse
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* TAB 03 — VERSIONING: ACCIDENTAL DELETE / RANSOMWARE RECOVERY        */
/* ================================================================== */

function VersioningUseCase({ immersiveActive, immersiveToggle }: S3UseCasesProps) {
  const [running, setRunning] = useState(false);
  const [versions, setVersions] = useState<{ v: number; ts: string }[]>([]);
  const [marker, setMarker] = useState(false);
  const [lines, setLines] = useState<{ id: number; text: string; tone?: string }[]>([]);
  const idRef = useRef(1);
  const vRef = useRef(0);

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: idRef.current++, text, tone }]);

  const doPut = () => {
    vRef.current += 1;
    const v = vRef.current;
    setVersions((p) => [...p, { v, ts: logTs().slice(0, 8) }]);
    push(`PUT report.pdf — version v${v} stored (2.4MB) — previous versions kept`, "aws");
  };
  const doDelete = () => {
    if (marker) { push("DELETE ignored — object already behind a delete marker", "dim"); return; }
    if (versions.length === 0) { push("DELETE ignored — bucket empty, nothing to delete", "dim"); return; }
    setMarker(true);
    push("DELETE report.pdf — DELETE MARKER added on top — GET / now 404 — data intact", "danger");
  };
  const doRestore = () => {
    if (marker) {
      setMarker(false);
      push("RESTORE — delete marker removed — latest version is LIVE again (rollback done)", "mint");
    } else {
      push("nothing to restore — latest version already serving", "dim");
    }
  };

  // auto scenario: PUT → PUT → DELETE → RESTORE (fires from interval callback)
  const { step, reset: resetStep } = useScenarioRunner(4, running, 2400, (s) => {
    if (s === 0 || s === 1) doPut();
    else if (s === 2) doDelete();
    else doRestore();
  });

  const reset = () => {
    setRunning(false);
    resetStep();
    setVersions([]);
    setMarker(false);
    setLines([]);
    vRef.current = 0;
  };

  const latest = versions[versions.length - 1];
  const stack = [...versions].reverse().slice(0, 5);

  return (
    <UseCaseShell
      title="USE CASE // VERSIONING — REAL-TIME RECOVERY"
      subtitle="ACCIDENTAL OVERWRITE · RM -RF · RANSOMWARE — EVERY VERSION SURVIVES"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="VERSIONS STORED" value={versions.length} />
          <UCStat label="GET /REPORT.PDF" value={marker ? "404" : versions.length ? "200 OK" : "—"} tone={marker ? "danger" : versions.length ? "mint" : "neutral"} />
          <UCStat label="DELETE MARKER" value={marker ? "PRESENT" : "NONE"} tone={marker ? "danger" : "neutral"} />
          <UCStat label="RANSOMWARE SHIELD" value={versions.length >= 2 ? "ARMED" : "OFF"} tone={versions.length >= 2 ? "mint" : "danger"} />
          <UCStat label="DATA ON DISK" value={`${(versions.length * 2.4).toFixed(1)}MB`} tone="neutral" />
          <UCStat label="RECOVERABLE POINTS" value={versions.length} tone="magenta" />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? "AUTO SCENARIO — PUT · PUT · DELETE · RESTORE" : "IDLE — PRESS RUN OR USE ACTIONS"}
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">OBJECT ACTIONS</p>
          <div className="flex flex-wrap gap-2">
            <UCButton onClick={doPut} ariaLabel="Upload a new version of the object">
              <CloudUpload className="w-3 h-3" /> PUT VERSION
            </UCButton>
            <UCButton onClick={doDelete} tone="danger" ariaLabel="Delete the object — a delete marker is created">
              <Trash2 className="w-3 h-3" /> DELETE
            </UCButton>
            <UCButton onClick={doRestore} tone="mint" ariaLabel="Restore the object by removing the delete marker">
              <RotateCcw className="w-3 h-3" /> RESTORE
            </UCButton>
          </div>
        </>
      }
      logLines={lines}
      logTitle="VERSION TIMELINE LOG // LIVE"
      logEmpty="PRESS RUN — OR SIMULATE PUT / DELETE / RESTORE BY HAND"
    >
      <FlowCanvas ariaLabel="S3 versioning use case diagram" className="h-full">
        <FlowLink d="M20,50 C26,50 28,50 34,50" status={running ? "flowing" : "idle"} dotDuration={1.2} />
        <FlowNode x={12} y={50} size="sm" delay={0.1} icon={<CloudUpload className="w-3 h-3" />} label="CLIENT OPS" sub="PUT / DELETE / GET" status={running ? "active" : "idle"} pulse={running} />

        {/* BUCKET WITH VERSION STACK */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25 }}
          className="absolute -translate-x-1/2 -translate-y-1/2 z-10 w-[46%] max-w-[300px]"
          style={{ left: "56%", top: "48%" }}
        >
          <div className="glass box-glow cyber-cut p-2.5">
            <div className="flex items-center justify-between pb-1.5 border-b border-aws/15">
              <span className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.15em] text-aws">
                <S3Icon className="w-3 h-3" /> REPORT.PDF — VERSION STACK
              </span>
              <span className={`text-[7px] font-extrabold px-1.5 py-0.5 border ${marker ? "text-danger border-danger/60" : "text-mint border-mint/60"}`}>
                {marker ? "404 · MARKER" : latest ? `200 · v${latest.v}` : "EMPTY"}
              </span>
            </div>
            <div className="flex flex-col gap-1 pt-1.5 max-h-[190px] overflow-y-auto cyber-scroll">
              <AnimatePresence initial={false}>
                {marker && (
                  <motion.div
                    key="marker"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex items-center gap-1.5 border border-danger/60 bg-danger/10 px-1.5 py-1 text-danger"
                  >
                    <Trash2 className="w-3 h-3 shrink-0" />
                    <span className="text-[7.5px] font-bold tracking-wider">DELETE MARKER (zero-byte)</span>
                    <span className="ml-auto text-[6px] tracking-wider">{logTs().slice(0, 8)}</span>
                  </motion.div>
                )}
                {stack.map((v, i) => (
                  <motion.div
                    key={v.v}
                    layout
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex items-center gap-1.5 border px-1.5 py-1 ${i === 0 && !marker ? "border-aws/60 text-aws box-glow" : "border-foreground/15 text-muted-foreground"}`}
                  >
                    <History className="w-3 h-3 shrink-0" />
                    <span className="text-[7.5px] font-bold tracking-wider">VERSION v{v.v}</span>
                    {i === 0 && !marker && <span className="text-[6px] font-extrabold tracking-[0.2em] text-mint">LATEST</span>}
                    <span className="ml-auto text-[6px] tracking-wider tabular-nums">{v.ts}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {versions.length === 0 && !marker && (
                <p className="text-[7px] text-muted-foreground/60 uppercase tracking-wider px-1">EMPTY — PRESS PUT VERSION</p>
              )}
            </div>
            <p className="text-[6px] text-muted-foreground tracking-wider pt-1.5 border-t border-aws/15 mt-1.5 uppercase">
              RANSOMWARE PROOF — OLD VERSIONS ARE IMMUTABLE TO CLIENT DELETES
            </p>
          </div>
        </motion.div>

        <FlowLabel x={30} y={16} tone="aws">EVERY PUT = NEW VERSION · EVERY DELETE = A MARKER</FlowLabel>
        <FlowLabel x={30} y={84} tone="mint">RECOVERY = REMOVE MARKER OR GET ?VERSIONID=v2</FlowLabel>
        <StepBadge step={step} total={4} text={["UPLOAD v1", "UPLOAD v2", "DELETE (marker)", "RESTORE"][step]} />
      </FlowCanvas>

      <UseCaseNote>
        ENABLE VERSIONING + MFA DELETE: user “rm -rf” or encrypt-loop ransomware can never destroy history — roll back in one click
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* TAB 04 — STATIC WEB HOSTING                                         */
/* ================================================================== */

/* browsing-phase requests — keeps the site alive after the initial HTML/CSS/JS load */
const ASSET_REQS = [
  "GET /assets/hero.webp (84KB) — above-the-fold art",
  "GET /favicon.ico (1.2KB) — browser tab icon",
  "GET /fonts/inter.woff2 (48KB) — webfont swapped in",
  "GET /logo.svg (3KB) — vector logo cached",
  "GET /assets/team.jpg (156KB) — lazy-loaded on scroll",
  "GET /robots.txt (26B) — crawler rules",
  "GET /sitemap.xml (9KB) — SEO index",
];

function HostingUseCase({ immersiveActive, immersiveToggle }: S3UseCasesProps) {
  const [running, setRunning] = useState(false);
  const [errorDoc, setErrorDoc] = useState(true);
  const [page, setPage] = useState({ html: false, css: false, js: false });
  const [served, setServed] = useState(0);
  const [notFounds, setNotFounds] = useState(0);
  const [reqPerSec, setReqPerSec] = useState(0);
  const [reqTick, setReqTick] = useState(0);
  const [errPanel, setErrPanel] = useState<null | { custom: boolean }>(null);
  const [flash, setFlash] = useState<null | "ok" | "deny">(null);
  const [lines, setLines] = useState<{ id: number; text: string; tone?: string }[]>([]);
  const idRef = useRef(1);
  const flashT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageRef = useRef(page);
  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: idRef.current++, text, tone }]);

  useTicker(running, () => setReqPerSec(38 + Math.floor(Math.random() * 30)), 1000);

  const doLoad = (s: number) => {
    if (s === 0) {
      setPage((p) => ({ ...p, html: true }));
      setServed((c) => c + 1);
      push("GET / → 200 index.html (14KB) — DOM skeleton rendered", "aws");
    } else if (s === 1) {
      setPage((p) => ({ ...p, css: true }));
      setServed((c) => c + 1);
      push("GET /styles.css → 200 (4KB) — layout painted", "neon");
    } else if (s === 2) {
      setPage((p) => ({ ...p, js: true }));
      setServed((c) => c + 1);
      push("GET /app.js → 200 (28KB) — page interactive", "mint");
    }
  };

  // request pipeline: index.html → styles.css → app.js → idle browsing (interval-driven)
  // steps 0-2 load each asset ONCE (guarded — cycle wrap must not re-log them);
  // steps 3-5 keep the site alive with varied browsing requests
  const { step, reset: resetStep } = useScenarioRunner(6, running, 1600, (s) => {
    if (s <= 2) {
      const key = (['html', 'css', 'js'] as const)[s];
      if (!pageRef.current[key]) doLoad(s);
    } else {
      setServed((c) => c + 1);
      setReqTick((t) => t + 1);
      const a = ASSET_REQS[Math.floor(Math.random() * ASSET_REQS.length)];
      push(`${a} — 200 · served from the bucket`, Math.random() < 0.5 ? "aws" : "mint");
    }
  });

  const requestMissing = () => {
    if (!pageRef.current.html) { push("site not loaded yet — press RUN first", "dim"); return; }
    setNotFounds((n) => n + 1);
    setFlash("deny");
    setErrPanel({ custom: errorDoc });
    if (flashT.current) clearTimeout(flashT.current);
    flashT.current = setTimeout(() => { setFlash(null); setErrPanel(null); }, 1900);
    if (errorDoc) push("GET /missing.png → 404 → ERROR DOC 404.html served — branded friendly page", "magenta");
    else push("GET /missing.png → 404 raw XML — ugly default error, bad UX", "danger");
  };

  const reset = () => {
    setRunning(false);
    resetStep();
    setPage({ html: false, css: false, js: false });
    setServed(0);
    setNotFounds(0);
    setReqPerSec(0);
    setReqTick(0);
    setErrPanel(null);
    setFlash(null);
    setLines([]);
  };

  useEffect(() => () => { if (flashT.current) clearTimeout(flashT.current); }, []);

  return (
    <UseCaseShell
      title="USE CASE // STATIC WEB HOSTING"
      subtitle="S3 WEBSITE ENDPOINT — HTML/CSS/JS SERVED STRAIGHT FROM THE BUCKET"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="REQUESTS / SEC" value={reqPerSec} />
          <UCStat label="FILES SERVED" value={served} tone="mint" />
          <UCStat label="404 ERRORS" value={notFounds} tone={notFounds > 0 ? "danger" : "neutral"} />
          <UCStat label="AVG LATENCY" value="21ms" tone="neutral" />
          <UCStat label="HOSTING COST" value="$0.4/GB-MO" tone="aws" />
          <UCStat label="SERVERS TO PATCH" value={0} tone="mint" />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? "WEBSITE LIVE — VISITORS LOADING" : "SITE IDLE — PRESS RUN"}
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">BUCKET WEBSITE CONFIG</p>
          <UCToggle on={errorDoc} onClick={() => setErrorDoc((v) => !v)} accent="magenta" ariaLabel="Toggle custom error document">
            <FileWarning className="w-3 h-3" /> ERROR DOC 404.HTML {errorDoc ? "ON" : "OFF"}
          </UCToggle>
          <UCButton onClick={requestMissing} tone="danger" ariaLabel="Request a missing page to trigger the error document">
            <FileWarning className="w-3 h-3" /> REQUEST /MISSING.PNG
          </UCButton>
        </>
      }
      logLines={lines}
      logTitle="HTTP ACCESS LOG // LIVE"
      logEmpty="PRESS RUN — VISITORS START REQUESTING THE SITE"
    >
      <FlowCanvas ariaLabel="S3 static website hosting use case diagram" className="h-full">
        <FlowLink d="M20,46 C28,34 30,20 36,14" status={running ? "flowing" : "idle"} dotDuration={1.1} />
        <FlowLink d="M20,54 C28,62 40,62 48,58" status={running ? "flowing" : "idle"} dotDuration={1.2} dotDelay={0.3} />
        <FlowLink d="M58,57.5 C58,63 60.5,66.5 62.5,69.5" status={running ? "flowing" : "idle"} dotDuration={1.3} />

        <FlowNode x={12} y={50} size="sm" delay={0.1} icon={<Globe className="w-3 h-3" />} label="VISITORS" sub="BROWSER TRAFFIC" status={running ? "active" : "idle"} pulse={running} />
        <FlowNode x={30} y={14} size="sm" delay={0.2} icon={<Search className="w-3 h-3" />} label="ROUTE 53" sub="ALIAS A-RECORD" status={running ? "success" : "idle"} />
        <FlowNode x={56} y={52} size="sm" delay={0.3} icon={<S3Icon className="w-3 h-3 text-aws" />} label="S3 WEBSITE ENDPOINT" sub="INDEX.HTML + 404.HTML" status={running ? "active" : "idle"} pulse={running} />

        {/* MINI BROWSER MOCK */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="absolute right-2 bottom-2 z-10 w-[38%] max-w-[290px]"
        >
          <div className="glass cyber-cut p-2 relative">
            {/* request ping — flashes on every browsing request */}
            {reqTick > 0 && (
              <motion.span
                key={reqTick}
                initial={{ opacity: 0.9, scale: 1.4 }}
                animate={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 1 }}
                className="absolute top-1.5 right-1.5 w-2 h-2 bg-mint border border-mint/60 z-10"
                aria-hidden="true"
              />
            )}
            <div className="flex items-center gap-1.5 pb-1.5 border-b border-aws/15">
              <span className="w-2 h-2 border border-mint/70" aria-hidden="true" />
              <span className="w-2 h-2 border border-aws/70" aria-hidden="true" />
              <span className="w-2 h-2 border border-danger/70" aria-hidden="true" />
              <span className="ml-1 text-[6px] tracking-wider text-muted-foreground truncate">
                http://nexus-site.s3-website.ap-south-1.amazonaws.com
              </span>
              <span className="ml-auto flex items-center gap-1 shrink-0">
                <span className="text-[6px] font-extrabold tabular-nums text-aws">{served} REQ</span>
                {running && <span className="w-1.5 h-1.5 bg-mint ping-ring" aria-hidden="true" />}
              </span>
            </div>
            <div className="pt-1.5 min-h-[104px] relative">
              <AnimatePresence>
                {errPanel ? (
                  <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                    <FileWarning className={`w-5 h-5 ${errPanel.custom ? "text-magenta" : "text-danger"}`} />
                    <p className={`text-[7px] font-extrabold tracking-[0.2em] ${errPanel.custom ? "text-magenta" : "text-danger"}`}>
                      {errPanel.custom ? "404 — OUR BAD, TRY SEARCH" : "<?xml><Error><Code>NoSuchKey</Code>"}
                    </p>
                    <p className="text-[6px] text-muted-foreground uppercase tracking-wider">
                      {errPanel.custom ? "custom 404.html rendered" : "raw xml error — no error doc"}
                    </p>
                  </motion.div>
                ) : (
                  <motion.div key="site" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-1">
                    <div className={`h-3 border ${page.css ? "border-aws/60 bg-aws/20" : "border-foreground/15 bg-black/40"} flex items-center px-1`}>
                      <span className={`text-[6px] font-bold tracking-wider ${page.css ? "text-aws" : "text-muted-foreground/50"}`}>
                        {page.html ? "NEXUS CORP" : ""}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className={`h-7 border ${page.css ? "border-neon/40 bg-neon/10" : "border-foreground/15 bg-black/40"}`} />
                      ))}
                    </div>
                    <div className={`h-5 border ${page.css ? "border-mint/40 bg-mint/10" : "border-foreground/15 bg-black/40"}`} />
                    {page.js && (
                      <motion.span initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-[6px] font-extrabold tracking-[0.25em] text-mint">
                        ⚡ INTERACTIVE — JS HYDRATED
                      </motion.span>
                    )}
                    {!page.html && <p className="text-[6px] text-muted-foreground/50 uppercase tracking-wider">about:blank — press RUN</p>}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        <FlowLabel x={30} y={80} tone="aws">NO SERVERS · NO PATCHING · 99.99% SLA — SPA + STATIC ASSETS</FlowLabel>
        <StepBadge step={step} total={6} text={["GET /", "LOAD CSS", "LOAD JS", "BROWSING", "BROWSING", "BROWSING"][step]} />
      </FlowCanvas>

      <VerdictFlash show={flash === "deny"} text="404 NOT FOUND" tone="deny" />
      <UseCaseNote>
        SITES WITH NO SERVER-SIDE LOGIC: PORTFOLIOS · DOCS · SPAS — PAIR WITH CLOUDFRONT FOR HTTPS + GLOBAL EDGE
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* TAB 05 — BUCKET POLICY JSON → VISUALIZER + REQUEST SIMULATOR        */
/* ================================================================== */

interface PolicyStatement {
  Sid?: string;
  Effect?: "Allow" | "Deny";
  Principal?: unknown;
  Action?: unknown;
  Resource?: unknown;
  Condition?: Record<string, Record<string, string | string[]>>;
}
interface BucketPolicy {
  Version?: string;
  Statement?: PolicyStatement | PolicyStatement[];
}

const POLICY_PRESETS: Record<string, string> = {
  "PUBLIC READ": JSON.stringify(
    {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "PublicReadGetObject",
          Effect: "Allow",
          Principal: "*",
          Action: "s3:GetObject",
          Resource: "arn:aws:s3:::nexus-public-bucket/*",
        },
      ],
    },
    null,
    2
  ),
  "IP RESTRICT": JSON.stringify(
    {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "OfficeOnly",
          Effect: "Allow",
          Principal: "*",
          Action: "s3:GetObject",
          Resource: "arn:aws:s3:::nexus-public-bucket/*",
          Condition: { IpAddress: { "aws:SourceIp": "203.0.113.0/24" } },
        },
      ],
    },
    null,
    2
  ),
  "TLS ONLY (DENY)": JSON.stringify(
    {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "DenyInsecureTransport",
          Effect: "Deny",
          Principal: "*",
          Action: "s3:*",
          Resource: "arn:aws:s3:::nexus-public-bucket/*",
          Condition: { Bool: { "aws:SecureTransport": "false" } },
        },
      ],
    },
    null,
    2
  ),
  "PREFIX READ-ONLY": JSON.stringify(
    {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "ReportsReadOnly",
          Effect: "Allow",
          Principal: "*",
          Action: ["s3:GetObject", "s3:ListBucket"],
          Resource: ["arn:aws:s3:::nexus-public-bucket/reports/*", "arn:aws:s3:::nexus-public-bucket"],
        },
      ],
    },
    null,
    2
  ),
};

function wildcardMatch(pattern: string, value: string): boolean {
  if (pattern === "*") return true;
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("^" + pattern.split("*").map(esc).join(".*") + "$").test(value);
}

function ipInCidr(ip: string, cidr: string): boolean {
  const parts = cidr.split("/");
  const base = parts[0];
  const bits = parseInt(parts[1] ?? "32", 10);
  const toInt = (s: string) => s.split(".").reduce((acc, o) => ((acc << 8) + parseInt(o, 10)) >>> 0, 0);
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return ((toInt(ip) & mask) >>> 0) === ((toInt(base) & mask) >>> 0);
}

const asArray = (v: unknown): string[] => (v === undefined || v === null ? [] : Array.isArray(v) ? v.map(String) : [String(v)]);

function evaluatePolicy(
  policy: BucketPolicy | null,
  req: { principal: string; action: string; resource: string; https: boolean }
): { verdict: string; reason: string; tone: "ok" | "deny" | "aws" } {
  if (!policy || !policy.Statement) return { verdict: "PARSE ERROR", reason: "policy JSON invalid — bucket falls back to IMPLICIT DENY", tone: "deny" };
  const stmts = Array.isArray(policy.Statement) ? policy.Statement : [policy.Statement];
  const principalIsAnon = req.principal === "anonymous";
  const hasAnon = principalIsAnon;
  let allowed = false;
  for (const st of stmts) {
    const actions = asArray(st.Action);
    const resources = asArray(st.Resource);
    const principals = asArray(st.Principal).map((p) => (p === "*" ? "*" : p));
    const actionOk = actions.some((a) => wildcardMatch(a, req.action));
    const resourceOk = resources.some((r) => wildcardMatch(r.replace(/^arn:aws:s3:::/, ""), req.resource));
    const principalOk =
      principals.length === 0 ? !hasAnon : principals.some((p) => (p === "*" ? true : !hasAnon));
    let condOk = true;
    const cond = st.Condition ?? {};
    for (const [block, kv] of Object.entries(cond)) {
      for (const [key, value] of Object.entries(kv)) {
        const values = Array.isArray(value) ? value : [String(value)];
        if (block === "IpAddress" && key === "aws:SourceIp") {
          if (principalIsAnon) { condOk = false; continue; }
          if (!values.some((cidr) => ipInCidr(req.principal, cidr))) condOk = false;
        } else if (block === "NotIpAddress" && key === "aws:SourceIp") {
          if (!principalIsAnon && values.some((cidr) => ipInCidr(req.principal, cidr))) condOk = false;
        } else if (block === "Bool" && key === "aws:SecureTransport") {
          const want = values[0] === "true";
          if (want !== req.https) condOk = false;
        }
      }
    }
    if (actionOk && resourceOk && principalOk && condOk) {
      if (st.Effect === "Deny") return { verdict: "DENY", reason: `EXPLICIT DENY matched (${st.Sid ?? "statement"}) — explicit deny always wins`, tone: "deny" };
      allowed = true;
    }
  }
  if (allowed) return { verdict: "ALLOW", reason: "an ALLOW statement matched action + resource + conditions", tone: "ok" };
  return { verdict: "IMPLICIT DENY", reason: "no statement matched — S3 denies everything by default", tone: "deny" };
}

function PolicyUseCase({ immersiveActive, immersiveToggle }: S3UseCasesProps) {
  const [json, setJson] = useState(POLICY_PRESETS["PUBLIC READ"]);
  const [parsed, setParsed] = useState<BucketPolicy | null>(tryParse(POLICY_PRESETS["PUBLIC READ"]));
  const [req, setReq] = useState({ principal: "anonymous", action: "s3:GetObject", resource: "reports/q1.pdf" });
  const [verdict, setVerdict] = useState<{ verdict: string; reason: string; tone: "ok" | "deny" | "aws" } | null>(null);
  const [lines, setLines] = useState<{ id: number; text: string; tone?: string }[]>([]);
  const idRef = useRef(1);
  const errRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const statements = useMemo<PolicyStatement[]>(() => {
    if (!parsed || !parsed.Statement) return [];
    return Array.isArray(parsed.Statement) ? parsed.Statement : [parsed.Statement];
  }, [parsed]);

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: idRef.current++, text, tone }]);

  function tryParse(v: string): BucketPolicy | null {
    try {
      const p = JSON.parse(v);
      return typeof p === "object" && p !== null ? (p as BucketPolicy) : null;
    } catch {
      return null;
    }
  }

  const onJsonChange = (v: string) => {
    setJson(v);
    setParsed(tryParse(v));
  };

  const simulate = () => {
    const fullResource = `nexus-public-bucket/${req.resource}`;
    const result = evaluatePolicy(parsed, { ...req, resource: fullResource, https: true });
    setVerdict(result);
    push(`SIM ${req.principal} → ${req.action} ${req.resource} ⇒ ${result.verdict} — ${result.reason}`, result.tone === "ok" ? "mint" : "danger");
    if (errRef.current) clearTimeout(errRef.current);
    errRef.current = setTimeout(() => setVerdict(null), 2200);
  };

  useEffect(() => () => { if (errRef.current) clearTimeout(errRef.current); }, []);

  return (
    <UseCaseShell
      title="USE CASE // BUCKET POLICY — JSON TO VISUAL"
      subtitle="EDIT JSON → SEE GRANTS VISUALLY → SIMULATE REAL REQUESTS"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="STATEMENTS" value={statements.length} />
          <UCStat label="ALLOWS" value={statements.filter((s) => s.Effect === "Allow").length} tone="mint" />
          <UCStat label="DENIES" value={statements.filter((s) => s.Effect === "Deny").length} tone="danger" />
          <UCStat label="JSON VALID" value={parsed ? "YES" : "NO"} tone={parsed ? "mint" : "danger"} />
          <UCStat label="LAST VERDICT" value={verdict?.verdict ?? "—"} tone={verdict ? (verdict.tone === "ok" ? "mint" : "danger") : "neutral"} />
          <UCStat label="DEFAULT POSTURE" value="CLOSED" tone="aws" />
        </>
      }
      controls={
        <>
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">POLICY PRESETS</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(POLICY_PRESETS).map((k) => (
              <UCButton key={k} onClick={() => onJsonChange(POLICY_PRESETS[k])} ariaLabel={`Load preset policy ${k}`}>
                <FileJson className="w-3 h-3" /> {k}
              </UCButton>
            ))}
          </div>
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">SIMULATED REQUEST</p>
          <div className="grid grid-cols-1 gap-1.5">
            <select
              value={req.principal}
              onChange={(e) => setReq((r) => ({ ...r, principal: e.target.value }))}
              aria-label="Simulated request principal"
              className="w-full bg-black/60 border border-foreground/25 text-[9px] font-bold tracking-wider px-2 py-1.5 text-foreground/90 outline-none focus:border-aws/60"
            >
              <option value="anonymous">PRINCIPAL: anonymous (internet)</option>
              <option value="203.0.113.44">PRINCIPAL: 203.0.113.44 (office IP)</option>
              <option value="198.51.100.9">PRINCIPAL: 198.51.100.9 (unknown IP)</option>
            </select>
            <select
              value={req.action}
              onChange={(e) => setReq((r) => ({ ...r, action: e.target.value }))}
              aria-label="Simulated request action"
              className="w-full bg-black/60 border border-foreground/25 text-[9px] font-bold tracking-wider px-2 py-1.5 text-foreground/90 outline-none focus:border-aws/60"
            >
              <option value="s3:GetObject">ACTION: s3:GetObject</option>
              <option value="s3:PutObject">ACTION: s3:PutObject</option>
              <option value="s3:DeleteObject">ACTION: s3:DeleteObject</option>
            </select>
            <select
              value={req.resource}
              onChange={(e) => setReq((r) => ({ ...r, resource: e.target.value }))}
              aria-label="Simulated request object key"
              className="w-full bg-black/60 border border-foreground/25 text-[9px] font-bold tracking-wider px-2 py-1.5 text-foreground/90 outline-none focus:border-aws/60"
            >
              <option value="reports/q1.pdf">KEY: reports/q1.pdf</option>
              <option value="archive/old.zip">KEY: archive/old.zip</option>
            </select>
          </div>
          <UCButton onClick={simulate} ariaLabel="Simulate the request against the bucket policy">
            <Zap className="w-3 h-3" /> SIMULATE REQUEST
          </UCButton>
        </>
      }
      logLines={lines}
      logTitle="POLICY EVALUATION LOG // LIVE"
      logEmpty="EDIT THE POLICY — THEN HIT SIMULATE REQUEST"
    >
      <div className="absolute inset-0 flex flex-col">
        <div className="flex-1 min-h-0 p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* JSON editor */}
        <div className="flex flex-col gap-2 min-h-0">
          <div className="flex items-center justify-between">
            <p className="text-[8px] font-bold uppercase tracking-[0.22em] text-aws">BUCKET-POLICY.JSON</p>
            <span className={`text-[7px] font-extrabold tracking-[0.2em] px-1.5 py-0.5 border ${parsed ? "text-mint border-mint/50" : "text-danger border-danger/60"}`}>
              {parsed ? "VALID JSON" : "PARSE ERROR"}
            </span>
          </div>
          <textarea
            value={json}
            onChange={(e) => onJsonChange(e.target.value)}
            spellCheck={false}
            aria-label="Bucket policy JSON editor"
            className="flex-1 min-h-0 w-full resize-none bg-black/70 border border-foreground/20 focus:border-aws/60 outline-none p-2.5 text-[8.5px] leading-[13px] font-bold text-mint/90 cyber-scroll tracking-wider"
          />
        </div>

        {/* visual parse */}
        <div className="flex flex-col gap-2 min-h-0">
          <p className="text-[8px] font-bold uppercase tracking-[0.22em] text-aws">VISUAL GRANT MAP</p>
          <div className="flex-1 min-h-0 overflow-y-auto cyber-scroll flex flex-col gap-1.5 pr-1">
            {statements.map((st, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className={`glass-inset cyber-cut-sm p-2 border ${st.Effect === "Deny" ? "border-danger/40" : "border-mint/30"}`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`text-[7px] font-extrabold px-1.5 py-0.5 border tracking-[0.15em] ${st.Effect === "Deny" ? "text-danger border-danger/60" : "text-mint border-mint/60"}`}>
                    {st.Effect ?? "?"}
                  </span>
                  <span className="text-[7px] tracking-wider text-muted-foreground truncate">{st.Sid ?? `statement-${i + 1}`}</span>
                </div>
                <div className="flex flex-wrap gap-1 pt-1.5">
                  {asArray(st.Principal).map((p, j) => (
                    <span key={`p${j}`} className="text-[6.5px] font-bold border border-aws/40 text-aws px-1 py-0.5 tracking-wider">
                      WHO: {p === "*" ? "EVERYONE (*)" : p.replace("arn:aws:iam::", "")}
                    </span>
                  ))}
                  {asArray(st.Action).map((a, j) => (
                    <span key={`a${j}`} className="text-[6.5px] font-bold border border-neon/40 text-neon px-1 py-0.5 tracking-wider">
                      {a}
                    </span>
                  ))}
                  {asArray(st.Resource).map((r, j) => (
                    <span key={`r${j}`} className="text-[6.5px] font-bold border border-magenta/40 text-magenta px-1 py-0.5 tracking-wider max-w-full truncate">
                      {r}
                    </span>
                  ))}
                  {st.Condition &&
                    Object.entries(st.Condition).map(([block, kv]) =>
                      Object.entries(kv).map(([k, v]) => (
                        <span key={`c${block}${k}`} className="text-[6.5px] font-bold border border-mint/40 text-mint px-1 py-0.5 tracking-wider">
                          IF {k} {block === "Bool" ? "=" : block === "NotIpAddress" ? "NOT IN" : "IN"} {Array.isArray(v) ? v.join(" | ") : String(v)}
                        </span>
                      ))
                    )}
                </div>
              </motion.div>
            ))}
            {statements.length === 0 && (
              <p className="text-[7.5px] text-muted-foreground/60 uppercase tracking-wider px-1">
                {parsed ? "no statements — policy denies everything" : "fix the JSON to see grants"}
              </p>
            )}
          </div>
        </div>
        </div>
      </div>

      <VerdictFlash
        show={!!verdict}
        text={verdict?.verdict ?? ""}
        tone={verdict?.tone === "ok" ? "ok" : "deny"}
      />
    </UseCaseShell>
  );
}

/* ================================================================== */
/* TAB 06 — LIFECYCLE: COST AUTOPILOT                                  */
/* ================================================================== */

interface LcObj {
  id: number;
  key: string;
  sizeGB: number;
  created: number;
}

/* the three demo objects — a fixed set with real-world sizes so each card
   shows a meaningful monthly cost that visibly shrinks at every transition */
const LC_OBJECTS: LcObj[] = [
  { id: 0, key: "media/hero-4k.mp4", sizeGB: 2460, created: 0 },
  { id: 1, key: "img/catalog-2024.zip", sizeGB: 640, created: 140 },
  { id: 2, key: "logs/app-events.json", sizeGB: 90, created: 300 },
];
const LC_ICONS = [Video, ImageIcon, FileJson];

const LC_COST = { STANDARD: 0.023, IA: 0.0125, GLACIER: 0.004 } as const;
type LcTier = keyof typeof LC_COST;

const LC_BAR_CLS: Record<LcTier, string> = {
  STANDARD: "bg-aws",
  IA: "bg-neon",
  GLACIER: "bg-mint",
};

const fmtSize = (gb: number) => (gb >= 1024 ? `${(gb / 1024).toFixed(1)} TB` : `${gb} GB`);
const monthCost = (gb: number, tier: LcTier) => gb * LC_COST[tier];

/* AnimatedMoney — spring-tweened dollar readout; counts down when the tier drops */
function AnimatedMoney({ value }: { value: number }) {
  const spring = useSpring(value, { stiffness: 80, damping: 20 });
  useEffect(() => {
    spring.set(value);
  }, [value, spring]);
  const text = useTransform(spring, (v) => `$${v.toFixed(2)}`);
  return <motion.span className="text-sm font-extrabold tabular-nums text-foreground/95">{text}</motion.span>;
}

function tierOf(age: number, iaDay: number, glacDay: number, expireDay: number): LcTier | "EXPIRED" {
  if (age >= expireDay) return "EXPIRED";
  if (age >= glacDay) return "GLACIER";
  if (age >= iaDay) return "IA";
  return "STANDARD";
}

const LC_TIER_CLS: Record<LcTier | "EXPIRED", string> = {
  STANDARD: "text-aws border-aws/50 bg-aws/10",
  IA: "text-neon border-neon/50 bg-neon/10",
  GLACIER: "text-mint border-mint/50 bg-mint/10",
  EXPIRED: "text-danger border-danger/50 bg-danger/10",
};

function Slider({
  label,
  value,
  min,
  max,
  onChange,
  ariaLabel,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  ariaLabel: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[7.5px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
        <span className="text-[8px] font-extrabold tabular-nums text-aws">{value}d</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={15}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        aria-label={ariaLabel}
        className="w-full h-1.5 accent-[#ff9900] cursor-pointer bg-black/60 border border-foreground/20"
      />
    </div>
  );
}

function LifecycleUseCase({ immersiveActive, immersiveToggle }: S3UseCasesProps) {
  const [running, setRunning] = useState(false);
  const [day, setDay] = useState(0);
  const [iaDay, setIaDay] = useState(45);
  const [glacDay, setGlacDay] = useState(180);
  const [expireDay, setExpireDay] = useState(420);
  const [lines, setLines] = useState<{ id: number; text: string; tone?: string }[]>([]);
  const idRef = useRef(1);
  const prevTiers = useRef<Record<number, LcTier | "EXPIRED">>({});
  const logged = useRef<Record<number, boolean>>({});
  const cfgRef = useRef({ iaDay, glacDay, expireDay });
  useEffect(() => {
    cfgRef.current = { iaDay, glacDay, expireDay };
  }, [iaDay, glacDay, expireDay]);

  const push = (text: string, tone?: string) =>
    setLines((prev) => [...prev.slice(-40), { id: idRef.current++, text, tone }]);

  // time advances while running
  useTicker(running, () => setDay((d) => d + 9), 240);

  // transition detection + narration (with per-object monthly cost drop)
  useEffect(() => {
    const { iaDay: ia, glacDay: gl, expireDay: ex } = cfgRef.current;
    for (const o of LC_OBJECTS) {
      const age = Math.max(0, day - o.created);
      const tier = tierOf(age, ia, gl, ex);
      const prev = prevTiers.current[o.id];
      if (prev !== tier) {
        if (tier === "EXPIRED" && !logged.current[o.id]) {
          logged.current[o.id] = true;
          push(`DAY ${day} — ${o.key} EXPIRED → deleted forever (rule: expire @ ${ex}d)`, "danger");
        } else if (tier === "GLACIER") {
          const from = monthCost(o.sizeGB, "IA");
          const to = monthCost(o.sizeGB, "GLACIER");
          push(`DAY ${day} — ${o.key} → GLACIER — $${from.toFixed(2)}/MO → $${to.toFixed(2)}/MO (−68%)`, "mint");
        } else if (tier === "IA") {
          const from = monthCost(o.sizeGB, "STANDARD");
          const to = monthCost(o.sizeGB, "IA");
          push(`DAY ${day} — ${o.key} → STANDARD_IA — $${from.toFixed(2)}/MO → $${to.toFixed(2)}/MO (−46%)`, "neon");
        }
        prevTiers.current[o.id] = tier;
      }
    }
  }, [day]);

  const reset = () => {
    setRunning(false);
    setDay(0);
    setLines([]);
    prevTiers.current = {};
    logged.current = {};
  };

  const tierNow = (o: LcObj) => tierOf(Math.max(0, day - o.created), iaDay, glacDay, expireDay);
  const alive = LC_OBJECTS.filter((o) => tierNow(o) !== "EXPIRED");
  const expired = LC_OBJECTS.length - alive.length;
  const bill = alive.reduce((s, o) => s + monthCost(o.sizeGB, tierNow(o) as LcTier), 0);
  const stdBill = alive.reduce((s, o) => s + o.sizeGB * LC_COST.STANDARD, 0);
  const saving = stdBill > 0 ? Math.round((1 - bill / stdBill) * 100) : 0;

  const setGlacSafe = (v: number) => {
    const clamped = Math.max(iaDay + 30, Math.min(700, v));
    setGlacDay(Math.min(clamped, expireDay - 30));
  };
  const setExpireSafe = (v: number) => setExpireDay(Math.max(glacDay + 30, Math.min(730, v)));

  return (
    <UseCaseShell
      title="USE CASE // LIFECYCLE — COST AUTOPILOT"
      subtitle="DATA AGES → STORAGE CLASS TRANSITIONS AUTOMATICALLY → BILL SHRINKS"
      immersiveActive={immersiveActive}
      immersiveToggle={immersiveToggle}
      stats={
        <>
          <UCStat label="DAY" value={day} />
          <UCStat label="OBJECTS ALIVE" value={alive.length} tone="mint" />
          <UCStat label="EXPIRED" value={expired} tone={expired ? "danger" : "neutral"} />
          <UCStat label="MONTHLY BILL" value={`$${bill.toFixed(2)}`} tone={saving >= 40 ? "mint" : "aws"} />
          <UCStat label="SAVING VS STANDARD" value={`${saving}%`} tone={saving >= 40 ? "mint" : "neutral"} />
          <UCStat label="RULE" value={`IA ${iaDay}d · GL ${glacDay}d · EXP ${expireDay}d`} tone="neutral" />
        </>
      }
      controls={
        <>
          <SimControls
            running={running}
            onToggle={() => setRunning((r) => !r)}
            onReset={reset}
            status={running ? `TIME MACHINING — DAY ${day}` : "IDLE — PRESS RUN TO AGE THE DATA"}
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground">LIFECYCLE RULES</p>
          <Slider label="→ STANDARD_IA AT" value={iaDay} min={15} max={150} onChange={(v) => setIaDay(Math.min(v, glacDay - 30))} ariaLabel="Transition to Standard IA after days" />
          <Slider label="→ GLACIER AT" value={glacDay} min={45} max={600} onChange={setGlacSafe} ariaLabel="Transition to Glacier after days" />
          <Slider label="→ EXPIRE (DELETE) AT" value={expireDay} min={90} max={730} onChange={setExpireSafe} ariaLabel="Expire objects after days" />
        </>
      }
      logLines={lines}
      logTitle="LIFECYCLE TRANSITION LOG // LIVE"
      logEmpty="PRESS RUN — WATCH OBJECTS AGE INTO CHEAPER TIERS"
    >
      <FlowCanvas ariaLabel="S3 lifecycle use case diagram" className="h-full">
        <FlowLabel x={50} y={14} tone="aws">3 OBJECTS AGING — WATCH THE BILL SHRINK</FlowLabel>

        {/* object cards — title · size · tier · live monthly cost */}
        <div className="absolute left-[4%] right-[4%] top-[21%] bottom-[15%] flex flex-col justify-center gap-2.5 z-10">
          {LC_OBJECTS.map((o, i) => {
            const age = Math.max(0, day - o.created);
            const tier = tierOf(age, iaDay, glacDay, expireDay);
            const isExpired = tier === "EXPIRED";
            const monthly = isExpired ? 0 : monthCost(o.sizeGB, tier as LcTier);
            const rate = isExpired ? 0 : LC_COST[tier as LcTier];
            const meta = LC_TIER_CLS[tier];
            const Icon = LC_ICONS[i];
            const pctAge = Math.min(100, (age / 730) * 100);
            /* derived drop chip — an object "just" transitioned when sim time
               is within ~4 ticks (36d) past its rule threshold for that tier */
            const sinceIa = day - (o.created + iaDay);
            const sinceGl = day - (o.created + glacDay);
            const drop = !isExpired && sinceGl >= 0 && sinceGl <= 36 ? 68 : !isExpired && sinceIa >= 0 && sinceIa <= 36 ? 46 : undefined;
            return (
              <motion.div
                key={o.id}
                initial={{ opacity: 0, x: -18 }}
                animate={{ opacity: isExpired ? 0.45 : 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.12, duration: 0.45 }}
                className="glass-inset cyber-cut-sm px-2.5 py-2 flex flex-col gap-1.5"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isExpired ? "text-danger" : meta.split(" ")[0]}`} />
                  <span className={`text-[9px] font-bold tracking-wider text-foreground/90 truncate ${isExpired ? "line-through decoration-danger/70" : ""}`}>
                    {o.key}
                  </span>
                  <span className="text-[7.5px] font-bold tabular-nums text-muted-foreground shrink-0">{fmtSize(o.sizeGB)}</span>
                  <span className={`ml-auto shrink-0 text-[6.5px] font-extrabold px-1.5 py-0.5 border tracking-[0.15em] ${meta}`}>
                    {isExpired ? "EXPIRED" : tier === "IA" ? "STANDARD_IA" : tier}
                  </span>
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  {isExpired ? (
                    <span className="text-sm font-extrabold tracking-wider text-danger">DELETED</span>
                  ) : (
                    <AnimatedMoney value={monthly} />
                  )}
                  <span className="text-[7px] text-muted-foreground tabular-nums shrink-0">
                    {isExpired ? "— removed from the bill" : `/MO @ $${rate.toFixed(4)}/GB`}
                  </span>
                  <AnimatePresence>
                    {drop && !isExpired && (
                      <motion.span
                        key={drop}
                        initial={{ opacity: 0, scale: 0.7, y: 4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="text-[7px] font-extrabold text-mint border border-mint/60 bg-mint/10 px-1 py-0.5 tracking-[0.12em] shrink-0"
                      >
                        ▼ {drop}% /MO
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <span className="ml-auto text-[7px] font-bold tabular-nums text-aws shrink-0">AGE {age}d</span>
                </div>
                {/* age progress vs lifecycle rule thresholds */}
                <div className="relative h-1.5 bg-black/60 border border-foreground/10">
                  <motion.div
                    className={`h-full ${isExpired ? "bg-danger" : LC_BAR_CLS[tier as LcTier]}`}
                    animate={{ width: `${pctAge}%` }}
                    transition={{ duration: 0.35, ease: "linear" }}
                  />
                  {[
                    { d: iaDay, cls: "bg-neon" },
                    { d: glacDay, cls: "bg-mint" },
                    { d: expireDay, cls: "bg-danger" },
                  ].map((t) => (
                    <span
                      key={t.cls}
                      className={`absolute -top-[2px] -bottom-[2px] w-[2px] opacity-70 ${t.cls}`}
                      style={{ left: `${Math.min(100, (t.d / 730) * 100)}%` }}
                      aria-hidden="true"
                    />
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="absolute bottom-[5%] left-[6%] right-[6%] flex flex-wrap justify-center gap-1.5 z-10">
          {(["STANDARD", "IA", "GLACIER", "EXPIRED"] as const).map((t) => (
            <span key={t} className={`text-[6.5px] font-bold border px-1.5 py-0.5 tracking-[0.15em] ${LC_TIER_CLS[t]}`}>
              {t === "STANDARD" ? "STANDARD $0.023" : t === "IA" ? "STANDARD_IA $0.0125" : t === "GLACIER" ? "GLACIER $0.004" : "EXPIRED"}
            </span>
          ))}
        </div>
        <StepBadge step={Math.min(3, Math.floor(day / 240))} total={4} text={day >= 420 ? "EXPIRE ZONE" : day >= 180 ? "GLACIER ZONE" : day >= 45 ? "IA ZONE" : "HOT ZONE"} />
      </FlowCanvas>

      <UseCaseNote>
        LOGS → IA @30D → GLACIER @90D → EXPIRE @365D: TYPICAL BILL DROPS 60-90% WITH ZERO CODE CHANGES
      </UseCaseNote>
    </UseCaseShell>
  );
}

/* ================================================================== */
/* ROUTER                                                              */
/* ================================================================== */

export function S3UseCases({ id, immersiveActive, immersiveToggle }: S3UseCasesProps) {
  if (id === "DATA_LAKE") return <DataLakeUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
  if (id === "VERSIONING") return <VersioningUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
  if (id === "HOSTING") return <HostingUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
  if (id === "POLICY") return <PolicyUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
  return <LifecycleUseCase id={id} immersiveActive={immersiveActive} immersiveToggle={immersiveToggle} />;
}

/* re-export icon used by s3.tsx tab definitions */
export { Archive };
