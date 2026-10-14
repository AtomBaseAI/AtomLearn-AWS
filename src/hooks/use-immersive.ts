"use client";

import { useCallback, useEffect, useState } from "react";

const BODY_CLASS = "immersive-on";

/**
 * IMMERSIVE FULLSCREEN VIEW
 *
 * Drives the service-level fullscreen "stage" mode:
 *  - `active` true  → the service root becomes a viewport-fixed 100vw/100vh
 *    modal showing only essential data (animation + LIVE STATS + CONTROLS +
 *    log). All non-essential panels are hidden by the component itself.
 *  - The browser Fullscreen API is requested on <html> so the whole browser
 *    goes fullscreen. If that is unavailable (preview iframe without
 *    allowfullscreen, unsupported browser) the overlay still renders as a
 *    plain fixed modal — graceful degradation.
 *  - ESC / fullscreenchange keep state in sync; body gets `immersive-on`
 *    so CSS can neutralize ancestor containing blocks (filter /
 *    backdrop-filter) and lock background scrolling.
 *  - Switching modules unmounts the hook → fullscreen + body class are torn
 *    down automatically.
 */
export function useImmersiveView() {
  const [active, setActive] = useState(false);

  /* follow the browser's fullscreen state (ESC key, browser UI chrome) */
  useEffect(() => {
    const sync = () => {
      if (!document.fullscreenElement) setActive(false);
    };
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  /* body flag: scroll lock + containing-block neutralization while active */
  useEffect(() => {
    if (!active) return;
    document.body.classList.add(BODY_CLASS);
    return () => document.body.classList.remove(BODY_CLASS);
  }, [active]);

  /* overlay-only mode (browser fullscreen unavailable): ESC closes the modal */
  useEffect(() => {
    if (!active || document.fullscreenElement) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  /* leaving the module while immersive → tear everything down */
  useEffect(() => {
    return () => {
      document.body.classList.remove(BODY_CLASS);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  const toggle = useCallback(() => {
    if (active || document.fullscreenElement) {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      setActive(false);
      return;
    }
    setActive(true);
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {
        /* overlay-only fallback — preview iframes / unsupported browsers */
      });
    }
  }, [active]);

  return { active, toggle };
}
