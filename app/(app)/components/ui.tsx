import type { ButtonHTMLAttributes, ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
  decorative?: ReactNode;
};

type SectionHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost";
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

type StatusBadgeVariant = "neutral" | "success" | "warning" | "danger" | "accent";
type StatusBadgeProps = {
  children: ReactNode;
  variant?: StatusBadgeVariant;
  className?: string;
};

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: "default" | "dashed";
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-[var(--falcon-charcoal)] text-white hover:bg-zinc-800 focus:ring-[var(--falcon-gold-dark)]",
  secondary:
    "border border-[var(--falcon-soft-border)] bg-white text-zinc-900 hover:bg-zinc-50 focus:ring-[var(--falcon-gold-dark)]",
  destructive: "bg-red-700 text-white hover:bg-red-800 focus:ring-red-700",
  ghost:
    "bg-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 focus:ring-[var(--falcon-gold-dark)]",
};

export function buttonClassName({
  variant = "primary",
  className,
}: {
  variant?: ButtonVariant;
  className?: string;
} = {}) {
  return cx(
    "inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
    buttonVariants[variant],
    className,
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  className,
  decorative,
}: PageHeaderProps) {
  return (
    <section
      className={cx(
        "relative overflow-hidden rounded-[30px] border border-[var(--falcon-soft-border)] bg-[var(--falcon-surface)] p-5 shadow-[0_14px_40px_rgba(23,23,23,0.05)] sm:p-7",
        className,
      )}
    >
      {decorative}
      <div className="relative z-20 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--falcon-gold-dark)]">
              {eyebrow}
            </p>
          ) : null}
          <h1
            className={cx(
              "text-4xl font-semibold tracking-tight text-[var(--falcon-charcoal)] sm:text-5xl",
              eyebrow && "mt-2",
            )}
          >
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--falcon-muted-text)]">
              {description}
            </p>
          ) : null}
          {meta ? <div className="mt-3">{meta}</div> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </section>
  );
}

export function SectionHeader({ title, description, action }: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-[var(--falcon-muted-text)]">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return <button className={buttonClassName({ variant, className })} {...props} />;
}

export function StatusBadge({
  children,
  variant = "neutral",
  className,
}: StatusBadgeProps) {
  const variants: Record<StatusBadgeVariant, string> = {
    neutral:
      "border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)] text-zinc-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    danger: "border-red-200 bg-red-50 text-red-700",
    accent: "border-[#d8c48e] bg-[#fbf8ef] text-[var(--falcon-gold-dark)]",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
  variant = "default",
}: EmptyStateProps) {
  return (
    <section
      className={cx(
        "rounded-[24px] bg-white px-5 py-8 text-center",
        variant === "dashed"
          ? "border border-dashed border-[var(--falcon-soft-border)]"
          : "border border-[var(--falcon-soft-border)]",
      )}
    >
      <p className="text-base font-semibold text-zinc-950">{title}</p>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}
