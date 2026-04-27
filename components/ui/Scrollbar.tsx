"use client";

import { useEffect, useRef } from "react";
import { scrollState } from "@/lib/scrollState";

/**
 * Minimalist scrollbar — a thin full-height white bar on the right.
 * Background track at low opacity, fill grows from top to current scroll.
 */
export default function Scrollbar() {
  const fillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const p = scrollState.progress;
      if (fillRef.current) {
        fillRef.current.style.height = `${p * 100}%`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <aside
      className="fixed right-0 top-0 bottom-0 z-[60] pointer-events-none hidden md:block"
      style={{ width: 2 }}
      aria-hidden
    >
      <div className="absolute inset-0 bg-white/12" />
      <div
        ref={fillRef}
        className="absolute top-0 left-0 right-0 bg-white"
        style={{ height: 0 }}
      />
    </aside>
  );
}
