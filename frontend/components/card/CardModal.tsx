"use client";

import { SquareKanban } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BaseBadge } from "@/components/shared/BaseBadge";
import { cn } from "@/lib/utils";
import { pageTitle } from "@/lib/titles";
import { BaseButton } from "@/components/shared/BaseButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { BaseCard } from "@/components/shared/BaseCard";
import { BaseAlert, BaseInput } from "@/components/shared/BaseField";
import { RichText } from "@/components/shared/RichText";
import { RichTextEditor } from "@/components/shared/RichTextEditor";
import { BaseModal } from "@/components/shared/BaseModal";
import { useShell } from "@/components/shell/ShellContext";
import { useFieldSave } from "@/hooks/useFieldSave";
import { api } from "@/lib/api";
import { buildPatch, toDraft, type Draft, type FieldKey } from "@/lib/autosave";
import { isRangeValid } from "@/lib/dates";
import { ApiError } from "@/lib/http";
import { withSubtasks } from "@/lib/progress";
import type { Board, Card, Category, Column, Comment, Member } from "@/lib/types";
import { CardActivity } from "./CardActivity";
import { AttachmentList } from "./AttachmentList";
import { CardAttributes } from "./CardAttributes";
import { CommentComposer } from "./CommentComposer";
import { CommentThread, type CommentSort } from "./CommentThread";
import { FieldStatus } from "./FieldStatus";
import { SubtaskChecklist } from "./SubtaskChecklist";

/** Comments and activity show this many at a time (CMV-06). */
const COMMENT_PAGE = 5;

interface CardModalProps {
  cardId: string;
  board: Board;
  columns: Column[];
  categories: Category[];
  onClose: () => void;
  onChanged: (card: Card) => void;
  onDeleted: (id: string) => void;
  onCreateCardFromComment?: (comment: Comment) => Promise<void>;
}

/**
 * One two-pane modal for viewing and editing. There is no Save button and no draft of the Card: each field saves on
 * its own (Requirement 25, Decision AB). The input state here is only what the user is typing; `card` is what was saved.
 */
export function CardModal({ cardId, board, columns, categories, onClose, onChanged, onDeleted, onCreateCardFromComment }: CardModalProps) {
  const { session } = useShell();
  const [card, setCard] = useState<Card | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [sort, setSort] = useState<CommentSort>("latest");
  const [comments, setComments] = useState<Comment[] | undefined>(undefined);
  const [commentTotal, setCommentTotal] = useState(0);
  const [moreBusy, setMoreBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const role = session?.role;
  const staff = role === "supervisor" || role === "manager" || role === "admin";
  // PERM-02: staff edit every field; the assigned Member edits the description, adds and checks, and comments.
  const isAssignee = role === "member" && !!card && card.assignee_id === session?.userId;
  const canFields = staff;
  const canWork = staff || isAssignee;
  const names = Object.fromEntries(members.map((m) => [m.id, m.full_name]));
  const columnNames = Object.fromEntries(columns.map((c) => [c.id, c.name]));

  const merge = useCallback((update: (c: Card) => Card) => setCard((c) => (c ? update(c) : c)), []);
  const saved = useCallback(
    (response: Card, sent: string[]) => {
      // The server's normalised value (a trimmed title) replaces what was typed, for the fields that request sent only.
      const fresh = toDraft(response) as unknown as Record<string, unknown>;
      setDraft((d) => (d ? ({ ...d, ...Object.fromEntries(sent.map((k) => [k, fresh[k]])) } as Draft) : d));
      onChanged(response);
    },
    [onChanged],
  );
  const fields = useFieldSave({ cardId, onMerged: merge, onSaved: saved });

  const load = useCallback(async () => {
    const fresh = await api.cards.get(cardId);
    setCard(fresh);
    setDraft(toDraft(fresh));
    // the card embeds every top-level comment, newest first: show the first page and total (CMV-06)
    setComments(fresh.comments?.slice(0, COMMENT_PAGE));
    setCommentTotal(fresh.comments?.length ?? 0);
    return fresh;
  }, [cardId]);

  useEffect(() => {
    load().catch((err) => setMessage(err instanceof ApiError ? err.message : "Could not load the card."));
  }, [load]);

  useEffect(() => {
    // Board staff get each member's Email for the assignee picker; anyone else (or a 403) gets the plain list.
    // `assignable`: only active and available people are offered; an assignee who is neither stays on the Card (ADM-08, ADM-09)
    const plain = () => api.boards.members(board.id, false, true).then(setMembers).catch(() => setMembers([]));
    if (staff) api.boards.members(board.id, true, true).then(setMembers).catch(plain);
    else void plain();
  }, [board.id, staff]);

  /** Reload from the top, keeping as many rows as were showing. */
  const loadComments = useCallback(
    async (next: CommentSort, keep = COMMENT_PAGE) => {
      const page = await api.comments.list(cardId, next, { limit: Math.min(Math.max(keep, COMMENT_PAGE), 50) });
      setComments(page.items);
      setCommentTotal(page.total);
    },
    [cardId],
  );

  async function loadMoreComments() {
    setMoreBusy(true);
    try {
      const page = await api.comments.list(cardId, sort, { limit: COMMENT_PAGE, offset: comments?.length ?? 0 });
      setComments((cur) => [...(cur ?? []), ...page.items]);
      setCommentTotal(page.total);
    } finally {
      setMoreBusy(false);
    }
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));

  /** Send one field if it differs from the last saved value. */
  function commit(field: FieldKey, next: Draft | null = draft) {
    if (!card || !next) return;
    const body = buildPatch(field, toDraft(card), next);
    if (body) void fields.save(field, body);
  }

  function commitTitle() {
    if (!card || !draft) return;
    if (!draft.title.trim()) {
      setTitleError("Title is required.");
      requestAnimationFrame(() => titleRef.current?.focus());
      return;
    }
    setTitleError(null);
    commit("title");
  }

  function onAttributes(patch: Partial<Draft>) {
    if (!draft) return;
    const next = { ...draft, ...patch };
    setDraft(next);
    if ("start_date" in patch || "end_date" in patch) return; // the dates save when the popover closes
    commit(Object.keys(patch)[0] as FieldKey, next);
  }

  function onDatesClose() {
    if (!card || !draft) return;
    if (!isRangeValid(draft.start_date, draft.end_date)) {
      setDraft({ ...draft, start_date: card.start_date ?? "", end_date: card.end_date ?? "" });
      return;
    }
    commit("dates");
  }

  /** Close after every pending save finished; a failed save asks first (Requirement 25, criteria 13 and 14). */
  async function requestClose() {
    if (closing) return;
    setClosing(true);
    if (card && draft && !draft.title.trim()) setDraft({ ...draft, title: card.title });
    (document.activeElement as HTMLElement | null)?.blur();
    await Promise.resolve();
    await fields.whenIdle();
    setClosing(false);
    if (fields.hasFailed()) setConfirmClose(true);
    else onClose();
  }

  async function archive() {
    if (!card) return;
    try {
      onChanged(await api.cards.archive(card.id));
      onClose();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Could not archive.");
    }
  }

  async function remove() {
    if (!card) return;
    try {
      await api.cards.remove(card.id);
      onDeleted(card.id);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Could not delete.");
    }
  }

  const canComment = role === "manager" || role === "supervisor" || isAssignee;
  const datesValid = !draft || isRangeValid(draft.start_date, draft.end_date);
  const overdue = card?.due_state === "overdue"; // the server's rule, never the browser date (VIEW-09)
  const columnName = columns.find((c) => c.id === card?.column_id)?.name;
  const showRight = !!card && (comments !== undefined || !!card.activity);

  const footer = card && draft && staff && (
    <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
      <BaseButton variant="secondary" onClick={archive} disabled={columnName === "Done"} title={columnName === "Done" ? "Move the card out of Done to archive it" : undefined}>
        Archive
      </BaseButton>
      <ConfirmDialog title="Delete card?" message="This cannot be undone from the board." onConfirm={remove} trigger={<BaseButton variant="danger">Delete</BaseButton>} />
    </div>
  );

  // The open Card names the tab; closing it restores the Board title (Requirement 32, criterion 5).
  const cardName = draft ? draft.title.trim() || "Untitled card" : "";
  useEffect(() => {
    if (!cardName) return;
    const previous = document.title;
    document.title = pageTitle(`${cardName} · ${board.name}`);
    return () => {
      document.title = previous;
    };
  }, [cardName, board.name]);

  return (
    <>
      <BaseModal
        open
        size="card"
        title={`${draft ? draft.title.trim() || "Untitled card" : "Card"} | ${board.name}`}
        titleHidden
        scrollBody={false}
        onClose={() => void requestClose()}
        footer={footer || undefined}
        headerAside={
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <span aria-hidden="true" className="inline-flex size-control shrink-0 items-center justify-center rounded-ui bg-accent-tint text-on-accent-tint">
              <SquareKanban className="size-icon" />
            </span>
            <span className="min-w-0 text-sm text-ink-muted break-words">{board.name}</span>
            {columnName && (
              <>
                <span aria-hidden="true" className="text-ink-muted">
                  /
                </span>
                <BaseBadge tone="accent">{columnName}</BaseBadge>
              </>
            )}
            <span aria-live="polite" className="inline-flex items-center gap-1 rounded-ui border border-line px-3 py-1 text-xs text-ink-muted">
              <i aria-hidden="true" className={cn("size-dot rounded-full", closing || fields.busy ? "bg-label-orange-fg" : "bg-accent")} />
              {closing || fields.busy ? "Saving…" : "Auto-saved"}
            </span>
          </div>
        }
      >
        {!card || !draft ? (
          <p className="text-ink-muted">{message ?? "Loading…"}</p>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto lg:overflow-hidden">
            <div className="grid grid-cols-1 gap-6 lg:h-full lg:grid-cols-5 lg:grid-rows-1">
              <div className="flex min-w-0 flex-col gap-section p-1 lg:col-span-3 lg:min-h-0 lg:overflow-y-auto">
                <BaseCard plain title="Details">
                  <div className="flex flex-col gap-label">
                    <span className="text-xs text-ink-muted uppercase">Card title</span>
                    {canFields ? (
                      <BaseInput
                        ref={titleRef}
                        aria-label="Title"
                        className="font-heading text-page-title"
                        value={draft.title}
                        aria-invalid={titleError ? true : undefined}
                        onChange={(e) => {
                          set("title", e.target.value);
                          if (e.target.value.trim()) setTitleError(null);
                        }}
                        onBlur={commitTitle}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), commitTitle())}
                      />
                    ) : (
                      <h2 className="min-w-0 flex-1 font-heading text-page-title break-words">{draft.title.trim() || "Untitled card"}</h2>
                    )}
                    {titleError ? (
                      <span role="alert" className="text-xs text-danger">{titleError}</span>
                    ) : (
                      canFields && <FieldStatus field="title" state={fields.status.title} onRetry={() => void fields.retry("title")} />
                    )}
                  </div>
                  <CardAttributes
                    value={draft}
                    onChange={onAttributes}
                    categories={categories}
                    members={members}
                    assigneeFallback={card.assignee_name ? { name: card.assignee_name, avatar_url: card.assignee_avatar_url ?? null, inactive: card.assignee_is_active === false, unavailable: card.assignee_is_available === false } : null}
                    columnName={columnName}
                    canEdit={canFields}
                    canAssign={staff}
                    overdue={overdue}
                    status={fields.status}
                    onRetry={(f) => void fields.retry(f)}
                    onDatesClose={onDatesClose}
                  />
                  {!datesValid && <BaseAlert>The end date cannot be before the start date.</BaseAlert>}
                  {message && <BaseAlert tone="info">{message}</BaseAlert>}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-heading text-base font-semibold">Description</h3>
                      {canWork && <FieldStatus field="description" state={fields.status.description} onRetry={() => void fields.retry("description")} />}
                    </div>
                    {canWork ? (
                      <RichTextEditor label="Description" value={draft.description} onChange={(html) => set("description", html)} onBlur={() => commit("description")} placeholder="Add a description" />
                    ) : (
                      <RichText html={draft.description} />
                    )}
                  </div>
                </BaseCard>

                <BaseCard plain title="Attachments">
                  <AttachmentList
                    cardId={card.id}
                    attachments={card.attachments}
                    canEdit={canWork}
                    onChange={(attachments) => {
                      const next = { ...card, attachments };
                      setCard(next);
                      onChanged(next);
                    }}
                  />
                </BaseCard>

                <BaseCard plain title="Subtasks">
                  <SubtaskChecklist
                    cardId={card.id}
                    subtasks={card.subtasks}
                    canEdit={canWork}
                    onChange={(subtasks) => {
                      const next = withSubtasks(card, subtasks);
                      setCard(next);
                      onChanged(next);
                    }}
                  />
                </BaseCard>
              </div>

              {showRight && (
                <div className="flex min-w-0 flex-col gap-section p-1 lg:col-span-2 lg:min-h-0 lg:overflow-y-auto">
                  {comments !== undefined && (
                    <BaseCard plain title="Comments">
                      {canComment ? (
                        <CommentComposer
                          onSubmit={async (content) => {
                            await api.comments.create(card.id, content);
                            await loadComments(sort, (comments?.length ?? 0) + 1);
                          }}
                        />
                      ) : (
                        <p className="text-sm text-ink-muted">Only the assignee and board staff can comment.</p>
                      )}
                      <CommentThread
                        comments={comments}
                        sort={sort}
                        names={names}
                        canReply={canComment}
                        canPrioritize={role === "manager"}
                        viewerId={session?.userId}
                        onSortChange={(next) => { setSort(next); void loadComments(next, comments?.length); }}
                        onReply={async (id, content) => { await api.comments.reply(id, content); await loadComments(sort, comments?.length); }}
                        onTogglePriority={async (id) => { await api.comments.togglePriority(id); await loadComments(sort, comments?.length); }}
                        onDelete={async (c) => { await api.comments.remove(c.id); await loadComments(sort, comments?.length); }}
                        onCreateCard={onCreateCardFromComment}
                      />
                      {(comments?.length ?? 0) < commentTotal && (
                        <BaseButton variant="secondary" disabled={moreBusy} onClick={() => void loadMoreComments()}>
                          {moreBusy ? "Loading…" : "Load more comments"}
                        </BaseButton>
                      )}
                    </BaseCard>
                  )}
                  {card.activity && (
                    <BaseCard plain title="Activity">
                      <CardActivity cardId={card.id} initial={card.activity} names={names} columns={columnNames} />
                    </BaseCard>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </BaseModal>
      <BaseModal
        open={confirmClose}
        title="Close without saving?"
        onClose={() => setConfirmClose(false)}
        footer={
          <div className="ml-auto flex items-center gap-2">
            <BaseButton variant="secondary" onClick={() => setConfirmClose(false)}>
              Keep editing
            </BaseButton>
            <BaseButton variant="danger" onClick={onClose}>
              Close anyway
            </BaseButton>
          </div>
        }
      >
        <p className="text-sm">Some changes were not saved. Close anyway?</p>
      </BaseModal>
    </>
  );
}
