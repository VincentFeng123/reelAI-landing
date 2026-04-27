"use client";

import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { scrollState } from "@/lib/scrollState";

type Vec3 = [number, number, number];

type Stage = {
  id: string;
  n: string;
  title: string;
  desc: string;
  start: Vec3; // line starts here, just outside the prism
  elbow: Vec3; // diagonal goes from start → elbow
  end: Vec3; // horizontal continues from elbow → end (where label sits)
  side: "left" | "right";
  beginAt: number; // heroProgress where line begins drawing
  endAt: number; // heroProgress where text is fully shown
};

/**
 * 4 stages, sequenced through the first viewport of scroll.
 * Each line is short (~1 world unit), thin, dashed, and B&W.
 * Phase 1 of each: diagonal leader from prism. Phase 2: horizontal extension.
 * Phase 3: text fades in.
 */
const STAGES: Stage[] = [
  {
    id: "search",
    n: "I",
    title: "Search",
    desc: "topic → entities",
    start: [-0.62, 0.42, 0],
    elbow: [-0.95, 0.7, 0],
    end: [-1.45, 0.7, 0],
    side: "left",
    beginAt: 0.05,
    endAt: 0.22,
  },
  {
    id: "transcript",
    n: "II",
    title: "Transcript",
    desc: "speech · time-aligned",
    start: [0.62, 0.42, 0],
    elbow: [0.95, 0.7, 0],
    end: [1.45, 0.7, 0],
    side: "right",
    beginAt: 0.24,
    endAt: 0.41,
  },
  {
    id: "segment",
    n: "III",
    title: "Segmentation",
    desc: "lectures → moments",
    start: [0.62, -0.42, 0],
    elbow: [0.95, -0.7, 0],
    end: [1.45, -0.7, 0],
    side: "right",
    beginAt: 0.43,
    endAt: 0.6,
  },
  {
    id: "rank",
    n: "IV",
    title: "Ranking",
    desc: "clarity · novelty",
    start: [-0.62, -0.42, 0],
    elbow: [-0.95, -0.7, 0],
    end: [-1.45, -0.7, 0],
    side: "left",
    beginAt: 0.62,
    endAt: 0.79,
  },
];

// --- helpers ----------------------------------------------------------------

const DIAGONAL_FRACTION = 0.55; // 55% of line draw time spent on the diagonal
const TEXT_FRACTION = 0.35; // last 35% of slot is the text fade-in

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

// --- single label component -------------------------------------------------

function StageLabel({ stage }: { stage: Stage }) {
  const lineRef = useRef<any>(null);
  const startDotRef = useRef<THREE.Mesh>(null);
  const endDotRef = useRef<THREE.Mesh>(null);
  const htmlInnerRef = useRef<HTMLDivElement>(null);
  const prevLineProgress = useRef<number>(-1);

  const startV = useMemo(() => new THREE.Vector3(...stage.start), [stage]);
  const elbowV = useMemo(() => new THREE.Vector3(...stage.elbow), [stage]);
  const endV = useMemo(() => new THREE.Vector3(...stage.end), [stage]);

  useFrame(() => {
    const heroP = scrollState.heroProgress;
    const sceneP = scrollState.progress;

    const slot = stage.endAt - stage.beginAt;
    const lineWindow = slot * (1 - TEXT_FRACTION);
    const textBegin = stage.beginAt + lineWindow;

    const lineProgress = clamp01((heroP - stage.beginAt) / lineWindow);
    const textOpacity = clamp01((heroP - textBegin) / (slot * TEXT_FRACTION));

    // Hide everything once we've scrolled into the Problem section.
    const exitFade = 1 - THREE.MathUtils.smoothstep(sceneP, 0.16, 0.28);

    // --- update line geometry: diagonal first, then horizontal -----------
    if (lineProgress !== prevLineProgress.current) {
      let positions: number[];

      if (lineProgress <= 0) {
        positions = [
          startV.x, startV.y, startV.z,
          startV.x, startV.y, startV.z,
          startV.x, startV.y, startV.z,
        ];
      } else if (lineProgress < DIAGONAL_FRACTION) {
        // Phase 1 — diagonal segment grows from start toward elbow.
        const t = lineProgress / DIAGONAL_FRACTION;
        const tip = new THREE.Vector3().lerpVectors(startV, elbowV, t);
        positions = [
          startV.x, startV.y, startV.z,
          tip.x, tip.y, tip.z,
          tip.x, tip.y, tip.z,
        ];
      } else {
        // Phase 2 — horizontal segment continues from elbow toward end.
        const t = (lineProgress - DIAGONAL_FRACTION) / (1 - DIAGONAL_FRACTION);
        const tip = new THREE.Vector3().lerpVectors(elbowV, endV, t);
        positions = [
          startV.x, startV.y, startV.z,
          elbowV.x, elbowV.y, elbowV.z,
          tip.x, tip.y, tip.z,
        ];
      }

      const ln = lineRef.current;
      if (ln?.geometry?.setPositions) {
        ln.geometry.setPositions(positions);
      }
      prevLineProgress.current = lineProgress;
    }

    // --- material / opacity (all smoothly faded) ------------------------
    const ln = lineRef.current;
    if (ln?.material) {
      const lineAlpha = Math.min(1, lineProgress * 12); // fade in fast
      ln.material.opacity = lineAlpha * 0.7 * exitFade;
      ln.material.transparent = true;
    }

    if (startDotRef.current) {
      const mat = startDotRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.min(1, lineProgress * 8) * exitFade;
    }

    if (endDotRef.current) {
      const mat = endDotRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = THREE.MathUtils.smoothstep(lineProgress, 0.92, 1) * exitFade;
    }

    // --- text fade in / slight rise -------------------------------------
    if (htmlInnerRef.current) {
      const op = textOpacity * exitFade;
      const offsetX = stage.side === "left" ? -110 : 10; // %
      const ty = (1 - textOpacity) * 8; // px
      htmlInnerRef.current.style.opacity = String(op);
      htmlInnerRef.current.style.transform = `translateX(${offsetX}%) translateY(${ty}px)`;
    }
  });

  return (
    <group>
      <Line
        ref={lineRef}
        points={[stage.start, stage.elbow, stage.end]}
        color="white"
        lineWidth={1}
        dashed
        dashSize={0.05}
        gapSize={0.04}
        transparent
        opacity={0}
      />

      {/* Tiny dot at the prism end of the line */}
      <mesh ref={startDotRef} position={stage.start}>
        <sphereGeometry args={[0.018, 16, 16]} />
        <meshBasicMaterial color="white" transparent opacity={0} />
      </mesh>

      {/* Hairline ring at the label end of the line, appears once line is full */}
      <mesh ref={endDotRef} position={stage.end}>
        <ringGeometry args={[0.035, 0.05, 32]} />
        <meshBasicMaterial
          color="white"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Label text — anchored to the line's end, aligned outward */}
      <Html
        position={stage.end}
        center
        zIndexRange={[40, 30]}
        style={{ pointerEvents: "none" }}
      >
        <div
          ref={htmlInnerRef}
          className="pointer-events-none"
          style={{
            opacity: 0,
            transform:
              stage.side === "left"
                ? "translateX(-110%) translateY(8px)"
                : "translateX(10%) translateY(8px)",
            whiteSpace: "nowrap",
          }}
        >
          <div className={stage.side === "left" ? "text-right" : "text-left"}>
            <div className="font-mono text-[10px] tracking-[0.32em] uppercase text-white/45">
              [ {stage.n} ]
            </div>
            <div className="display text-[18px] md:text-[22px] mt-1 leading-none text-white">
              {stage.title}
            </div>
            <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-white/55 mt-2">
              {stage.desc}
            </div>
          </div>
        </div>
      </Html>
    </group>
  );
}

// --- diagram root -----------------------------------------------------------

export default function PrismDiagram() {
  return (
    <group>
      {STAGES.map((s) => (
        <StageLabel key={s.id} stage={s} />
      ))}
    </group>
  );
}
