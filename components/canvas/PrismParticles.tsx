"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import { scrollState } from "@/lib/scrollState";

/**
 * Surface-accreting particle field, driven by its chunk's reveal value.
 *
 * Particles sampled across a single BufferGeometry's triangle surface (via
 * MeshSurfaceSampler). Targets are accepted through a light spatial-hash
 * rejection pass so the field is dense without obviously stacked points.
 * Each particle follows a local 1/x graph from an outer "approach"
 * starting point to the surface, sits on the surface as the texture
 * reveals there, then fades once the real texture has taken over.
 *
 * Mounted as a child of one of the four chunk groups in PrismParts — the
 * input geometry is the chunk's own slab geometry (already in chunkGroup-
 * local space), so origins/approaches/targets ride the chunk's transform
 * automatically as it explodes, tumbles, or zooms.
 *
 * The reveal sweep is scoped to THIS chunk: each particle has a per-chunk
 * `aRelY` attribute (0 at top of chunk, 1 at bottom) and the shader's
 * uProgress is fed `scrollState.pillarChunkReveal[chunkIndex]`. So particles
 * deliver top-to-bottom within their chunk over the chunk's focus phase,
 * synced 1:1 with the texture wavefront in PrismParts' material shader.
 */

// Per-chunk counts. Total across all four ≈ original whole-prism count.
const DESKTOP_COUNT = 13000;
const MOBILE_COUNT = 4500;
const DESKTOP_SPACING = 0.0085;
const MOBILE_SPACING = 0.0125;
const SURFACE_LIFT = 0.003;
const RNG_SEED = 0x4d3a7c21;

function createRandom(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashCell(x: number, y: number, z: number, cellSize: number) {
  return `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)},${Math.floor(z / cellSize)}`;
}

const VERTEX_SHADER = `
  uniform float uProgress;
  uniform float uTime;
  uniform float uSize;

  attribute vec3 aOrigin;
  attribute vec3 aApproach;
  attribute vec3 aTarget;
  attribute vec3 aNormal;
  attribute float aSeed;
  attribute float aSize;
  attribute float aRelY;

  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    vec3 normal = normalize(aNormal);

    vec3 surface = aTarget;
    // Reveal-at is the particle's vertical position WITHIN ITS CHUNK
    // (0 at the top of the chunk, 1 at the bottom). Computed at attribute
    // build time so the value stays locked to the surface even as the
    // chunk explodes / tumbles / zooms.
    float revealAt = aRelY;
    float startAt = max(revealAt - 0.24, 0.0);
    float t = clamp((uProgress - startAt) / max(revealAt - startAt, 0.001), 0.0, 1.0);

    vec3 xAxisStart = aApproach;
    vec3 xAxis = surface - xAxisStart;
    float xSpan = max(length(xAxis), 0.001);
    xAxis /= xSpan;

    vec3 yAxis = aOrigin - xAxisStart;
    float ySpan = max(length(yAxis), 0.001);
    yAxis /= ySpan;

    // Literal normalized 1/x path: starts high near the outer y-axis,
    // then asymptotically flattens into the surface x-axis.
    float eps = 0.18 + fract(aSeed * 19.713) * 0.055;
    float x = mix(eps, 1.0, t);
    float y = ((1.0 / x) - 1.0) / ((1.0 / eps) - 1.0);
    float xNorm = (x - eps) / (1.0 - eps);
    vec3 graphPos = xAxisStart + xAxis * (xNorm * xSpan) + yAxis * (y * ySpan);
    float surfaceLock = smoothstep(0.92, 1.0, t);
    vec3 pos = mix(graphPos, surface, surfaceLock);

    float wob = uTime * 0.5 + aSeed * 6.2831853;
    float wobAmp = mix(0.035, 0.001, surfaceLock);
    pos += (xAxis * sin(wob) + yAxis * cos(wob * 0.71)) * wobAmp * (1.0 - surfaceLock * 0.9);

    float fadeIn = smoothstep(0.04, 0.28, t);
    float fadeAfterReveal = 1.0 - smoothstep(revealAt, revealAt + 0.075, uProgress);
    vAlpha = fadeIn * fadeAfterReveal;

    // Lit colour: Lambert against a fixed key light, biased warm/cool.
    vec3 lightDir = normalize(vec3(0.3, 0.7, 0.5));
    float lambert = max(dot(normal, lightDir), 0.0);
    vColor = mix(vec3(0.55, 0.62, 0.76), vec3(1.0, 0.98, 0.9), lambert);

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPos;
    gl_PointSize = aSize * uSize * (2.35 / max(-mvPos.z, 0.0001));
  }
`;

const FRAGMENT_SHADER = `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float core = smoothstep(0.24, 0.0, d);
    float feather = smoothstep(0.5, 0.27, d);
    float a = (core * 0.62 + feather * 0.38) * vAlpha * 0.82;
    if (a < 0.015) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

type Props = {
  /** BufferGeometry for one chunk, already in chunkGroup-local space. */
  geometry: THREE.BufferGeometry;
  /** Index 0..3 — selects scrollState.pillarChunkReveal[chunkIndex]. */
  chunkIndex: number;
};

export default function PrismParticles({
  geometry: srcGeometry,
  chunkIndex,
}: Props) {
  const pointsRef = useRef<THREE.Points>(null);

  const { geometry, material } = useMemo(() => {
    const isMobile =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches;
    const count = isMobile ? MOBILE_COUNT : DESKTOP_COUNT;
    const baseSpacing = isMobile ? MOBILE_SPACING : DESKTOP_SPACING;
    const random = createRandom(RNG_SEED);

    if (!srcGeometry.attributes.position) {
      return { geometry: new THREE.BufferGeometry(), material: null };
    }

    // Clone so we don't mutate the rendered chunk's BufferGeometry.
    const merged = srcGeometry.clone();
    if (!merged.attributes.normal) merged.computeVertexNormals();
    merged.computeBoundingBox();

    const box = merged.boundingBox ?? new THREE.Box3();
    const size = box.getSize(new THREE.Vector3());
    const height = Math.max(size.y, 0.001);
    const minY = box.min.y;
    const outerRadius = Math.max(size.x, size.z) * 2.85 + 1.35;
    const cellSize = baseSpacing;
    const grid = new Map<string, number[]>();

    const tempMesh = new THREE.Mesh(merged);
    const sampler = new MeshSurfaceSampler(tempMesh);
    (
      sampler as MeshSurfaceSampler & {
        setRandomGenerator?: (randomFunction: () => number) => MeshSurfaceSampler;
      }
    ).setRandomGenerator?.(random);
    sampler.build();

    const positions = new Float32Array(count * 3);
    const targets = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);
    const origins = new Float32Array(count * 3);
    const approaches = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const sizes = new Float32Array(count);
    const relYs = new Float32Array(count);

    const tmpPos = new THREE.Vector3();
    const tmpNorm = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3(1, 0, 0);
    const tangent = new THREE.Vector3();
    const radial = new THREE.Vector3();
    let accepted = 0;

    const farEnough = (x: number, y: number, z: number, spacing: number) => {
      const minDistSq = spacing * spacing;
      const cx = Math.floor(x / cellSize);
      const cy = Math.floor(y / cellSize);
      const cz = Math.floor(z / cellSize);

      for (let ix = cx - 1; ix <= cx + 1; ix++) {
        for (let iy = cy - 1; iy <= cy + 1; iy++) {
          for (let iz = cz - 1; iz <= cz + 1; iz++) {
            const bucket = grid.get(`${ix},${iy},${iz}`);
            if (!bucket) continue;
            for (const idx of bucket) {
              const j = idx * 3;
              const dx = positions[j] - x;
              const dy = positions[j + 1] - y;
              const dz = positions[j + 2] - z;
              if (dx * dx + dy * dy + dz * dz < minDistSq) {
                return false;
              }
            }
          }
        }
      }

      return true;
    };

    const acceptSample = () => {
      if (tmpNorm.lengthSq() < 0.0001) tmpNorm.copy(up);
      tmpNorm.normalize();

      const i3 = accepted * 3;
      const seed = random();
      const targetX = tmpPos.x + tmpNorm.x * SURFACE_LIFT;
      const targetY = tmpPos.y + tmpNorm.y * SURFACE_LIFT;
      const targetZ = tmpPos.z + tmpNorm.z * SURFACE_LIFT;

      positions[i3] = targetX;
      positions[i3 + 1] = targetY;
      positions[i3 + 2] = targetZ;
      targets[i3] = targetX;
      targets[i3 + 1] = targetY;
      targets[i3 + 2] = targetZ;
      normals[i3] = tmpNorm.x;
      normals[i3 + 1] = tmpNorm.y;
      normals[i3 + 2] = tmpNorm.z;

      tangent.crossVectors(tmpNorm, up);
      if (tangent.lengthSq() < 0.0001) tangent.crossVectors(tmpNorm, right);
      tangent.normalize();

      radial.set(tmpPos.x, 0, tmpPos.z);
      if (radial.lengthSq() < 0.0001) {
        const fallbackAngle = random() * Math.PI * 2;
        radial.set(Math.cos(fallbackAngle), 0, Math.sin(fallbackAngle));
      } else {
        radial.normalize();
      }

      // 0 at the top of the chunk, 1 at the bottom — same orientation as
      // the chunk-mesh shader's vChunkRelY so particles deliver in lockstep
      // with the texture wavefront.
      const yNorm = Math.max(0, Math.min(1, (tmpPos.y - minY) / height));
      const aRel = 1 - yNorm;
      const xAxisDirection = random() < 0.5 ? -1 : 1;
      const xSpan = Math.max(size.x, size.z) * (0.42 + random() * 0.26);
      const originAngle =
        Math.atan2(radial.z, radial.x) + (random() - 0.5) * 0.22;
      const originRadius = outerRadius * (0.92 + random() * 0.16);
      const originY = minY - height * (0.42 + random() * 0.2);

      tangent.multiplyScalar(xAxisDirection);

      // aApproach is the start of the local surface x-axis. aOrigin is placed
      // on the lower outer ring, making the shader's reciprocal graph enter
      // from the outer y-axis before flattening into the model surface.
      approaches[i3] = targetX - tangent.x * xSpan;
      approaches[i3 + 1] = targetY - tangent.y * xSpan;
      approaches[i3 + 2] = targetZ - tangent.z * xSpan;
      origins[i3] = Math.cos(originAngle) * originRadius;
      origins[i3 + 1] = originY;
      origins[i3 + 2] = Math.sin(originAngle) * originRadius;

      seeds[accepted] = seed;
      sizes[accepted] = (isMobile ? 9.5 : 11.5) + random() * 3.0;
      relYs[accepted] = aRel;

      const bucketKey = hashCell(targetX, targetY, targetZ, cellSize);
      const bucket = grid.get(bucketKey);
      if (bucket) {
        bucket.push(accepted);
      } else {
        grid.set(bucketKey, [accepted]);
      }

      accepted += 1;
    };

    const spacingPasses = [
      baseSpacing,
      baseSpacing * 0.84,
      baseSpacing * 0.70,
      baseSpacing * 0.58,
      baseSpacing * 0.48,
      baseSpacing * 0.38,
    ];

    for (let pass = 0; pass < spacingPasses.length; pass++) {
      const spacing = spacingPasses[pass];
      const isFinalPass = pass === spacingPasses.length - 1;
      const passBudget = count * (isFinalPass ? 140 : 26);
      for (let attempt = 0; attempt < passBudget && accepted < count; attempt++) {
        sampler.sample(tmpPos, tmpNorm);
        if (farEnough(tmpPos.x, tmpPos.y, tmpPos.z, spacing)) {
          acceptSample();
        }
      }
      if (accepted >= count) break;
    }

    const minimumSpacing = baseSpacing * 0.24;
    for (
      let attempt = 0;
      attempt < count * 220 && accepted < count;
      attempt++
    ) {
      sampler.sample(tmpPos, tmpNorm);
      if (farEnough(tmpPos.x, tmpPos.y, tmpPos.z, minimumSpacing)) {
        acceptSample();
      }
    }

    while (accepted < count) {
      sampler.sample(tmpPos, tmpNorm);
      acceptSample();
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(positions.slice(0, accepted * 3), 3),
    );
    geo.setAttribute(
      "aOrigin",
      new THREE.BufferAttribute(origins.slice(0, accepted * 3), 3),
    );
    geo.setAttribute(
      "aApproach",
      new THREE.BufferAttribute(approaches.slice(0, accepted * 3), 3),
    );
    geo.setAttribute(
      "aTarget",
      new THREE.BufferAttribute(targets.slice(0, accepted * 3), 3),
    );
    geo.setAttribute(
      "aNormal",
      new THREE.BufferAttribute(normals.slice(0, accepted * 3), 3),
    );
    geo.setAttribute(
      "aSeed",
      new THREE.BufferAttribute(seeds.slice(0, accepted), 1),
    );
    geo.setAttribute(
      "aSize",
      new THREE.BufferAttribute(sizes.slice(0, accepted), 1),
    );
    geo.setAttribute(
      "aRelY",
      new THREE.BufferAttribute(relYs.slice(0, accepted), 1),
    );
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 11);

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uProgress: { value: 0 },
        uTime: { value: 0 },
        uSize: { value: 1 },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
    });

    // Free the cloned source — geo is the new buffer for the Points.
    merged.dispose();

    return { geometry: geo, material: mat };
  }, [srcGeometry]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material?.dispose();
    };
  }, [geometry, material]);

  useFrame((state) => {
    if (!material) return;
    const p = scrollState.pillarSectionProgress;

    // The loader is now driven by PrismAssemblyShards (real model
    // fragments flying into place), not by particles. Particles are
    // section-II-only — they accrete onto chunks during the dissection
    // reveal and stay hidden everywhere else.
    material.uniforms.uProgress.value =
      scrollState.pillarChunkReveal[chunkIndex] ?? 0;
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uSize.value = 1.0;
    if (material.blending !== THREE.NormalBlending) {
      material.blending = THREE.NormalBlending;
      material.needsUpdate = true;
    }
    material.depthTest = true;
    if (pointsRef.current) {
      pointsRef.current.visible = p > 0.001 && p < 0.999;
    }
  });

  if (!material) return null;

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      material={material}
      frustumCulled={false}
    />
  );
}
