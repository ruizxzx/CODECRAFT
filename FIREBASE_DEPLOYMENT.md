# OFFSCRPT v25 — Firebase Console deployment

Use the existing Firebase project `krishficient-portfolio` and Firestore `(default)`.

## Firestore Rules

Firebase Console → Firestore Database → Rules.

Replace the current rules with the `firestore.rules` included in this build and click **Publish**.

The rules include:
- admin access for Master Control moderation
- community owners/moderators
- community post moderation
- questions, answers and topics
- direct messages
- reports and reporter notifications
- user profile social links, including Instagram
- site-config backup storage

## Firestore Indexes

**No new index is required for v25.**

Keep any existing `comments / authorId / Collection group / Ascending` configuration already deployed from earlier builds; do not create a new manual index for v25.

## Notes

The profile post aggregation no longer relies on a collection-group `posts` index; it reads the existing public community collections and merges matching posts with the existing root `posts` collection.

Existing blog/discussion documents are preserved. New blog/discussion posts continue using the original `posts` collection so old profiles and historical content remain compatible.
