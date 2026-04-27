"use client";

import { Fragment } from "react";
import { useGsapScroll, gsap } from "@/hooks/useGsapScroll";
import Arrow from "@/components/ui/Arrow";

export default function CTA() {
  const ref = useGsapScroll<HTMLElement>(() => {
    gsap.from("[data-anim='cta-line']", {
      yPercent: 110,
      opacity: 0,
      stagger: 0.08,
      duration: 1.4,
      ease: "expo.out",
      scrollTrigger: {
        trigger: ref.current,
        start: "top 70%",
      },
    });
    gsap.from("[data-anim='cta-fade']", {
      yPercent: 18,
      stagger: 0.07,
      duration: 1,
      ease: "expo.out",
      scrollTrigger: {
        trigger: ref.current,
        start: "top 60%",
      },
    });
  }, []);

  return (
    <section
      ref={ref}
      id="cta"
      className="relative min-h-[110svh] w-full px-6 md:px-12 pt-8 pb-24 md:pt-12 md:pb-32 flex flex-col justify-center"
    >
      <div className="mx-auto max-w-[1480px] w-full">
        {/* Final headline */}
        <h2 className="display-tight text-[clamp(64px,12vw,200px)] text-balance">
          <span className="block overflow-hidden pb-[0.22em] -mb-[0.22em]">
            <span data-anim="cta-line" className="block">
              Start the
            </span>
          </span>
          <span className="block overflow-hidden pb-[0.22em] -mb-[0.22em]">
            <span data-anim="cta-line" className="block italic">
              endless feed
            </span>
          </span>
          <span className="block overflow-hidden pb-[0.22em] -mb-[0.22em]">
            <span
              data-anim="cta-line"
              className="block text-white/40"
            >
              of what you want to know.
            </span>
          </span>
        </h2>

        {/* Stats row — full width, large, no chrome */}
        <div data-anim="cta-fade" className="mt-16">
          <CtaReadout />
        </div>

        {/* Email row */}
        <div data-anim="cta-fade" className="mt-20">
          <form
            onSubmit={(e) => e.preventDefault()}
            className="frost rounded-full pl-7 pr-3 h-[72px] flex items-center gap-3 w-full max-w-2xl mx-auto"
          >
            <span className="font-mono text-[11px] tracking-widest uppercase text-white/45 hidden md:block">
              Request access
            </span>
            <input
              type="email"
              placeholder="you@workmail.com"
              className="flex-1 bg-transparent outline-none text-[16px] tracking-tight placeholder:text-white/35"
            />
            <button
              type="submit"
              className="group inline-flex items-center gap-3 h-[52px] pl-6 pr-3 rounded-full bg-white text-black font-medium tracking-tight"
            >
              <span>Join</span>
              <span className="grid place-items-center w-9 h-9 rounded-full bg-black text-white transition-transform group-hover:translate-x-1">
                <Arrow size={14} />
              </span>
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

type Stat = {
  id: string;
  label: string;
  value: string;
  unit: string;
};

const STATS: Stat[] = [
  { id: "i",   label: "On the list",  value: "7,200", unit: "humans" },
  { id: "ii",  label: "Partners",     value: "12",    unit: "labs" },
  { id: "iii", label: "Rolling out",  value: "~ Apr", unit: "2026" },
];

function CtaReadout() {
  return (
    <div className="grid grid-cols-3 w-full items-stretch">
      {STATS.map((s, i) => (
        <div
          key={s.id}
          className={`text-center px-4 md:px-8 flex flex-col justify-end ${
            i > 0 ? "border-l border-white/15" : ""
          }`}
        >
          <div className="font-mono text-[10px] md:text-[11px] tracking-[0.28em] uppercase text-white/50 mb-3">
            {s.label}
          </div>
          <div className="display text-[clamp(44px,7vw,108px)] text-white leading-[0.9]">
            {s.value}
          </div>
        </div>
      ))}
    </div>
  );
}
