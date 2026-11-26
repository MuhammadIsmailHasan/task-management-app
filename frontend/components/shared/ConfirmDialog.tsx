"use client";

import { cloneElement, useId, useRef, useState, type MouseEvent, type ReactElement, type ReactNode } from "react";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseModal } from "@/components/shared/BaseModal";
import { withoutErrorToast } from "@/lib/toast";

interface ConfirmDialogProps {
  /** The element that asks; it opens the dialog instead of acting. Focus returns to it on close. */
  trigger?: ReactElement<{ onClick?: (e: MouseEvent) => void }>;
  /** Controlled mode, for a form that asks on submit: pass both and no trigger. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** What will happen, naming the item ("Delete column “Review”?" is the title; this is the body). */
  message: string;
  /** Names the action and repeats the verb ("Delete", "Create"). */
  confirmLabel?: string;
  /** Dialog title; defaults to the confirm label with a question mark. */
  title?: string;
  /** "danger" for a delete or removal, "primary" for a create. */
  tone?: "danger" | "primary";
  /** Extra lines under the message. */
  detail?: ReactNode;
  onConfirm: () => void | Promise<void>;
}

/**
 * The one confirmation in the app (Requirement 45): a modal with a title, a body, Cancel, and a primary action.
 * It stays open with the error when the action fails, and closes only after it succeeded.
 */
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
          // Radix only restores focus to its own Trigger; ours is the element that was focused when we opened
          event.preventDefault();
          opener.current?.focus();
        }}
        onOpenAutoFocus={(event) => {
          // a delete starts on Cancel (the safe choice); a create starts on its primary action
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
