"use client";

import { useEffect, useState } from "react";

const links = [
  { label: "How it works", href: "#solution" },
  { label: "Demo", href: "#demo" },
  { label: "Tech", href: "#tech" },
  { label: "Use cases", href: "#use-cases" },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* Pure-frost layer — no white tint, opacity-faded for a quick smooth in */}
      <div
        className={`nav-frost absolute inset-0 transition-opacity duration-200 ease-out ${
          scrolled ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden
      />

      <div className="relative mx-auto max-w-[1480px] px-6 md:px-10">
        <div className="flex items-center justify-between h-16 md:h-[68px]">
          <a
            href="#hero"
            className="flex items-center gap-2 text-[15px] tracking-tight font-medium"
          >
            <span className="relative grid place-items-center w-7 h-7 rounded-full border border-white/20 overflow-hidden">
              <span className="block w-2 h-2 rounded-sm bg-white rotate-45" />
            </span>
            <span>ReelAI</span>
          </a>

          <nav className="hidden md:flex items-center gap-8 text-[13px] text-white/70">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="hover:text-white transition-colors"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <a
            href="#cta"
            className="text-[13px] inline-flex items-center gap-2 px-4 md:px-5 h-10 rounded-full bg-white text-black font-medium tracking-tight hover:bg-white/90 transition-colors"
          >
            Get access
          </a>
        </div>
      </div>
    </header>
  );
}
