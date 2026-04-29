"use client";

import { Environment, Lightformer } from "@react-three/drei";

export default function SceneLights() {
  return (
    <>
      {/* Soft uniform base — fills the deepest cavities so the model
          never crushes to pure black even on faces that no directional
          or env light reaches. */}
      <ambientLight intensity={0.32} />

      {/* Hemisphere fill — directional ambient bounce. Bright sky
          colour from above, slightly cool dark from below, blended
          across the surface normal so shadow sides retain a sculpted
          look while still picking up plenty of light. This is the
          single biggest contributor to "no longer too black." */}
      <hemisphereLight
        args={["#dde4ee", "#1a1a22", 0.6]}
      />

      {/* Key light from upper-right */}
      <directionalLight
        position={[4, 6, 5]}
        intensity={1.3}
        color="#ffffff"
      />
      {/* Rim light from behind — bumped so the back-facing slabs in
          section II's exploded view get a reading edge. */}
      <directionalLight
        position={[-3, 2, -4]}
        intensity={0.85}
        color="#ffffff"
      />
      {/* Bottom fill — subtle upward light so the under-faces of the
          slabs (especially when tilted at section II's 50° around Z)
          don't fall into shadow. */}
      <directionalLight
        position={[0, -4, 2]}
        intensity={0.35}
        color="#ffffff"
      />
      {/* Studio environment with custom B&W lightformers — gives the prism its dramatic refractions */}
      <Environment resolution={512} frames={1}>
        <color attach="background" args={["#050505"]} />
        <Lightformer
          intensity={2.8}
          color="white"
          position={[0, 4, 4]}
          rotation-x={-Math.PI / 4}
          scale={[8, 4, 1]}
        />
        <Lightformer
          intensity={1.6}
          color="white"
          position={[-5, 2, -3]}
          rotation-y={Math.PI / 3}
          scale={[6, 6, 1]}
        />
        <Lightformer
          intensity={1.2}
          color="white"
          position={[5, -2, -2]}
          rotation-y={-Math.PI / 3}
          scale={[5, 5, 1]}
        />
        <Lightformer
          intensity={3.2}
          form="ring"
          color="white"
          position={[0, 0, 6]}
          scale={[3, 3, 1]}
        />
      </Environment>
    </>
  );
}
