"use client";

import { Environment, Lightformer } from "@react-three/drei";

export default function SceneLights() {
  return (
    <>
      {/* Soft fill */}
      <ambientLight intensity={0.15} />

      {/* Key light from upper-right */}
      <directionalLight
        position={[4, 6, 5]}
        intensity={1.1}
        color="#ffffff"
      />
      {/* Rim light from behind */}
      <directionalLight
        position={[-3, 2, -4]}
        intensity={0.6}
        color="#ffffff"
      />
      {/* Studio environment with custom B&W lightformers — gives the prism its dramatic refractions */}
      <Environment resolution={512} frames={1}>
        <color attach="background" args={["#050505"]} />
        <Lightformer
          intensity={2.5}
          color="white"
          position={[0, 4, 4]}
          rotation-x={-Math.PI / 4}
          scale={[8, 4, 1]}
        />
        <Lightformer
          intensity={1.4}
          color="white"
          position={[-5, 2, -3]}
          rotation-y={Math.PI / 3}
          scale={[6, 6, 1]}
        />
        <Lightformer
          intensity={1.0}
          color="white"
          position={[5, -2, -2]}
          rotation-y={-Math.PI / 3}
          scale={[5, 5, 1]}
        />
        <Lightformer
          intensity={3.0}
          form="ring"
          color="white"
          position={[0, 0, 6]}
          scale={[3, 3, 1]}
        />
      </Environment>
    </>
  );
}
