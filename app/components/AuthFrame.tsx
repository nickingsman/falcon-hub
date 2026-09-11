import Image from "next/image";
import type { ReactNode } from "react";

export default function AuthFrame({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[var(--falcon-warm-background)] px-4 py-6 text-zinc-900 sm:px-6 sm:py-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[var(--falcon-gold)]" />
      <div aria-hidden="true" className="pointer-events-none absolute -left-20 top-20 h-56 w-56 rounded-full border border-[#ded5c3] opacity-50 sm:h-72 sm:w-72" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 -right-20 h-72 w-72 rounded-full border border-[#ded5c3] opacity-40 sm:h-96 sm:w-96" />

      <div className="relative w-full max-w-[480px]">
        <div className="mb-4 flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500 sm:mb-5">
          <span className="h-px w-6 bg-[var(--falcon-gold)]" />
          Private workspace
          <span className="h-px w-6 bg-[var(--falcon-gold)]" />
        </div>

        <section className="overflow-hidden rounded-[28px] border border-[var(--falcon-soft-border)] bg-white shadow-[0_24px_70px_rgba(39,34,24,0.09)] sm:rounded-[32px]">
          <div className="border-b border-[var(--falcon-soft-border)] px-6 pb-6 pt-5 text-center sm:px-9 sm:pb-7 sm:pt-6">
            <Image
              src="/brand/kingsman-falcon-logo-transparent.png"
              alt="Kingsman Falcon"
              width={135}
              height={163}
              priority
              className="mx-auto -my-6 h-[132px] w-auto select-none sm:h-[142px]"
            />
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--falcon-gold-dark)]">
              Operations Center
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-[-0.025em] text-zinc-950 sm:text-[28px]">
              {title}
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-500">
              {description}
            </p>
          </div>

          <div className="px-6 py-6 sm:px-9 sm:py-8">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
              {eyebrow}
            </p>
            {children}
          </div>
        </section>

        <p className="mt-5 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-400">
          Kingsman Falcon · Internal access
        </p>
      </div>
    </main>
  );
}
