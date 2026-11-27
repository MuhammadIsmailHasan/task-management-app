"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseField, BaseInput } from "@/components/shared/BaseField";
import { BaseModal } from "@/components/shared/BaseModal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { RichTextEditor } from "@/components/shared/RichTextEditor";
import { htmlToText } from "@/lib/rich-text";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/http";
import { boardPath } from "@/lib/routes";
import type { Board } from "@/lib/types";

interface NewBoardModalProps {
  open: boolean;
  onClose: () => void;
  /** Edit this Board's name and description instead of creating one (a Manager, an Admin, or the owner). */
  board?: Board;
}

/** The one Board form: "New board" creates (after a confirmation), "Edit board" saves the name and description at once. */
export function NewBoardModal({ open, onClose, board }: NewBoardModalProps) {
  const router = useRouter();
  const editing = !!board;
  const [name, setName] = useState(board?.name ?? "");
  const [description, setDescription] = useState(board?.description ?? "");
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const tooLong = htmlToText(description).length > 500; // the Backend counts the visible characters too

  // Editing opens on the Board's current values every time.
  useEffect(() => {
    if (open && board) {
      setName(board.name);
      setDescription(board.description ?? "");
      setNameError(null);
    }
  }, [open, board]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (editing) void save();
    else setAsking(true);
  }

  async function save() {
    if (!board) return;
    setBusy(true);
    setNameError(null);
    try {
      const saved = await api.boards.update(board.id, { name, description: htmlToText(description) ? description : "" });
      onClose();
      // a rename moves the slug (OQ46); the shell reloads its Board list once the new address lands
      if (saved.slug !== board.slug) router.replace(boardPath(saved.slug));
      else router.refresh();
    } catch (err) {
      setNameError(err instanceof ApiError ? (err.details?.name?.[0] ?? null) : null);
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    try {
      const created = await api.boards.create({ name, ...(htmlToText(description) ? { description } : {}) });
      onClose();
      setName("");
      setDescription("");
      router.push(boardPath(created.slug)); // the shell reloads its Board list once the new Board's address lands
    } catch (err) {
      throw new Error(err instanceof ApiError ? (err.details?.name?.[0] ?? err.message) : "Could not create the board.");
    }
  }

  const formId = editing ? "edit-board-form" : "new-board-form";
  const fieldId = editing ? "edit-board" : "board";

  return (
    <BaseModal
      open={open}
      title={editing ? "Edit board" : "New board"}
      onClose={onClose}
      footer={
        <>
          <BaseButton variant="ghost" onClick={onClose}>
            Cancel
          </BaseButton>
          <BaseButton type="submit" form={formId} className="ml-auto" disabled={!name.trim() || tooLong || busy}>
            {editing ? (busy ? "Saving…" : "Save changes") : "Create board"}
          </BaseButton>
        </>
      }
    >
      <form id={formId} method="post" className="flex flex-col gap-field" onSubmit={submit}>
        <BaseField label="Board name" htmlFor={`${fieldId}-name`} errors={nameError ? [nameError] : undefined}>
          <BaseInput id={`${fieldId}-name`} value={name} onChange={(e) => setName(e.target.value)} required />
        </BaseField>
        <BaseField label="Description (optional)" htmlFor={`${fieldId}-description`} errors={tooLong ? ["At most 500 characters."] : undefined}>
          <RichTextEditor id={`${fieldId}-description`} label="Description" value={description} onChange={setDescription} placeholder="What is this board for?" />
        </BaseField>
      </form>
      {!editing && (
        <ConfirmDialog
          open={asking}
          onOpenChange={setAsking}
          tone="primary"
          confirmLabel="Create"
          title={`Create board “${name.trim()}”?`}
          message="It opens with the default columns."
          onConfirm={create}
        />
      )}
    </BaseModal>
  );
}
