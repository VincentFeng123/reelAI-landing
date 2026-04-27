export default function Footer() {
  const cols = [
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

  return (
    <footer className="footer-frost relative w-full px-6 md:px-12 pt-24 pb-12">
      <div className="mx-auto max-w-[1480px]">
        <div className="grid grid-cols-12 gap-10">
          <div className="col-span-12 md:col-span-5">
            <div className="flex items-center gap-2 mb-8">
              <span className="relative grid place-items-center w-8 h-8 rounded-full border border-white/20">
                <span className="block w-2 h-2 rounded-sm bg-white rotate-45" />
              </span>
              <span className="text-[16px] tracking-tight">ReelAI</span>
            </div>
            <p className="display text-[clamp(32px,3vw,52px)] leading-tight text-white/85 max-w-md text-balance">
              The web&apos;s knowledge,
              <span className="italic text-white/45"> reorganized.</span>
            </p>
            <p className="mt-8 text-[13px] text-white/45 max-w-sm leading-relaxed">
              ReelAI is an independent research lab building media tools for
              learners. Not affiliated with any platform.
            </p>
          </div>

          {cols.map((c) => (
            <div
              key={c.title}
              className="col-span-6 md:col-span-2 md:col-start-auto"
            >
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

          <div className="col-span-12 md:col-span-1 md:col-start-12 md:row-start-1 md:justify-self-end">
            <a
              href="#hero"
              className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-white/10 hover:border-white/40 transition-colors"
              aria-label="Back to top"
            >
              ↑
            </a>
          </div>
        </div>

        <div className="hairline mt-20 mb-6" />
        <div className="flex flex-col md:flex-row justify-between gap-4 text-[11px] tracking-widest uppercase font-mono text-white/40">
          <div>© 2026 ReelAI · All clips reserved</div>
          <div className="flex items-center gap-6">
            <span>v.0.1.0</span>
            <span>SF / NYC</span>
            <a
              href="mailto:hi@reelai.example"
              className="hover:text-white transition-colors"
            >
              hi@reelai.example
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
