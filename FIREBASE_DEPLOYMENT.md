# OFFSCRPT V36 Firebase Deployment

## Firestore Rules
Use the included `firestore.rules` if your deployed rules predate V35/V36. V36 does not require a new index.

## Indexes
No manual Firestore index change is required for V36.

## Data
V36 uses the existing `posts`, `communities/*/posts`, `articles`, and notification collections. No migration or destructive data operation is required.
