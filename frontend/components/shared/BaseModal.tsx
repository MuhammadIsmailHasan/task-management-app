"use client";

import type { ReactNode } from "react";
import { Dialog, DialogCloseButton, DialogContent, DialogFooter, DialogHeader, DialogTitle, type DialogSize } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface BaseModalProps {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  size?: DialogSize;
  footer?: ReactNode;
  titleHidden?: boolean;
  headerAside?: ReactNode;
  scrollBody?: boolean;
  describedBy?: string;
  onOpenAutoFocus?: (event: Event) => void;
  onCloseAutoFocus?: (event: Event) => void;
}

export function BaseModal({ open, title, onClose, children, size = "md", footer, titleHidden = false, headerAside, scrollBody = true, describedBy, onOpenAutoFocus, onCloseAutoFocus }: BaseModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent size={size} aria-describedby={describedBy} onOpenAutoFocus={onOpenAutoFocus} onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle className={cn(titleHidden && "sr-only")}>{title}</DialogTitle>
          {headerAside}
          <DialogCloseButton />
        </DialogHeader>
        <div className={cn("min-h-0 flex-1 px-surface pb-surface", scrollBody ? "overflow-y-auto" : "flex flex-col overflow-hidden")}>{children}</div>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
