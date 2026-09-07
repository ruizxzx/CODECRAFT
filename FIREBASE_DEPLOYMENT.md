# V33 Firebase Deployment

No new index is required for V33.

Publish `firestore.rules` only if your deployed rules are older than the current V32/V33 rules. The creator-attribution repair itself is application-side and does not require a data migration.

Existing articles/posts are preserved.

## V36 update
Publish the V36 `firestore.rules` in Firebase Console. No new index is required. The rules include the linked-article creator edit path and source-edit approval metadata.
