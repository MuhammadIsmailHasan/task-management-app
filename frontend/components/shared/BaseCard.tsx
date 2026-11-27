import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface BaseCardProps {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
  plain?: boolean;
}

export function BaseCard({ title, children, action, className, plain = false }: BaseCardProps) {
  const id = `card-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section aria-labelledby={id} className={cn("flex min-w-0 shrink-0 flex-col rounded-ui border border-line", plain ? "gap-field p-item" : "overflow-hidden bg-surface-raised shadow-card", className)}>
      <header className={cn("flex items-center justify-between gap-2", !plain && "px-6 pt-6")}>
        <h3 id={id} className="font-heading text-base font-semibold">
          {title}
        </h3>
        {action}
      </header>
      <div className={cn("flex min-w-0 flex-col gap-3", !plain && "p-6")}>{children}</div>
    </section>
  );
}
