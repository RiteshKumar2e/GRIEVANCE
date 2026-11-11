import clsx from "clsx";
import { AlertTriangle, Inbox, Loader2, RefreshCw } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; size?: "sm" | "md" }>(
  function Button({ variant = "primary", loading, size = "md", className, children, disabled, ...rest }, ref) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-55",
          size === "sm" ? "h-8 px-3 text-sm" : "h-10 px-4 text-sm",
          {
            "bg-brand-800 text-white hover:bg-brand-900": variant === "primary",
            "border border-line bg-white text-ink hover:bg-canvas": variant === "secondary",
            "text-ink-soft hover:bg-canvas hover:text-ink": variant === "ghost",
            "bg-status-critical text-white hover:bg-red-700": variant === "danger",
            "bg-saffron-600 text-white hover:bg-saffron-700": variant === "accent",
          },
          className,
        )}
        {...rest}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {children}
      </button>
    );
  },
);

export function Card({ className, children, title, action, subtitle }: { className?: string; children: ReactNode; title?: ReactNode; action?: ReactNode; subtitle?: ReactNode }) {
  return (
    <section className={clsx("rounded-lg border border-line bg-white shadow-card", className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-3.5">
          <div>
            {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Badge({ children, tone = "neutral", className, title }: { children: ReactNode; tone?: "neutral" | "brand" | "good" | "warning" | "serious" | "critical" | "saffron" | "outline"; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={clsx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        {
          "bg-slate-100 text-slate-700": tone === "neutral",
          "bg-brand-50 text-brand-700": tone === "brand",
          "bg-green-50 text-green-800": tone === "good",
          "bg-amber-50 text-amber-800": tone === "warning",
          "bg-orange-50 text-orange-800": tone === "serious",
          "bg-red-50 text-red-800": tone === "critical",
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
      {hint && !error && <p className="text-xs text-ink-muted">{hint}</p>}
      {error && <p className="text-xs font-medium text-status-critical">{error}</p>}
    </div>
  );
}

const control = "w-full rounded-md border border-line bg-white px-3 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-canvas";

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
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      {label}…
    </div>
  );
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-md bg-slate-100" />
      ))}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line px-6 py-12 text-center">
      <Inbox className="mb-3 h-8 w-8 text-ink-muted" aria-hidden />
      <p className="font-medium text-ink">{title}</p>
      {body && <p className="mt-1 max-w-md text-sm text-ink-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="flex-1">
        <p className="font-medium">Could not load this</p>
        <p className="mt-0.5 text-red-800">{msg}</p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="inline-flex items-center gap-1 font-medium text-red-900 underline-offset-2 hover:underline">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
        </button>
      )}
    </div>
  );
}

export function Alert({ tone = "info", title, children }: { tone?: "info" | "warning" | "critical" | "good"; title?: string; children: ReactNode }) {
  return (
    <div
      role={tone === "critical" ? "alert" : "status"}
      className={clsx("rounded-lg border px-4 py-3 text-sm", {
        "border-brand-100 bg-brand-50 text-brand-900": tone === "info",
        "border-amber-200 bg-amber-50 text-amber-900": tone === "warning",
        "border-red-200 bg-red-50 text-red-900": tone === "critical",
        "border-green-200 bg-green-50 text-green-900": tone === "good",
      })}
    >
      {title && <p className="font-semibold">{title}</p>}
      <div className={clsx(title && "mt-0.5")}>{children}</div>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode }[] }) {
  return (
    <div role="tablist" className="inline-flex rounded-md border border-line bg-white p-0.5">
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={clsx(
            "rounded px-3 py-1.5 text-sm font-medium transition-colors",
            value === it.value ? "bg-brand-800 text-white" : "text-ink-soft hover:bg-canvas hover:text-ink",
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
    <div className="rounded-lg border border-line bg-white px-4 py-3.5 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p
        className={clsx("mt-1 text-2xl font-semibold tabular-nums", {
          "text-ink": !tone,
          "text-red-700": tone === "critical",
          "text-amber-700": tone === "warning",
          "text-green-700": tone === "good",
        })}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <div className="mb-1">{eyebrow}</div>}
        <h1 className="font-display text-2xl font-semibold text-ink sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Modal({ open, title, onClose, children, footer }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={title} onMouseDown={onClose}>
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        <header className="border-b border-line px-5 py-3.5">
          <h2 className="font-semibold text-ink">{title}</h2>
        </header>
        <div className="space-y-4 p-5">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}
