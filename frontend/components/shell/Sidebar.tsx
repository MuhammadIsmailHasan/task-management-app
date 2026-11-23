"use client";

import { Activity, Bell, Home, LogIn, Plus, Tags, UserCog, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { BaseAvatar } from "@/components/shared/BaseAvatar";
import { RoleTag } from "@/components/shared/RoleTag";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseConfirm } from "@/components/shared/BaseConfirm";
import { BaseModal } from "@/components/shared/BaseModal";
import { BasePopover } from "@/components/shared/BasePopover";
import { BaseTooltip } from "@/components/shared/BaseTooltip";
import { useDesktop } from "@/hooks/useDesktop";
import { useSidebarState } from "@/hooks/useSidebarState";
import { api } from "@/lib/api";
import type { Board, Member } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MemberSearch } from "./MemberSearch";
import { NewBoardModal } from "./NewBoardModal";
import { useShell } from "./ShellContext";

interface SidebarProps {
  boards: Board[];
  open: boolean;
  onNavigate: () => void;
}

const navItem =
  "flex min-h-control w-full items-center gap-3 rounded-sm px-3 text-sm font-medium text-ink-muted no-underline transition-colors duration-fast hover:bg-surface hover:text-ink focus-ring [&_svg]:size-icon [&_svg]:shrink-0";
const navActive = "bg-brand-tint text-brand";

interface NavItemProps {
  label: string;
  icon: LucideIcon;
  collapsed: boolean;
  href?: string;
  active?: boolean;
  badge?: number;
  onClick?: () => void;
}

/** One navigation entry: icon and label; collapsed (desktop only) it is icon-only and the label becomes a tooltip. */
function NavItem({ label, icon: Icon, collapsed, href, active, badge, onClick }: NavItemProps) {
  const inner = (
    <>
      <Icon aria-hidden="true" />
      <span className={cn("flex-1 text-left", collapsed && "lg:sr-only")}>{label}</span>
      {!!badge && (
        <span aria-label={`${badge} unread`} className={cn("rounded-full bg-danger px-2 text-2xs font-semibold text-on-brand", collapsed && "lg:absolute lg:top-1 lg:right-1 lg:size-alert-dot lg:p-0 lg:text-transparent")}>
          {badge}
        </span>
      )}
    </>
  );
  const el = href ? (
    <Link href={href} aria-current={active ? "page" : undefined} onClick={onClick} className={cn(navItem, "relative", active && navActive, collapsed && "lg:justify-center lg:px-0")}>
      {inner}
    </Link>
  ) : (
    <BaseButton variant="ghost" onClick={onClick} className={cn(navItem, "relative justify-start", collapsed && "lg:justify-center lg:px-0")}>
      {inner}
    </BaseButton>
  );
  return collapsed ? (
    <BaseTooltip label={label} side="right">
      {el}
    </BaseTooltip>
  ) : (
    el
  );
}

function SectionHead({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-control-sm items-center justify-between px-3 text-2xs font-semibold tracking-wide text-ink-muted uppercase">
      <span>{children}</span>
      {action}
    </div>
  );
}

/** Navigation with labels (expanded) or icons and tooltips (collapsed), plus the boards and team members when expanded. */
export function Sidebar({ boards, open, onNavigate }: SidebarProps) {
  const { session, user, boardId, inbox, toggleSidePanel } = useShell();
  const router = useRouter();
  const pathname = usePathname();
  const desktop = useDesktop();
  const [collapsed, toggleCollapsed] = useSidebarState();
  const [members, setMembers] = useState<Member[]>([]);
  const [creating, setCreating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [membersVersion, setMembersVersion] = useState(0);
  const role = session?.role;
  const current = boards.find((b) => b.id === boardId) ?? null;
  const canCategories = role === "supervisor" || role === "manager" || role === "admin";
  const isStaff = role === "manager" || role === "admin";
  const canAddMembers = isStaff;
  const canRemoveMembers = isStaff || (!!session && current?.owner_id === session.userId);
  const canCreateBoard = role === "manager" || role === "admin";

  useEffect(() => {
    if (!boardId) {
      setMembers([]);
      return;
    }
    let live = true;
    api.boards
      .members(boardId)
      .then((m) => live && setMembers(m))
      .catch(() => live && setMembers([]));
    return () => {
      live = false;
    };
  }, [boardId, membersVersion]);

  const search = boardId && <MemberSearch boardId={boardId} onAdded={() => { setAdding(false); setMembersVersion((v) => v + 1); }} />;
  const addButton = (
    <BaseButton variant="ghost" size="sm" className="size-control-sm px-0" aria-label="Add member">
      <Plus aria-hidden="true" />
    </BaseButton>
  );

  return (
    <aside
      aria-label="Sidebar"
      data-collapsed={collapsed}
      className={cn(
        "fixed inset-y-0 left-0 z-sidebar flex w-sidebar shrink-0 flex-col border-r border-line bg-surface-raised transition-transform duration-base ease-out",
        "lg:relative lg:translate-x-0 lg:transition-all",
        collapsed && "lg:w-rail",
        open ? "translate-x-0 shadow-panel lg:shadow-none" : "-translate-x-full",
      )}
    >
      <nav aria-label="Main" className="flex shrink-0 flex-col gap-1 p-3">
        <div className="mb-3 flex items-center gap-3">
          <BaseTooltip label={collapsed ? "RevoBoard" : "Collapse sidebar"} side="right">
            <BaseButton
              variant="ghost"
              className="hidden h-auto min-h-control shrink-0 px-0 lg:inline-flex"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              onClick={toggleCollapsed}
            >
              {collapsed ? <BrandLogo variant="mark" size="sm" decorative /> : <BrandLogo variant="full" size="md" decorative />}
            </BaseButton>
          </BaseTooltip>
          <BrandLogo variant="full" size="md" className="lg:hidden" />
        </div>
        {session ? (
          <>
            <NavItem label="Home" icon={Home} collapsed={collapsed} href="/boards" active={pathname === "/boards"} onClick={onNavigate} />
            <NavItem label="Activity" icon={Activity} collapsed={collapsed} onClick={() => { toggleSidePanel("activity"); onNavigate(); }} />
            <NavItem label="Inbox" icon={Bell} collapsed={collapsed} badge={inbox?.unread_count} onClick={() => { toggleSidePanel("inbox"); onNavigate(); }} />
          </>
        ) : (
          <NavItem label="Log in" icon={LogIn} collapsed={collapsed} href="/login" onClick={onNavigate} />
        )}
        {canCategories && boardId && <NavItem label="Categories" icon={Tags} collapsed={collapsed} href={`/boards/${boardId}/categories`} active={pathname.endsWith("/categories")} onClick={onNavigate} />}
        {role === "admin" && <NavItem label="Users" icon={UserCog} collapsed={collapsed} href="/admin/users" active={pathname.startsWith("/admin/users")} onClick={onNavigate} />}
        {canCreateBoard && collapsed && <NavItem label="New board" icon={Plus} collapsed={collapsed} onClick={() => setCreating(true)} />}
      </nav>

      <div className={cn("flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto border-t border-line p-3", collapsed && "lg:hidden")}>
        <section aria-label="Boards" className="flex flex-col gap-1">
          <SectionHead>Boards</SectionHead>
          {boards.length === 0 && <p className="px-3 text-xs text-ink-muted">No boards yet.</p>}
          {boards.map((b) => (
            <Link
              key={b.id}
              href={`/boards/${b.id}`}
              title={b.name}
              aria-current={b.id === boardId ? "page" : undefined}
              onClick={onNavigate}
              className={cn(
                "flex min-h-control items-start gap-3 rounded-sm px-3 py-2 text-sm font-normal break-words text-ink no-underline transition-colors duration-fast hover:bg-surface focus-ring",
                b.id === boardId && "bg-brand font-medium text-on-brand hover:bg-brand-strong",
              )}
            >
              <span className="min-w-0">{b.name}</span>
            </Link>
          ))}
        </section>

        {boardId && (
          <section aria-label="Team members" className="flex flex-col gap-1">
            <SectionHead
              action={
                canAddMembers &&
                (desktop ? (
                  <BasePopover wide label="Add a member" open={adding} onOpenChange={setAdding} trigger={addButton}>
                    {search}
                  </BasePopover>
                ) : (
                  <>
                    <BaseButton variant="ghost" size="sm" className="size-control-sm px-0" aria-label="Add member" onClick={() => setAdding(true)}>
                      <Plus aria-hidden="true" />
                    </BaseButton>
                    <BaseModal open={adding} title="Add a member" onClose={() => setAdding(false)}>
                      {search}
                    </BaseModal>
                  </>
                ))
              }
            >
              Team members
            </SectionHead>
            {members.length === 0 && <p className="px-3 text-xs text-ink-muted">No members yet.</p>}
            {members.map((m) => (
              <div key={m.id} className="flex min-h-control items-center gap-3 rounded-sm px-3 py-2">
                <BaseAvatar name={m.full_name} src={m.avatar_url} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-meta font-medium break-words">
                    {m.full_name}
                    {m.is_owner && <span className="rounded-sm bg-brand-tint px-2 text-2xs font-semibold text-brand">Owner</span>}
                    {m.role && <RoleTag role={m.role} />}
                  </div>
                  <div className="truncate text-xs text-ink-muted">{m.username}</div>
                </div>
                {canRemoveMembers && !m.is_owner && (
                  <BaseConfirm
                    message={`Remove ${m.full_name} from this board?`}
                    confirmLabel="Remove"
                    onConfirm={async () => {
                      await api.boards.removeMember(boardId, m.id);
                      setMembersVersion((v) => v + 1);
                    }}
                    trigger={
                      <BaseButton variant="ghost" size="sm" className="size-control-sm shrink-0 px-0" aria-label={`Remove ${m.full_name}`}>
                        <X aria-hidden="true" />
                      </BaseButton>
                    }
                  />
                )}
              </div>
            ))}
          </section>
        )}

        {canCreateBoard && (
          <BaseButton variant="secondary" className="rule-dashed mt-auto w-full text-brand" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" />
            Add Board
          </BaseButton>
        )}
      </div>

      <NewBoardModal open={creating} onClose={() => setCreating(false)} />
    </aside>
  );
}
