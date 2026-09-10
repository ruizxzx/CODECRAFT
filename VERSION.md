# OFFSCRPT V77.0.4

## Theme + Runtime Hardening

- New visitors now default to light mode instead of inheriting the device OS dark-mode preference.
- Explicit guest preference remains respected through the existing local theme cache.
- Signed-in account theme preference remains cloud-synced through the existing Firestore preference document.
- Fixed dynamic PWA manifest `start_url` and `scope` to use absolute origin URLs, preventing blob-manifest route warnings.
- No existing Q&A, feed, recommendation, R2 media, crop/preview, community, or moderation capabilities were removed.
