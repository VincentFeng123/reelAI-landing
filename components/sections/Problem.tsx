"use client";

import { useGsapScroll, gsap, ScrollTrigger } from "@/hooks/useGsapScroll";

const STAMPS = [
  { t: "00:34", l: "How does inertia really feel?" },
  { t: "07:51", l: "Skip the intro" },
  { t: "14:21", l: "Equation walkthrough" },
  { t: "21:09", l: "Tangent on history" },
  { t: "33:42", l: "Real-world example" },
  { t: "47:18", l: "The actual answer" },
  { t: "58:02", l: "Sponsor segment" },
  { t: "1:14:45", l: "What you actually wanted" },
];

export default function Problem() {
  const ref = useGsapScroll<HTMLElement>(() => {
    gsap.from("[data-anim='problem-line']", {
      yPercent: 110,
      opacity: 0,
      stagger: 0.08,
      duration: 1.2,
      ease: "expo.out",
      scrollTrigger: {
        trigger: "[data-anim-trigger='problem-headline']",
        start: "top 78%",
      },
    });

    gsap.from("[data-anim='problem-stamp']", {
      opacity: 0,
      x: 24,
      stagger: 0.06,
      duration: 0.7,
      ease: "power3.out",
      scrollTrigger: {
        trigger: "[data-anim-trigger='problem-stamps']",
        start: "top 80%",
      },
    });

    // Subtle scroll-driven dim/cross-out animation
    gsap.to("[data-anim='problem-strike']", {
      width: "100%",
      stagger: 0.05,
      duration: 1.4,
      ease: "expo.out",
      scrollTrigger: {
        trigger: "[data-anim-trigger='problem-stamps']",
        start: "top 60%",
        end: "bottom 20%",
        scrub: 1.2,
      },
    });
  }, []);

  return (
    <section
      ref={ref}
      id="problem"
      className="relative min-h-[100svh] w-full px-6 md:px-12 pt-8 pb-24 md:pt-12 md:pb-32"
    >
      <div className="mx-auto max-w-[1480px] grid grid-cols-12 gap-6 md:gap-10">
        {/* Left meta column */}
        <div className="col-span-12 md:col-span-2 order-1">
          <div className="sticky top-32 flex flex-col gap-4 text-[11px] tracking-[0.2em] uppercase text-white/45 font-mono">
            <span className="block w-12 h-px bg-white/20" />
            <span>The web is loud.</span>
          </div>
        </div>

        {/* Big headline */}
        <div
          className="col-span-12 md:col-span-10 order-2"
          data-anim-trigger="problem-headline"
        >
          <h2 className="display-tight text-[clamp(56px,9.5vw,168px)]">
            <span className="block overflow-hidden pb-[0.22em] -mb-[0.22em]">
              <span data-anim="problem-line" className="block">
                You watch
              </span>
            </span>
            <span className="block overflow-hidden pb-[0.22em] -mb-[0.22em]">
              <span data-anim="problem-line" className="block italic">
                three hours
              </span>
            </span>
            <span className="block overflow-hidden pb-[0.22em] -mb-[0.22em]">
              <span data-anim="problem-line" className="block">
                to find the
              </span>
            </span>
            <span className="block overflow-hidden pb-[0.22em] -mb-[0.22em]">
              <span data-anim="problem-line" className="block">
                ninety seconds
              </span>
            </span>
            <span className="block overflow-hidden pb-[0.22em] -mb-[0.22em]">
              <span data-anim="problem-line" className="block text-white/35">
                that mattered.
              </span>
            </span>
          </h2>
        </div>

        {/* Spacer */}
        <div className="col-span-12 md:col-span-2 order-3" />

        {/* Stamps timeline */}
        <div
          className="col-span-12 md:col-span-6 order-4 mt-16 md:mt-24"
          data-anim-trigger="problem-stamps"
        >
          <p className="eyebrow mb-6">A typical 1h video</p>
          <ul className="frost rounded-3xl p-6 md:p-8 divide-y divide-white/5">
            {STAMPS.map((s, i) => (
              <li
                data-anim="problem-stamp"
                key={i}
                className="relative flex items-center justify-between py-3 first:pt-0 last:pb-0"
              >
                <span className="font-mono text-[11px] text-white/50 tracking-wider">
                  {s.t}
                </span>
                <span className="relative flex-1 px-5 text-[14px] md:text-[15px] text-white/80">
                  <span>{s.l}</span>
                  {/* Cross-out */}
                  {i !== STAMPS.length - 1 && (
                    <span
                      data-anim="problem-strike"
                      className="absolute left-5 top-1/2 h-px bg-white/40 w-0"
                      aria-hidden
                    />
                  )}
                </span>
                <span
                  className={`text-[11px] font-mono tracking-wider ${
                    i === STAMPS.length - 1
                      ? "text-white"
                      : "text-white/30"
                  }`}
                >
                  {i === STAMPS.length - 1 ? "↳ keep" : "skip"}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Right column: counter & note */}
        <div className="col-span-12 md:col-span-4 order-5 mt-16 md:mt-24 flex flex-col gap-10 justify-end">
          <div>
            <div className="font-mono text-[11px] tracking-widest uppercase text-white/45 mb-3">
              Time wasted
            </div>
            <div className="display text-[clamp(72px,8vw,140px)] leading-none">
              98<span className="text-white/30">%</span>
            </div>
            <p className="text-white/55 text-[14px] mt-3 max-w-xs leading-relaxed">
              Of any given long-form video is, statistically, not what you
              came for. The signal is in there — buried.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
