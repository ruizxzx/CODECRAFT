# OFFSCRPT V57

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
