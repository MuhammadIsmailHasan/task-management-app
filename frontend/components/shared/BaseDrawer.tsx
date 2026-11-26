"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

interface BaseDrawerProps {
  open: boolean;
  onClose: () => void;
  /** The drawer's accessible name. */
  title: string;
  children: ReactNode;
}

/** An off-canvas panel from the left behind a scrim: focus trap, Escape, and focus return come from the Radix Dialog. */
export function BaseDrawer({ open, onClose, title, children }: BaseDrawerProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-scrim bg-scrim backdrop-blur-overlay data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 lg:hidden" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-sidebar flex w-sidebar max-w-full flex-col gap-4 overflow-y-auto bg-surface-raised p-4 shadow-panel focus:outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-left data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left lg:hidden"
        >
          <div className="flex items-center justify-between">
            <DialogPrimitive.Title className="font-heading text-page-title">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close aria-label="Close menu" className="inline-flex size-control touch-target items-center justify-center rounded-ui text-ink-muted hover:bg-surface-sunken hover:text-ink focus-ring">
              <X className="size-icon" aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
