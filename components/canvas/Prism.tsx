"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { scrollState } from "@/lib/scrollState";
import {
  getPillarRevealRatio,
  PILLAR_REVEAL_Y_BOTTOM,
  PILLAR_REVEAL_Y_TOP,
} from "@/lib/pillarRevealTimeline";
import PrismParticles from "./PrismParticles";

useGLTF.preload("/prism_from_another_world.glb");

const TILT_X = -0.18;
const TILT_Z = 0.22;

export default function Prism({ reduced = false }: { reduced?: boolean }) {
  const outerRef = useRef<THREE.Group>(null);
  const spinRef = useRef<THREE.Group>(null);
  const scaleRef = useRef(0);
  const pulseRef = useRef(0);
  const lastStageRef = useRef(-1);
  const pointerXRef = useRef(0);
  const pointerYRef = useRef(0);
  const stageRotRef = useRef(0);
  const posXRef = useRef(0);
  const posYRef = useRef(0);
  const sectionRotYRef = useRef(0);
  /**
   * Texture-reveal uniforms. The reveal boundary is a horizontal plane in
   * world space (`uRevealY`); fragments above it are fully textured,
   * fragments below it are flat-shaded clay, and a soft band around it
   * (`uRevealBand`) crossfades plus emits a white glow — the moving
   * "wavefront" of the rebuild.
   */
  const revealRef = useRef({ value: 3.0 }); // start above model — nothing revealed
  const revealBandRef = useRef({ value: 0.55 });
  const { scene } = useGLTF("/prism_from_another_world.glb");

  /**
   * Keep the GLB's original materials & textures intact. Only:
   *   - centre the model on its own origin (so Y-rotation is wobble-free),
   *   - normalise its size,
   *   - bump envMapIntensity so the studio lighting reads cinematic.
   */
  const cloned = useMemo(() => {
    const c = scene.clone(true);

    const revealUniform = revealRef.current;
    const revealBandUniform = revealBandRef.current;
    c.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = false;
      m.receiveShadow = false;
      m.frustumCulled = false;

      const mat = m.material as THREE.MeshStandardMaterial | undefined;
      if (!mat || !("envMapIntensity" in mat)) return;

      // Clone so we don't mutate drei's cached GLB original — multiple
      // <Prism /> mounts (HMR, future remounts) would otherwise stomp on
      // each other.
      const own = mat.clone();
      own.envMapIntensity = 1.4;

      // Inject world-Y-based reveal: fragments above `uRevealY` show the
      // diffuse texture; fragments below show only `material.color` (flat
      // clay); a soft band of width `uRevealBand` around the boundary
      // crossfades AND adds white emissive glow — the moving "wavefront".
      // Other PBR channels (normal/roughness/metalness/emissive) keep
      // contributing throughout so the model retains its 3D shape during
      // the rebuild.
      own.onBeforeCompile = (shader) => {
        shader.uniforms.uRevealY = revealUniform;
        shader.uniforms.uRevealBand = revealBandUniform;

        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            `
            #include <common>
            varying vec3 vWorldPos;
            `,
          )
          .replace(
            "#include <project_vertex>",
            `
            #include <project_vertex>
            vWorldPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
            `,
          );

        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <common>",
            `
            #include <common>
            uniform float uRevealY;
            uniform float uRevealBand;
            varying vec3 vWorldPos;
            `,
          )
          .replace(
            "#include <map_fragment>",
            `
            #ifdef USE_MAP
              vec4 sampledDiffuseColor = texture2D( map, vMapUv );
              float reveal = smoothstep(
                uRevealY - uRevealBand * 0.5,
                uRevealY + uRevealBand * 0.5,
                vWorldPos.y
              );
              diffuseColor *= mix( vec4( 1.0 ), sampledDiffuseColor, reveal );
            #endif
            `,
          )
          .replace(
            "#include <emissivemap_fragment>",
            `
            #include <emissivemap_fragment>
            {
              float bandPos = ( vWorldPos.y - uRevealY ) / max( uRevealBand, 0.001 );
              float glow = exp( -bandPos * bandPos * 2.5 );
              totalEmissiveRadiance += vec3( glow * 0.45 );
            }
            `,
          );
      };
      own.customProgramCacheKey = () => "prism-reveal-v2";
      m.material = own;
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

  useFrame((_state, delta) => {
    const outer = outerRef.current;
    const inner = spinRef.current;
    if (!outer || !inner) return;

    const dt = Math.min(delta, 1 / 30);

    // 1. Idle spin — slowed so stage rotation reads.
    if (!reduced) inner.rotation.y += dt * 0.18;

    // 2. Stage-driven rotation: π/2 across the 4 pillar stages, applied as
    //    a delta so the idle spin keeps accumulating on top — when you exit
    //    the section, idle continues from the new orientation rather than
    //    snapping back.
    const inSection =
      scrollState.pillarSectionProgress > 0.001 &&
      scrollState.pillarSectionProgress < 0.999;
    const stage = scrollState.pillarActiveStage;
    const sub = scrollState.pillarStageSubProgress;
    const stageRotTarget = inSection
      ? ((stage + sub) / 4) * (Math.PI / 2)
      : stageRotRef.current;
    const prevStageRot = stageRotRef.current;
    stageRotRef.current += (stageRotTarget - stageRotRef.current) * 0.08;
    inner.rotation.y += stageRotRef.current - prevStageRot;

    // 3. Scale lerp toward per-section target.
    const scaleTarget = scrollState.pillarTargetScale;
    scaleRef.current += (scaleTarget - scaleRef.current) * 0.04;
    outer.scale.setScalar(scaleRef.current);

    // 3b. Texture rebuild — boundary plane sweeps top→bottom in world Y.
    //     World Y of the scaled prism is roughly [-1.9, 1.9] in the pillar
    //     section (model's normalised radius ≈ 1.1, scaled by ~1.75).
    //     The sweep is anchored to the label-dot reveal timestamps, so the
    //     white/texture boundary reaches each label dot exactly as it appears.
    const revealRatio = getPillarRevealRatio(scrollState.pillarSectionProgress);
    revealRef.current.value =
      PILLAR_REVEAL_Y_TOP +
      (PILLAR_REVEAL_Y_BOTTOM - PILLAR_REVEAL_Y_TOP) * revealRatio;

    // 4. Per-section position offset — prism drifts to a different spot
    //    in each section so it feels integrated with the layout rather
    //    than fixed-centred.
    posXRef.current += (scrollState.prismTargetX - posXRef.current) * 0.04;
    posYRef.current += (scrollState.prismTargetY - posYRef.current) * 0.04;
    outer.position.x = posXRef.current;
    outer.position.y = posYRef.current;

    // 5. Per-section outer Y rotation — prism rotates sideways per section.
    sectionRotYRef.current +=
      (scrollState.prismTargetRotY - sectionRotYRef.current) * 0.04;

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
    outer.rotation.z = TILT_Z;

    // 7. Stage emissive pulse — bump envMapIntensity on stage transitions.
    if (stage !== lastStageRef.current && lastStageRef.current !== -1) {
      pulseRef.current = 1;
    }
    lastStageRef.current = stage;
    pulseRef.current *= 0.93;
    if (pulseRef.current > 0.01) {
      const intensity = 1.4 + pulseRef.current * 0.5;
      cloned.traverse((obj) => {
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
        <primitive object={cloned} />
        {!reduced && <PrismParticles cloned={cloned} />}
      </group>
    </group>
  );
}
