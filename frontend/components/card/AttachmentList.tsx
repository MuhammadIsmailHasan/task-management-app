"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseCombobox } from "@/components/shared/BaseCombobox";
import { BaseAlert, BaseInput } from "@/components/shared/BaseField";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { BasePopover } from "@/components/shared/BasePopover";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/http";
import { FileDropZone } from "./FileDropZone";
import { absoluteFileUrl, isExpired } from "@/lib/attachments";
import { ATTACHMENT_TILE, AttachmentLink } from "./AttachmentLink";
import type { Attachment } from "@/lib/types";

interface AttachmentListProps {
  cardId: string;
  attachments: Attachment[];
  canEdit: boolean;
  onChange: (attachments: Attachment[]) => void;
}

const KINDS = [
  { value: "link", label: "Link" },
  { value: "file", label: "File" },
];

export function AttachmentList({ cardId, attachments, canEdit, onChange }: AttachmentListProps) {
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState("link");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<{ message: string; retry?: () => void } | null>(null);
  const shown = attachments;

  async function attempt(action: () => Promise<void>, message: string) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError({ message: err instanceof ApiError ? err.message : message, retry: () => void attempt(action, message) });
    }
  }

  const addLink = (link: string) => attempt(async () => onChange([...attachments, await api.attachments.addLink(cardId, { url: link })]), "Could not add the link.");
  const addFile = (file: File) => attempt(async () => onChange([...attachments, await api.attachments.upload(cardId, file)]), "Could not upload the file.");
  const remove = (id: string) => attempt(async () => { await api.attachments.remove(id); onChange(attachments.filter((x) => x.id !== id)); }, "Could not remove the attachment.");

  async function open(e: React.MouseEvent, a: Attachment) {
    if (a.url || !a.file_url) return;
    e.preventDefault();
    let href = absoluteFileUrl(a.file_url);
    try {
      if (isExpired(a.file_url)) {
        const fresh = await api.attachments.freshUrl(a.id);
        if (fresh.file_url) href = absoluteFileUrl(fresh.file_url);
      }
      window.open(href, "_blank", "noopener,noreferrer");
    } catch {
      setError({ message: "Could not open the file." });
    }
  }

  const nothing = shown.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <div className={canEdit ? "grid grid-cols-1 items-start gap-3 lg:grid-cols-2" : "flex flex-col"}>
        <div className="flex min-w-0 flex-col gap-3">
          {nothing && <p className="text-sm text-ink-muted">No attachments.</p>}
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {shown.map((a) => (
              <li key={a.id} className={ATTACHMENT_TILE}>
                <AttachmentLink attachment={a} onOpen={(e) => void open(e, a)} />
                {canEdit && a.can_edit !== false && (
                  <ConfirmDialog
                    title="Remove attachment?"
                    message={a.name}
                    confirmLabel="Remove"
                    onConfirm={() => remove(a.id)}
                    trigger={
                      <BaseButton variant="ghost" size="sm" className="size-control-sm shrink-0 px-0" aria-label={`Remove ${a.name}`}>
                        <X aria-hidden="true" />
                      </BaseButton>
                    }
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
        {canEdit && (
          <BasePopover
            wide
            label="Add an attachment"
            open={adding}
            onOpenChange={setAdding}
            trigger={
              <BaseButton variant="secondary" className="min-h-control w-full justify-start gap-2 px-3 text-xs font-medium">
                <Plus aria-hidden="true" />
                Add attachment
              </BaseButton>
            }
          >
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-ink-muted">Type</span>
                <BaseCombobox label="Type" options={KINDS} value={kind} onChange={setKind} />
              </div>
              {kind === "link" ? (
                <div className="flex items-center gap-2">
                  <BaseInput type="url" placeholder="https://link" aria-label="Attachment link" value={url} onChange={(e) => setUrl(e.target.value)} />
                  <BaseButton
                    disabled={!url.trim()}
                    onClick={() => {
                      void addLink(url.trim());
                      setUrl("");
                      setAdding(false);
                    }}
                  >
                    Add
                  </BaseButton>
                </div>
              ) : (
                <FileDropZone
                  onFile={(file) => {
                    void addFile(file);
                    setAdding(false);
                  }}
                />
              )}
            </div>
          </BasePopover>
        )}
      </div>
      {error && (
        <div className="flex flex-wrap items-center gap-2">
          <BaseAlert>{error.message}</BaseAlert>
          {error.retry && (
            <BaseButton variant="secondary" size="sm" onClick={error.retry}>
              Retry
            </BaseButton>
          )}
        </div>
      )}
    </div>
  );
}
