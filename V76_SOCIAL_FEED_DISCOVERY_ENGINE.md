# V76 — Social Feed + Discovery Engine

## Release
- Unified home discovery feed with FOR YOU, FOLLOWING, LATEST, TRENDING, DISCUSSIONS and COMMUNITIES.
- Algorithmic and chronological feed modes with account-synced preference.
- Recommendation cards now support cloud-synced not-interested, show-less-like-this and creator mute actions.
- Existing personalization signals remain the source for the For You ranking: reading history, saves, follows, topics, series, reading progress, searches, reactions, freshness, engagement and diversity.
- Cold-start topic selection remains available and seeds the recommendation profile.
- Continue Reading remains intact and is surfaced before the feed.
- Discussion and community discovery are loaded on demand through bounded, quota-aware cached queries.
- Existing R2 media, Firestore application data, authentication and realtime signal architecture are retained.

## Backend/sync
Feed preferences are stored at `users/{uid}/feedPreferences/default` and are protected so users can only manage their own preference document. Feed discovery reads use the existing Firestore optimization layer with cache/stale-on-quota behavior.
