import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";

export type BadgeTone = "neutral" | "green" | "yellow" | "orange" | "red" | "purple" | "blue" | "amber" | "lime" | "emerald" | "teal" | "cyan" | "sky" | "indigo" | "violet" | "fuchsia" | "pink" | "rose" | "slate" | "accent" | "danger" | "count";

interface BaseBadgeProps extends Omit<ComponentProps<"span">, "shape"> {
  tone?: BadgeTone;
  shape?: "pill" | "tag" | "outline";
  dot?: boolean;
}

export function BaseBadge({ tone = "neutral", shape = "pill", ...rest }: BaseBadgeProps) {
  return <Badge tone={tone} shape={shape} data-tone={tone} {...rest} />;
}
