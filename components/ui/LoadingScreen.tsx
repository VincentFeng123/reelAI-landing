"use client";

import { useEffect, useRef, useState } from "react";
import { scrollState } from "@/lib/scrollState";

/**
 * Editorial loader.
 *
 * No dark overlay anymore — the body's `bg-ink-50` is dark enough on its
 * own, and the main canvas (CinematicCanvas) is rendered behind. While
 * `loaderActive` is true, the canvas paints the prism in its loader
 * pose: chunks invisible, white shards flying in to assemble the model.
 *
 * On completion the component flips `scrollState.loaderActive` to false
 * (which makes the prism shift + rotate to the hero pose, the chunk
 * material fade in, and the shards fade out), broadcasts
 * `reelai:loader-fade` so Hero plays its slide-up reveal in lockstep,
 * and the right-side text plays a matching slide-up exit.
 */

const WORD = "ReelAI";
const CHARS = WORD.split("");

/**
 * Editorial subtitle phrases. Italic display, character-stagger reveal,
 * each phrase is a beat in ReelAI's actual indexing process — scanning
 * lectures → aligning words → ranking moments — ending on "ready". The
 * grammar is parallel ("verb-ing the X") so successive phrases feel like
 * one continuous thought rather than four loader strings.
 */
const CAPTIONS = [
  "scanning every lecture",
  "aligning every word",
  "keeping the moments worth keeping",
  "ready",
];

/** Match `PrismAssemblyShards.FLY_WINDOW` — see constant comment there. */
const ASSEMBLY_FLY_WINDOW = 0.18;

export default function LoadingScreen() {
  const [pct, setPct] = useState(0);
  const [captionIdx, setCaptionIdx] = useState(0);
  const [fading, setFading] = useState(false);
  const [removed, setRemoved] = useState(false);
  // Outgoing/incoming caption pair so the cube-flip transition can render
  // both faces simultaneously during the swap. Once the entry animation
  // finishes we clear `outgoing` so only the current caption stays in DOM.
  const [outgoing, setOutgoing] = useState<{ key: number; text: string } | null>(
    null,
  );
  const startRef = useRef(0);
  const lastCaptionIdxRef = useRef(0);

  // Whenever the caption index advances, snapshot the previous text as
  // the outgoing phrase. The keyed render below uses captionIdx as the
  // incoming key so React remounts the entering span and replays the
  // per-character stagger animation. Outgoing is cleared after long
  // enough that even the longest caption's stagger-out has finished
  // (0.5 s anim + worst-case ~0.7 s stagger).
  useEffect(() => {
    if (captionIdx === lastCaptionIdxRef.current) return;
    const previousText = CAPTIONS[lastCaptionIdxRef.current];
    setOutgoing({ key: lastCaptionIdxRef.current, text: previousText });
    lastCaptionIdxRef.current = captionIdx;
    const t = setTimeout(() => setOutgoing(null), 1300);
    return () => clearTimeout(t);
  }, [captionIdx]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    // Reset on (re)mount so HMR replays the loader instead of inheriting
    // the previous run's reelai-loaded state.
    document.body.classList.remove("reelai-loaded");

    // Force every (re)load to start at the top of the document. Browsers
    // default to `auto` for `history.scrollRestoration`, which restores
    // the user's previous scrollY on reload — that would land the prism
    // mid-section-II after a reload there, leaving the model with section
    // II's 50° tilt instead of hero's. Switching to `manual` plus an
    // explicit scrollTo(0, 0) makes the entry deterministic.
    if (typeof window !== "undefined") {
      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
      }
      window.scrollTo(0, 0);
    }

    // Hard scroll lock during the loader — wheel / touch / keyboard scroll
    // are all blocked. The CSS rule on `body:not(.reelai-loaded)` already
    // sets overflow: hidden, but viewport scrolling can leak through the
    // html element on some browsers, so we belt-and-suspender by setting
    // overflow:hidden on both via JS. Restored when the loader hands off.
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    scrollState.loaderActive = true;
    scrollState.loaderProgress = 0;
    startRef.current = performance.now();

    const fontsReady =
      (document as Document & { fonts?: { ready: Promise<void> } }).fonts
        ?.ready ?? Promise.resolve();

    // The prism mount is heavy (33 MB GLB + synchronous CSG split + 4×
    // particle sampling, ~1.5–3 s on cold load). Wait for PrismParts to
    // signal `scrollState.prismReady` before we start the assembly ramp +
    // minDisplay timer — otherwise the loader dismisses before the prism
    // even renders and the user sees no shards fly in. 10 s timeout
    // fallback so a broken asset doesn't pin the loader forever.
    const prismReady = new Promise<void>((resolve) => {
      if (scrollState.prismReady) return resolve();
      let r = 0;
      const check = () => {
        if (scrollState.prismReady) {
          cancelAnimationFrame(r);
          resolve();
        } else {
          r = requestAnimationFrame(check);
        }
      };
      r = requestAnimationFrame(check);
      setTimeout(resolve, 10000);
    });

    // Assembly ramp — drives `scrollState.loaderProgress` 0 → 1 over
    // ASSEMBLY_DURATION_MS. Linear (not eased) so the percent counter and
    // the visible shard stacking advance in lockstep — an ease-out curve
    // would put the percent ahead of the shards in the first half. The
    // displayed pct subtracts the per-shard fly window so it tracks "%
    // landed" rather than "% started," tightening the visual alignment.
    // Long, smooth descent — each shard takes ~1530 ms (0.18 × 8500)
    // to traverse the extreme funnel from wide top to narrow bottom,
    // so the user sees an actual gliding fall rather than a quick
    // arrival. ~12 shards are in flight at any moment, blending into
    // a continuous waterfall through the funnel.
    const ASSEMBLY_DURATION_MS = 8500;
    let fillRaf = 0;
    prismReady.then(() => {
      const fillStart = performance.now();
      const tickFill = () => {
        const t = Math.min(1, (performance.now() - fillStart) / ASSEMBLY_DURATION_MS);
        scrollState.loaderProgress = Math.max(
          scrollState.loaderProgress,
          Math.min(0.98, t),
        );
        // % completed = fraction of shards whose fly windows have ENDED.
        // With shards staggered i/(N-1) * (1-FLY_WINDOW), shard i ends at
        // its flyStart+FLY_WINDOW. Solving for "fraction whose end ≤ t":
        //   fraction = max(0, (t - FLY_WINDOW) / (1 - FLY_WINDOW))
        // This makes pct=50 mean exactly half the shards have landed.
        const completed =
          t < ASSEMBLY_FLY_WINDOW
            ? 0
            : (t - ASSEMBLY_FLY_WINDOW) / (1 - ASSEMBLY_FLY_WINDOW);
        setPct((p) => Math.max(p, Math.min(99, Math.round(completed * 100))));
        if (t < 1) fillRaf = requestAnimationFrame(tickFill);
      };
      fillRaf = requestAnimationFrame(tickFill);
    });

    // Caption interval — long enough that each editorial phrase has
    // time to fully reveal (≈1.2 s with character stagger), hold, and
    // begin its stagger-out before the next phrase starts entering.
    // Stops at length-2 because the final caption ("ready") is set
    // explicitly in the post-ramp Promise.all branch when the prism is
    // actually finished.
    const captionInterval = setInterval(() => {
      setCaptionIdx((i) => Math.min(i + 1, CAPTIONS.length - 2));
    }, 2100);

    // Hold the assembled prism on screen briefly after the ramp finishes
    // so the user sees the completed shape before the hand-off begins.
    const HOLD_AFTER_ASSEMBLY_MS = 600;
    const minDisplayAfterReady = prismReady.then(
      () =>
        new Promise<void>((r) =>
          setTimeout(r, ASSEMBLY_DURATION_MS + HOLD_AFTER_ASSEMBLY_MS),
        ),
    );

    Promise.all([fontsReady, minDisplayAfterReady]).then(() => {
      scrollState.loaderProgress = 1;
      setPct(100);
      setCaptionIdx(CAPTIONS.length - 1);
      setTimeout(() => {
        // Hand-off: shards fade out, chunks fade in (textured), prism
        // slides toward the hero pose, Hero plays its slide-up reveal.
        // `body.reelai-loaded` unhides the entire DOM content layer
        // (.reelai-content) which fades in via globals.css. Scroll is
        // released at top — no restoration; reloads always start fresh
        // at the top of the page so the prism never inherits a
        // section-II pose from a stale scrollY.
        scrollState.loaderActive = false;
        setFading(true);
        html.style.overflow = prevHtmlOverflow;
        body.style.overflow = prevBodyOverflow;
        document.body.classList.add("reelai-loaded");
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("reelai:loader-fade"));
        }
      }, 280);
      setTimeout(() => setRemoved(true), 1400);
    });

    return () => {
      cancelAnimationFrame(fillRaf);
      clearInterval(captionInterval);
      // Defensive: if the component unmounts before the loader handler
      // runs (HMR, error boundary), restore overflow so the page isn't
      // left permanently locked.
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, []);

  if (removed) return null;

  return (
    <div className="loader-overlay" data-fading={fading} aria-hidden>
      <div className="loader-stage">
        {/* Left half is intentionally empty — the main canvas paints the
            prism wireframe + flowing particles in this region. */}
        <div className="loader-crystal-wrap" />

        <div className="loader-title-wrap">
          <div className="loader-eyebrow">
            <span className="loader-eyebrow-tick" />
            <span>REELAI · 2026</span>
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

          <div className="loader-caption" aria-live="polite">
            {outgoing && (
              <CaptionPhrase
                key={`out-${outgoing.key}`}
                text={outgoing.text}
                outgoing
              />
            )}
            <CaptionPhrase
              key={`in-${captionIdx}`}
              text={CAPTIONS[captionIdx]}
            />
          </div>
        </div>
      </div>

      {/* Big bottom-right percent. Outside `.loader-title-wrap` so it's
          anchored to the viewport corner, not stacked beneath the
          captions. Fades out with the rest of the loader-overlay. */}
      <div className="loader-pct-big" aria-hidden>
        <span className="loader-pct-big-num">{pct}</span>
        <span className="loader-pct-big-symbol">%</span>
      </div>
    </div>
  );
}

/**
 * One editorial phrase in the loader caption stack. Renders each
 * character as its own span so the per-char stagger reveal works at the
 * CSS keyframe level — no JS per-frame work, no `key`-based remounts of
 * sub-spans. The parent `<CaptionPhrase>` is keyed in the parent so the
 * incoming and outgoing instances are independent and animate
 * concurrently.
 */
function CaptionPhrase({
  text,
  outgoing = false,
}: {
  text: string;
  outgoing?: boolean;
}) {
  // Stagger constant matches the CSS keyframe duration so longer
  // phrases never overlap their own animation tail with the swap.
  const STAGGER = 0.028;
  return (
    <span
      className={
        outgoing
          ? "loader-caption-text loader-caption-text-out"
          : "loader-caption-text"
      }
    >
      {Array.from(text).map((c, i) => (
        <span
          key={i}
          className="loader-caption-char"
          style={{ animationDelay: `${i * STAGGER}s` }}
        >
          {c === " " ? " " : c}
        </span>
      ))}
    </span>
  );
}
