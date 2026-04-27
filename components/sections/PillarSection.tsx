"use client";

import { useGsapScroll, gsap } from "@/hooks/useGsapScroll";
import { useEffect, useRef, useState } from "react";
import { scrollState } from "@/lib/scrollState";
import {
  PILLAR_LABEL_REVEAL_OFFSET,
  PILLAR_STAGE_BEGINS,
  PILLAR_STAGE_DOT_Y_PCTS,
  PILLAR_STAGE_ENTER,
  PILLAR_STAGE_WINDOW,
} from "@/lib/pillarRevealTimeline";

type Stage = {
  n: string;
  title: string;
  body: string;
  telemetry: [string, string, string];
  quote: string;
  /** Label inset from chosen side, % of viewport */
  labelInsetPct: number;
  /** Fine-tune label block distance from its connector line, in px */
  labelOffsetPx?: number;
  /** Label vertical centre, % of viewport */
  labelTopPct: number;
  side: "left" | "right";
  /** Where the L-line bends, % of viewport horizontally */
  elbowXPct: number;
  /** Dot position on the pillar, % of viewport */
  dotXPct: number;
  dotYPct: number;
  /** Begin position on the master timeline (0..1) */
  begin: number;
};

/**
 * Sequential inspector layout — one stage fully active at a time, others
 * collapse into a left-margin rail of dots. The prism is the fixed reference
 * the inspector circles around.
 */
const STAGES: Stage[] = [
  {
    n: "I", title: "Search",
    body: "We start with the question.",
    telemetry: ["47 SEEDS", "12 ENTITIES", "3 PREREQS"],
    quote: "the question becomes the search graph",
    labelInsetPct: 18, labelOffsetPx: 54, labelTopPct: 23, side: "left",
    elbowXPct: 41, dotXPct: 47, dotYPct: PILLAR_STAGE_DOT_Y_PCTS[0],
    begin: PILLAR_STAGE_BEGINS[0],
  },
  {
    n: "II", title: "Transcript",
    body: "Every word, time-aligned.",
    telemetry: ["1,847 LINES", "312 HRS ALIGNED", "DIARIZATION COMPLETE"],
    quote: "every word, time-aligned",
    labelInsetPct: 18, labelTopPct: 36, side: "right",
    elbowXPct: 59, dotXPct: 53, dotYPct: PILLAR_STAGE_DOT_Y_PCTS[1],
    begin: PILLAR_STAGE_BEGINS[1],
  },
  {
    n: "III", title: "Segmentation",
    body: "Long-form into atomic moments.",
    telemetry: ["47 MIN → 11 MOMENTS", "GRAPH DEPTH 4", "BRIDGES 7"],
    quote: "long-form into atomic moments",
    labelInsetPct: 20, labelOffsetPx: -72, labelTopPct: 60, side: "left",
    elbowXPct: 41, dotXPct: 47, dotYPct: PILLAR_STAGE_DOT_Y_PCTS[2],
    begin: PILLAR_STAGE_BEGINS[2],
  },
  {
    n: "IV", title: "Ranking",
    body: "Rank what survives the threshold.",
    telemetry: ["TOP DECILE", "CLARITY · NOVELTY · DENSITY", "THRESHOLD 0.83"],
    quote: "rank what survives the threshold",
    labelInsetPct: 18, labelTopPct: 78, side: "right",
    elbowXPct: 59, dotXPct: 53, dotYPct: PILLAR_STAGE_DOT_Y_PCTS[3],
    begin: PILLAR_STAGE_BEGINS[3],
  },
];

const LABEL_WIDTH_PX = 280;
const PIN_DISTANCE = "+=400%";
const EXIT_AT = 0.86;
const EXIT_DUR = 0.12;

export default function PillarSection() {
  const [dims, setDims] = useState({ vw: 1920, vh: 1080 });

  useEffect(() => {
    const update = () =>
      setDims({ vw: window.innerWidth, vh: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const ref = useGsapScroll<HTMLElement>(() => {
    if (!ref.current) return;

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: ref.current,
        start: "top top",
        end: PIN_DISTANCE,
        pin: true,
        scrub: 0.6,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const p = self.progress;
          const idx = Math.max(
            0,
            Math.min(3, Math.floor((p - PILLAR_STAGE_ENTER) / PILLAR_STAGE_WINDOW)),
          );
          scrollState.pillarSectionProgress = p;
          scrollState.pillarActiveStage = idx;
          scrollState.pillarStageSubProgress = Math.max(
            0,
            Math.min(
              1,
              (p - PILLAR_STAGE_ENTER - idx * PILLAR_STAGE_WINDOW) /
                PILLAR_STAGE_WINDOW,
            ),
          );
        },
      },
    });

    STAGES.forEach((s, i) => {
      const B = s.begin;

      // Phase 1 — outgoing previous stage transitions to "past".
      // Use autoAlpha so visibility flips to hidden at alpha 0 — kills any
      // sub-pixel paint residue from text/SVG that opacity-only tweens leave.
      if (i >= 1) {
        const prev = i - 1;
        const prevSide = STAGES[prev].side;
        tl.to(`[data-stage-line='${prev}']`,
          { autoAlpha: 0, duration: 0.04, ease: "power2.in" }, B);
        tl.to(
          `[data-stage-cap='${prev}'], [data-stage-hash='${prev}'], [data-stage-elbow='${prev}'], [data-stage-terminal='${prev}']`,
          { autoAlpha: 0, duration: 0.04 }, B);
        tl.to(`[data-stage-dot='${prev}']`,
          { autoAlpha: 0, scale: 0.7, duration: 0.04 }, B);
        tl.to(`[data-stage-label='${prev}']`,
          { autoAlpha: 0, x: prevSide === "left" ? -20 : 20, duration: 0.04, ease: "power2.in" }, B);
        tl.to(`[data-stage-quote='${prev}']`,
          { autoAlpha: 0, duration: 0.03 }, B);
        // Margin slot for prev returns to its default inactive state:
        // hollow ring visible, fill hidden, cap reverts to gray.
        tl.to(`[data-margin-ring='${prev}']`,
          { autoAlpha: 1, duration: 0.04 }, B);
        tl.to(`[data-margin-fill='${prev}']`,
          { autoAlpha: 0, scale: 0.6, duration: 0.04 }, B);
        tl.to(`[data-margin-cap='${prev}']`,
          { color: "rgba(255,255,255,0.4)", duration: 0.04 }, B);
      }

      // This stage's margin slot becomes active: hide ring, reveal filled
      // circle, brighten caption to white.
      tl.to(`[data-margin-ring='${i}']`,
        { autoAlpha: 0, duration: 0.04 }, B + 0.02);
      tl.fromTo(`[data-margin-fill='${i}']`,
        { opacity: 0, scale: 0.6 },
        { opacity: 1, scale: 1, duration: 0.04, ease: "expo.out", transformOrigin: "center" }, B + 0.02);
      tl.to(`[data-margin-cap='${i}']`,
        { color: "rgba(255,255,255,1)", duration: 0.04 }, B + 0.02);

      // Phase 2 — scaffolding draws (line + cap + hash + elbow + terminal + dot)
      tl.to(`[data-stage-line='${i}']`,
        { strokeDashoffset: 0, opacity: 1, duration: 0.06, ease: "none" }, B + 0.04);
      tl.to(`[data-stage-cap='${i}']`,
        { opacity: 1, duration: 0.04, ease: "power2.out" }, B + 0.04);
      tl.to(`[data-stage-hash='${i}']`,
        { opacity: 1, duration: 0.04, stagger: 0.01 }, B + 0.05);
      tl.fromTo(`[data-stage-elbow='${i}']`,
        { opacity: 0, scale: 0 },
        { opacity: 1, scale: 1, duration: 0.04, ease: "expo.out", transformOrigin: "center" }, B + 0.06);
      tl.fromTo(`[data-stage-terminal='${i}']`,
        { opacity: 0, scale: 0 },
        { opacity: 1, scale: 1, duration: 0.04, ease: "expo.out", transformOrigin: "center" }, B + 0.07);
      tl.fromTo(`[data-stage-dot='${i}']`,
        { opacity: 0, scale: 0 },
        { opacity: 1, scale: 1, duration: 0.05, ease: "expo.out", transformOrigin: "center" }, B + 0.08);

      // Phase 3 — active label block reveal
      tl.fromTo(`[data-stage-label='${i}']`,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.06, ease: "expo.out" },
        B + PILLAR_LABEL_REVEAL_OFFSET);

      // Phase 3b — bottom blueprint quote swap-in
      tl.fromTo(`[data-stage-quote='${i}']`,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.04, ease: "expo.out" },
        B + PILLAR_LABEL_REVEAL_OFFSET + 0.02);
    });

    // Exit transition — blueprint plate slides off. autoAlpha sets
    // visibility: hidden when alpha hits 0, eliminating any sub-pixel paint
    // residue from text/SVG that opacity-only tweens leave behind.
    tl.to(
      "[data-margin-ring], [data-margin-fill], [data-margin-cap]",
      { autoAlpha: 0, x: -40, duration: EXIT_DUR, ease: "power2.in" }, EXIT_AT);
    tl.to("[data-stage-label]",
      { autoAlpha: 0, y: -24, duration: EXIT_DUR, ease: "power2.in" }, EXIT_AT);
    tl.to("[data-stage-line]",
      { autoAlpha: 0, strokeDashoffset: 100, duration: EXIT_DUR, ease: "power2.in" }, EXIT_AT);
    tl.to(
      "[data-stage-cap], [data-stage-hash], [data-stage-elbow], [data-stage-terminal]",
      { autoAlpha: 0, duration: EXIT_DUR }, EXIT_AT);
    tl.to("[data-stage-dot]",
      { autoAlpha: 0, scale: 0.6, duration: EXIT_DUR }, EXIT_AT);
    tl.to("[data-stage-quote]",
      { autoAlpha: 0, scale: 0.96, duration: EXIT_DUR }, EXIT_AT);
    // Bottom rail static elements — "▸ keep scrolling" + timecode + the
    // quote container — fade together so nothing lingers below the section.
    tl.to("[data-bottom-rail]",
      { autoAlpha: 0, duration: EXIT_DUR, ease: "power2.in" }, EXIT_AT);

    // Safety net — visibility-hide everything at the very last sliver of
    // the timeline so reverse-scroll restores correctly while forward-scroll
    // never leaves residue.
    tl.set(
      "[data-stage-label], [data-stage-line], [data-stage-cap], [data-stage-hash], [data-stage-elbow], [data-stage-terminal], [data-stage-dot], [data-stage-quote], [data-margin-ring], [data-margin-fill], [data-margin-cap], [data-bottom-rail]",
      { autoAlpha: 0 },
      0.999,
    );
  }, []);

  const { vw, vh } = dims;

  return (
    <section
      ref={ref}
      id="pillar-section"
      className="relative w-full h-[100svh] overflow-hidden"
    >
      {/* Margin rail — collapsed dots for past + future stages */}
      <div className="hidden md:flex absolute left-8 top-[28%] z-30 pointer-events-none flex-col gap-12">
        {STAGES.map((s, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="relative w-3 h-3">
              <span
                data-margin-ring={i}
                className="absolute inset-0 rounded-full border border-white/40"
                style={{ opacity: 1 }}
              />
              <span
                data-margin-fill={i}
                className="absolute inset-[2px] rounded-full bg-white"
                style={{ opacity: 0, transform: "scale(0.6)" }}
              />
            </div>
            <span
              data-margin-cap={i}
              className="font-mono text-[9px] tracking-[0.32em] uppercase whitespace-nowrap"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              [ {s.n} ] {s.title.toUpperCase()}
            </span>
          </div>
        ))}
      </div>

      {/* SVG line work — caps, hash marks, polylines, elbow nodes, terminal rings */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-20"
        viewBox={`0 0 ${vw} ${vh}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        {STAGES.map((s, i) => {
          const labelInset = (s.labelInsetPct / 100) * vw;
          const startX =
            s.side === "left"
              ? labelInset + LABEL_WIDTH_PX
              : vw - labelInset - LABEL_WIDTH_PX;
          const startY = (s.labelTopPct / 100) * vh;
          const elbowX = (s.elbowXPct / 100) * vw;
          const elbowY = startY;
          const dotX = (s.dotXPct / 100) * vw;
          const dotY = (s.dotYPct / 100) * vh;
          const points = `${startX},${startY} ${elbowX},${elbowY} ${dotX},${dotY}`;
          const capLen = 5;
          const hashAtRatio = (r: number) =>
            startX + (elbowX - startX) * r;

          return (
            <g key={i}>
              {/* Cap at label end */}
              <line
                data-stage-cap={i}
                x1={startX} y1={startY - capLen}
                x2={startX} y2={startY + capLen}
                stroke="rgba(255,255,255,0.7)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
                style={{ opacity: 0 }}
              />

              {/* Hash marks at 25/50/75% along horizontal segment */}
              {[0.25, 0.5, 0.75].map((r, j) => (
                <line
                  key={j}
                  data-stage-hash={i}
                  x1={hashAtRatio(r)} y1={startY - 3}
                  x2={hashAtRatio(r)} y2={startY + 3}
                  stroke="rgba(255,255,255,0.5)"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                  style={{ opacity: 0 }}
                />
              ))}

              {/* Polyline */}
              <polyline
                data-stage-line={i}
                points={points}
                stroke="rgba(255,255,255,0.95)"
                strokeWidth="1.2"
                fill="none"
                strokeLinecap="butt"
                strokeLinejoin="miter"
                vectorEffect="non-scaling-stroke"
                pathLength={100}
                strokeDasharray={100}
                strokeDashoffset={100}
                style={{ opacity: 0 }}
              />

              {/* Elbow node — filled circle + outer hairline ring */}
              <g
                data-stage-elbow={i}
                style={{
                  transformOrigin: `${elbowX}px ${elbowY}px`,
                  opacity: 0,
                }}
              >
                <circle cx={elbowX} cy={elbowY} r="2.5" fill="white" />
                <circle
                  cx={elbowX} cy={elbowY} r="5"
                  fill="none"
                  stroke="rgba(255,255,255,0.6)"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              </g>

              {/* Terminal hairline ring around prism dot */}
              <g
                data-stage-terminal={i}
                style={{
                  transformOrigin: `${dotX}px ${dotY}px`,
                  opacity: 0,
                }}
              >
                <circle
                  cx={dotX} cy={dotY} r="10"
                  fill="none"
                  stroke="rgba(255,255,255,0.4)"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            </g>
          );
        })}
      </svg>

      {/* Reticle dots on the prism — schematic targeting */}
      {STAGES.map((s, i) => (
        <div
          key={s.n}
          data-stage-dot={i}
          className="absolute z-30 pointer-events-none"
          style={{
            top: `${s.dotYPct}%`,
            left: `${s.dotXPct}%`,
            transform: "translate(-50%, -50%) scale(0)",
            opacity: 0,
          }}
        >
          <PillarReticle />
        </div>
      ))}

      {/* Active label blocks — only one fully visible at a time */}
      {STAGES.map((s, i) => {
        const isLeft = s.side === "left";
        const labelOffset = s.labelOffsetPx ?? 0;
        return (
          <div
            key={s.n}
            data-stage-label={i}
            className="absolute z-30 pointer-events-none"
            style={{
              top: `${s.labelTopPct}%`,
              [isLeft ? "left" : "right"]: `calc(${s.labelInsetPct}% + ${
                isLeft ? labelOffset : -labelOffset
              }px)`,
              transform: "translateY(-50%)",
              opacity: 0,
              width: LABEL_WIDTH_PX,
            }}
          >
            <div className={isLeft ? "text-left" : "text-right"}>
              <div className="font-mono text-[10px] tracking-[0.32em] uppercase text-white/55">
                [ {s.n} ]
              </div>
              <div className="display text-[clamp(40px,4vw,60px)] mt-2 leading-[0.92] text-white">
                {s.title}
              </div>
              <p
                className="text-[14px] text-white/70 mt-3 leading-relaxed max-w-[280px] text-pretty"
                style={isLeft ? undefined : { marginLeft: "auto" }}
              >
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
        );
      })}

      {/* Bottom rail — keep-scrolling · blueprint quote · timecode */}
      <div
        data-bottom-rail
        className="absolute bottom-10 left-0 right-0 px-6 md:px-12 z-30 flex justify-between items-end text-[11px] tracking-[0.25em] uppercase text-white/35 font-mono"
      >
        <span className="flex items-center gap-3">
          <span className="block w-1.5 h-1.5 rounded-full bg-white/80 animate-shimmer" />
          keep scrolling
        </span>
        <div className="relative h-5 w-full max-w-[520px] hidden md:flex items-center justify-center">
          {STAGES.map((s, i) => (
            <span
              key={i}
              data-stage-quote={i}
              className="absolute whitespace-nowrap"
              style={{ opacity: 0 }}
            >
              <span className="text-white/30 mr-2">//</span>
              <span className="display italic text-[clamp(13px,1.2vw,17px)] text-white/55 tracking-normal normal-case">
                {s.quote}
              </span>
            </span>
          ))}
        </div>
        <StageTimecode />
      </div>
    </section>
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

/**
 * Schematic targeting reticle — corner brackets, side ticks, diamond
 * centre, soft halo. Mirrors the cursor language for visual cohesion.
 */
function PillarReticle() {
  return (
    <div className="relative w-7 h-7 pillar-dot-pulse">
      {/* Halo */}
      <span
        className="absolute inset-[-8px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.22) 0%, transparent 65%)",
        }}
      />
      {/* Corner brackets */}
      <span className="absolute top-0 left-0 w-1.5 h-px bg-white" />
      <span className="absolute top-0 left-0 w-px h-1.5 bg-white" />
      <span className="absolute top-0 right-0 w-1.5 h-px bg-white" />
      <span className="absolute top-0 right-0 w-px h-1.5 bg-white" />
      <span className="absolute bottom-0 left-0 w-1.5 h-px bg-white" />
      <span className="absolute bottom-0 left-0 w-px h-1.5 bg-white" />
      <span className="absolute bottom-0 right-0 w-1.5 h-px bg-white" />
      <span className="absolute bottom-0 right-0 w-px h-1.5 bg-white" />
      {/* Side ticks */}
      <span className="absolute top-1/2 left-0 -translate-y-1/2 w-1 h-px bg-white/70" />
      <span className="absolute top-1/2 right-0 -translate-y-1/2 w-1 h-px bg-white/70" />
      <span className="absolute top-0 left-1/2 -translate-x-1/2 h-1 w-px bg-white/70" />
      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-px bg-white/70" />
      {/* Centre diamond */}
      <span
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white"
        style={{ transform: "translate(-50%, -50%) rotate(45deg)" }}
      />
    </div>
  );
}
