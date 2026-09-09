# OFFSCRPT V75.12

## Firestore Quota & Usage Optimization

- Added bounded in-memory Firestore document/query/count caching.
- Deduplicated concurrent profile and recommendation reads.
- Added quota cooldown protection that does not retry `resource-exhausted` operations.
- Removed the duplicate recommendation fallback read after initial realtime listeners.
- Reduced recommendation listener limits and moved low-priority search/reaction indexes to throttled refreshes.
- Replaced up to 100 per-series follower checks with a single bounded collection-group query plus mirrored fallback.
- Cached public-profile directory, notification preferences, series lists and platform count queries.
- Throttled repeated admin author synchronization on authentication refresh.
- Cached platform analytics payloads to reduce repeated dashboard queries.
- Invalidated profile caches after successful profile writes.
