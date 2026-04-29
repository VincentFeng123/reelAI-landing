"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { scrollState } from "@/lib/scrollState";
import {
  bakeAndMerge,
  buildLoaderShards,
  type FullSplitResult,
  type Shard,
} from "@/lib/prismSplit";
import PrismParts from "./PrismParts";
import PrismAssemblyShards from "./PrismAssemblyShards";

const LOADER_SHARD_SEED = 0xfa7e_d00d;

useGLTF.preload("/prism_from_another_world.glb");

const TILT_X = -0.18;
const TILT_Z = 0.22;

/**
 * Multiplier on the per-section scale at full zoom. Combined with the
 * section base of 1.3 this gives an effective ~3.1 — a clear "camera
 * zoomed in on this one chunk" feel.
 */
const FOCUS_SCALE_BOOST = 2.4;
/**
 * Lerp speed for the focus offset/scale. The target itself is now driven
 * by the smoothstepped pillarFocusBlend (continuous 0..1 zoom amount), so
 * the lerp adds a gentle trailing settle on top of an already-smooth
 * target — no need for the old slow-on-purpose 0.025. Symmetric in both
 * directions so zoom-in and zoom-out feel the same.
 */
const FOCUS_LERP = 0.07;
const UNFOCUS_LERP = 0.07;

// Loader pose — kept in sync with PrismController's loaderActive branch so the
// outer group can be initialised at the loader pose on first paint instead of
// starting at scale 0 + position 0 and lerping in. Without this the shard
// assembly animation would play against a separately-growing prism container,
// confusing the visual.
const LOADER_INITIAL_SCALE = 1.35;
const LOADER_INITIAL_X = -1.2;
const LOADER_INITIAL_Y = 0.1;
const LOADER_INITIAL_ROT_Y = -0.45;

export default function Prism({ reduced = false }: { reduced?: boolean }) {
  const outerRef = useRef<THREE.Group>(null);
  const spinRef = useRef<THREE.Group>(null);
  const scaleRef = useRef(LOADER_INITIAL_SCALE);
  const pulseRef = useRef(0);
  const lastStageRef = useRef(-1);
  const pointerXRef = useRef(0);
  const pointerYRef = useRef(0);
  const stageRotRef = useRef(0);
  const posXRef = useRef(LOADER_INITIAL_X);
  const posYRef = useRef(LOADER_INITIAL_Y);
  const sectionRotYRef = useRef(LOADER_INITIAL_ROT_Y);
  const sectionRotZRef = useRef(0);
  // Focus-offset refs — the screen-space delta applied on top of the
  // section base when a pillar chunk is the active focus. These lerp
  // independently of the section base so leaving the pillar section
  // doesn't drag a stale "zoomed in on chunk" pose into the next section.
  const focusOffsetXRef = useRef(0);
  const focusOffsetYRef = useRef(0);
  const focusScaleMulRef = useRef(1);
  const focusVec = useMemo(() => new THREE.Vector3(), []);
  const focusEuler = useMemo(() => new THREE.Euler(0, 0, 0, "XYZ"), []);
  const { scene } = useGLTF("/prism_from_another_world.glb");

  /**
   * Centre and normalise the GLB. Materials are NOT patched here — each of
   * the four CSG-split chunks in <PrismParts> gets its own cloned material
   * with a per-chunk uReveal uniform driven by that chunk's focus phase.
   * Each chunk also renders its own <PrismParticles> field inside its
   * chunkGroup, so particles ride explode/tumble/zoom transforms along
   * with the chunk surface.
   */
  const cloned = useMemo(() => {
    const c = scene.clone(true);

    c.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = false;
      m.receiveShadow = false;
      m.frustumCulled = false;
    });

    // Scale first, then translate by SCALED centre — centroid lands at (0,0,0)
    const box = new THREE.Box3().setFromObject(c);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const max = Math.max(size.x, size.y, size.z) || 1;
    const scale = 2.2 / max;
    c.scale.setScalar(scale);
    c.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
    c.updateMatrix();
    c.updateMatrixWorld(true);

    return c;
  }, [scene]);

  /**
   * Loader shards — derived from the SAME volumetric main+debris geometries
   * PrismParts already builds for section II (CSG box-cut blocks via
   * three-bvh-csg, the same technique Houdini's Voronoi Fracture uses with
   * box cutters). PrismParts hands its splitResult through the
   * `onSplitReady` callback after mount; we then call `buildLoaderShards`
   * to clone + center each piece for independent fly-in animation.
   *
   * Stored in state so the re-render that follows the callback mounts
   * PrismAssemblyShards with the new shards prop.
   */
  const [loaderShards, setLoaderShards] = useState<Shard[]>([]);
  const handleSplitReady = useCallback((split: FullSplitResult) => {
    setLoaderShards(buildLoaderShards(split, LOADER_SHARD_SEED));
  }, []);

  /**
   * Pull the GLB's PBR material as a "template." PrismParts clones this
   * template + applies the reveal shader for section II. Our white
   * loader/hero materials clone the same template with `map = null`, so
   * the rendered look is exactly the chunks at `uReveal = 0` (lit base
   * color, no texture) — same lighting response, same envMapIntensity,
   * same roughness/metalness. The user gets one consistent "white" from
   * loader through hero into section II's pre-reveal state.
   */
  const templateMaterial = useMemo<THREE.MeshStandardMaterial | null>(() => {
    let t: THREE.MeshStandardMaterial | null = null;
    cloned.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (t) return;
      if (m.isMesh && m.material) {
        const mat = m.material as THREE.MeshStandardMaterial;
        if ("envMapIntensity" in mat) t = mat;
      }
    });
    return t;
  }, [cloned]);

  const buildWhiteMaterial = useCallback(() => {
    if (!templateMaterial) {
      return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.45,
        metalness: 0.05,
        side: THREE.DoubleSide,
        transparent: false,
        opacity: 1,
        depthWrite: true,
      });
    }
    const own = templateMaterial.clone();
    own.map = null;
    own.envMapIntensity = 1.4;
    // Solid model: no alpha blending anywhere on the prism. Phase
    // transitions are now hard visibility toggles between the
    // uncut display mesh, the chunk set, and the loader shards —
    // which all occupy the same silhouette so the swap is invisible.
    own.transparent = false;
    own.depthWrite = true;
    own.side = THREE.DoubleSide;
    own.opacity = 1;
    return own;
  }, [templateMaterial]);

  /**
   * Shard material — white clone of the template with the texture map
   * stripped. Same look as a section-II chunk at uReveal=0 (the white
   * clay state). One material instance shared across all ~64 shards.
   */
  const shardMaterial = useMemo(
    () => buildWhiteMaterial(),
    [buildWhiteMaterial],
  );

  /**
   * Whole-uncut mesh + edges for the loader-to-hero transition. We
   * bake-and-merge the cloned scene into a single BufferGeometry so the
   * model can be rendered as ONE clean piece with no CSG cut surfaces.
   *
   * - `displayGeometry` — the uncut whole-model BufferGeometry. Used for
   *   the textured prism mesh visible during transition + hero, and as
   *   the source for the wireframe outline so edges only trace the
   *   model's natural creases (no per-chunk slab/debris cuts).
   * - `displayMaterial` — clones the GLB's first textured material so
   *   the uncut mesh inherits the same look as PrismParts' chunks. Kept
   *   transparent so we can fade it in/out at phase transitions.
   * - `outlineMaterial` — white line material for the wireframe. Visible
   *   during the loader (as the "frame" the shards fall into), faded
   *   out at hand-off.
   */
  const displayGeometry = useMemo(() => bakeAndMerge(cloned), [cloned]);

  /**
   * TWO display materials swapped at runtime on the same mesh:
   *
   *   - `displayMaterialWhite`: cloned template with `map = null`.
   *     White look (matches the shards). Used during loader → hero,
   *     before section II's reveal has been seen.
   *   - `displayMaterialTextured`: cloned template with the GLB `map`
   *     KEPT. Used *after* section II's reveal completes, so scrolling
   *     back to hero keeps the textured prism — the user already
   *     watched the white-to-texture reveal happen, it shouldn't snap
   *     back to white.
   *
   * Why two prebuilt materials instead of toggling map / using the
   * reveal shader: PrismParts' chunks share `customProgramCacheKey =
   * "prism-reveal-perchunk-y-v3"`. If the display mesh used that same
   * shader, its uReveal binding would collide with whichever chunk's
   * uniform got mapped to the cached program, making the toggle flaky.
   * A material swap dodges the collision entirely.
   */
  const displayMaterialWhite = useMemo(
    () => buildWhiteMaterial(),
    [buildWhiteMaterial],
  );

  const displayMaterialTextured = useMemo(() => {
    if (!templateMaterial) return null;
    const own = templateMaterial.clone();
    own.envMapIntensity = 1.4;
    own.transparent = false;
    own.depthWrite = true;
    own.side = THREE.DoubleSide;
    own.opacity = 1;
    return own;
  }, [templateMaterial]);

  // Mesh ref so we can swap its `material` imperatively in useFrame
  // without triggering a React re-render.
  const displayMeshRef = useRef<THREE.Mesh>(null);

  // Outline edges — only the model's NATURAL creases (sharp edges where
  // the angle between adjacent face normals exceeds the threshold). 30°
  // hides shallow creases so the result reads as the prism's outer
  // silhouette rather than a busy wireframe of every triangle boundary.
  const outlineEdges = useMemo(
    () => new THREE.EdgesGeometry(displayGeometry, 30),
    [displayGeometry],
  );

  const outlineMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: false,
        opacity: 1,
        depthWrite: false,
      }),
    [],
  );

  // Hard visibility ref (no opacity lerps — everything in the prism
  // is solid now). Phase transitions toggle this directly each frame.
  const outlineRef = useRef<THREE.LineSegments>(null);

  useEffect(() => {
    return () => {
      shardMaterial.dispose();
      displayMaterialWhite.dispose();
      displayMaterialTextured?.dispose();
      displayGeometry.dispose();
      outlineEdges.dispose();
      outlineMaterial.dispose();
    };
  }, [
    shardMaterial,
    displayMaterialWhite,
    displayMaterialTextured,
    displayGeometry,
    outlineEdges,
    outlineMaterial,
  ]);

  useFrame((_state, delta) => {
    const outer = outerRef.current;
    const inner = spinRef.current;
    if (!outer || !inner) return;

    const dt = Math.min(delta, 1 / 30);

    const focusedPart = scrollState.pillarFocusedPart;
    const focusBlend = scrollState.pillarFocusBlend;
    const focusActive = focusedPart >= 0;

    // Phase-based visibility (hard toggles — never opacity blends, so
    // the prism is always solid and nothing ghosts behind anything).
    // Each phase shows exactly ONE of the three coincident silhouettes:
    //   loader:        shards (in <PrismAssemblyShards>) visible,
    //                  outline visible as the assembly frame.
    //   hero / inter:  uncut displayMesh visible.
    //   section II:    chunked PrismParts visible (toggled there).
    // All three forms occupy the same final silhouette, so the swaps
    // are visually invisible — but they never co-render, so the user
    // never sees a cross-fade ghost or alpha-sort tearing.
    const inLoaderPhase = scrollState.loaderActive;
    const inSectionPhase =
      scrollState.pillarSectionProgress > 0.001 &&
      scrollState.pillarSectionProgress < 0.999;
    const showDisplay = !inLoaderPhase && !inSectionPhase;
    const showOutline = inLoaderPhase;
    if (displayMeshRef.current) {
      displayMeshRef.current.visible = showDisplay;
    }
    if (outlineRef.current) {
      outlineRef.current.visible = showOutline;
    }

    // Phase-based material choice — driven by the CURRENT
    // pillarSectionProgress, not a one-way lock:
    //   progress < 0.94 (section I / hero / mid-section II)
    //     → white display material. Section I is always white.
    //   progress ≥ 0.94 (past section II's reveal completion, on
    //     into sections III+)
    //     → textured display material.
    // Scrolling BACK from section III to hero crosses 0.94 → 0 and
    // the material swaps back to white, so hero is always white
    // regardless of how the user got there. The swap itself happens
    // while the display mesh is hidden behind the chunks (inSection
    // covers progress 0.001–0.999), so neither direction shows a
    // visible material-change pop.
    const useTextured = scrollState.pillarSectionProgress >= 0.94;
    const targetMaterial =
      useTextured && displayMaterialTextured
        ? displayMaterialTextured
        : displayMaterialWhite;
    if (
      displayMeshRef.current &&
      displayMeshRef.current.material !== targetMaterial
    ) {
      displayMeshRef.current.material = targetMaterial;
    }

    // 1. Idle spin — fades out smoothly with the focus blend (not a hard
    //    on/off) so the chunk doesn't visibly stop spinning when zooming
    //    starts. Same blend governs camera zoom, chunk opacity, and card
    //    fades, so every motion stays in lock-step.
    const spinScale = 1 - focusBlend;
    if (!reduced) inner.rotation.y += dt * 0.18 * spinScale;

    // 2. Stage-driven rotation: π/2 across the 4 pillar stages, applied as
    //    a delta so the idle spin keeps accumulating on top — when you exit
    //    the section, idle continues from the new orientation rather than
    //    snapping back. The lerp rate is damped by (1 - focusBlend) so the
    //    rotation smoothly freezes as the camera zooms in and resumes as
    //    blend recedes — no hard "rotation off" switch.
    const inSection =
      scrollState.pillarSectionProgress > 0.001 &&
      scrollState.pillarSectionProgress < 0.999;
    const stage = scrollState.pillarActiveStage;
    const sub = scrollState.pillarStageSubProgress;
    const stageRotTarget = inSection
      ? ((stage + sub) / 4) * (Math.PI / 2)
      : stageRotRef.current;
    const stageLerp = 0.08 * spinScale;
    const prevStageRot = stageRotRef.current;
    stageRotRef.current +=
      (stageRotTarget - stageRotRef.current) * stageLerp;
    inner.rotation.y += stageRotRef.current - prevStageRot;

    // 3. Section base — scale + position always lerp toward the per-section
    //    targets from PrismController at a moderate speed. This track is
    //    independent of focus zoom so leaving the pillar section snaps
    //    cleanly back to the next section's layout (no stale focus pose).
    const SECTION_LERP = 0.06;
    scaleRef.current +=
      (scrollState.pillarTargetScale - scaleRef.current) * SECTION_LERP;
    posXRef.current +=
      (scrollState.prismTargetX - posXRef.current) * SECTION_LERP;
    posYRef.current +=
      (scrollState.prismTargetY - posYRef.current) * SECTION_LERP;

    // 4. Focus offset — additive on top of section base. Both the
    //    translation (so the chunk lands at world origin) and the scale
    //    boost are multiplied by the continuous focusBlend value, so the
    //    camera glides toward / away from the chunk on a smoothstep curve
    //    instead of jumping between a "focused" and "neutral" target. At
    //    each phase boundary blend == 0, so the integer focusedPart can
    //    flip (chunk 0 → chunk 1) without any visible camera movement.
    let focusTargetX = 0;
    let focusTargetY = 0;
    let focusTargetScaleMul = 1;
    if (focusActive && focusBlend > 0) {
      focusEuler.set(
        TILT_X + pointerYRef.current,
        sectionRotYRef.current + pointerXRef.current,
        TILT_Z + sectionRotZRef.current,
        "XYZ",
      );
      focusVec.set(
        scrollState.pillarFocusLocalX,
        scrollState.pillarFocusLocalY,
        scrollState.pillarFocusLocalZ,
      );
      focusVec.applyEuler(focusEuler);
      focusTargetScaleMul = 1 + (FOCUS_SCALE_BOOST - 1) * focusBlend;
      const finalScale = scaleRef.current * focusTargetScaleMul;
      focusTargetX = -focusVec.x * finalScale * focusBlend;
      focusTargetY = -focusVec.y * finalScale * focusBlend;
    }
    const focusLerp = inSection
      ? focusActive
        ? FOCUS_LERP
        : UNFOCUS_LERP
      : 0.18;
    focusOffsetXRef.current +=
      (focusTargetX - focusOffsetXRef.current) * focusLerp;
    focusOffsetYRef.current +=
      (focusTargetY - focusOffsetYRef.current) * focusLerp;
    focusScaleMulRef.current +=
      (focusTargetScaleMul - focusScaleMulRef.current) * focusLerp;

    outer.position.x = posXRef.current + focusOffsetXRef.current;
    outer.position.y = posYRef.current + focusOffsetYRef.current;
    outer.scale.setScalar(scaleRef.current * focusScaleMulRef.current);

    // 5. Per-section outer Y/Z rotation — same SECTION_LERP rate as scale/
    //    position base above so a section change always settles its full
    //    pose (position + scale + tilts) on a single curve.
    sectionRotYRef.current +=
      (scrollState.prismTargetRotY - sectionRotYRef.current) * 0.06;
    sectionRotZRef.current +=
      (scrollState.prismTargetRotZ - sectionRotZRef.current) * 0.06;

    // 6. Pointer parallax — only outside the pinned section so the inspector
    //    blueprint feel stays predictable during stage walkthrough.
    const pxTarget = inSection ? 0 : scrollState.pointerX * 0.05;
    const pyTarget = inSection ? 0 : scrollState.pointerY * 0.05;
    pointerXRef.current += (pxTarget - pointerXRef.current) * 0.05;
    pointerYRef.current += (pyTarget - pointerYRef.current) * 0.05;
    scrollState.pointerLerpedX = pointerXRef.current;
    scrollState.pointerLerpedY = pointerYRef.current;

    outer.rotation.x = TILT_X + pointerYRef.current;
    outer.rotation.y = sectionRotYRef.current + pointerXRef.current;
    outer.rotation.z = TILT_Z + sectionRotZRef.current;

    // 7. Stage emissive pulse — bump envMapIntensity on stage transitions.
    //    Walks the rendered chunk meshes (children of PrismParts → spinRef)
    //    rather than the unmounted `cloned` template.
    if (stage !== lastStageRef.current && lastStageRef.current !== -1) {
      pulseRef.current = 1;
    }
    lastStageRef.current = stage;
    pulseRef.current *= 0.93;
    if (pulseRef.current > 0.01) {
      const intensity = 1.4 + pulseRef.current * 0.5;
      inner.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (!m.isMesh) return;
        const mat = m.material as THREE.MeshStandardMaterial | undefined;
        if (mat && "envMapIntensity" in mat) mat.envMapIntensity = intensity;
      });
    }
  });

  return (
    <group ref={outerRef} position={[0, 0, 0]} rotation={[TILT_X, 0, TILT_Z]}>
      <group ref={spinRef}>
        <PrismParts
          cloned={cloned}
          reduced={reduced}
          onSplitReady={handleSplitReady}
        />
        {/* Uncut whole-model mesh — visible during transition + hero so
            the user never sees the fracture cavities through alpha.
            Material starts as the white version; the useFrame swap
            switches it to the textured version once section II's
            reveal has been seen. */}
        <mesh
          ref={displayMeshRef}
          geometry={displayGeometry}
          material={displayMaterialWhite}
          frustumCulled={false}
          castShadow={false}
          receiveShadow={false}
          raycast={() => undefined}
          visible={false}
        />
        {/* White outline — natural creases of the uncut model only. */}
        <lineSegments
          ref={outlineRef}
          geometry={outlineEdges}
          material={outlineMaterial}
          frustumCulled={false}
          raycast={() => undefined}
          visible={false}
        />
        {loaderShards.length > 0 && (
          <PrismAssemblyShards
            shards={loaderShards}
            material={shardMaterial}
          />
        )}
      </group>
    </group>
  );
}
