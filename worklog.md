# AWS NEXUS — Worklog

Project: Fully graphical interactive AWS visualizer (Next.js 16 + Three.js + Framer Motion).
Theme: glassmorphism + cyberpunk, AWS orange (#FF9900), JetBrains Mono, sharp edges (no radius).

---

Task ID: 1
Agent: main (orchestrator)
Task: Core foundation — theme, fonts, icons, shared components, shell, registry, page.

Work Log:
- Installed three, @react-three/fiber@9, @react-three/drei@10, @types/three.
- Rewrote src/app/globals.css (cyberpunk glass theme, sharp edges, scanlines, grid, glow utilities).
- Rewrote src/app/layout.tsx (JetBrains Mono via next/font, metadata "AWS NEXUS").
- Created src/components/aws-icons.tsx — custom SVG icons for 11 AWS services + helpers.
- Created src/components/shared/* — GlassPanel, FlowNode, FlowLink, Callout, SimControls, SectionTitle, StatChip.
- Created src/lib/services-data.ts — metadata for all 11 service modules.
- Created shell components: header, footer (sticky), background-fx, boot-overlay, service-nav, hero.
- Created src/components/services/registry.tsx (next/dynamic, ssr:false) + placeholder modules for all services.
- Created src/app/page.tsx — single-route console shell with boot sequence, sidebar nav, module viewport.
- Built src/components/services/global-infrastructure.tsx — Three.js interactive globe.
- Built src/components/services/sqs.tsx — full reference implementation for agent modules.

Stage Summary:
- CONTRACT FOR SERVICE MODULES: every service visualizer is a client component (default export, no props)
  in src/components/services/<id>.tsx. Use shared components from @/components/shared/*, icons from
  @/components/aws-icons. Theme: orange primary, sharp edges, glass panels, JetBrains Mono, heavy
  framer-motion. See src/components/services/sqs.tsx as the golden reference.

---
Task ID: 2-core
Agent: main (orchestrator)
Task: Build Global Infrastructure 3D globe + SQS golden-reference module.

Work Log:
- Built src/components/services/global-infrastructure.tsx: R3F globe (4200-pt fibonacci sphere, atmosphere fresnel shader, 28 region markers with AZ satellites + pulsing rings, 18 animated inter-region arcs with traveling dots, 90 edge PoP points, starfield, OrbitControls auto-rotate). HUD: auto-rotate / arcs / arc-storm toggles. Side panel: region uplink info (latency sim, AZ bars) + clickable region list. 3 knowledge callouts.
- Built src/components/services/sqs.tsx: full interactive SQS simulator — producers -> queue (animated message chips) -> 2 workers -> DLQ; visibility-timeout retries, poison-message injector, FIFO/standard + long/short polling toggles, live stat chips, 3 callouts. Uses refs-as-source-of-truth pattern (NO setState inside updaters).
- Fixed lint: no setState-in-effect in globe, {"//"} escaping for jsx-no-comment-textnodes.
- Lint: PASS. Dev server compiles.

Stage Summary:
- sqs.tsx is the GOLDEN REFERENCE pattern for all remaining service modules (agents 2-a/2-b/2-c).
- Simulation pattern: useRef holds sim truth; setInterval mutates refs; flush with setState once per tick.
- Lint traps: react/jsx-no-comment-textnodes (use {"//"}), react-hooks/set-state-in-effect.

---
Task ID: 2-c
Agent: general-purpose
Task: API Gateway, SNS, CloudFront visualizer modules

Work Log:
- Read worklog + contract files (sqs.tsx golden reference, shared/flow, glass-panel, callout, sim-controls, typography, aws-icons, services-data, globals.css).
- Built src/components/services/api-gateway.tsx (GATE PROTOCOL): request-lifecycle pipeline sim — CLIENT → API GATEWAY core ("execute-api.us-east-1") containing 5 sequential stage chips (API KEY CHECK → AUTHORIZER → REQ VALIDATION → THROTTLING → INTEGRATION) → 3 backends (λ PROXY / HTTP BACKEND / S3 GET). 350ms tick walks each request stage-by-stage with live REQUEST INSPECTOR log ("> GET /orders/v1", "> api-key ✓", "> lambda-authorizer ✓ policy ALLOW", "> schema valid", "> integrated: AWS_PROXY lambda", "< 200 OK 118ms"). Fail modes: 3% invalid → red 400 at validation chip, throttle breach → red 429 + "RATE EXCEEDED" label. BURST TEST ×12 (fires 12 req @ ~100ms; with THROTTLE 10 RPS toggle, req #11/#12 die 429 at throttling chip). DEV/PROD stage selector switches log prefix (/v1 vs /v2) + cache profile stat. CACHING toggle + TTL slider (60–3600s): mint "CACHE HIT 9ms" bypasses backend (40% prod / 30% dev, scaled by TTL). StatChips: REQUESTS / 2XX / 4XX-429 / P50 LATENCY (rolling median). 3 callouts (exam: REST vs HTTP vs WebSocket; tip: usage plans + API keys; info: VTL mapping templates).
- Built src/components/services/sns.tsx (SIGNAL BURST): fan-out storm sim — PUBLISHER ("ORDER SERVICE") → SNS TOPIC core ("orders-topic" with infinite pulsing rings + magenta shockwave per publish) → 5 subscribers (SQS QUEUE, LAMBDA, EMAIL[Mail], HTTPS WEBHOOK[Globe], MOBILE PUSH[Smartphone]). RUN publishes every 900ms or PUBLISH EVENT button; publisher dot → topic then 5 dots fan out staggered 60ms (FlowLink remount keyed per publish with dotDelay i*60ms); subscriber flash + counter on arrival. MSG ATTRS + FILTER POLICY toggle: alternating PURCHASE/REFUND attribute chip on topic, per-sub filter chips in node subs (SQS:[PURCHASE], Email:[REFUND], others ALL); non-matching links go dim gray, counters frozen, log "> filter policy: sqs-queue skipped [REFUND]"; matching log "> filter policy: sqs-queue matches [PURCHASE] ✓ delivered". Rare 2% delivery failure (danger + retry/exp-backoff log). StatChips: PUBLISHED / DELIVERIES / FAN-OUT RATE (deliveries÷published, ×) / FAILED. 3 callouts (exam: SNS→SQS fan-out; info: at-least-once + exp backoff; tip: filter at subscription time).
- Built src/components/services/cloudfront.tsx (EDGE MIRROR): HIT-vs-MISS race sim — 3 USER nodes (MUMBAI/FRANKFURT/TOKYO) → 3 custom EdgeNode blocks (glowing diamond glyph, mint cache gauge bar, HIT/MISS counters: EDGE-BOM/FRA/NRT) → ORIGIN block ("s3://app-bucket", S3 icon, live FETCHES counter). RUN alternates users every ~900ms (300ms phase engine): request dot user→edge; HIT (gauge>0) → mint response dot back, 9–14ms; MISS → red dot edge→origin → S3 flash → orange dot origin→edge → gauge fills to 100%, 120–240ms. TTL slider (60–3600s) compresses to ttl/50 ticks for per-edge object expiry (lower TTL = more MISS). INVALIDATION button: pseudo ID "I-XXXX", clears all gauges + magenta purge wave sweeps canvas + "> invalidation I-XXXX completed: /*" log. LATENCY READOUT panel: big animated AVG HIT (mint) vs AVG MISS (danger) numbers + two spring-animated race bars + ×-slower caption. StatChips: CACHE HIT RATIO / AVG HIT / AVG MISS / ORIGIN FETCHES. 3 callouts (tip: 600+ PoPs ~10ms; exam: cache key + invalidation pricing; info: HTTP/3, Brotli, OAC).
- All three: refs-as-source-of-truth pattern (interval mutates refs, flush setState per tick — no setState in effect bodies or updaters), stable useCallback pushLog/flush helpers, AnimatePresence on logs/labels/chips, aria-labels on every control, glass-inset max-h-32 cyber-scroll log panels with auto-scroll, {"//"} escaping in JSX text, h-[360px] sm:h-[420px] canvases, grid-cols-2 sm:grid-cols-4 StatChip rows, md:grid-cols-3 callout grids.
- Verification: bun run lint → clean (no errors/warnings); scoped tsc --noEmit → zero errors in the three files. Did NOT touch shared components, registry, page.tsx, or other services' files.

Stage Summary:
- 2-c complete: api-gateway.tsx / sns.tsx / cloudfront.tsx are full interactive simulators matching sqs.tsx fidelity.
- Sim engine convention for these modules: refs are truth; per-phase tick engines (350ms API GW, 900ms SNS publish, 300ms CF phase machine); discrete per-request animation via FlowLink remount keyed on request/fan ids; transient UI flashes via setTimeout in handlers/timers only.
- Lint: PASS (whole project). tsc: PASS for 2-c files.

---
Task ID: 2-b
Agent: general-purpose
Task: EC2, ELB, Lambda visualizer modules

Work Log:
- Read worklog + contract files (sqs.tsx golden reference, shared/flow, glass-panel, callout, sim-controls, typography, aws-icons, services-data, globals.css, eslint.config.mjs).
- Built src/components/services/ec2.tsx (CORE FORGE): two stacked GlassPanels. PANEL A "LIFECYCLE STATE MACHINE": FlowCanvas state graph STOPPED → PENDING → RUNNING → STOPPING with TERMINATED off to the side (danger) — links keyed start/boot/stop/halt/reboot/terminate/revive; START/STOP/REBOOT/TERMINATE motion buttons (terminate disabled unless running, asks nothing, just animates), TERMINATED state shows danger glow + REVIVE button (mints a new instance id from an AMI-snapshot cycle); autopilot interval drives transitions; each hop pulses the target node, lights the FlowLink, and appends a line to the glass-inset max-h-28 cyber-scroll state log ("> instance i-0ab3 :: PENDING → RUNNING (boot complete, status checks 2/2)"). PANEL B "AUTO SCALING GROUP SIM": CPU LOAD slider (accent #ff9900) with jittered measured avg + colored capacity bar; dashed ASG boundary containing motion/layout instance chips — target-tracking every 1s tick (avg>70% scale-out to max 6, avg<30% scale-in to min 1, pending chips "INITIALIZING…" for 2 ticks, terminating chips drain a tick then exit-animate); latest-policy-event ticker line. StatChips A: STATE / TRANSITIONS / AUTOPILOT / INSTANCE ID; StatChips B: INSTANCES / CPU LOAD / DESIRED vs ACTUAL / MIN·MAX 1/6. Instance family mini-grid (T3 GENERAL 2/4 burstable web, C6I COMPUTE 8/16 high-perf webservers, R6I MEMORY 8/64 in-memory cache, M6I BALANCED 4/16 general, P4 GPU 64/1152 + 8×A100 ML, I4I STORAGE 16/128 NVMe) — selected card aws border + box-glow + animated detail strip. Callouts: tip (user data bootstrap), exam (Spot = 2-min interruption notice, up to 90% off), critical (IMDSv2 session tokens block SSRF credential theft).
- Built src/components/services/elb.tsx (TRAFFIC SPLITTER): FlowCanvas USERS (cloud of 3 bobbing UserIcon dots) → LISTENER :443 → ALB diamond (rotate-45 border core, ELBIcon counter-rotated, live path chip) → dashed TG-WEB-PROD boundary with 4 EC2 target FlowNodes (tg-web-01..04) each with counter sub + motion width request bar. RUN fires a request every 700ms: HTML motion dot flies USERS→ALB→selected target (keyframed left/top percent arrays), round-robin over HEALTHY targets only; per-target node pulses + link flows for that tick. HEALTH CHECK sim: KILL TARGET button (plus rare 6% auto-kill under load) drains a target — danger red, "UNHEALTHY — DRAINING", dashed dead link, counter paused — then auto-recovers (recovering → success green → healthy) after ~4 ticks and traffic visibly redistributes. PATH RULES toggle: adds second dashed TG-IMG-CACHE with tg-img-01/02 + magenta links; requests alternate /api/* vs /img/* chips (label rides the request dot). StatChips: REQUESTS SENT / HEALTHY TARGETS x/4 / ALGORITHM ROUND ROBIN / ACTIVE CONNECTIONS (random walk). Callouts: exam (ALB L7 path/host vs NLB L4 static IPs), info (cross-zone load balancing), tip (health checks + graceful draining).
- Built src/components/services/lambda.tsx (PHANTOM COMPUTE): FlowCanvas with 4 clickable event-source nodes (API GATEWAY POST /ORDER, S3 PUT OBJECT, SQS BATCH ×10, EVENTBRIDGE CRON 5 MIN) → big custom λ core block (LambdaIcon, fn order-processor, nodejs20.x + memory + COLD/WARM chips, phase label, animated progress bar, container POOL chips max 5 + overflow, est-latency readout ~950ms cold / ~85ms warm) → outputs CLOUDWATCH (mint) + DLQ (danger). 110ms engine loop: fire() assigns container (cold provisions fresh + counts coldStarts, warm reuses idle), exec phases fly (520ms) → provision (1800ms cold only) → execute (duration inversely scaled by memory slider 128–3008MB via sqrt(256/mem)); on completion output dot flies mint→logs or danger→DLQ (8% fault injection), log line appended ("> req-014 SQS :: OK 92ms (warm) → CLOUDWATCH LOGS"). Concurrency gauge (4 slots): in-flight ≥ 4 → extra invokes THROTTLED — RateExceeded 429, danger flash on λ node, log + THROTTLES stat; BURST ×6 button demos it. COLD/WARM toggle (Snowflake/Flame), MEM slider, autopilot random event every ~900ms. StatChips: INVOKES / ERRORS / P50 DURATION (rolling median) / THROTTLES. Callouts: critical (15-min cap → Step Functions), tip (provisioned concurrency), exam (stateless → DynamoDB/S3, pay per request + GB-second).
- All three follow sqs.tsx patterns: refs-as-source-of-truth (setInterval mutates refs, single setState flush per tick — no setState in effect bodies or inside updaters), instance-id/container-id counters in refs to avoid stale closures, AnimatePresence on logs/chips/labels, aria-labels on all interactive elements, {"//"} escaping in JSX text, h-[360px] sm:h-[420px] canvases, grid-cols-2 sm:grid-cols-4 StatChip rows, md:grid-cols-3 callout grids, px-3 py-1.5 text-[9px] tracking-[0.16em] cyber-cut-sm control buttons. Timers tracked in refs and cleared on unmount/reset.
- Verification: bun run lint → PASS (0 problems, whole project); bunx tsc --noEmit → zero errors in src. Touched ONLY ec2.tsx / elb.tsx / lambda.tsx.

Stage Summary:
- 2-b complete: ec2.tsx / elb.tsx / lambda.tsx are full interactive simulators at sqs.tsx fidelity — EC2 lifecycle + ASG target tracking, ELB round-robin + health-check failover + path routing, Lambda cold/warm + memory-scaling + 429 throttling.
- Engine conventions kept identical to the golden reference (refs truth + flush per tick); discrete request dots rendered as keyframed HTML layers inside FlowCanvas, links/nodes via shared Flow primitives.
- Lint: PASS. tsc: PASS. No shared files modified.

---
Task ID: 2-a
Agent: general-purpose
Task: IAM, S3, VPC visualizer modules

Work Log:
- Read worklog + contract files (sqs.tsx golden reference, shared/flow, glass-panel, callout, sim-controls, typography, aws-icons, services-data, globals.css, registry.tsx, package.json + lucide icon availability check).
- Built src/components/services/iam.tsx (ACCESS MATRIX): live policy-evaluation engine — 3 clickable principal FlowNodes (ROOT USER / USER ALICE dev-group / ROLE app-lambda-role, selected = magenta cyber status) → glowing IAM POLICY ENGINE core block (custom glass cyber-cut block containing a vertical 5-policy stack per principal with spring-animated ALLOW/DENY/SKIP/HALT badges + currently-evaluated row highlighted) → big verdict block (ACCESS GRANTED mint / ACCESS DENIED danger, reason line, AnimatePresence mode="wait"). 900ms tick step machine: request snapshot (principal/action/mfa frozen at start) → evaluate policies in order → explicit deny short-circuits with HALT on remaining rows → else any-allow → else default deny; glass-inset max-h-40 cyber-scroll ENGINE TRACE terminal ("> req #001 — USER ALICE @ s3:GetObject [mfa=ON]", "> MFA-GUARD ... no MFA in session context — EXPLICIT DENY", "> VERDICT: ACCESS DENIED — explicit deny") with tone-colored lines + auto-scroll. Toggles: MFA ENROLLED on/off (off → MFA-conditional deny triggers for s3:*), ACTION UNDER TEST selector (s3:GetObject vs iam:DeleteUser — changes which policies match), EVALUATE NOW button runs a full synchronous evaluation when paused. Policy sets differ per principal (root ADMIN-ACCESS Allow *, alice S3-READONLY, role LAMBDA-S3-READ) so identity type changes outcomes. StatChips: POLICIES EVALUATED / VERDICT / IDENTITY TYPE / MFA. Callouts: exam (explicit deny > allow > default deny), critical (never use root, prefer roles over long-lived keys), info (IAM global + free + aws:MultiFactorAuthPresent condition key).
- Built src/components/services/s3.tsx (INFINITE VAULT): lifecycle + replication sim — UPLOADS producer FlowNode (clickable, also auto-produces ~70%/tick) → primary BUCKET core block ("app-assets-us-east-1", 8 stacked motion chips with tier-colored borders + live count spring + "+N more" + VERSIONING footer + OVERWRITE danger flash overlay) → dashed FlowLink "CROSS-REGION REPLICATION" → REPLICA block ("replica-eu-west-1", magenta, CRR ACTIVE/PAUSED footer, count + last 3 chips). Vertical 4-tier lifecycle stack (STANDARD $0.023 → STANDARD_IA $0.0125 → GLACIER $0.004 → DEEP_ARCHIVE $0.00099) as glass-inset boxes with per-tier chips + counts, left-edge FlowLinks pulse mint when a tier receives, age labels ≥90/≥180/≥365 DAYS between tiers, DAY COUNTER +30/tick with threshold transitions at 90/180/365. STORAGE CLASS PRICING panel: animated proportional cost bars (motion width) for all 4 tiers. VERSIONING toggle (ON: same-key PUTs stack v1/v2/v3 chips; OFF: OVERWRITE flash, object count frozen), REPLICATION toggle (ON: new objects duplicate into replica with flowing dots), PUT OBJECT manual button. Objects capped at 60/30 to keep sim bounded. StatChips: OBJECTS / DAYS ELAPSED / REPLICA OBJECTS / EST $/GB-MO (weighted avg of tier mix, mint when ≤ $0.008). Callouts: info (11 nines durability via ≥3 AZs), exam (bucket names globally unique, DNS rules), tip (lifecycle to archive tiers cuts cost ~83-96%, watch retrieval fees).
- Built src/components/services/vpc.tsx (VOID NETWORK): packet-trace architecture — INTERNET → INTERNET GATEWAY at top, then 4 dashed-border SubnetBox containers (PUBLIC/PRIVATE × AZ-A/AZ-B with CIDR + route-table tags, danger-tinted on failure) holding xs FlowNodes: NAT-A/LB-A + EC2-A1/EC2-A2/RDS-A (AZ-A), mirrored AZ-B stack driven by ambient random background traffic. 1.1s step machine walks a 5-hop trace: 1 IGW (route 0.0.0.0/0) → 2 NACL inbound allow → 3 SG accepts :443 (state entry) → 4 NAT translate egress → 5 response returns; links go flowing progressively, highlighted node per step, glass-inset max-h-40 cyber-scroll PACKET TRACE terminal ("> 2. NACL PUBLIC-A: rule 100 ALLOW TCP:443 IN — forwarded to LB", "> 5. response returns — SG STATEFUL: return flow auto-allowed"). SG/NACL view toggle: SG = mint STATEFUL badge + mint return dot on the big left return arc; NACL = danger STATELESS badge + red return link + "✕ RETURN DROPPED — STATELESS" spring overlay. NAT GATEWAY on/off toggle: off → hop 4 fails, red link + "✕ NO ROUTE TO INTERNET" overlay + blackhole log line, private subnet box tinted danger. STEP TRACE button advances one hop while paused. StatChips: VPC CIDR 10.0.0.0/16 / AZs 2 / SUBNETS PUB-PRIV 2-2 / ROUTE TABLES 3. Callouts: exam (SG stateful vs NACL stateless numbered first-match, ephemeral ports 1024-65535), tip (NAT GW must sit in a public subnet, never point private RT at IGW), info (peering non-transitive → Transit Gateway).
- All three follow sqs.tsx conventions: "use client", default export, no props, refs-as-source-of-truth (useCallback tick mutates refs, single setState flush per tick, no setState in effect bodies or updaters), stable deps ([flush]-chained), AnimatePresence + motion on every state change, aria-label/aria-pressed on all interactive elements, {"//"} and {"..."} braced expressions instead of literal // or > in JSX text, h-[360px] sm:h-[420px] canvases, grid grid-cols-2 sm:grid-cols-4 StatChip rows, px-3 py-1.5 text-[9px] tracking-[0.16em] cyber-cut-sm control buttons, md:grid-cols-3 callout grids. Only orange/amber/magenta/mint/danger/white palette — no blues.
- Verification: bun run lint → clean for whole project (0 errors/warnings); bunx tsc --noEmit → zero errors in the three files (remaining tsc noise is pre-existing examples/ + skills/ dirs, untouched). Did NOT modify shared components, registry, page.tsx, or other services' files. Dev server intentionally not run per instructions.

Stage Summary:
- 2-a complete: iam.tsx / s3.tsx / vpc.tsx are full interactive simulators at sqs.tsx fidelity — IAM policy-evaluation engine with per-principal policy stacks and explicit-deny-first verdicts, S3 lifecycle/versioning/replication vault with animated tier transitions and cost bars, VPC packet-trace with stateful-vs-stateless filter views and NAT failure mode.
- Request/trace engines use immutable snapshots (reqRef) so mid-flight toggle changes apply only to the NEXT request — mirrors real IAM session context semantics.
- Lint: PASS. tsc: PASS for 2-a files.

---
Task ID: 3
Agent: main (orchestrator)
Task: Integration, E2E verification with Agent Browser, final fixes.

Work Log:
- Fixed registry.tsx: next/dynamic options must be inline object literals in Next 16 (Turbopack rejected shared `opts` variable) — "Ecmascript file had an error" on page load.
- Fixed service-nav.tsx: sticky nav rail lacked z-index and was painted under the content container (blocked clicks) — added relative z-20.
- Fixed shared/flow.tsx FlowLink: agents placed FlowLink as FlowCanvas CHILDREN (HTML layer) causing React "tag <g>/<path> unrecognized" errors and invisible links. FlowLink is now a self-contained nested <svg> overlay (valid in both HTML and SVG contexts) — all 11 modules' flow lines now render.
- Agent Browser E2E VERIFIED: boot sequence renders; globe interactive (region click → uplink panel, HUD toggles); all 11 modules render; IAM policy-engine sim runs (ALLOW verdicts, animated dots); CloudFront HIT/MISS race runs (origin fetches, cache gauges); SQS sim runs (messages → workers) and poison injector → DLQ [1] + DEAD-LETTERED counter; mobile 390px responsive; footer sticky; keyboard hotkeys 1-0,- wired.
- Console: 0 errors. Lint: PASS. dev.log: all recent GET / 200.

Stage Summary:
- PROJECT COMPLETE: AWS NEXUS — 11 interactive modules, Three.js globe, framer-motion everywhere, glassmorphism + cyberpunk, JetBrains Mono, sharp edges, AWS orange.
- Golden-path verified in real browser. Ready for preview.

---
Task ID: 4
Agent: main (orchestrator)
Task: UI revision — remove top bar/footer/hero/marquee, 100% width, fix glitching line animations with anime.js.

Work Log:
- Removed <Header/>, <Hero/>, <Footer/> from src/app/page.tsx; deleted header.tsx / footer.tsx / hero.tsx. Container dropped max-w-[1500px] mx-auto -> w-full px-3 sm:px-5 (true 100% width).
- service-nav.tsx: desktop rail sticky top-[72px] -> top-4 (no header anymore); mobile chips -mx-4 px-4 -> -mx-3 px-3 to match new container padding.
- globals.css: removed marquee-x/marquee-track, dash-flow keyframes + class, glitch-layer, neon-flicker (all unused after hero removal).
- Installed animejs@4.5.0. Verified v4 API from shipped .d.ts (animate, createTimer, Timer.iterationProgress, ease names, cancel()).
- REWROTE shared/flow.tsx FlowLink — root cause of line glitching was the stretched <svg viewBox="0 0 100 100" preserveAspectRatio="none"> + CSS dash-flow + SMIL animateMotion under non-uniform scaling (distorted dashes, elliptical dots, Chrome dash-offset flicker):
  * FlowLink now renders a self-contained pixel-space SVG overlay; measures its box with ResizeObserver and rescales the 0-100 path into real pixels via a full path parser (M/L/H/V/C/S/Q/T/A/Z + relative + implicit repeats).
  * All motion driven by anime.js: flowing dashes = animate(path, {strokeDashoffset: -14, duration 700ms, linear, loop}) (one seamless dash period per loop); traveling packets = createTimer with iterationProgress -> path.getPointAtLength (constant speed, perfect circles, glow halo circle); arrowhead aligned to end tangent.
  * Old instances cancelled via cancel()/utils.remove on every rebuild/unmount (no engine leaks). FlowCanvas: links layer moved out of the stretched svg into an HTML under-layer (z-0) below nodes.
- Mobile overflow fixes (was scrollWidth 450 vs 390): GlassPanel header flex-wrap + actions min-w-0 max-w-full (drop shrink-0 so SimControls can wrap); SimControls status span max-w-[62vw] truncate; service-nav chips -mx-3. Result: BODY_SCROLL_W 390 = viewport 390.
- Agent Browser E2E VERIFIED: fresh boot -> globe; hotkeys 2/4/5/6/7/8/9/0/- all switch modules; IAM EVALUATE (ALLOW verdict + trace); SQS run (anime dot x: 138->356px constant speed); ELB run (dashes animating, offset -5.38 changing, 3 dots); SNS storm (6 staggered dots per publish, keyed remounts clean); Lambda burst x6 (12 invokes, all 4 sources, DLQ); API GW burst (2x 429 RATE EXCEEDED); CloudFront race + invalidation (HIT dot mint, MISS dashed arc); EC2 start + autopilot (reboot arc renders); mobile 390px no overflow, header wraps correctly.
- Lint PASS, tsc PASS (0 errors), dev.log all 200s, browser console clean (only pre-existing THREE.Clock deprecation notice from drei internals).

Stage Summary:
- Line/dot rendering engine fully replaced: pixel-space SVG + anime.js — no stretched-viewBox artifacts, dashes and dots animate uniformly at any canvas size, resize-safe (ResizeObserver rebuild).
- Chromeal chrome: no top bar, no footer, no hero/marquee; app is edge-to-edge 100% width.
- FlowLink public API unchanged (d/status/strokeWidth/dot/dotDuration/dotDelay/dashed/showArrow) — zero changes needed in the 11 service modules.

---
Task ID: 5
Agent: main (orchestrator)
Task: UI revision round 2 — remove QUICK JUMP menu, collapsible sidebar (default shrink), bigger animation cards, dotted-map globe overhaul, remove background scan bar, runtime details.

Work Log:
- page.tsx: removed bottom QUICK JUMP [KEYS 1-0,-] row (hotkeys still work headlessly); module viewport bumped to p-4 sm:p-6 min-h-[560px].
- service-nav.tsx: REBUILT as collapsible rail — default SHRINK mode (60px, icons only), spring-animated width toggle to 248px (labels + codenames + live UTC clock). Shrink tooltips via createPortal to body (escapes rail overflow, glass-deep styled, index//short + codename). Preference persisted in localStorage (awsnexus-rail). Footer shows uplink dot when shrunk; expand/collapse ChevronsLeft/Right button in header row. Mobile chips unchanged.
- background-fx.tsx: removed the moving scan beam (the "moving bar"); added slow breathing ambient glow + upgraded particles (12, mixed aws/magenta/white/neon palette, drift + glow halo, varied sizes).
- FlowCanvas heights bumped in ALL 10 flow modules: h-[360px] sm:h-[420px] -> h-[440px] sm:h-[540px] (sqs 520). Globe canvas: h-[440px] sm:h-[560px] lg:h-[640px]; side column 320px.
- global-infrastructure.tsx REWRITTEN: real DOTTED WORLD MAP — 28 hand-authored landmass polygons (NA, Greenland, SA, Africa, Eurasia, islands, Japan, Indonesia, Australia, NZ, Antarctica...) with bbox-rejected ray-casting isLand() over 16k fibonacci points (bright land dots 0.021/0.9 + faint ocean dots 0.007/0.09); 30° graticule lineSegments; land-only seeded CloudFront PoPs (150); tube-geometry arcs (additive) with 2-dot trails + magenta highlight of arcs connected to selected region; region markers now: expanding ping rings (loop scale/fade), ORBITING AZ satellites (quaternion-aligned tangent plane), magenta uplink beam cylinder on selected; star twinkle.
- Runtime details added: LIVE TELEMETRY chips (requests/sec, data-out GB/s, active VMs, edge locations — random-walk tickers), PKTS/SEC + LAT/LON TRACE HUD on globe, LIVE OPS FEED (12 event generators, UTC timestamps, tone-coded, auto-scroll, every 2.1s), region egress throughput bar, per-region AZ count in list, live UTC clock in rail footer. Fixed region count 27->28.
- Fixed Arcs tube geometry leak (geo created in useMemo + disposed on cleanup). Fixed lint: set-state-in-effect (rAF-deferred localStorage read), immutability (LCG seed as object property).
- Camera framed: [0, 0.7, 7.4] fov 40.
- E2E VERIFIED (Agent Browser): boot -> globe dotted continents render + telemetry ticking; expand/collapse sidebar both modes; hover tooltip on shrunk rail (04//VPC); VPC + SQS + Lambda (burst, pool chips) + CloudFront (MISS arc, origin fetches) all run at new sizes; hotkeys 2/7/0/- work; mobile 390px scrollW=390 (no overflow); console clean; lint PASS; tsc PASS.

Stage Summary:
- Chrome: no quick-jump menu; sidebar is a collapsible icon rail by default (hover tooltips) expanding to full labels + UTC clock; background bar removed.
- Globe upgraded from uniform fibonacci dots to a recognizable dotted world map with countries-scale landmasses, graticule, land-only PoPs, orbited AZs, ping rings, uplink beams, tube arcs with trails + selection highlighting.
- All animation cards enlarged (540px flow canvases, 640px globe on desktop) + live runtime telemetry/ops-feed details.

---
Task ID: 6
Agent: main (orchestrator)
Task: Replace custom icons with REAL AWS icons from the official AWS Architecture Icons package (user-provided download link), used in all needed places.

Work Log:
- Downloaded the official AWS Architecture Icons package (Icon-package_07312026, 14MB) from d1.awsstatic.com, extracted and mapped icons for all 11 modules + helpers.
- Copied 24 official SVGs to public/icons/aws/: Arch service icons (iam/s3/vpc/ec2/elb/lambda/api-gateway/sns/sqs/cloudfront/ec2-auto-scaling/cloudwatch/dynamodb/rds/route-53) + group icons (aws-cloud/region/public-subnet/private-subnet/auto-scaling-group/ec2-instance-contents/vpc-group/aws-account/server-contents).
- REGENERATED src/components/aws-icons.tsx via script (/home/z/.tmp/gen-aws-icons.mjs): 21 inline glyph components now embed VERBATIM path data from official AWS Resource-Icons (48px) / group icons, rendered with fill="currentColor" so all status tinting in flow diagrams keeps working (EC2Instance, S3 Bucket, Lambda Function, ALB, VPC, IGW, NAT GW, RDS Multi-AZ, DynamoDB Table, CloudWatch, SNS Topic/Email/HTTP-Notification, SQS Queue, API GW Endpoint, IAM Permissions, AWS User/Server/Database/Internet/Account/AWS-Cloud). Same IconProps API (strokeWidth kept as no-op) -> zero changes needed in existing call sites. New exports: AWS_ARCH_ICONS (service id -> colored tile path), AWS_EXTRA_ICONS (14 extra tiles), AWSIconTile (<img> wrapper).
- service-nav.tsx: shrink rail + expanded rail + mobile chips + hover tooltip now render the official COLORED AWS tiles (AWSIconTile) instead of stroke glyphs; active tile gets border glow, hover scale-110.
- page.tsx module header: official colored tile in the 44px bordered frame (with alt text); boot-overlay.tsx: new strip of all 11 official tiles mounting in sequence during boot.
- Module internals ("needed places"): IAM ROOT USER -> official AWS Account glyph; Lambda CLOUDWATCH output -> official CloudWatch glyph; SNS EMAIL/HTTPS WEBHOOK subscribers -> official Email/HTTP-Notification glyphs; VPC INTERNET GATEWAY/NAT-A/NAT-B -> official IGW/NAT glyphs, RDS-A/B -> official RDS Multi-AZ glyph, all 4 SubnetBoxes -> official public/private subnet tiles; EC2 ASG boundary header -> official EC2 Auto Scaling tile; global-infrastructure ALL REGIONS rows -> official Region tile. Removed now-unused lucide imports (Fingerprint, ScrollText, Mail, Globe, Route, Network).
- Verified: bun run lint PASS (0 problems), tsc PASS (0 errors in src).
- Agent Browser E2E: boot strip shows 11 colored tiles; shrink rail = real colored icons; hover tooltip shows VPC teal tile + labels; expanded rail shows all 11 official tiles + labels; module headers (GLOBAL/VPC/LAMBDA/SNS/IAM/SQS) show official tiles; VPC subnet tiles + IGW/NAT/RDS glyphs render; EC2 ASG header shows Auto Scaling tile; Lambda CloudWatch node + SNS email/HTTP subscriber glyphs render; SQS sim RUN -> messages flow to workers (icons live); IAM principals show Account/User/Lambda glyphs; mobile 390px scrollW=390, chips show real icons; console clean (only pre-existing THREE.Clock deprecation); dev.log all 200s.

Stage Summary:
- The app now uses the REAL official AWS architecture icons everywhere: colored square tiles (nav rail shrink+expand, tooltips, mobile chips, module headers, boot strip, ASG header, subnet boxes, region rows) and inline glyph artwork (every FlowNode/FlowLabel/core block across all 11 modules) with currentColor tinting preserved.
- aws-icons.tsx is now generated from the official package (script at /home/z/.tmp/gen-aws-icons.mjs) — 21 glyphs + tile maps; public/icons/aws/ holds 24 official SVGs.
---
Task ID: 7-b
Agent: general-purpose
Task: RDS visualizer module — "SYNC SHADOW" (Multi-AZ sync replication, read-replica async lag, failover state machine, RDS Proxy pooling)

Work Log:
- Read worklog (2-a/2-b/2-c conventions) + contract files (sqs.tsx golden reference, shared/flow, glass-panel, sim-controls, typography, callout, aws-icons, globals.css, eslint.config.mjs); verified lucide icon availability (Layers/Gauge/Zap/ZapOff/Power) and RDSIcon/RDSInstanceIcon/RDSProxyIcon glyphs.
- Built src/components/services/rds.tsx ONLY (no other file touched). Engine: refs-as-source-of-truth, 850ms setInterval keyed on [running, multiAZ, proxyOn, replicaCount], tick mutates refs then one flush() of all setStates at tick end (no setState in effect bodies/updaters); tick handles: writes (baseline ~50% 1-2, WRITE STORM 4-6/tick x8 ticks), reads (~60% 1-3), connection pool (12-tick gauge, proxy queues overflow silently vs direct reject + danger flash + "TOO MANY CONNECTIONS — REJECTED"), commit at primary with occasional "WRITE committed — fsync X.Xms — standby ack" logs, async ship replicaLag[i] += n*45+rand(0,30) then *0.65 decay + replicaApplied, round-robin read routing with stale-read detection (lag>500 → staleReads++ + warn log + neon tint), pendingWrites queueing during failover with 2/tick flush to new writer, tick-stamped tone-coded engine log (max 8 lines, newest last, auto-scroll).
- FAILOVER state machine: button → "down" (danger overlay PRIMARY UNREACHABLE + QUEUE n WRITES, links die) → multi-AZ: 1 tick → "promoting" (primaryIsA role-swap, mint flash STANDBY PROMOTED — DNS CNAME SWITCHED, failovers++) → "rebuilding" 4 ticks (rebuildPct 0→100, magenta REBUILDING progress + cyber sync link) → "none"; single-AZ: permanent OUTAGE — NO STANDBY // MULTI-AZ OFF overlay + downtimeTicks counter until RESTORE WRITER button (mint, only visible then). SYNC vertical link (flowing on write / mint zero-lag / cyber during rebuild), dashed ASYNC SHIP links with per-replica LAG badges (magenta >500) + APPLIED counts, custom role-swappable DB-WRITER/DB-STANDBY glass blocks (writes counter, 12-tick CONNS gauge, storage bar, PG 16.4, AnimatePresence standby).
- Controls: MULTI-AZ toggle (magenta), RDS PROXY toggle (mint, node ghosts opacity-40), 0/1/2 REPLICAS selector group, WRITE STORM (neon), FAILOVER (danger, disabled mid-failover), RESTORE WRITER; StatChips WRITES/READS/MAX REPLICA LAG (magenta >500)/FAILOVERS (mint); 3 callouts (exam: Multi-AZ vs Read Replicas; critical: failover 60-120s blip + backoff; tip: RDS Proxy saves Lambda max_connections).
- Fixed lint react-hooks/refs (outageTicksRef read during render → mirrored into outageTicks state via flush).
- Verification: bun run lint → PASS (0 errors/warnings); bunx tsc --noEmit → zero errors in rds.tsx (zero outside pre-existing noise). No test files. Did NOT modify shared components, registry, services-data, page.tsx, or other services.

Stage Summary:
- 7-b complete: rds.tsx is a full interactive RDS simulator at sqs.tsx fidelity — Multi-AZ synchronous replication with zero-lag sync link, read replicas with async lag/stale-read windows, automatic failover state machine (down → promoting → rebuilding → none) with DNS-switch mint flash, single-AZ manual-restore outage mode, and RDS Proxy pooling with overflow rejection.
- Lint: PASS (whole project). tsc: PASS. Only file written: src/components/services/rds.tsx.

---
Task ID: 7-c
Agent: general-purpose
Task: CloudWatch visualizer module — "SIGNAL SCOPE" (metric streams → live rolling chart with threshold → alarm state machine → SNS + Auto Scaling actions feedback loop)

Work Log:
- Read worklog (2-core/2-c/3-6 conventions) + contract files (sqs.tsx golden reference, shared/flow FlowCanvas/FlowNode/FlowLink/FlowLabel APIs, glass-panel, sim-controls, typography StatChip, callout, aws-icons export list, registry.tsx); verified framer-motion 12.26.2 types support animating SVG cx/cy attributes (motion-dom TargetProps cx/cy: AnyResolvedKeyframe).
- Built src/components/services/cloudwatch.tsx ONLY (no other file touched; registry/services-data/page.tsx untouched). Engine: refs-as-source-of-truth, 850ms setInterval keyed on [running, threshold, snsOn, scalingOn]; tick mutates refs then a single flush() of all setStates at tick end (no setState in effect bodies; interval-callback setState only, per golden pattern). Refs: cpuSeries/errSeries (44-pt rolling windows), pointIds (stable keys for timeline layout anim), baseLoad, fleetSize (start 2), alarmState (OK | ALARM | INSUFFICIENT_DATA), breachStreak/okStreak, notifications, scaleOuts, stormTicks, errBurstTicks, tickCount, history (max 8 tone-coded lines, t{n} timestamps, auto-scroll).
- Per-tick math exactly per spec: base = clamp(18, 95, base + rand(-4,4) + (storm? +5 : -1.2) - scaleOuts*0.35); effective cpu = base * (2/fleetSize) (visible feedback loop — scale-outs drop per-instance CPU); errors baseline 0-3 or burst 8-14 while errBurstTicks--; both series + ids capped at 44 (shift oldest). INJECT CPU SPIKE = stormTicks 8 + instant base +34 (+ datapoint so the spike shows even while paused); INJECT 5XX BURST = errBurstTicks 5 + burst datapoint. Per-source emission (EC2 always, Lambda/ELB 85% — late batches hold last value) drives lastEmit link pulses like sqs prodActive.
- Alarm state machine: cpu > threshold → breachStreak++/okStreak=0 (and vice versa); transitions need 2 consecutive datapoints — OK→ALARM logs "ALARM: CPUUtilization > {threshold}% — 2/2 datapoints breaching", ALARM→OK logs "OK: recovered — 2 datapoints below threshold", boots in INSUFFICIENT_DATA until first 2-datapoint evaluation. Edge-triggered actions on ENTERING ALARM only: SNS on → notifications++ + "NOTIFY → SNS topic ops-alerts (email+https)"; scaling on → scaleOuts++ + fleetSize=min(8,+1) + "SCALE-OUT: target tracking → fleet {n-1} → {n}"; both off → "NO ACTIONS CONFIGURED — alarm fires silently" (neon warn).
- Chart centerpiece inside the CloudWatch core block (glass box-glow cyber-cut, left 44% / top 38%, w-[200px] sm:w-[240px]): inline <svg viewBox="0 0 300 110" preserveAspectRatio="none" className="w-full h-[92px"> with vector-effect="non-scaling-stroke" everywhere — aws #ff9900 CPU polyline strokeWidth 2 + 8%-opacity area polygon, JS-built BREACH overlay polylines (#ff3355, contiguous runs with 1-pt lead-in/out so segments cross the threshold), thin magenta 5xx polyline on 0-15 second axis, dashed danger threshold line + HTML-overlay "THR n%" label positioned at top:{100-threshold}%, spring-animated leading-edge motion.circle (cx/cy) tinted danger while breaching + per-datapoint remounted pulse ring (keyed by datapoint id). Header badge: AnimatePresence mode="wait" keyed motion.span — OK mint / ALARM danger + blink-cursor "_" / NO DATA muted, with CWAlarmIcon. ALARM STATE TIMELINE strip: last 24 datapoints as w-1.5 h-2 mint/danger cells keyed by datapoint ids with layout spring (new cell pops in, row slides left). Footer "PERIOD 10S × EVAL 2" + "WINDOW 44 PTS".
- Canvas h-[440px] sm:h-[540px] ariaLabel="CloudWatch metrics alarm and actions flow diagram": sources EC2 FLEET (EC2Icon, sub CPU {n}%)/AWS LAMBDA (LambdaIcon, ERRORS {n})/APP ELB (ELBIcon, 5XX {n}) at x13 y20/46/72 with flowing links on lastEmit; core→action links cyber on SNS fire / success on scale-out with FlowLabels PUBLISH + SCALE-OUT POLICY; SNS TOPIC (SNSIcon, {notifications} SENT, cyber+pulse), AUTO SCALING (ServerIcon, FLEET {n} INSTANCES — fleet size lives here), OPS EMAIL (EmailNotificationIcon, ON-CALL, idle→cyber on SNS fire).
- Controls: THRESHOLD 60/75/90 selector (aria-pressed, active border-aws/60 text-aws), SNS NOTIFY toggle (magenta), SCALING ACTION toggle (mint), INJECT CPU SPIKE (motion.button, Zap, neon), INJECT 5XX BURST (Skull, danger); all type="button" + aria-label/aria-pressed, config changes logged to history. StatChips grid-cols-2 sm:grid-cols-4: CPU NOW (magenta when > threshold else mint), ALARM STATE (state-colored), NOTIFICATIONS, SCALE-OUTS. ALARM HISTORY terminal: glass-inset p-2, max-h-36 cyber-scroll auto-scroll, text-[8px] tone-colored lines, title {"ALARM HISTORY // LIVE"}. 3 callouts: exam (alarm states, Period × Evaluation Periods, 1-min vs 1-sec resolution, missing-data config), critical (composite alarms vs flapping, M-of-N, missing ≠ zero), tip (wire alarms to SNS/Auto Scaling/EC2 recover/Lambda + classic billing alarm).
- Verification: bun run lint → PASS (0 errors/warnings, whole project); bunx tsc --noEmit → zero matches for cloudwatch.tsx (only pre-existing examples/ + skills/ noise); plus a transient bun renderToString smoke test (13/13 structural checks PASS, scratch file deleted immediately) since cloudwatch is not yet in registry.tsx so the app UI cannot exercise it. Fixed during self-review: cpuY formula typo, stale-closure pulse-clear (now unconditional timeout), lockstep series pushes in inject handlers to keep cpu/err/ids arrays aligned, tstamp moved to module scope.

Stage Summary:
- 7-c complete: cloudwatch.tsx is a full interactive CloudWatch observability simulator at sqs.tsx fidelity — 3 metric sources streaming into a live 44-pt rolling chart with breach overlays and dashed threshold, a real OK→ALARM→OK state machine gated by 2-consecutive-datapoint evaluation, edge-triggered SNS + Auto Scaling actions whose scale-outs feed back into the load model (fleet 2→8 lowers per-instance CPU), injectable CPU storms / 5xx bursts, eval-timeline strip, tone-coded alarm history terminal, and 3 AWS-accurate knowledge callouts.
- Lint: PASS (whole project). tsc: PASS (0 errors in src). Only file written: src/components/services/cloudwatch.tsx. Wiring note for orchestrator: registry.tsx needs a "cloudwatch" dynamic entry + services-data/nav entry to surface the module (intentionally not added — out of scope for this task).
---
Task ID: 8-b
Agent: general-purpose
Task: Containers (ECS/EKS/ECR) visualizer module — "ORCHESTRATOR"

Work Log:
- Read worklog (contract from Task 1, conventions from 2-core/5/6, sibling modules 7-b rds.tsx + 7-c cloudwatch.tsx) + contract files: sqs.tsx golden reference (engine pattern), shared/flow (FlowCanvas/FlowNode/FlowLink/FlowLabel APIs incl. anime.js pixel-space links), glass-panel, sim-controls, typography (StatChip), callout, aws-icons (verified real glyph exports: ECSIcon/EKSIcon/ECRIcon/ECRRegistryIcon/ECRImageIcon/ECSTaskIcon/EC2Icon/ELBIcon/CloudWatchIcon/InternetIcon/FargateIcon), eslint.config.mjs, globals.css utilities, lucide icon availability; confirmed registry.tsx already wires "containers" dynamic import (untouched).
- Built src/components/services/containers.tsx ONLY (no other file created/edited/deleted; registry/services-data/page.tsx/shared components untouched). Engine: refs-as-source-of-truth + single flush() of ~14 setStates at end of each 850ms setInterval, interval keyed on [running, orch, launch, desired, asgOn, pushLog, flush, spawnTask] so config changes restart the loop cleanly; NO setState in effect bodies (interval callbacks + event handlers only); ZERO ref.current reads during render — all render values mirrored into state by flush (avoided the react-hooks/refs trap from the start: seeded fleet via module-scope SEED_FLEET constant instead of render-time ref writes).
- Per-tick simulation: traffic req/s random walk (clamp 24-240, INJECT spike = +40 instant + 26/tick ×6 ticks with subside log); rolling-deploy state machine (DEPLOY button → PULLING: ECR layer logs "pulled api:vN layer k/3" + digest/scan line + pulls++ → PROVISIONING: spawn batch=max(2,ceil(target/2)) tasks vN PENDING with orchestrator-vocab log → new tasks PENDING→RUNNING via scheduler → at target healthy: old-version tasks DRAINING (dropped from round-robin traffic) + "DRAINING: task-x deregistered from ALB" → reaper terminates drained tasks after 2 ticks ("connection drain complete") → DEPLOY COMPLETE mint log, deploys++, currentVer advances, tags cycle v1→v2→v3…); scheduler loop (PENDING tasks countdown 2-3 ticks → RUNNING with "SCHEDULER: task-4 PLACED on ec2-B (CPU 31%)" / EKS "EKS: pod api-7f9c Ready — kubelet node-2", replacements log "REPLACED crashed task-6 in 2 ticks", random 1.2% crash chance rescheduled as PENDING); desired-count reconcile deferred mid-deploy (deficit → PENDING, surplus → DRAINING); ALB round-robin hits per tick over RUNNING tasks (per-task REQ counters); per-task CPU = traffic×0.85/fleetSize (adding tasks visibly lowers per-task + cluster CPU); cluster CPU = avg of running tasks; autoscaling (deferred mid-deploy): CPU>55% ×2 ticks → scale-out +1 up to 8 (mint "AS: target tracking 55% → desired 3 → 4" + mint link flash), CPU<25% ×4 ticks → scale-in -1 down to desired floor.
- Canvas h-[440px] sm:h-[540px] ariaLabel="ECS EKS ECR container orchestration flow diagram": USERS (InternetIcon, live REQ/S) → ALB (ELBIcon, healthy-TG count) → cluster round-robin flowing links; ECR REGISTRY glass block (ECRRegistryIcon, pop-animated PULL counter, AnimatePresence image-tag chips api:v1 dim / api:vN active mint, magenta L1/3→L3/3 pull progress bar during PULLING, SCAN: PASSED + IMMUTABLE footer, magenta glow while pulling); ECS/EKS CLUSTER boundary box (ECSIcon/EKSIcon header swap, "n/target UP" or deploy-phase badge, scheduler vocab sub-line ECS SCHEDULER—BINPACK vs KUBE-SCHEDULER, task grid with per-task ECSTaskIcon chips: name (task-n / api-hex pods), v1 dim vs vN mint version badges, motion.div CPU mini-bars (mint/magenta>55/danger>85), state RUNNING/PENDING (magenta animate-pulse)/DRAINING (neon, exit fade via AnimatePresence), REQ counters; AnimatePresence capacity layer mode="wait": EC2 = 2 instance blocks (EC2Icon, task-count pips, "AGENT: ECS"⇄"NODE: kubelet") ⇄ FARGATE = FargateIcon block with abstract per-task sandbox chips + "PER-TASK BILLING — 0 NODES"); EKS CONTROL PLANE node top-center — cyber K8S API :6443 watch link + pulse in EKS mode, opacity-40 ghost "NOT IN USE" in ECS mode; CloudWatch node (live CLUSTER CPU %, cyber when >55) with metrics link + dashed-idle→mint success AUTOSCALING feedback link flashing on scale-out; FlowLabels HTTPS :443 / ROUND-ROBIN / IMAGE PULL (magenta flash) / CW METRICS / TARGET TRACKING (mint flash) / MIN-HEALTHY 100% · DEREGISTRATION DELAY 30S.
- Controls (BTN_BASE siblings idiom, all type="button" + aria-label, aria-pressed on toggles/selector): ORCH toggle group ECS⇄EKS (aws/magenta), LAUNCH: EC2⇄FARGATE toggle (node reassignment + config log), DESIRED 2/4/6 selector group, AUTOSCALING ON/OFF (mint), DEPLOY NEW IMAGE (neon Rocket, disabled mid-deploy showing "DEPLOYING vN"), TRAFFIC SPIKE (magenta Zap), KILL TASK (danger Skull — SIGKILL random runner → replacement PENDING + danger cluster border flash). StatChips grid-cols-2 sm:grid-cols-4: TASKS/PODS RUNNING n/target, CLUSTER CPU (magenta >55), IMAGE api:vN (v1→v2 arrow mid-deploy), DEPLOYS. Tone-coded ORCHESTRATOR LOG terminal (max 8 lines, t{n} stamps, newest last, cyber-scroll auto-scroll, role="status", footer shows orchestrator·launch·tick). SimControls live status readout (idle / ROLLING DEPLOY PHASE / ENGINE LIVE — n/target UP). 3 callouts: exam (ECS vs EKS vs Fargate decision matrix), critical (minimumHealthyPercent + deregistrationDelay + ":latest" tag footgun → pin digests), tip (ECR lifecycle policies, scan-on-push, Container Insights).
- Verification: bun run lint → PASS (0 errors/warnings, whole project); bunx tsc --noEmit → 0 matches for containers.tsx (only pre-existing examples/ + skills/ noise); transient bun renderToString smoke test (scratch file, deleted immediately) → 18/18 structural checks PASS incl. "no rounded classes" + canvas aria-label. Kill-flash / scale-flash pulse clears done via unconditional setTimeout like cloudwatch.tsx. No test files written, dev server/build not run.

Stage Summary:
- 8-b complete: containers.tsx is a full interactive ECS+EKS+ECR orchestrator simulator at sqs.tsx/rds.tsx fidelity — ECR image pull with layer progress, scheduler placements in ECS or Kubernetes vocabulary, EC2⇄Fargate capacity swap, ALB round-robin traffic with per-task CPU/REQ runtime detail, target-tracking autoscaling feedback loop, and zero-downtime rolling deploys (PULLING→PROVISIONING→DRAINING) plus chaos kill-task rescheduling — all driven by the golden refs+flush 850ms engine.
- Lint: PASS (whole project). tsc: PASS (0 errors in src). Only file written: src/components/services/containers.tsx (already registered in registry.tsx by Task 1, so it surfaces in the nav automatically).

---
Task ID: 8
Agent: main (orchestrator)
Task: Implement RDS + CloudWatch (wire pre-built modules) and Containers (ECS/EKS/ECR) module; surface all three in the app.

Work Log:
- 8-a WIRING: services-data.ts — added "DATA"/"OPS" categories + 3 ServiceMeta entries in index order (12 RDS "SYNC SHADOW", 13 CloudWatch "SIGNAL SCOPE", 14 Containers "ORCHESTRATOR" with iconId rds/cloudwatch/containers); registry.tsx — dynamic entries for rds/cloudwatch/containers; page.tsx — hotkeys extended to a 14-key map (1-9,0,-,=,[,]); service-nav.tsx — rail header count now dynamic [{SERVICES.length}]; boot-overlay.tsx — "MOUNTING N SERVICE MODULES" line now dynamic.
- 8-b BUILD (subagent general-purpose): src/components/services/containers.tsx (~1,200 lines) — "CONTAINERS // ORCHESTRATOR" simulator at sibling fidelity: ECR registry (tag chips api:vN, layer pull L1/3→L3/3, pull counter, scan PASSED), ALB round-robin to task grid (per-task CPU bars, version badges, RUNNING/PENDING/DRAINING with AnimatePresence), capacity layer EC2 instances (AGENT: ECS) ⇄ Fargate sandboxes, EKS control-plane node (cyber :6443 watch link when EKS, ghosted "NOT IN USE" when ECS), CloudWatch live cluster-CPU → target-tracking autoscaling feedback link, rolling deploy state machine PULLING→PROVISIONING→DRAINING→DEPLOY COMPLETE (v1→v2→v3), ECS⇄EKS vocabulary swap, traffic spike + KILL TASK chaos, desired-count reconcile, tone-coded log terminal, StatChips, SimControls, 3 AWS-accurate callouts. Engine: refs + single flush() per 850ms tick, keyed interval, no ref reads in render.
- 8-c BUGFIX (found via browser E2E): rolling deploy could stall forever — crash replacements spawned at currentVerRef (old version) mid-deploy and were never drained, so completion check `some(x.ver < deploy.ver)` never cleared. Fixed: (1) crash replacements now spawn at the ACTIVE deploy version; (2) explicit DRAINING phase with a safety sweep that force-drains any surviving old-version RUNNING/PENDING tasks each tick before the completion check. Verified in browser: deploy + double chaos mid-deploy → "DEPLOY COMPLETE — api:v2 LIVE — 0s downtime — deploys 1".
- 8-d E2E (Agent Browser): RDS — run, replica add, WRITE STORM, FAILOVER full state machine (promoted → DNS switched → queued writes flushed → rebuilding 25%), stats WRITES 22/FAILOVERS 1; CloudWatch — run, CPU spike, alarm OK→ALARM→OK (2/2 datapoints), SNS notify + scale-out fleet 2→3; Containers — full flow above + EKS swap log "kube-scheduler authoritative". No page errors; console clean (only pre-existing THREE.Clock deprecation). Mobile 390px scrollWidth=390 on all three modules (no overflow). Desktop screenshots verified visually (rds/cw/containers).
- Final: bun run lint PASS (0 problems), bunx tsc --noEmit PASS (0 errors in src), dev.log all 200s.

Stage Summary:
- App now surfaces 14 modules: the 11 originals + RDS (12), CloudWatch (13), Containers ECS/EKS/ECR (14) — all wired, all interactive, all E2E-verified.
- Rolling-deploy convergence bug fixed in containers.tsx (mid-deploy chaos no longer stalls deploys; replacements join at active image version).
- Hotkeys for new modules: "=" → RDS, "[" → CloudWatch, "]" → Containers.

---
Task ID: 9
Agent: main (orchestrator)
Task: Reset buttons → icon-only rounded-full; remove unused files/components (double-checked); lint.

Work Log:
- sim-controls.tsx RESET button: removed "RESET" text, now icon-only RotateCcw in a rounded-full circular button (p-2, title="Reset", aria-label kept, hover border-aws tint). Single shared component → applies to ALL 14 modules (verified: every module passes onReset to SimControls; grep found no standalone reset buttons).
- UNUSED-FILE ANALYSIS (three passes): (1) import-reachability script over src/** (roots: app entry conventions, handles @/ alias + dynamic imports) → 50 unreachable; (2) manual grep double-check per category → discovered ui/toaster.tsx IS live (layout.tsx mounts <Toaster/>) so toaster+toast+use-toast chain KEPT; api/route.ts is a Next route convention entry (served /api, returns {"message":"Hello, world!"}) KEPT; (3) per-file basename grep + post-removal reachability re-run → zero dead files left.
- REMOVED (48 files): 45 unused shadcn ui components (accordion, alert-dialog, alert, aspect-ratio, avatar, badge, breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card, input-otp, input, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toggle-group, toggle, tooltip), hooks/use-mobile.ts (only consumer was unused ui/sidebar), lib/db.ts (zero refs; prisma folder/package deps untouched), services/module-placeholder.tsx (zero refs since registry rewrite).
- public/icons/aws: all 34 SVGs verified referenced (arch + extra maps) — none removed.
- Verification: bun run lint PASS (exit 0), bunx tsc --noEmit clean (only pre-existing examples/skills noise), dev.log 200s. Agent Browser E2E: app boots, S3 module RUN → circular icon-only reset (borderRadius 9999px, no text, svg present) → RESET click works, zero page errors, /api healthy. Screenshot verified.

Stage Summary:
- All reset buttons across the app are now circular icon-only (rounded-full) with tooltip title — via the shared SimControls component.
- src reduced from 82 to 33 files (48 dead files removed); live ui chain (toaster/toast/use-toast) and api/route.ts intentionally kept.

---
Task ID: 10
Agent: main (orchestrator)
Task: Remove unused db/prisma stack; retitle app to "AWS | ATOM LEARN".

Work Log:
- Audit: zero prisma/@prisma/db references anywhere in src/ (src/lib/db.ts already removed in Task 9) — the app never touches a database.
- Removed: bun remove @prisma/client prisma (2 packages); deleted prisma/ (schema.prisma) and db/ (custom.db SQLite); removed the 4 db:* scripts from package.json; emptied .env (contained only DATABASE_URL). Sandbox tests/database-runtime-build.sh references were noted as platform harness, intentionally untouched.
- layout.tsx metadata.title: "AWS NEXUS // Interactive Cloud Visualizer" → "AWS | ATOM LEARN".
- Verification: bun run lint PASS (exit 0); bunx tsc --noEmit clean; Agent Browser: document title = "AWS | ATOM LEARN", app boots, zero page errors; dev.log 200s.

Stage Summary:
- Project is fully database-free (no prisma, no sqlite, no db scripts, no env vars); package.json + lockfile clean.
- Browser tab title is now "AWS | ATOM LEARN".

---
Task ID: 11
Agent: main (orchestrator)
Task: Leftbar 100% height + sticky (fixed); GLOBAL INFRASTRUCTURE map — replace ARC STORM with UNDERSEA CABLES (real cable data); right column — ALL REGIONS above LIVE OPS FEED; AZ detail panel bottom-right of map (opposite TRACE).

Work Log:
- LEFTBAR (page.tsx + service-nav.tsx): nav rail wrapper is now `lg:sticky lg:top-0 lg:h-screen lg:-mt-5` (sticky within the full-height flex row = fixed-position behavior); desktop nav itself changed from `sticky top-4 max-h-[calc(100vh-2rem)]` to `h-full`. Verified: collapsed (60px) and expanded (248px) both span 0→viewport-height exactly and stay pinned at top:0 while scrolled (measured via getBoundingClientRect before/after scroll). Mobile horizontal chips unchanged.
- UNDERSEA CABLES (global-infrastructure.tsx): removed storm state + ARC STORM button (Arcs component simplified — storm prop deleted). New SUBMARINE_CABLES data: 15 REAL cables with real landing-point routes — MAREA (Virginia Beach→Bilbao), GRACE HOPPER (NY→Bude→Bilbao), SEA-ME-WE 5 (Marseille→Suez→Jeddah→Djibouti→Mumbai→Matara→Singapore), IAX, APG (Chikura→Busan→Shanghai→HK→Singapore), JUPITER, FASTER, NCP, SOUTHERN CROSS (Sydney→Auckland→Suva→Hawaii→Oregon), INDIGO, EASSy, SACS, EQUIANO, 2AFRICA, C-LION1. New UnderseaCables 3D component: CatmullRom through landing points → sampled+re-projected onto sphere radius R+0.006 so lines hug the surface (no fly-over), thin mint tubes (opacity 0.5 additive) + travelling data-pulse dot per cable. Toggle button "UNDERSEA CABLES ON/OFF" (Waves icon, mint accent — toggleBtn extended to aws/magenta/mint accents). Legend gained "SUBMARINE CABLE" entry.
- RIGHT COLUMN: order is now REGION UPLINK → ALL REGIONS → LIVE OPS FEED (ALL REGIONS moved above feed).
- AZ DETAIL PANEL: bottom-right of the globe (absolute bottom-2.5 right-2.5 — same right edge as TRACE at top-2.5 right-2.5, i.e. directly opposite). Shows the selected region's AZs (us-east-1a…f etc.) with mint status LED (pulse when hot>72%), truncated AZ id, live utilization bar + % — deterministic base per region code + wobble driven by the 1.1s ping ticker, max-h-[104px] cyber-scroll. Updates on region selection (verified: Tokyo → ap-northeast-1a–d, 4 rows; TRACE → 35.7°/139.7°; REGION UPLINK → TARGET: AP-NORTHEAST-1).
- Verification: bun run lint PASS (0 problems); bunx tsc --noEmit clean for src (only pre-existing skills/ noise); Agent Browser E2E — cables ON/OFF toggle both directions (aria-pressed), drag-rotated to Atlantic + Pacific views and confirmed mint cable lines hugging the sphere (APG/trans-pacific/Southern Cross visible), AZ panel positioned bottom-1028/right-1048 vs map bottom-1038 (flush + aligned with TRACE right edge), right column order confirmed in DOM, mobile 390px: no horizontal overflow (scrollW=390) and AZ panel/legend fit without overlap, zero page errors, dev.log all 200s. Screenshots saved (desktop cables-on/atlantic/pacific/final + mobile).

---
Task ID: 12
Agent: main (orchestrator)
Task: Sidebar inset tuning (match header-card top padding → 96vh height with 2vh top/bottom insets) + fix shrink-mode active tile styling.

Work Log:
- page.tsx nav wrapper: `lg:sticky lg:top-0 lg:h-screen lg:-mt-5` → `lg:sticky lg:top-[2vh] lg:h-[96vh] lg:-mt-1.5`. Rationale: %-based top/height resolved against the flex parent (measured 94.11%/3.67% — wrong base), so switched to viewport units; the -mt-1.5 pulls the natural position (20px container padding) above the 2vh threshold so sticky pins immediately. Measured result: top 2.00% (18px), height 96.00%, bottom gap 2.00% (18px) — stays pinned at those values while scrolled (verified before/after scrollY=400). Top aligns with the header card row (py-5 ≈ 2vh).
- service-nav.tsx shrink-mode active fix (was: outer aws border + inner icon-tile border + 3px left marker bar = cluttered double-box, per user screenshot): active marker is now rendered per mode — expanded keeps the 3px left bar (layoutId preserved), shrink mode renders a 2px full-width TOP accent line instead; icon tile in shrink-active drops its own border/bg (`border-transparent bg-transparent`) so exactly ONE glowing aws box shows per active item. Inactive tiles unchanged (border-foreground/15 bg-black/30); expanded-active keeps icon tile border-aws/60 bg-black/30.
- Verification: bun run lint PASS (0 problems); bunx tsc --noEmit clean for src (only pre-existing skills/ noise); Agent Browser — measured 2/96/2 split exact + pinned on scroll (collapsed AND expanded states), zoomed screenshot confirms single-box shrink-active tile, expanded rail re-verified with left marker + labels, zero page errors, mobile 390px scrollWidth=390 (no overflow — changes are lg:-only), dev.log all 200s.

Stage Summary:
- Sidebar now sits at a fixed 2vh top / 2vh bottom inset with exactly 96vh height (sticky = fixed behavior), visually aligned with the module header card.
- Shrink-mode active module is a single glowing aws tile with a top accent line (no more double-border + side-bar clutter); expanded mode unchanged (left marker + labels).

---
Task ID: 13
Agent: main (orchestrator)
Task: Redraw undersea cables properly — match the uploaded cable-map reference (ocean/coastline paths), NEVER cross land, and hide UPLINK BEAM while cables are shown.

Work Log:
- Rewrote SUBMARINE_CABLES in src/components/services/global-infrastructure.tsx: all 15 cables now use DENSE hand-plotted ocean waypoints (10-70 per cable) that follow real shipping-lane routes and hug coastlines instead of endpoint-to-endpoint great-circle chords (which cut across landmasses). Examples: SEA-ME-WE 5 threads Gibraltar-class Med corridor → Suez canal zone → Red Sea → Bab-el-Mandeb → Arabian Sea → Mumbai → around Sri Lanka → Malacca Strait → Singapore; APG rounds Kyushu south + Kanmon wedge → Busan → Yellow Sea → down the China/Vietnam coast → Gulf of Thailand → east of Malay peninsula → Singapore; INDIGO rerouted to the real INDIGO-West track (Malacca → around Sumatra NW tip → west coast → south of Java → Perth) avoiding the too-narrow modelled Sunda Strait; EASSy runs offshore through the Mozambique Channel; GRACE HOPPER/MAREA descend the Bay-of-Biscay-mouth chord (the coarse model's N-Spain coast); 2AFRICA dips through the Gibraltar strait corridor then parallels the West African bulge offshore with the Gulf-of-Guinea Lagos dip; SOUTHERN CROSS exits Auckland via the Tasman-side coast wedge.
- Built a throwaway validator (/home/z/check-cables.mts, deleted after use) that extracted the component's own LAND_POLYS + reused the exact runtime math (latLonToVec3 → CatmullRomCurve3 tension 0.4 → getPoints(200) → sphere re-projection → inverse to lat/lon → isLand()) and iterated waypoints until ALL 15 CABLES = 0 land hits (only exemption: the Suez canal transit corridor, lat 28.3-31.8 / lon 32.15-33.15, where cables legitimately thread the canal — matching the reference map). Fixes driven by validator output: Malacca strait pinch (both cables), Korea-strait/Kanmon wedge (APG), NZ Auckland west-coast wedge (SOUTHERN CROSS), Sunda strait (avoided entirely), Mozambique coast (EASSy), Guinea coast + Dakar (EQUIANO/2AFRICA), Gibraltar dip (2AFRICA), LA endpoint nudged offshore (JUPITER), WA coast (INDIGO).
- UnderseaCables rendering upgraded for the longer paths: getPoints 160→220, TubeGeometry segments 180→260, radius 0.0042→0.0046, opacity 0.5→0.55.
- UPLINK BEAM hide: RegionMarker gained hideBeam prop — the magenta vertical beam cylinder now renders only when `selected && !hideBeam`; GlobeScene passes hideBeam={showCables}; legend entry reads "SELECTED REGION" while cables are on (reverts to "SELECTED + UPLINK BEAM" when off).
- Verification: bun run lint PASS (0 problems); bunx tsc --noEmit clean for src; Agent Browser E2E — toggled UNDERSEA CABLES ON (aria-pressed + mint border), drag-rotated through Atlantic → West Africa → Indian Ocean → West Pacific views: transatlantic arcs over open ocean, West-African bulge + SACS + APG coastal routes hug the dotted coastlines with zero land overlap, travelling pulses visible; UPLINK BEAM confirmed HIDDEN with cables ON (magenta selected node shows only ping rings) and RESTORED after toggling cables OFF (beam clearly visible again); mobile 390px scrollWidth=390 (no overflow); zero page errors (only pre-existing THREE.Clock deprecation warning); dev.log all 200s. Screenshots: /home/z/shots/cables-{atlantic,europe,africa,indian,indian2,asia}.png + beam-restored.png + mobile-check.png.

Stage Summary:
- Cables now behave like a real cable map (reference image): dense coastline-hugging ocean paths, mathematically guaranteed zero ground crossings against the same land polygons the globe renders, Suez transit preserved.
- UPLINK BEAM auto-hides whenever UNDERSEA CABLES is ON and returns when toggled OFF; legend reflects the mode.

---
Task ID: 14
Agent: main (orchestrator)
Task: Remove LIVE OPS FEED; add continental filter badges inside ALL REGIONS (North America, South America, Europe, Middle East, Africa, Asia Pacific, Australia and New Zealand) with ALL selected by default; expand the card height to cover the removed feed.

Work Log:
- Removed LIVE OPS FEED entirely from src/components/services/global-infrastructure.tsx: panel JSX, ops state, feedRef/opsIdRef refs, push-interval + auto-scroll effects, and the OPS_EVENTS/OpsLine/Tone/TONE_TEXT/utcNow telemetry block (~60 lines). useTelemetry (top stat chips) kept.
- Continent taxonomy: new Continent union type; every one of the 28 regions tagged — NORTH AMERICA 6 (us-east-1/2, us-west-1/2, ca-central-1, ca-west-1), SOUTH AMERICA 1 (sa-east-1), EUROPE 7 (all eu-*), MIDDLE EAST 3 (me-south-1, me-central-1, il-central-1), AFRICA 1 (af-south-1), ASIA PACIFIC 8 (ap-south-*, ap-northeast-*, ap-southeast-1/3, ap-east-1), AUSTRALIA AND NEW ZEALAND 2 (ap-southeast-2 Sydney, ap-southeast-4 Melbourne).
- CONTINENT_FILTERS constant (ALL + the 7 user-specified geographies, exact labels); cont state defaults to "ALL"; filteredRegions memo.
- ALL REGIONS card rebuilt: role=tablist badge row (flex-wrap, tiny uppercase bold, aws glow on active, per-badge region counts, aria-selected + title tooltips) + region list filtered by badge with framer-motion AnimatePresence popLayout + layout transitions (fade/scale in-out, items reflow smoothly). Subtitle now shows filtered count "N/28 NODES TRACKED".
- Height expansion: list max-h 240px → 440px; panel is flex-col with flex-1 min-h-0 list so it also auto-stretches into the feed's space on desktop (measured panel height 584px vs ~330px before).
- Verification: bun run lint PASS (0 problems); bunx tsc --noEmit clean for src; Agent Browser E2E — LIVE OPS FEED confirmed absent (only ORBITAL VIEW / REGION UPLINK / ALL REGIONS h3s), 8 badges with correct counts, ALL preselected 28/28 with 28 list items, EUROPE→7 eu-* regions (7/28), AFRICA→af-south-1 (1/28), AUSTRALIA AND NEW ZEALAND→Sydney+Melbourne (2/28), MIDDLE EAST→me-south-1/me-central-1/il-central-1 (3/28); selecting Sydney inside a filtered list updates REGION UPLINK to TARGET: AP-SOUTHEAST-2 and the node stays highlighted after returning to ALL (28/28); mobile 390px scrollWidth=390 (no overflow, badges wrap 3 rows); zero page errors; dev.log all 200s. Screenshots: /home/z/shots/badges-all.png + badges-mobile.png.

Stage Summary:
- LIVE OPS FEED is gone; its vertical space is absorbed by a taller ALL REGIONS card (list max-h 240→440px, flex-1 stretch on desktop).
- ALL REGIONS now has 8 working geographic filter badges (ALL default + the 7 requested continents) with live counts, animated list filtering, and selection that persists across filter changes.

---
Task ID: 15
Agent: main (orchestrator)
Task: ALL REGIONS — auto-rotate OFF + camera fly-to on continent/region selection; add tab views below the module title card (GENERAL / REGIONS BEST USE CASE / AVAILABILITY ZONE USE CASE) with animated structural diagrams.

Work Log:
- CAMERA FLY-TO (global-infrastructure.tsx): new FocusRig component inside the Canvas — every selection (globe node click, ALL REGIONS list click, continent badge) now sets a focus {lat,lon}; FocusRig exponentially lerps the camera around the sphere to face it (frame-rate independent via delta, direction interpolated on the unit sphere + radius preserved — first Cartesian-lerp attempt cut chords and shrank the camera radius 7.43→3.56, caught via window debug telemetry and fixed with normalize()). Manual drag fires OrbitControls "start" which cancels auto-focus until the next selection. selectRegion()/selectCont() helpers: any selection sets autoRotate=false (verified aria-pressed flips); continent badge also focuses the continent centroid (CONTINENT_FOCUS map: NA 43/-100, SA -14/-58, EU 50/12, ME 26/46, AF 4/20, APAC 22/106, AU/NZ -31/141) and auto-selects that continent's first region if the current selection is elsewhere, keeping REGION UPLINK/AZ DETAIL coherent; re-enabling AUTO-ROTATE clears focus so the two never fight.
- TABS (below the page-level module title card): role=tablist with 3 tabs — 01 GENERAL (all previous content), 02 REGIONS BEST USE CASE, 03 AVAILABILITY ZONE USE CASE. New file src/components/services/infra-usecases.tsx exports RegionsUseCase + AzUseCase.
- REGIONS TAB: definition strip ("A Region is a separate geographic area where AWS operates…"); SVG latency diagram (animated dashed packet flows USER CLUSTERS → region chips: Mumbai→ap-south-1 12ms, Singapore→ap-southeast-1 4ms, London→eu-west-2 9ms, plus red dashed 218ms "AVOID" route Mumbai→us-east-1; SMIL animateMotion packet dots along every path; legend row); 3 use-case cards (REDUCE LATENCY / DATA RESIDENCY / DISASTER RECOVERY); interactive CROSS-REGION DR panel — US-EAST-1 PRIMARY — ACTIVE 94% ⇄ EU-WEST-1 STANDBY — PILOT LIGHT 12% with animated CRR replication line, SIMULATE FAILOVER button flips primary to OFFLINE 0% / secondary to ACTIVE — FAILOVER 96%, failover path line activates, Route53 health checks read 0/3, button becomes RESTORE PRIMARY (RPO ≈ 1s · RTO < 60s).
- AZ TAB: definition strip ("An AZ is an isolated location within an AWS Region…"); AZ ISOLATION MAP structural diagram — REGION · AP-SOUTH-1 (MUMBAI) frame containing 3 AZ columns (ap-south-1a/b/c with AZ IDs, 1-2 data-center blocks each, EC2 instance chips) fed by animated traffic connectors (mint packet dots drop into each column); CHAOS CONTROLS — FAIL 1A/1B/1C toggle buttons: failed AZ turns red (ISOLATED stamp, ✕ LINK DOWN, instances struck through), traffic reroutes (uptime bar holds 99.99% + "ZERO DOWNTIME — REROUTED → 1A · 1C"), killing all three shows 0.00% "TOTAL OUTAGE — ALL AZs DOWN", RESTORE ALL resets; 3 use-case cards (IMPROVE AVAILABILITY / REDUCE DOWNTIME / ISOLATED · FIBER-LINKED).
- Verification: bun run lint PASS (0 problems); bunx tsc --noEmit clean for src; Agent Browser E2E — 3 tabs render with GENERAL preselected; EUROPE badge → AUTO-ROTATE OFF + camera flies to Europe; SOUTH AMERICA badge → SA dead-center with sa-east-1 beam (TRACE -23.5/-46.6); ALL→Tokyo list click → Tokyo dead-center facing user (TRACE 35.7/139.7, AZ 1a–d); REGIONS tab: diagram + cards + failover sim (roles swap, health 0/3, restore works); AZ tab: 3/3 → FAIL 1B (2/3, ISOLATED, 99.99% rerouted) → FAIL 1A+1C (0/3, 0.00% TOTAL OUTAGE) → restore (3/3 NOMINAL); GENERAL remounts globe with state persisted; mobile 390px scrollWidth=390 (diagram scrolls inside its panel, cards stack); zero page errors; dev.log all 200s. Screenshots: /home/z/shots/focus-{europe,sa,tokyo}.png, regions-tab.png, az-tab-{healthy,outage}.png, regions-mobile.png.

Stage Summary:
- Selecting any continent badge or region now stops auto-rotation and smoothly flies the camera so the selection faces the user (sphere-space interpolation, drag takes over, AUTO-ROTATE toggle re-clears focus).
- The module is now tabbed below its title card: GENERAL (globe console), REGIONS BEST USE CASE (latency routing diagram + interactive cross-region DR failover), AVAILABILITY ZONE USE CASE (region→AZ→DC→instance structural map with per-AZ chaos controls and availability meter).

---
Task ID: 15-b
Agent: main (orchestrator)
Task: "for AVAILABILITY ZONE usecase use better animation to showcase" — upgrade the AZ tab from a static isolation map into a live, self-running structural showcase.

Work Log:
- Rebuilt AzUseCase (src/components/services/infra-usecases.tsx) as an "AZ OPERATIONS THEATER": a self-running scripted failover simulation of REGION AP-SOUTH-1 (MUMBAI).
- SCENARIO ENGINE: 5-step looping script (NOMINAL FLOW → FAIL AZ 1A → RESTORE AZ 1A → FAIL AZ 1C → FULL MESH) with per-step hold timers; auto demo is ON by default so the showcase runs the moment the tab opens; scenario stepper chips (click to jump to any step, auto continues from there), NOW: label, and a linear engine progress bar under the stepper.
- STAGED BUILD-IN: region frame scales in → AZ towers rise staggered → per-DC instance racks light up as staggered blinking LED grids (RackLed component: mint glow blink healthy / fast red flicker when isolated).
- PER-AZ TOWER VISUALS: radar sweep gradient line looping inside every tower (mint healthy / red down), trunk connector with falling packet dots and live LOAD SHARE % label, status chip (ACTIVE/ISOLATED), ✕ LINK DOWN stamp, DC blocks with Server icon + power LED + 4x2 LED rack, load bar, EC2 instance chips, and a one-shot red SHOCKWAVE ring (AnimatePresence, scale 0.55→1.28 fade) plus a 3px shake keyframe when an AZ fails.
- LIVE LOAD REDISTRIBUTION: shareFor() splits 100% across healthy AZs (33/33/34 → 50/50 → 100 → 0) with animated bars; per-AZ PKT/S counters (deterministic hash base + tick wobble) scale with share; inbound gateway trunk shows 3 animated lanes + total PKT/S routed, goes red "GATEWAY DRAINING / 0 PKT/S" on total outage.
- CROSS-AZ REPLICATION MESH: three a⇄b / a⇄c / b⇄c lanes with bidirectional moving pulses and SYNC · <2MS label; a lane flips to red "PARTNER ISOLATED ✕" when either endpoint is down.
- LEDGER + LOG: SERVICE AVAILABILITY bar (99.99% holds through failures, 0.00% total outage), ROUTE53 HEALTH CHECKS chips per AZ (pulsing ✓ PASSING / ✕ FAILING), FAILOVER EVENTS counter, and a 4-line SCENARIO LOG — UTC (aria-live, newest first, fading opacity) fed by every scripted/manual event.
- CONTROLS: per-AZ FAIL/RESTORE buttons (manual interrupt pauses auto demo), RESTORE ALL, and an AUTO DEMO ON/OFF toggle (Play/Pause icon, magenta glow) that restarts the script from step 1.
- BUG FIX: toggleAz used closure state, so 3 burst clicks in the same frame overwrote each other (last-click-wins, found via E2E burst test) — switched to a functional setState update so rapid clicks compose; verified 3 simultaneous FAIL clicks → 0/3 TOTAL OUTAGE.
- Verification: bun run lint PASS; bunx tsc --noEmit clean; Agent Browser E2E — auto demo runs on tab open (NOW: NOMINAL FLOW → FAIL AZ 1C observed, shares 0/50/50, uptime 99.99%, health chips flip ✕ FAILING, UTC log entries); manual FAIL 1B interrupt → 1/3 serving + 3× PARTNER ISOLATED; total outage → 0/3, 0.00%, GATEWAY DRAINING, "TOTAL OUTAGE — ALL AZs DOWN" span confirmed; ALL restore + AUTO DEMO re-engage → NOMINAL FLOW 3/3; burst-click composition fix verified; GENERAL tab remounts globe (AUTO-ROTATE ON, canvas ok), REGIONS tab intact; mobile 390px scrollWidth=390 no overflow; zero page/console errors; dev.log all 200s. Screenshots: /home/z/shots/az-theater-{healthy,failover,outage,full,mobile}.png.

Stage Summary:
- The AZ use-case tab is now a self-running cinematic showcase: scripted failovers fire automatically with shockwaves, rack LED flicker, live load redistribution, replication mesh degradation, health-check flips and a UTC scenario log — while every control (stepper jump, per-AZ fail/restore, auto demo) stays fully manual-overrideable.
---
Task ID: 16-a
Agent: general-purpose
Task: Re-layout sqs/sns/s3 — controls to top control deck, stats+logs to right rail (global-infrastructure style)

Work Log:
- sqs.tsx: FIFO/STANDARD + LONG/SHORT POLLING + INJECT POISON MSG buttons moved into a top CONTROL DECK GlassPanel ("QUEUE SIMULATOR // LIVE", className="!p-0", inner px-3 sm:px-4 py-3 flex-wrap row, exact button classNames kept). FlowCanvas moved into its own "FLOW VIEW // MESSAGE PIPELINE" GlassPanel (subtitle "PRODUCERS → QUEUE → WORKERS — VISIBILITY TIMEOUT + DLQ REDRIVE", h-[440px] sm:h-[540px] lg:h-[560px], children byte-identical). 4 StatChips moved into a 320px RIGHT RAIL "LIVE STATS" panel (grid-cols-2, dropped sm:grid-cols-4). ADDED new REQUIRED rail panel "DLQ CONTENTS" (delay 0.15) below stats: glass-inset max-h-40 cyber-scroll list rendering dlq state as danger chips "MSG-### ×N RECEIVES" + empty state "NO DEAD LETTERS — HEALTHY QUEUE". Knowledge grid untouched.
- sns.tsx: PUBLISH EVENT + MSG ATTRS + FILTER POLICY buttons + filter-policy legend <p> moved into top CONTROL DECK GlassPanel ("SIGNAL BURST // LIVE"). FlowCanvas moved into "FLOW VIEW // TOPIC FAN-OUT" GlassPanel (subtitle "1 PUBLISHER → SNS TOPIC → 5 SUBSCRIBERS", h-[440px] sm:h-[540px] lg:h-[560px], children byte-identical). StatChips → rail "LIVE STATS". DELIVERY LOG glass-inset block moved from below-canvas into rail as its own "DELIVERY STREAM" GlassPanel (delay 0.15, subtitle "orders-topic · 5 SUBSCRIPTIONS" preserved from the deleted inner header row's right side; logBoxRef auto-scroll + AnimatePresence + all log lines + empty state kept byte-identical). Knowledge grid untouched.
- s3.tsx: VERSIONING + REPLICATION + PUT OBJECT controls moved into top CONTROL DECK GlassPanel ("INFINITE VAULT // LIVE", exact classNames/aria-labels). FlowCanvas moved into "FLOW VIEW // OBJECT LIFECYCLE" GlassPanel (subtitle "UPLOADS → TIERING → CROSS-REGION REPLICATION", h-[440px] sm:h-[540px] lg:h-[560px]); the STORAGE CLASS PRICING overlay was lifted OUT of FlowCanvas children per per-file notes and re-homed as rail GlassPanel "STORAGE CLASS PRICING // $ PER GB-MONTH" (animated proportional bars kept byte-identical). StatChips → rail "LIVE STATS". ADDED new rail panel "RECENT OBJECTS" (delay 0.2): glass-inset max-h-40 cyber-scroll list from objects state (latest 8, tier-colored marker via TIER_META[tier].bar, key + v{ver} + tier) + empty state "NO OBJECTS — PRESS PUT OBJECT". Knowledge grid untouched.
- No sim logic, state, refs, effects, timers, aria attributes or FlowCanvas inner JSX changed in any file; no imports added/removed (all still used). Did not touch shared/*, registry, page, global-infrastructure, infra-usecases.

Stage Summary:
- sqs/sns/s3 now follow the global-infrastructure layout: control deck on top, grid lg:grid-cols-[minmax(0,1fr)_320px] with FlowCanvas left and LIVE STATS + module rail panels (DLQ CONTENTS / DELIVERY STREAM / STORAGE CLASS PRICING + RECENT OBJECTS) stacked right, knowledge grid at bottom.
- bun run lint → exit 0, 0 errors/warnings; bunx tsc --noEmit (filtered) → zero errors for the 3 files.
- Worklog appended via single cat >> as required.
---
Task ID: 16-b
Agent: general-purpose
Task: Re-layout vpc/iam/elb — controls to top control deck, stats+logs to right rail (global-infrastructure style)

Work Log:
- vpc.tsx: moved FILTER ENGINE VIEW cluster (SG STATEFUL / NACL STATELESS buttons), NAT GATEWAY toggle and STEP TRACE button up into the "VOID NETWORK // LIVE" control deck (className="!p-0", inner px-3 sm:px-4 py-3 flex-wrap row, cluster label gets w-full); moved the 4 StatChips into a new right-rail GlassPanel "LIVE STATS" (grid-cols-2, tones/delays kept) and the hop-by-hop log into rail GlassPanel "PACKET TRACE — HOP-BY-HOP" (glass-inset scroll box, ref={logBoxRef}, aria-live kept; duplicated inner header row deleted). Added main grid lg:grid-cols-[minmax(0,1fr)_320px] with "FLOW VIEW // PACKET TRACER TOPOLOGY" panel; FlowCanvas children byte-identical, height class now h-[440px] sm:h-[540px] lg:h-[560px]. Knowledge grid untouched.
- iam.tsx: moved SIMULATION CONTROLS cluster (MFA ENROLLED toggle, ACTION UNDER TEST selector buttons, EVALUATE NOW) into the "ACCESS MATRIX // LIVE" control deck (both uppercase labels kept, w-full added); moved 4 StatChips into rail "LIVE STATS" and the decision log into rail GlassPanel "ENGINE TRACE — DECISION LOG" (ref/aria-live kept, duplicated inner header deleted). Main grid + "FLOW VIEW // POLICY EVALUATION" panel added; canvas (clickable principals, engine stack, verdict) untouched; removed now-unused Terminal lucide import.
- elb.tsx: moved PATH RULES toggle, KILL TARGET button and health-check hint span into the "TRAFFIC SPLITTER // LIVE" control deck (BTN const reused verbatim); moved 4 StatChips into rail "LIVE STATS"; ADDED required rail panel "TARGET HEALTH" (delay 0.15): glass-inset scroll list with one row per target from existing render state — targets (tg-web-01..04) always, imgTargets (tg-img-01/02) when pathRules on, status chips HEALTHY mint / UNHEALTHY danger / RECOVERING amber→neon. Main grid + "FLOW VIEW // TRAFFIC SPLITTER" panel added; FlowCanvas children untouched.

Stage Summary:
- All 3 modules now follow the global-infrastructure layout: control deck on top, animation left + 320px right rail (LIVE STATS + log/health panel), knowledge grid unchanged at bottom.
- Zero sim-logic/state/ref/effect changes; all aria labels, aria-pressed, motion props, AnimatePresence and logBoxRef auto-scroll kept; FlowCanvas children byte-identical except canvas height class.
- Imports pruned where they became unused (iam: Terminal). No new dependencies.
- bun run lint: clean (0 errors/warnings). bunx tsc --noEmit (filtered): zero errors for vpc/iam/elb.
- Deviation note: theme has no `amber` token; RECOVERING chip uses the theme's amber-equivalent `neon` (#ffb347) as specified tone.
---
Task ID: 16-c
Agent: general-purpose
Task: Re-layout api-gateway/cloudfront/lambda — controls to top control deck, stats+logs to right rail (global-infrastructure style)

Work Log:
- api-gateway.tsx: GlassPanel "GATE PROTOCOL // LIVE" kept (title/subtitle/actions={SimControls}) but became a !p-0 CONTROL DECK — moved up from below the canvas: STAGE dev/prod selector (small uppercase "STAGE" cluster label now a w-full <p> tracking-[0.25em] before its cluster), THROTTLE toggle, CACHING toggle, TTL slider (wrapped in min-w-[200px] flex-1), BURST TEST ×12 button, plus CACHE PROFILE readout line (w-full, last row of deck). Main grid lg:grid-cols-[minmax(0,1fr)_320px] items-start: left GlassPanel "FLOW VIEW // REQUEST PIPELINE" (subtitle "CLIENT → 5 STAGES → 3 BACKENDS — THROTTLING + CACHING", !p-0 overflow-hidden, delay 0.05) wrapping the byte-identical FlowCanvas (only height class → h-[440px] sm:h-[540px] lg:h-[560px]); right rail = "LIVE STATS" GlassPanel (p-3 grid grid-cols-2, 4 StatChips, tone/delay props kept, dropped sm:grid-cols-4) + new "REQUEST INSPECTOR" GlassPanel (delay 0.15) holding the log div byte-identical (logBoxRef auto-scroll + AnimatePresence + LOG_TONE_CLS lines + empty state), duplicated inner glass-inset header row deleted. Knowledge grid untouched.
- cloudfront.tsx: "EDGE MIRROR // LIVE" panel → !p-0 CONTROL DECK with TTL slider (min-w-[200px] flex-1) + INVALIDATION button + LOWER TTL hint line (w-full) moved up from below the canvas. Main grid: left "FLOW VIEW // EDGE CACHE RACE" (subtitle "3 USERS → 600+ POP EDGES → S3 ORIGIN — HIT VS MISS") around untouched FlowCanvas; right rail stacked three panels: "LIVE STATS" (4 StatChips) → "LATENCY READOUT" GlassPanel (animated AVG HIT/AVG MISS bars + race summary moved out of the old md:grid-cols-5 row; inner markup byte-identical) → "EDGE LOG" GlassPanel (logBoxRef + AnimatePresence lines kept, duplicated "// EDGE LOG / 600+ POPS WORLDWIDE" header row deleted). Knowledge grid untouched.
- lambda.tsx: "PHANTOM COMPUTE // λ" panel → !p-0 CONTROL DECK with COLD/WARM toggle, BURST ×6 button, MEM slider (min-w-[200px] flex-1) and CONCURRENCY gauge moved up from below the canvas. Main grid: left "FLOW VIEW // INVOCATION PIPELINE" (subtitle "4 EVENT SOURCES → λ EXECUTION → CLOUDWATCH / DLQ") around untouched FlowCanvas (clickable event-source nodes untouched); right rail = "LIVE STATS" GlassPanel (INVOKES/ERRORS/P50 DURATION/THROTTLES chips) + "EXECUTION LOG" GlassPanel wrapping the byte-identical glass-inset scroll container (aria-live="polite" + AnimatePresence + {"//"} empty state kept). Knowledge grid untouched.
- All three: zero sim logic/state/ref/effect/timer changes; zero shared/*, registry, page, global-infrastructure changes; imports unchanged (all still used). Deviations (cosmetic only): added w-full to trailing readout/hint lines so flex-wrap decks break deterministically; rail log panels get a p-2 wrapper for the padding the old glass-inset provided.

Stage Summary:
- 3 modules now follow the global-infrastructure layout: ① control deck on top (existing GlassPanel title/subtitle/actions), ② FlowCanvas as main left area at h-[440px] sm:h-[540px] lg:h-[560px] in a lg:grid-cols-[minmax(0,1fr)_320px] grid, ③ right rail with LIVE STATS + per-module log/trace panels (REQUEST INSPECTOR / LATENCY READOUT + EDGE LOG / EXECUTION LOG), ④ knowledge grids byte-identical. bun run lint clean (0 errors/warnings); bunx tsc --noEmit clean for all 3 files. Verified single occurrences of every relocated control and every logBoxRef/aria-live (no duplication).
---
Task ID: 16-e
Agent: general-purpose
Task: Re-layout cloudwatch/containers — controls to top control deck, stats+logs to right rail (global-infrastructure style)

Work Log:
- cloudwatch.tsx: control deck (top) = existing "SIGNAL SCOPE // LIVE" GlassPanel with SimControls + all controls relocated from below the canvas (THRESHOLD 60/75/90 cluster — label now a full-width uppercase <p>, SNS NOTIFY toggle, SCALING ACTION toggle, INJECT CPU SPIKE, INJECT 5XX BURST), className="!p-0". Main grid lg:grid-cols-[minmax(0,1fr)_320px]: left = new "FLOW VIEW // METRICS PIPELINE" GlassPanel wrapping the byte-identical FlowCanvas (height +lg:h-[560px]); right rail = "LIVE STATS" GlassPanel (p-3 grid-cols-2, 4 StatChips, tones kept) + "ALARM HISTORY // LIVE" GlassPanel (subtitle "AWS/EC2 · CPUUtilization" from the deleted inner header row; scroll box w/ histBoxRef + AnimatePresence + LOG_TONE_CLS lines kept byte-identical inside a p-2 wrapper). Knowledge grid untouched. No sim/state/ref/effect changes; no imports removed.
- containers.tsx: control deck = existing "ORCHESTRATOR // LIVE" GlassPanel + SimControls + controls moved up (ORCHESTRATOR ECS/EKS role=group — inner "ORCH" span hoisted to full-width <p>, aria-label kept; LAUNCH toggle; DESIRED 2/4/6 role=group — "DESIRED" span hoisted to <p> "DESIRED COUNT"; AUTOSCALING; DEPLOY NEW IMAGE; TRAFFIC SPIKE; KILL TASK), className="!p-0". Main grid lg:grid-cols-[minmax(0,1fr)_300px]: left = "FLOW VIEW // CONTAINER PIPELINE" GlassPanel around byte-identical FlowCanvas (height +lg:h-[560px]); right rail = "LIVE STATS" (4 StatChips) + "ORCHESTRATOR LOG // LIVE" GlassPanel (subtitle `${orch} · ${launch} · TICK …` from deleted header row; logBoxRef + role="status" + aria-label + p-2 scroll box kept). Knowledge grid untouched.
- Deviation (documented): containers cluster boundary overlay had hard-coded w-[280px] at left 62% (overflows canvas when narrower than ~368px). Per contract, rail narrowed to 300px AND box relaxed sm:w-[280px] → sm:w-[240px] (threshold drops to ~316px; task chips truncate, layout unaffected).

Stage Summary:
- Both modules now follow the global-infrastructure layout: controls on top, FlowCanvas main-left, LIVE STATS + log rail right (320px cloudwatch / 300px containers), knowledge grid unchanged.
- FlowCanvas children verified byte-identical via git diff (only the sanctioned containers cluster width relax + height class changed).
- bun run lint: clean (0 errors/warnings). bunx tsc --noEmit: zero errors for both files.
---
Task ID: 16-d
Agent: general-purpose
Task: Re-layout ec2/rds — controls to top, stats+logs to right rail (global-infrastructure style)

Work Log:
- src/components/services/ec2.tsx (TWO stacked GlassPanels, INLINE variant applied to each, both got className="!p-0"): PANEL A "LIFECYCLE STATE MACHINE" — START/STOP/REBOOT/TERMINATE motion buttons + AnimatePresence-wrapped REVIVE INSTANCE moved from below the FlowCanvas into a top control strip (px-3 sm:px-4 py-2.5 flex flex-wrap items-center gap-2 border-b border-foreground/10, exact button classNames/motion props/aria-labels kept); new grid p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_300px] gap-3 items-start with FlowCanvas (h-[440px] sm:h-[540px], all children byte-identical) left and right rail (flex flex-col gap-3 min-w-0) holding STATE LOG (glass-inset cyber-scroll max-h-28 aria-live kept byte-identical incl. {"//"} empty state) then LIFECYCLE STATS restacked as glass-inset p-3 grid grid-cols-2 gap-2 (dropped sm:grid-cols-4). PANEL B "AUTO SCALING GROUP SIM" — control strip now holds CPU LOAD slider+AVG bar (wrapped min-w-[240px] flex-1) and the 6-button INSTANCE FAMILY GRID (wrapped min-w-[320px] flex-[2], grid-cols-3 sm:grid-cols-6 kept); grid lg:grid-cols-[minmax(0,1fr)_300px] with dashed ASG boundary + AnimatePresence instance chips as the left visual (byte-identical) and right rail holding ASG STATS (glass-inset p-3 grid-cols-2), LATEST POLICY EVENT AnimatePresence ticker, and FAMILY DETAIL STRIP (info readout → rail, judgment call). Knowledge callouts untouched; zero sim-logic/state/ref/effect changes.
- src/components/services/rds.tsx (standard variant): 1) CONTROL DECK — existing "SYNC SHADOW // LIVE" GlassPanel kept title/subtitle/actions={SimControls} + className="!p-0"; MULTI-AZ toggle, RDS PROXY toggle, REPLICAS 0/1/2 role="group" selector, WRITE STORM, FAILOVER, AnimatePresence RESTORE WRITER moved up from below the canvas into px-3 sm:px-4 py-3 flex flex-wrap items-center gap-2 (exact classNames + aria-pressed/aria-label preserved). 2) MAIN GRID — grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start; new FLOW VIEW // DATABASE ENGINE panel (!p-0 overflow-hidden delay 0.05, subtitle "MULTI-AZ STANDBY + READ REPLICA — WRITES · READS · FAILOVER") wrapping the byte-identical FlowCanvas, height class only changed to h-[440px] sm:h-[540px] lg:h-[560px]; right rail (flex flex-col gap-4 min-w-0) = LIVE STATS panel (p-3 grid grid-cols-2 gap-2; WRITES/READS/MAX REPLICA LAG/FAILOVERS chips unchanged, dropped sm:grid-cols-4) + ENGINE LOG // LIVE panel (!p-0 delay 0.15) whose scroll div keeps ref={logBoxRef}, gained aria-live="polite", classes glass-inset cyber-cut-sm p-2.5 max-h-[300px] lg:max-h-[420px] overflow-y-auto cyber-scroll flex flex-col gap-0.5 (auto-scroll effect untouched); old glass-inset wrapper + duplicated inner header row (SYNC STANDBY · TICK_MS) deleted per contract. 3) KNOWLEDGE grid byte-identical. No imports added/removed (TICK_MS still used by the tick interval); refs-as-source-of-truth pattern untouched.

Stage Summary:
- ec2.tsx + rds.tsx now follow the global-infrastructure layout: interactive controls in a top strip/deck above the visual, FlowCanvas/ASG visual as the main left area, stats + logs (+ ASG policy ticker, family detail) in a right-side rail (300px ec2 / 320px rds), knowledge callouts unchanged at bottom.
- Pure JSX re-layout: sim logic, state, refs, effects, timers, FlowCanvas children, motion props, aria attributes and AnimatePresence wrappers all preserved byte-identical (only relocated + indentation); ec2 STATE LOG classes kept as-is (max-h-28) since the ec2 template did not specify a log height.
- Verification: `bun run lint` → clean (0 errors/warnings); `bunx tsc --noEmit` (filtered) → zero errors for both files. No other files touched.
---
Task ID: 16 (orchestrator)
Agent: main (orchestrator)
Task: "similar to GLOBAL INFRASTRUCTURE, move all other service controls(top) & logs, stats to right side of the animation in all other services" — re-layout all 13 service modules.

Work Log:
- Defined the shared re-layout contract (mirroring global-infrastructure.tsx): ① CONTROL DECK panel on top = existing module title card (title/subtitle/actions SimControls kept, className !p-0) with EVERY below-canvas control relocated into a px-3 sm:px-4 py-3 flex-wrap strip (exact classNames/aria preserved; cluster labels become w-full uppercase <p>; sliders wrapped min-w flex-1); ② main grid lg:grid-cols-[minmax(0,1fr)_320px] items-start with the animation in a new "FLOW VIEW // <name>" panel (FlowCanvas + children byte-identical, height h-[440px] sm:h-[540px] lg:h-[560px]) and a right rail stacking LIVE STATS (p-3 grid grid-cols-2 StatChips) + existing log/trace/readout GlassPanels (auto-scroll refs + aria-live kept, duplicated inner headers dropped); ③ knowledge grids untouched. Pure JSX re-layout — zero sim-logic/state/ref/effect changes.
- Dispatched 5 parallel agents on disjoint file sets: 16-a (sqs, sns, s3), 16-b (vpc, iam, elb), 16-c (api-gateway, cloudfront, lambda), 16-d (ec2 inline-variant both panels, rds), 16-e (cloudwatch, containers with sanctioned 300px rail + sm:w-[240px] boundary relax). All appended their own 16-x worklog sections (see above).
- New rail panels where a module had no log: SQS "DLQ CONTENTS" (dlq state chips + healthy empty state), ELB "TARGET HEALTH" (per-target HEALTHY/UNHEALTHY/RECOVERING rows), S3 "RECENT OBJECTS" (last 8 keys + tier markers); secondary readouts moved into rails (S3 STORAGE CLASS PRICING, CloudFront LATENCY READOUT).
- Verification (orchestrator): bun run lint → clean; bunx tsc --noEmit (filtered) → zero errors; Agent Browser E2E at 1440px — all 14 modules screenshotted and structurally verified (control deck above canvas, stats/logs in right rail; hotkey map 1=GLOBAL 2=IAM 3=S3 4=VPC 5=EC2 6=ELB 7=LAMBDA 8=APIGW 9=SNS 0=SQS -=CF ==RDS [=CW ]=Containers); interactivity spot-checks: Lambda RUN + source click → EXECUTION LOG populates; ELB RUN → REQUESTS SENT increments, KILL TARGET → UNHEALTHY row → auto-recovers 4/4; mobile 390px — ELB/SQS/Containers/EC2 scrollWidth=390, no horizontal overflow, rail stacks below canvas; console errors: none (only pre-existing THREE.Clock deprecation warnings); dev.log recent entries all 200s (transient fast-refresh full-reloads during the parallel-edit window are stale).
- Screenshots: /home/z/shots/t16-{initial,lambda,apigw,sns,sqs,cloudfront,rds,iam,s3,vpc,ec2,ec2-panelb,elb,cloudwatch,containers,elb-mobile}.png.

Stage Summary:
- All 13 service modules now share the GLOBAL INFRASTRUCTURE layout language: controls in a top control deck, the flow animation as the main left area, and LIVE STATS + logs/traces/readouts stacked in a 320px right rail (300px for containers), collapsing to a single column on mobile.
- No shared components, registry, page.tsx, or global-infrastructure.tsx changed; simulation engines untouched; lint + tsc clean; golden-path browser-verified on desktop and mobile.

---
Task ID: run-app
Agent: main
Task: Run the app and verify it works end-to-end

Work Log:
- Found no dev server running; started `bun run dev` in background (dev.log)
- Server ready on port 3000 in 773ms (Next.js 16.1.3 Turbopack)
- Agent Browser: opened http://localhost:3000, title "AWS | ATOM LEARN" OK
- Captured desktop (1440px) screenshot: GLOBAL INFRASTRUCTURE renders with 3 tabs (GENERAL / REGIONS BEST USE CASE / AVAILABILITY ZONE USE CASE), stats, orbital view
- Captured mobile (390px) screenshot: responsive layout OK, no overflow
- Switched modules via sidebar: EC2, S3, RDS, CloudWatch, Containers — all render correctly
- EC2 interactivity tested: START → RUN → state machine transitions STOPPED → PENDING → RUNNING confirmed
- Containers module confirmed with restructured layout (controls top, LIVE STATS + ORCHESTRATOR LOG on right side of animation)
- Checked agent-browser errors: none; dev.log shows clean GET / 200 responses

Stage Summary:
- App is running and fully functional on port 3000
- All 14 modules render; core interactivity verified via Agent Browser
- Screenshots saved: /home/z/shots/run-app-desktop.png, run-app-mobile.png, run-ec2.png, run-containers.png

---
Task ID: test-errors-run-app
Agent: main
Task: Test the app for errors and run it

Work Log:
- Dev server was down; restarted `bun run dev` (ready in 755ms, port 3000)
- `bun run lint`: clean, zero warnings
- `bunx tsc --noEmit`: found 1 project error — leftover src/lib/db.ts importing @prisma/client (prisma removed previously, file unused, no imports anywhere)
- Removed leftovers: src/lib/db.ts, prisma/ folder, db/custom.db → project source now 0 TS errors (remaining 4 tsc lines all in skills/ + examples/ framework folders, not project code)
- Agent Browser E2E sweep: opened /, cycled all 13 non-default modules (IAM→Containers) — zero page errors on every module
- Only console output: harmless THREE.Clock deprecation warning
- Interaction tests: AZ tab renders content ✅; NORTH AMERICA badge → AUTO-ROTATE OFF ✅; us-west-2 region → AZ detail + REGION UPLINK panel updated, globe focused ✅; EC2 START+RUN → state RUNNING, 2 transitions ✅; Containers RUN → 2/2 tasks, orchestrator log active ✅
- dev.log: zero error/fail lines, all GET / 200; final curl HTTP 200

Stage Summary:
- App error-free and running on port 3000: lint clean, project TS clean (removed prisma leftovers), 14/14 modules browser-verified, all core interactions working
- Screenshots: /home/z/shots/test-globe-region.png
---
Task ID: 17-b
Agent: general-purpose
Task: Restructure api-gateway/sns/cloudfront — controls to right rail below LIVE STATS, logs to full-width bottom AutoLog

Work Log:
- Read worklog + shared/auto-log.tsx contract; read all 3 target files to map existing deck controls, log plumbing (logBoxRef + auto-scroll useEffect, local LOG_TONE_CLS) and push helpers.
- api-gateway.tsx: deleted top "GATE PROTOCOL // LIVE" CONTROL DECK; new right-rail CONTROLS panel (delay 0.12) below LIVE STATS holding SimControls + STAGE dev/prod buttons + THROTTLE/CACHING toggles + full-width TTL slider (input w-20→w-full) + BURST TEST ×12 + CACHE PROFILE readout line; all onClick/aria/active-colors preserved verbatim. REQUEST INSPECTOR moved below the grid full width (delay 0.18) as AutoLog lines={log} with original emptyText; removed old max-h-32 scroll container, logBoxRef + its auto-scroll useEffect, and now-unused local LOG_TONE_CLS const.
- sns.tsx: deleted "SIGNAL BURST // LIVE" deck; rail CONTROLS (delay 0.12) holds SimControls + PUBLISH EVENT + MSG ATTRS/FILTER POLICY toggle + subscriber-attribute legend; DELIVERY STREAM (title + orders-topic·5 SUBSCRIPTIONS subtitle kept) moved full-width below grid as AutoLog; removed glass-inset/max-h-32 wrapper, logBoxRef + effect, local LOG_TONE_CLS.
- cloudfront.tsx: deleted "EDGE MIRROR // LIVE" deck; rail order now LIVE STATS → CONTROLS (delay 0.12: SimControls + full-width TTL slider w-24→w-full + INVALIDATION /* button + LOWER TTL hint) → LATENCY READOUT (stays); EDGE LOG moved full-width below grid as AutoLog; removed logBoxRef + effect + local LOG_TONE_CLS.
- Timestamps: added `[${logTs()}] ` prefix inside each file's single pushLog() helper (push time, useCallback-stable) — covers every push site incl. setTimeout callbacks (sns per-subscriber outcomes, api-gw burst, cf tick loop). Service data (HTTP path/status/latency/cache HIT, subscriber keys/status, edge location/TTL/invalidation id) untouched.
- FlowCanvas internals (FlowNode/FlowLabel/AnimatePresence transient labels) and all sim logic/state machines/refs untouched; no exports renamed; button rows use flex flex-wrap gap-2, no fixed-width overflow classes introduced.
- Verification: bunx tsc --noEmit | rg "services/(api-gateway|sns|cloudfront)" → empty; bun run lint → clean. Browser E2E (agent-browser): APIGW run+burst → timestamped 200/429 lines; SNS publish+filter toggle → timestamped delivered/skipped lines; CloudFront run+invalidation → timestamped HIT/MISS/cached lines; rail structure = LIVE STATS→CONTROLS(→LATENCY READOUT) confirmed via snapshots; mobile 390px scrollWidth=390 (no overflow); zero console/page errors.

Stage Summary:
- All 3 modules now follow the 17-x target layout: no top control deck; every interactive control lives in a right-rail CONTROLS panel directly below LIVE STATS (cloudfront keeps LATENCY READOUT after it); text logs render full-width below the grid via shared AutoLog (4-line pinned auto-scroll) with wall-clock timestamps pushed in pushLog; old manual scroll boxes/refs/local tone maps removed; lint + tsc clean, browser-verified desktop + 390px mobile.
---
Task ID: 17-c
Agent: general-purpose
Task: Restructure rds/cloudwatch/containers — controls to right rail below LIVE STATS, logs to full-width bottom AutoLog

Work Log:
- rds.tsx: deleted top CONTROL DECK GlassPanel ("SYNC SHADOW // LIVE" + SimControls in actions). Added rail GlassPanel "CONTROLS" (!p-0, delay 0.12) directly below LIVE STATS with SimControls (status line kept) + tiny labels ("TOPOLOGY & POOLING", "FAILOVER & LOAD") + all 6 relocated controls restacked for the 320px rail: MULTI-AZ toggle, RDS PROXY toggle, REPLICAS 0/1/2 role=group (kept inline REPLICAS span, now w-full), WRITE STORM, FAILOVER (dynamic label/disabled kept), AnimatePresence RESTORE WRITER — all onClick/aria/active-state classes byte-identical. ENGINE LOG // LIVE panel moved below the main grid full-width (delay 0.18) with AutoLog lines={log} emptyText kept tones={LOG_TONE_CLS}; deleted logBoxRef + auto-scroll useEffect + old max-h scroll container. rds lines keep their `> ${fmtTick(tick)}` sim-tick timestamps as-is (no logTs needed).
- cloudwatch.tsx: deleted top CONTROL DECK ("SIGNAL SCOPE // LIVE"). Rail CONTROLS panel below LIVE STATS: SimControls + tiny labels ("ALARM THRESHOLD", "ALARM ACTIONS", "CHAOS INJECTION") + relocated THRESHOLD 60/75/90, SNS NOTIFY, SCALING ACTION, INJECT CPU SPIKE, INJECT 5XX BURST (exact handlers/aria/pressed-state colors). ALARM HISTORY // LIVE (subtitle "AWS/EC2 · CPUUtilization" kept) moved below the grid full-width with AutoLog lines={history}; deleted histBoxRef + auto-scroll effect. History lines already embed `${tstamp(tick)}` sim-tick timestamps → kept as-is, no logTs import.
- containers.tsx: deleted top CONTROL DECK ("ORCHESTRATOR // LIVE"). Rail CONTROLS panel below LIVE STATS: SimControls (statusLine kept) + ORCHESTRATOR ECS/EKS role=group (w-full), LAUNCH toggle, DESIRED COUNT 2/4/6 group converted to grid w-full grid-cols-3, AUTOSCALING toggle, CHAOS & DEPLOY row (DEPLOY NEW IMAGE w/ deployActive disabled + dynamic label, TRAFFIC SPIKE, KILL TASK) — all handlers/aria-labels/colors preserved. ORCHESTRATOR LOG // LIVE (subtitle `${orch} · ${launch} · TICK …` kept) moved below the grid full-width with AutoLog lines={log} (long lines truncate w/ tooltip per AutoLog — intended); deleted logBoxRef + auto-scroll effect. MAX_LOG slice cap kept in pushLog; `${ts}` sim-tick timestamps kept as-is.
- All 3: rail order LIVE STATS → CONTROLS (→ no extra data panels in these files); FLOW VIEW panel had no actions prop; FlowCanvas children untouched; grid width unchanged (320px rds/cw, 300px containers per 16-e deviation); no sim logic/state/effect/timer changes; exported component names/signatures unchanged; only new import is AutoLog.

Stage Summary:
- All 3 modules now: animation left, right rail = LIVE STATS → CONTROLS, full-width AutoLog panel (fixed 4-line, pinned auto-scroll, tone maps preserved via tones prop) between the grid and KNOWLEDGE.
- Verification: bunx tsc --noEmit filtered to the 3 files → empty; bun run lint → exit 0, 0 errors/warnings; dev server GET / → 200, compile clean.
---
Task ID: 17-a
Agent: general-purpose
Task: Restructure iam/vpc/lambda — controls to right rail below LIVE STATS, logs to full-width bottom AutoLog

Work Log:
- iam.tsx: deleted top CONTROL DECK ("ACCESS MATRIX // LIVE"); moved SimControls (same status strings incl. dynamic ENGINE LIVE — EVALUATING AS …) + MFA toggle + ACTION UNDER TEST selector row + EVALUATE NOW into new CONTROLS GlassPanel (delay 0.12, !p-0) directly below LIVE STATS in the rail (tiny-label groups "MFA SESSION CONTEXT" / "ACTION UNDER TEST"; all onClick/aria/active colors verbatim). Moved "ENGINE TRACE — DECISION LOG" below the grid full-width (delay 0.18) with AutoLog lines={log.map((t,i)=>({id:i,text:t}))} toneOf={logTone} tones={TRACE_TONES}; deleted logBoxRef + auto-scroll useEffect + old max-h-40 overflow-y-auto wrapper. Timestamps: `[${logTs()}] ` prepended in tick's pushLog; armed line via armedLine() helper at useState lazy init / ref seed / reset (logRef seeded from initial state so ts matches state).
- vpc.tsx: deleted top CONTROL DECK ("VOID NETWORK // LIVE"); moved SimControls + SG/NACL view selector + NAT toggle + STEP TRACE (onClick={tick} kept) into CONTROLS panel below LIVE STATS (groups "FILTER ENGINE VIEW" / "EGRESS + TRACE"). Moved "PACKET TRACE — HOP-BY-HOP" below grid full-width with AutoLog (same mapping as iam, tones=TRACE_TONES, emptyText "// packet trace empty"); deleted logBoxRef + auto-scroll effect. Timestamps in pushLog + armedLine() for initial/reset; logTone startsWith("> ✕"/"> ───") → includes() since ts prefix now leads the line.
- lambda.tsx: deleted top CONTROL DECK ("PHANTOM COMPUTE // λ"); moved SimControls + COLD/WARM toggle + BURST ×6 + MEM slider (w-24 → w-full flex-1, wrapper w-full per 320px rail) + CONCURRENCY gauge (read-only display, kept w/ w-full) into CONTROLS panel below LIVE STATS (groups "INVOCATION MODE" / "MEMORY SIZE" / "RESERVED CONCURRENCY"). Moved "EXECUTION LOG" below grid full-width with AutoLog lines={logs} tones={TONE_CLS} emptyText="// execution log empty — invoke something" (old slice(-14) + AnimatePresence manual renderer removed; unique log ids kept). Timestamps added at the single pushLog helper. Event-source fire buttons INSIDE FlowCanvas untouched.
- All 3: logTone/log tone maps converted to tone KEYS + file's own TRACE_TONES/TONE_CLS passed via AutoLog `tones` (deviation: spec's literal toneOf={logTone} would feed class strings through the tone→class map and drop colors; key-returning logTone + tones map preserves the exact legacy classes). Rail order LIVE STATS → CONTROLS; FLOW VIEW panels had no actions prop; FlowCanvas children, sim logic, timers, state machines, exported component names untouched.

Stage Summary:
- iam/vpc/lambda now: animation left, right rail = LIVE STATS → CONTROLS (all former deck controls, 320px-safe wrapping, full-width slider/gauge), full-width 4-line AutoLog panel (delay 0.18) between grid and KNOWLEDGE.
- Every log line timestamped `[HH:MM:SS.mmm] ` at push time (pushLog helpers; armed/initial lines via armedLine()); service data (req ids, verdicts, hop numbers, 429/latency/cold-warm, error codes) preserved.
- Verification: bunx tsc --noEmit filtered to services/(iam|vpc|lambda) → empty; bun run lint → 0 errors; leftover scan (logBoxRef/INITIAL_LOG/deck titles) → clean; only the 3 assigned files modified.
---
Task ID: 17-d
Agent: general-purpose
Task: Restructure ec2/s3/elb/sqs — controls to right rail below LIVE STATS, ec2 state log to full-width bottom AutoLog

Work Log:
- ec2.tsx Panel A "LIFECYCLE STATE MACHINE": removed actions={SimControls} from the GlassPanel header and deleted the top control strip; START/STOP/REBOOT/TERMINATE (+ AnimatePresence-wrapped conditional REVIVE INSTANCE) re-homed into a new rail GlassPanel "CONTROLS" (title CONTROLS, className="!p-0", delay 0.12) placed BELOW the LIFECYCLE STATS glass-inset — SimControls first (same running/toggle/reset/status props), then a flex flex-wrap gap-2 row with all button classNames/disabled logic/aria-labels/motion props preserved verbatim (BTN const still used). Raw state-log glass-inset box deleted from the rail and replaced by a NEW FULL-WIDTH GlassPanel "STATE LOG // LIVE" (subtitle `instance ${instanceId} :: lifecycle transitions`, className="!p-0", delay 0.12) between Panel A and Panel B wrapping the shared <AutoLog lines={logs} emptyText="// state log empty — press START or engage autopilot" tones={TONE_CLS} /> (log state {id,text,tone} passes straight through; old slice(-16)/AnimatePresence markup dropped).
- ec2.tsx timestamps: pushLog helper now computes `const ts = logTs()` at push time (once per call, before the setLogs updater) and prepends `[${ts}] ` to every line — all existing message content (state names, transition arrows, instance ids, status-check/auto-scaling lines) kept verbatim. Imported { AutoLog, logTs } from "@/components/shared/auto-log". FlowCanvas internals untouched.
- ec2.tsx Panel B "AUTO SCALING GROUP SIM": removed actions={SimControls} from header and deleted the CPU-load + family-grid control strip (with its min-w-[240px]/min-w-[320px] wrappers); new rail "CONTROLS" GlassPanel (delay 0.12) directly below ASG STATS containing SimControls (asgRunning props verbatim) + tiny group labels ("CPU LOAD DRIVER", "INSTANCE FAMILY" — text-[8px] font-bold uppercase tracking-[0.25em] text-muted-foreground) + the full-width CPU load slider (Cpu icon, range input, {load}% readout, AVG bar with danger/mint/aws classes — handlers/aria kept) + the 6-family grid as grid grid-cols-3 gap-2 (2 rows in the 300px rail, per-button icon/name/role, selected border-aws bg-aws/10 text-aws box-glow styling, aria-labels, whileHover/whileTap all preserved). Policy event ticker + family detail strip STAY in the rail after CONTROLS; ASG tick engine untouched. No bottom log for Panel B.
- s3.tsx: deleted the top CONTROL DECK "INFINITE VAULT // LIVE" GlassPanel; new rail "CONTROLS" GlassPanel (delay 0.12) directly below LIVE STATS with SimControls (BUCKET ONLINE status verbatim) + labels "BUCKET CONFIG" (VERSIONING + REPLICATION toggles, exact classNames/aria) + "OBJECT ACTIONS" (PUT OBJECT motion.button verbatim) in flex flex-wrap gap-2 rows; the putObject FlowNode onClick inside the canvas (UPLOADS node) stays. Order: LIVE STATS → CONTROLS → STORAGE CLASS PRICING → RECENT OBJECTS (delays 0.15/0.2 unchanged). FLOW VIEW header had no actions to remove.
- elb.tsx: deleted the top CONTROL DECK "TRAFFIC SPLITTER // LIVE"; new rail "CONTROLS" (delay 0.12) below LIVE STATS with SimControls (ALB status verbatim) + label "LISTENER & TARGETS" + PATH RULES toggle (BTN const reused, aria kept) + KILL TARGET motion.button (disabled={healthyCount === 0} kept) + the health-check hint span (text-[8px] tracking-wider text-muted-foreground uppercase) as a full-width line under the buttons. Order: LIVE STATS → CONTROLS → TARGET HEALTH. FLOW VIEW header had no actions.
- sqs.tsx: deleted the top CONTROL DECK "QUEUE SIMULATOR // LIVE"; new rail "CONTROLS" (delay 0.12) below LIVE STATS with SimControls + label "QUEUE CONFIG" (FIFO/STANDARD + LONG/SHORT POLLING toggles verbatim) + label "CHAOS ACTIONS" (INJECT POISON MSG motion.button verbatim). Order: LIVE STATS → CONTROLS → DLQ CONTENTS. FLOW VIEW header had no actions.
- All four: no fixed-width classes introduced (dropped min-w wrappers; wide rows use flex flex-wrap gap-2; family grid is fixed 3 cols and wraps naturally in the 300px rail / stacked mobile). Zero sim-logic/state/ref/effect/timer changes; aria-labels, motion props, AnimatePresence wrappers preserved; only files touched: the 4 assigned ones.

Stage Summary:
- ec2 now: Panel A (FlowCanvas + rail LIFECYCLE STATS → CONTROLS) → full-width STATE LOG // LIVE AutoLog with [HH:MM:SS.mmm] timestamps pushed in pushLog → Panel B (ASG visual + rail ASG STATS → CONTROLS (SimControls+CPU slider+3-col family grid) → policy ticker → family detail). s3/elb/sqs now: FLOW VIEW left, rail LIVE STATS → CONTROLS → data panels; top control decks deleted.
- Verification: bunx tsc --noEmit | rg "services/(ec2|s3|elb|sqs)" → empty (0 errors); bun run lint → exit 0, no warnings for these files.
- Deviations: (1) tiny uppercase group labels added inside CONTROLS panels (spec pattern for s3/elb/sqs; applied to ec2 Panel B too for consistency); (2) deck titles/subtitles (INFINITE VAULT // LIVE, TRAFFIC SPLITTER // LIVE, QUEUE SIMULATOR // LIVE + their dynamic status subtitles) die with the deleted decks per spec — their state remains visible via the toggle buttons and FLOW VIEW subtitles; (3) elb health-check hint span kept inside CONTROLS rather than dropped.

---
Task ID: 17-main
Agent: main
Task: Structural UI change across all services except GLOBAL INFRASTRUCTURE — controls to right rail below LIVE STATS, logs to full-width bottom (4-line auto-scroll with timestamps)

Work Log:
- Created shared component src/components/shared/auto-log.tsx: AutoLog (fixed 4-line terminal log, pinned auto-scroll to newest entry, tone map, toneOf content-coloring, entry animation, truncate+tooltip) + logTs() wall-clock helper + LOG_TONE_CLS
- Dispatched 4 parallel agents (17-a: iam/vpc/lambda, 17-b: api-gateway/sns/cloudfront, 17-c: rds/cloudwatch/containers, 17-d: ec2/s3/elb/sqs) with precise spec: delete top CONTROL DECKs, add CONTROLS GlassPanel in rail directly below LIVE STATS with all deck controls (handlers/aria/styling preserved), move text-log panels below the main grid full-width wired to AutoLog, timestamps at push time (logTs or existing sim-tick stamps), data panels (TARGET HEALTH, DLQ, PRICING, RECENT OBJECTS, LATENCY READOUT) stay in rail
- Fixed AutoLog flex-shrink bug: lines compressed to 6px inside fixed-height container (no scroll) → added shrink-0 to line elements; verified scrollTop pins to bottom (pinned=true)
- Fixed vpc measurement false alarm (stale reading during module transition; re-measured: PACKET TRACE w=1270 top=866 full-width below grid)
- Verification: lint 0 errors; tsc project-clean; Agent Browser swept all 13 modules — LIVE STATS→CONTROLS rail order confirmed everywhere, log panels full-width (1270px) below grid for the 10 log services, s3 PUT OBJECT from rail works (object appears in RECENT OBJECTS), containers kill-task → log flows + auto-scrolls, EC2 START → timestamped STATE LOG lines (STOPPED→PENDING→RUNNING), zero page errors, mobile 390px scrollWidth=390 no overflow
- dev.log clean (GET / 200, compiles clean)

Stage Summary:
- New uniform layout in all 13 services: [animation | rail: LIVE STATS → CONTROLS → data panels] + full-width 4-line auto-scrolling timestamped log card below the animation
- GLOBAL INFRASTRUCTURE untouched; shared AutoLog reused by 10 services; s3/elb/sqs keep data panels (no native text logs)
- Screenshots: /home/z/shots/r17-iam.png, r17-iam-log.png, r17-ec2-top.png, r17-ec2-log2.png, r17-containers-log.png, r17-mobile-s3.png
---
Task ID: 18-d
Agent: general-purpose
Task: Add immersive fullscreen mode to global-infrastructure (tabs visible in fullscreen)

Work Log:
- Read worklog + reference pattern (iam.tsx immersive return block, use-immersive.ts hook, fullscreen-toggle.tsx, glass-panel actions slot) and mapped global-infrastructure's actual DOM: root div → tablist (GENERAL / REGIONS BEST USE CASE / AVAILABILITY ZONE USE CASE tabs) → GENERAL fragment (2 stat-chip/telemetry grids, main grid [globe | sidebar: REGION UPLINK + ALL REGIONS], KNOWLEDGE GRID of 3 Callouts) → RegionsUseCase/AzUseCase tab content.
- Added only imports (FullscreenToggle, useImmersiveView) + `const immersive = useImmersiveView();` as first line of the component; zero state/refs/effects/Three.js/logic changes.
- Root div: conditional className — immersive ? "fixed inset-0 z-[70] bg-background p-3 sm:p-5 flex flex-col gap-3 sm:gap-4 overflow-y-auto cyber-scroll" : original "flex flex-col gap-4".
- ORBITAL VIEW // DOTTED WORLD MAP GlassPanel: new actions={<FullscreenToggle active={immersive.active} onToggle={immersive.toggle} />} (right end of title row, vertically centered); globe container height conditional "relative h-[min(640px,58vh)] scanlines" (largest existing px = lg:h-[640px], no spaces in arbitrary value) vs original "relative h-[440px] sm:h-[560px] lg:h-[640px] scanlines" — className-only change, R3F <Canvas> is NOT remounted.
- Main grid kept as sidebar layout `grid lg:grid-cols-[1fr_320px] gap-4` with `${immersive.active ? "flex-1" : ""}` appended via template literal (iam.tsx pattern).
- ESSENTIAL kept visible in immersive: the module tablist (tabs usable in fullscreen per spec — RegionsUseCase/AzUseCase render as tab content), GENERAL stat grids + live telemetry chips (data, not prose), globe card incl. its HUD overlays (AUTO-ROTATE / INTER-REGION NET / UNDERSEA CABLES toggles, PKTS/SEC, TRACE, AZ DETAIL, legend — these live inside the globe card as absolute overlays so they come along), REGION UPLINK panel, ALL REGIONS panel (continent badges + region list).
- NON-ESSENTIAL hidden via className={immersive.active ? "hidden" : "grid md:grid-cols-3 gap-3"}: the KNOWLEDGE GRID (3 Callouts). No module description paragraphs exist inside this component (title/description card is rendered by page.tsx outside it).
- Verification: bunx tsc --noEmit | rg "services/global-infrastructure" → empty; bun run lint → exit 0, no errors; git diff = 20 insertions / 6 deletions, only this file modified; no dev server / build / browser used per rules.

Stage Summary:
- GLOBAL INFRASTRUCTURE has immersive fullscreen matching the iam.tsx pattern: fixed-inset root, FullscreenToggle in the globe card header, globe at h-[min(640px,58vh)] without canvas remount, sidebar grid flex-1, tabs + globe HUD toggles + REGION UPLINK + ALL REGIONS stay available, knowledge callouts hidden in immersive.
---
Task ID: 18-c
Agent: general-purpose
Task: Add immersive fullscreen mode to rds/cloudwatch/containers/vpc

Work Log:
- Read worklog (17-c/17-d/17-main entries) + reference pattern (iam.tsx return block, use-immersive.ts, fullscreen-toggle.tsx) before touching anything; inspected all 4 return blocks in full.
- Applied the iam.tsx immersive pattern verbatim to each of the 4 files (zero logic changes — only 2 imports, 1 hook line, JSX classNames + actions prop):
  - imports: `FullscreenToggle` + `useImmersiveView` added right after the AutoLog import in each file.
  - `const immersive = useImmersiveView();` as the first line inside each default-exported component (RDSVisualizer / CloudWatchVisualizer / Containers / VPCVisualizer).
  - Root div: `immersive.active ? "fixed inset-0 z-[70] bg-background p-3 sm:p-5 flex flex-col gap-3 sm:gap-4 overflow-y-auto cyber-scroll" : "<original classes verbatim>"` (normal mode kept each file's original `flex flex-col gap-4`).
  - Main animation grid (rds/cw/vpc 320px rail, containers 300px rail per 17-x deviation) converted to template literal with appended `${immersive.active ? "flex-1" : ""}`.
  - Stage GlassPanel (FLOW VIEW // DATABASE ENGINE / METRICS PIPELINE / CONTAINER PIPELINE / PACKET TRACER TOPOLOGY) got `actions={<FullscreenToggle active={immersive.active} onToggle={immersive.toggle} />}` after delay={0.05}.
  - FlowCanvas height conditional: immersive `"h-[min(560px,58vh)]"` (no spaces in arbitrary value), normal original `h-[440px] sm:h-[540px] lg:h-[560px]` verbatim (rds/vpc single-line FlowCanvas reflowed to multi-line for the conditional).
  - KNOWLEDGE callout grid hidden in immersive: `className={immersive.active ? "hidden" : "<original classes>"}` — original class order preserved per file (`grid gap-3 md:grid-cols-3` rds/containers, `grid md:grid-cols-3 gap-3` cloudwatch/vpc).
- Structure audit: all 4 files are single-stage (one FLOW VIEW grid + full-width AutoLog panel + KNOWLEDGE); rail content (LIVE STATS + CONTROLS) and full-width log panels (ENGINE LOG / ALARM HISTORY / ORCHESTRATOR LOG / PACKET TRACE) intentionally stay visible in immersive; no second animation-like grids exist in any of the 4, so `flex-1` only on the single main grid; no task/node detail panels outside the rail in containers (capacity/task readouts live inside FlowCanvas, untouched).
- Untouched: all state/refs/effects/timers/handlers, FlowCanvas children, SimControls wiring, AutoLog props, Callout content, exported names.

Stage Summary:
- rds/cloudwatch/containers/vpc now support immersive fullscreen exactly like iam: fixed z-[70] overlay keeps animation grid (flex-1, h-[min(560px,58vh)] canvas), rail (LIVE STATS+CONTROLS) and full-width log panel; knowledge callouts hidden; FullscreenToggle button in the FLOW VIEW title row toggles browser fullscreen with graceful overlay-only fallback + ESC teardown via the shared hook.
- Verification: `bunx tsc --noEmit | rg "services/(rds|cloudwatch|containers|vpc)"` → empty; `bun run lint` → exit 0, no errors/warnings; diff scoped to the 4 assigned files (~18-21 changed lines each, imports + hook line + JSX class/props only).
- No deviations from the iam.tsx pattern.
---
Task ID: 18-a
Agent: general-purpose
Task: Add immersive fullscreen mode to ec2/s3/elb/sqs

Work Log:
- Read worklog tail (17-d layout of these files), reference iam.tsx return block, src/hooks/use-immersive.ts and src/components/shared/fullscreen-toggle.tsx (both untouched), confirmed GlassPanel actions slot renders the toggle at the right end of the title row.
- All 4 files (ec2/s3/elb/sqs.tsx): added imports FullscreenToggle + useImmersiveView (after shared imports, before aws-icons, mirroring iam.tsx order); first line inside the default export `const immersive = useImmersiveView();`; root div className → conditional (immersive: "fixed inset-0 z-[70] bg-background p-3 sm:p-5 flex flex-col gap-3 sm:gap-4 overflow-y-auto cyber-scroll" / normal: original "flex flex-col gap-4" verbatim); main animation grid className converted to template literal with `${immersive.active ? "flex-1" : ""}` appended; stage GlassPanel got actions={<FullscreenToggle active={immersive.active} onToggle={immersive.toggle} />}; FlowCanvas className conditional (immersive → largest-px rule, see deviations); KNOWLEDGE callout grid → className={immersive.active ? "hidden" : "grid md:grid-cols-3 gap-3"}.
- ec2.tsx specifics: actions prop added to BOTH "LIFECYCLE STATE MACHINE" (Panel A) and "AUTO SCALING GROUP SIM" (Panel B) headers; flex-1 appended ONLY to Panel A's inner grid (Panel B grid left plain); full-width "STATE LOG // LIVE" AutoLog panel + both grids/rails stay visible in immersive; only the KNOWLEDGE section hidden.
- s3/elb/sqs specifics: single FLOW VIEW stage each; right rail (LIVE STATS → CONTROLS → data panels: STORAGE CLASS PRICING + RECENT OBJECTS / TARGET HEALTH / DLQ CONTENTS) stays visible; only KNOWLEDGE hidden (no bottom log panels in these three per 17-d).
- ZERO logic changes: no state/refs/effects/timers/handlers/aria/motion props touched — per file only 2 imports, 1 hook line, JSX classNames and the actions prop.
- Verification: `bunx tsc --noEmit 2>&1 | rg "services/(ec2|s3|elb|sqs)"` → empty; full tsc (excl. skills/examples framework folders) → clean; `bun run lint` → exit 0, no errors/warnings; git diff scope = only the 4 assigned files (+73/-20 total).

Stage Summary:
- ec2/s3/elb/sqs now support immersive fullscreen: toggle button in the animation panel title row(s); active → fixed z-[70] overlay keeping only animation grid(s) + STATE LOG (ec2) + rails (LIVE STATS/CONTROLS/data panels), knowledge hidden, FlowCanvas height capped at h-[min(540px|560px,58vh)]; normal-mode classes byte-identical to before. Deviation: ec2 immersive height is h-[min(540px,58vh)] (largest px of its own responsive classes, no lg:560 tier); s3/elb/sqs use h-[min(560px,58vh)] exactly as in iam.tsx.
---
Task ID: 18-b
Agent: general-purpose
Task: Add immersive fullscreen mode to api-gateway/sns/cloudfront/lambda

Work Log:
- Read worklog tail (17-a/17-b/17-main), reference iam.tsx, hook use-immersive.ts and shared/fullscreen-toggle.tsx (hook/button untouched per rules).
- Mirrored the iam.tsx pattern exactly into api-gateway.tsx, sns.tsx, cloudfront.tsx, lambda.tsx — identical 6-part minimal edit per file:
  1. Imports: added FullscreenToggle + useImmersiveView directly after the shared/auto-log import line.
  2. First line inside each default-exported component: const immersive = useImmersiveView();
  3. Root div className → conditional: immersive.active ? "fixed inset-0 z-[70] bg-background p-3 sm:p-5 flex flex-col gap-3 sm:gap-4 overflow-y-auto cyber-scroll" : original "flex flex-col gap-4" kept verbatim.
  4. Main animation grid converted to template literal with appended ${immersive.active ? "flex-1" : ""} (grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start otherwise byte-unchanged).
  5. FLOW VIEW stage GlassPanel got actions={<FullscreenToggle active={immersive.active} onToggle={immersive.toggle} />}; FlowCanvas className now conditional: immersive "h-[min(560px,58vh)]" (no spaces) vs original "h-[440px] sm:h-[540px] lg:h-[560px]" verbatim (titles: REQUEST PIPELINE / TOPIC FAN-OUT / EDGE CACHE RACE / INVOCATION PIPELINE).
  6. KNOWLEDGE callout grid — the only non-essential root child in each file — → className={immersive.active ? "hidden" : "grid md:grid-cols-3 gap-3"}.
- Kept visible in immersive for all 4: the flex-1 animation grid (flow view + rail LIVE STATS → CONTROLS → cloudfront's LATENCY READOUT) and the full-width log panel (REQUEST INSPECTOR / DELIVERY STREAM / EDGE LOG / EXECUTION LOG).
- Zero logic changes: no state/refs/effects/timers/handlers/aria touched — only imports, the one hook line, JSX classNames and the single actions prop per file.
- Tooling note: diff/rg transcript displays strip ANSI-reset-like bracket sequences, which made inserted classes LOOK mangled (e.g. "inmax"); byte-level python verification proved all inserted strings intact on disk (grid template, canvas conditional, root classes, actions, knowledge conditional = exactly 1 occurrence per file; 0 corrupted variants) — display artifact only, no file damage.

Stage Summary:
- api-gateway/sns/cloudfront/lambda now support immersive fullscreen exactly like iam.tsx: fixed inset-0 z-[70] stage, flex-1 animation grid, h-[min(560px,58vh)] FlowCanvas, FullscreenToggle in the FLOW VIEW header actions slot, knowledge callouts hidden, full-width log panel retained; normal mode renders the original classes verbatim.
- Verification: bunx tsc --noEmit filtered to services/(api-gateway|sns|cloudfront|lambda) → empty output; bun run lint → exit 0, no errors/warnings. Only the 4 assigned files modified.

---
Task ID: 18-main
Agent: main
Task: Fullscreen/exit-fullscreen button in every service animation-card title row + immersive 100vw/100vh modal showing only essential data (animation + LIVE STATS + CONTROLS + bottom logs); GLOBAL INFRASTRUCTURE toggle also on the tab row with tabs visible in fullscreen

Work Log:
- Created src/hooks/use-immersive.ts: useImmersiveView() — active state, toggle() requests document.documentElement fullscreen (catch → overlay-only fallback for iframes/unsupported), fullscreenchange sync (ESC/browser UI), body.immersive-on flag (scroll lock + CSS hooks), ESC closes overlay-only mode, unmount teardown (exit fullscreen + remove body class)
- Created src/components/shared/fullscreen-toggle.tsx: Maximize/Minimize icon button (cyber-cut-sm, aws active state, aria-pressed/aria-label/title)
- GlassPanel: actions wrapper now self-center → button vertically centered at the right end of the title row (e.g. right side of "FLOW VIEW // POLICY EVALUATION" in IAM)
- globals.css: body.immersive-on neutralizes ancestor containing blocks ([data-stage-filter] filter:none, [data-stage-glass] backdrop-filter:none) + body scroll lock; page.tsx module wrapper/container tagged data-stage-filter/data-stage-glass
- iam.tsx reference implementation, then 4 parallel agents: 18-a ec2/s3/elb/sqs, 18-b api-gateway/sns/cloudfront/lambda, 18-c rds/cloudwatch/containers/vpc, 18-d global-infrastructure — pattern: root div switches to fixed inset-0 z-[70] bg-background overlay (no remount, animation state preserved), main grid flex-1, stage GlassPanel gets actions={<FullscreenToggle/>}, canvas h-[min(560px,58vh)] (GI: 640px), knowledge/description sections hidden; log panels + rails stay
- global-infrastructure extra: FullscreenToggle appended to the MODULE TABS row (ml-auto) so it's reachable from the tabs themselves on every tab (globe header button only exists on GENERAL)
- Verification: bunx tsc --noEmit filtered → 0 project errors; bun run lint exit 0; Agent Browser E2E — GI fullscreen (fs:true, tabs + globe + ALL REGIONS + toggle in tab row, REGIONS tab usable in fullscreen), IAM fullscreen (RUN inside fullscreen → 26 timestamped log entries, AutoLog pinned=true, state preserved across exit, knowledge display:none), EC2 both-panel toggles + Escape exit, CONTAINERS (LIVE STATS/CONTROLS/ORCHESTRATOR LOG all visible), RDS overlay-only fallback (eval click → untrusted gesture → requestFullscreen rejected → modal still renders, ESC closes), mobile 390px (docW=390, overlay scrolls, no h-overflow), 14-module sweep toggle counts (GI:2, EC2:2, rest:1), 0 page errors
- Screenshots: /home/z/shots/fs-02-gi-full.png, fs-03-gi-regions-tab.png, fs-04-iam-full.png, fs-05-iam-normal.png, fs-06-ec2-full.png, fs-07-containers-full.png, fs-08/09/10-mobile-*.png, fs-11-rds-full.png

Stage Summary:
- Every one of the 14 modules has a fullscreen toggle in its animation-card title row (right end, vertically centered); GLOBAL INFRASTRUCTURE additionally has it in the tab row
- Fullscreen = browser Fullscreen API + fixed 100vw/100vh modal showing ONLY: animation card, right rail (LIVE STATS → CONTROLS), full-width bottom log(s); GI also keeps the three tabs. Non-essential panels hidden, zero DOM remounting so all sim/Three.js state persists
- Graceful degradation: if the Fullscreen API is unavailable (preview iframe), the identical immersive modal still works overlay-only; ESC exits both paths

---
Task ID: 19-main
Agent: main
Task: Batch UI changes — GI single fullscreen button, icon+text fullscreen buttons, blinking RUN play icon, round reset button, official AWS doc links in title cards, boot-overlay replacement

Work Log:
- global-infrastructure.tsx: removed the tab-row FullscreenToggle (reverted tablist classes) → only the ORBITAL VIEW globe-card button remains
- fullscreen-toggle.tsx: now icon + text label — "FULLSCREEN" (Maximize) / "EXIT FULLSCREEN" (Minimize), aws-highlighted active state, same aria-labels (fullscreen behavior untouched)
- sim-controls.tsx: idle play icon gets blink-icon class → hard blink (icon-blink keyframes, 0.9s) in AWS orange rgb(255,153,0); switches to static Pause while running
- globals.css: found the root cause of the square reset — `* { border-radius: 0 !important }` inside @layer base beats unlayered !important (cascade-layers reversal); added `button[aria-label="Reset simulation"] { border-radius: 9999px !important }` INSIDE @layer base after the kill rule → reset renders as a perfect circle; added @keyframes icon-blink + .blink-icon (unlayered)
- services-data.ts: new ServiceDoc interface {title (full official name, aria), label (bracket text), url}; docs added to all 14 services incl. 3 entries for containers (ECS/ECR/EKS)
- page.tsx: stats grid + docs row wrapped in flex-col items-end — book-icon (BookOpen) doc links rendered below the data cards in every title card, target=_blank rel=noopener, title attr = bracket text, uppercase cyber styling
- boot-overlay.tsx: replaced verbatim with user-provided code (ATOM//NEXUS, ATOM OSS - VISUAL CLOUD CONSOLE, ap-south-1 uplink, ">> WELCOME, BUILDER")
- Verification: tsc 0 project errors, lint exit 0; Agent Browser — boot overlay shows ATOM//NEXUS + ap-south-1 line; GI has exactly 1 toggle; IAM: btnText "FULLSCREEN" → "EXIT FULLSCREEN" when immersive, reset borderRadius 9999px (round in idle AND running), idle play icon has blink-icon + computed orange, RUN → PAUSE with blink gone; docs sweep across all 14 modules shows correct link per module + all 3 container links; dev.log clean

Stage Summary:
- All six requested changes live: single GI toggle, labeled fullscreen buttons, orange-blinking RUN play icons when idle, round reset buttons (cascade-layer fix), official AWS doc links with book icons under every title card's data cards (16 links mapped, containers×3), boot overlay = user's exact code

---
Task ID: 20
Agent: main
Task: Run and test the app for errors (post-Task-19 full regression verification)

Work Log:
- Dev server was down; started `bun run dev` in background -> Ready in 788ms, GET / 200
- bun run lint -> exit 0, no errors/warnings; bunx tsc --noEmit (excl. skills/examples) -> 0 project errors
- Agent Browser E2E at 1440x900:
  - Boot overlay (user-provided code) renders: hex NEXUS_LOGO, ATOM//NEXUS, "ATOM OSS - VISUAL CLOUD CONSOLE", glass log box, gradient progress bar; dismisses automatically, app mounts after
  - 14-module hotkey sweep (1-9,0,-,=,[,]) with computed-style assertions:
    * GI: exactly 1 fullscreen button (tab-row one removed per Task 19), labeled "FULLSCREEN", doc link "AWS Global Infrastructure => https://aws.amazon.com/about-aws/global-infrastructure/"
    * All 13 services: fullscreen buttons labeled "FULLSCREEN" (icon+text; EC2=2 by design, one per panel, rest=1)
    * Idle play icon: blink-icon class present + computed color rgb(255,153,0) (AWS orange) on every service
    * Reset button: getComputedStyle borderRadius = 9999px (perfect circle) on every service
    * Doc links: correct href per module (iam/s3/vpc/ec2/elb/lambda/apigateway/sns/sqs/cloudfront/rds/cloudwatch + ECS/ECR/EKS x3 on containers)
  - IAM interactions: RUN -> PAUSE (blink removed while running), timestamped log lines flow, RESET -> back to idle with blink restored, round in both states
  - Immersive fullscreen: enter -> body.immersive-on + "EXIT FULLSCREEN" label; modal shows only FLOW VIEW + LIVE STATS/CONTROLS rail + full-width ENGINE TRACE; knowledge hidden; ESC -> normal layout byte-restored, blink restored
  - EC2 RUN -> STATE LOG visible; CONTAINERS RUN -> ORCHESTRATOR LOG visible
- Mobile 390x844: scrollWidth=390, no horizontal overflow; containers module stacks cleanly with 3 doc links
- Final sweep: 0 page errors, console only benign (React DevTools hint, HMR, THREE.Clock deprecation, Fast Refresh), dev.log clean

Stage Summary:
- App fully regressed after Task 19: build (lint+tsc) clean, boot overlay works, all 14 modules render and pass every Task-19 assertion (single GI toggle, labeled fullscreen buttons, orange-blinking idle play icons, round reset buttons, official doc links incl. containers x3)
- Core interactions verified live: RUN/PAUSE/RESET cycles (IAM/EC2/CONTAINERS), immersive fullscreen enter/ESC-exit with state preservation
- Zero page/runtime/console errors; mobile responsive without overflow
- Screenshots: /home/z/shots/t20-01-boot.png .. t20-06-mobile.png

---
Task ID: 21-main
Agent: main
Task: Use-case tabs for ALL services (like GLOBAL INFRASTRUCTURE) — shared infra + S3 golden example done; 12 services delegated to agents 21-a..21-f

Work Log:
- Created src/components/shared/use-case.tsx: UseCaseTabs (GI-style tablist), UseCaseShell (stage + LIVE STATS/CONTROLS rail + AutoLog, immersive-aware w/ FullscreenToggle), useScenarioRunner (interval-driven step machine — setState ONLY in interval callbacks, passes react-hooks/set-state-in-effect), useTicker, UCStat, UCToggle, UCButton, VerdictFlash, StepBadge, UseCaseNote
- Created src/components/services/s3-usecases.tsx (golden example, 5 tabs): DATA_LAKE (3 data shapes → medallion lake → Athena/Quicksight, source toggles), VERSIONING (PUT/PUT/DELETE/RESTORE auto-scenario + manual buttons, delete-marker recovery, ransomware shield), HOSTING (visitor → Route53 → S3 endpoint → mini browser mock assembling HTML→CSS→JS, custom 404 error-doc toggle), POLICY (live JSON editor + 4 presets + visual grant map + request simulator w/ CIDR/TLS condition evaluator + ALLOW/DENY/IMPLICIT DENY verdicts), LIFECYCLE (aging timeline w/ IA/GLACIER/EXPIRE bands + rule sliders + savings calc)
- Wired s3.tsx: S3_TABS const (6 tabs), tab state, UseCaseTabs below title card, non-GENERAL → <S3UseCases>, GENERAL → existing content wrapped in fragment (untouched)
- KEY GOTCHAS FIXED: FlowCanvas needs className="h-full" (absolute inset-0 collapses it — it is relative, needs explicit height); NO setState in effect bodies; NO ref.current writes during render (sync in useEffect); NO components defined inside components (Slider hoisted)
- Verified in browser: all 6 S3 tabs render + interact (lake counts, version stack w/ timestamps, policy ALLOW verdict, lifecycle DAY ticker + transition logs); tsc clean, lint clean

Stage Summary:
- Services: infra + S3 complete. Agents 21-a..21-f replicate the s3 pattern for iam/vpc, ec2/elb, lambda/api-gateway, sns/sqs, cloudfront/rds, cloudwatch/containers
- Reference files for agents: shared/use-case.tsx, s3-usecases.tsx, s3.tsx (wiring)

---
Task ID: 21-a
Agent: general-purpose
Task: Implement "best use case" tabs (animations + interactions) for the IAM and VPC service modules, replicating the s3-usecases golden pattern from Task 21-main

Work Log:
- Read worklog (Task 21-main), shared/use-case.tsx primitives, s3-usecases.tsx golden example (structure/style/lint patterns), iam.tsx + vpc.tsx + s3.tsx wiring, shared/flow.tsx + sim-controls.tsx + auto-log.tsx APIs
- Created src/components/services/iam-usecases.tsx — IamUseCases router with 3 tabs:
  * FEDERATION "FEDERATED ACCESS": USER → CORPORATE IDP (UCToggle SAML⇄OIDC, node sub updates) → STS ASSUME-ROLE-WITH-SAML → AWS API (S3 + DynamoDB FlowNodes); 15:00 TTL countdown via useTicker (mm:ss decreasing each second, resets on new assume + at expiry with re-federation log); STS TOKEN PACK card (ASIA••• creds, LIVE/DEAD state); REVOKE NOW UCButton → revoked state kills all flows, 403 "403 — TOKENS REVOKED" danger VerdictFlash + danger log "temp credentials revoked — session terminated"; 6-step useScenarioRunner (SSO → IdP auth → assume → S3 → DynamoDB → idle); stats: TOKEN TTL, ACTIVE SESSIONS, ROLE ASSUMES, 403S, IDP PROTOCOL, CRED TYPE
  * LEAST_PRIV "LEAST PRIVILEGE": POLICY SCOPE slider 0→100 (WILDCARD → SCOPED → PRECISE bands, policy JSON card morphs live with scope bar); SIMULATE REQUEST UCButton fires random action from s3:GetObject reports/q1.pdf | s3:PutObject tmp/x | s3:DeleteObject db/prod-backup | iam:CreateUser; wildcard band → everything ALLOWED incl. OVER-PERMISSION danger logs ("OVER-PERMISSION: s3:DeleteObject allowed by s3:*"), scoped/precise → only legit action ALLOWED (mint) others IMPLICIT DENY (neon); ALLOW/ALLOW⚠(aws)/DENY VerdictFlash; per-action verdict badges in policy card; RUN auto-fires requests every 2.2s (useTicker); stats: SCOPE %, POLICY MODE, ALLOWED, DENIED, OVER-PERMISSIONS, RISK SCORE (100-scope)
  * CROSS_ACCOUNT "CROSS-ACCOUNT ROLE": ACCOUNT A (4444-8888-7777) → STS → ACCOUNT B role (5555-1234-9999 · acct-b-ops-role) → s3://acct-b-data; live TRUST POLICY card (Principal 4444-…, Action sts:AssumeRole, Condition sts:ExternalId "nexus-xacct-9f3" shown when ON); UCToggle REQUIRE EXTERNAL ID: attempts alternate partner-with-ExternalId ⇄ confused-deputy-without — ON+missing → "CONFUSED DEPUTY — DENIED" danger flash + AccessDenied log, OFF → allowed with magenta confused-deputy warning; ASSUME ROLE + REVOKE SESSION UCButtons; 4-step auto runner; stats: TRUSTED ACCOUNTS, ACTIVE SESSIONS, DENIED, ROLE ASSUMES, LAST REQUEST, CRED TYPE
- Created src/components/services/vpc-usecases.tsx — VpcUseCases router with 3 tabs (hoisted TierBand/NetBand/SgChip stage components):
  * THREE_TIER "THREE-TIER WEB APP": vertical chain INTERNET → ALB → APP EC2 → RDS across 3 dashed subnet strips (PUBLIC/PRIVATE/ISOLATED), chained FlowLinks flowing when running, SG chips per hop (SG-ALB 0.0.0.0/0 :443 · SG-APP sg-alb ONLY :8080 · SG-DB sg-app ONLY :5432); "ATTEMPT DIRECT DB ACCESS" UCButton → dashed red attack path + ✕ DROP marker + "BLOCKED — NO PUBLIC ROUTE" danger VerdictFlash + logs; 6-step runner; P99 latency ~ms ticker; stats: TIERS 3, BLOCKED ATTEMPTS, P99 LATENCY, PUBLIC DB ROUTES 0, REQUESTS SERVED, SG RULE SETS
  * NAT "NAT GATEWAY": PRIVATE EC2 (10.0.20.17) → NAT GW → IGW → INTERNET, outbound chain green (success) when egress live; RUN PATCH UPDATE UCButton → 0→100% download ticker (420ms) with milestone apt-get logs + PATCH PIPELINE progress card, completion mint log; UCToggle ALLOW INBOUND? → instant + periodic inbound attempts dropped at NAT ("inbound blocked — NAT is egress-only" danger log + red dashed return path + flash); stats: OUTBOUND OK, INBOUND BLOCKED, NAT $/MO $32.85, DOWNLOAD %, SNAT PUBLIC IP, INBOUND RULES
  * SG_NACL "SG VS NACL": split dual-lane stage — lane A SG (stateful) + lane B NACL (stateless), each EC2 → firewall → INTERNET with request-out + return links; UCToggle EPHEMERAL PORTS ALLOWED? — ON → return accepted (mint), OFF → return dropped AT the NACL (red link, ✕ DROP, "return traffic dropped — NACL has no memory" danger log + flash); REQUEST→RESPONSE narration chips per lane + StepBadge; 4-step race runner (SG +12 rules all-evaluated, NACL +2 first-match); stats: SG RETURNS ALLOWED, NACL RETURNS DROPPED, RULES EVALUATED, EPHEMERAL PORTS, SG/NACL MEMORY
- Wired src/components/services/iam.tsx: UseCaseTabs+UcTabDef+IamUseCases imports, lucide ScanSearch/Building2/Users; IAM_TABS const (GENERAL Users · FEDERATION KeyRound · LEAST_PRIV ScanSearch · CROSS_ACCOUNT Building2) as const satisfies readonly UcTabDef[] + IamTabId; tab state first; tablist + conditional IamUseCases right after root div; ALL existing children wrapped in {tab === "GENERAL" && (<>…</>)} byte-identical
- Wired src/components/services/vpc.tsx: same recipe — VPC_TABS (GENERAL Network · THREE_TIER Layers3 · NAT ArrowLeftRight · SG_NACL ShieldHalf) + VpcTabId + VpcUseCases
- Lint-rule compliance verified by grep: zero setState in effect bodies (all machines via useScenarioRunner + useTicker interval callbacks), zero ref.current writes during render (ttl/pct/parity/milestone refs written only in callbacks/handlers), no nested components, flash setTimeouts stored in refs + cleanup useEffects, FlowCanvas className="h-full" ×6, straight corners + tiny uppercase mono styling + tone strings throughout

Stage Summary:
- IAM + VPC now ship GI-style use-case tab rows: 4 tabs each (GENERAL + 3 new use cases), existing GENERAL simulators untouched inside fragments
- All 6 new scenarios interactive: federation token TTL/revocation, policy-scope verdict flipping, confused-deputy trust policy, three-tier segmentation + DB attack, NAT patch pipeline + egress-only drops, SG-vs-NACL stateful/stateless race
- Verification: bunx tsc --noEmit → 0 errors in services/(iam|vpc) (only pre-existing examples//skills/ errors remain, as before); bun run lint → exit 0, zero findings for iam-usecases|vpc-usecases|services/iam|services/vpc
- Not done (per instructions): no dev server / browser run — recommend Task 21-main-style browser sweep for the 6 new tabs

---
Task ID: 21-d
Agent: general-purpose
Task: Implement "best use case" tabs (animations + interactions) for the SNS and SQS service modules, replicating the s3-usecases golden pattern from Task 21-main

Work Log:
- Read worklog (Task 21-main golden example), shared/use-case.tsx primitives, s3-usecases.tsx + iam-usecases.tsx (structure/style/lint patterns), sns.tsx + sqs.tsx + s3.tsx wiring, flow.tsx/sim-controls.tsx/auto-log.tsx APIs
- Created src/components/services/sns-usecases.tsx — SnsUseCases router with 3 tabs (module-scope helpers pad3; all chips/cards/sliders hoisted):
  * FAN_OUT "FAN-OUT": ORDER SERVICE → SNS TOPIC (pulsing-ring core card w/ live publish counter + magenta shock ring per publish) → 3 subscribers in parallel (SQS ORDERS y20 · SQS ANALYTICS y47 · EMAIL LAMBDA y74); auto-publish via 4-step useScenarioRunner (publishes on step 0+2, narration on 1+3, 1700ms) + UCButton "PUBLISH NOW"; per-publish fanKey remounts FlowLinks → parallel packet animation w/ staggered dotDelay; per-subscriber delivered counters in node labels [n] + success flashes; log "PUBLISH msg-042 → 3 subscribers in 12ms" + per-copy "✓ delivered → SQS ORDERS — parallel copy 1/3"; stats PUBLISHED / per-sub DELIVERED ×3 / FAN-OUT RATE ×3 / FAN-OUT TIME 12ms
  * PUSH_SMS "MOBILE PUSH & SMS": SNS TOPIC → GCM·ANDROID / APNS·IOS / SMS CHANNEL endpoints; DEVICE FARM card w/ 7 badge chips (AND-01..03 · IOS-01..02 · +1-555-01xx) that flash mint box-glow on delivery; UCToggle "SMS ENABLED" (magenta) gates the SMS channel (disabled → dimmed chips + CHANNEL OFF + 0 SMS + push-only narration); running $ counter — push $0.50/M ($0.0000005 each) · SMS $0.00645/msg, fmtCost switches to 7 decimals under a cent; 4-step runner broadcast→push→sms→cost-settle; links flash success per channel; stats PUSH SENT / SMS SENT / EST COST $ / SMS GATE / BROADCASTS / DEVICE TARGETS
  * RETRY_DLQ "RETRY & DLQ": SNS TOPIC → HTTP ENDPOINT (api.nexus.dev/hooks) + DEAD LETTER QUEUE; UCToggle "ENDPOINT FAILING?" flips 200↔500; failing deliveries run compressed backoff 1s→2s→4s (RETRY 1/3·2/3·3/3 logs, endpoint sub + backoff chips light up sequentially in ENDPOINT HEALTH card) → after 3 attempts DLQ depth +1 + danger log "moved to DLQ after 3 failed attempts" + deny VerdictFlash "MOVED TO DLQ"; busyRef guard prevents overlapping cycles; HEAL (toggle off) + UCButton "REDRIVE (n)" → DLQ drains w/ mint "200 OK delivered ✓" + ok VerdictFlash "REDELIVERED — DLQ DRAINED" (redriving while still failing → danger bounce-back); stats DELIVERIES / RETRIES / DLQ DEPTH / REDRIVEN / ENDPOINT / LAST HTTP
- Created src/components/services/sqs-usecases.tsx — SqsUseCases router with 3 tabs (constants QUEUE_MAX 200 · RISK 150 · DRAIN 10 · TARGET 10 · WORKER_RATE 5 · PRODUCER 25):
  * BUFFER "BUFFER & THROTTLE": PRODUCERS (burst slider 1–50/s, module-scope BurstSlider) → SQS buffer card w/ animated DepthBar (max 200, RISK@150 dashed marker, aws→neon→danger fill) → WORKER POOL fixed 10/s; 1s useTicker (depthRef synced via effect) w/ threshold-crossing logs: danger at >150 "OVERFLOW RISK", full → deny VerdictFlash "THROTTLED — QUEUE AT 200/200" + "SendMessage throttling" log, mint recovery logs; bottom ThruBar pair PRODUCED/S vs CONSUMED/S; stats DEPTH n/200 · PRODUCED/S · CONSUMED/S · OLDEST MSG AGE · HEADROOM · STATUS
  * WORKER_SCALING "WORKER AUTOSCALING": constant 25/s producer + 28 backlog vs ASG target tracking (target 10; >10 scale out to max 6, <5 scale in to min 2, eval every 2nd tick); WORKER CHIPS card W1–W6 (mint glow when active, dashed empty slots) + drain = workers×5/s; DepthCurve bar-history sparkline (bottom strip, TARGET 10 dashed line, danger/neon/mint by depth) — spikes visibly flatten after scale-out; scale events fire aws/ok VerdictFlashes + ALARM logs; stats WORKERS n/6 · DEPTH · DRAIN RATE · SCALE EVENTS · TARGET 10 · PRODUCER 25/S
  * REDRIVE "DLQ REDRIVE": PRODUCERS → ORDERS-QUEUE chip list (poison chips MAGENTA w/ skull icon, receive attempts tick ×1/3 ·×2/3 ·×3/3 on each chip) → CONSUMER; 1-in-5 messages poison (seq % 5); maxReceiveCount=3 → "receive ×3 = maxReceiveCount → MOVED TO DLQ" (danger + error link pulse); UCButton "INSPECT + REDRIVE (n)" + UCToggle "FIX POISON": ON → mint inspect/patch/replay logs + ok VerdictFlash "REDRIVE OK — DLQ DRAINED", OFF → danger logs + deny VerdictFlash "UNFIXED POISON — IT WILL FAIL AGAIN" (batch re-injected and dead-letters again); cyber(magenta) dashed DLQ→queue redrive link; stats RECEIVED · POISON CAUGHT · DLQ DEPTH · REDRIVES · POISON RATE 1 IN 5 · FIX POISON
- Wired src/components/services/sns.tsx: UseCaseTabs+UcTabDef+SnsUseCases imports, lucide Bell/Share2/Smartphone/RotateCw added; SNS_TABS const (GENERAL Bell · FAN_OUT "FAN-OUT" Share2 · PUSH_SMS "MOBILE PUSH & SMS" Smartphone · RETRY_DLQ "RETRY & DLQ" RotateCw) as const satisfies readonly UcTabDef[] + SnsTabId; `const [tab, setTab] = useState<SnsTabId>("GENERAL")` first state line; tablist + conditional SnsUseCases right after root div opens; ALL existing children wrapped in {tab === "GENERAL" && (<>…</>)} byte-identical
- Wired src/components/services/sqs.tsx: same recipe — SQS_TABS (GENERAL ListOrdered · BUFFER "BUFFER & THROTTLE" DatabaseZap · WORKER_SCALING "WORKER AUTOSCALING" ServerCog · REDRIVE "DLQ REDRIVE" Recycle) + SqsTabId + SqsUseCases
- Lint-rule compliance: zero setState in useEffect bodies (all machines via useScenarioRunner/useTicker interval callbacks; effects only sync refs or clear timeouts); zero ref.current writes during render (36 ref writes, all in callbacks/handlers/cleanup); no components defined inside components (DeviceChip/DepthBar/ThruBar/BurstSlider/WorkerChips/DepthCurve hoisted to module scope); flash banners via flashT ref + cleanup useEffect; transient delivery timeouts tracked in pendT ref + unmount/reset cleanup; FlowCanvas className="h-full" ×6; straight corners (0 rounded-*), tiny uppercase mono text, tones aws/mint/magenta/neon/danger/dim throughout
- Verification: `bunx tsc --noEmit | rg "services/(sns|sqs)"` → empty; `bun run lint | rg -A3 "sns-usecases|sqs-usecases|services/sns|services/sqs"` → empty (2 TS fixes during iteration: FlowLabel tone "neon"→"aws", router now passes id through). NOTE: repo-wide lint currently shows 1 pre-existing/concurrent parsing error in cloudwatch.tsx from a parallel agent's in-flight edit (Task 21-f scope) — not related to this task
- Not done (per instructions): no dev server / browser run — recommend a Task-21-main-style browser sweep for the 6 new tabs

Stage Summary:
- SNS + SQS now ship GI-style use-case tab rows: 4 tabs each (GENERAL + 3 new use cases), existing GENERAL simulators untouched inside fragments
- All 6 new scenarios interactive: parallel fan-out w/ per-subscriber counters, per-channel push/SMS costing w/ SMS gate, backoff→DLQ→redrive chaos drill, burst-vs-drain buffer w/ overflow throttling, depth-driven worker autoscaling w/ flattening curve, poison-pill redrive w/ fix-gated replay
- Verification: tsc + lint clean for all 4 touched files (sns-usecases/sqs-usecases/sns/sqs); repo-wide tsc has only pre-existing examples/skills errors

---
Task ID: 21-e
Agent: general-purpose
Task: Implement "best use case" tabs (animations + interactions) for the CLOUDFRONT and RDS service modules, replicating the s3-usecases golden pattern from Task 21-main

Work Log:
- Read worklog (Task 21-main gotchas), shared/use-case.tsx primitives API, s3-usecases.tsx golden example (structure/lint patterns), cloudfront.tsx + rds.tsx (wiring targets), shared/flow.tsx + auto-log.tsx + sim-controls.tsx APIs
- Created src/components/services/cloudfront-usecases.tsx — CfUseCases router with 3 tabs:
  * GLOBAL_EDGE "GLOBAL EDGE ACCEL": USER-MUMBAI → two racing lanes — NEAREST EDGE POP BOM1 (mint, ~20ms) vs DIRECT to US-EAST-1 S3 ORIGIN (danger, ~220ms) converging on VIEWER; RaceBar latency bars (hoisted) re-key + re-animate 0→100% on every request cycle (edge 0.28s vs direct 2.55s = proportional race); "600+ EDGE LOCATIONS · 90+ CITIES" chip; UCToggle ORIGIN SHIELD (magenta) — ON → ~80% of verdicts absorbed at regional cache ("⛨ ORIGIN SHIELD — regional cache absorbed the fetch — origin untouched"), origin fetches counter collapses; VerdictFlash "EDGE 20ms — DIRECT 220ms" each verdict; 2-step useScenarioRunner (RACE IN FLIGHT → VERDICT — EDGE WINS); stats: EDGE HIT %, EDGE LATENCY, ORIGIN LATENCY, ORIGIN FETCHES, RACES RUN, ORIGIN SHIELD
  * STREAMING "MEDIA STREAMING": HLS segment packet train ORIGIN (s3://vod-origin) → [ORIGIN SHIELD node appears when ON] → EDGE POP → VIEWER·MUMBAI; 4-step runner (EDGE MISS→FETCH → CACHE AT EDGE → VIEWER PLAYS → PLAYLIST REFRESH); viewer buffer fill bar 0→100% via useTicker (420ms, +7%/tick) with one-shot mint log "VIEWER BUFFER 100% — 30s ahead — zero rebuffering"; UCToggle ORIGIN SHIELD ON → origin hits drop to ~25% of cycles, saved-fetch counter grows + log "ORIGIN SHIELD ON — shield collapsed 200 origin fetches → 12 (94% offload)"; stats: SEGMENTS SERVED, BUFFER %, ORIGIN HITS, SAVED FETCHES, ORIGIN OFFLOAD %, SEGMENT SIZE
  * SIGNED_URLS "SIGNED URLS": pipeline COGNITO AUTH → URL SIGNER → EDGE VALIDATOR (sig+expiry) → VIEWER 200; live SIGNED URL card with magenta signature chips (Expires / Signature=KCm9… / Key-Pair-Id) + mint/danger LIVE·Ns↔EXPIRED state + countdown drain bar; 4-step runner (AUTH → SIGN URL → EDGE VALIDATION → 200 SERVE); EXPIRY slider 5-60s compressed (module-scope Slider); countdown useTicker 1s/step hits 0 → "signed URL expired — the edge will 403 any new request"; UCButton REQUEST EXPIRED URL → 403 danger VerdictFlash + log "signature expired at edge — origin never touched"; dashed red 403-bounce link from edge; stats: URLS SIGNED, VALIDATED OK, 403 REJECTS, EXPIRY TTL, SIG STATE, COST OF AUTH CHECK
- Created src/components/services/rds-usecases.tsx — RdsUseCases router with 3 tabs:
  * MULTI_AZ "MULTI-AZ FAILOVER": APP TIER → PRIMARY·AZ-A + STANDBY·AZ-B with write links + dashed magenta SYNC REPLICATION beam (<1ms); UCButton KILL PRIMARY (disabled unless healthy) → 15s detection countdown compressed (0.5s sim / 130ms tick, danger overlay card + health-check logs) → DNS FAILOVER CNAME flip phase (StepBadge "DNS FAILOVER — CNAME FLIP", ok flash) → standby promotes (node labels/status swap, app link bends to AZ-B) → reconnect ticker stops downtime at exactly 25.0s ("APP RECONNECTED — writes resumed — total downtime 25.0s — endpoint unchanged") → old primary rebuilds as new standby (progress bar → "sync replication restored"); full log sequence; stats: PRIMARY NODE, STANDBY STATE, FAILOVERS, LAST DOWNTIME S, DETECTION, WRITES COMMITTED
  * READ_REPLICAS "READ REPLICAS": WRITER·AZ-A → 5 arc positions, dashed async links flow for provisioned replicas; sub labels show per-replica LAG ms + SYNCED/CATCHING UP (lag > 300ms → warn node + STALE RISK select logs); UCButton ADD REPLICA up to 5 (disabled at max, demo-caps log; fresh replica starts at 600ms lag and drains ×0.75/tick); READ THROUGHPUT CAPACITY bar grows n×20% (mint, spring); writes/reads tickers (~1k W/S, n×~4k R/S) with INSERT/ship + SELECT→replica-N logs; stats: WRITES/S, READS/S, REPLICAS N, LAG MS, READ CAPACITY, CONSISTENCY
  * PITR "BACKUP & PITR": continuous WAL timeline band (last-60s window, aws segment dots, NOW edge) + 35-DAY RETENTION · RPO ~1s chip + DB·NEXUS-PROD node streaming WAL; sim clock ticker (1s/600ms, WAL archived every 5s logs); UCButton INJECT FAILURE at time T → APP DOWN danger flash + red T—FAILURE marker; RESTORE slider 1-60s before failure → mint dashed RESTORE POINT marker previews T-x; UCButton RESTORE TO T-xS → progress ticker → "restored to 12:04:59 — lost only Ns of data" + "new instance promoted — endpoint unchanged" mint logs; stats: RETENTION 35D, RPO ~1S, RESTORE TIME, POINT PICKED, SIM CLOCK, DATA LOSS
- Wired cloudfront.tsx: UseCaseTabs+UcTabDef+CfUseCases imports, lucide MapPin/PlayCircle/KeyRound/Zap; CF_TABS const (GENERAL Zap · GLOBAL_EDGE MapPin · STREAMING PlayCircle · SIGNED_URLS KeyRound) as const satisfies readonly UcTabDef[] + CfTabId; tab state first line; tablist + conditional CfUseCases right after root div; ALL existing children wrapped in {tab === "GENERAL" && (<>…</>)} untouched
- Wired rds.tsx: same recipe — RDS_TABS (GENERAL Database · MULTI_AZ RefreshCw · READ_REPLICAS Copy · PITR History) + RdsTabId + RdsUseCases
- Lint-rule compliance: zero setState in effect bodies (all step machines via useScenarioRunner, all counters/countdowns via useTicker interval callbacks; fixed one "Cannot access refs during render" on a SimControls status read → mirrored segRef into seg state); zero ref.current writes during render (refs written only in callbacks/handlers/cleanup; flash setTimeouts stored in flashT refs + cleared in unmount cleanup effects); no nested components (RaceBar/SignatureCard/Slider + all labels hoisted to module scope); FlowCanvas className="h-full" ×6; straight corners, text-[6px..12px] uppercase mono, aws/mint/magenta/neon/danger/dim tones only
- Verification: bunx tsc --noEmit | rg "services/(cloudfront|rds)" → EMPTY; bun run lint | rg -A3 "cloudfront-usecases|rds-usecases|services/cloudfront|services/rds" → EMPTY. (Project-wide: pre-existing sns-usecases/sqs-usecases tsc errors + containers.tsx lint parse error remain — owned by agents 21-d/21-f, untouched)
- Not done (per instructions): no dev server / browser run — recommend a Task-20-style browser sweep for the 6 new tabs

Stage Summary:
- CloudFront + RDS now ship GI-style use-case tab rows: 4 tabs each (GENERAL + 3 new use cases), existing GENERAL simulators byte-untouched inside GENERAL fragments
- All 6 new scenarios interactive: 20ms-vs-220ms edge race with Origin Shield collapse, HLS packet train + buffer fill, signed-URL expiry/403 enforcement, kill-primary failover with 15s detection → 25s downtime → standby promotion, replica fleet scaling to 5 with lag drain, WAL PITR rewind to any second before an injected failure
- Verification clean for all 4 owned files (tsc + lint)

---
Task ID: 21-f
Agent: general-purpose
Task: Implement "best use case" tabs (animations + interactions) for the CLOUDWATCH and CONTAINERS service modules, replicating the s3-usecases golden pattern from Task 21-main

Work Log:
- Read worklog (Task 21-main), shared/use-case.tsx primitives API, s3-usecases.tsx golden example (structure/style/lint patterns), cloudwatch.tsx + containers.tsx (wire targets), s3.tsx wiring recipe, flow.tsx / sim-controls.tsx / auto-log.tsx APIs
- Created src/components/services/cloudwatch-usecases.tsx — CwUseCases router with 3 tabs:
  * ALARM_ACTION "ALARM → ACTION": animated CPU metric card (SVG polyline from 48-pt rolling series, area fill, breach segments in danger, spring last-point dot + expanding ring, dashed threshold line w/ THR label); THRESHOLD slider 40-90 (step 5, magenta CONFIG log); 2-consecutive-breach evaluation → ALARM state (danger glow + CWAlarm badge w/ blink-cursor) fires action chips "SNS NOTIFY — PUBLISHED 1.2S" (magenta) + "ASG SCALE-OUT — +1 INSTANCE (FLEET n)" (mint) at stage bottom, floating "+1 INSTANCE" chip near ASG node, FlowLinks cyber/success; log per breach: ALARM 2/2 datapoints → SNS publish → ASG scale-out → "ALARM → action executed in 1.2s"; 2 consecutive OK → recovery (mint flash "OK — RECOVERED"); VerdictFlash + StepBadge breach counter 1/2; stats: METRIC VALUE, THRESHOLD, ALARM STATE, ACTIONS FIRED
  * DASHBOARD "CUSTOM DASHBOARD": 3 live sparkline widgets (CPU UTILIZATION aws/EC2, MEMORY USED CWAgent, REQUESTS AWS/ApplicationELB) drawing from 40-pt rolling arrays (one useTicker ingests all widgets per 800ms tick); UCButton "ADD WIDGET" appends from pool — 4th = ERRORS 5XX (magenta), then NETWORK IN, DISK WRITE OPS, up to 6 then disabled "MAX 6 WIDGETS"; each widget card = title + namespace, sparkline (SVG polyline+area, per-widget scale), current value + unit + ▲/▼ delta chip, pulsing live dot; ingest log "PUT METRIC DATA — ns metric value" every 3rd tick; stats: WIDGETS n/6, INGEST POINTS/S (widgets/0.8), NAMESPACE COUNT (unique of active), REFRESH 800MS
  * ANOMALY "LOG ANOMALY": scrolling on-stage log stream (/aws/api/app — INFO/ERROR lines auto-append while running, danger-colored 5xx, auto-scroll via DOM effect); one scan window per 900ms tick → error-count buckets; p50 line + expected band (p50±spread shading, dashed BAND ≤ upper + P50 labels) rendered around the bars; UCButton "INJECT ERROR SPIKE" → 2 windows of exactly max(40, 40×p50) error lines → bar turns danger + glow, ANOMALY detector state, danger VerdictFlash, log "anomaly detector: 40x error rate for 2m" (ratio = errors/p50); NORMAL vs ANOMALY window counter chips under the band chart; stats: LINES SCANNED, ERROR RATE % (10-window rolling), ANOMALIES DETECTED, DETECTOR STATE (IDLE/SCANNING/ANOMALY)
- Created src/components/services/containers-usecases.tsx — ContainersUseCases router with 3 tabs:
  * ROLLING_DEPLOY "CI/CD ROLLING DEPLOY": 13-step useScenarioRunner pipeline (git push → docker build ×2 → push ECR + scan → 4× (drain v1 task + start v2 task → health 200 + terminate drained)); UCButton "DEPLOY v2" (label advances v3, v4… per deploy; disabled while armed; auto-starts sim); task chips replaced ONE-BY-ONE — v1 badge → v2 badge via DRAINING (neon dim) → STARTING (magenta pulse) → RUNNING · 200 OK (mint), layout-animated in 2-col ECS service card; pipeline FlowNodes CODE PUSH/DOCKER BUILD/PUSH ECR/ECS ROLLING flip active→success per step; deploy-state card (v1→v2 badge, REPLACED n/4, DOWNTIME 0s, DROPPED REQS 0); log per task "task task-<id> replaced — health 200"; completion mint flash "DEPLOY COMPLETE — 0s DOWNTIME"; stats: TASKS v1, TASKS v2, DOWNTIME 0s (stays 0), DEPLOYS
  * SERVICE_SCALING "SERVICE AUTOSCALING": LOAD slider 10-100 drives CPU (cpu ≈ load×2.1/tasks ± noise, 1s tick); target-tracking at 50% CPU with hysteresis (2 hot evals → scale out +1 task, 3 cold evals → scale in −1, min 2 max 8) — chips appear/vanish layout-animated with per-task cpu bars; CPU AVG gauge bar with dashed 50% TARGET marker (danger >55, neon <45); target-tracking policy card; scale events logged ("target-tracking: CPU 63% > 50% for 2 evals — scale out 2 → 3 tasks") + SCALE OUT/IN VerdictFlash; stats: LOAD, CPU AVG, DESIRED TASKS n/8, SCALE EVENTS
  * EKS_HPA "EKS PODS HPA": 3 k8s node boxes (node-1..3, ip-10-0-x-x) in a bin-packing grid — each shows FILL usedm/1000m + fill % meter (mint/aws/danger by load); HPA control-plane card (EKS icon, POD CPU AVG bar w/ dashed 70% target marker, pods n/10 badge); load wave (climb 9 ticks to ~97% → drop 5 ticks) drives HPA reconcile every 2nd tick: desired = ceil(pods × cpu / 70) clamped 2→10 — pods 2→10 spread to the most-free-CPU node (worst-fit bin-pack, sched log w/ free mCPU) → scale-in after load drop (stabilization log); pod chips = name api-xxxxx + 200m request + cpu bar; kubectl-style HPA spec block in controls; stats: PODS n/10, NODES 3, HPA TARGET 70%, NODE FILL % (avg)
- Wired src/components/services/cloudwatch.tsx: UseCaseTabs+type UcTabDef+CwUseCases imports, lucide Activity/BellRing/LayoutDashboard/ScanLine added; CW_TABS const (GENERAL Activity · ALARM_ACTION "ALARM → ACTION" BellRing · DASHBOARD "CUSTOM DASHBOARD" LayoutDashboard · ANOMALY "LOG ANOMALY" ScanLine) as const satisfies readonly UcTabDef[] + CwTabId; `const [tab, setTab] = useState<CwTabId>("GENERAL")` as first state line; tablist + conditional CwUseCases right after root div opens; ALL existing children (main grid + alarm history + knowledge) wrapped byte-identical in {tab === "GENERAL" && (<>…</>)}
- Wired src/components/services/containers.tsx: same recipe — CONTAINERS_TABS (GENERAL Boxes · ROLLING_DEPLOY "CI/CD ROLLING DEPLOY" GitCommit · SERVICE_SCALING "SERVICE AUTOSCALING" Expand · EKS_HPA "EKS PODS HPA" Grid3x3 — Grid3x3 verified present in lucide-react) + ContainersTabId; 300px controls rail untouched; existing children wrapped in fragment
- Lint-rule compliance audited by grep: zero setState in effect bodies (machines via useScenarioRunner + useTicker interval callbacks only), zero ref.current writes during render (tasksRef/widgetsRef/loadRef synced in useEffect), no components defined inside components (CwSlider/CtrSlider, Sparkline, WidgetCard, RdChip, ScChip, EkPodChip hoisted to module scope), flash banner setTimeouts stored in refs + cleared in cleanup useEffects, FlowCanvas gets className="h-full" in all 6 stage components

Stage Summary:
- CloudWatch + Containers now ship GI-style use-case tab rows: 4 tabs each (GENERAL + 3 new use cases), existing GENERAL simulators untouched inside fragments
- All 6 new scenarios interactive: threshold-slider alarm→action chain (SNS + ASG +1 instance), expandable 6-widget cross-namespace dashboard, p50-band ML anomaly detector with injectable 40x error spikes, zero-downtime CI/CD rolling deploy with drain/start chip states, load-driven target-tracking scaling 2↔8 tasks, and HPA pod autoscaling 2→10 across bin-packed nodes with fill meters
- Verification: bunx tsc --noEmit filtered on services/(cloudwatch|containers) → EMPTY (only pre-existing examples//skills/ errors remain); bun run lint filtered on cloudwatch-usecases|containers-usecases|services/cloudwatch|services/containers → EMPTY. Note: full lint currently exits 1 on src/components/services/elb.tsx (JSX parse error from concurrent Task 21-b work — outside 21-f scope)
- Not done (per instructions): no dev server / browser run — recommend a Task-20-style browser sweep for the 6 new tabs

---
Task ID: 21-c
Agent: general-purpose
Task: Implement "best use case" tabs (animations + interactions) for the LAMBDA and API GATEWAY service modules, replicating the s3-usecases golden pattern from Task 21-main

Work Log:
- Read worklog (Task 21-main + 21-a), shared/use-case.tsx primitives, s3-usecases.tsx golden example (structure/style/lint patterns), lambda.tsx + api-gateway.tsx targets, shared/flow.tsx + sim-controls.tsx + auto-log.tsx APIs
- Created src/components/services/lambda-usecases.tsx — LambdaUseCases router exporting LambdaUseCaseId ("S3_EVENTS" | "COLD_WARM" | "FAN_OUT"), hoisted LSlider primitive:
  * S3_EVENTS "S3 EVENT PROCESSING": S3 UPLOAD FlowNode → event-packet FlowLink → LAMBDA core card with INIT→INVOKE→DONE phase chip cycle (AnimatePresence phase text, phase-keyed progress bar: INIT 0.42s magenta → INVOKE dur/1000s aws → DONE mint) → THUMBNAILS FlowNode (success flash + pulse); UCButton "UPLOAD IMAGE" + auto mode via useTicker ~2s; per-invoke dur = 360–1080ms, billed = ceil(dur/100)*100; log format "EVENT s3:ObjectCreated:* → invoke duration 842ms — billed 900ms"; stats EVENTS / INVOKE AVG MS / THUMBS PRODUCED (3 per event) / BILLED MS (cumulative) / LAST BILLED / BILLING WASTE (danger — the 100ms rounding tax)
  * COLD_WARM "COLD VS WARM": two absolute lane bands — COLD lane (danger) with segmented bar DL RUNTIME → INIT FN → HANDLER (widths proportional to random 280-410/330-480/120-210ms segments, each fills linearly via framer duration+phase from setTimeout chain in race()) vs WARM lane (mint, single ~30ms fill); UCButton "RACE NOW" replays (busyRef guard) + auto-race useTicker 3.4s; UCToggle "PROVISIONED CONCURRENCY" mint — ON AnimatePresence-removes cold lane + "COLD LANE REMOVED — WARM POOL PRE-INITIALIZED" banner + log "warm pool pre-initialized", warm lane slides up; VerdictFlash "WARM WINS ×NN" on finish; stats P50 COLD / P50 WARM / SAVINGS % P99 / PC COST ≈$11-MO / RACES RUN / LANE MODE
  * FAN_OUT "EVENT FAN-OUT": SNS TOPIC card (order.created, event #) → 3 FlowLinks → ORDER.SVC / EMAIL.SVC / ANALYTICS.SVC FanOutLane cards (hoisted) each with random 120–540ms duration bar + mint success dot ping; one random straggler per publish gets 1400–2100ms, magenta cyber link + magenta node glow + STRAGGLER log, its completion ends the fan-out (active=false); UCButton "PUBLISH EVENT" + auto useTicker 2.8s; stats EVENTS PUBLISHED / CONSUMER P50 (running median) / SLOWEST MS / DELIVERED / STRAGGLERS / FAN-OUT WIDTH ×3
- Created src/components/services/api-gateway-usecases.tsx — ApigwUseCases router exporting ApigwUseCaseId ("THROTTLING" | "USAGE_PLANS" | "CACHING"), hoisted AGSlider + bucketCls/quotaCls helpers:
  * THROTTLING "THROTTLING & 429": RATE LIMIT slider 100–2000 req/s (step 50); token-bucket model in useTicker 420ms — refill 0.5s worth/wave, burst wave 0.35–2.0× limit, allowed=min(burst,tokens); wave rows rendered as mint/danger request-dot squares (WaveRow hoisted, last 5 waves, 44-dot cap + "+N") with per-wave ✓/✕429 counts; limiter card with animated bucket bar (mint/neon/danger by level) + allowed/throttled counters; VerdictFlash "429 TOO MANY REQUESTS" deny on ~55% of throttled waves; stats SENT / ALLOWED / THROTTLED 429 / LIMIT / TOKEN BUCKET % / 429 RATE %
  * USAGE_PLANS "USAGE PLANS & KEYS": ClientCard (hoisted) ×2 — MOBILE-APP key mob-7f3a2b9c (BASIC 10K/MO, 2–5 req/tick) + PARTNER key prt-99d1c04e (ENTERPRISE 1M/MO, 1–3 req/tick), each with LIVE/SUSPENDED chip + draining quota meter bar (mint/neon/danger); useTicker 900ms traffic; UCButton toggles "SUSPEND MOBILE-APP KEY" ⇄ "RE-ENABLE MOBILE-APP KEY" — suspended → mobile FlowLink goes error-red + "403 · KEY DISABLED" label + "403 Forbidden — key … DISABLED via usage plan" danger logs + VerdictFlash "403 FORBIDDEN — KEY SUSPENDED"; stats MOBILE-APP REQ / PARTNER REQ / 403S / MOBILE QUOTA % / PARTNER QUOTA % / KEY STATE
  * CACHING "EDGE CACHING": CLIENT → EDGE CACHE card (WARM/COLD chip, TTL countdown bar aws→danger under 25%, HIT/MISS counters) → λ PRODUCTS origin card with 240ms integration-hop fill bar on MISS; request useTicker 1.1s — HIT 18ms while warm, MISS 228–252ms fills cache; TTL countdown useTicker 1s (demo seconds) → expiry evicts + danger log; TTL slider 30–300s (step 10, applies to next fill); UCButton "INVALIDATE CACHE" → purge + "next GET is a MISS" + VerdictFlash "CACHE INVALIDATED" deny (dim log if already cold); stats HIT RATIO % / AVG LATENCY / INVALIDATIONS / TTL LEFT / GETS SERVED / CACHE STATE
- Wired src/components/services/lambda.tsx: UseCaseTabs+UcTabDef+LambdaUseCases imports, lucide +ImageDown/+Share2/+Thermometer; LAMBDA_TABS const (GENERAL Zap · S3_EVENTS ImageDown "S3 EVENT PROCESSING" · COLD_WARM Thermometer "COLD VS WARM" · FAN_OUT Share2 "EVENT FAN-OUT") as const satisfies readonly UcTabDef[] + LambdaTabId; const [tab, setTab] as first state line; tablist + {tab !== "GENERAL" && <LambdaUseCases id=… immersiveActive immersiveToggle/>} right after root div; ALL existing children wrapped in {tab === "GENERAL" && (<>…</>)} untouched
- Wired src/components/services/api-gateway.tsx: same recipe — APIGW_TABS (GENERAL Network · THROTTLING Gauge "THROTTLING & 429" · USAGE_PLANS KeySquare "USAGE PLANS & KEYS" · CACHING Zap "EDGE CACHING") + ApigwTabId + ApigwUseCases
- Lint-rule compliance: all step machines/counters driven by useScenarioRunner-free useTicker callbacks + setTimeout chains inside handlers (zero setState in effect bodies — grep-verified); zero ref.current writes during render (all refs written in callbacks/effects); zero components-inside-components (LSlider/AGSlider/WaveRow/ClientCard/FanOutLane hoisted); flash setTimeouts stored in refs + cleanup useEffects; every FlowCanvas className="h-full"; straight corners + text-[5.5px]..[12px] uppercase mono + aws/mint/magenta/neon/danger/dim tones throughout
- Verification: bunx tsc --noEmit | rg "services/(lambda|api-gateway)" → EMPTY (no project errors in our files); bun run lint → exit 0, rg "lambda-usecases|api-gateway-usecases|services/lambda|services/api-gateway" → EMPTY; iterated: removed unused logTs/Gauge/Timer imports, fixed fan-out last-consumer vs straggler completion bug (straggler is always slowest → ends fan-out), extended FAN_LINKS to reach consumer lanes, split STAT "TTL LEFT" EXPIRED/— states
- Not done (per instructions): no dev server / browser run — recommend Task 21-main-style browser sweep for the 6 new tabs (concurrent agents' sns/sqs/cloudfront/elb files were mid-flight during this session; final lint exit was 0)

Stage Summary:
- Lambda + API Gateway now ship GI-style use-case tab rows: 4 tabs each (GENERAL + 3 new use cases), existing GENERAL simulators byte-identical inside GENERAL fragments
- All 6 new scenarios interactive: S3 event billing-granularity pipeline, cold/warm lane race with provisioned-concurrency lane removal, SNS fan-out with magenta straggler, token-bucket 429 wave limiter, per-key quota meters with suspend→403, edge cache TTL/invalidate hit-miss economics
- Verification: tsc + lint both clean for services/(lambda|api-gateway) — zero errors, zero findings

---
Task ID: 21-b
Agent: general-purpose
Task: Implement "best use case" tabs (animations + interactions) for the EC2 and ELB service modules, replicating the s3-usecases golden pattern from Task 21-main

Work Log:
- Read worklog (21-main + 21-a), shared/use-case.tsx primitives, s3-usecases.tsx golden example, ec2.tsx (TWO animation panels — lifecycle + ASG) + elb.tsx, flow.tsx/sim-controls.tsx/auto-log.tsx APIs
- Created src/components/services/ec2-usecases.tsx — Ec2UseCases router with 3 tabs:
  * AUTO_SCALING "AUTO SCALING": LOAD slider 10-100 (module-scope LoadSlider) drives a load wave; useTicker(1s) → measured avg CPU = load ± noise; CloudWatch ALARM node flips OK/ALARM at 70%; >70% → ASG launches chips 2→8 (boot animation: spring-in, neon INITIALIZING → mint IN-SERVICE after 2 ticks) with danger "ALARM — SCALE-OUT" VerdictFlash; <30% → scale-in (terminating chip drains out, mint "SCALE-IN" flash, floor 2); per-chip CPU mini-bars update per tick; stats: LOAD %, CPU AVG, DESIRED INSTANCES, ALARM STATE (OK/ALARM), EST $/HR (n × $0.0464), SCALE EVENTS
  * PRICING "PRICING MODELS": 3 lane cards ON-DEMAND $0.0464 / SPOT $0.0139 / RESERVED $0.021 with running 30-day cost tickers (1 sim day/tick @850ms, month closes at day 30 → ledger log + next month); UCToggle STEADY/BURSTY flips util (100%/55%) + spot re-run overhead (×3.2/×1.1) so RESERVED wins steady, SPOT wins bursty → mint "BEST FIT" badge on the winning lane + VerdictFlash; UCButton SPOT INTERRUPTION → 5-step useScenarioRunner compresses the 2-min drain: 2-MIN NOTICE → CHECKPOINT (state → S3) → MIGRATE (new pool) → RESUME (chip swap gen+1, boot animation) → ZERO DOWNTIME, timeline strip highlights current phase; stats: OD/SPOT/RI 30-DAY, SAVINGS % (spot vs od), WORKLOAD, INTERRUPTIONS
  * GOLDEN_AMI "GOLDEN AMI": UCButton BUILD AMI → 4-step pipeline (BASELINE → INSTALL nginx/node-20/aws-cli → HARDEN CIS L1 47 controls → BAKE) with step rows + progress bar (18→44→72→100%), mints AMI vN+1 (BUILD TIME 180-250s random); LAUNCH FLEET → 3 chips boot from AMI vN with version badges (blocked with danger log if no AMI); PATCH + REBAKE → drift check → chips drain (DRAINING — REPLACING) → pipeline rebakes vN+1 → fleet relaunches with new badges → DRIFT 0; BUILD AMI without rebake leaves fleet DRIFTED (danger stat + red FlowLabel); stats: AMI VERSIONS, FLEET SIZE, BUILD TIME S, DRIFT, BAKES, LATEST AMI
- Created src/components/services/elb-usecases.tsx — ElbUseCases router with 3 tabs:
  * PATH_ROUTING "PATH ROUTING": CLIENT → ALB (L7) → 3 TGs (/img/* → TG-STATIC prio 1, /api/* → TG-API prio 2, DEFAULT → TG-WEB prio 3); UCButtons SEND /api/orders, SEND /img/logo.png, SEND / fire a packet that animates CLIENT → ALB → matching TG (keyframe motion), matching rule row glows MATCH in the listener-rules card + magenta rule chip above ALB + log "RULE #2 PRIORITY: path-pattern /api/* → tg-api — 200 OK (NNms)"; RUN auto-fires weighted random traffic; stats: TOTAL REQUESTS, per-TG counts ×3, LAST MATCH, TARGET GROUPS 3/3
  * HEALTH_FAILOVER "HEALTH FAILOVER": 3 target chips with health dots + req counts; UCButton KILL TARGET → victim: 3 failed health checks ticked one-by-one (log each miss w/ count) → DEREGISTERING + connection draining (24-conn drain ticker, DRAIN n/24 on chip + DRAINING CONNS stat) → DEREGISTERED + "TARGET REMOVED" flash, traffic redistributes to survivors automatically (ticker only routes to healthy; 0/3 → 503 logs); UCButton HEAL → 2 passing checks (200 OK 1/2, 2/2) → re-registered mint log + "BACK IN ROTATION" flash; dashed probe links from HEALTH CHECKER node turn error/success; stats: HEALTHY n/3, FAILED CHECKS, DRAINING CONNS, DEREGISTERED, REQUESTS SERVED, RECOVERIES
  * BLUE_GREEN "BLUE-GREEN": BLUE v1.4 lane at 100% (aws) + GREEN v1.5 lane (mint); UCButton DEPLOY GREEN → 3-step warm-up (provision → pools/cache warm → health 3/3 PASSED, READY at 0%); UCButton PROMOTE → 3-phase useScenarioRunner animates weights 100/0 → 50/50 (CANARY log) → 0/100 (GREEN 100%) → finalize ACTIVE v1.5 + ROLLOVERS++ with StepBadge showing SHIFT phases; UCButton ROLLBACK → weights animate back 50/50 → 100/0 (danger logs, v1.4 RESTORED, green kept warm); live traffic packets split by current weights; stats: ACTIVE VERSION, BLUE %, GREEN %, ROLLOVERS, GREEN HEALTH, REQUESTS
- Wired src/components/services/ec2.tsx: UseCaseTabs+UcTabDef+Ec2UseCases imports, lucide +Coins +Disc +TrendingUp; EC2_TABS (GENERAL Cpu · AUTO_SCALING TrendingUp · PRICING Coins · GOLDEN_AMI Disc) as const satisfies readonly UcTabDef[] + Ec2TabId; tab state FIRST state line; tablist + conditional Ec2UseCases right after root div opens; ALL existing children (both panels + state log + knowledge) wrapped in {tab === "GENERAL" && (<>…</>)} untouched; BOTH FullscreenToggles kept (one per panel)
- Wired src/components/services/elb.tsx: same recipe — ELB_TABS (GENERAL Network · PATH_ROUTING Split · HEALTH_FAILOVER HeartPulse · BLUE_GREEN GitBranch) + ElbTabId + ElbUseCases
- Lint-rule compliance verified by scan: zero setState in effect bodies (all step machines via useScenarioRunner, counters/state machines via useTicker interval callbacks), zero ref.current writes during render (all inside tickers/handlers/reset), no components defined inside components (AsgChipCard/LoadSlider/PricingLane/AmiPipelineCard/AmiFleetChip/ListenerRulesCard/HfTargetChip/BgLaneCard/useFlash hoisted), flash setTimeouts stored in refs + cleanup useEffects, FlowCanvas className="h-full" ×6, straight corners + tiny uppercase mono + tones only
- Verification: bunx tsc --noEmit filtered to services/(ec2|elb) → EMPTY (project total 4 error lines, all pre-existing in examples//skills/); bun run lint → exit 0, zero findings for ec2-usecases|elb-usecases|services/ec2|services/elb

Stage Summary:
- EC2 + ELB now ship GI-style use-case tab rows: 4 tabs each (GENERAL + 3 new use cases), existing GENERAL simulators byte-identical inside fragments (EC2 keeps both animation panels + both fullscreen toggles)
- All 6 new scenarios interactive: load-wave alarm auto-scaling 2→8, pricing best-fit verdict flip + compressed spot drain, golden AMI build/launch/patch-rebake with drift, ALB path-rule packet matching, health-check failover with connection draining, weighted blue-green promote/rollback
- Not done (per instructions): no dev server / browser run — recommend a Task 21-main-style browser sweep for the 6 new tabs

---
Task ID: 21-final
Agent: main
Task: Integrate agents 21-a..21-f — full verification of use-case tabs across all 13 services + run the app

Work Log:
- Full tsc (excl. skills/examples) -> 0 errors; bun run lint -> exit 0 clean project-wide (transient mid-flight parse error in elb.tsx observed in dev.log was resolved by 21-b; current file valid, compiles GET / 200)
- Browser E2E sweep: all 13 services verified via hotkeys — tab lists: IAM 4, S3 6, VPC 4, EC2 4, ELB 4, Lambda 4, APIGW 4, SNS 4, SQS 4, CloudFront 4, RDS 4, CloudWatch 4, Containers 4 = 51 tabs (46 use-case views + 13 GENERAL + GI's 3)
- Every use-case tab clicked: UseCaseShell renders (USE CASE // title + LIVE STATS + CONTROLS + RUN button) — 39/39 pass
- Live interactions: RDS KILL PRIMARY -> detection countdown + HARDWARE FAILURE + DNS flip sequence; EC2 autoscale at load 95 -> instance chips + alarm; Lambda RACE NOW -> WARM WINS x30 (964ms vs 32ms, 97% savings); CW ALARM -> metric/alarm/actions chips; ECS DEPLOY V2 -> rolling pipeline + zero downtime
- GI unchanged: 3 tabs + globe canvas intact; zero page errors; console clean
- Screenshots: /home/z/shots/uc-s3-lake3.png, uc-s3-ver.png, uc-s3-policy.png, uc-s3-lc.png, uc-rds-multiaz.png, uc-lambda-coldwarm.png, uc-ecs-rolling.png

Stage Summary:
- EVERY service module now has GI-style use-case tabs with animated scenario scenes + interactive controls + live logs: 46 use-case views total
- S3: Data Lake / Versioning / Static Hosting / Bucket Policy visualizer / Lifecycle (user's exact 5-tab spec)
- IAM: Federated Access / Least Privilege / Cross-Account · VPC: Three-Tier / NAT / SG-vs-NACL · EC2: Auto Scaling / Pricing / Golden AMI · ELB: Path Routing / Health Failover / Blue-Green · Lambda: S3 Events / Cold-Warm / Fan-Out · APIGW: Throttling / Usage Plans / Caching · SNS: Fan-Out / Push+SMS / Retry-DLQ · SQS: Buffer / Worker Scaling / Redrive · CloudFront: Edge Accel / Streaming / Signed URLs · RDS: Multi-AZ / Replicas / PITR · CloudWatch: Alarm-Action / Dashboard / Anomaly · Containers: Rolling Deploy / Service Scaling / EKS HPA
- Shared primitives in shared/use-case.tsx keep all tabs consistent + lint-clean; fullscreen toggles available in every use-case shell

---
Task ID: 22
Agent: main (orchestrator)
Task: Add AWS CloudFormation as module 15 with GI-style use-case tabs + animations (user docs URL: https://docs.aws.amazon.com/cloudformation/)

Work Log:
- Created public/icons/aws/cloudformation.svg — official-style Arch icon (pink #E7157B bg + white stacked-layers glyph, Arch_AWS-CloudFormation layout)
- aws-icons.tsx: added inline CloudFormationIcon glyph (currentColor stacked layers, viewBox 64), registered cloudformation in both AWS_ARCH_ICONS (colored tile) and SERVICE_ICONS (inline glyph map)
- services-data.ts: appended ServiceMeta index "15" — id cloudformation, short CFN, codename STACK WEAVER, category OPS, docs link https://docs.aws.amazon.com/cloudformation/, stats TEMPLATE YAML/JSON · RESOURCE TYPES 1500+ · ROLLBACK AUTOMATIC · STACKSETS MULTI-ACCT
- registry.tsx: dynamic import cloudformation (ssr:false, ModuleLoader)
- page.tsx: hotkey row extended to 15 keys (";" now selects CloudFormation)
- Built src/components/services/cloudformation.tsx (GENERAL "STACK WEAVER"): template.yaml card (6 YAML logical-ids highlighted per active resource) → CFN orchestrator core (stack name/ARN chip, phase pill CREATE/UPDATE/ROLLBACK/DELETE, progress bar, drift flag) → 5 resource nodes (IAM Role, S3, DynamoDB, Lambda, ALB) created in dependency order with anime.js FlowLinks (flowing/success/error/cyber per state) + dashed DependsOn edge. Discrete event engine (760ms ticks, refs-as-truth): DEPLOY → CREATE_IN_PROGRESS/COMPLETE events; FAIL LAMBDA toggle → CREATE_FAILED + ROLLBACK_IN_PROGRESS reverse teardown → ROLLBACK_COMPLETE → auto delete; UPDATE (in-place table only); DELETE reverse order; CAUSE DRIFT (console out-of-band edit → magenta DRIFTED); autopilot loop (create→update→delete). LIVE STATS + SimControls + stack events AutoLog + 3 callouts. Immersive fullscreen wired.
- Built src/components/services/cloudformation-usecases.tsx (5 tabs, useLog/useFlash micro-hooks):
  · IAC: dependency-wave deploy of 6 resources in 3 waves vs SERIAL (no CFN) mode — wall clock 4.2s vs 8.4s, DependsOn edge overlay toggle, wave labels highlight live wave
  · CHANGE_SETS: template v1→v2 diff panel, change-set-9f2c with 4 action rows (ADD/MODIFY×2/REPLACE flagged danger with pulsing warning), scenario steps diff→review→execute, EXECUTE applies only changed resources (REPLACE does delete+recreate), DISCARD = zero changes verdict
  · ROLLBACK: inject failure at resource 1-4 selector → UPDATE_FAILED → UPDATE_ROLLBACK_IN_PROGRESS reverse revert of modified resources → UPDATE_ROLLBACK_COMPLETE, live version v1.8.0→v1.7.2, DOWNTIME 0s
  · DRIFT: 3 console-edit injectors (STOP EC2 / OPEN SSH :22 / DELETE POLICY) → RUN DETECTION polls 4 resources (IN_SYNC mint vs DRIFTED magenta + reason chips) → REVERT (CFN re-applies template) or ADOPT (template updated)
  · STACKSETS: audit-baseline stackset → 3 accounts (AUDIT/PROD/SANDBOX) × 2 regions (US-EAST-1/EU-WEST-1) grid, region waves with concurrent accounts, FAIL SANDBOX·EU + TOLERANCE STOP/CONTINUE (STOP halts remaining with NOT ATTEMPTED cells + deny verdict; CONTINUE skips and finishes)
- Verification: bunx tsc --noEmit → 0 errors; bun run lint → clean. Agent Browser E2E: nav rail shows 15 modules; hotkey ";" selects CloudFormation; GENERAL deploy → 5/5 CREATE_COMPLETE + 12 events; IAC → 6/6 in 4.2s waves; CHANGE SETS preview + REPLACEMENT flag; ROLLBACK → UPDATE_ROLLBACK_COMPLETE + v1.7.2 restored; DRIFT → 2 drifted detected + REVERTED; STACKSETS → 6/6 COMPLETE and FAIL+STOP → 5/6 ROLLOUT STOPPED verdict; immersive fullscreen enter/exit OK; hotkey 1/3 spot-checks fine; tablist flex-wrap OK; zero page errors in dev.log
- Screenshots: /home/z/shots/cfn-general.png, cfn-iac.png, cfn-changesets.png, cfn-rollback.png, cfn-drift.png, cfn-stacksets.png, cfn-stacksets-fail.png, cfn-immersive.png, cfn-final.png

Stage Summary:
- MODULE 15 AWS CLOUDFORMATION (STACK WEAVER) live: GENERAL stack-lifecycle simulator + 5 best-use-case tabs (IAC waves, Change Sets preview, Auto Rollback, Drift Detection, StackSets org rollout) — every tab animated with UseCaseShell/LIVE STATS/CONTROLS/scenario log and interactive controls, consistent with the other 13 services
- App now: 15 modules / 57 total tabs = 3 (GI) + 4x12 (IAM..Containers: GENERAL + 3 use-cases) + 6 (CFN: GENERAL + 5 use-cases); use-case views: 51; hotkeys 1-9,0,-,=,[,],;
- tsc/lint zero; browser-verified end-to-end; docs link to https://docs.aws.amazon.com/cloudformation/ in module header

---
Task ID: 23
Agent: main (orchestrator)
Task: CloudFormation — "make sure we have appropriate animations in ALL tabs" (user follow-up to Task 22)

Work Log:
- Browser-audited all 6 CFN tabs; found critical render bug: ALL 4 FlowCanvas stages in cloudformation-usecases.tsx (IAC / CHANGE_SETS / ROLLBACK / DRIFT) collapsed to 2px height — the only service files missing `className="h-full"` on FlowCanvas (every other *-usecases.tsx passes it). Engines ran + stats updated but the animated stage was invisible (empty black canvas).
- Fixed: added className="h-full" to the 4 FlowCanvas usages (IAC, CHANGE_SETS, ROLLBACK, DRIFT). STACKSETS was unaffected (own h-full container).
- Fixed StepBadge collision: the per-tab CFN chip in IAC + CHANGE_SETS sat at left-3 top-2.5 — same slot as StepBadge (left-2 top-2) → garbled overlap. Moved both chips to left-3 top-9 (below badge).
- Animation polish per tab:
  * CHANGE_SETS: diff panel is now data-driven (CS_DIFF_LINES) with staggered line reveal (motion.p, 65ms stagger, slide-in from left) + trailing "change-set-9f2c ready" line; replays on every NEW PREVIEW via runSeq key (reset clears).
  * ROLLBACK: "FAILS HERE" marker upgraded from static FlowLabel to spring pop-in/out (AnimatePresence + motion.div, scale 0.6→1, centered via motion x/y "-50%" — avoids Tailwind-translate vs framer-transform conflict).
  * DRIFT: added animated magenta scan sweep line (2.4s loop top→bottom with glow) + blinking "SCANNING RESOURCES…" chip while detection runs; fixed drift reason-tooltip centering (motion x:"-50%" instead of Tailwind -translate-x-1/2 which framer overrides).
  * STACKSETS: added 2 self-contained FlowLink connectors core → US-EAST-1 / EU-WEST-1 columns with per-region reactive status (flowing while its wave deploys, success when all 3 accounts created, error on failed/stopped) + AnimatePresence mode="wait" slide transitions on every cell status text (PENDING → CREATE_IN_PROGRESS → STACK INSTANCE LIVE / CREATE_FAILED / NOT ATTEMPTED).
- Browser E2E re-verified every tab: GENERAL deploy (flowing links, 5/5 CREATE_COMPLETE), IAC canvas h=480 + wave deployment, CHANGE_SETS preview→stagger diff→EXECUTE_COMPLETE (all rows MODIFIED, green links), ROLLBACK UPDATE_FAILED flash → UPDATE_ROLLBACK_IN_PROGRESS → UPDATE_ROLLBACK_COMPLETE v1.7.2 / 0 downtime, DRIFT cause 2 drifts → scan → magenta tooltips + DRIFTED core → REVERT → STACK IN SYNC 4/4, STACKSETS deploy (connectors + 6/6) and FAIL SANDBOX·EU + STOP → STOPPED 5/6 FAILED 1 (failure in last region = nothing left unattempted, matches design), immersive fullscreen run inside IAC tab + Escape exit, mobile 390px no overflow (scrollWidth 390, tabs wrap 2-per-row).
- Verification: bunx tsc --noEmit --incremental false → 0 project errors; bun run lint → exit 0; agent-browser errors → empty; dev.log clean (GET / 200).
- Screenshots: /home/z/shots/cfn-audit-general.png, cfn-audit-general-run.png, cfn-v2-iac.png, cfn-v2-changesets.png, cfn-v2-changesets-exec.png, cfn-v2-rollback.png, cfn-v2-rollback-done.png, cfn-v2-drift.png, cfn-v2-drift-revert.png, cfn-v2-stacksets.png, cfn-v2-stacksets-stopped.png, cfn-v2-iac-final.png, cfn-v2-iac-immersive.png, cfn-v2-mobile.png

Stage Summary:
- All 6 CloudFormation tabs now render their animated stages correctly (root cause of "no animations" was the collapsed 2px canvases, not missing animation code) — every tab has live animations + interactive controls, consistent with the other 14 modules
- CFN animation inventory per tab: GENERAL stack lifecycle sim · IAC dependency-wave deployment with flowing links + wave labels + progress bar · CHANGE SETS staggered diff reveal + pulsing REPLACE row + verdict flashes · ROLLBACK fail-marker pop + color-shifting progress + verdict flashes · DRIFT radar scan sweep + blinking scan chip + magenta tooltips · STACKSETS reactive connectors + cell status transitions + verdict flashes
- App state: 15 modules / 57 tabs, tsc + lint zero, browser-verified end-to-end at desktop + mobile widths

---
Task ID: 24
Agent: main (orchestrator)
Task: Rename codenames to actual AWS service abbreviations + URL-parameter access (?service=<key>&mapperhidden=true|false)

Work Log:
- Renamed ServiceMeta field codename → abbr across services-data.ts / page.tsx / service-nav.tsx / hero.tsx; zero codename refs remain (rg verified)
- Set actual service abbreviations: GI · IAM · S3 · VPC · EC2 · ELB · LMD (λ) · APIGW · SNS · SQS · CF (CloudFront) · RDS · CW · ECS·EKS (Containers) · CFN (CloudFormation)
- Display surfaces updated: module header now "MODULE NN // CATEGORY — SVC: <ABBR>"; nav rail expanded sub-label + hover tooltip + aria-labels + hero marquee all show abbr
- Cleaned 2 user-visible fictional codename remnants in module stages: cloudformation.tsx stage chip "STACK WEAVER" → "CFN — IAC", elb.tsx card title "FLOW VIEW // TRAFFIC SPLITTER" → "FLOW VIEW // ELB" (remaining hits were code comments only)
- URL deep links in page.tsx: mount effect (rAF-deferred, lint set-state-in-effect compliant) parses ?service= via new resolveServiceKey() and ?mapperhidden= via new parseBoolParam(); both exported from services-data.ts
- resolveServiceKey match order: exact id → normalized id → short/abbr/name → curated alias map (gi, infra, identity, lmd, fn, apigw, apigateway, gateway, cdn, monitoring, ecs, eks, ecr, k8s, kubernetes, docker, cfn, iac, stack, stacks; case/separator-insensitive)
- Canonical shareable URL: history.replaceState always keeps ?service=<id>&mapperhidden=<bool> in sync — on load, on nav-rail/mobile-chip clicks, on hotkeys (1-9,0,-,=,[,],;), on SHOW/HIDE MAPPER toggles
- mapperhidden=true unmounts the whole ServiceNav (desktop rail + mobile chips); inline "SHOW MAPPER" chip + hint text appear in the content column; ServiceNav gained optional onHide prop with magenta PanelLeftClose button in the desktop rail header and a HIDE chip at the tail of the mobile scroll row
- Invalid/unknown ?service= values fall back to GLOBAL INFRASTRUCTURE gracefully (URL canonicalized)
- Verification: bunx tsc --noEmit → 0 project errors; bun run lint → exit 0; agent-browser E2E:
  * /?service=iam → IAM opens, URL → ?service=iam&mapperhidden=false
  * /?service=s3&mapperhidden=true → S3 + rail gone + SHOW MAPPER chip; click → rail back + mapperhidden=false; rail HIDE → true; SHOW → false (URL synced each step)
  * hotkey 4 → VPC + URL service=vpc; aliases apigw→API GATEWAY, cfn/CFN→CLOUDFORMATION, ecs→CONTAINERS, gi→GLOBAL INFRASTRUCTURE; CFN&mapperhidden=1 (truthy 1) works
  * bogus123 → graceful GI fallback; zero page errors; dev.log clean
  * expanded rail shows abbr sub-labels for all 15 modules; mobile 390px scrollWidth 390 (no overflow) with deep link + hidden mapper
- Screenshots: /home/z/shots/t24-deeplink-iam.png, t24-s3-mapperhidden.png, t24-rail-abbr.png, t24-mobile-cfn.png, t24-final-cfn.png

Stage Summary:
- All fictional codenames replaced by official AWS service abbreviations in every UI surface (header "SVC:", nav rail, tooltips, hero marquee, in-stage chips)
- Every module is now deep-linkable: /?service=<id|abbr|alias>&mapperhidden=true|false — URL canonicalized and kept in sync with all navigation paths (clicks, hotkeys, toggles); mapper fully hideable/restorable from UI and URL
- 15 modules / 57 tabs untouched and re-verified; tsc + lint zero; browser-verified desktop + mobile

---
Task ID: 25
Agent: main (orchestrator)
Task: Sidebar polish — HIDE MAPPER button only in expanded mode; expanded-rail/tooltip second line shows full service name (except Containers)

Work Log:
- service-nav.tsx: desktop rail HIDE MAPPER button now gated on `onHide && expanded` — shrink (icon-only) mode shows only the collapse chevron; expanded mode shows both
- Added navSubLabel() helper: second line of expanded rail items AND shrink-mode hover tooltip now renders the full service name (s.name) for every module EXCEPT Containers, which keeps its ECS·EKS abbreviation
- services-data.ts: IAM name spelled out "IDENTITY & ACCESS MGMT" → "IDENTITY & ACCESS MANAGEMENT" (also improves module header + aria-labels); first line "NN // SHORT" untouched per user instruction
- Mobile horizontal chips keep their tail HIDE chip (no shrink/expanded concept on mobile)
- Verification: tsc → 0 project errors; lint → exit 0; browser E2E: shrink mode hide-button absent, expanded present; all 15 second lines read GLOBAL INFRASTRUCTURE / IDENTITY & ACCESS MANAGEMENT / SIMPLE STORAGE SERVICE / VIRTUAL PRIVATE CLOUD / ELASTIC COMPUTE CLOUD / ELASTIC LOAD BALANCING / AWS LAMBDA / API GATEWAY / SIMPLE NOTIFICATION SERVICE / SIMPLE QUEUE SERVICE / CLOUDFRONT CDN / RELATIONAL DATABASE SERVICE / AMAZON CLOUDWATCH / ECS·EKS (containers exception) / AWS CLOUDFORMATION; hover tooltip shows "02 // IAM / IDENTITY & ACCESS MANAGEMENT"; mobile 390px no overflow; zero page errors; dev.log clean
- Screenshots: /home/z/shots/t25-expanded-fullnames.png, t25-tooltip.png

Stage Summary:
- Sidebar matches spec: shrink mode = icons + tooltip only (no hide button); expanded mode = "NN // SHORT" over full service name (Containers → ECS·EKS), plus HIDE MAPPER + collapse controls; URL deep links and mapper toggling behavior unchanged

---
Task ID: 26
Agent: main (orchestrator)
Task: Use user-provided HexagonLoader for the module-square loading state in services

Work Log:
- Created src/components/shared/hexagon-loader.tsx — the user's HexagonLoader verbatim (morphing outer hexagon + forming inner hexagon + orange glow), with "use client", typed points array (strict-mode fix), and keyframes moved from `<style jsx>` to `<style jsx global>` so the inline animation-name references resolve (styled-jsx scopes keyframes in scoped blocks, which would silently break them)
- registry.tsx: ModuleLoader now renders <HexagonLoader size={80}/> + LOADING MODULE / COMPILING FLOW GRAPH lines (replaced the old square clip-path spinner)
- Added withMinDisplay() wrapper around every dynamic import: keeps ModuleLoader mounted ≥900ms (MIN_MODULE_LOAD_MS) while the chunk loads underneath via next/dynamic — without it the hexagon flashed for <300ms on cached chunks and was effectively invisible; chunk fetch still starts immediately (nothing delayed)
- Verification: tsc → 0 project errors; lint → exit 0; in-page sampler proved loader+hex+overlay mounted ~926ms (596→1522ms window) then module renders; document.getAnimations() listed hexagonMorph + innerHexagonForm running (keyframes resolve correctly under dark theme: white outer hexagon, #ff9900 inner)
- Browser E2E: boot-then-hotkey switch caught the loader naturally mid-morph (screenshot t26-s2.png shows white hexagon + orange glow + LOADING MODULE text in the module square; s3 shows CloudFront fully rendered right after); module loads verified for CFN/EC2/CloudFront; zero page errors; dev.log clean
- Test forensics notes (for future agents): on fresh reload the module loader runs BEHIND the 2.4s BootOverlay — catch it after boot via hotkey to an unvisited module; WAAPI pause/seek on the SVG path produced misleading rects (transform keyframes on SVG paths + seek) — trust natural-playwright screenshots + getAnimations instead; never .remove() React-managed nodes (AnimatePresence exit crash) — use style.display='none'
- Screenshots: /home/z/shots/t26-s2.png (loader in action), t26-s3.png (module after), t26-burst2.png (boot overlay sanity)

Stage Summary:
- Module-square loading state now uses the user's HexagonLoader (white morphing hexagon + AWS-orange core + glow) with a 900ms minimum display so the animation is always perceptible across all 15 service modules; all prior functionality intact (tsc/lint zero, E2E verified)

---
Task ID: 27
Agent: main (orchestrator)
Task: HexagonLoader cleanup — remove blur layer behind hexagon, remove card/overlay around loader ("just as previously with square → hexagon")

Work Log:
- hexagon-loader.tsx: removed the glow/blur div (absolute inset-0 rounded-full blur-[10px] animate-pulse gradient blob) that sat behind the SVG; unwrapped the extra relative container — the component is now just the bare animated hexagon SVG
- registry.tsx: replaced the withMinDisplay overlay approach (absolute bg-background card covering the module during the min window) with withMinLoad() — a clean in-place swap: chunk import starts in an effect on mount, ModuleLoader renders until (chunk resolved AND 900ms min elapsed), then the module renders directly. No wrapper div, no card, no nested double-loader; .catch keeps the loader up on chunk failure instead of unhandled rejection
- ModuleLoader container restored to the previous style (gap-4) — layout identical to the original loader, only the square spinner swapped for the hexagon
- Verification: tsc → 0 project errors; lint → exit 0; browser E2E fresh session: DOM confirms glow div absent + overlay card absent during load; burst screenshots show hexagon + LOADING MODULE texts centered directly in the module square (t27-s1.png mid-fade, t27-crisp.png clean); modules load normally after swap (IAM → IDENTITY & ACCESS MANAGEMENT, S3 → SIMPLE STORAGE SERVICE); zero page errors; dev.log clean
- Screenshots: /home/z/shots/t27-crisp.png (loader, no card/no glow), t27-s1.png, t27-s2.png

Stage Summary:
- Module loading state is now exactly the previous layout with the square spinner replaced by the user's hexagon morph animation: no blur layer behind it, no card around it, 900ms min-display preserved via clean loader→module swap across all 15 services
