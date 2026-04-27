"use client";

import { useGsapScroll, gsap, ScrollTrigger } from "@/hooks/useGsapScroll";
import { useEffect, useRef, useState } from "react";

const TOPICS = [
  "AP Physics: angular momentum",
  "Rust borrow checker explained",
  "Pottery glazing techniques",
  "Stoic philosophy, in 90s",
  "How transformers actually work",
  "Espresso extraction theory",
];

const REELS = [
  {
    title: "The intuition behind torque",
    src: "Walter Lewin · MIT 8.01",
    dur: "1:24",
    score: "0.97",
  },
  {
    title: "Why angular momentum is conserved",
    src: "3Blue1Brown · clip",
    dur: "0:48",
    score: "0.94",
  },
  {
    title: "A spinning chair, a wheel, a mind blown",
    src: "Veritasium · key moment",
    dur: "1:12",
    score: "0.93",
  },
  {
    title: "Rotational kinetic energy in 60s",
    src: "Khan Academy · clip",
    dur: "1:01",
    score: "0.91",
  },
  {
    title: "Real exam problem, walked through",
    src: "Flipping Physics · solution",
    dur: "1:36",
    score: "0.90",
  },
];

function useAutoType() {
  const [text, setText] = useState("");
  const [i, setI] = useState(0);

  useEffect(() => {
    const target = TOPICS[i];
    let j = 0;
    let typing = true;
    const interval = setInterval(() => {
      if (typing) {
        j += 1;
        setText(target.slice(0, j));
        if (j >= target.length) {
          typing = false;
          setTimeout(() => {
            typing = false;
            const erase = setInterval(() => {
              j -= 1;
              setText(target.slice(0, j));
              if (j <= 0) {
                clearInterval(erase);
                setI((p) => (p + 1) % TOPICS.length);
              }
            }, 22);
          }, 1600);
          clearInterval(interval);
        }
      }
    }, 48);
    return () => clearInterval(interval);
  }, [i]);

  return text;
}

export default function Demo() {
  const ref = useGsapScroll<HTMLElement>(() => {
    const reelEls = gsap.utils.toArray<HTMLElement>("[data-anim='reel']");

    // Carousel visibility/zoom is driven by CarouselController (spans Demo+Tech).

    gsap.from("[data-anim='demo-headline']", {
      opacity: 0,
      y: 28,
      duration: 1.1,
      ease: "expo.out",
      scrollTrigger: {
        trigger: "[data-anim-trigger='demo']",
        start: "top 70%",
      },
    });

    // Reel cards rise from bottom of phone — translate only, no opacity
    // animation so the frost backdrop is rendered from the start (no
    // transparent → blur pop-in).
    gsap.from(reelEls, {
      yPercent: 80,
      stagger: 0.12,
      duration: 1,
      ease: "expo.out",
      scrollTrigger: {
        trigger: "[data-anim-trigger='demo-phone']",
        start: "top 80%",
      },
    });

    // Floating chips parallax
    gsap.utils
      .toArray<HTMLElement>("[data-anim='chip']")
      .forEach((el, i) => {
        gsap.to(el, {
          y: i % 2 === 0 ? -60 : 40,
          x: i % 3 === 0 ? -30 : 20,
          ease: "none",
          scrollTrigger: {
            trigger: "[data-anim-trigger='demo']",
            start: "top bottom",
            end: "bottom top",
            scrub: 1,
          },
        });
      });
  }, []);

  const typing = useAutoType();

  return (
    <section
      ref={ref}
      id="demo"
      className="relative min-h-[140svh] w-full px-6 md:px-12 pt-8 pb-24 md:pt-12 md:pb-32"
    >
      <div className="mx-auto max-w-[1480px]" data-anim-trigger="demo">
        {/* Headline */}
        <div className="grid grid-cols-12 gap-6 mb-16">
          {/* Left meta column — small mono caption */}
          <div className="col-span-12 md:col-span-3 order-1">
            <div className="sticky top-32 flex flex-col gap-4 text-[11px] tracking-[0.2em] uppercase text-white/45 font-mono">
              <span className="block w-12 h-px bg-white/20" />
              <span>Just the moments.</span>
            </div>
          </div>
          <div
            className="col-span-12 md:col-span-9 order-2"
            data-anim="demo-headline"
          >
            <h2 className="display-tight text-[clamp(40px,6vw,96px)] text-balance">
              Type a topic.
              <span className="text-white/40 italic"> Get a feed.</span>
            </h2>
            <p className="mt-6 max-w-md text-[15px] text-white/60 leading-relaxed">
              No playlists. No timestamps. Just the moments — sequenced like
              short-form, indexed like a search engine.
            </p>
          </div>
        </div>

        {/* Demo stage */}
        <div className="relative grid grid-cols-12 gap-6 items-center">
          {/* Floating chips left */}
          <div className="hidden md:block col-span-3 relative h-[640px]">
            <span
              data-anim="chip"
              className="absolute top-12 left-2 frost rounded-full px-4 py-2 text-[12px] text-white/70"
            >
              torque
            </span>
            <span
              data-anim="chip"
              className="absolute top-48 left-16 frost rounded-full px-4 py-2 text-[12px] text-white/70"
            >
              moment of inertia
            </span>
            <span
              data-anim="chip"
              className="absolute top-[340px] left-6 frost rounded-full px-4 py-2 text-[12px] text-white/70"
            >
              precession
            </span>
            <span
              data-anim="chip"
              className="absolute bottom-24 left-12 frost rounded-full px-4 py-2 text-[12px] text-white/70"
            >
              angular velocity
            </span>
          </div>

          {/* Phone */}
          <div
            data-anim-trigger="demo-phone"
            className="col-span-12 md:col-span-6 flex justify-center"
          >
            <div className="relative w-[320px] md:w-[360px] aspect-[9/19] frost-strong rounded-[44px] p-3 shadow-glow">
              {/* Notch */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-black/80 rounded-full z-20 flex items-center justify-center gap-2">
                <div className="w-1 h-1 rounded-full bg-white/30" />
                <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
              </div>

              {/* Screen */}
              <div className="relative h-full w-full rounded-[34px] bg-ink-100 overflow-hidden">
                {/* Search field */}
                <div className="absolute top-12 left-3 right-3 z-10 frost rounded-2xl px-4 py-3 flex items-center gap-3">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    className="text-white/60 shrink-0"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <span className="text-[12px] tracking-tight text-white/85 truncate">
                    {typing}
                    <span className="inline-block w-px h-3 bg-white align-middle ml-0.5 animate-pulse" />
                  </span>
                </div>

                {/* Reel cards stack */}
                <div className="absolute inset-x-3 top-28 bottom-3 flex flex-col gap-3 overflow-hidden">
                  {REELS.slice(0, 4).map((r, i) => (
                    <div
                      key={i}
                      data-anim="reel"
                      className="frost rounded-2xl p-4 flex items-start gap-3 relative"
                      style={{
                        background: `linear-gradient(135deg, rgba(255,255,255,${
                          0.08 - i * 0.012
                        }), rgba(255,255,255,0.02))`,
                      }}
                    >
                      <div className="relative w-14 h-20 rounded-xl overflow-hidden shrink-0 bg-gradient-to-br from-white/15 to-white/5 grid place-items-center">
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="white"
                          opacity="0.85"
                        >
                          <polygon points="6,4 20,12 6,20" />
                        </svg>
                        <span className="absolute bottom-1 right-1 text-[9px] font-mono text-white/80 bg-black/40 px-1 rounded">
                          {r.dur}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] text-white tracking-tight truncate">
                          {r.title}
                        </div>
                        <div className="text-[10px] text-white/50 truncate mt-1">
                          {r.src}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-1 flex-1 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full bg-white"
                              style={{ width: `${parseFloat(r.score) * 100}%` }}
                            />
                          </div>
                          <span className="font-mono text-[9px] text-white/60">
                            {r.score}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom indicator */}
                <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-24 h-1 rounded-full bg-white/30" />
              </div>
            </div>
          </div>

          {/* Right column — search transcript / score breakdown */}
          <div className="col-span-12 md:col-span-3 flex flex-col gap-8">
            <div className="frost rounded-2xl p-5 md:-translate-x-6">
              <div className="eyebrow mb-3">Live · Indexing</div>
              <div className="space-y-2 font-mono text-[11px] text-white/70 leading-relaxed">
                <div>+ ingested 218 videos</div>
                <div>+ transcripts: 312 hrs</div>
                <div>+ segments: 4,421</div>
                <div className="text-white">↳ ranked top 27</div>
              </div>
            </div>
            <div className="frost rounded-2xl p-5 md:-translate-x-16">
              <div className="eyebrow mb-3">Sample score</div>
              <div className="flex items-baseline justify-between">
                <span className="display text-[44px]">0.97</span>
                <span className="text-[11px] text-white/45 font-mono">
                  clarity · novelty · density
                </span>
              </div>
            </div>
            <div className="frost rounded-2xl p-5 md:-translate-x-8">
              <div className="eyebrow mb-3">Time saved</div>
              <div className="flex items-baseline justify-between">
                <span className="display text-[44px]">4h 11m</span>
                <span className="text-[11px] text-white/45 font-mono">
                  per topic
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
