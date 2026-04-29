"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Shard } from "@/lib/prismSplit";
import { scrollState } from "@/lib/scrollState";

/**
 * Loader-only assembly animation: ~60 organic 3-D shards descend from a
 * wide top ring along 1/x curves, fanning inward to their final centroid
 * positions through a narrow bottom ring around the prism's silhouette.
 * Sequenced bottom-to-top so the prism builds from the floor up. Drives
 * entirely off `scrollState.loaderProgress` (0→1 from LoadingScreen) and
 * `scrollState.loaderActive` (true while assembling).
 *
 * Trajectory geometry — a funnel:
 *   - WIDE TOP RING at radius `WIDE_RING_RADIUS`, lifted
 *     `RISE_HEIGHT` above the centroid: every shard's `origin` (curve
 *     start). The shard spawns here.
 *   - NARROW BOTTOM RING at radius `NARROW_RING_RADIUS`, at the
 *     centroid's own y level: every shard's `approach` (curve
 *     asymptote, same azimuth as `origin`). The path narrows through
 *     this ring as it converges on the centroid.
 *
 * Local 2-D frame:
 *   y-axis (in 3-D) = origin   − approach  (UP + outward radial)
 *   x-axis (in 3-D) = centroid − approach  (inward horizontal to centroid)
 *
 * Curve: x = mix(eps, 1, tt); y = (1/x − 1) / (1/eps − 1).
 *   tt=0: x=eps, y=1, xNorm=0 → position = origin (wide ring, top).
 *   tt=1: x=1,   y=0, xNorm=1 → position = centroid.
 *   Between, the y component decays as 1/x (descending sharply at
 *   first, levelling out) while xNorm grows linearly — shards drop
 *   from the wide top ring, then arc horizontally inward through the
 *   narrow bottom ring to their slot. Each path traces the same
 *   "wide-top fanning into a narrow point" silhouette.
 */

/**
 * Each shard's fly window length, as a fraction of total progress. With
 * `ASSEMBLY_DURATION_MS = 8500` in LoadingScreen this gives every shard
 * a ~1530 ms flight — slow enough that each piece visibly drifts down
 * through the extreme funnel rather than zipping past. Pct alignment
 * preserved by the `(t - FLY_WINDOW) / (1 - FLY_WINDOW)` formula on the
 * LoadingScreen side. Keep in sync with `ASSEMBLY_FLY_WINDOW` there.
 */
const FLY_WINDOW = 0.18;

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}
function smoothstep(t: number) {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}
function easeOutCubic(t: number) {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
}

function makeRandom(seedInit: number) {
  let s = seedInit | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Trajectory = {
  /** Approach point (curve asymptote, near centroid along tangent). */
  ax: number;
  ay: number;
  az: number;
  /** Origin point on the outer ring. */
  ox: number;
  oy: number;
  oz: number;
  /** 1/x curve tightness — bigger eps = gentler curve. */
  eps: number;
};

type Props = {
  shards: Shard[];
  material: THREE.Material;
};

export default function PrismAssemblyShards({ shards, material }: Props) {
  const groupRefs = useRef<(THREE.Group | null)[]>([]);

  // Track which shards have ever started flying. Once a shard's fly-in has
  // begun we keep its group `visible` true for the rest of the loader so it
  // doesn't disappear if loaderProgress jitters backwards.
  const startedRef = useRef<boolean[]>([]);
  useEffect(() => {
    startedRef.current = new Array(shards.length).fill(false);
  }, [shards.length]);

  // Pre-compute each shard's funnel trajectory once on mount. The curve
  // is then evaluated per frame using these endpoints — cheap.
  const trajectories = useMemo<Trajectory[]>(() => {
    const random = makeRandom(0xa11c00 ^ shards.length);

    // Extreme funnel — wide ring is FAR out and HIGH above the prism;
    // narrow ring at the bottom is much smaller than the prism's outer
    // silhouette so the convergence point reads as "really really
    // small." With NARROW < prism radius (~1.1), some shards' x-axis
    // (centroid − approach) points outward, which means the path
    // converges into the narrow ring then EXPANDS out to the centroid
    // — the "stacking out from a tight central point" feel the user
    // wants.
    const WIDE_RING_RADIUS = 9.0;
    const NARROW_RING_RADIUS = 0.4;
    const RISE_HEIGHT = 9.0;

    return shards.map((shard) => {
      const cx = shard.center.x;
      const cy = shard.center.y;
      const cz = shard.center.z;

      // Azimuth: the centroid's angle around the prism's vertical axis.
      // Shards near the axis fall back to a random angle so they spread
      // around the wide ring rather than collapsing to one spot.
      const rLen = Math.hypot(cx, cz);
      const fallbackAngle = random() * Math.PI * 2;
      let angle = rLen > 0.001 ? Math.atan2(cz, cx) : fallbackAngle;
      // ±0.2 rad jitter (~±11°) so shards at similar azimuths don't
      // share an exact entry point on the wide ring.
      angle += (random() - 0.5) * 0.4;

      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // Approach: narrow bottom ring, at the centroid's own y. Same
      // azimuth as the centroid so the curve's x-axis (centroid −
      // approach) is purely horizontal-inward.
      const ax = NARROW_RING_RADIUS * cosA;
      const ay = cy;
      const az = NARROW_RING_RADIUS * sinA;

      // Origin: wide top ring, DIRECTLY ABOVE approach in the same
      // azimuth. The curve's y-axis (origin − approach) points UP
      // and outward — the 1/x curve traverses from y=1 (origin, above)
      // to y=0 (approach, at centroid level), i.e. descending in
      // world space and converging inward.
      const ox = WIDE_RING_RADIUS * cosA;
      const oy = ay + RISE_HEIGHT;
      const oz = WIDE_RING_RADIUS * sinA;

      const eps = 0.18 + random() * 0.07;

      return { ax, ay, az, ox, oy, oz, eps };
    });
  }, [shards]);

  useFrame(() => {
    const progress = scrollState.loaderProgress;
    const loaderActive = scrollState.loaderActive;

    // Solid material — no opacity fade. Shards become invisible the
    // instant the loader hands off, and at that moment the uncut
    // displayMesh in Prism.tsx becomes visible at the same silhouette
    // (the assembled shards form the prism shape). Same-shape swap, no
    // visible pop.

    const shardCount = shards.length;
    if (shardCount === 0) return;
    const denom = shardCount > 1 ? shardCount - 1 : 1;

    for (let i = 0; i < shardCount; i++) {
      const g = groupRefs.current[i];
      if (!g) continue;
      const shard = shards[i];
      const traj = trajectories[i];

      // Stagger fly-in starts evenly across [0, 1 - FLY_WINDOW] so the
      // last shard finishes exactly at progress=1.
      const flyStart = (i / denom) * (1 - FLY_WINDOW);
      const t = clamp01((progress - flyStart) / FLY_WINDOW);

      // smoothstep on t gives a gentle entry + landing on top of the
      // 1/x curve's natural shape; without it, the start and end of the
      // sweep would be slightly abrupt.
      const tt = smoothstep(t);
      const eps = traj.eps;
      const xVal = eps + (1 - eps) * tt;
      const yVal = (1 / xVal - 1) / (1 / eps - 1);
      const xNorm = (xVal - eps) / (1 - eps);

      // pos = approach + (centroid − approach) · xNorm
      //                + (origin   − approach) · yVal
      // At tt=0 → origin. At tt=1 → centroid.
      let px =
        traj.ax +
        (shard.center.x - traj.ax) * xNorm +
        (traj.ox - traj.ax) * yVal;
      let py =
        traj.ay +
        (shard.center.y - traj.ay) * xNorm +
        (traj.oy - traj.ay) * yVal;
      let pz =
        traj.az +
        (shard.center.z - traj.az) * xNorm +
        (traj.oz - traj.az) * yVal;

      // Hard surface lock over the last 6% so floating-point drift in
      // the curve eval can't leave the shard a hair off its slot when
      // adjacent chunks fade in at hand-off.
      const surfaceLock = smoothstep((t - 0.94) / 0.06);
      px += (shard.center.x - px) * surfaceLock;
      py += (shard.center.y - py) * surfaceLock;
      pz += (shard.center.z - pz) * surfaceLock;

      g.position.x = px;
      g.position.y = py;
      g.position.z = pz;

      // Rotation finishes a beat ahead of position (×1.15 on t) so the
      // shard reads as upright while still gliding in.
      const rotT = easeOutCubic(Math.min(1, t * 1.15));
      const rotAmount = 1 - rotT;
      g.rotation.x = shard.startRotation.x * rotAmount;
      g.rotation.y = shard.startRotation.y * rotAmount;
      g.rotation.z = shard.startRotation.z * rotAmount;

      if (t > 0) startedRef.current[i] = true;
      g.visible =
        loaderActive && (startedRef.current[i] === true || t > 0);
    }
  });

  const meshes = useMemo(
    () =>
      shards.map((shard, i) => (
        <group
          key={i}
          ref={(el) => {
            groupRefs.current[i] = el;
          }}
          visible={false}
        >
          <mesh
            geometry={shard.geometry}
            material={material}
            frustumCulled={false}
            castShadow={false}
            receiveShadow={false}
            raycast={() => undefined}
          />
        </group>
      )),
    [shards, material],
  );

  useEffect(() => {
    return () => {
      for (const shard of shards) shard.geometry.dispose();
    };
  }, [shards]);

  return <group>{meshes}</group>;
}
