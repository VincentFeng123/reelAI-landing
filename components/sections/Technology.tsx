"use client";

import { useGsapScroll, gsap, ScrollTrigger } from "@/hooks/useGsapScroll";

const PANELS = [
  {
    n: "i",
    title: "Search",
    headline: "We start with the question.",
    body: "A topic intent is parsed into entities, sub-questions, and prerequisite concepts. The crawl is shaped before a single video is touched.",
    visual: "search",
  },
  {
    n: "ii",
    title: "Transcript",
    headline: "Every word, time-aligned.",
    body: "Speech, on-screen text, and captions are extracted at frame-level precision. Speaker diarization separates teacher from filler.",
    visual: "transcript",
  },
  {
    n: "iii",
    title: "Segmentation",
    headline: "Atomize into moments.",
    body: "A long-form lecture becomes a directed graph of moments — definitions, demonstrations, derivations, examples, callbacks.",
    visual: "segmentation",
  },
  {
    n: "iv",
    title: "Ranking",
    headline: "Score what matters.",
    body: "Each moment is rated for clarity, density, and novelty against the topic. Only the top decile crosses the threshold.",
    visual: "ranking",
  },
];

function PanelVisual({ kind }: { kind: string }) {
  if (kind === "search") {
    return (
      <div className="frost rounded-3xl p-6 w-full max-w-md font-mono text-[12px] leading-relaxed">
        <div className="text-white/40 mb-3">// query plan</div>
        <div className="text-white/85">
          intent <span className="text-white/45">=</span> &ldquo;angular momentum,
          intuition&rdquo;
        </div>
        <div className="text-white/85 mt-1">
          entities <span className="text-white/45">=</span> [torque,
          inertia, conservation]
        </div>
        <div className="text-white/85 mt-1">
          prereqs <span className="text-white/45">=</span> [Newton II, vectors]
        </div>
        <div className="mt-4 text-white/40">// crawl seeds: 47</div>
        <div className="mt-1 text-white">→ expanding search graph…</div>
      </div>
    );
  }
  if (kind === "transcript") {
    const lines = [
      { t: "00:14", s: "Now, when an object spins,—", strong: false },
      { t: "00:18", s: "this quantity, angular momentum,", strong: true },
      { t: "00:22", s: "behaves a lot like linear momentum.", strong: true },
      { t: "00:27", s: "Anyway, my dog had a vet appointment—", strong: false },
      { t: "00:33", s: "—back to it: L equals I times omega.", strong: true },
    ];
    return (
      <div className="frost rounded-3xl p-6 w-full max-w-md">
        {lines.map((l, i) => (
          <div
            key={i}
            className={`flex gap-4 py-1.5 text-[13px] ${
              l.strong ? "text-white" : "text-white/35 line-through"
            }`}
          >
            <span className="font-mono text-[11px] text-white/40 shrink-0">
              {l.t}
            </span>
            <span>{l.s}</span>
          </div>
        ))}
        <div className="hairline mt-4" />
        <div className="mt-3 font-mono text-[11px] text-white/45">
          ↳ kept 3 / 5 lines
        </div>
      </div>
    );
  }
  if (kind === "segmentation") {
    return (
      <div className="frost rounded-3xl p-6 w-full max-w-md">
        <div className="eyebrow mb-4">Lecture · 47 min</div>
        <div className="grid grid-cols-12 gap-1.5 mb-4">
          {Array.from({ length: 47 }).map((_, i) => {
            const kind = [3, 9, 16, 22, 29, 38].includes(i)
              ? "kept"
              : [12, 19, 26, 31].includes(i)
                ? "maybe"
                : "skip";
            return (
              <div
                key={i}
                className={`h-8 rounded-sm ${
                  kind === "kept"
                    ? "bg-white"
                    : kind === "maybe"
                      ? "bg-white/30"
                      : "bg-white/8"
                }`}
              />
            );
          })}
        </div>
        <div className="flex justify-between text-[11px] font-mono text-white/55">
          <span>moment.def</span>
          <span>moment.demo</span>
          <span>moment.ex</span>
        </div>
      </div>
    );
  }
  // ranking
  const items = [
    { name: "Spinning chair demo", v: 0.97 },
    { name: "Conservation, derived", v: 0.94 },
    { name: "Real exam walk-through", v: 0.92 },
    { name: "Tangent on history", v: 0.31 },
    { name: "Ad break", v: 0.05 },
  ];
  return (
    <div className="frost rounded-3xl p-6 w-full max-w-md">
      <div className="eyebrow mb-4">Top moments</div>
      <ul className="space-y-3">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-3">
            <span className="font-mono text-[10px] text-white/40 w-5">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="text-[13px] text-white/85 flex-1 truncate">
              {it.name}
            </span>
            <div className="w-28 h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-white"
                style={{ width: `${it.v * 100}%` }}
              />
            </div>
            <span className="font-mono text-[10px] text-white/60 w-10 text-right">
              {it.v.toFixed(2)}
            </span>
          </li>
        ))}
      </ul>
      <div className="hairline mt-5" />
      <div className="mt-3 font-mono text-[11px] text-white/45">
        ↳ kept top decile
      </div>
    </div>
  );
}

export default function Technology() {
  const ref = useGsapScroll<HTMLElement>(() => {
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (isMobile || reduced) {
      // Vertical stacked reveals on mobile / reduced motion
      gsap.utils.toArray<HTMLElement>("[data-tech-panel]").forEach((p) => {
        const els = p.querySelectorAll<HTMLElement>("[data-anim='tech-fx']");
        gsap.from(els, {
          opacity: 0,
          stagger: 0.07,
          duration: 0.9,
          ease: "expo.out",
          scrollTrigger: { trigger: p, start: "top 80%" },
        });
        const visuals = p.querySelectorAll<HTMLElement>("[data-anim='tech-visual']");
        gsap.from(visuals, {
          y: 30,
          duration: 1,
          ease: "expo.out",
          scrollTrigger: { trigger: p, start: "top 80%" },
        });
      });
      return;
    }

    const track = ref.current?.querySelector<HTMLDivElement>(
      "[data-track='tech']",
    );
    if (!track) return;

    const total = track.scrollWidth - window.innerWidth;

    const horizontalTween = gsap.to(track, {
      x: () => -total,
      ease: "none",
      scrollTrigger: {
        trigger: ref.current,
        start: "top top",
        end: () => `+=${total + 200}`,
        scrub: 1,
        pin: true,
        invalidateOnRefresh: true,
        anticipatePin: 1,
      },
    });

    gsap.utils.toArray<HTMLElement>("[data-tech-panel]").forEach((p) => {
      const els = p.querySelectorAll<HTMLElement>("[data-anim='tech-fx']");
      gsap.from(els, {
        opacity: 0,
        stagger: 0.07,
        duration: 0.9,
        ease: "expo.out",
        scrollTrigger: {
          trigger: p,
          containerAnimation: horizontalTween,
          start: "left 80%",
          toggleActions: "play none none reverse",
        },
      });
      const visuals = p.querySelectorAll<HTMLElement>("[data-anim='tech-visual']");
      gsap.from(visuals, {
        y: 30,
        duration: 1,
        ease: "expo.out",
        scrollTrigger: {
          trigger: p,
          containerAnimation: horizontalTween,
          start: "left 80%",
          toggleActions: "play none none reverse",
        },
      });
    });
  }, []);

  return (
    <section
      ref={ref}
      id="tech"
      className="relative w-full md:overflow-hidden md:[height:100svh]"
    >
      <div
        data-track="tech"
        className="flex flex-col md:flex-row md:h-full will-change-transform md:[width:var(--tech-w)]"
        style={
          { ["--tech-w" as never]: `${PANELS.length * 100}vw` } as React.CSSProperties
        }
      >
        {PANELS.map((p, i) => (
          <article
            key={p.n}
            data-tech-panel
            className="relative md:w-screen md:h-full shrink-0 px-12 md:px-32 py-24 md:py-0 grid grid-cols-12 gap-3 items-center"
          >
            {/* Index */}
            <div className="col-span-12 md:col-span-2 flex md:flex-col gap-4 items-baseline">
              <span
                data-anim="tech-fx"
                className="display text-[clamp(72px,12vw,180px)] inline-block leading-[1.15] italic text-white/25 px-[0.18em] py-[0.14em] -mx-[0.18em] -my-[0.14em] -translate-x-[0.12em]"
              >
                {p.n}
              </span>
              <span
                data-anim="tech-fx"
                className="font-mono text-[11px] tracking-widest uppercase text-white/55"
              >
                {p.title}
              </span>
            </div>

            {/* Headline + body — kept narrower, sits next to the visual */}
            <div className="col-span-12 md:col-span-5 md:pr-2">
              <h3
                data-anim="tech-fx"
                className="display-tight text-[clamp(36px,5vw,72px)] text-balance"
              >
                {p.headline}
              </h3>
              <p
                data-anim="tech-fx"
                className="mt-5 max-w-sm text-[14px] text-white/65 leading-relaxed text-pretty"
              >
                {p.body}
              </p>

              <div
                data-anim="tech-fx"
                className="mt-6 flex items-center gap-4 text-[11px] font-mono uppercase tracking-widest text-white/45"
              >
                <span>{String(i + 1).padStart(2, "0")} / 04</span>
                <span className="hairline w-12" />
                <span>{p.title} layer</span>
              </div>
            </div>

            {/* Visual — pulled in close to the text. Uses translate-only
                animation (separate from tech-fx) so the frost backdrop
                stays composited from first paint. */}
            <div
              data-anim="tech-visual"
              className="col-span-12 md:col-span-5 md:pl-2 flex justify-center md:justify-start"
            >
              <PanelVisual kind={p.visual} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
