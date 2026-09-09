# OFFSCRPT V74.0 — MASTER CONTROL PARITY

## Restored legacy control surfaces

- Overview/Dashboard
- Posts
- Communities
- Questions
- Topics
- Reports
- Users
- Messages
- Moderators
- Site Control
- Navigation Builder
- Global Settings Backup/Restore

## Additional controls retained from V73

- Master admin allowlist by email and UID
- Moderator promotion/revocation
- Granular moderator permission matrix
- Emergency controls
- Read-only/maintenance/registration/comment/post/reaction/follow/community/direct-message/upload controls
- Platform analytics
- Creator/article analytics comparison
- Recommendation source health
- Runtime diagnostics
- Session/security view
- Presence measurement
- Privileged audit log

## Cloud authority

The client does not bypass Firestore Security Rules. Master operations call Firestore-backed functions and the included `firestore.rules` contains the corresponding master/staff authorization checks.

## Analytics behavior

Platform analytics read current Firestore counters plus the article analytics collection group. Bookmark and reaction totals are derived from the latest state per reader identity for each article. Creator analytics contain aggregate metrics only; reader identities are not returned.

## Important deployment requirement

To make the restored authority and controls active for all users, deploy the included Firestore rules to the same Firebase project used by the production site. Updating only the frontend bundle cannot change live Firestore authorization.
