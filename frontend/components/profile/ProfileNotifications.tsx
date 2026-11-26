"use client";

import { useEffect, useState } from "react";
import { BaseAlert } from "@/components/shared/BaseField";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseSwitch } from "@/components/shared/BaseSwitch";
import { api } from "@/lib/api";
import type { NotificationPreference, PreferenceType } from "@/lib/types";

const COPY: Record<PreferenceType, { title: string; text: string }> = {
  comment_on_assigned: { title: "Comments", text: "Someone comments on a card assigned to you." },
  due_today: { title: "Due today", text: "A card assigned to you is due today." },
  due_tomorrow: { title: "Due tomorrow", text: "A card assigned to you is due tomorrow." },
  assigned_card_changed: { title: "Card moved, archived, or deleted", text: "Someone else moves, archives, or deletes a card assigned to you." },
  subtask_on_assigned: { title: "Subtasks", text: "Someone adds, changes, or removes a subtask on a card assigned to you." },
};

type Status = "saving" | "saved" | "error";

/** One switch per type, each saved at once with its own status, rolled back on failure (PRF-06, NPF-07). In-app only. */
export function ProfileNotifications() {
  const [prefs, setPrefs] = useState<NotificationPreference[] | null>(null);
  const [status, setStatus] = useState<Partial<Record<PreferenceType, Status>>>({});
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let live = true;
    api.notifications
      .preferences()
      .then((r) => live && setPrefs(r.preferences))
      .catch(() => live && setLoadError(true));
    return () => {
      live = false;
    };
  }, []);

  async function change(type: PreferenceType, enabled: boolean) {
    const before = prefs;
    setPrefs((all) => all?.map((p) => (p.type === type ? { ...p, enabled } : p)) ?? all);
    setStatus((s) => ({ ...s, [type]: "saving" }));
    try {
      await api.notifications.savePreferences([{ type, enabled }]);
      setStatus((s) => ({ ...s, [type]: "saved" }));
    } catch {
      setPrefs(before);
      setStatus((s) => ({ ...s, [type]: "error" }));
    }
  }

  if (loadError) return <BaseAlert>Could not load your notification settings.</BaseAlert>;
  if (!prefs) return <p className="text-sm text-ink-muted">Loading…</p>;

  return (
    <section aria-label="Notification settings" className="flex flex-col gap-4 rounded-ui border border-line bg-surface-raised p-surface">
      <p className="text-sm text-ink-muted">These control in-app notifications only.</p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {prefs.map((p) => {
          const copy = COPY[p.type];
          const st = status[p.type];
          return (
            <li key={p.type} className="flex items-center gap-4 rounded-ui border border-line p-item">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{copy.title}</div>
                <div className="text-xs text-ink-muted">{copy.text}</div>
                <div role="status" aria-live="polite" className="text-xs">
                  {st === "saving" && <span className="text-ink-muted">Saving…</span>}
                  {st === "saved" && <span className="text-accent">Saved</span>}
                  {st === "error" && (
                    <span className="text-danger">
                      Could not save.{" "}
                      <BaseButton variant="ghost" size="sm" className="h-auto min-h-0 px-1 py-0 text-xs underline" onClick={() => void change(p.type, !p.enabled)}>
                        Retry
                      </BaseButton>
                    </span>
                  )}
                </div>
              </div>
              <BaseSwitch label={copy.title} checked={p.enabled} onCheckedChange={(v) => void change(p.type, v)} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
