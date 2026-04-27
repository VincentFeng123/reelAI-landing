"use client";

import { useEffect } from "react";
import { scrollState } from "@/lib/scrollState";

/**
 * Per-section prism placement. Each section gets its own (x, y) world-unit
 * offset, outer Y rotation in radians, and target scale. The Prism's useFrame
 * lerps toward these targets.
 *
 * Approach: every frame we compute which section the viewport's vertical
 * centre currently sits inside, then apply that section's targets. This is
 * direction-agnostic — backward scrolling restores state correctly because
 * the active section is derived from current scroll position, not from
 * onEnter/onEnterBack callbacks (which can miss firings when sections
 * overlap or are pinned).
 *
 * The "range" for a section is [its top, the next section's top]. This
 * automatically handles GSAP-pinned sections (PillarSection, Technology),
 * because the pin extends document height, pushing the next section's
 * offsetTop down by the pin distance — so the pinned section's range
 * spans its entire scroll duration.
 *
 * Camera is at z=5.6 with FOV 38°. At z=0 (prism plane), screen half-width
 * ≈ 3.4 world units, half-height ≈ 1.93. So x=1.5 ≈ 22% right of centre.
 */

type Section = {
  id: string;
  x: number;
  y: number;
  rotY: number;
  scale: number;
};

const SECTIONS: Section[] = [
  // Hero — centred and prominent as the opening focal moment.
  { id: "hero",            x: 0,    y: 0,    rotY: 0,     scale: 1.5  },
  // Pillar — centred, scaled up; stage rotation handles facets on inner.
  { id: "pillar-section",  x: 0,    y: 0,    rotY: 0,     scale: 1.9  },
  // Problem — drifts upper-right, rotates away.
  { id: "problem",         x: 1.6,  y: 0.4,  rotY: -0.55, scale: 0.95 },
  // Solution — drifts lower-left as counterweight to right headline.
  { id: "solution",        x: -1.2, y: -0.3, rotY: 0.45,  scale: 1.15 },
  // Demo — far right, rotated away, smaller; phone is the focus.
  { id: "demo",            x: 2.4,  y: 0,    rotY: -0.7,  scale: 0.75 },
  // Tech — drifts right + rotates so it doesn't fight horizontal panels.
  { id: "tech",            x: 1.0,  y: -0.2, rotY: -0.35, scale: 0.9  },
  // Use cases — drifts upper-left, opposite the right-leaning grid.
  { id: "use-cases",       x: -1.5, y: 0.6,  rotY: 0.55,  scale: 1.0  },
  // CTA — recentres and scales up for the closing focal moment.
  { id: "cta",             x: 0,    y: 0,    rotY: 0,     scale: 1.6  },
];

type Metric = { s: Section; top: number; height: number };

const getAbsoluteTop = (el: HTMLElement): number => {
  let top = 0;
  let cur: HTMLElement | null = el;
  while (cur) {
    top += cur.offsetTop;
    cur = cur.offsetParent as HTMLElement | null;
  }
  return top;
};

export default function PrismController() {
  useEffect(() => {
    let raf = 0;
    let metrics: Metric[] = [];

    const refreshMetrics = () => {
      const result: Metric[] = [];
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id);
        if (!el) continue;
        result.push({
          s,
          top: getAbsoluteTop(el),
          height: el.offsetHeight,
        });
      }
      result.sort((a, b) => a.top - b.top);
      metrics = result;
    };

    const tick = () => {
      // Hot path: only number reads + comparisons. Metrics are cached and
      // refreshed on layout-changing events, NOT every frame.
      if (metrics.length > 0) {
        const viewportCenter = window.scrollY + window.innerHeight / 2;

        let active: Section = metrics[0].s;
        const last = metrics[metrics.length - 1];

        if (viewportCenter >= last.top + last.height) {
          active = last.s;
        } else {
          for (let i = 0; i < metrics.length; i++) {
            const m = metrics[i];
            const next = metrics[i + 1];
            const rangeStart = m.top;
            const rangeEnd = next ? next.top : m.top + m.height;
            if (viewportCenter >= rangeStart && viewportCenter < rangeEnd) {
              active = m.s;
              break;
            }
          }
        }

        scrollState.prismTargetX = active.x;
        scrollState.prismTargetY = active.y;
        scrollState.prismTargetRotY = active.rotY;
        scrollState.pillarTargetScale = active.scale;
      }

      raf = requestAnimationFrame(tick);
    };

    // Initial measurement — run once now, again after fonts/scroll-trigger
    // settle (600ms covers font load + RefreshScroll's settle), and once
    // more after window load.
    refreshMetrics();
    const settleTimer = setTimeout(refreshMetrics, 600);
    window.addEventListener("resize", refreshMetrics);
    window.addEventListener("load", refreshMetrics);

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(settleTimer);
      window.removeEventListener("resize", refreshMetrics);
      window.removeEventListener("load", refreshMetrics);
    };
  }, []);

  return null;
}
