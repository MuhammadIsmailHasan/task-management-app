import type { ComponentProps, ReactNode } from "react";
import { Input, Textarea } from "@/components/ui/input";

/** Label + control + field errors. The error ids pair with aria-describedby on the control. */
export function BaseField({ label, htmlFor, errors, children }: { label: string; htmlFor: string; errors?: string[]; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-label">
      <label htmlFor={htmlFor} className="text-sm font-semibold">
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
      className={tone === "error" ? "rounded-ui bg-danger-soft p-item text-sm text-on-danger-soft" : "rounded-ui bg-surface p-item text-sm text-ink-muted"}
    >
      {children}
    </div>
  );
}
