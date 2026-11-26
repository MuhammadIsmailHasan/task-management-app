"use client";

import { useEffect, useState } from "react";
import { htmlToText, safeHtml } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

/** A description shown as formatted text: sanitised HTML in the `rich-text` style (DS-29). The server renders plain words. */
export function RichText({ html, empty = "No description.", className }: { html: string | null | undefined; empty?: string; className?: string }) {
  const [clean, setClean] = useState<string | null>(null);
  useEffect(() => setClean(safeHtml(html)), [html]);
  if (!htmlToText(html)) return <p className={cn("text-sm text-ink-muted", className)}>{empty}</p>;
  if (clean === null) return <p className={cn("text-sm", className)}>{htmlToText(html)}</p>;
  return <div className={cn("rich-text text-sm", className)} dangerouslySetInnerHTML={{ __html: clean }} />;
}
