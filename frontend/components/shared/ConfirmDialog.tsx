"use client";

import { cloneElement, useId, useRef, useState, type MouseEvent, type ReactElement, type ReactNode } from "react";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseModal } from "@/components/shared/BaseModal";
import { withoutErrorToast } from "@/lib/toast";

interface ConfirmDialogProps {
  trigger?: ReactElement<{ onClick?: (e: MouseEvent) => void }>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  message: string;
  confirmLabel?: string;
  title?: string;
  tone?: "danger" | "primary";
  detail?: ReactNode;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({ trigger, message, confirmLabel = "Delete", title, tone = "danger", detail, onConfirm, open: openProp, onOpenChange }: ConfirmDialogProps) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (next: boolean) => {
    if (next) opener.current = document.activeElement as HTMLElement | null;
    setOpenState(next);
    onOpenChange?.(next);
  };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyId = useId();
  const opener = useRef<HTMLElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  function close() {
    if (busy) return;
    setOpen(false);
    setError(null);
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await withoutErrorToast(async () => onConfirm());
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {trigger && cloneElement(trigger, { onClick: () => setOpen(true) })}
      <BaseModal
        open={open}
        title={title ?? `${confirmLabel}?`}
        onClose={close}
        describedBy={bodyId}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          opener.current?.focus();
        }}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (tone === "danger" ? cancelRef : confirmRef).current?.focus();
        }}
        footer={
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <BaseButton ref={cancelRef} variant="secondary" onClick={close}>
              Cancel
            </BaseButton>
            <BaseButton ref={confirmRef} variant={tone === "danger" ? "danger" : "primary"} disabled={busy} onClick={() => void confirm()}>
              {confirmLabel}
            </BaseButton>
          </div>
        }
      >
        <div id={bodyId} className="flex flex-col gap-2">
          <p className="text-sm break-words">{message}</p>
          {detail && <div className="text-sm text-ink-muted">{detail}</div>}
          <p role="alert" aria-live="polite" className="text-sm text-danger empty:hidden">
            {error}
          </p>
        </div>
      </BaseModal>
    </>
  );
}
