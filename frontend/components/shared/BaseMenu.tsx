"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface MenuEntry {
  label: string;
  icon?: LucideIcon;
  /** A link item; otherwise `onSelect` runs. */
  href?: string;
  onSelect?: () => void;
  /** Shown but not selectable; `hint` says why (the tooltip text and the title). */
  disabled?: boolean;
  hint?: string;
}

interface BaseMenuProps {
  /** The element that opens the menu; a single focusable element. */
  trigger: ReactNode;
  /** Accessible name of the menu itself. */
  label: string;
  items: MenuEntry[];
  /** A heading row, for example who is signed in. */
  heading?: string;
  /** Runs when the menu closes; call `preventDefault` to keep focus where the chosen item put it (an inline field, for example). */
  onCloseAutoFocus?: (event: Event) => void;
}

/** The only action menu in the app: a thin wrapper over the shadcn/ui DropdownMenu (Radix). */
export function BaseMenu({ trigger, label, items, heading, onCloseAutoFocus }: BaseMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent aria-label={label} onCloseAutoFocus={onCloseAutoFocus}>
        {heading && (
          <>
            <DropdownMenuLabel>{heading}</DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        {items.map(({ label: text, icon: Icon, href, onSelect, disabled, hint }) =>
          href ? (
            <DropdownMenuItem key={text} asChild>
              <Link href={href}>
                {Icon && <Icon aria-hidden="true" />}
                {text}
              </Link>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem key={text} onSelect={onSelect} disabled={disabled} title={disabled ? hint : undefined}>
              {Icon && <Icon aria-hidden="true" />}
              {text}
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
