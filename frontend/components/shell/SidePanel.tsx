"use client";

import { Bell, History, Tags, Users, X } from "lucide-react";
import { BaseButton } from "@/components/shared/BaseButton";
import { cn } from "@/lib/utils";
import { ActivityView } from "./ActivityView";
import { InboxView } from "./InboxView";
import type { PanelView } from "./ShellContext";
import { CategoriesView } from "./CategoriesView";
import { MembersView } from "./MembersView";

interface SidePanelProps {
  view: PanelView | null;
  onClose: () => void;
}

const TITLE: Record<PanelView, string> = { inbox: "Inbox", activity: "Activity", members: "Members", categories: "Categories" };
const ICON = { inbox: Bell, activity: History, members: Users, categories: Tags } as const;

/** A floating panel on the right, inset from the viewport; one panel hosts Inbox, Activity, Members, and Categories (SHELL-26, NAV-07). */
export function SidePanel({ view, onClose }: SidePanelProps) {
  const shown = view ?? "inbox";
  const Icon = ICON[shown];
  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn("fixed inset-0 z-panel-scrim bg-scrim backdrop-blur-overlay transition-opacity duration-base", view ? "opacity-100" : "pointer-events-none opacity-0")}
      />
      <aside
        aria-label={TITLE[shown]}
        aria-hidden={!view}
        className={cn(
          "fixed inset-y-0 right-0 z-panel flex w-full flex-col bg-surface-raised shadow-panel transition-transform duration-slow ease-out lg:inset-y-page lg:right-page lg:w-side lg:max-w-full lg:rounded-ui",
          view ? "translate-x-0" : "invisible translate-x-full",
        )}
      >
        <div className="flex items-center gap-3 p-6 pb-4">
          <span aria-hidden="true" className="inline-flex size-control shrink-0 items-center justify-center rounded-ui bg-accent-tint text-on-accent-tint">
            <Icon className="size-icon" />
          </span>
          <h2 className="min-w-0 flex-1 font-heading text-page-title">{TITLE[shown]}</h2>
          <BaseButton variant="ghost" size="sm" className="size-control-sm px-0" onClick={onClose} aria-label="Close panel">
            <X aria-hidden="true" />
          </BaseButton>
        </div>
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 pb-4">
          {view === "inbox" && <InboxView />}
          {view === "activity" && <ActivityView />}
          {view === "members" && <MembersView />}
          {view === "categories" && <CategoriesView />}
        </div>
      </aside>
    </>
  );
}
