const COLS = [
  {
    title: "Product",
    items: ["How it works", "Demo", "Tech", "Use cases", "Pricing"],
  },
  {
    title: "Company",
    items: ["About", "Manifesto", "Press", "Careers", "Brand"],
  },
  {
    title: "Resources",
    items: ["Docs", "Changelog", "Status", "Privacy", "Terms"],
  },
];

export default function Footer() {
  return (
    <div className="footer-stage relative">
      <footer className="footer-frost footer-pad-bottom relative w-full px-6 md:px-12 pt-24 overflow-hidden">
        <div className="relative mx-auto max-w-[1480px]">
          {/* Top band: brand heading + paragraph (small ReelAI logo
              and name removed per spec) · link columns · back-to-top
              arrow. The huge bottom wordmark already carries the
              brand identity, so the small redundant logo is gone. */}
          <div className="grid grid-cols-12 gap-10">
            <div className="col-span-12 md:col-span-5">
              <p className="display text-[clamp(28px,2.6vw,46px)] leading-tight text-white/85 max-w-md text-balance">
                The web&apos;s knowledge,
                <span className="italic text-white/45"> reorganized.</span>
              </p>
              <p className="mt-6 text-[13px] text-white/45 max-w-sm leading-relaxed">
                ReelAI is an independent research lab building media tools
                for learners. Not affiliated with any platform.
              </p>
            </div>

            {COLS.map((c) => (
              <div key={c.title} className="col-span-6 md:col-span-2">
                <div className="eyebrow mb-5">{c.title}</div>
                <ul className="space-y-3">
                  {c.items.map((it) => (
                    <li key={it}>
                      <a
                        href="#"
                        className="text-[14px] text-white/70 hover:text-white transition-colors"
                      >
                        {it}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Right-side meta stack: rights reserved sits ABOVE the
              email + version row. The whole stack right-aligns on
              desktop and flows above the huge bottom wordmark. */}
          <div className="mt-24 md:mt-32 flex justify-end">
            <div className="space-y-3 text-[10px] tracking-[0.22em] uppercase font-mono leading-relaxed md:text-right">
              <div className="text-white/55">
                © 2026 ReelAI · all clips reserved
              </div>
              <a
                href="mailto:hi@reelai.example"
                className="block text-white/55 hover:text-white transition-colors"
              >
                hi@reelai.example
              </a>
              <div className="text-white/40">v.0.1.0 · SF / NYC</div>
            </div>
          </div>
        </div>

        {/* HUGE bottom wordmark — italic display, anchored to the
            bottom-LEFT corner so the descender of the I sits flush
            with the bottom edge and the R touches the left edge. */}
        <div className="footer-wordmark" aria-hidden>
          <span>ReelAI</span>
        </div>
      </footer>
    </div>
  );
}
