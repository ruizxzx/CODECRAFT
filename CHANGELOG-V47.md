# OFFSCRPT V47

## Reading completion / progress
- Manual completion is sticky at 100% until explicit reset.
- Scroll-based progress is blocked until the cloud progress record is hydrated, preventing races that could overwrite a completed article.
- Progress endpoint is the article-content sentinel; footer/reactions no longer affect the percentage.
- Reset deletes the cloud progress record and returns the article to automatic tracking.

## History
- Added private, account-scoped reading history.
- History uses deterministic article document IDs, so opening the same article repeatedly updates one record instead of creating duplicates.
- Added realtime history subscription, remove-per-item and clear-all actions.
- Added signed-out state with Google sign-in CTA.

## Access / productivity
- Added Ctrl/Cmd+K global command palette with navigation actions.
- Added Reading History to the main menu/library.
- Fixed community create navigation so command actions can open the composer state correctly.

## Security
- Added Firestore rules for private user history. Existing reading-progress privacy rules remain in force.
