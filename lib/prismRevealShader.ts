import type * as THREE from "three";

/**
 * Patches a MeshStandardMaterial so its diffuse texture reveals from white
 * clay to fully textured as a *downward gradient sweep* through the chunk:
 * top of the chunk reveals first, bottom last. The sweep position is the
 * `uReveal` uniform (0 = nothing revealed, 1 = whole chunk revealed).
 *
 * `uChunkYTop` and `uChunkYBottom` are the chunk's local Y bounds in
 * chunkGroup-local space (where the geometry has been shifted so the
 * centroid sits at origin). Using local Y means the reveal stays locked
 * to the chunk surface even as the chunk explodes, tumbles, or zooms.
 *
 * The gradient is intentionally *very* wide — at any given uReveal the
 * entire chunk surface is somewhere mid-transition, so the eye never
 * locks onto a moving "wavefront line." Combined with double-quintic
 * smootherstep on the blend amount and a perceptual gamma blend between
 * white and texture, the white→texture transition reads as one
 * continuous, painterly fade with no perceptible boundary.
 */
export function applyPrismRevealShader(
  material: THREE.MeshStandardMaterial,
  yTop: number,
  yBottom: number,
): { value: number } {
  const revealUniform = { value: 0 };
  const yTopUniform = { value: yTop };
  const yBottomUniform = { value: yBottom };

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uReveal = revealUniform;
    shader.uniforms.uChunkYTop = yTopUniform;
    shader.uniforms.uChunkYBottom = yBottomUniform;

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `
        #include <common>
        varying float vChunkRelY;
        uniform float uChunkYTop;
        uniform float uChunkYBottom;
        `,
      )
      .replace(
        "#include <begin_vertex>",
        `
        #include <begin_vertex>
        // 0 at the top of this chunk, 1 at the bottom — sweep-aligned.
        vChunkRelY = clamp(
          (uChunkYTop - position.y) / max(uChunkYTop - uChunkYBottom, 0.001),
          0.0,
          1.0
        );
        `,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `
        #include <common>
        uniform float uReveal;
        varying float vChunkRelY;
        `,
      )
      .replace(
        "#include <map_fragment>",
        `
        #ifdef USE_MAP
          vec4 sampledDiffuseColor = texture2D( map, vMapUv );
          // Wide vertical gradient. SOFT = 0.85 makes the transition
          // window 1.7× the chunk's vertical extent, so the gradient
          // never fully resolves to a "pure white above / pure texture
          // below" split at any single moment — every chunk is gently
          // mid-transition throughout the reveal, which removes the
          // perceptible wavefront line.
          //
          // SHAPING — quintic smootherstep applied twice. Each pass is
          // C²-continuous; chained together they produce a curve that's
          // nearly flat at both ends and only briefly steep through the
          // middle. The blend's edges (where the chunk is still mostly
          // white, or already mostly textured) have effectively zero
          // slope, so they melt invisibly into the unrevealed/revealed
          // states. No kinks, no visible band leading or trailing the
          // gradient.
          //
          // PERCEPTUAL — the diffuse color is mixed in approximate
          // sRGB space (sqrt = gamma 2.0). Mixing pure white with the
          // sampled texture in linear space leaves the mid-gradient
          // unnaturally bright (linear midpoint between (1,1,1) and a
          // dark texture sits ~0.85 sRGB, which the eye reads as "still
          // mostly white"). Mixing in gamma-corrected space lands the
          // midpoint closer to the visual average, so the gradient
          // feels evenly weighted across its length.
          float SOFT = 0.85;
          float edgePos = uReveal * (1.0 + 2.0 * SOFT) - SOFT;
          float t = clamp(
            (edgePos - (vChunkRelY - SOFT)) / (2.0 * SOFT),
            0.0,
            1.0
          );
          float reveal = t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
          reveal = reveal * reveal * reveal *
                   (reveal * (reveal * 6.0 - 15.0) + 10.0);
          vec3 whiteSqrt = vec3(1.0);
          vec3 texSqrt = sqrt(max(sampledDiffuseColor.rgb, vec3(0.0)));
          vec3 blendedSqrt = mix(whiteSqrt, texSqrt, reveal);
          vec3 blendedLinear = blendedSqrt * blendedSqrt;
          diffuseColor.rgb *= blendedLinear;
          diffuseColor.a *= mix(1.0, sampledDiffuseColor.a, reveal);
        #endif
        `,
      );
  };
  material.customProgramCacheKey = () => "prism-reveal-perchunk-y-v4";

  return revealUniform;
}
