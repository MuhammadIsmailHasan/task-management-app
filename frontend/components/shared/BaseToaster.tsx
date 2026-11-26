"use client";

import { Toaster } from "sonner";

/** The one Toaster (TOAST-01 to TOAST-05): bottom right, at most 3 visible, tokens only. */
export function BaseToaster() {
  return (
    <Toaster
      position="bottom-right"
      visibleToasts={3}
      closeButton
      duration={4000}
      toastOptions={{
        duration: 4000,
        classNames: {
          toast: "!rounded-ui !border !border-line !bg-surface-raised !text-ink !shadow-popover !font-sans !text-sm",
          error: "!text-ink",
          closeButton: "!bg-surface-raised !border-line !text-ink-muted",
        },
      }}
      aria-label="Notifications"
    />
  );
}
