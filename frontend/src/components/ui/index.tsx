import clsx from "clsx";
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { IconSpinner } from "../icons";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant | "accent"; loading?: boolean; size?: "sm" | "md" }>(
  function Button({ variant = "primary", loading, size = "md", className, children, disabled, ...rest }, ref) {
    const v = variant === "accent" ? "primary" : variant;
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={clsx(
          "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
          size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-sm",
          {
            "bg-brand-700 text-white hover:bg-brand-800": v === "primary",
            "border border-line bg-surface text-ink hover:border-ink-muted": v === "secondary",
            "text-ink-soft hover:bg-black/[0.04] hover:text-ink": v === "ghost",
            "bg-status-critical text-white hover:bg-[#962020]": v === "danger",
          },
          className,
        )}
        {...rest}
      >
        {loading && <IconSpinner width={16} height={16} />}
        {children}
      </button>
    );
  },
);

export function Card({ className, children, title, action, subtitle, flush }: { className?: string; children: ReactNode; title?: ReactNode; action?: ReactNode; subtitle?: ReactNode; flush?: boolean }) {
  return (
    <section className={clsx("rounded-lg border border-line bg-surface", className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[13px] text-ink-muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={flush ? "" : "p-5"}>{children}</div>
    </section>
  );
}

export function Badge({ children, tone = "neutral", className, title }: { children: ReactNode; tone?: "neutral" | "brand" | "good" | "warning" | "serious" | "critical" | "saffron" | "outline"; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={clsx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-sm px-1.5 py-[3px] text-[11px] font-semibold uppercase leading-none tracking-[0.04em]",
        {
          "bg-black/[0.06] text-ink-soft": tone === "neutral",
          "bg-brand-50 text-brand-800": tone === "brand",
          "bg-[#E6F2E8] text-[#1A5E2A]": tone === "good",
          "bg-[#F6EDD5] text-[#6E4C00]": tone === "warning",
          "bg-[#F7E6DC] text-[#8A3D1C]": tone === "serious",
          "bg-[#F7E1E1] text-[#8E1F1F]": tone === "critical",
          "bg-saffron-50 text-saffron-700": tone === "saffron",
          "border border-line text-ink-soft": tone === "outline",
        },
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: string; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-[13px] text-ink-muted">{hint}</p>}
      {error && (
        <p className="text-[13px] font-medium text-status-critical" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const control =
  "w-full rounded-md border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-muted/80 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-canvas aria-[invalid=true]:border-status-critical";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={clsx(control, "h-10", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={clsx(control, "py-2.5 leading-relaxed", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={clsx(control, "h-10 pr-8", className)} {...rest}>
      {children}
    </select>
  );
});

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-ink-muted">
      <IconSpinner />
      {label}
    </div>
  );
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-md bg-black/[0.05] motion-reduce:animate-none" />
      ))}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-6 py-12 text-center">
      <p className="font-medium text-ink">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <div role="alert" className="flex flex-wrap items-start gap-3 rounded-md border border-[#E7C3C3] bg-[#FBF0F0] px-4 py-3 text-sm text-[#7A1C1C]">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">This could not be loaded</p>
        <p className="mt-0.5">{msg}</p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="font-medium underline underline-offset-2">
          Try again
        </button>
      )}
    </div>
  );
}

export function Alert({ tone = "info", title, children }: { tone?: "info" | "warning" | "critical" | "good"; title?: string; children: ReactNode }) {
  return (
    <div
      role={tone === "critical" ? "alert" : "status"}
      className={clsx("rounded-md border-l-[3px] px-4 py-3 text-sm", {
        "border-brand-600 bg-brand-50 text-brand-900": tone === "info",
        "border-status-warning bg-[#F8F0DC] text-[#5A3E00]": tone === "warning",
        "border-status-critical bg-[#FBF0F0] text-[#7A1C1C]": tone === "critical",
        "border-status-good bg-[#EAF4EC] text-[#184F24]": tone === "good",
      })}
    >
      {title && <p className="font-semibold">{title}</p>}
      <div className={clsx(title && "mt-0.5")}>{children}</div>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items, label = "View" }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode }[]; label?: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-md border border-line bg-surface p-0.5">
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={clsx(
            "whitespace-nowrap rounded px-3 py-1.5 text-[13px] font-medium",
            value === it.value ? "bg-ink text-white" : "text-ink-soft hover:text-ink",
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function StatTile({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "critical" | "warning" | "good" }) {
  return (
    <div className="border-l-2 border-line py-1 pl-4">
      <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-ink-muted">{label}</p>
      <p
        className={clsx("mt-1 font-display text-[28px] font-semibold leading-none tabular-nums", {
          "text-ink": !tone,
          "text-status-critical": tone === "critical",
          "text-status-warning": tone === "warning",
          "text-status-good": tone === "good",
        })}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-[12px] text-ink-muted">{hint}</p>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2">{eyebrow}</div>}
        <h1 className="break-words font-display text-[26px] font-semibold leading-tight text-ink sm:text-[30px]">{title}</h1>
        {subtitle && <div className="mt-2 max-w-prose text-[15px] text-ink-soft">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Modal({ open, title, onClose, children, footer }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(27,29,33,0.4)] p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-lg bg-surface shadow-overlay sm:rounded-lg" onMouseDown={(e) => e.stopPropagation()}>
        <header className="border-b border-line px-5 py-4">
          <h2 className="font-semibold text-ink">{title}</h2>
        </header>
        <div className="space-y-4 p-5">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

/** Readable key/value list used in side panels. */
export function Facts({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-line text-sm">
      {items.map((it) => (
        <div key={it.label} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-2">
          <dt className="text-ink-muted">{it.label}</dt>
          <dd className="min-w-0 text-right font-medium text-ink">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
