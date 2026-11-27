"use client";

import { Toaster } from "sonner";

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
