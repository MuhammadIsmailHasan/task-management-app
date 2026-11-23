### Requirement 21: Branding (Logo and Favicon) — V15 amendment

V15 keeps Requirement 21's structure and criteria from `specs/v11/21-BRANDING.md`
(BRAND-01 to BRAND-17) unchanged except for the five criteria below, which are
reworded for the new brand. Everything else in that file still applies as
written, including the file paths and the Next.js favicon convention.

#### Acceptance Criteria (changed)

1. [BRAND-06, reworded] THE BrandLogo SHALL pass `width` and `height` equal to the `viewBox` of the file (203 by 203 for `mark`, 704 by 121 for `full`) so that the browser reserves the aspect ratio before the file loads, SHALL set the displayed size with token-backed size classes (Requirement 14, criterion 9), and SHALL display `mark` at no more than 203 CSS pixels wide and `full` at no more than 704 CSS pixels wide, so that the Embedded_Raster is never enlarged.
2. [BRAND-07, reworded] THE BrandLogo SHALL give the image the alt text `RevoBoard`, and WHERE the logo sits inside a control that has its own accessible name, or next to visible text that reads RevoBoard, THE BrandLogo SHALL render `alt=""` through a `decorative` property.
3. [BRAND-10, reworded] WHILE the viewport is below 960 pixels and the page is not a Board, THE App_Header SHALL show the link to `/boards` as `BrandLogo` (variant `mark`, `decorative`) followed by the visible text RevoBoard, so that the link name stays "RevoBoard".
4. [BRAND-11, reworded] THE Frontend SHALL keep the title `RevoBoard` in the root `metadata` and the suffix "· RevoBoard" in the page titles (superseded in turn by Requirement 32's `RevoBoard | <name>` template, unchanged by V15), and SHALL add no `app/icon`, `app/apple-icon`, or `app/manifest`, because the owner has supplied only `favicon.ico`.
5. [BRAND-08, reworded] WHILE the viewport is 960 pixels or wider, THE Frontend SHALL show in the Sidebar toggle `BrandLogo` with the variant `full` when the Sidebar is expanded, and the variant `mark` with the tooltip `RevoBoard` when it is collapsed; the rest of this criterion (the toggle's own accessible name and `aria-expanded`) is unchanged.

#### Unchanged from V11

BRAND-01, 02, 03 (file paths), 04, 05, 09, 12, 13, 14, 15, 16, and 17 (the
verification checks) are unchanged; BRAND-03's paths still point at the same
`logo-revo.svg` and `logo-text-revo.svg` files, so no import in `BrandLogo.tsx`
or elsewhere changes. BRAND-17(b) and (d) now check for the alt text
`RevoBoard` and the tooltip `RevoBoard` instead of `RevoTask`.

#### Reason

The product owner replaced the RevoTask mark with a RevoBoard mark and
favicon from a Stitch-generated reference image (see
`specs/v15/00-OVERVIEW.md`, Decision AO).

#### Impact

Frontend only, no API, data model, or permission change: `frontend/app/favicon.ico`,
`frontend/public/brand/logo-revo.svg`, `frontend/public/brand/logo-text-revo.svg`,
`frontend/components/shared/BrandLogo.tsx` (width/height literals), `frontend/app/layout.tsx`
(metadata title/description), `frontend/components/shell/AppHeader.tsx`,
`frontend/components/shell/Sidebar.tsx`, `frontend/lib/titles.ts`, and the three
matching test files (`branding.test.tsx`, `titles.test.ts`, `route-titles.test.ts`),
whose expected strings and the one brand-length-derived constant
(`titles.test.ts`'s `t.length <= 72`, up from 71, since "RevoBoard" is one
character longer than "RevoTask") move with it.
