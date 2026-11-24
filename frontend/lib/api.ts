/** Typed client used by Client Components. Components never call fetch directly. */
import { ApiError, request, type RequestOptions } from "./http";
import { clearSession, getToken } from "./session";
import type {
  ActivityEntry,
  Analytics,
  AuthResult,
  Attachment,
  Board,
  Card,
  Category,
  Column,
  Comment,
  Inbox,
  InviteLookup,
  InviteState,
  JoinRequest,
  Notification,
  Priority,
  Member,
  SharedBoard,
  SharedCard,
  Subtask,
  Throughput,
  User,
} from "./types";

async function call<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  try {
    return await request<T>(method, path, { token: getToken(), ...opts });
  } catch (err) {
    if (err instanceof ApiError && err.httpStatus === 401 && typeof window !== "undefined" && getToken()) {
      // an expired or invalid Token: drop it and go to login (never loop on the login call itself)
      clearSession();
      window.location.assign("/login");
    }
    throw err;
  }
}

const get = <T>(path: string, query?: RequestOptions["query"]) => call<T>("GET", path, { query });
const pageQuery = (p: PageQuery) => ({ limit: p.limit === undefined ? undefined : String(p.limit), before: p.before });
const post = <T>(path: string, body?: unknown) => call<T>("POST", path, { body });
const patch = <T>(path: string, body?: unknown) => call<T>("PATCH", path, { body });
const del = <T>(path: string) => call<T>("DELETE", path);

export interface CardInput {
  title?: string;
  description?: string | null;
  priority?: Priority;
  start_date?: string | null;
  end_date?: string | null;
  category_id?: string | null;
  assignee_id?: string | null;
}

/** Paging for the Inbox and the activity lists (Decision J). */
export interface PageQuery {
  limit?: number;
  before?: string;
}

export interface Candidate extends Member {
  email: string;
}

export interface ShareState {
  enabled: boolean;
  token: string | null;
  path: string | null;
}

export interface CardFilters {
  search?: string;
  priority?: string;
  assignee?: string;
  category?: string;
}

export const api = {
  auth: {
    register: (body: { full_name: string; username: string; email: string; password: string }) =>
      request<AuthResult>("POST", "/auth/register", { body }),
    login: (body: { identifier: string; password: string }) => request<AuthResult>("POST", "/auth/login", { body }),
    availability: (q: { username?: string; email?: string }) =>
      request<{ username?: { available: boolean }; email?: { available: boolean } }>("GET", "/auth/availability", { query: q }),
    me: () => get<User>("/auth/me"),
    updateMe: (body: { full_name: string }) => patch<User>("/auth/me", body),
    changePassword: (body: { current_password: string; new_password: string }) => post<null>("/auth/change-password", body),
    uploadAvatar: (file: File) => {
      const form = new FormData();
      form.set("file", file);
      return call<User>("POST", "/users/me/avatar", { form });
    },
    removeAvatar: () => del<User>("/users/me/avatar"),
    /** Always clears the session and goes to /login, even when the call fails (Req 1.34). */
    logout: async () => {
      try {
        await request<null>("POST", "/auth/logout", { token: getToken() });
      } catch {
        /* the Token is discarded on the client either way */
      }
      clearSession();
      if (typeof window !== "undefined") window.location.assign("/login");
    },
  },
  shared: {
    board: (token: string) => request<SharedBoard>("GET", `/shared/${token}`, { token: getToken() }),
    cards: (token: string, f: { search?: string; category?: string } = {}) =>
      request<SharedCard[]>("GET", `/shared/${token}/cards`, { query: { search: f.search, "filter[category]": f.category } }),
    categories: (token: string) => request<Category[]>("GET", `/shared/${token}/categories`),
    attachmentUrl: (token: string, id: string) =>
      request<{ file_url: string | null; expires_at: string | null }>("GET", `/shared/${token}/attachments/${id}/url`),
  },
  boards: {
    list: () => get<Board[]>("/boards"),
    get: (id: string) => get<Board>(`/boards/${id}`),
    create: (body: { name: string; description?: string }) => post<Board>("/boards", body),
    update: (id: string, body: { name?: string; description?: string; owner_id?: string | null }) =>
      patch<Board>(`/boards/${id}`, body),
    members: (id: string, withEmail = false) => get<Member[]>(`/boards/${id}/members`, { include: withEmail ? "email" : undefined }),
    addMember: (id: string, userId: string) => post<Member>(`/boards/${id}/members`, { user_id: userId }),
    removeMember: (id: string, userId: string) => del<null>(`/boards/${id}/members/${userId}`),
    activity: (id: string, page: PageQuery = {}) => get<ActivityEntry[]>(`/boards/${id}/activity`, pageQuery(page)),
    candidates: (id: string, search: string) => get<Candidate[]>(`/boards/${id}/candidates`, { search: search || undefined }),
    addColumn: (id: string, name: string) => post<Column>(`/boards/${id}/columns`, { name }),
    share: (id: string) => get<ShareState>(`/boards/${id}/share`),
    enableShare: (id: string) => post<ShareState>(`/boards/${id}/share`),
    regenerateShare: (id: string) => post<ShareState>(`/boards/${id}/share/regenerate`),
    disableShare: (id: string) => del<ShareState>(`/boards/${id}/share`),
    invite: (id: string) => get<InviteState>(`/boards/${id}/invite`),
    enableInvite: (id: string) => post<InviteState>(`/boards/${id}/invite`),
    regenerateInvite: (id: string) => post<InviteState>(`/boards/${id}/invite/regenerate`),
    disableInvite: (id: string) => del<InviteState>(`/boards/${id}/invite`),
    joinRequests: (id: string) => get<JoinRequest[]>(`/boards/${id}/join-requests`),
  },
  invites: {
    lookup: (token: string) => get<InviteLookup>(`/invite/${token}`),
    request: (token: string) => post<{ id: string; board_id: string; status: string }>(`/invite/${token}/requests`),
    decide: (id: string, status: "approved" | "rejected") => patch<unknown>(`/join-requests/${id}`, { status }),
  },
  cards: {
    listForBoard: (boardId: string, f: CardFilters = {}) =>
      get<Card[]>(`/boards/${boardId}/cards`, {
        search: f.search,
        "filter[priority]": f.priority,
        "filter[assignee]": f.assignee,
        "filter[category]": f.category,
      }),
    get: (id: string) => get<Card>(`/cards/${id}`),
    activity: (id: string, page: PageQuery = {}) => get<ActivityEntry[]>(`/cards/${id}/activity`, pageQuery(page)),
    create: (columnId: string, body: CardInput & { title: string }) => post<Card>(`/columns/${columnId}/cards`, body),
    update: (id: string, body: CardInput) => patch<Card>(`/cards/${id}`, body),
    move: (id: string, body: { column_id: string; prev?: string | null; next?: string | null }) =>
      patch<Card>(`/cards/${id}/move`, body),
    archive: (id: string) => post<Card>(`/cards/${id}/archive`),
    remove: (id: string) => del<null>(`/cards/${id}`),
  },
  subtasks: {
    create: (cardId: string, title: string) => post<Subtask>(`/cards/${cardId}/subtasks`, { title }),
    update: (id: string, body: { title?: string; is_done?: boolean; prev?: string | null; next?: string | null }) =>
      patch<Subtask>(`/subtasks/${id}`, body),
    remove: (id: string) => del<null>(`/subtasks/${id}`),
  },
  attachments: {
    addLink: (cardId: string, body: { url: string; name?: string }) =>
      post<Attachment>(`/cards/${cardId}/attachments`, body),
    upload: (cardId: string, file: File) => {
      const form = new FormData();
      form.set("file", file);
      return call<Attachment>("POST", `/cards/${cardId}/attachments`, { form });
    },
    remove: (id: string) => del<null>(`/attachments/${id}`),
    freshUrl: (id: string) => get<{ file_url: string | null; expires_at: string | null }>(`/attachments/${id}/url`),
  },
  categories: {
    listForBoard: (boardId: string) => get<Category[]>(`/boards/${boardId}/categories`),
    create: (boardId: string, body: { name: string; color?: string | null }) =>
      post<Category>(`/boards/${boardId}/categories`, body),
    update: (id: string, body: { name?: string; color?: string | null }) => patch<Category>(`/categories/${id}`, body),
    remove: (id: string) => del<null>(`/categories/${id}`),
  },
  comments: {
    list: (cardId: string, sort: "latest" | "popular") => get<Comment[]>(`/cards/${cardId}/comments`, { sort }),
    create: (cardId: string, content: string) => post<Comment>(`/cards/${cardId}/comments`, { content }),
    reply: (commentId: string, content: string) => post<Comment>(`/comments/${commentId}/replies`, { content }),
    togglePriority: (id: string) => patch<Comment>(`/comments/${id}/priority`),
    remove: (id: string) => del<{ deleted: number }>(`/comments/${id}`),
  },
  notifications: {
    inbox: (page: PageQuery = {}) => get<Inbox>("/notifications", pageQuery(page)),
    markRead: (id: string) => patch<Notification>(`/notifications/${id}/read`),
    readAll: () => patch<null>("/notifications/read-all"),
  },
  analytics: {
    board: (id: string) => get<Analytics>(`/boards/${id}/analytics`),
    all: () => get<Analytics[]>("/analytics/boards"),
    throughput: (id: string, weeks = 8) => get<Throughput>(`/boards/${id}/analytics/throughput`, { weeks: String(weeks) }),
    allThroughput: (weeks = 8) => get<Throughput[]>("/analytics/throughput", { weeks: String(weeks) }),
  },
  users: {
    list: () => get<(User & { role: string })[]>("/users"),
    create: (body: { full_name: string; username: string; email: string; password: string; role: string }) =>
      post<User>("/users", body),
    update: (id: string, body: { full_name?: string; username?: string; email?: string; role?: string }) =>
      patch<User>(`/users/${id}`, body),
  },
};
