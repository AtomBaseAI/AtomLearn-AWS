"use client";

import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import HexagonLoader from "@/components/shared/hexagon-loader";

function ModuleLoader() {
  return (
    <div className="h-full min-h-[480px] flex flex-col items-center justify-center gap-4 glass-inset">
      <HexagonLoader size={80} />
      <p className="text-[9px] uppercase tracking-[0.35em] text-aws">
        LOADING MODULE<span className="blink-cursor">_</span>
      </p>
      <p className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground">
        COMPILING FLOW GRAPH // MOUNTING WEBGL
      </p>
    </div>
  );
}

/** minimum time the hexagon loader stays on screen — avoids a jarring sub-300ms flash
    when a cached chunk resolves almost instantly, so the boot animation reads clearly */
const MIN_MODULE_LOAD_MS = 900;

type ModuleFactory = () => Promise<{ default: ComponentType }>;

/** starts the chunk import immediately on mount and swaps loader → module in place —
    no wrapper card/overlay, just the loader until the chunk is ready AND the
    minimum display window has elapsed */
function withMinLoad(factory: ModuleFactory): ComponentType {
  return function MinLoadModule() {
    const [Comp, setComp] = useState<ComponentType | null>(null);
    const [minDone, setMinDone] = useState(false);

    useEffect(() => {
      let alive = true;
      factory()
        .then((m) => {
          if (alive) setComp(() => m.default);
        })
        .catch(() => {
          /* chunk failed — loader stays up; a reload retries */
        });
      const t = setTimeout(() => setMinDone(true), MIN_MODULE_LOAD_MS);
      return () => {
        alive = false;
        clearTimeout(t);
      };
    }, [factory]);

    if (!Comp || !minDone) return <ModuleLoader />;
    return <Comp />;
  };
}

export const MODULE_COMPONENTS: Record<string, ComponentType> = {
  "global-infrastructure": withMinLoad(() => import("./global-infrastructure")),
  iam: withMinLoad(() => import("./iam")),
  s3: withMinLoad(() => import("./s3")),
  vpc: withMinLoad(() => import("./vpc")),
  ec2: withMinLoad(() => import("./ec2")),
  elb: withMinLoad(() => import("./elb")),
  lambda: withMinLoad(() => import("./lambda")),
  "api-gateway": withMinLoad(() => import("./api-gateway")),
  sns: withMinLoad(() => import("./sns")),
  sqs: withMinLoad(() => import("./sqs")),
  cloudfront: withMinLoad(() => import("./cloudfront")),
  rds: withMinLoad(() => import("./rds")),
  cloudwatch: withMinLoad(() => import("./cloudwatch")),
  containers: withMinLoad(() => import("./containers")),
  cloudformation: withMinLoad(() => import("./cloudformation")),
};
