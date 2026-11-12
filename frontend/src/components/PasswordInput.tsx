import clsx from "clsx";
import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { IconEye, IconEyeOff } from "./icons";

/**
 * Password field with a show/hide toggle.
 *
 * For new passwords pass autoComplete="new-password" (on the password and its confirmation) and give the form
 * an autoComplete="username" field: browsers such as Chrome and Edge then offer their own strong-password
 * suggestion and save it to the user's password manager.
 */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type">>(function PasswordInput({ className, ...rest }, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        ref={ref}
        type={visible ? "text" : "password"}
        name={rest.name ?? rest.id}
        className={clsx(
          "h-10 w-full rounded-md border border-stone-dark bg-surface pl-3 pr-11 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 aria-[invalid=true]:border-status-critical",
          className,
        )}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-ink-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        aria-controls={rest.id}
      >
        {visible ? <IconEyeOff /> : <IconEye />}
      </button>
    </div>
  );
});
