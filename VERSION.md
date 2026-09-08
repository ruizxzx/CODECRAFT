# OFFSCRPT V65 — Blog Runtime Safety & Cloud Article Normalization

Analytics, discovery, creator defaults, mention autocomplete, audit logging, and cloud draft versioning.


## V65 Hotfix

- Added `normalizeArticleRecord()` to sanitize legacy/malformed Firestore article documents before they enter the React UI.
- Normalized article `content`, `tags`, author metadata, title/excerpt/category, publication date, and reading time.
- Hardened Blog and Article views against missing legacy arrays/fields.
- Removed duplicate App imports introduced during the analytics/discovery batch.
- Kept root and `src/` source trees synchronized.
- Goal: an invalid/partial historical article document must not crash the entire Blog or Article page.
