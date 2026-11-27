"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogClose = DialogPrimitive.Close;

const shieldedContent = new WeakSet<Element>();

export function insideEditorUi(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest(".tox-tinymce-aux, .tox-dialog-wrap, .tox-menu, .tox-pop");
}

export type DialogSize = "md" | "wide" | "card" | "full";

const SIZE: Record<DialogSize, string> = {
  md: "inset-page m-auto h-fit max-h-full max-w-modal",
  wide: "inset-page m-auto h-fit max-h-full max-w-modal-wide",
  card: "inset-page w-auto",
  full: "inset-page w-auto",
};

export function DialogContent({
  className,
  children,
  size = "md",
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { size?: DialogSize }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-modal bg-scrim-strong backdrop-blur-overlay data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        ref={(node) => {
          if (!node || shieldedContent.has(node)) return;
          shieldedContent.add(node);
          node.addEventListener("focusout", (event) => {
            if (insideEditorUi((event as FocusEvent).relatedTarget)) event.stopPropagation();
          });
        }}
        className={cn(
          "fixed z-modal flex w-full flex-col overflow-hidden rounded-ui bg-surface-raised shadow-modal focus:outline-none",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          SIZE[size],
          className,
        )}
        {...props}
        onPointerDownOutside={(e) => {
          if (insideEditorUi(e.target)) e.preventDefault();
          props.onPointerDownOutside?.(e);
        }}
        onInteractOutside={(e) => {
          if (insideEditorUi(e.target)) e.preventDefault();
          props.onInteractOutside?.(e);
        }}
        onFocusOutside={(e) => {
          if (insideEditorUi(e.target)) e.preventDefault();
          props.onFocusOutside?.(e);
        }}
        onEscapeKeyDown={(e) => {
          if (insideEditorUi(document.activeElement)) e.preventDefault();
          props.onEscapeKeyDown?.(e);
        }}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex shrink-0 items-center gap-3 px-surface py-4", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex shrink-0 flex-wrap items-center gap-2 border-t border-line bg-surface-raised px-surface py-4", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("min-w-0 flex-1 font-heading text-page-title break-words", className)} {...props} />;
}

export function DialogCloseButton() {
  return (
    <DialogPrimitive.Close
      aria-label="Close"
      className="ml-auto inline-flex size-control-sm touch-target shrink-0 items-center justify-center rounded-ui text-ink-muted transition-colors duration-fast hover:bg-surface-sunken hover:text-ink focus-ring"
    >
      <X className="size-icon" aria-hidden="true" />
    </DialogPrimitive.Close>
  );
}
