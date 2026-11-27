"use client";

import { useState } from "react";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseAlert, BaseTextarea } from "@/components/shared/BaseField";
import { ApiError } from "@/lib/http";

interface CommentComposerProps {
  label?: string;
  submitLabel?: string;
  onSubmit: (content: string) => Promise<void>;
  onCancel?: () => void;
}

export function CommentComposer({ label = "Write a comment", submitLabel = "Comment", onSubmit, onCancel }: CommentComposerProps) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(text.trim());
      setText("");
    } catch (err) {
      setError(err instanceof ApiError ? (err.details?.content?.[0] ?? err.message) : "Could not post.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form method="post" className="flex flex-col gap-2" onSubmit={submit}>
      <label className="sr-only" htmlFor={`composer-${label}`}>
        {label}
      </label>
      <BaseTextarea id={`composer-${label}`} placeholder={label} value={text} onChange={(e) => setText(e.target.value)} />
      {error && <BaseAlert>{error}</BaseAlert>}
      <div className="flex items-center gap-2">
        <BaseButton type="submit" size="sm" disabled={busy || !text.trim()}>
          {submitLabel}
        </BaseButton>
        {onCancel && (
          <BaseButton size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </BaseButton>
        )}
      </div>
    </form>
  );
}
