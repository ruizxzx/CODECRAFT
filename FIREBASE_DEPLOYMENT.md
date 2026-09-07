# OFFSCRPT V37 Firebase Deployment

## Required
Publish the included `firestore.rules` in Firebase Console:

Firestore Database → Rules → replace with this file → Publish.

The rules change is required so public creators can edit published blogs and set the controlled `editReviewStatus: pending` review state without granting them approval authority.

## Indexes
No new Firestore index is required for V37.

## Data
Existing posts, articles, communities, profiles, discussions, and messages are preserved. V37 does not run a data migration.
