# OFFSCRPT V68

Article/community runtime hardening release.

- Fix article render crash caused by unsafe optional republisher fields.
- Harden article related-content tag calculations.
- Harden legacy article-card tags.
- Harden Blog category configuration.
- Harden SeriesStrip against malformed Firestore series records.
- Add page-level runtime recovery so a single page cannot blank the entire shell.
- Keep root and `src/` application trees synchronized.

- Fix MentionTextarea production crash caused by referencing an undefined `inputRef`.
- Preserve optional external textarea refs while providing a safe internal ref for mention selection/focus.
- Keep root and `src/` copies synchronized.
