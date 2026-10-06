import type {
  NumerologyCell,
  NumerologyLine,
  NumerologyNumber,
  SymbolSource,
} from "@/lib/career-numerology";

const symbolMeta: Record<SymbolSource, { symbol: string; label: string; className: string }> = {
  birth: { symbol: "○", label: "生辰数", className: "border-zinc-400 bg-zinc-100 text-zinc-900" },
  talent: { symbol: "△", label: "天赋数", className: "border-[#c6a45f] bg-[#f7efd9] text-[#765a25]" },
  life: { symbol: "□", label: "生涯运数", className: "border-[#4d8b80] bg-[#e5f3f0] text-[#22594f]" },
  zodiac: { symbol: "☆", label: "星座数", className: "border-[#85889b] bg-[#eeeff4] text-[#45485d]" },
};

function lineCoordinates(layout: readonly NumerologyNumber[], line: NumerologyLine) {
  const points = line.numbers.map((number) => {
    const index = layout.indexOf(number);
    return { x: (index % 3) * 100 + 50, y: Math.floor(index / 3) * 100 + 50 };
  });
  return { from: points[0], to: points.at(-1) };
}

export function NumerologyGrid({
  layout,
  cells,
  lines,
  label,
}: {
  layout: readonly NumerologyNumber[];
  cells: NumerologyCell[];
  lines: NumerologyLine[];
  label: string;
}) {
  const byNumber = new Map(cells.map((cell) => [cell.number, cell]));

  return (
    <div>
      <div className="relative mx-auto aspect-square w-full max-w-xl overflow-hidden rounded-[24px] border border-[var(--falcon-soft-border)] bg-[#fdfcf9] shadow-sm">
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 h-full w-full"
          preserveAspectRatio="none"
          viewBox="0 0 300 300"
        >
          {lines.map((line) => {
            const coordinates = lineCoordinates(layout, line);
            if (!coordinates.from || !coordinates.to) return null;
            return (
              <line
                key={line.id}
                x1={coordinates.from.x}
                y1={coordinates.from.y}
                x2={coordinates.to.x}
                y2={coordinates.to.y}
                stroke="#b8924a"
                strokeLinecap="round"
                strokeOpacity="0.3"
                strokeWidth="5"
              />
            );
          })}
        </svg>
        <div className="relative z-20 grid h-full grid-cols-3" role="img" aria-label={label}>
          {layout.map((number, index) => {
            const cell = byNumber.get(number);
            return (
              <div
                key={number}
                className={`flex min-w-0 flex-col items-center justify-center gap-2 p-2 sm:p-4 ${
                  index % 3 !== 2 ? "border-r border-[var(--falcon-soft-border)]" : ""
                } ${index < 6 ? "border-b border-[var(--falcon-soft-border)]" : ""}`}
              >
                <span className="text-2xl font-semibold text-[var(--falcon-charcoal)] sm:text-3xl">{number}</span>
                <div className="flex min-h-6 max-w-full flex-wrap items-center justify-center gap-1">
                  {(Object.keys(symbolMeta) as SymbolSource[]).map((source) => {
                    const count = cell?.symbols[source] ?? 0;
                    if (!count) return null;
                    const meta = symbolMeta[source];
                    return (
                      <span
                        key={source}
                        title={`${meta.label} ${count} 个`}
                        className={`inline-flex min-h-6 items-center rounded-full border px-1.5 text-[11px] font-bold shadow-[0_1px_2px_rgba(23,23,23,0.06)] sm:px-2 sm:text-xs ${meta.className}`}
                      >
                        {meta.symbol}{count > 1 ? `×${count}` : ""}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-2" aria-label="符号说明">
        {(Object.keys(symbolMeta) as SymbolSource[]).map((source) => {
          const meta = symbolMeta[source];
          return <span key={source} className={`rounded-full border px-3 py-1 text-xs font-semibold shadow-[0_1px_2px_rgba(23,23,23,0.05)] ${meta.className}`}>{meta.symbol} {meta.label}</span>;
        })}
      </div>
    </div>
  );
}
