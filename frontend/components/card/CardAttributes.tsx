"use client";

import { Calendar, Columns3, Flag, Tag, User as UserIcon, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { BaseAvatar } from "@/components/shared/BaseAvatar";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseCombobox, type ComboOption } from "@/components/shared/BaseCombobox";
import { BasePopover } from "@/components/shared/BasePopover";
import { RoleTag } from "@/components/shared/RoleTag";
import type { FieldState } from "@/hooks/useFieldSave";
import type { FieldKey } from "@/lib/autosave";
import { shortDate } from "@/lib/format";
import type { Category, Priority, Member } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DateRangePicker } from "./DateRangePicker";
import { FieldStatus } from "./FieldStatus";

export interface AttributeValues {
  priority: Priority;
  category_id: string;
  start_date: string;
  end_date: string;
  assignee_id: string;
}

interface CardAttributesProps {
  value: AttributeValues;
  onChange: (patch: Partial<AttributeValues>) => void;
  categories: Category[];
  members: Member[];
  /** The Card's own assignee name and avatar, for an assignee who is no longer on the member list. */
  assigneeFallback?: { name: string; avatar_url: string | null; inactive?: boolean; unavailable?: boolean } | null;
  columnName?: string;
  /** May change category, priority, and dates. */
  canEdit: boolean;
  /** May change the assignee (Supervisor, Manager, Admin). */
  canAssign: boolean;
  overdue: boolean;
  /** Save state per field, shown beside it (Auto_Save). */
  status?: Partial<Record<FieldKey, FieldState>>;
  onRetry?: (field: FieldKey) => void;
  /** The dates popover closed: save the pair if it changed and is valid. */
  onDatesClose?: () => void;
}

const PRIORITY_COLOR: Record<Priority, string> = { high: "text-label-red-fg", medium: "text-label-orange-fg", low: "text-label-green-fg" };
const PRIORITIES: Priority[] = ["high", "medium", "low"];

const row = "h-auto min-h-control-sm w-auto justify-start gap-2 rounded-ui px-4 text-sm font-medium text-ink";

/** The icon and the text of one attribute row; every row has the same height, font, and icon size. */
function RowContent({ icon: Icon, iconClass, lead, children }: { icon: LucideIcon; iconClass?: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <>
      {lead ?? <Icon className={cn("size-icon shrink-0 text-ink-muted", iconClass)} aria-hidden="true" />}
      <span className="min-w-0 flex-1 truncate text-left">{children}</span>
    </>
  );
}

function StaticRow({ icon, iconClass, lead, label, children, danger }: { icon: LucideIcon; iconClass?: string; lead?: ReactNode; label: string; children: ReactNode; danger?: boolean }) {
  return (
    <div role="group" aria-label={label} className={cn("flex min-h-control-sm w-fit max-w-full items-center gap-2 rounded-ui border border-line px-4 text-sm font-medium", danger && "text-danger")}>
      <RowContent icon={icon} iconClass={iconClass} lead={lead}>
        {children}
      </RowContent>
    </div>
  );
}

/** The attribute chip row (CM-02): status (read-only), priority, assignee, dates, and category as pills; each editable chip opens a select or a popover and saves on its own. */
export function CardAttributes({ value, onChange, categories, members, assigneeFallback, columnName, canEdit, canAssign, overdue, status = {}, onRetry, onDatesClose }: CardAttributesProps) {
  const state = (field: FieldKey) => <FieldStatus field={field} state={status[field]} onRetry={onRetry ? () => onRetry(field) : undefined} />;
  const [datesOpen, setDatesOpen] = useState(false);
  const category = categories.find((c) => c.id === value.category_id);
  const assignee = members.find((m) => m.id === value.assignee_id);
  const dateLabel =
    value.start_date && value.end_date
      ? `${shortDate(value.start_date)} – ${shortDate(value.end_date)}`
      : value.end_date
        ? `Due ${shortDate(value.end_date)}`
        : value.start_date
          ? `Starts ${shortDate(value.start_date)}`
          : "No dates";

  const categoryOptions: ComboOption[] = [{ value: "", label: "No label" }, ...categories.map((c) => ({ value: c.id, label: c.name, render: <span className="lowercase">{c.name}</span> }))];
  const priorityOptions: ComboOption[] = PRIORITIES.map((p) => ({
    value: p,
    label: p[0].toUpperCase() + p.slice(1),
    render: (
      <span className="flex items-center gap-2">
        <Flag className={cn("size-icon-sm", PRIORITY_COLOR[p])} aria-hidden="true" />
        <span className="capitalize">{p}</span>
      </span>
    ),
  }));
  const memberOptions: ComboOption[] = [
    { value: "", label: "Unassigned" },
    ...members.map((m) => ({
      value: m.id,
      label: m.full_name,
      keywords: [m.username, ...(m.role ? [m.role] : []), ...(m.email ? [m.email] : [])],
      render: (
        <span className="flex items-center gap-3">
          <BaseAvatar name={m.full_name} src={m.avatar_url} size="md" />
          <span className="min-w-0 flex-1">
            <span className="block truncate">{m.full_name}</span>
            {m.email && <span className="block truncate text-xs text-ink-muted">{m.email}</span>}
          </span>
          {m.role && <RoleTag role={m.role} />}
        </span>
      ),
    })),
  ];

  const priorityName = value.priority[0].toUpperCase() + value.priority.slice(1);
  const categoryText = category?.name ?? "No label";
  const assigneeName = assignee?.full_name ?? (value.assignee_id && assigneeFallback ? assigneeFallback.name : null);
  const assigneeText = assigneeName ?? "Unassigned";
  const assigneeLead = assigneeName ? <BaseAvatar name={assigneeName} src={assignee?.avatar_url ?? assigneeFallback?.avatar_url} inactive={assigneeFallback?.inactive} unavailable={assigneeFallback?.unavailable} /> : undefined;

  return (
    <div role="group" aria-label="Card attributes" className="flex flex-wrap items-start gap-2">
      <div className="flex min-w-0 flex-col gap-1">
      {canEdit ? (
        <BaseCombobox
          label="Priority"
          options={priorityOptions}
          value={value.priority}
          onChange={(v) => onChange({ priority: v as Priority })}
          trigger={
            <BaseButton variant="secondary" className={row} aria-label={`Priority: ${priorityName}`}>
              <RowContent icon={Flag} iconClass={PRIORITY_COLOR[value.priority]}>
                {priorityName}
              </RowContent>
            </BaseButton>
          }
        />
      ) : (
        <StaticRow icon={Flag} iconClass={PRIORITY_COLOR[value.priority]} label={`Priority: ${priorityName}`}>
          {priorityName}
        </StaticRow>
      )}
      {state("priority")}
      </div>

      <div className="flex min-w-0 flex-col gap-1">
      {canAssign ? (
        <BaseCombobox
          label="Assignee"
          wide
          options={memberOptions}
          value={value.assignee_id}
          searchable
          onChange={(v) => onChange({ assignee_id: v })}
          trigger={
            <BaseButton variant="secondary" className={row} aria-label={`Assignee: ${assigneeText}`}>
              <RowContent icon={UserIcon} lead={assigneeLead}>
                {assigneeText}
              </RowContent>
            </BaseButton>
          }
        />
      ) : (
        <StaticRow icon={UserIcon} lead={assigneeLead} label={`Assignee: ${assigneeText}`}>
          {assigneeText}
        </StaticRow>
      )}
      {state("assignee_id")}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
      {canEdit ? (
        <BasePopover
          wide
          label="Choose dates"
          open={datesOpen}
          onOpenChange={(next) => {
            setDatesOpen(next);
            if (!next) onDatesClose?.();
          }}
          trigger={
            <BaseButton variant="secondary" className={cn(row, overdue && "border-danger text-danger")} aria-label={`Dates: ${dateLabel}${overdue ? ", overdue" : ""}`}>
              <RowContent icon={Calendar} iconClass={overdue ? "text-danger" : undefined}>
                {dateLabel}
              </RowContent>
            </BaseButton>
          }
        >
          <DateRangePicker value={{ start: value.start_date, end: value.end_date }} onChange={(r) => onChange({ start_date: r.start, end_date: r.end })} />
        </BasePopover>
      ) : (
        <StaticRow icon={Calendar} label={`Dates: ${dateLabel}`} danger={overdue}>
          {dateLabel}
        </StaticRow>
      )}
      {state("dates")}
      </div>

      <div className="flex min-w-0 flex-col gap-1">
      {canEdit ? (
        <BaseCombobox
          label="Label"
          options={categoryOptions}
          value={value.category_id}
          onChange={(v) => onChange({ category_id: v })}
          trigger={
            <BaseButton variant="secondary" className={row} aria-label={`Label: ${categoryText}`}>
              <RowContent icon={Tag}><span className="lowercase">{categoryText}</span></RowContent>
            </BaseButton>
          }
        />
      ) : (
        <StaticRow icon={Tag} label={`Label: ${categoryText}`}>
          <span className="lowercase">{categoryText}</span>
        </StaticRow>
      )}
      {state("category_id")}
      </div>

    </div>
  );
}
