# OFFSCRPT Social / Community — Firebase Console deployment

This build uses the existing Firebase project `krishficient-portfolio` and Firestore `(default)`.

## 1. Firestore Rules

Firebase Console → Firestore Database → Rules.

Replace the current rules with the `firestore.rules` included in this project and click **Publish**.

The updated rules cover:
- unified communities
- community owners and moderators
- creator/admin editing and deletion
- community members and roles
- community posts and votes
- questions and answers
- topics and topic followers
- direct messages
- reports and admin moderation

## 2. Firestore Indexes

No new composite index is required for the unified Social / Community build.

If the project already has the `comments / authorId / Collection group / Ascending` single-field configuration from the previous batch, keep it enabled.

## 3. Important for the previous "Missing or insufficient permissions" error

The source now makes community post creation the primary write and treats the community post counter update as secondary, so an older ruleset cannot cause the entire post creation to fail after the post itself is accepted.

However, the **new `firestore.rules` must still be published** before testing owner/admin moderation and all new Social / Community operations.
