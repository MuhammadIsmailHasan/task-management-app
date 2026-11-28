"use client";

import { Toaster } from "sonner";

const NEUTRAL = "!border-line !bg-surface-raised !text-ink";

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
          toast: "!rounded-ui !border !shadow-popover !font-sans !text-sm",
          default: NEUTRAL,
          success: NEUTRAL,
          info: NEUTRAL,
          error: "!border-danger-soft !bg-danger-soft !text-on-danger-soft",
          warning: "!border-warning-soft !bg-warning-soft !text-on-warning-soft",
          closeButton: "!bg-surface-raised !border-line !text-ink-muted",
        },
      }}
      aria-label="Notifications"
    />
  );
}
