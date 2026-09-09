V75.10 — Firestore Quota-Safe Profile Updates

Fixes misleading profile media-save failures when Firestore returns quota/resource-exhausted errors. Reduces unnecessary profile reads and re-reads, keeps R2 media upload independent, and provides an accurate quota-specific UI message.
