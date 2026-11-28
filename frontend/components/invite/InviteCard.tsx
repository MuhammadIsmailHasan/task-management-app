import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function InviteCard({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="flex justify-center px-page py-12">
      <section className="flex w-full max-w-auth flex-col items-center gap-4 rounded-ui border border-line bg-surface-raised p-surface text-center shadow-card">
        <span aria-hidden="true" className="inline-flex size-tile items-center justify-center rounded-ui bg-accent-tint text-on-accent-tint">
          <Icon className="size-icon-lg" />
        </span>
        {children}
      </section>
    </div>
  );
}
