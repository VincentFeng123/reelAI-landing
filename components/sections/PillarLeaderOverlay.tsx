"use client";

import { useEffect, useRef } from "react";
import { pillarPartsState } from "@/lib/pillarPartsState";
import { scrollState } from "@/lib/scrollState";

/**
 * Per-piece label overlay for the dissected prism.
 *
 * Architecture: every card is rendered with all of its content (label,
 * title, body, telemetry) at every moment — there is no conditional
 * mount that could pop in. Each card's transform, width, font-size, and
 * the opacity of every internal element are written every frame as a
 * function of the smoothstepped pillarFocusBlend value.
 *
 * As blend ramps 0 → 1 inside the focused chunk's phase:
 *   - the focused card glides from chunk-anchor to fixed right-side pose
 *   - the focused card's title grows + body/telemetry cross-fade in
 *   - non-focused cards fade out smoothly
 *   - the targeting reticle fades in over the focused chunk
 *
 * At each phase boundary blend == 0, so when the integer focused index
 * flips (chunk 0 → chunk 1) every animated property is at its neutral
 * value — the index flip is invisible.
 */

type Stage = {
  n: string;
  title: string;
  body: string;
  telemetry: [string, string, string];
};

const STAGES: Stage[] = [
  {
    n: "I",
    title: "Search",
    body: "We start with the question. The query becomes a search graph that branches across entities and prerequisites.",
    telemetry: ["47 SEEDS", "12 ENTITIES", "3 PREREQS"],
  },
  {
    n: "II",
    title: "Transcript",
    body: "Every word, time-aligned. Diarised speech becomes a navigable substrate the rest of the pipeline operates on.",
    telemetry: ["1,847 LINES", "312 HRS ALIGNED", "DIARIZATION COMPLETE"],
  },
  {
    n: "III",
    title: "Segmentation",
    body: "Long-form lectures collapse into atomic moments. Each carries its own embedding, depth, and bridges.",
    telemetry: ["47 MIN → 11 MOMENTS", "GRAPH DEPTH 4", "BRIDGES 7"],
  },
  {
    n: "IV",
    title: "Ranking",
    body: "Rank what survives the threshold. Clarity, novelty, density — the surviving moments become the answer.",
    telemetry: ["TOP DECILE", "CLARITY · NOVELTY · DENSITY", "THRESHOLD 0.83"],
  },
];

// Overview pose:
//   - chunks 0, 1 (Search, Transcript)    → label hangs BELOW the piece
//                                            (top-center pivot at offset).
//   - chunks 2, 3 (Segmentation, Ranking) → label sits RIGHT of the piece,
//                                            shifted into the lower-right
//                                            of the chunk silhouette
//                                            (left-center pivot at offset).
//
// Per-chunk offsets (px) from the chunk's projected anchor, tuned by
// hand so each caption sits cleanly on/near its piece.
const MINIMAL_OFFSETS: ReadonlyArray<{ x: number; y: number }> = [
  { x:  20, y: 120 }, // 0 Search       — below + slightly right & down
  { x:   0, y: 100 }, // 1 Transcript   — below, centered
  { x:  80, y: -20 }, // 2 Segmentation — right + up
  { x: 110, y:  30 }, // 3 Ranking      — right + slightly down
];
// Detailed pose: card pinned to fixed right side of the viewport when its
// chunk is in focus, vertically centered on the screen mid-line.
const DETAILED_RIGHT_PX = 80;
const DETAILED_WIDTH_PX = 380;
const MINIMAL_WIDTH_PX = 220;

const FONT_SIZE_MIN = 22;
const FONT_SIZE_MAX = 56;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

export default function PillarLeaderOverlay() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null]);
  const titleRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null]);
  const bodyRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null]);
  const dotGroupRef = useRef<SVGGElement>(null);
  // Smoothed opacity / position lerps per card so even fast scroll past
  // a phase boundary looks like a flowing transition rather than a sudden
  // re-layout. Targets are computed from focusBlend below; refs hold the
  // current displayed value.
  const containerOpacityRef = useRef(0);

  useEffect(() => {
    let raf = 0;

    const tick = () => {
      const inSection =
        scrollState.pillarSectionProgress > 0.001 &&
        scrollState.pillarSectionProgress < 0.999;
      const explodeAmount = scrollState.pillarExplodeAmount;
      const focused = scrollState.pillarFocusedPart;
      const focusBlend = scrollState.pillarFocusBlend;

      // Container fades in once the chunks have meaningfully exploded
      // (smoothstep on explodeAmount, not a hard threshold), and out once
      // they recollapse — this matches the smooth ramp-in / ramp-out shape
      // of the prism explode itself.
      const containerTarget =
        inSection && explodeAmount > 0
          ? smoothstep((explodeAmount - 0.4) / 0.45)
          : 0;
      containerOpacityRef.current +=
        (containerTarget - containerOpacityRef.current) * 0.18;
      const container = containerRef.current;
      if (container) {
        container.style.opacity = String(containerOpacityRef.current);
      }

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const detailedX = vw - DETAILED_RIGHT_PX - DETAILED_WIDTH_PX;
      const detailedY = vh / 2;

      for (let i = 0; i < 4; i++) {
        const card = cardRefs.current[i];
        if (!card) continue;

        const ax = pillarPartsState.anchorTargetX[i];
        const ay = pillarPartsState.anchorTargetY[i];
        const visible = pillarPartsState.anchorVisible[i];
        const isFocusedChunk = focused === i;

        // OVERVIEW pose: per-chunk offset from the projected anchor.
        // Top two are below their piece (top-center pivot); bottom two
        // are right of their piece (left-center pivot — same as detailed,
        // so the lerp into focus only animates X/Y, no anchor flip).
        const isRightPose = i >= 2;
        const offset = MINIMAL_OFFSETS[i];
        const minimalX = ax + offset.x;
        const minimalY = ay + offset.y;

        // For the chunk that's currently focused, blend toward the fixed
        // detailed pose proportional to focusBlend. For other chunks,
        // stay at the minimal anchor (their own card simply fades out).
        const blendForCard = isFocusedChunk ? focusBlend : 0;
        const cx = lerp(minimalX, detailedX, blendForCard);
        const cy = lerp(minimalY, detailedY, blendForCard);

        // Width grows smoothly with focus.
        const cardWidth = lerp(
          MINIMAL_WIDTH_PX,
          DETAILED_WIDTH_PX,
          blendForCard,
        );
        // Title size grows smoothly with focus.
        const fontSize = lerp(FONT_SIZE_MIN, FONT_SIZE_MAX, blendForCard);

        // Card opacity: focused chunk stays at 1 (the body fades in
        // separately); non-focused chunks fade out as zoom deepens.
        let cardOpacity: number;
        if (isFocusedChunk) {
          cardOpacity = visible ? 1 : 0;
        } else {
          cardOpacity = visible ? 1 - focusBlend : 0;
        }

        // Centering anchors lerp between three poses:
        //   below pose:  translateX(-50%) translateY(  0%) — top-center anchored at (cx, cy)
        //   right pose:  translateX(  0%) translateY(-50%) — left-center anchored
        //   detailed:    translateX(  0%) translateY(-50%) — same as right pose
        // For chunks 2, 3 (right pose) the centering matches detailed,
        // so xPct/yPct are constant and only X/Y position changes with
        // blend. For chunks 0, 1 the X anchor lerps −50%→0% and the Y
        // anchor lerps 0%→−50%.
        const xPctStart = isRightPose ? 0 : -50;
        const yPctStart = isRightPose ? -50 : 0;
        const xPct = xPctStart + (0 - xPctStart) * blendForCard;
        const yPct = yPctStart + (-50 - yPctStart) * blendForCard;

        card.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(${xPct}%, ${yPct}%)`;
        card.style.width = `${cardWidth}px`;
        card.style.opacity = String(cardOpacity);

        const title = titleRefs.current[i];
        if (title) title.style.fontSize = `${fontSize}px`;

        const body = bodyRefs.current[i];
        if (body) {
          // Body + telemetry only show for the focused chunk, smoothly
          // cross-faded with the zoom blend so the words read as the
          // camera arrives — never a hard pop.
          body.style.opacity = isFocusedChunk ? String(focusBlend) : "0";
        }
      }

      // Targeting dot tracks the focused chunk's anchor and fades in /
      // out with the focus blend. Position swaps to the next chunk only
      // at blend == 0, so the swap is invisible.
      const dotGroup = dotGroupRef.current;
      if (dotGroup) {
        if (focused >= 0) {
          const dx = pillarPartsState.anchorTargetX[focused];
          const dy = pillarPartsState.anchorTargetY[focused];
          dotGroup.setAttribute("transform", `translate(${dx} ${dy})`);
          dotGroup.style.opacity = String(focusBlend);
        } else {
          dotGroup.style.opacity = "0";
        }
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-30 pointer-events-none"
      style={{ opacity: 0 }}
    >
      <svg className="absolute inset-0 w-full h-full" aria-hidden>
        {/* Schematic targeting dot — opacity follows focusBlend each frame. */}
        <g
          ref={dotGroupRef}
          style={{ opacity: 0, transformOrigin: "center" }}
        >
          <circle r="14" fill="rgba(255,255,255,0.06)" />
          <circle
            r="9"
            fill="none"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          <circle
            r="6"
            fill="none"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          <circle r="2" fill="white" />
          <line x1="-13" y1="0" x2="-9" y2="0" stroke="white" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <line x1="9" y1="0" x2="13" y2="0" stroke="white" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <line x1="0" y1="-13" x2="0" y2="-9" stroke="white" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <line x1="0" y1="9" x2="0" y2="13" stroke="white" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        </g>
      </svg>

      {STAGES.map((s, i) => (
        <div
          key={i}
          ref={(el) => {
            cardRefs.current[i] = el;
          }}
          className="absolute top-0 left-0 text-left"
          style={{
            width: MINIMAL_WIDTH_PX,
            opacity: 0,
            willChange: "transform, opacity, width",
          }}
        >
          <div className="font-mono text-[10px] tracking-[0.32em] uppercase text-white/55">
            [ {s.n} ]
          </div>
          <div
            ref={(el) => {
              titleRefs.current[i] = el;
            }}
            className="display mt-1 leading-[0.95] text-white"
            style={{ fontSize: `${FONT_SIZE_MIN}px` }}
          >
            {s.title}
          </div>
          <div
            ref={(el) => {
              bodyRefs.current[i] = el;
            }}
            style={{ opacity: 0, willChange: "opacity" }}
          >
            <p className="text-[14px] text-white/70 mt-4 leading-relaxed text-pretty">
              {s.body}
            </p>
            <ul className="mt-5 space-y-1">
              {s.telemetry.map((t, k) => (
                <li
                  key={k}
                  className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/45"
                >
                  <span className="text-white/30">▸</span> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}
