import { ArrowUpRight, FileArchive, FileText, Link as LinkIcon } from "lucide-react";
import { hrefFor, iconFor } from "@/lib/attachments";
import type { Attachment } from "@/lib/types";

export const ATTACHMENT_TILE = "flex min-w-0 items-center justify-between gap-2 rounded-ui border border-line bg-surface-raised px-3 py-2 text-xs";

const ICONS = { link: LinkIcon, archive: FileArchive, document: FileText } as const;

function detail(a: Pick<Attachment, "url" | "mime_type">): string {
  if (!a.url) return a.mime_type ? `File · ${a.mime_type}` : "File";
  try {
    return new URL(a.url).hostname;
  } catch {
    return "Link";
  }
}

export function AttachmentLink({ attachment: a, onOpen }: { attachment: Pick<Attachment, "url" | "file_url" | "name" | "mime_type">; onOpen?: (e: React.MouseEvent<HTMLAnchorElement>) => void }) {
  const Icon = ICONS[iconFor(a)];
  return (
    <a href={hrefFor(a)} target="_blank" rel="noopener noreferrer" aria-label={a.name} onClick={onOpen} className="group flex min-w-0 flex-1 items-center gap-3 text-ink no-underline">
      <span aria-hidden="true" className="inline-flex size-control-sm shrink-0 items-center justify-center rounded-ui bg-accent-tint text-on-accent-tint">
        <Icon className="size-icon-sm" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium group-hover:underline">{a.name}</span>
        <span className="truncate text-ink-muted">{detail(a)}</span>
      </span>
      <ArrowUpRight aria-hidden="true" className="size-icon-sm shrink-0 text-ink-muted" />
    </a>
  );
}
