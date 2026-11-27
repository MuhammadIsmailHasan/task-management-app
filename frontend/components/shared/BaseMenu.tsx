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
  href?: string;
  onSelect?: () => void;
  disabled?: boolean;
  hint?: string;
}

interface BaseMenuProps {
  trigger: ReactNode;
  label: string;
  items: MenuEntry[];
  heading?: string;
  onCloseAutoFocus?: (event: Event) => void;
}

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
