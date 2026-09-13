export default function AppLoading() {
  return (
    <main className="min-h-screen bg-[var(--falcon-warm-background)] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6" aria-live="polite" aria-busy="true">
        <div className="space-y-3">
          <div className="h-3 w-24 animate-pulse rounded-full bg-[rgba(184,146,74,0.28)]" />
          <div className="h-8 w-52 animate-pulse rounded-xl bg-zinc-200" />
          <div className="h-4 w-72 max-w-full animate-pulse rounded-lg bg-zinc-100" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-32 animate-pulse rounded-[22px] border border-[var(--falcon-soft-border)] bg-white shadow-sm"
            />
          ))}
        </div>
        <span className="sr-only">Loading Falcon Hub</span>
      </div>
    </main>
  );
}
