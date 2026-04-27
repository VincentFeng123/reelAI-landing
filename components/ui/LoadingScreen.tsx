"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Editorial cinema-title loading screen.
 *
 * Composition:
 *   - Massive italic Fraunces "ReelAI" wordmark in the centre, characters
 *     reveal one-by-one via blur-defocus.
 *   - Hairline grows beneath the wordmark, ruler-style.
 *   - Live "boot stream" of mono telemetry below the underline (fake but
 *     coherent: indexing, transcript, ranking — mirrors the product's pipeline).
 *   - Four corner mono blocks: coordinates · timecode · engine label · counter.
 *   - Faint blueprint grid + radial vignette + horizontal scan line.
 *
 * On ready: wordmark scales up slightly and fades, corner brackets shoot
 * outward, scan line accelerates and disappears.
 */

const WORD = "ReelAI";
const CHARS = WORD.split("");

const STREAM_LINES = [
  "init retrieval engine · v 0.1.0",
  "preloading scene · 8 mb cache",
  "lightformers ready · 4 of 4",
  "indexing source #218 · 312 hrs",
  "transcript aligned · 1,847 lines",
  "diarization complete",
  "moment graph · depth 4 · bridges 7",
  "ranking · clarity · novelty · density",
  "threshold 0.83 · top decile kept",
  "shader compile · prism · ok",
  "particle field · 300 / 300",
  "cursor · viewfinder mounted",
  "ready.",
];

const CAPTIONS = [
  "INITIALIZING",
  "PRELOADING REELS",
  "BUILDING RETRIEVAL GRAPH",
  "READY",
];

export default function LoadingScreen() {
  const [pct, setPct] = useState(0);
  const [captionIdx, setCaptionIdx] = useState(0);
  const [streamCursor, setStreamCursor] = useState(0);
  const [tc, setTc] = useState("00:00:00");
  const [fading, setFading] = useState(false);
  const [removed, setRemoved] = useState(false);
  const startRef = useRef(0);

  useEffect(() => {
    if (typeof document === "undefined") return;

    startRef.current = performance.now();
    const fontsReady =
      (document as Document & { fonts?: { ready: Promise<void> } }).fonts
        ?.ready ?? Promise.resolve();
    const minDisplay = new Promise<void>((r) => setTimeout(r, 1800));

    let raf = 0;
    const ramp = 1500;
    const tickRamp = () => {
      const t = (performance.now() - startRef.current) / ramp;
      const eased = 1 - Math.pow(1 - Math.min(1, t), 3);
      setPct((p) => Math.max(p, Math.round(eased * 96)));
      if (t < 1) raf = requestAnimationFrame(tickRamp);
    };
    raf = requestAnimationFrame(tickRamp);

    const tcInterval = setInterval(() => {
      const ms = performance.now() - startRef.current;
      const total = Math.floor(ms / 10);
      const cs = total % 100;
      const s = Math.floor(total / 100) % 60;
      const m = Math.floor(total / 6000);
      setTc(
        `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}:${String(cs).padStart(2, "0")}`,
      );
    }, 33);

    const captionInterval = setInterval(() => {
      setCaptionIdx((i) => Math.min(i + 1, CAPTIONS.length - 2));
    }, 480);

    const streamInterval = setInterval(() => {
      setStreamCursor((c) => Math.min(c + 1, STREAM_LINES.length - 1));
    }, 130);

    Promise.all([fontsReady, minDisplay]).then(() => {
      setPct(100);
      setCaptionIdx(CAPTIONS.length - 1);
      setStreamCursor(STREAM_LINES.length - 1);
      setTimeout(() => setFading(true), 280);
      setTimeout(() => setRemoved(true), 1100);
    });

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(tcInterval);
      clearInterval(captionInterval);
      clearInterval(streamInterval);
    };
  }, []);

  if (removed) return null;

  const visibleStream = STREAM_LINES.slice(
    Math.max(0, streamCursor - 4),
    streamCursor + 1,
  );

  return (
    <div className="loader-overlay" data-fading={fading} aria-hidden>
      <div className="loader-grid" />
      <div className="loader-vignette" />
      <div className="loader-rule loader-rule--v" style={{ left: "12%" }} />
      <div className="loader-rule loader-rule--v" style={{ right: "12%" }} />

      <div className="loader-corner loader-corner--tl" />
      <div className="loader-corner loader-corner--tr" />
      <div className="loader-corner loader-corner--bl" />
      <div className="loader-corner loader-corner--br" />

      <div className="loader-meta loader-meta--tl">
        <span className="loader-meta-key">LAT</span>
        <span>40°44′02″N</span>
        <span className="loader-meta-tick" />
        <span className="loader-meta-key">LON</span>
        <span>73°59′33″W</span>
      </div>

      <div className="loader-meta loader-meta--tr">
        <span className="loader-meta-key">T+</span>
        <span className="loader-tc">{tc}</span>
      </div>

      <div className="loader-stage">
        <div className="loader-eyebrow">
          <span className="loader-eyebrow-tick" />
          <span>REELAI · 2026</span>
          <span className="loader-eyebrow-tick" />
        </div>

        <h1 className="loader-wordmark" aria-label="ReelAI">
          {CHARS.map((c, i) => (
            <span
              key={i}
              className="loader-char"
              style={{ animationDelay: `${0.18 + i * 0.07}s` }}
            >
              {c}
            </span>
          ))}
        </h1>

        <div className="loader-ruler">
          <span className="loader-ruler-tick loader-ruler-tick--end" />
          <span className="loader-ruler-line" />
          <span className="loader-ruler-tick loader-ruler-tick--end" />
        </div>

        <div className="loader-caption">
          <span className="loader-caption-prefix">▸</span>
          <span className="loader-caption-text">{CAPTIONS[captionIdx]}</span>
          <span className="loader-caption-cursor">_</span>
        </div>

        <ul className="loader-stream">
          {visibleStream.map((line, i) => {
            const idx = Math.max(0, streamCursor - 4) + i;
            const isLast = idx === streamCursor;
            return (
              <li
                key={idx}
                className="loader-stream-line"
                style={{ opacity: 0.25 + (i / visibleStream.length) * 0.7 }}
              >
                <span className="loader-stream-prompt">{isLast ? "›" : " "}</span>
                <span>{line}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="loader-meta loader-meta--bl">
        <span className="loader-meta-key">NODE</span>
        <span>retrieval-engine</span>
        <span className="loader-meta-tick" />
        <span className="loader-meta-key">REGION</span>
        <span>us-east-1</span>
      </div>

      <div className="loader-meta loader-meta--br">
        <span className="loader-meta-key">PROGRESS</span>
        <span className="loader-meta-tick" />
        <span className="loader-pct">
          {String(pct).padStart(3, "0")}
          <span className="loader-pct-slash">/</span>100
        </span>
      </div>

      <div className="loader-scan" />
    </div>
  );
}
