"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { BaseAvatar } from "@/components/shared/BaseAvatar";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseAlert } from "@/components/shared/BaseField";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { formatWhen } from "@/lib/activity";
import type { Comment } from "@/lib/types";
import { CommentComposer } from "./CommentComposer";

export type CommentSort = "latest" | "popular";

interface CommentThreadProps {
  comments: Comment[];
  sort: CommentSort;
  names?: Record<string, string>;
  canReply: boolean;
  canPrioritize: boolean;
  onSortChange: (sort: CommentSort) => void;
  onReply: (commentId: string, content: string) => Promise<void>;
  onTogglePriority: (commentId: string) => Promise<void>;
  onCreateCard?: (comment: Comment) => Promise<void>;
  /** The viewer's id: only their own Comments get a Delete action (Requirement 26). */
  viewerId?: string | null;
  onDelete?: (comment: Comment) => Promise<void>;
}

/**
 * Priority comments come first (the server orders them), then the rest under a Latest/Popular toggle.
 * Reply shows only on top-level comments; there is no like button; Create card follows `can_create_card`.
 */
export function CommentThread({ comments, sort, names = {}, canReply, canPrioritize, onSortChange, onReply, onTogglePriority, onCreateCard, viewerId, onDelete }: CommentThreadProps) {
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function createCard(c: Comment) {
    setNotice(null);
    try {
      await onCreateCard?.(c);
      setNotice("Card created in the first column.");
    } catch {
      setNotice("Could not create the card.");
      throw new Error("Could not create the card.");
    }
  }

  const author = (c: Comment) => c.author_name ?? names[c.author_id] ?? "Someone";

  const actionButton = "h-auto min-h-0 px-2 py-1 text-xs";

  function renderItem(c: Comment, reply = false) {
    const replies = c.replies ?? [];
    return (
      <div className="flex gap-3">
        <div className="flex flex-col items-center gap-2">
          <BaseAvatar name={author(c)} src={c.author_avatar_url} size={reply ? "sm" : "md"} />
          {replies.length > 0 && <span aria-hidden="true" className="w-px flex-1 bg-line" />}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <strong className="text-sm font-semibold">{author(c)}</strong>
            <time className="text-xs text-ink-muted">{formatWhen(c.created_at)}</time>
            {c.is_priority && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-label-purple-fg">
                <Flag className="size-icon-sm" aria-hidden="true" />
                Priority
              </span>
            )}
          </div>
          <p className="text-sm break-words whitespace-pre-wrap">{c.content}</p>
          <div className="-ml-2 flex flex-wrap items-center">
            {!reply && canReply && (
              <BaseButton size="sm" variant="ghost" className={actionButton} onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}>
                Reply
              </BaseButton>
            )}
            {canPrioritize && (
              <BaseButton size="sm" variant="ghost" className={actionButton} onClick={() => onTogglePriority(c.id)}>
                {c.is_priority ? "Remove priority" : "Mark as priority"}
              </BaseButton>
            )}
            {c.can_create_card && onCreateCard && (
              <ConfirmDialog
                tone="primary"
                confirmLabel="Create"
                title="Create card from comment?"
                message="A new card with this comment as its description is added to the first column."
                onConfirm={() => createCard(c)}
                trigger={
                  <BaseButton size="sm" variant="ghost" className={actionButton}>
                    Create card
                  </BaseButton>
                }
              />
            )}
            {onDelete && viewerId && c.author_id === viewerId && (
              <ConfirmDialog
                title="Delete comment?"
                message={reply ? "This reply will be deleted." : "This comment will be deleted."}
                detail={!reply && c.reply_count > 0 ? `This also deletes its ${c.reply_count} ${c.reply_count === 1 ? "reply" : "replies"}.` : undefined}
                confirmLabel="Delete"
                onConfirm={() => onDelete(c)}
                trigger={
                  <BaseButton size="sm" variant="ghost" className={actionButton}>
                    Delete
                  </BaseButton>
                }
              />
            )}
            {!reply && replies.length > 0 && (
              <span className="px-2 text-xs text-ink-muted">
                {c.reply_count} {c.reply_count === 1 ? "reply" : "replies"}
              </span>
            )}
          </div>
          {replies.length > 0 && (
            <ul className="m-0 mt-2 flex list-none flex-col gap-3 p-0">
              {replies.map((r) => (
                <li key={r.id}>
                  {renderItem(r, true)}
                </li>
              ))}
            </ul>
          )}
          {replyTo === c.id && (
            <CommentComposer
              label="Write a reply"
              submitLabel="Reply"
              onCancel={() => setReplyTo(null)}
              onSubmit={async (content) => {
                await onReply(c.id, content);
                setReplyTo(null);
              }}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-ink-muted">Sort by</span>
        <div role="group" aria-label="Sort comments" className="flex items-center gap-2">
          <BaseButton size="sm" variant={sort === "latest" ? "primary" : "secondary"} aria-pressed={sort === "latest"} onClick={() => onSortChange("latest")}>
            Latest
          </BaseButton>
          <BaseButton size="sm" variant={sort === "popular" ? "primary" : "secondary"} aria-pressed={sort === "popular"} onClick={() => onSortChange("popular")}>
            Popular
          </BaseButton>
        </div>
      </div>
      {notice && <BaseAlert tone="info">{notice}</BaseAlert>}
      {comments.length === 0 && <p className="text-sm text-ink-muted">No comments yet.</p>}
      <ul className="m-0 flex list-none flex-col gap-5 p-0">
        {comments.map((c) => (
          <li key={c.id}>
            {renderItem(c)}
          </li>
        ))}
      </ul>
    </div>
  );
}
