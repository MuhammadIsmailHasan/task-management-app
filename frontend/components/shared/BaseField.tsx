import type { ComponentProps, ReactNode } from "react";
import { Input, Textarea } from "@/components/ui/input";

/** Label + control + field errors. The error ids pair with aria-describedby on the control. */
export function BaseField({ label, htmlFor, errors, children }: { label: string; htmlFor: string; errors?: string[]; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-meta font-semibold">
        {label}
      </label>
      {children}
      {errors?.map((m) => (
        <span key={m} id={`${htmlFor}-error`} className="text-xs text-danger">
          {m}
        </span>
      ))}
    </div>
  );
}

export function BaseInput(props: ComponentProps<"input">) {
  return <Input {...props} />;
}

export function BaseTextarea(props: ComponentProps<"textarea">) {
  return <Textarea {...props} />;
}

/** Inline error / notice banner. */
export function BaseAlert({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "info" }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={tone === "error" ? "rounded-field bg-danger-soft p-3 text-sm text-on-danger-soft" : "rounded-field bg-surface p-3 text-sm text-ink-muted"}
    >
      {children}
    </div>
  );
}
