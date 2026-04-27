"use client";

import { useEffect } from "react";
import { ScrollTrigger } from "@/hooks/useGsapScroll";
import { scrollState } from "@/lib/scrollState";

/**
 * Native scroll. Tracks normalized progress for the 3D scene.
 * Anchor-link smoothing is handled by `scroll-behavior: smooth` in CSS,
 * not by intercepting wheel input.
 */
export default function SmoothScroll({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    let raf = 0;
    let lastY = window.scrollY;

    const updateProgress = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const y = window.scrollY;
      scrollState.progress = max > 0 ? y / max : 0;
      scrollState.heroProgress = Math.min(
        1,
        Math.max(0, y / window.innerHeight),
      );
      scrollState.velocity = (y - lastY) * 0.06;
      scrollState.height = max;
      lastY = y;
    };

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        updateProgress();
        ScrollTrigger.update();
      });
    };

    updateProgress();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateProgress);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateProgress);
    };
  }, []);

  return <>{children}</>;
}
