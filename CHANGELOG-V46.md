# OFFSCRPT V46 — Navigation, Series Progress & Access Fix

## Fixes
- Fixed the signed-out header auth state so SIGN IN renders after Firebase finishes its auth-state initialization.
- Fixed article-end VIEW ALL SERIES navigation; it now routes to the Series Library instead of returning a function reference.
- Added a dedicated `onViewAllSeries` callback from the app router for unambiguous navigation.
- Removed duplicated `series` route branches in the hash router.

## Series discovery
- Added a reusable Series Strip to the homepage and blog archive.
- Each surface provides search, featured series cards, author identity, part count, calculated reading time, and an ALL SERIES control.
- Existing `/series` and `/series/<id>` routes remain intact.

## Progress tracking
- Series pages now listen to the signed-in user's `readingProgress` collection in realtime.
- Overall series progress is calculated from each part's saved reading percentage rather than only counting completed parts.
- Resume selects the first unfinished in-progress article before falling back to the next untouched part.
- Remaining reading time accounts for each part's saved percentage.
- Article pages retain automatic scroll-progress syncing and now expose an explicit MARK AS COMPLETE action at the end of series articles.
- Completion is explicit or automatically recorded when the article reaches the end; partial progress does not falsely mark an article complete.

## Cloud / security
- No Firestore permission relaxation was added. Existing per-user reading-progress rules continue to scope data to the authenticated owner.
