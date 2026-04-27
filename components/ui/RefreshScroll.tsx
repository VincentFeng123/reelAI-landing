"use client";

import { useEffect } from "react";
import { ScrollTrigger } from "@/hooks/useGsapScroll";

/**
 * Refresh ScrollTrigger after fonts/images settle. Prevents trigger drift
 * caused by late layout shifts.
 */
export default function RefreshScroll() {
  useEffect(() => {
    const refresh = () => ScrollTrigger.refresh();

    // Refresh once after the initial paint
    const t1 = setTimeout(refresh, 80);
    const t2 = setTimeout(refresh, 600);

    if (typeof document !== "undefined" && (document as any).fonts?.ready) {
      (document as any).fonts.ready.then(refresh);
    }

    window.addEventListener("load", refresh);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("load", refresh);
    };
  }, []);

  return null;
}
