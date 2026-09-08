# OFFSCRPT V68

Runtime and cloud-sync audit release.

## Fixed
- Fixed the article-page runtime crash caused by `MentionTextarea` referencing an undeclared `inputRef`.
- Added safe internal textarea ref fallback while preserving optional caller refs.
- Fixed missing community editor `syncState` state.
- Fixed missing `isAdmin` derivation on creator profiles.
- Fixed Explore creator hydration using the missing `u` result from the Firestore/community query.
- Restored the missing `writeAdminAudit` import in CMS cloud operations.
- Fixed global search `topics` tab type mismatch.
- Hardened article cards against missing author objects.
- Kept root and `src/` source copies synchronized, including Firestore rules.

## Cloud integrity
- Existing Firebase/Firestore-backed article, profile, community, reading, notification, analytics and audit paths are preserved.
- No client-side replacement of Firestore data with fake counters or static state was introduced in this hotfix.
