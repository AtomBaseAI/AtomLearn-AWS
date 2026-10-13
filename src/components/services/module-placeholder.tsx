"use client";

import { MotionConfig, motion } from "framer-motion";

export function ModulePlaceholder() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="p-6 sm:p-10 flex flex-col items-center justify-center min-h-[420px] text-center gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 border-2 border-dashed border-aws/40 relative"
        >
          <span className="absolute inset-2 border border-magenta/30" />
        </motion.div>
        <p className="text-xs uppercase tracking-[0.3em] text-aws">MODULE CALIBRATING</p>
        <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
          This visualization module is being assembled
        </p>
      </div>
    </MotionConfig>
  );
}
