"use client";

import { useEffect, useRef, useState } from "react";
import { BaseAvatar } from "@/components/shared/BaseAvatar";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseConfirm } from "@/components/shared/BaseConfirm";
import { BaseAlert } from "@/components/shared/BaseField";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/http";
import type { User } from "@/lib/types";

export const MAX_AVATAR_BYTES = 2_097_152;
const TYPES = ["image/png", "image/jpeg", "image/webp"];

interface AvatarUploaderProps {
  user: User;
  onChange: (user: User) => void;
}

/** Choose, preview, upload, and remove the avatar. Type and size are checked here first; the server checks again by content. */
export function AvatarUploader({ user, onChange }: AvatarUploaderProps) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function choose(chosen: File | undefined) {
    setError(null);
    if (!chosen) return;
    if (!TYPES.includes(chosen.type)) return void setError("Choose a PNG, JPEG or WebP image.");
    if (chosen.size > MAX_AVATAR_BYTES) return void setError("The image must be 2 MB or smaller.");
    setFile(chosen);
  }

  function reset() {
    setFile(null);
    if (input.current) input.current.value = "";
  }

  async function upload() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await api.auth.uploadAvatar(file));
      reset();
    } catch (err) {
      setError(err instanceof ApiError ? (err.details?.file?.[0] ?? err.message) : "Could not upload the image.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    try {
      onChange(await api.auth.removeAvatar());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove the image.");
    }
  }

  return (
    <section aria-label="Avatar" className="flex flex-col gap-3">
      <h2 className="font-heading text-page-title">Avatar</h2>
      <div className="flex items-center gap-4">
        <BaseAvatar name={user.full_name} src={preview ?? user.avatar_url} size="md" className="size-touch" />
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={input}
            type="file"
            accept={TYPES.join(",")}
            aria-label="Choose image"
            className="sr-only"
            onChange={(e) => choose(e.target.files?.[0])}
          />
          <BaseButton variant="secondary" size="sm" onClick={() => input.current?.click()}>
            Choose image
          </BaseButton>
          {file && (
            <>
              <BaseButton size="sm" disabled={busy} onClick={() => void upload()}>
                {busy ? "Uploading…" : "Upload"}
              </BaseButton>
              <BaseButton variant="secondary" size="sm" onClick={reset}>
                Cancel
              </BaseButton>
            </>
          )}
          {!file && user.avatar_url && (
            <BaseConfirm
              message="Remove your avatar?"
              confirmLabel="Remove"
              onConfirm={remove}
              trigger={
                <BaseButton variant="secondary" size="sm">
                  Remove
                </BaseButton>
              }
            />
          )}
        </div>
      </div>
      <p className="text-xs text-ink-muted">PNG, JPEG or WebP, up to 2 MB.</p>
      {error && <BaseAlert>{error}</BaseAlert>}
    </section>
  );
}
