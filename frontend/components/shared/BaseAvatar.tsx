"use client";

import { useState } from "react";
import { BaseTooltip } from "@/components/shared/BaseTooltip";
import { apiAsset } from "@/lib/http";
import { cn } from "@/lib/utils";
import { initialsOf } from "@/lib/initials";

interface BaseAvatarProps {
  name: string;
  size?: "sm" | "md" | "xl";
  className?: string;
  label?: string;
  src?: string | null;
  inactive?: boolean;
  unavailable?: boolean;
}

export function BaseAvatar({ name, size = "sm", className, label, src, inactive = false, unavailable = false }: BaseAvatarProps) {
  const state = inactive ? "Inactive" : unavailable ? "Unavailable" : null;
  const named = state ? `${name} (${state})` : name;
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = !!src && failed !== src;
  return (
    <BaseTooltip label={named}>
      <span
        role="img"
        aria-label={named}
        data-state={state?.toLowerCase()}
        className={cn(
          "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand text-xs font-bold text-on-brand focus-ring",
          size === "sm" ? "size-avatar-sm text-xs" : size === "xl" ? "size-avatar-xl text-xl" : "size-avatar-md text-xs",
          inactive && "opacity-disabled",
          !inactive && unavailable && "border border-dashed border-ink-muted",
          className,
        )}
      >
        {showImage ? (
          <img src={src.startsWith("blob:") ? src : apiAsset(src)} alt="" className="size-full object-cover" onError={() => setFailed(src)} />
        ) : (
          (label ?? initialsOf(name))
        )}
      </span>
    </BaseTooltip>
  );
}
