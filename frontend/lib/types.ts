export type Role = "member" | "supervisor" | "manager" | "admin";
export type Priority = "high" | "medium" | "low";

export interface User {
  id: string;
  full_name: string;
  username: string;
  email: string;
  avatar_url: string | null;
  role?: Role;
  is_active?: boolean;
  is_available?: boolean;
  pending_email?: string | null;
}

export interface Member {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string | null;
  email?: string;
  is_owner?: boolean;
  role?: "member" | "supervisor";
  is_active?: boolean;
  is_available?: boolean;
}

export interface AuthResult {
  user: User;
  token: string | null;
}

export interface Column {
  id: string;
  board_id: string;
  name: string;
  order: number;
}

export interface Board {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  card_count?: number;
  done_count?: number;
  overdue_count?: number;
  member_count?: number;
  owner_id: string | null;
  archived_at: string | null;
  columns?: Column[];
}

export interface Subtask {
  id: string;
  card_id: string;
  title: string;
  is_done: boolean;
  order: number;
  created_by_id?: string | null;
  can_edit?: boolean;
}

export interface Attachment {
  id: string;
  card_id: string;
  name: string;
  mime_type: string | null;
  url: string | null;
  file_url: string | null;
  expires_at: string | null;
  created_by_id?: string | null;
  can_edit?: boolean;
}

export interface Comment {
  id: string;
  card_id: string;
  author_id: string;
  parent_id: string | null;
  author_name?: string | null;
  author_avatar_url?: string | null;
  content: string;
  is_priority: boolean;
  reply_count: number;
  created_at: string;
  can_create_card: boolean;
  replies?: Comment[];
}

export interface ActivityEntry {
  id: string;
  actor_id: string;
  actor_name?: string | null;
  action: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export type DueState = "overdue" | "due_tomorrow" | null;

export interface Card {
  id: string;
  column_id: string | null;
  category_id: string | null;
  assignee_id: string | null;
  assignee_name?: string | null;
  assignee_avatar_url?: string | null;
  assignee_is_active?: boolean | null;
  assignee_is_available?: boolean | null;
  title: string;
  description: string | null;
  priority: Priority;
  start_date: string | null;
  end_date: string | null;
  order: number;
  archived_at: string | null;
  due_state?: DueState;
  subtasks: Subtask[];
  progress?: number | null;
  subtask_done_count?: number;
  subtask_total_count?: number;
  attachments: Attachment[];
  comments?: Comment[];
  activity?: ActivityEntry[];
}

export interface Category {
  id: string;
  board_id: string;
  name: string;
  color: string | null;
}

export type NotificationType =
  | "assigned"
  | "deadline"
  | "comment_on_assigned"
  | "due_today"
  | "due_tomorrow"
  | "assigned_card_changed"
  | "subtask_on_assigned"
  | "board_join_requested"
  | "board_added"
  | "board_join_rejected";

export interface Notification {
  id: string;
  type: NotificationType;
  board_id: string | null;
  board_slug: string | null;
  board_name: string | null;
  card_id: string | null;
  card_title: string | null;
  actor_name: string | null;
  action?: "moved" | "archived" | "deleted" | null;
  is_read: boolean;
  notify_date: string;
  created_at: string | null;
}

export interface Inbox {
  items: Notification[];
  unread_count: number;
}

export interface Analytics {
  board_id: string;
  name: string;
  total: number;
  done: number;
  in_progress: number;
  overdue: number;
  done_delta: number;
}

export interface ThroughputWeek {
  week_start: string;
  done: number;
}

export interface Throughput {
  board_id: string;
  name: string;
  weeks: ThroughputWeek[];
  total: number;
}

export interface SharedBoard {
  id: string;
  name: string;
  description: string | null;
  columns: Column[];
  has_board_access: boolean;
}

export interface SharedCard extends Omit<Card, "comments" | "activity" | "assignee_avatar_url"> {
  assignee_name: string | null;
}

export interface InviteState {
  enabled: boolean;
  token: string | null;
  path: string | null;
}

export interface InviteLookup {
  board: { id: string; slug: string; name: string; description: string | null };
  state: "staff" | "member" | "pending" | "can_request";
  request: { id: string; status: string } | null;
}

export interface JoinRequest {
  id: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  user: { id: string; full_name: string; username: string; email: string; avatar_url: string | null };
}

export type PreferenceType = "comment_on_assigned" | "due_today" | "due_tomorrow" | "assigned_card_changed" | "subtask_on_assigned";

export interface NotificationPreference {
  type: PreferenceType;
  enabled: boolean;
}

export interface TaskCard {
  id: string;
  title: string;
  board_id: string;
  board_slug: string;
  board_name: string;
  priority: Priority;
  end_date: string | null;
  due_state: DueState;
  assignee_name?: string | null;
  category?: { id: string; name: string; color: string | null } | null;
}

export type MyTaskGroupKey = "overdue" | "today" | "tomorrow" | "this_week" | "later" | "no_due";

export interface MyCards {
  today: string;
  groups: { key: MyTaskGroupKey; cards: TaskCard[] }[];
}

export interface DashboardData {
  range: { from: string; to: string };
  today: string;
  overview: { total: number; done: number; in_progress: number; overdue: number };
  throughput: { weeks: { week_start: string; done: number }[]; total: number };
  overdue: { count: number; cards: TaskCard[] };
  due_tomorrow: { count: number; due_on: string; cards: TaskCard[] };
  top_priority: { cards: TaskCard[] };
  finished: { on_time: number; overdue: number };
  members: { id: string; full_name: string; avatar_url: string | null }[];
}
