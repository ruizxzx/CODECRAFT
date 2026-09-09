# OFFSCRPT V72

**Release:** OFFSCRPT V72 — Cumulative Production Stability Release

## Base
- OFFSCRPT V71 article history
- OFFSCRPT V71.5 Batch 2 feature set

## Batch 2 preserved
- Creator analytics
- Behavior-driven recommendations
- Upgraded nested comments
- Universal share/deep links
- Granular moderator permissions
- User reporting
- Presence
- Admin system health

## V72 fixes
- Connected article analytics sessions to ArticleView lifecycle
- Added active reading duration and scroll/funnel milestones
- Connected shares, bookmarks, reactions, and completions to analytics events
- Reworked analytics aggregation to distinguish session/event records
- Fixed analytics Firestore timestamp rule mismatch
- Added runtime error reporting with local queue and Firestore persistence
- Added cloud sync-state infrastructure
- Added real health probes for Auth, Firestore, Storage initialization, PWA and Presence
- Added active-tree syntax/import/export/identifier/Firebase/rules/schema/runtime audits
- Preserved granular moderator permission rules
- Removed empty silent catches in the active runtime tree
- Added explicit loading/error handling around analytics loading
- Version metadata standardized to 0.72.0

## Active entrypoint
`src/index.html` → `src/main.tsx` → `src/App.tsx`

Vite is configured with `src/` as the active project root. V72 verification scripts scan this active source tree.
