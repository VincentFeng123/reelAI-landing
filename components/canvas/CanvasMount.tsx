"use client";

import dynamic from "next/dynamic";

const CinematicCanvas = dynamic(() => import("./CinematicCanvas"), {
  ssr: false,
  loading: () => null,
});

// Three.js r184 deprecated THREE.Clock in favour of THREE.Timer; the warning
// fires from @react-three/fiber's internal store init (which we can't patch
// without forking). Filter the specific message so the dev console stays
// clean. Remove this once R3F migrates to Timer.
if (typeof window !== "undefined") {
  const _warn = console.warn;
  let patched = (console.warn as unknown as { __prismPatched?: boolean }).__prismPatched;
  if (!patched) {
    const wrapped = (...args: unknown[]) => {
      const first = args[0];
      if (typeof first === "string" && first.includes("THREE.Clock") && first.includes("deprecated")) {
        return;
      }
      _warn.apply(console, args as Parameters<typeof console.warn>);
    };
    (wrapped as unknown as { __prismPatched: boolean }).__prismPatched = true;
    console.warn = wrapped;
  }
}

export default function CanvasMount() {
  return <CinematicCanvas />;
}
