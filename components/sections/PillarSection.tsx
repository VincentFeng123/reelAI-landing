"use client";

import {
  useGsapScroll,
  gsap,
  ScrollTrigger,
} from "@/hooks/useGsapScroll";
import { useEffect, useRef } from "react";
import { scrollState } from "@/lib/scrollState";
import { pillarPartsState } from "@/lib/pillarPartsState";
import {
  PILLAR_STAGE_ENTER,
  PILLAR_STAGE_WINDOW,
} from "@/lib/pillarRevealTimeline";

/**
 * Pin distance is intentionally generous (11 viewports of scroll) so each
 * dissection phase has time to read as a deliberate beat — the user has to
 * keep scrolling to fill the current phase's progress bar before the next
 * begins. Combined with smoothstepped focus blends below, every transition
 * reads as one continuous, cinematic move rather than a snap.
 */
const PIN_DISTANCE = "+=1100%";

/**
 * Scrub damping (seconds). Higher = more inertial smoothing on the timeline
 * value itself. Combined with smoothstepped focus shapes downstream, this
 * gives the section its glassy "everything floats with the scroll" feel.
 */
const SCRUB_DAMPING = 1.0;

/**
 * Phase boundaries (fraction of the pinned scroll range). Each focus phase
 * is now ~17% of the section, ~70% of which is held in zoomed focus, with
 * symmetric smoothstepped ramp-in / ramp-out at the seams so chunk-to-chunk
 * transitions blend rather than jump.
 *
 *   0.000–0.025  pre-explore
 *   0.025–0.130  explode (smoothstep ease-in-out)
 *   0.130–0.260  OVERVIEW — all four chunks pinned exploded
 *   0.260–0.430  CHUNK 0 — Search
 *   0.430–0.600  CHUNK 1 — Transcript
 *   0.600–0.770  CHUNK 2 — Segmentation
 *   0.770–0.940  CHUNK 3 — Ranking
 *   0.940–1.000  exit (chunks recollapse, camera unzooms)
 */
const EXPLODE_BEGIN = 0.025;
const EXPLODE_END = 0.13;
const EXPLORE_BEGIN = 0.13;
const EXPLORE_END = 0.26;
const FOCUS_BEGIN = 0.26;
const FOCUS_END = 0.94;
const FOCUS_WINDOW = (FOCUS_END - FOCUS_BEGIN) / 4; // 0.17
const EXIT_BEGIN = 0.94;

/**
 * Within each focus phase, the per-chunk focus blend ramps:
 *   0   → 1   over the first  RAMP_IN_END   fraction (smoothstep)
 *   1   → 1   for the held middle band
 *   1   → 0   over the last (1 - RAMP_OUT_BEGIN) fraction (smoothstep)
 *
 * 16% / 68% / 16% gives long focused dwell with cinematic ease at both ends.
 */
const FOCUS_RAMP_IN_END = 0.16;
const FOCUS_RAMP_OUT_BEGIN = 0.84;

/** Midpoint of each chunk's focus window — click-to-jump destinations. */
const FOCUS_MIDPOINTS = [
  FOCUS_BEGIN + FOCUS_WINDOW * 0.5,
  FOCUS_BEGIN + FOCUS_WINDOW * 1.5,
  FOCUS_BEGIN + FOCUS_WINDOW * 2.5,
  FOCUS_BEGIN + FOCUS_WINDOW * 3.5,
];

const PHASE_LABELS = [
  "OVERVIEW",
  "SEARCH",
  "TRANSCRIPT",
  "SEGMENT",
  "RANKING",
] as const;
const PHASE_RANGES: ReadonlyArray<[number, number]> = [
  [EXPLORE_BEGIN, EXPLORE_END],
  [FOCUS_BEGIN + FOCUS_WINDOW * 0, FOCUS_BEGIN + FOCUS_WINDOW * 1],
  [FOCUS_BEGIN + FOCUS_WINDOW * 1, FOCUS_BEGIN + FOCUS_WINDOW * 2],
  [FOCUS_BEGIN + FOCUS_WINDOW * 2, FOCUS_BEGIN + FOCUS_WINDOW * 3],
  [FOCUS_BEGIN + FOCUS_WINDOW * 3, FOCUS_BEGIN + FOCUS_WINDOW * 4],
];

const STAGE_NAMES = ["Search", "Transcript", "Segmentation", "Ranking"] as const;

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}
function smoothstep(t: number) {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

export default function PillarSection() {
  const triggerRef = useRef<ScrollTrigger | null>(null);

  const ref = useGsapScroll<HTMLElement>(() => {
    if (!ref.current) return;

    // Section-entry intro animations — match the language of Hero / Problem
    // / etc. Chrome (phase indicator, margin rail, bottom rail) fades up
    // on first section entry; the dissection visual itself is driven by
    // the pinned scrub timeline below.
    gsap.from("[data-anim='pillar-indicator']", {
      opacity: 0,
      y: -10,
      duration: 0.9,
      ease: "expo.out",
      scrollTrigger: {
        trigger: ref.current,
        start: "top 75%",
      },
    });
    gsap.from("[data-anim='pillar-margin-row']", {
      opacity: 0,
      x: -16,
      stagger: 0.08,
      duration: 0.8,
      ease: "expo.out",
      scrollTrigger: {
        trigger: ref.current,
        start: "top 70%",
      },
    });
    gsap.from("[data-anim='pillar-bottom']", {
      opacity: 0,
      y: 12,
      stagger: 0.08,
      duration: 0.8,
      ease: "expo.out",
      scrollTrigger: {
        trigger: ref.current,
        start: "top 70%",
      },
    });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: ref.current,
        start: "top top",
        end: PIN_DISTANCE,
        pin: true,
        scrub: SCRUB_DAMPING,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        // No snap — continuous scroll smoothly fills the phase indicator,
        // and the camera stays pinned on the current chunk until scroll
        // crosses the next window boundary, where it animates to the next.
        onUpdate: (self) => {
          const p = self.progress;
          scrollState.pillarSectionProgress = p;

          // Existing stage indexing kept for upstream consumers (Prism inner
          // rotation, reveal-sweep timing). Same formula as before.
          const idx = Math.max(
            0,
            Math.min(
              3,
              Math.floor((p - PILLAR_STAGE_ENTER) / PILLAR_STAGE_WINDOW),
            ),
          );
          scrollState.pillarActiveStage = idx;
          scrollState.pillarStageSubProgress = clamp01(
            (p - PILLAR_STAGE_ENTER - idx * PILLAR_STAGE_WINDOW) /
              PILLAR_STAGE_WINDOW,
          );

          // Explode amount — phased: ramp up over explode band, hold through
          // overview + focus phases, ramp back down over exit band so the
          // prism returns to sealed before the next section's layout takes over.
          if (p < EXPLODE_BEGIN) {
            scrollState.pillarExplodeAmount = 0;
          } else if (p < EXPLODE_END) {
            scrollState.pillarExplodeAmount = smoothstep(
              (p - EXPLODE_BEGIN) / (EXPLODE_END - EXPLODE_BEGIN),
            );
          } else if (p < EXIT_BEGIN) {
            scrollState.pillarExplodeAmount = 1;
          } else {
            scrollState.pillarExplodeAmount =
              1 - smoothstep((p - EXIT_BEGIN) / (1 - EXIT_BEGIN));
          }

          // Focus + transition logic. Inside a focus window we emit:
          //   - pillarFocusedPart : the integer chunk index for THIS phase,
          //                        held the entire window (no flips to -1)
          //   - pillarFocusBlend  : continuous 0..1 zoom amount, smoothstepped
          //                        up over RAMP_IN, held at 1, smoothstepped
          //                        down over RAMP_OUT.
          // At each phase boundary the blend is exactly 0, so when the
          // integer index flips, every consumer (camera offset, chunk
          // opacity, leader-card position, body fade-in, dot ring) is at
          // its neutral pose — the flip is invisible. As blend ramps back
          // up inside the new phase, the same consumers ease toward the
          // new chunk's pose. Net effect: continuous, jump-free chunk-to-
          // chunk transitions.
          let nextFocus: -1 | 0 | 1 | 2 | 3 = -1;
          let nextBlend = 0;
          let activePhase = -1;
          let phaseStart = 0;
          let phaseEnd = 1;
          if (p >= FOCUS_BEGIN && p < EXIT_BEGIN) {
            const idxFocus = Math.min(
              3,
              Math.floor((p - FOCUS_BEGIN) / FOCUS_WINDOW),
            ) as 0 | 1 | 2 | 3;
            phaseStart = FOCUS_BEGIN + idxFocus * FOCUS_WINDOW;
            phaseEnd = phaseStart + FOCUS_WINDOW;
            const within = clamp01((p - phaseStart) / FOCUS_WINDOW);

            if (within < FOCUS_RAMP_IN_END) {
              nextBlend = smoothstep(within / FOCUS_RAMP_IN_END);
            } else if (within < FOCUS_RAMP_OUT_BEGIN) {
              nextBlend = 1;
            } else {
              nextBlend =
                1 -
                smoothstep(
                  (within - FOCUS_RAMP_OUT_BEGIN) /
                    (1 - FOCUS_RAMP_OUT_BEGIN),
                );
            }
            nextFocus = idxFocus;
            activePhase = 1 + idxFocus;
          } else if (p >= EXPLORE_BEGIN && p < EXPLORE_END) {
            phaseStart = EXPLORE_BEGIN;
            phaseEnd = EXPLORE_END;
            activePhase = 0;
          }
          scrollState.pillarFocusedPart = nextFocus;
          scrollState.pillarFocusBlend = nextBlend;
          scrollState.pillarActivePhase = activePhase;
          scrollState.pillarPhaseProgress =
            activePhase >= 0
              ? clamp01((p - phaseStart) / (phaseEnd - phaseStart))
              : 0;

          // Per-chunk reveal — each chunk ramps 0→1 inside its focus phase.
          // Reveal is smoothstepped and timed to complete just before the
          // ramp-out begins, so the chunk is fully textured before the
          // camera starts zooming back out. Past chunks stay 1 (textured),
          // future chunks stay 0 (white).
          for (let i = 0; i < 4; i++) {
            const start = FOCUS_BEGIN + i * FOCUS_WINDOW;
            const end = start + FOCUS_WINDOW;
            let r: number;
            if (p < start) r = 0;
            else if (p >= end) r = 1;
            else {
              const w = (p - start) / FOCUS_WINDOW;
              // Reveal begins just after ramp-in starts and completes
              // before ramp-out begins, smoothstep-shaped.
              r = smoothstep(clamp01((w - 0.04) / (FOCUS_RAMP_OUT_BEGIN - 0.04)));
            }
            scrollState.pillarChunkReveal[i] = r;
          }

          // Explore zone — overview phase, all four chunks visible, no
          // chunk focused. Hover/click on chunks is gated on this flag.
          scrollState.pillarExploreActive =
            p >= EXPLORE_BEGIN && p < EXPLORE_END;
        },
        onLeave: () => {
          // Hard reset so inSection flips false in Prism.tsx (focus state
          // snaps fast back to the next section's pose).
          scrollState.pillarSectionProgress = 1;
          scrollState.pillarExplodeAmount = 0;
          scrollState.pillarFocusedPart = -1;
          scrollState.pillarFocusBlend = 0;
          scrollState.pillarActivePhase = -1;
          scrollState.pillarExploreActive = false;
        },
        onLeaveBack: () => {
          scrollState.pillarSectionProgress = 0;
          scrollState.pillarExplodeAmount = 0;
          scrollState.pillarFocusedPart = -1;
          scrollState.pillarFocusBlend = 0;
          scrollState.pillarActivePhase = -1;
          scrollState.pillarExploreActive = false;
        },
      },
    });

    triggerRef.current = tl.scrollTrigger ?? null;
  }, []);

  // Click-to-focus: when PrismParts pushes a click intent into
  // pillarPartsState, scroll the page to that chunk's focus midpoint.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const intent = pillarPartsState.pendingClickFocus;
      if (intent >= 0 && triggerRef.current) {
        const trig = triggerRef.current;
        const targetProgress = FOCUS_MIDPOINTS[intent];
        const targetY = trig.start + (trig.end - trig.start) * targetProgress;
        const proxy = { y: window.scrollY };
        gsap.to(proxy, {
          y: targetY,
          duration: 1.4,
          ease: "power3.inOut",
          onUpdate: () => window.scrollTo(0, proxy.y),
        });
        pillarPartsState.pendingClickFocus = -1;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <section
      ref={ref}
      id="pillar-section"
      className="relative w-full h-[100svh] overflow-hidden"
    >
      <PhaseIndicator />

      {/* Margin rail — collapsed dots indicating which stage is in focus */}
      <div className="hidden md:flex absolute left-8 top-[28%] z-30 pointer-events-none flex-col gap-12">
        {STAGE_NAMES.map((name, i) => (
          <MarginRailRow key={i} index={i} name={name} />
        ))}
      </div>

      {/* Bottom rail — keep-scrolling indicator + timecode */}
      <div className="absolute bottom-10 left-0 right-0 px-6 md:px-12 z-30 flex justify-between items-end text-[11px] tracking-[0.25em] uppercase text-white/35 font-mono">
        <span data-anim="pillar-bottom" className="flex items-center gap-3">
          <span className="block w-1.5 h-1.5 rounded-full bg-white/80 animate-shimmer" />
          keep scrolling
        </span>
        <span data-anim="pillar-bottom">
          <StageTimecode />
        </span>
      </div>
    </section>
  );
}

/**
 * Top-of-viewport phase indicator — a single row of five thin segment bars,
 * one per dwell phase (overview + four chunks). Each fills cumulatively as
 * scroll passes through its phase. Past phases stay full, future phases
 * stay empty.
 *
 * Only visible during the dissection content (between explode end and exit
 * begin) so it doesn't intrude on the in/out transitions.
 */
function PhaseIndicator() {
  const containerRef = useRef<HTMLDivElement>(null);
  const segFillRefs = useRef<(HTMLSpanElement | null)[]>(
    PHASE_LABELS.map(() => null),
  );

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const p = scrollState.pillarSectionProgress;
      const activePhase = scrollState.pillarActivePhase;

      // Indicator only shows while we're inside a defined phase. Hides
      // during pre-explode + explode + exit.
      const visible = activePhase >= 0 && p > 0.04 && p < 0.97;
      const c = containerRef.current;
      if (c) c.style.opacity = visible ? "1" : "0";

      // Cumulative segment fills.
      for (let i = 0; i < PHASE_RANGES.length; i++) {
        const [start, end] = PHASE_RANGES[i];
        let fill = 0;
        if (p >= end) fill = 1;
        else if (p > start) fill = (p - start) / (end - start);
        const fEl = segFillRefs.current[i];
        if (fEl) fEl.style.transform = `scaleX(${fill})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={containerRef}
      data-anim="pillar-indicator"
      // top-20 (80 px) clears the fixed nav at z-50 (0–68 px tall) — at
      // smaller offsets the bars sit BEHIND the nav-frost and disappear.
      // z-[55] keeps them above the nav so they read crisp, not blurred
      // by the nav's backdrop-filter.
      className="absolute top-20 md:top-24 left-1/2 -translate-x-1/2 z-[55] pointer-events-none flex items-center justify-center gap-1.5 w-[min(560px,70vw)]"
      style={{ opacity: 0, transition: "opacity 0.6s ease" }}
    >
      {PHASE_LABELS.map((label, i) => (
        <div
          key={label}
          className="relative flex-1 overflow-hidden"
          style={{ height: 1.5, backgroundColor: "rgba(255,255,255,0.12)" }}
        >
          <span
            ref={(el) => {
              segFillRefs.current[i] = el;
            }}
            className="absolute inset-0 bg-white origin-left will-change-transform"
            style={{ transform: "scaleX(0)" }}
          />
        </div>
      ))}
    </div>
  );
}

function MarginRailRow({ index, name }: { index: number; name: string }) {
  const fillRef = useRef<HTMLSpanElement>(null);
  const capRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      // Tie activation to the continuous focus blend, not the integer index.
      // The dot grows + brightens smoothly during ramp-in, holds during the
      // held band, and recedes on ramp-out — same shape as the camera zoom.
      const fp = scrollState.pillarFocusedPart;
      const blend = scrollState.pillarFocusBlend;
      const a = fp === index ? blend : 0;
      if (fillRef.current) {
        fillRef.current.style.opacity = String(a);
        fillRef.current.style.transform = `scale(${0.6 + 0.4 * a})`;
      }
      if (capRef.current) {
        const alpha = 0.4 + 0.6 * a;
        capRef.current.style.color = `rgba(255,255,255,${alpha})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [index]);

  const numeral = ["I", "II", "III", "IV"][index];

  return (
    <div data-anim="pillar-margin-row" className="flex items-center gap-3">
      <div className="relative w-3 h-3">
        <span className="absolute inset-0 rounded-full border border-white/40" />
        <span
          ref={fillRef}
          className="absolute inset-[2px] rounded-full bg-white will-change-transform"
          style={{ opacity: 0, transform: "scale(0.6)" }}
        />
      </div>
      <span
        ref={capRef}
        className="font-mono text-[9px] tracking-[0.32em] uppercase whitespace-nowrap"
        style={{ color: "rgba(255,255,255,0.4)" }}
      >
        [ {numeral} ] {name.toUpperCase()}
      </span>
    </div>
  );
}

/**
 * Decorative timecode in the bottom rail — derived from pillarSectionProgress.
 */
function StageTimecode() {
  const elRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0;
    let last = "";
    const tick = () => {
      const el = elRef.current;
      if (el) {
        const totalSec = scrollState.pillarSectionProgress * 5 * 60;
        const m = Math.floor(totalSec / 60);
        const s = Math.floor(totalSec % 60);
        const text = `T+${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
        if (text !== last) {
          el.textContent = text;
          last = text;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <span ref={elRef}>T+00:00</span>;
}
