# OFFSCRPT V59

Built from the V56 precision-reading milestone.

## Added
- Firestore-backed looping top-bar/ticker content controls: add, delete, reorder, edit text, optional external URLs, speed, and hover pause.
- Footer Builder with persisted navigation/hub links, internal routes, external destinations, RSS action, topic links, visibility controls, section titles, topic override, and bottom-right footer text.
- Blog archive header controls for eyebrow, headline, description, background/text colors, live essay-count visibility, and count label.
- Blog essay count now counts published articles only.
- SiteConfig saves now preserve the complete existing global configuration instead of dropping unrelated settings.
- All changes sync through the existing `siteConfig/global` Firestore document and realtime subscription path.

## Validation
- TypeScript syntax/non-module diagnostics checked against the modified source files.
- Full dependency install/Vite build could not be completed in this environment because `npm ci` timed out before dependencies were fully installed.


## V58 — Profile Cloud Sync & Reliability Fix

- Fixed profile edit flow so a successful Firestore profile write is never reported as failed because legacy author snapshot propagation fails afterward.
- Added strict client-side sanitization for editable profile fields and hex theme colors.
- Added complete identity payload propagation for posts and comments.
- Added realtime `users/{uid}` profile subscriptions so profile edits update the current account and public profile viewers without a refresh.
- Added save-state locking to prevent duplicate profile writes.
- Protected server-controlled profile fields from being submitted by the client update helper.
- Mirrored active source changes into the repository's duplicate `src/` tree.

Validation: modified TS/TSX files successfully transpile with TypeScript. Full dependency-backed Vite/tsc validation was not available because dependency installation timed out in the build environment.


## V59 — Admin Profile Ownership + Blank Page Fix

- Fixed a production runtime crash caused by the realtime profile subscription being referenced from `App.tsx` without being imported; this caused the deployed SPA to render a blank page.
- Synchronized the active root source tree with `src/`, which is the actual Vite entrypoint referenced by `index.html`, eliminating stale duplicate source files.
- Fixed trusted-admin editing of the canonical `@krishsarkar` author profile when the signed-in admin UID differs from the canonical author UID.
- Kept ordinary users restricted to their own profile documents.
- Tightened Firestore user-update rules so admins cannot arbitrarily edit every user's profile fields; the cross-UID admin exception is limited to the canonical `@krishsarkar` author profile.
- Added a production runtime error boundary so unexpected React errors show a recoverable reload screen instead of an unexplained white page.

- Canonical admin profile edits now synchronize the publication author fields in `siteConfig/global` as well as the corresponding authored posts/comments/articles.
- Normal user profile writes remain account-scoped; admin cross-UID access is limited to the reserved `@krishsarkar` author profile.
