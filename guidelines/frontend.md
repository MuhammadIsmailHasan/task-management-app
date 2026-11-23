# Frontend Guidelines

Coding standards for the Next.js app.

---

**Rule:** Build UI only from `components/shared/Base*` (`BaseButton`,
`BaseBadge`, `BaseModal`, `BasePopover`, `BaseCalendar`, `BaseTooltip`, `BaseCombobox`, `BaseMenu`, `BaseConfirm`); never a raw `<button>`, ad-hoc badge `<span>`, or a
one-off modal. The `Base*` components wrap the shadcn/ui primitives in
`components/ui/`; only they import `components/ui/`.

**Rationale:** One place to fix styling, states, and accessibility for every
button/badge/modal in the app, instead of N near-duplicates.

**Example:**
```tsx
// Bad
<button className="bg-red-500 px-3 py-1 rounded" onClick={onDelete}>Delete</button>

// Good
<BaseButton variant="danger" onClick={onDelete}>Delete</BaseButton>
```

---

**Rule:** Default to a Server Component. Add `"use client"` only once a
component actually needs `useState`/`useEffect`, an event handler, or a
browser API.

**Rationale:** Most of the card/board content is read-only on first render —
rendering it server-side means less JS shipped to a phone on a slow
connection, which matters more here than on desktop.

**Example:**
```tsx
// Bad: client component for something that never changes without a refetch
"use client"
export function CardDescription({ text }: { text: string }) {
  return <p>{text}</p>
}

// Good: plain server component
export function CardDescription({ text }: { text: string }) {
  return <p>{text}</p>
}
// "use client" only on CardModal, CommentComposer, the drag-and-drop Board, etc.
```

---

**Rule:** Components never call `fetch`/`axios` inline; all requests go
through a typed API client that unwraps the `{ data }` / `{ error }` envelope
in one place.

**Rationale:** Keeps auth headers, base URL, and error handling consistent,
and means a component never has to know the envelope shape itself.

**Example:**
```tsx
// Bad
useEffect(() => { fetch("/api/cards/" + id).then(r => r.json()).then(setCard) }, [id])

// Good
useEffect(() => { api.cards.get(id).then(setCard) }, [id]) // api.cards.get already unwraps { data }
```

---

**Rule:** Build the layout mobile-first: base styles target a ~360–414px
screen with no media query; `min-width` queries add or change things for
larger screens. Never ship a desktop layout with a `max-width` query that
strips it down for mobile.

**Rationale:** A layout retrofitted from desktop tends to keep desktop-only
assumptions (fixed widths, hover-only menus) that break on a phone; starting
from mobile avoids that by construction.

**Example:**
```tsx
// Bad: desktop-first (a max-* variant strips the desktop layout down)
<aside className="w-64 max-lg:hidden" />

// Good: mobile-first (unprefixed = phone, lg: = 960px and up)
<aside className="-translate-x-full lg:static lg:translate-x-0" />
```

---

**Rule:** A drag-and-drop reorder inserts a placeholder element at the drop
target and animates the other cards into place (FLIP) instead of snapping
them; the move is only committed to the backend on `dragend`, once.

**Rationale:** Matches the already-approved interaction feel, and keeps the
backend call to exactly one `PATCH` per completed drag, not one per
`dragover` event.

**Example:**
```tsx
// Bad: call the API on every dragover tick
onDragOver={() => api.cards.move(id, computeOrder())}

// Good: move a placeholder locally, commit once on drop
onDragEnd={() => api.cards.move(id, { columnId, order: computeOrder() })}
```

---

**Rule:** The comment thread component only shows a "Reply" action on a
top-level comment (`parentId === null`); a reply never renders its own
"Reply" button. There is no like button, and the "create new card" action is
keyed off `comment.canCreateCard` (the author being a manager), not
`comment.isPriority`.

**Rationale:** The backend rejects a reply-to-a-reply with `400` and has no
like endpoint — the UI shouldn't offer actions that don't exist or are
guaranteed to fail; keeping priority and create-card as separate booleans
avoids one standing in for the other by accident.

**Example:**
```tsx
{comment.parentId === null && <BaseButton onClick={() => openReplyBox(comment.id)}>Reply</BaseButton>}
{comment.canCreateCard && <BaseButton size="sm">Create card</BaseButton>}
<BaseBadge>{comment.replyCount} replies</BaseBadge>
```

---

**Rule:** The filter row's category chips are rendered from
`api.categories.listForBoard(boardId)`, never a hard-coded array; an
attachment link/button always opens with
`target="_blank" rel="noopener noreferrer"`, never a custom preview modal.

**Rationale:** A board's categories are its own, fetched data — a
hard-coded chip list would show the wrong categories on every other board.
A new tab is the agreed behavior for attachments; building a preview
component for PDF/Word/RAR would be solving a problem nobody asked for.

**Example:**
```tsx
// Bad
const CHIPS = ["Design", "Dev", "Bug", "Research"]

// Good
const { data: categories } = useCategories(boardId)
...
<a href={attachment.url} target="_blank" rel="noopener noreferrer">{attachment.name}</a>
```

---

**Rule:** Colors, spacing, radii, and shadows come only from the design-token
CSS variables defined once at the root (`--brand`, `--surface-*`, `--space-*`,
`--radius-*`, `--shadow-*`, the `--label-*` pairs), used through the
token-backed Tailwind utilities — never Tailwind's default palette, an
arbitrary value (`bg-[#fff]`, `p-[13px]`), a literal hex code, or a raw pixel
value inside a component. Sizes, z-index layers, durations, opacities, and the focus ring are named token utilities too (`size-avatar-sm`, `z-modal`, `duration-fast`, `opacity-muted`, `focus-ring`), never `z-50`, `duration-200`, or `opacity-60`.

**Rationale:** Keeps every `Base*` component visually identical to the
reference look, and means a palette tweak is a one-file change.

**Example:**
```tsx
// Bad
<span className="bg-[#f6dada] text-[#9a2f2f]">High</span>
<span className="bg-red-100 text-red-800">High</span>

// Good
<BaseBadge tone="red">High</BaseBadge>   // bg-label-red text-label-red-fg
```

---

**Rule:** Every interactive element is reachable by `Tab` and shows a visible
focus ring; `outline: none` is never applied without a replacement focus
style.

**Rationale:** Baseline keyboard accessibility, cheap to keep if enforced
from the first component.

**Example:**
```tsx
// Bad
<button className="outline-none" />

// Good: ring from the --ring token on keyboard focus
<BaseButton className="focus-visible:ring-2 focus-visible:ring-ring" />
```
---
**Rule:** A Server Component cannot remove a cookie, so a server-side `401`
redirects to a Route Handler that removes the cookie, and any `next` value is
passed through one `safeReturnPath` check before it is used.
**Rationale:** A redirect that leaves a bad cookie repeats the failure on the
next click, and an unchecked `next` is an open redirect.
**Example:**
```ts
// Bad
redirect(searchParams.get("next") ?? "/boards");
// Good
redirect(safeReturnPath(searchParams.get("next")));
```
---
**Rule:** A user's email is rendered only by `MemberSearch`, `MemberPicker`, and
the pending list of `InviteModal`; no other component reads an `email` field of
another user.
**Rationale:** The email is shown to staff in those three places and nowhere
else; one narrow set of places is easy to review.
**Example:** a sidebar member row renders `member.full_name` and `member.username`.
An avatar is drawn only through `BaseAvatar` with the full name as `alt` and tooltip, never the email.
---
**Rule:** Show the logo only through `BrandLogo` (`components/shared/`), which
renders `next/image` with `unoptimized` for the SVG files in `public/brand/`,
passes `width` and `height` equal to the file's `viewBox`, and sets alt text
`RevoBoard`, or `alt=""` where a labelled control or the visible name is beside it.
**Rationale:** One component keeps paths, size, and alt text consistent; the
SVG files wrap a PNG, so the display size must not exceed the `viewBox`.
**Example:**
```tsx
// Bad
<img src="/brand/logo-revo.svg" />
// Good
<BrandLogo variant="mark" decorative />
```

---
**Rule (V12):** The Card modal has no Save changes button and no draft state.
Every field saves through `useFieldSave` with a per-field Saving, Saved, or error
state; destructive actions use `BaseConfirm` (popover form by default, modal form
for removing an attachment and deleting a comment); no component renders a
visibility icon or computes card progress; every Inbox row is a link; the
Profile page uses the one-column and two-column grid with token classes only.
**Rationale:** A reviewer checks the V12 behaviour against one named rule.
**Example:** a `<button>Save changes</button>` in `CardModal` is a violation.

## V13: titles, role tag, control sizes
Titles are `RevoBoard | <name>` through `metadata.title.template`; use `generateMetadata` for a Board. Show a role tag beside each person in the assignee picker. Buttons beside a 40 pixel field are 40 pixels (`md`), not `sm`.
