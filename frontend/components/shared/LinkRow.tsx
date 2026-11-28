import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const ROW = "rounded-ui bg-surface p-item";
const CLICKABLE = "text-ink no-underline transition-all duration-base ease-out hover:shadow-hover focus-ring";

export function LinkRow({ href, onClick, className, children }: { href: string | null; onClick?: () => void; className?: string; children: ReactNode }) {
  if (!href) return <div className={cn(ROW, className)}>{children}</div>;
  return (
    <Link href={href} onClick={onClick} className={cn("block", ROW, CLICKABLE, className)}>
      {children}
    </Link>
  );
}
