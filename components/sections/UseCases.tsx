"use client";

import { useGsapScroll, gsap } from "@/hooks/useGsapScroll";

const CASES = [
  {
    tag: "Academic",
    title: "AP Physics",
    body: "Skip the 47-minute lecture. Get the 6 minutes that explain why momentum is conserved.",
    meta: "412 hrs · 38 sources",
  },
  {
    tag: "Engineering",
    title: "Rust borrow checker",
    body: "Pull the moments where the lifetime model finally clicks — across every advanced talk on the web.",
    meta: "201 hrs · 24 sources",
  },
  {
    tag: "History",
    title: "The fall of Rome",
    body: "Cross-cut moments from documentaries, university lectures, and primary-source readings.",
    meta: "688 hrs · 91 sources",
  },
  {
    tag: "Health",
    title: "Strength training",
    body: "Form cues, programming logic, and recovery science — only the moments coaches actually agree on.",
    meta: "320 hrs · 47 sources",
  },
  {
    tag: "Craft",
    title: "Pottery glazing",
    body: "The actual chemistry, the actual brushwork, the moments where masters demonstrate the move.",
    meta: "94 hrs · 18 sources",
  },
  {
    tag: "Career",
    title: "System design interviews",
    body: "Each canonical question, the framing that worked, and the moments candidates actually got hired.",
    meta: "180 hrs · 33 sources",
  },
];

const MARQUEE_TAGS = [
  "Calculus",
  "Physics",
  "Biology",
  "Chemistry",
  "Statistics",
  "Linear Algebra",
  "Computer Science",
  "Machine Learning",
  "Economics",
  "Psychology",
  "Philosophy",
  "World History",
  "Spanish",
  "Music Theory",
  "Anatomy",
];

export default function UseCases() {
  const ref = useGsapScroll<HTMLElement>(() => {
    gsap.from("[data-anim='uc-card']", {
      y: 60,
      stagger: 0.08,
      duration: 1,
      ease: "expo.out",
      scrollTrigger: {
        trigger: "[data-anim-trigger='uc-grid']",
        start: "top 78%",
      },
    });

    gsap.from("[data-anim='uc-headline']", {
      yPercent: 100,
      opacity: 0,
      duration: 1.2,
      ease: "expo.out",
      scrollTrigger: {
        trigger: "[data-anim-trigger='uc-headline']",
        start: "top 80%",
      },
    });

    // Scroll-driven horizontal slide: track translates by a fraction of its
    // (doubled) width as the user scrolls through the section. -15% gives a
    // gentle drift — fast enough to read as motion, slow enough that words
    // don't whip past while scrolling normally.
    const track = ref.current?.querySelector<HTMLElement>("[data-marquee-track]");
    if (track) {
      gsap.to(track, {
        xPercent: -15,
        ease: "none",
        scrollTrigger: {
          trigger: ref.current,
          start: "top bottom",
          end: "bottom top",
          scrub: 1,
        },
      });
    }
  }, []);

  return (
    <section
      ref={ref}
      id="use-cases"
      className="relative w-full px-6 md:px-12 pt-8 pb-24 md:pt-12 md:pb-32"
    >
      <div className="mx-auto max-w-[1480px]">
        {/* Top */}
        <div className="grid grid-cols-12 gap-6 mb-12">
          {/* Left meta column — small mono caption */}
          <div className="col-span-12 md:col-span-3 order-1">
            <div className="sticky top-32 flex flex-col gap-4 text-[11px] tracking-[0.2em] uppercase text-white/45 font-mono">
              <span className="block w-12 h-px bg-white/20" />
              <span>Topic-agnostic.</span>
            </div>
          </div>
          <div
            className="col-span-12 md:col-span-9 order-2"
            data-anim-trigger="uc-headline"
          >
            <div className="overflow-hidden pb-[0.22em] -mb-[0.22em] text-[clamp(44px,7vw,116px)]">
              <h2
                data-anim="uc-headline"
                className="display-tight text-[clamp(44px,7vw,116px)] text-balance"
              >
                Anything teachable,{" "}
                <span className="italic text-white/40">anywhere.</span>
              </h2>
            </div>
            <p className="mt-6 max-w-lg text-[15px] text-white/60 leading-relaxed">
              ReelAI is topic-agnostic. If the world has a video on it, you
              get a feed of the moments worth keeping.
            </p>
          </div>
        </div>

        {/* Scroll-driven marquee strip — slides horizontally as the page
            scrolls. overflow-x clipped, overflow-y visible so the italic
            Fraunces glyphs aren't clipped at top/bottom. */}
        <div className="relative mb-16 overflow-x-hidden overflow-y-visible py-4">
          <div
            data-marquee-track
            className="flex w-max will-change-transform"
          >
            <div className="flex shrink-0">
              {MARQUEE_TAGS.map((t, i) => (
                <span
                  key={i}
                  className="display text-[clamp(48px,7vw,108px)] text-white/20 italic px-6 md:px-10 whitespace-nowrap leading-[1.15]"
                >
                  {t}
                  <span className="inline-block mx-6 align-middle text-white/15">
                    ✦
                  </span>
                </span>
              ))}
            </div>
            <div className="flex shrink-0" aria-hidden>
              {MARQUEE_TAGS.map((t, i) => (
                <span
                  key={`d-${i}`}
                  className="display text-[clamp(48px,7vw,108px)] text-white/20 italic px-6 md:px-10 whitespace-nowrap leading-[1.15]"
                >
                  {t}
                  <span className="inline-block mx-6 align-middle text-white/15">
                    ✦
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Grid — asymmetric */}
        <div
          data-anim-trigger="uc-grid"
          className="grid grid-cols-12 gap-6"
        >
          {CASES.map((c, i) => {
            // Asymmetric heights/spans
            const span = i % 5 === 0 ? "md:col-span-7" : "md:col-span-5";
            const offset = i % 4 === 1 ? "md:mt-10" : "";
            return (
              <article
                key={c.title}
                data-anim="uc-card"
                className={`col-span-12 ${span} ${offset}`}
              >
                <div className="frost rounded-3xl p-8 md:p-10 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-10">
                    <span className="font-mono text-[11px] tracking-widest uppercase text-white/55">
                      {c.tag}
                    </span>
                    <span className="font-mono text-[11px] text-white/40">
                      {String(i + 1).padStart(2, "0")} / 0{CASES.length}
                    </span>
                  </div>
                  <h3 className="display text-[clamp(32px,3.6vw,56px)] mb-4">
                    {c.title}
                  </h3>
                  <p className="text-[14px] md:text-[15px] text-white/60 leading-relaxed text-pretty max-w-md">
                    {c.body}
                  </p>
                  <div className="mt-auto pt-10 flex items-center justify-between">
                    <span className="font-mono text-[11px] text-white/45">
                      {c.meta}
                    </span>
                    <a
                      href="#cta"
                      className="text-[12px] inline-flex items-center gap-2 text-white/80 hover:text-white"
                    >
                      Open feed
                      <span aria-hidden>→</span>
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
