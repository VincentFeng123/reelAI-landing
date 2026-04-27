"use client";

import dynamic from "next/dynamic";

const CinematicCanvas = dynamic(() => import("./CinematicCanvas"), {
  ssr: false,
  loading: () => null,
});

export default function CanvasMount() {
  return <CinematicCanvas />;
}
