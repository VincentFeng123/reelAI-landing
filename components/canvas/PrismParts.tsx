"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  splitSceneIntoQuadrants,
  fractureChunk,
  type FullSplitResult,
} from "@/lib/prismSplit";
import { applyPrismRevealShader } from "@/lib/prismRevealShader";
import { pillarPartsState } from "@/lib/pillarPartsState";
import { scrollState } from "@/lib/scrollState";
import PrismParticles from "./PrismParticles";

type Props = {
  cloned: THREE.Object3D;
  /** When true, the surface particle field is suppressed (low-end mode). */
  reduced?: boolean;
  /**
   * Fired once on mount with the computed split result so Prism.tsx can
   * derive loader shards from the SAME volumetric main+debris geometries
   * (no duplicate CSG work).
   */
  onSplitReady?: (split: FullSplitResult) => void;
};

/** Base multiplier on each chunk's outward vector at full explode. */
const EXPLODE_SCALE = 0.7;

/**
 * Target debris count per main chunk. Actual count may be lower if the
 * rejection sampler in fractureChunk can't fit `DEBRIS_PER_CHUNK`
 * non-overlapping cuts inside the chunk's bbox within its attempt budget.
 *
 * Bumped from 7 → 16 so the loader has 4 mains + ~60 debris ≈ 60+ visible
 * volumetric shards to assemble (count is a target; rejection sampling
 * usually lands somewhere in the 12-15 range per chunk). Section II's
 * explode has more debris pieces flying around as a side-effect, which
 * reads as "more shattered" rather than chaotic.
 */
const DEBRIS_PER_CHUNK = 16;

/**
 * Per-chunk explode amplitude. Top and bottom slabs travel a bit further so
 * the shape comes apart unevenly; tuned to keep all four within the viewport
 * even at full explode + tilt + section scale. Index 0 = top, 3 = bottom.
 */
const PER_CHUNK_EXPLODE: ReadonlyArray<number> = [1.05, 0.6, 0.75, 1.15];

/**
 * Per-chunk tumble rotation at full explode (radians, around chunk centroid).
 * Asymmetric so each shard has its own personality. All return to (0,0,0)
 * when explodeAmount is 0 so the prism reads as a single sealed crystal.
 */
const PER_CHUNK_ROT: ReadonlyArray<{ x: number; y: number; z: number }> = [
  { x:  0.32, y:  0.10, z: -0.18 },
  { x: -0.18, y: -0.22, z:  0.30 },
  { x:  0.22, y:  0.18, z: -0.24 },
  { x: -0.40, y: -0.08, z:  0.42 },
];

/** Per-chunk position lerp speed — higher = snappier follow on explode/focus. */
const POSITION_LERP = 0.12;

/**
 * Renders the prism as four CSG-split chunks. Architecture:
 *   - mesh.position = -centers[i] places the geometry at chunkGroup origin,
 *   - chunkGroup.position lerps from centers[i] (sealed) → centers[i] +
 *     outward at full explode. Effect: chunkGroup origin tracks the
 *     chunk's own centroid, so chunkGroup rotation tumbles the shard
 *     around its centre rather than orbiting it.
 *   - the anchor Object3D sits at chunkGroup origin and follows the
 *     centroid through explode + tumble + focus.
 *
 * The focused chunk's centroid (chunkGroup.position after lerp) is written
 * to scrollState each frame for Prism.tsx to consume — Prism uses it to
 * translate the outer group so the chunk lands at world origin (centred
 * on screen) and scaled-up, the "camera zoom" effect.
 */
export default function PrismParts({
  cloned,
  reduced = false,
  onSplitReady,
}: Props) {
  const splitResult = useMemo(() => {
    const result = splitSceneIntoQuadrants(cloned);
    // Shift each chunk geometry by -centers[i] so chunkGroup-local space
    // places the chunk centroid at origin. Both the rendered mesh AND the
    // particle field use this shifted geometry, so they share one local
    // frame and ride the chunkGroup transform together. Y-bounds are read
    // from the SHIFTED chunk so the reveal-sweep shader works in the same
    // frame as the geometry it's painting.
    const yBounds: { top: number; bottom: number }[] = [];
    const shiftedChunks = result.chunks.map((g, i) => {
      const shifted = g.clone();
      shifted.translate(
        -result.centers[i].x,
        -result.centers[i].y,
        -result.centers[i].z,
      );
      shifted.computeBoundingBox();
      const box = shifted.boundingBox;
      yBounds.push({
        top: box?.max.y ?? 0,
        bottom: box?.min.y ?? 0,
      });
      g.dispose();
      return shifted;
    });

    // Second-pass fracture — cut N small debris pieces off each chunk so
    // the explode reads as a true uneven explosion. Debris geometries live
    // in the same chunk-local frame as the main piece. The chunk's outward
    // direction is passed in so debris flies away from the prism centre,
    // not into the neighbouring slab.
    const fracturedChunks = shiftedChunks.map((g, i) => {
      const fractured = fractureChunk(
        g,
        DEBRIS_PER_CHUNK,
        0xa1b2 + i * 9173,
        result.outwardDirs[i],
      );
      g.dispose();
      return fractured;
    });

    return {
      centers: result.centers,
      outwardDirs: result.outwardDirs,
      yBounds,
      fracturedChunks,
    };
  }, [cloned]);

  const { materials, revealUniforms } = useMemo(() => {
    let template: THREE.MeshStandardMaterial | null = null;
    cloned.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (template) return;
      if (m.isMesh && m.material && (m.material as THREE.Material).type) {
        const mat = m.material as THREE.MeshStandardMaterial;
        if ("envMapIntensity" in mat) template = mat;
      }
    });
    if (!template) {
      throw new Error("PrismParts: no MeshStandardMaterial found in cloned scene");
    }

    const mats: THREE.MeshStandardMaterial[] = [];
    const uniforms: { value: number }[] = [];
    for (let i = 0; i < splitResult.fracturedChunks.length; i++) {
      const own = (template as THREE.MeshStandardMaterial).clone();
      own.envMapIntensity = 1.4;
      // Solid surface: no alpha blending. Phase visibility is a hard
      // group-level toggle (PrismParts is hidden outside section II),
      // so we never need opacity to fade chunks in/out. Per-chunk
      // de-emphasis during focus phases is handled in the leader-card
      // overlay (DOM), not by ghosting the chunk geometry.
      own.transparent = false;
      own.depthWrite = true;
      own.opacity = 1;
      // DoubleSide so the recesses left by debris cuts actually read on
      // screen — with FrontSide alone, looking through the cut hole
      // showed nothing (back of the chunk's far surface isn't drawn) and
      // the hole appeared invisible.
      own.side = THREE.DoubleSide;
      const { top, bottom } = splitResult.yBounds[i];
      uniforms.push(applyPrismRevealShader(own, top, bottom));
      mats.push(own);
    }
    return { materials: mats, revealUniforms: uniforms };
  }, [splitResult, cloned]);

  // Per-chunk wireframe was the loader's outline before, but it traced
  // every CSG cut surface (slab boundaries + debris cavities) which read
  // as messy interior lines. Outline now lives in Prism.tsx, drawn from
  // the uncut whole-model geometry. We keep the empty arrays/material
  // here as harmless placeholders so the rendering JSX below doesn't
  // need to be conditionalised for `lineSegments` props.
  const edgeGeoms = useMemo(
    () =>
      splitResult.fracturedChunks.map(
        () => new THREE.BufferGeometry(),
      ),
    [splitResult],
  );
  const edgeMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: false,
        opacity: 1,
        depthWrite: false,
        // Edge geometries are empty placeholders (kept so the chunk JSX
        // doesn't need to be conditionalised). Visible=false here is
        // belt-and-suspenders against a future edit that fills them.
        visible: false,
      }),
    [],
  );

  const rootGroupRef = useRef<THREE.Group>(null);
  const chunkGroupRefs = useRef<(THREE.Group | null)[]>([null, null, null, null]);
  const anchorRefs = useRef<(THREE.Object3D | null)[]>([null, null, null, null]);
  // Per-chunk debris group refs — each entry is an array of one Group ref
  // per debris piece on that chunk.
  const debrisGroupRefs = useRef<(THREE.Group | null)[][]>([[], [], [], []]);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const tmpVec = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const exploded = scrollState.pillarExplodeAmount;
    const focused = scrollState.pillarFocusedPart;

    // Hard visibility on the whole chunk set: visible only inside
    // section II. Outside section II, the uncut <displayMesh> in
    // Prism.tsx renders the model instead — both occupy the same
    // silhouette at the boundaries (chunks at explodeAmount=0 reform
    // the prism), so the swap is visually invisible. Critically, the
    // two never co-render: no cross-fade ghost behind the explosion,
    // no alpha-sort tearing through transparent chunks.
    const inSectionLocal =
      scrollState.pillarSectionProgress > 0.001 &&
      scrollState.pillarSectionProgress < 0.999;
    if (rootGroupRef.current) {
      rootGroupRef.current.visible = inSectionLocal;
    }

    // Push per-chunk reveal values into each material's uniform. The
    // reveal shader changes per-pixel diffuse color (white→texture)
    // without touching alpha, so the chunk surface stays fully solid
    // throughout the sweep.
    const loaderActive = scrollState.loaderActive;
    for (let i = 0; i < revealUniforms.length; i++) {
      revealUniforms[i].value = loaderActive
        ? 1
        : scrollState.pillarChunkReveal[i];
    }

    for (let i = 0; i < 4; i++) {
      const dir = splitResult.outwardDirs[i];
      const center = splitResult.centers[i];
      const mag = EXPLODE_SCALE * PER_CHUNK_EXPLODE[i] * exploded;

      const targetX = center.x + dir.x * mag;
      const targetY = center.y + dir.y * mag;
      const targetZ = center.z + dir.z * mag;

      const targetRot = PER_CHUNK_ROT[i];
      const targetRX = targetRot.x * exploded;
      const targetRY = targetRot.y * exploded;
      const targetRZ = targetRot.z * exploded;

      const g = chunkGroupRefs.current[i];
      if (g) {
        g.position.x += (targetX - g.position.x) * POSITION_LERP;
        g.position.y += (targetY - g.position.y) * POSITION_LERP;
        g.position.z += (targetZ - g.position.z) * POSITION_LERP;
        g.rotation.x += (targetRX - g.rotation.x) * POSITION_LERP;
        g.rotation.y += (targetRY - g.rotation.y) * POSITION_LERP;
        g.rotation.z += (targetRZ - g.rotation.z) * POSITION_LERP;
        g.visible = true;
      }

      // Debris pieces — each one drifts outward + tumbles in lockstep with
      // the chunk's explode amount, so during the explode phase the chunk
      // visibly comes apart, settles into a scattered arrangement during
      // overview / focus, then recollapses into the sealed prism on exit.
      const debris = splitResult.fracturedChunks[i].debris;
      const debrisGroups = debrisGroupRefs.current[i];
      for (let j = 0; j < debris.length; j++) {
        const dGroup = debrisGroups[j];
        if (!dGroup) continue;
        const piece = debris[j];
        const dx = piece.outward.x * piece.travel * exploded;
        const dy = piece.outward.y * piece.travel * exploded;
        const dz = piece.outward.z * piece.travel * exploded;
        const drx = piece.tumble.x * exploded;
        const dry = piece.tumble.y * exploded;
        const drz = piece.tumble.z * exploded;
        dGroup.position.x += (dx - dGroup.position.x) * POSITION_LERP;
        dGroup.position.y += (dy - dGroup.position.y) * POSITION_LERP;
        dGroup.position.z += (dz - dGroup.position.z) * POSITION_LERP;
        dGroup.rotation.x += (drx - dGroup.rotation.x) * POSITION_LERP;
        dGroup.rotation.y += (dry - dGroup.rotation.y) * POSITION_LERP;
        dGroup.rotation.z += (drz - dGroup.rotation.z) * POSITION_LERP;
      }

      const a = anchorRefs.current[i];
      if (!a) {
        pillarPartsState.anchorVisible[i] = false;
        continue;
      }
      a.getWorldPosition(tmpVec);
      tmpVec.project(camera);
      pillarPartsState.anchorTargetX[i] = (tmpVec.x * 0.5 + 0.5) * size.width;
      pillarPartsState.anchorTargetY[i] = (-tmpVec.y * 0.5 + 0.5) * size.height;
      pillarPartsState.anchorVisible[i] = tmpVec.z > -1 && tmpVec.z < 1;
    }

    pillarPartsState.focusedPart = focused;

    if (focused >= 0) {
      const g = chunkGroupRefs.current[focused];
      if (g) {
        scrollState.pillarFocusLocalX = g.position.x;
        scrollState.pillarFocusLocalY = g.position.y;
        scrollState.pillarFocusLocalZ = g.position.z;
      }
    }
  });

  useEffect(() => {
    // Hand off the volumetric split to Prism BEFORE flipping prismReady,
    // so by the time LoadingScreen unblocks, the loader shards have
    // already been derived and PrismAssemblyShards is mounted.
    onSplitReady?.(splitResult);
    // Signal LoadingScreen that the prism + particles are mounted so it can
    // begin the fill ramp + minDisplay timer. Without this, the loader
    // dismisses before the heavy CSG + sampling work finishes and the
    // user never sees the fill animation.
    scrollState.prismReady = true;
    return () => {
      for (const f of splitResult.fracturedChunks) {
        f.main.dispose();
        for (const d of f.debris) d.geometry.dispose();
      }
      for (const m of materials) m.dispose();
      for (const eg of edgeGeoms) eg.dispose();
      edgeMaterial.dispose();
    };
  }, [splitResult, materials, edgeGeoms, edgeMaterial, onSplitReady]);

  return (
    <group ref={rootGroupRef} visible={false}>
      {splitResult.fracturedChunks.map((fractured, i) => {
        const center = splitResult.centers[i];
        return (
          <group
            key={i}
            ref={(el) => {
              chunkGroupRefs.current[i] = el;
            }}
            position={[center.x, center.y, center.z]}
          >
            <mesh
              geometry={fractured.main}
              material={materials[i]}
              frustumCulled={false}
              castShadow={false}
              receiveShadow={false}
              onPointerOver={(e) => {
                // Only allow hover during the OVERVIEW phase — once a focus
                // phase starts, non-focused chunks fade toward 0 opacity and
                // hovering an invisible mesh would be confusing.
                if (!scrollState.pillarExploreActive) return;
                e.stopPropagation();
                pillarPartsState.hoveredPart = i as 0 | 1 | 2 | 3;
                document.body.style.cursor = "pointer";
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                if (pillarPartsState.hoveredPart === i) {
                  pillarPartsState.hoveredPart = -1;
                  document.body.style.cursor = "";
                }
              }}
              onClick={(e) => {
                if (!scrollState.pillarExploreActive) return;
                e.stopPropagation();
                pillarPartsState.pendingClickFocus = i as 0 | 1 | 2 | 3;
              }}
            />
            <object3D
              ref={(el) => {
                anchorRefs.current[i] = el;
              }}
              position={[0, 0, 0]}
            />
            <lineSegments
              geometry={edgeGeoms[i]}
              material={edgeMaterial}
              frustumCulled={false}
              raycast={() => undefined}
            />
            {fractured.debris.map((piece, j) => (
              <group
                key={j}
                ref={(el) => {
                  debrisGroupRefs.current[i][j] = el;
                }}
              >
                <mesh
                  geometry={piece.geometry}
                  material={materials[i]}
                  frustumCulled={false}
                  castShadow={false}
                  receiveShadow={false}
                  // Debris is decorative — don't intercept pointer events
                  // (would block hover/click on the main chunk behind).
                  raycast={() => undefined}
                />
              </group>
            ))}
            {!reduced && (
              <PrismParticles geometry={fractured.main} chunkIndex={i} />
            )}
          </group>
        );
      })}
    </group>
  );
}
