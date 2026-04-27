export default function SectionDivider({
  label,
}: {
  label?: string;
}) {
  return (
    <div className="relative w-full px-6 md:px-12 pt-24 md:pt-32 pb-1">
      <div className="mx-auto max-w-[1480px] flex items-center gap-6">
        <div className="hairline flex-1" />
        {label && (
          <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-white/35">
            {label}
          </span>
        )}
        <div className="hairline flex-1" />
      </div>
    </div>
  );
}
