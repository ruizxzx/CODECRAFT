# OFFSCRPT V72.2

Production integrity hardening release.

- Cloud-only article data in production; no silent local archive fallback.
- Creator analytics use live Firestore listeners.
- Stateful bookmark/reaction metrics are aggregated from latest reader state.
- Saved-state UI rolls back when Firestore synchronization fails.
- Site CMS UI rolls back when Firestore persistence fails.
- User follower counter writes are tied to the corresponding follower relationship.

Release: 72.2
