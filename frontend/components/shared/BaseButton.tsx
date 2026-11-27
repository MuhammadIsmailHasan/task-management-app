import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "dark" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

interface BaseButtonProps extends Omit<ComponentProps<"button">, "size"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}

const VARIANT = { primary: "default", dark: "dark", secondary: "secondary", ghost: "ghost", danger: "destructive" } as const;

export function BaseButton({ variant = "primary", size = "md", block = false, className, type = "button", ...rest }: BaseButtonProps) {
  return (
    <Button
      type={type}
      variant={VARIANT[variant]}
      size={size === "sm" ? "sm" : "default"}
      data-variant={variant}
      className={cn(block && "w-full", className)}
      {...rest}
    />
  );
}
