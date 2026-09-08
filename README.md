# OFFSCRPT V52

## Release
Production hardening + account UX upgrade.

### Added / fixed
- Clearly exposed **Settings & Appearance** entry in the account menu.
- Dark mode can be enabled from **My OFFSCRPT → Settings & Appearance** and is restored locally and from Firestore.
- Dark mode CSS coverage expanded across common surfaces, forms, borders and states.
- Anonymous article and community-post view tracking now works using a stable per-browser identifier with daily deduplication. Authenticated viewers continue using account/day cloud receipts.
- View tracking runs for logged-out public readers as well as signed-in readers.
- Reading/view counters remain displayed across article/post surfaces already supported by the app.
- Existing dual reading indicators, manual completion/reset, history, dashboard, queue, notifications, autosave/recovery and creator-studio functionality retained.

### Firebase / Firestore
Deploy the included `firestore.rules`. The rules allow public content view receipts to be created anonymously while preventing direct arbitrary counter field edits outside the controlled `+1` update shape. Account-private preferences, drafts, history and queue remain owner-scoped.

### Known architectural note
Authoritative anti-fraud analytics at large scale should eventually move view counting to trusted server code (Cloud Functions/Cloud Run). V52 provides stable browser/day deduplication and does not expose private account identifiers publicly in the view UI.

### Validation
- Source inspection performed across Firebase, account, CMS, article/post view flows, header/settings, CSS and Firestore rules.
- `vite build` could not be executed in this environment because the supplied dependency tree has no installed Vite binary.
