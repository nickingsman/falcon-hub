import type {
  KnowledgeEntry,
  NumberKnowledge,
  Type45Knowledge,
} from "@/lib/career-numerology";

export function InterpretationSection({
  title,
  entry,
}: {
  title: string;
  entry?: KnowledgeEntry;
}) {
  if (!entry?.content) return null;

  return (
    <div className="rounded-2xl border border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)] p-4">
      <p className="text-sm font-semibold text-[var(--falcon-charcoal)]">{title}</p>
      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[var(--falcon-muted-text)]">
        {entry.content}
      </p>
    </div>
  );
}

export function NumberInterpretation({
  label,
  entry,
}: {
  label: string;
  entry: NumberKnowledge;
}) {
  return (
    <div className="rounded-2xl border border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)] p-4">
      <p className="text-xs font-semibold text-zinc-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-[var(--falcon-charcoal)]">
        {entry.number}｜{entry.core.title}
      </p>
    </div>
  );
}

export function Type45Interpretation({ entry, compact = false }: { entry: Type45Knowledge; compact?: boolean }) {
  const hasBody = Boolean(entry.summary || entry.strengths?.length || entry.challenges?.length);
  const hasLayers = Boolean(entry.intermediateNumber || entry.specialTypes.length);
  if (!hasBody && !hasLayers) return null;

  return (
    <div className="rounded-2xl border border-[#d8c48e] bg-[#fbf8ef] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-[var(--falcon-charcoal)]">{entry.key} 组合解析</p>
        <div className="flex flex-wrap gap-2">
          {entry.intermediateNumber ? <span className="rounded-full border border-[#d8c48e] bg-white px-3 py-1 text-xs font-semibold text-[var(--falcon-gold-dark)]">{entry.intermediateNumber}｜中间数特性</span> : null}
          {entry.specialTypes.map((type) => <span key={type} className="rounded-full bg-[var(--falcon-charcoal)] px-3 py-1 text-xs font-semibold text-white">{type}</span>)}
        </div>
      </div>
      {entry.summary ? <p className="mt-3 text-sm leading-6 text-zinc-700">{entry.summary}</p> : null}
      {!compact && (entry.strengths?.length || entry.challenges?.length) ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {entry.strengths?.length ? <KnowledgeList title="优势" items={entry.strengths} /> : null}
          {entry.challenges?.length ? <KnowledgeList title="需要留意" items={entry.challenges} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function KnowledgeList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--falcon-gold-dark)]">{title}</p>
      <ul className="mt-2 space-y-1.5 text-sm leading-6 text-zinc-700">
        {items.map((item) => <li key={item} className="flex gap-2"><span aria-hidden="true" className="text-[var(--falcon-gold-dark)]">•</span><span>{item}</span></li>)}
      </ul>
    </div>
  );
}
