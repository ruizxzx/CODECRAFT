# OFFSCRPT V37 Firebase Deployment

## Required
Publish the included `firestore.rules` in Firebase Console:

Firestore Database → Rules → replace with this file → Publish.

The rules change is required so public creators can edit published blogs and set the controlled `editReviewStatus: pending` review state without granting them approval authority.

## Indexes
No new Firestore index is required for V37.

## Data
Existing posts, articles, communities, profiles, discussions, and messages are preserved. V37 does not run a data migration.

## V45 rule changes
Deploy the included `firestore.rules` before using V45 reading-progress and series-follow features.

Added private account-scoped progress documents at:
`users/{uid}/readingProgress/{articleSlug}`

Added series follower membership at:
`series/{seriesId}/followers/{uid}`

The progress collection is not publicly readable. Series follower documents are readable for aggregate-count queries but can only be created/deleted by the corresponding signed-in account.

No rules were added that expose per-user article-view receipts.
