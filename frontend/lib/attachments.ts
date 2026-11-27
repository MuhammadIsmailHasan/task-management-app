import { apiAsset } from "./http";
import type { Attachment } from "./types";

export function expiryOf(fileUrl: string | null): number | null {
  if (!fileUrl) return null;
  const match = /[?&]exp=(\d+)/.exec(fileUrl);
  return match ? Number(match[1]) : null;
}

export function isExpired(fileUrl: string | null, nowMs: number = Date.now()): boolean {
  const exp = expiryOf(fileUrl);
  return exp !== null && nowMs / 1000 > exp;
}

export function absoluteFileUrl(path: string): string {
  return apiAsset(path);
}

export function hrefFor(a: Pick<Attachment, "url" | "file_url">): string {
  return a.url ?? (a.file_url ? absoluteFileUrl(a.file_url) : "#");
}

export type AttachmentIcon = "document" | "archive" | "link";

export function iconFor(a: Pick<Attachment, "url" | "name" | "mime_type">): AttachmentIcon {
  if (a.url) return "link";
  const name = a.name.toLowerCase();
  if (name.endsWith(".rar") || (a.mime_type ?? "").includes("rar")) return "archive";
  return "document";
}
