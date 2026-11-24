"use client";

import { useState } from "react";
import { BaseTooltip } from "@/components/shared/BaseTooltip";
import { apiAsset } from "@/lib/http";
import { cn } from "@/lib/utils";
import { initialsOf } from "@/lib/initials";

interface BaseAvatarProps {
  name: string;
  size?: "sm" | "md";
  className?: string;
  /** The "+7" overflow chip. */
  label?: string;
  /** Avatar_URL; absent or a failed load shows the initials. */
  src?: string | null;
}

/** Brand-coloured initials circle (24px in cards, 32px in the sidebar and header), or the image; hovering or focusing it shows the full name. */
export function BaseAvatar({ name, size = "sm", className, label, src }: BaseAvatarProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = !!src && failed !== src;
  return (
    <BaseTooltip label={name}>
      <span
        role="img"
        aria-label={name}
        className={cn(
          "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand text-2xs font-bold text-on-brand focus-ring",
          size === "sm" ? "size-avatar-sm text-2xs" : "size-avatar-md text-2xs",
          className,
        )}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- a signed, short-lived URL: next/image would cache it
          <img src={src.startsWith("blob:") ? src : apiAsset(src)} alt="" className="size-full object-cover" onError={() => setFailed(src)} />
        ) : (
          (label ?? initialsOf(name))
        )}
      </span>
    </BaseTooltip>
  );
}
