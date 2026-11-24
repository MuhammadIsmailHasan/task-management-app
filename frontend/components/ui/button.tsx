import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** shadcn/ui Button, themed from the design tokens. Import only from components/shared/. */
export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-transparent text-sm font-medium whitespace-nowrap cursor-pointer select-none transition-all duration-fast ease-out focus-ring disabled:pointer-events-none disabled:opacity-disabled active:translate-y-px [&_svg]:size-icon [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-accent text-on-accent shadow-card hover:bg-accent-strong",
        dark: "bg-brand text-on-brand shadow-card hover:bg-brand-strong",
        secondary: "bg-surface text-ink shadow-card hover:bg-surface-sunken",
        ghost: "bg-transparent text-ink-muted hover:bg-surface-sunken hover:text-ink",
        destructive: "bg-danger-soft text-on-danger-soft hover:bg-danger hover:text-on-danger",
      },
      size: {
        default: "min-h-button px-4 py-2",
        sm: "min-h-pill px-3 py-1 touch-target",
        icon: "size-control touch-target",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
