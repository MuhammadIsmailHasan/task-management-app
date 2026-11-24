import type { ComponentProps } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ButtonSize, ButtonVariant } from "./BaseButton";

const VARIANT = { primary: "default", dark: "dark", secondary: "secondary", ghost: "ghost", danger: "destructive" } as const;

interface BaseLinkButtonProps extends ComponentProps<"a"> {
  variant?: ButtonVariant;
  size?: ButtonSize | "lg";
}

/** A link that looks like a BaseButton: for a call to action that leaves the page (the landing page). */
export function BaseLinkButton({ variant = "primary", size = "md", className, ...rest }: BaseLinkButtonProps) {
  return <a data-variant={variant} className={cn(buttonVariants({ variant: VARIANT[variant], size: size === "sm" ? "sm" : "default" }), "no-underline", size === "lg" && "min-h-control px-6", className)} {...rest} />;
}
