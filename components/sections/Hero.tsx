"use client";

import { useEffect, useRef } from "react";
import { useGsapScroll, gsap } from "@/hooks/useGsapScroll";
import Arrow from "@/components/ui/Arrow";

export default function Hero() {
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  const ref = useGsapScroll<HTMLElement>(() => {
    // Build the timeline paused so we can fire it in sync with the
    // LoadingScreen fade — otherwise the animation runs behind the loader
    // curtain and the user never sees it.
    const tl = gsap.timeline({
      defaults: { ease: "expo.out" },
      paused: true,
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

    tlRef.current = tl;
  }, []);

  useEffect(() => {
    const play = () => tlRef.current?.play();

    // If the loader is already gone (e.g. fast refresh), fire immediately.
    const loaderPresent =
      typeof document !== "undefined" &&
      document.querySelector(".loader-overlay");
    if (!loaderPresent) {
      play();
      return;
    }

    // The `reelai:loader-fade` event fires at the moment the loader STARTS
    // fading out (loaderActive flips false). The content layer
    // (.reelai-content) has a 850 ms reveal delay so it waits for the
    // loader's own 850 ms exit transition to finish — Hero's stagger must
    // wait the same amount or it plays behind the loader curtain.
    let delayed = 0;
    const onFade = () => {
      delayed = window.setTimeout(play, 850);
    };
    window.addEventListener("reelai:loader-fade", onFade, { once: true });
    // Fallback in case the loader event is missed (HMR, race conditions).
    const fallback = setTimeout(play, 4500);

    return () => {
      window.removeEventListener("reelai:loader-fade", onFade);
      clearTimeout(fallback);
      if (delayed) clearTimeout(delayed);
    };
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
