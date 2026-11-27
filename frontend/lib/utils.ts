import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ["sm", "field", "card", "frame", "full"],
      text: ["2xs", "xs", "meta", "sm", "base", "title", "page-title", "xl", "display", "card-title"],
      shadow: ["card", "hover", "popover", "dragging", "modal", "panel", "float"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
