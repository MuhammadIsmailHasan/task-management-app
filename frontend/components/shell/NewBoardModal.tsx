"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseField, BaseInput } from "@/components/shared/BaseField";
import { BaseModal } from "@/components/shared/BaseModal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { RichTextEditor } from "@/components/shared/RichTextEditor";
import { htmlToText } from "@/lib/rich-text";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/http";
import { boardPath } from "@/lib/routes";

export function NewBoardModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [asking, setAsking] = useState(false);
  const tooLong = htmlToText(description).length > 500; // the Backend counts the visible characters too

  function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim()) setAsking(true);
  }

  async function create() {
    try {
      const board = await api.boards.create({ name, ...(htmlToText(description) ? { description } : {}) });
      onClose();
      setName("");
      setDescription("");
      router.push(boardPath(board.slug));
      router.refresh();
    } catch (err) {
      throw new Error(err instanceof ApiError ? (err.details?.name?.[0] ?? err.message) : "Could not create the board.");
    }
  }

  return (
    <BaseModal
      open={open}
      title="New board"
      onClose={onClose}
      footer={
        <>
          <BaseButton variant="ghost" onClick={onClose}>
            Cancel
          </BaseButton>
          <BaseButton type="submit" form="new-board-form" className="ml-auto" disabled={!name.trim() || tooLong}>
            Create board
          </BaseButton>
        </>
      }
    >
      <form id="new-board-form" method="post" className="flex flex-col gap-4" onSubmit={submit}>
        <BaseField label="Board name" htmlFor="board-name">
          <BaseInput id="board-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </BaseField>
        <BaseField label="Description (optional)" htmlFor="board-description" errors={tooLong ? ["At most 500 characters."] : undefined}>
          <RichTextEditor id="board-description" label="Description" value={description} onChange={setDescription} placeholder="What is this board for?" />
        </BaseField>
      </form>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        tone="primary"
        confirmLabel="Create"
        title={`Create board “${name.trim()}”?`}
        message="It opens with the default columns."
        onConfirm={create}
      />
    </BaseModal>
  );
}
