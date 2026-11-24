import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/** tailwind-merge knows the Design_System's own scales, so `rounded-field` replaces `rounded-full` and `text-meta` replaces `text-sm`. */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ["sm", "field", "card", "frame", "full"],
      text: ["2xs", "xs", "meta", "sm", "base", "title", "page-title", "xl", "display", "card-title"],
      shadow: ["card", "hover", "popover", "dragging", "modal", "panel", "float"],
    },
  },
});

/** shadcn/ui helper: join class names and resolve conflicting Tailwind utilities. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
