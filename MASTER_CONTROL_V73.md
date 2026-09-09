# OFFSCRPT V73.0 — Master Control

The Master Control Center is restored as a Firestore-authoritative admin layer.

## Authority

- Bootstrap master emails remain hard-coded as break-glass administrators.
- Additional master administrators can be granted by verified email or Firebase UID through protected Firestore documents.
- `emergencyAdminLock` disables configured (non-bootstrap) master access until a bootstrap master clears it.

## Moderation

Moderator records are stored in `siteModerators/{uid}` with explicit permissions:
`manageReports`, `moderatePosts`, `moderateComments`, `manageUsers`, `editArticles`, `deleteArticles`, `viewAnalytics`.

Firestore rules enforce privileged operations; UI visibility is not the security boundary.

## Global controls

Emergency controls are stored in `siteConfig/global` and consumed by the application in realtime. Firestore rules also consult these values for registrations, posting, comments, reactions, following, communities, topics, messaging, uploads, maintenance and read-only mode.

## Audit

Privileged changes are written to `adminAuditLog` with actor, target, before/after state where available, and a server timestamp.

## Data integrity

Analytics counters use Firestore server-side count queries for aggregate event totals. Recommendation health displays only current Firestore source inventory and cloud article records; it does not generate hard-coded recommendation rows.
