"use client";

import { useEffect, useState } from "react";
import { scrollState } from "@/lib/scrollState";

const links = [
  { label: "How it works", href: "#solution" },
  { label: "Demo", href: "#demo" },
  { label: "Tech", href: "#tech" },
  { label: "Use cases", href: "#use-cases" },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  // Mirror scrollState.loaderActive into local state so the JSX can react.
  // The state flip happens once at loader completion, so we just poll via
  // rAF — cheaper than wiring a custom event for one transition.
  const [loaderActive, setLoaderActive] = useState(true);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    let raf = 0;
    const tick = () => {
      const next = scrollState.loaderActive;
      setLoaderActive((prev) => (prev !== next ? next : prev));
      // Once the loader has completed we can stop polling — its state
      // never flips back to true within a session.
      if (next) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-opacity duration-500"
      style={{
        opacity: loaderActive ? 0 : 1,
        pointerEvents: loaderActive ? "none" : "auto",
      }}
    >
      {/* Progressive blur stack — 8 layers, exponential blur progression
          (each ~1.67× the next), trapezoidal masks with edge-to-edge
          plateaus at 12.5% boundaries. This is the AndrewPrifer/progressive-
          blur recipe — at every Y, only one layer is at full alpha, and
          the cross-fade between adjacent layers is between blurs only
          1.67× apart (visually indistinguishable). `isolation: isolate`
          on the wrapper + `transform: translateZ(0)` on each layer (in
          CSS) force independent compositor layers so the masks don't
          lose precision in Chromium. */}
      <div
        className={`nav-frost absolute inset-0 transition-opacity duration-200 ease-out ${
          scrolled ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden
      >
        <div className="nav-frost-layer nav-frost-layer-1" />
        <div className="nav-frost-layer nav-frost-layer-2" />
        <div className="nav-frost-layer nav-frost-layer-3" />
        <div className="nav-frost-layer nav-frost-layer-4" />
        <div className="nav-frost-layer nav-frost-layer-5" />
        <div className="nav-frost-layer nav-frost-layer-6" />
        <div className="nav-frost-layer nav-frost-layer-7" />
        <div className="nav-frost-layer nav-frost-layer-8" />
        {/* Dark gradient overlay on its own non-filter element. */}
        <div className="nav-frost-overlay" />
      </div>

      <div className="relative mx-auto max-w-[1480px] px-6 md:px-10">
        <div className="flex items-center justify-between h-16 md:h-[68px]">
          <a
            href="#hero"
            className="flex items-center gap-2 text-[15px] tracking-tight font-medium"
          >
            <span className="relative grid place-items-center w-7 h-7 rounded-full border border-white/20 overflow-hidden">
              <span className="block w-2 h-2 rounded-sm bg-white rotate-45" />
            </span>
            <span>ReelAI</span>
          </a>

          <nav className="hidden md:flex items-center gap-8 text-[13px] text-white/70">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="hover:text-white transition-colors"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <a
            href="#cta"
            className="text-[13px] inline-flex items-center gap-2 px-4 md:px-5 h-10 rounded-full bg-white text-black font-medium tracking-tight hover:bg-white/90 transition-colors"
          >
            Get access
          </a>
        </div>
      </div>
    </header>
  );
}
