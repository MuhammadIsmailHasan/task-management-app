import DOMPurify from "dompurify";

export const RICH_TAGS = ["p", "br", "strong", "em", "u", "s", "ul", "ol", "li", "a", "h2", "h3", "blockquote", "code", "pre"];
export const RICH_ATTRS = ["href", "title", "rel", "target"];

export function safeHtml(html: string | null | undefined): string {
  if (!html || typeof window === "undefined") return "";
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: RICH_TAGS, ALLOWED_ATTR: RICH_ATTRS });
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };

export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<(br|\/p|\/li|\/h[23]|\/blockquote|\/pre)\b[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e: string) => ENTITIES[e])
    .replace(/\s+/g, " ")
    .trim();
}
