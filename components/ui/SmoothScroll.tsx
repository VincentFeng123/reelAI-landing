"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { ScrollTrigger, gsap } from "@/hooks/useGsapScroll";
import { scrollState } from "@/lib/scrollState";

/**
 * Smooth scrolling with INERTIA via Lenis — when the user stops
 * scrolling, the page continues for a brief deceleration before
 * settling, instead of stopping abruptly. Same feel as Apple,
 * Linear, Awwwards-style sites.
 *
 * Integration notes:
 *   - GSAP's ticker drives Lenis's rAF (`gsap.ticker.add(...)`),
 *     so the smooth interpolation and ScrollTrigger updates share
 *     the same frame — eliminates the off-by-one-frame jitter
 *     you'd get if Lenis ran on its own rAF.
 *   - `lenis.on("scroll", ScrollTrigger.update)` ensures every
 *     scroll-driven trigger sees the smoothed position immediately.
 *   - `gsap.ticker.lagSmoothing(0)` disables GSAP's catch-up logic
 *     so a frame drop doesn't make Lenis snap.
 *   - Lenis is paused while the loader is active (`lenis.stop()`)
 *     and resumed on the `reelai:loader-fade` event so the user
 *     can't scroll-momentum past the locked overlay.
 *
 * The CSS in globals.css (`html.lenis`, `.lenis-smooth`,
 * `.lenis-stopped`) was already prepared for this — Lenis adds
 * those classes automatically.
 */
export default function SmoothScroll({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
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

    // duration: target time (s) for the smoothed scroll to reach
    //   its target after a wheel event. 1.2 s is the Lenis default
    //   and matches Apple's site feel — long enough that the
    //   deceleration reads as "momentum" rather than just "soft",
    //   short enough that quick repeated scrolls still feel
    //   responsive.
    // easing: exponential ease-out (the Lenis-recommended formula)
    //   — fast initial response, long gentle settle.
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    // Loader gating — keep Lenis stopped while loaderActive so
    // wheel input can't accumulate a target the user can't see
    // (which would jump-scroll once the overlay clears).
    if (scrollState.loaderActive) {
      lenis.stop();
    }
    const onLoaderFade = () => lenis.start();
    window.addEventListener("reelai:loader-fade", onLoaderFade, {
      once: true,
    });

    lenis.on("scroll", () => {
      updateProgress();
      ScrollTrigger.update();
    });

    const raf = (time: number) => {
      // gsap.ticker time is in SECONDS; Lenis.raf expects MS.
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    updateProgress();
    window.addEventListener("resize", updateProgress);

    return () => {
      gsap.ticker.remove(raf);
      window.removeEventListener("resize", updateProgress);
      window.removeEventListener("reelai:loader-fade", onLoaderFade);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
