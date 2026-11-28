"use client";

import { Calendar, Flag } from "lucide-react";
import { useState } from "react";
import { BaseBadge, type BadgeTone } from "@/components/shared/BaseBadge";
import { BaseCard } from "@/components/shared/BaseCard";
import { BaseCheckbox } from "@/components/shared/BaseCheckbox";
import { BaseAlert } from "@/components/shared/BaseField";
import { RichText } from "@/components/shared/RichText";
import { BaseModal } from "@/components/shared/BaseModal";
import { api } from "@/lib/api";
import { absoluteFileUrl, isExpired } from "@/lib/attachments";
import { ATTACHMENT_TILE, AttachmentLink } from "@/components/card/AttachmentLink";
import { shortDate } from "@/lib/format";
import { categoryTone } from "@/lib/tones";
import type { Attachment, Category, Priority, SharedCard } from "@/lib/types";

const PRIORITY_TONE: Record<Priority, BadgeTone> = { high: "red", medium: "orange", low: "green" };

interface SharedCardModalProps {
  token: string;
  card: SharedCard | null;
  category?: Category;
  onClose: () => void;
}

export function SharedCardModal({ token, card, category, onClose }: SharedCardModalProps) {
  const [error, setError] = useState<string | null>(null);

  async function open(e: React.MouseEvent, a: Attachment) {
    if (a.url || !a.file_url) return;
    e.preventDefault();
    setError(null);
    let href = absoluteFileUrl(a.file_url);
    try {
      if (isExpired(a.file_url)) {
        const fresh = await api.shared.attachmentUrl(token, a.id);
        if (fresh.file_url) href = absoluteFileUrl(fresh.file_url);
      }
      window.open(href, "_blank", "noopener,noreferrer");
    } catch {
      setError("Could not open the file.");
    }
  }

  return (
    <BaseModal open={!!card} title={card?.title ?? "Card"} onClose={onClose} size="wide">
      {card && (
        <div className="flex flex-col gap-section">
          <div className="flex flex-wrap items-center gap-2">
            {category && (
              <BaseBadge shape="tag" dot tone={categoryTone(category)} className="lowercase">
                {category.name}
              </BaseBadge>
            )}
            <BaseBadge shape="outline" tone={PRIORITY_TONE[card.priority]} className="lowercase">
              <Flag className="size-icon-sm" aria-hidden="true" />
              {card.priority}
            </BaseBadge>
            {(card.start_date || card.end_date) && (
              <span className="inline-flex items-center gap-1 text-sm text-ink-muted">
                <Calendar className="size-icon-sm" aria-hidden="true" />
                {[card.start_date, card.end_date].filter(Boolean).map((d) => shortDate(d)).join(" to ")}
              </span>
            )}
            {card.assignee_name && <span className="text-sm text-ink-muted">Assigned to {card.assignee_name}</span>}
          </div>
          <RichText html={card.description} />
          <BaseCard plain title="Subtasks">
            {card.subtasks.length === 0 && <p className="text-sm text-ink-muted">No subtasks.</p>}
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {card.subtasks.map((s) => (
                <li key={s.id} className="flex items-center gap-3 text-sm">
                  <BaseCheckbox checked={s.is_done} disabled readOnly aria-label={s.title} />
                  <span className={s.is_done ? "text-ink-muted line-through" : undefined}>{s.title}</span>
                </li>
              ))}
            </ul>
          </BaseCard>
          <BaseCard plain title="Attachments">
            {card.attachments.length === 0 && <p className="text-sm text-ink-muted">No attachments.</p>}
            {error && <BaseAlert>{error}</BaseAlert>}
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {card.attachments.map((a) => (
                <li key={a.id} className={ATTACHMENT_TILE}>
                  <AttachmentLink attachment={a} onOpen={(e) => void open(e, a)} />
                </li>
              ))}
            </ul>
          </BaseCard>
        </div>
      )}
    </BaseModal>
  );
}
