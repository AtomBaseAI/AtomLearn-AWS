"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

function ModuleLoader() {
  return (
    <div className="h-full min-h-[480px] flex flex-col items-center justify-center gap-4 glass-inset">
      <div className="relative w-14 h-14 border border-aws/40 flex items-center justify-center">
        <span className="absolute inset-0 border border-aws/20 spin-slow" style={{ clipPath: "polygon(0 0,100% 0,100% 30%,0 30%)" }} />
        <span className="w-2 h-2 bg-aws animate-ping" />
      </div>
      <p className="text-[9px] uppercase tracking-[0.35em] text-aws">
        LOADING MODULE<span className="blink-cursor">_</span>
      </p>
      <p className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground">
        COMPILING FLOW GRAPH // MOUNTING WEBGL
      </p>
    </div>
  );
}

export const MODULE_COMPONENTS: Record<string, ComponentType> = {
  "global-infrastructure": dynamic(() => import("./global-infrastructure"), { ssr: false, loading: ModuleLoader }),
  iam: dynamic(() => import("./iam"), { ssr: false, loading: ModuleLoader }),
  s3: dynamic(() => import("./s3"), { ssr: false, loading: ModuleLoader }),
  vpc: dynamic(() => import("./vpc"), { ssr: false, loading: ModuleLoader }),
  ec2: dynamic(() => import("./ec2"), { ssr: false, loading: ModuleLoader }),
  elb: dynamic(() => import("./elb"), { ssr: false, loading: ModuleLoader }),
  lambda: dynamic(() => import("./lambda"), { ssr: false, loading: ModuleLoader }),
  "api-gateway": dynamic(() => import("./api-gateway"), { ssr: false, loading: ModuleLoader }),
  sns: dynamic(() => import("./sns"), { ssr: false, loading: ModuleLoader }),
  sqs: dynamic(() => import("./sqs"), { ssr: false, loading: ModuleLoader }),
  cloudfront: dynamic(() => import("./cloudfront"), { ssr: false, loading: ModuleLoader }),
  rds: dynamic(() => import("./rds"), { ssr: false, loading: ModuleLoader }),
  cloudwatch: dynamic(() => import("./cloudwatch"), { ssr: false, loading: ModuleLoader }),
  containers: dynamic(() => import("./containers"), { ssr: false, loading: ModuleLoader }),
};
