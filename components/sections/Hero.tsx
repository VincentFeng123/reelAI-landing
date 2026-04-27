"use client";

import { useGsapScroll, gsap } from "@/hooks/useGsapScroll";
import Arrow from "@/components/ui/Arrow";

export default function Hero() {
  const ref = useGsapScroll<HTMLElement>(() => {
    const tl = gsap.timeline({
      defaults: { ease: "expo.out" },
      delay: 0.15,
    });

    tl.from("[data-anim='hero-meta']", {
      opacity: 0,
      y: 8,
      stagger: 0.06,
      duration: 0.8,
    })
      .from(
        "[data-anim='hero-line']",
        {
          yPercent: 110,
          opacity: 0,
          stagger: 0.08,
          duration: 1.3,
        },
        "-=0.5",
      )
      .from(
        "[data-anim='hero-sub']",
        { opacity: 0, y: 14, duration: 0.9 },
        "-=0.9",
      )
      .from(
        "[data-anim='hero-cta']",
        { opacity: 0, y: 14, duration: 0.9 },
        "-=0.8",
      );
  }, []);

  return (
    <section
      ref={ref}
      id="hero"
      className="relative min-h-[100svh] w-full overflow-hidden"
    >
      {/* Bottom strip — headline + CTA */}
      <div className="absolute left-0 right-0 bottom-0 z-20 px-6 md:px-12 pb-12 md:pb-14">
        <div className="mx-auto max-w-[1480px] grid grid-cols-12 gap-6 items-end">
          <div className="col-span-12 md:col-span-7">
            <span
              data-anim="hero-meta"
              className="eyebrow inline-flex items-center gap-3 mb-5"
            >
              <span className="block w-8 h-px bg-white/40" />
              new · 2026 · closed beta
            </span>
            <h1 className="display-tight text-[clamp(56px,8vw,132px)]">
              <span className="block overflow-hidden pb-[0.22em] -mb-[0.22em]">
                <span data-anim="hero-line" className="block">
                  Learn anything,
                </span>
              </span>
              <span className="block overflow-hidden pb-[0.22em] -mb-[0.22em]">
                <span
                  data-anim="hero-line"
                  className="block italic font-light text-white/80"
                >
                  one reel at a time.
                </span>
              </span>
            </h1>
            <p
              data-anim="hero-sub"
              className="mt-6 max-w-lg text-[15px] md:text-[16px] leading-relaxed text-white/60 text-pretty"
            >
              ReelAI watches every long-form video on a topic and stitches
              the moments worth your time into an endless feed.
            </p>
          </div>

          <div
            data-anim="hero-cta"
            className="col-span-12 md:col-span-5 flex md:justify-end items-end gap-3"
          >
            <a
              href="#cta"
              className="group inline-flex items-center gap-3 h-13 pl-6 pr-2 rounded-full bg-white text-black font-medium tracking-tight"
              style={{ height: 52 }}
            >
              <span>Generate a feed</span>
              <span className="grid place-items-center w-9 h-9 rounded-full bg-black text-white transition-transform group-hover:translate-x-1">
                <Arrow size={14} />
              </span>
            </a>
            <a
              href="#solution"
              className="hidden md:inline-flex items-center gap-2 h-13 px-5 rounded-full border border-white/12 text-white/75 hover:text-white hover:border-white/35 transition-colors text-[13px]"
              style={{ height: 52 }}
            >
              How it works
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
