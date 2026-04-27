"use client";

import { useGsapScroll, gsap } from "@/hooks/useGsapScroll";

const STEPS = [
  {
    n: "01",
    title: "We crawl.",
    body: "Every long-form video on a topic — pulled, transcribed, and indexed.",
  },
  {
    n: "02",
    title: "We segment.",
    body: "Models split each video into atomic moments — explanations, demos, examples.",
  },
  {
    n: "03",
    title: "We rank.",
    body: "Each moment is scored for clarity, novelty, and signal-to-noise.",
  },
  {
    n: "04",
    title: "We stitch.",
    body: "The top-scoring moments become a single, infinite vertical feed.",
  },
];

export default function Solution() {
  const ref = useGsapScroll<HTMLElement>(() => {
    gsap.from("[data-anim='sol-line']", {
      yPercent: 110,
      opacity: 0,
      stagger: 0.07,
      duration: 1.2,
      ease: "expo.out",
      scrollTrigger: {
        trigger: "[data-anim-trigger='sol-headline']",
        start: "top 75%",
      },
    });

    gsap.from("[data-anim='sol-step']", {
      y: 32,
      stagger: 0.1,
      duration: 0.9,
      ease: "expo.out",
      scrollTrigger: {
        trigger: "[data-anim-trigger='sol-steps']",
        start: "top 70%",
      },
    });

    // Animated counter for ratio
    const counter = { v: 200 };
    gsap.to(counter, {
      v: 1,
      ease: "expo.out",
      duration: 2,
      onUpdate: () => {
        const el = document.querySelector("[data-anim='sol-ratio']");
        if (el) el.textContent = Math.round(counter.v).toString();
      },
      scrollTrigger: {
        trigger: "[data-anim='sol-ratio']",
        start: "top 80%",
      },
    });
  }, []);

  return (
    <section
      ref={ref}
      id="solution"
      className="relative min-h-[100svh] w-full px-6 md:px-12 pt-8 pb-24 md:pt-12 md:pb-32"
    >
      <div className="mx-auto max-w-[1480px]">
        {/* Asymmetric headline — type pushed right */}
        <div
          className="grid grid-cols-12 gap-6 md:gap-10"
          data-anim-trigger="sol-headline"
        >
          <div className="col-span-12 md:col-span-5">
            <div className="frost rounded-3xl p-8 md:p-10 sticky top-32">
              <p className="eyebrow mb-6">Coverage</p>
              <div className="flex items-baseline gap-3">
                <span
                  data-anim="sol-ratio"
                  className="display text-[88px] md:text-[120px] leading-none"
                >
                  200
                </span>
                <span className="text-white/40 text-2xl">videos →</span>
                <span className="display text-[88px] md:text-[120px] leading-none">
                  1
                </span>
              </div>
              <p className="text-[14px] text-white/60 mt-6 leading-relaxed">
                Every video on the topic, condensed to a single feed of
                clips that actually answer the question.
              </p>
            </div>
          </div>

          <div className="col-span-12 md:col-span-7">
            <h2 className="display-tight text-[clamp(48px,8.5vw,148px)]">
              <span className="block overflow-hidden pb-[0.22em] -mb-[0.22em]">
                <span data-anim="sol-line" className="block">
                  ReelAI keeps
                </span>
              </span>
              <span className="block overflow-hidden pb-[0.22em] -mb-[0.22em]">
                <span data-anim="sol-line" className="block italic">
                  the moments
                </span>
              </span>
              <span className="block overflow-hidden pb-[0.22em] -mb-[0.22em]">
                <span data-anim="sol-line" className="block">
                  that change
                </span>
              </span>
              <span className="block overflow-hidden pb-[0.22em] -mb-[0.22em]">
                <span data-anim="sol-line" className="block text-white/40">
                  what you know.
                </span>
              </span>
            </h2>
          </div>
        </div>

        {/* Steps grid */}
        <div
          className="mt-24 md:mt-32 grid grid-cols-12 gap-6"
          data-anim-trigger="sol-steps"
        >
          {STEPS.map((s, i) => (
            <div
              key={s.n}
              data-anim="sol-step"
              className={`col-span-12 md:col-span-3 ${
                i % 2 === 0 ? "md:mt-0" : "md:mt-12"
              }`}
            >
              <div className="frost rounded-3xl p-8 h-full">
                <div className="flex items-center justify-between mb-12">
                  <span className="font-mono text-[11px] tracking-widest text-white/45">
                    {s.n}
                  </span>
                  <span className="block w-2 h-2 rounded-full bg-white/40" />
                </div>
                <h3 className="display text-[28px] md:text-[34px]">
                  {s.title}
                </h3>
                <p className="text-[14px] text-white/60 mt-4 leading-relaxed">
                  {s.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
