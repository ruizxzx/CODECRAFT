# OFFSCRPT V74.0

Master Control parity + analytics hardening release.

- Restores dedicated legacy Master Control sections: Posts, Communities, Questions, Topics, Reports, Users, Messages, Moderators, Site Control, Navigation, Backups.
- Keeps V73 authority/security controls: master allowlist, emergency lock, granular moderator permissions, system health, runtime diagnostics, audit.
- Fixes Master Control analytics with Firestore-backed platform, article and creator aggregates and 7D/30D/90D/ALL windows.
- Adds latest-state bookmark/reaction aggregation and excludes reader identities from creator-facing analytics.
- Makes Master Control loading resilient with per-resource cloud diagnostics instead of a single failed permission query blanking the entire panel.
- Fixes root-post comment-lock control to use `commentsLocked`, not post `isLocked`.
- Fixes System Health presence probe to avoid the reserved `__health__` resource identifier.
