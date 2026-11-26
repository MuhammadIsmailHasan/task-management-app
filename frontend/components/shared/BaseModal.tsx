"use client";

import type { ReactNode } from "react";
import { Dialog, DialogCloseButton, DialogContent, DialogFooter, DialogHeader, DialogTitle, type DialogSize } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface BaseModalProps {
  open: boolean;
  /** A string, or a node (for example "Card | Board"); it is the dialog's accessible name. */
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** "wide" is a roomy dialog; "card" is the tall two-pane Card modal; "full" fills the viewport minus a margin. */
  size?: DialogSize;
  /** Buttons of the modal, rendered in a bordered bar under the body. */
  footer?: ReactNode;
  /** Keep the title for screen readers only (the body carries its own heading). */
  titleHidden?: boolean;
  /** Content beside the title in the header. */
  headerAside?: ReactNode;
  /** When false the body does not scroll itself, so panes inside it can. */
  scrollBody?: boolean;
  /** Id of the element that describes the dialog (`aria-describedby`). */
  describedBy?: string;
  /** Called when the dialog opens; call `preventDefault` and focus an element of your own to choose the first focus. */
  onOpenAutoFocus?: (event: Event) => void;
  /** Called when the dialog closes; call `preventDefault` and focus the control that opened it. */
  onCloseAutoFocus?: (event: Event) => void;
}

/** The only modal in the app: a thin wrapper over the shadcn/ui Dialog (Radix: focus trap, Escape, ARIA). */
export function BaseModal({ open, title, onClose, children, size = "md", footer, titleHidden = false, headerAside, scrollBody = true, describedBy, onOpenAutoFocus, onCloseAutoFocus }: BaseModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent size={size} aria-describedby={describedBy} onOpenAutoFocus={onOpenAutoFocus} onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle className={cn(titleHidden && "sr-only")}>{title}</DialogTitle>
          {headerAside}
          <DialogCloseButton />
        </DialogHeader>
        <div className={cn("min-h-0 flex-1 px-6 pb-6", scrollBody ? "overflow-y-auto" : "flex flex-col overflow-hidden")}>{children}</div>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
