# OFFSCRPT V71

Article Version History / Revision System.

- Firestore-backed `articleRevisions/{revisionId}` snapshots.
- Automatic snapshot before admin edits.
- Initial snapshot for newly created articles.
- Manual revision snapshots via HISTORY workflow.
- Two-revision field comparison.
- Safe restore: current article is snapshotted before restore; restore result is recorded.
- Duplicate revision into a new unpublished article with a unique slug.
- Admin-only revision access enforced in client and Firestore rules.
- Base source uses the authenticated MentionTextarea fix from V68.
