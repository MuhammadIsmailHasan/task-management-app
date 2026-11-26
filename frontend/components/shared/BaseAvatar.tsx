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
  /** The "+7" overflow chip. */
  label?: string;
  /** Avatar_URL; absent or a failed load shows the initials. */
  src?: string | null;
  /** An Admin turned the person's account off (ADM-09): a muted circle, and the state in the name. "Inactive" wins over "Unavailable". */
  inactive?: boolean;
  /** The person is marked unavailable: a dashed outline, and the state in the name. */
  unavailable?: boolean;
}

/** Brand-coloured initials circle (24px in cards, 32px in the sidebar and header), or the image; hovering or focusing it shows the full name. */
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
          "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand text-2xs font-bold text-on-brand focus-ring",
          size === "sm" ? "size-avatar-sm text-2xs" : size === "xl" ? "size-avatar-xl text-title" : "size-avatar-md text-2xs",
          inactive && "opacity-disabled",
          !inactive && unavailable && "border border-dashed border-ink-muted",
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
