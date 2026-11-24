# Design System, V16 (draft)

### Requirement 38: Design System

**User Story:** As the product owner, I want the app, the sign-in pages, and the landing page to look like `design/kanban-prototype-v2.html` and to share one design system, so that every component looks balanced next to every other component and the product matches the prototype.

**Visual source of truth.** The prototype is the source of truth for how RevoBoard looks. Its 13 pages were rendered in a browser (Chrome, 1440 and 390 pixels wide) and their computed styles measured; the renders are in `design/reference/v2/` and the numbers below come from those measurements, not from the Tailwind class names. The prototype is not consistent with itself: pages 1, 5, 10, 11, 12, and 13 share one "Template Layout" and are the canonical look; pages 3, 4, 6, 7, 8, and 9 were drawn later with a slate colour set, different radii (12, 28, and 36 pixels), a different rail width (72 to 96 pixels), and hex colours of their own. Where pages disagree, the canonical look wins and the other pages are redrawn with the canonical recipes (DS-26). Where this requirement and a reference image differ in a detail, the measured value in this requirement wins and the image shows the intent.

#### Acceptance Criteria

**Single source**

1. [DS-01] THE Frontend SHALL take every colour, type size, line height, letter spacing, font weight, spacing, radius, shadow, size, layer, duration, opacity, gradient, and blur from the Design_System: custom properties in `frontend/styles/tokens.css` exposed to Tailwind through the theme alias in `frontend/styles/globals.css`. THE Frontend SHALL NOT add a second token file, a second theme, or a token prefix for the landing page, the sign-in pages, or any other area (Decision AQ).
2. [DS-02] THE Design_System SHALL define these brand and accent tokens, with the prototype value they come from:

| Token | Value | Prototype name | Use |
|---|---|---|---|
| `--brand` | `#002954` | `primary` | dark pill buttons, active filter chip, submit button on the auth card, avatar fill |
| `--brand-strong` | `#001b3c` | `on-primary-fixed` | hover of `--brand` |
| `--brand-soft` | `#1c3f6e` | `primary-container` | second fill of the brand gradient, secondary avatar fill |
| `--brand-tint` | `#d6e3ff` | `primary-fixed` | info highlight fill |
| `--on-brand` | `#ffffff` | `on-primary` | text and icons on `--brand` |
| `--on-brand-muted` | `#8cabe1` | `on-primary-container` | secondary text on `--brand` and `--brand-soft` |
| `--accent` | `#006b5f` | `secondary` | primary action pill, progress fill, active rail circle, links, unread dot (Decision AP) |
| `--accent-strong` | `#005047` | `on-secondary-fixed-variant` | hover of `--accent` |
| `--accent-tint` | `#76f4e0` | `secondary-container` | logo tile, count badges, "Completed" and "Med" pills, CTA button on a dark band |
| `--on-accent` | `#ffffff` | `on-secondary` | text and icons on `--accent` |
| `--on-accent-tint` | `#006f63` | `on-secondary-container` | text on `--accent-tint` |

3. [DS-03] THE Design_System SHALL define these surface and text tokens:

| Token | Value | Prototype name | Use |
|---|---|---|---|
| `--surface-100` | `#f3f2ff` | `surface-container-low` | page canvas, and every tinted fill: Columns, the filter bar, the Board_Switcher trigger, input fields, the Top_Nav track, a segmented switch, a quiet pill button |
| `--surface-200` | `#ffffff` | `surface-container-lowest` | the app frame, the Icon_Rail, Cards, modals, panels, popovers, chips on a tinted fill |
| `--surface-sunken` | `#ebedff` | `surface-container` | hover and active fill, the active Top_Nav item, category tags, the progress track, a quiet badge |
| `--surface-strong` | `#dce1ff` | `surface-container-highest` | count badges, disabled fill, skeleton |
| `--ink` | `#0f193c` | `on-surface` | body and heading text |
| `--ink-muted` | `#43474f` | `on-surface-variant` | secondary text, icons, labels |
| `--ink-faint` | `#747780` | `outline` | decorative icons and disabled text only; never body text |

   THE Design_System SHALL retire `--surface-hover` and the `#faf8ff` page colour of the first V16 draft.
4. [DS-04] THE Design_System SHALL define `--border` as `#ebedff` (a one pixel outline on cards inside the landing page and the invite rows), keep `--ring` as the focus ring colour (Requirement 14 criterion 15), and draw form fields, the filter bar, and Columns without a border, as the prototype does: a field is a `--surface-100` fill, and its boundary is the fill plus the focus ring.
5. [DS-05] THE Design_System SHALL define `--danger` as `#ba1a1a`, `--danger-soft` as `#ffdad6`, `--on-danger` as `#ffffff`, and `--on-danger-soft` as `#93000a`.
6. [DS-06] THE Design_System SHALL keep the `--label-*` background and text pairs and the `--tone-*` solid hues of V7 (used for Column dots and category chips) unchanged, and SHALL keep `--online`, `--scrim`, and `--scrim-strong`, rebuilding the scrim colours from `--ink`. THE Design_System SHALL NOT adopt the prototype's tertiary cyan or any colour that is not in the tables of this requirement or in the V7 pairs. THE Design_System SHALL define two gradients: `--gradient-brand` (`--brand` to `--brand-soft`, 135 degrees, with a soft `--accent-tint` glow) for the auth brand panel, and `--gradient-cta` (`--brand` to `--accent`, 90 degrees) for the landing call-to-action band.
7. [DS-07] THE Frontend SHALL test every text and surface pair of the Design_System in `frontend/tests/` by computing its contrast ratio from `tokens.css`, requiring at least 4.5 to 1 for text under 24 pixels (and for bold text under 19 pixels) and at least 3 to 1 for the focus ring on every surface and for large text. The pairs are `--ink`, `--ink-muted`, `--accent`, and `--danger` on `--surface-100`, `--surface-200`, and `--surface-sunken`; `--ink-muted` on `--surface-strong`; `--on-brand` on `--brand` and `--brand-soft`; `--on-brand-muted` on `--brand` and `--brand-soft`; `--on-accent` on `--accent`; `--on-accent-tint` on `--accent-tint`; `--on-danger` on `--danger`; `--on-danger-soft` on `--danger-soft`; and every `--label-*` pair. (Measured ratios of the prototype values: `--on-accent-tint` on `--accent-tint` 4.57, `--ink-muted` on `--surface-100` 8.41, `--accent` on `--surface-100` 5.80, `--on-danger-soft` on `--danger-soft` 7.24.)

**Type**

8. [DS-08] THE Design_System SHALL define this one type scale, measured from the prototype. Each entry is a Tailwind `text-*` utility that bundles size, line height, weight, and letter spacing through the theme's companion variables, so a component never sets those four separately:

| Utility | Size / line | Weight | Tracking | Family | Use (measured on) |
|---|---|---|---|---|---|
| `text-display` | 34 / 42 from 960 pixels, 28 / 36 below | 700 | -0.02em | heading | landing `h1`, auth brand panel title |
| `text-xl` | 24 / 30 | 700 | -0.015em | heading | page and section titles, the Board name in the Board_Switcher, auth form title |
| `text-title` | 20 / 26 | 600 | -0.01em | heading | modal and panel titles, the Dashboard greeting |
| `text-page-title` | 18 / 24 | 600 | 0 | heading | Column title, landing feature title |
| `text-base` | 15 / 22 | 400 | 0 | body | landing and auth paragraph text |
| `text-card-title` | 15 / 21 (16 / 22 from 1280 pixels) | 600 | 0 | body | board Card title |
| `text-sm` | 14 / 20 | 400 (500 on buttons and nav) | 0 | body | default text, Card description, buttons, nav |
| `text-meta` | 13 / 18 | 500 | 0 | body | Card footer, secondary text |
| `text-xs` | 12 / 16 | 600 | 0 | body | filter chips |
| `text-2xs` | 11 / 15 | 600 | 0.05em, upper case for tags | body | category tags, priority pills, count badges, section eyebrows |

   THE Design_System SHALL retire `--text-heading` (16) and `--text-lg` (17), which the prototype does not use, and the restyle SHALL move each use to the nearest entry above.
9. [DS-09] THE Frontend SHALL use only the weights 400, 500, 600, and 700 through Tailwind's `font-normal`, `font-medium`, `font-semibold`, and `font-bold`, and SHALL NOT use a weight, size, tracking, or line-height utility in a component where a `text-*` entry of criterion 8 already sets it.
10. [DS-10] THE Frontend SHALL set the heading family (`text-display`, `text-xl`, `text-title`, `text-page-title`) in Plus Jakarta Sans, through a `--font-heading` token (Decision AR).
11. [DS-11] THE Frontend SHALL set every other text in Inter through `--font-stack`. BOTH families SHALL be self-hosted from the application bundle with `@fontsource-variable/plus-jakarta-sans` and `@fontsource-variable/inter`, loaded with `font-display: swap`, and the Frontend SHALL make no request to a third-party font or icon service (Requirement 14 criterion 17, amended). THE landing page SHALL load the same two families and no other.

**Shape, depth, and size**

12. [DS-12] THE Design_System SHALL define the radius scale, measured from the prototype, by role (Decision AS): `--radius-sm` 8 pixels (a security note, a small button), `--radius-field` 12 pixels (auth and form fields, the auth tab switch, the auth submit button, inner rows), `--radius-card` 16 pixels (Cards, Card-like rows, the Board_Switcher trigger, textareas, the "Add Card" button, the landing preview's inner cards), `--radius-frame` 24 pixels (the app frame, Columns, the filter bar, modals, the Side_Panel, the auth card, the landing feature cards and preview), and `--radius-full` (pill buttons, chips, badges, tags, nav items, avatars, the Icon_Rail). It SHALL retire `--radius-md`, `--radius-lg`, and the 6 pixel `--radius-card` of V7.
13. [DS-13] THE Frontend SHALL apply the radius roles as the table of criterion 18 states, and SHALL write no radius as a literal or an arbitrary value; a component picks a role only. The prototype's 28 and 36 pixel radii (page 3) and 32 pixel radius (page 4) collapse to `--radius-frame`, and its 6 pixel radius (page 4 nav) to `--radius-sm`.
14. [DS-14] THE Frontend SHALL draw the Icon_Rail, buttons, chips, tags, badges, avatars, and the Top_Nav track as full pills or circles, as the prototype does.
15. [DS-15] THE Design_System SHALL keep the spacing scale 4, 8, 12, 16, 20, 24, 32, and 48 pixels (`--space-1` to `--space-12`) on an 8 pixel grid, and SHALL add `--page-x` (16 pixels below 960 pixels, 24 pixels from 960 pixels) as the inner padding of the app frame, and `--gutter` (12 pixels, 16 pixels from 960 pixels) as the gap between Columns and between Cards. The prototype names map as: `space-xs` 4, `space-sm` 8, `space-md` 12, `space-lg` 16, `space-xl` 24, `space-2xl` 32, `space-3xl` 48. Section spacing on the landing page uses `--space-12` and `--space-8` only.
16. [DS-16] THE Design_System SHALL define these shadows and no other, measured from the prototype: `--shadow-card` (`0 1px 2px` of `--ink` at 4 to 5 percent: Cards, pill buttons, chips, the app frame, the Icon_Rail), `--shadow-hover` (Card hover), `--shadow-popover` (`0 10px 25px` at 10 percent: popovers, menus, the Board_Switcher panel), `--shadow-dragging`, `--shadow-modal` (`0 25px 50px` at 10 percent: modals), `--shadow-panel` (`0 25px 50px` at 25 percent: the Side_Panel and the auth card), and `--shadow-float` (`0 20px 50px` at 12 percent: the landing product preview). Shadow colour is `--ink` at a token opacity.
17. [DS-17] THE Design_System SHALL add `--size-header` 64 pixels (the App_Header height from 960 pixels), `--size-icon-lg` 24 pixels, `--size-tile` 48 pixels (an icon tile), `--size-panel` 460 pixels (the Side_Panel width), `--container-site` 80rem (the landing content width), and `--container-copy` 42rem (a paragraph column); keep `--rail-w` at 64 pixels; and define the control sizes the prototype uses, replacing the 40 and 32 pixel pair of Requirement 14 criterion 20 and V13: `--size-control` 40 pixels (fields, the Top_Nav track, rail items, "Add Card"), `--size-button` 36 pixels (a primary pill button), `--size-control-sm` 32 pixels (a Top_Nav item, an avatar), `--size-pill` 28 pixels (a compact pill button such as "Public link"), and `--size-chip` 24 pixels (a filter chip). Below 960 pixels every icon-only control and every pill below 44 pixels SHALL keep a hit area of `--size-touch` (44 pixels) in both directions through an expanded invisible target, without changing how it looks.
18. [DS-18] THE Frontend SHALL build every shared component to this table (all values measured on the canonical pages), so that sizes and corners relate the same way on every page. A component picks the row it belongs to and adds no value of its own:

| Component | Height | Radius | Padding | Type | Fill | Shadow |
|---|---|---|---|---|---|---|
| App frame | auto | frame | 0; content `--page-x` | n/a | `--surface-200` | card |
| Icon_Rail | 64 wide, full height of the canvas minus its margin | full | y 24 | n/a | `--surface-200` | card |
| Rail item | 40 | full | none | n/a | none; active `--accent` with `--on-accent` icon; inactive icon `--ink-muted` | none |
| Rail home circle | 44 | full | none | n/a | `--accent`, icon `--on-accent` | popover |
| App_Header | `--size-header` | none | x `--page-x` | n/a | `--surface-200` | none |
| Top_Nav | track 40 | full | track 4 | n/a | track `--surface-100` | none |
| Top_Nav item | 32 | full | x 16 | `text-sm` medium | none; active `--surface-sunken` with semibold `--ink` | none |
| Button primary | `--size-button` | full | x 16, y 8 | `text-sm` medium | `--accent` on `--on-accent` | card |
| Button dark | `--size-pill` | full | x 16 | `text-sm` medium | `--brand` on `--on-brand` | card |
| Button quiet | `--size-pill` | full | x 12 | `text-sm` medium | `--surface-100` on `--ink` | card |
| Button danger | as the button it sits with | full | as above | as above | `--danger-soft` on `--on-danger-soft`; solid `--danger` on `--on-danger` for a confirm | none |
| Auth submit | 40, full width | field | x 16 | `text-sm` medium | `--brand` on `--on-brand` | modal |
| Icon button | 40 or 32 square | full | none | n/a | none, `--surface-sunken` on hover | none |
| Input, `BaseCombobox` trigger, date field | 40 | field (card in a modal) | x 16 (x 40 left when it has a leading icon) | `text-sm` | `--surface-100`, no border | none |
| Textarea | at least 80 | card | 12 by 16 | `text-sm` | `--surface-100` | none |
| Filter chip | `--size-chip` | full | x 12 | `text-xs` | `--surface-200`; active `--brand` on `--on-brand` | card |
| Category tag | auto | full | x 8, y 2 | `text-2xs` upper case | `--surface-sunken` on `--ink` | none |
| Priority pill | auto | full | x 8, y 2 | `text-2xs` | High `--danger-soft` on `--on-danger-soft`; Med `--accent-tint` on `--on-accent-tint`; Low `--surface-sunken` on `--ink-muted`; each with a 13 pixel flag icon | none |
| Count badge | auto | full | x 8, y 2 | `text-2xs` | `--surface-strong` on `--ink-muted`; teal variant `--accent-tint` on `--on-accent-tint` | none |
| Role tag, status pill | auto | full | x 8, y 2 | `text-2xs` | a `--label-*` pair, `--accent-tint`, `--surface-sunken`, or `--danger-soft` | none |
| Board Card | auto | card | 16 | `text-card-title`, `text-sm`, `text-meta` | `--surface-200` | card |
| Card progress bar | 4 | full | n/a | n/a | track `--surface-sunken`, fill `--accent` (`--danger` for an overdue Card) | none |
| Column | auto, width `--column-w` | frame | 12 | `text-page-title` title | `--surface-100` | none |
| "Add Card" | `--size-control` | card | none | `text-sm` medium `--ink-muted` | `--surface-200` | card |
| Filter bar | auto | frame | 12 | n/a | `--surface-100` | none |
| Board_Switcher trigger | auto | card | 6 by 12 | `text-xl` | `--surface-100` | card |
| KPI tile, Home tile | auto | frame | 24 | `text-xl` value, `text-meta` label | `--surface-200`, `--border` | card |
| Popover, menu, Board_Switcher panel | auto | frame | 12 | `text-sm` | `--surface-200` | popover |
| Tooltip | auto | sm | y 4, x 8 | `text-xs` | `--ink` fill, `--surface-200` text | none |
| `BaseModal` | auto | frame | 24 | title `text-title` | `--surface-200` | modal |
| Modal scrim | full screen | n/a | n/a | n/a | `--scrim` with `--blur-overlay` | none |
| Side_Panel | full height minus a 24 pixel inset, `--size-panel` wide | frame | header 24, body 16 | title `text-title` | `--surface-200` | panel |
| Panel row | auto | card | 14 | `text-sm` | unread `--surface-100`, read none | none |
| Segmented switch | 40 | field (card in a panel) | 4 | `text-sm` medium | track `--surface-100`; active item `--surface-200` | card |
| Auth card | auto | frame | 0 | n/a | `--surface-200` | panel |
| Auth brand panel | full height of the card | frame on its left corners | 48 | title `text-display` | `--gradient-brand`, text `--on-brand`, secondary `--on-brand-muted` | none |
| Avatar | 24, 28, 32, or 40 | full | n/a | `text-2xs` bold initials | `--brand` or `--accent` or `--brand-soft` with `--on-brand` initials | none |
| Progress meter (Board_Toolbar) | 6 | full | n/a | n/a | track `--surface-sunken`, fill `--accent` | none |
| Landing section | auto | none | y 48, x `--page-x` | `text-xl` title, `text-base` copy | canvas or `--surface-100` band | none |
| Landing feature card | auto | frame | 24 | `text-page-title`, `text-sm` | `--surface-100` | none |
| Landing product preview | auto | frame | 24 | the app's own components | `--surface-200`, `--border` | float |
| Landing CTA band | auto | card | 32 | `text-xl` | `--gradient-cta`, text `--on-brand` | popover |
| FAQ item | auto | card | 16 | `text-sm` medium question | `--surface-200`, `--border` | none |

   Numbers in the table are pixels and stand for the matching token (`--size-*`, `--space-*`, `--radius-*`); a component uses the token, never the number.

**Components and rules**

19. [DS-19] THE Frontend SHALL draw every icon with `lucide-react` at `--size-icon-sm` (14), 13 pixels for the priority flag, `--size-icon` (18), or `--size-icon-lg` (24), and SHALL NOT load the Material Symbols font the prototype uses. THE Frontend SHALL map each prototype icon to the lucide icon of the same meaning in the task that restyles that screen.
20. [DS-20] THE Frontend SHALL give every interactive component these states from the Design_System and no other: hover (`--surface-sunken` on quiet controls, `--brand-strong` on dark, `--accent-strong` on primary), pressed (the hover colour, no scale), focus-visible (the ring of Requirement 14 criterion 15), disabled (`--opacity-disabled`, no pointer events), and a transition of `--duration-fast` on colour, background, and shadow only.
21. [DS-21] THE Frontend SHALL translate the prototype only through the tables above: a prototype class such as `text-[22px]`, `bg-[#006B5F]`, `w-2 h-2`, `rounded-3xl`, `shadow-[0_20px_50px_rgba(15,25,60,0.12)]`, or `py-3.5` is never copied; the nearest token utility is used instead, and a value with no token is a Design_System change made through this requirement.
22. [DS-22] THE Frontend SHALL keep the Tailwind theme cleared of defaults (`--color-*`, `--spacing-*`, `--radius-*`, `--shadow-*`, `--container-*`, `--breakpoint-*`, `--text-*`, `--font-*`, `--ease-*`, `--blur-*`) and expose only the tokens of this requirement, and SHALL keep two breakpoints: `lg` at 960 pixels and `xl` at 1280 pixels.
23. [DS-23] THE Design_System SHALL ship one light theme. THE Frontend SHALL NOT enable `dark:` variants.
24. [DS-24] THE landing page, the sign-in pages, and every Protected_Route page SHALL pass the same style checks of Requirement 44 (no hex, no arbitrary value, no numeric layer, duration, or opacity, no raw `<button>`, no `max-*` variant), and the landing components SHALL be built from `Base*` components and the recipes of criterion 18.

**Reference and fidelity**

25. [DS-25] THE repository SHALL keep the renders of the prototype in `design/reference/v2/` (desktop at 1440 pixels and mobile at 390 pixels for each of the 13 pages, with the landing page cut into three desktop slices) together with a `README.md` that names the source page of each image and lists what the image shows that V16 does not build (exclusions 1 to 17 of `specs/v16/00-OVERVIEW.md`). THE Frontend task that restyles a screen SHALL compare the result with the images of that screen before it is ticked (Requirement 44, V16-T15).
26. [DS-26] THE Frontend SHALL redraw pages 3, 4, 6, 7, 8, and 9 of the prototype with the canonical recipes of criterion 18 and the layout of Requirement 40: the slate and emerald colours of those pages map to `--ink-muted`, `--surface-100`, `--surface-sunken`, and `--accent`; their 12, 28, 32, and 36 pixel radii map to the radius roles; and their 72 to 96 pixel rails and their per-page header heights map to the one Icon_Rail and the one App_Header.
27. [DS-27] THE Frontend SHALL test the recipe table in a real browser (Requirement 44, V16-T16): for each row that has a measurable height, radius, padding, font size, weight, and fill, the computed style of the built component equals the token value, so that drift from the prototype is caught by a test and not by eye.
