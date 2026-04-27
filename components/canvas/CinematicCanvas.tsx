"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useState } from "react";
import Prism from "./Prism";
import SceneLights from "./SceneLights";
import ReelRibbon from "./ReelRibbon";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useIsMobile } from "@/hooks/useIsMobile";

export default function CinematicCanvas() {
  const reduced = useReducedMotion();
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 -z-0 pointer-events-none"
      aria-hidden
      style={{ contain: "strict" }}
    >
      <Canvas
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          alpha: true,
        }}
        dpr={isMobile ? [1, 1.5] : [1, 2]}
        camera={{ position: [0, 0, 5.6], fov: 38 }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <SceneLights />
          <Prism reduced={reduced} />
          {!isMobile && !reduced && <ReelRibbon reduced={reduced} />}
          <fog attach="fog" args={["#050505", 8, 22]} />
        </Suspense>
      </Canvas>
      <div className="absolute inset-0 pointer-events-none vignette" />
    </div>
  );
}
