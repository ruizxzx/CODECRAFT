# OFFSCRPT V51

## Release
V51 adds account-level dark mode, admin-controlled dual reading-indicator colors, a Creator Studio publishing layer, cloud revision history, resilient drafts/autosave/offline recovery, and real post/article view counters.

## Appearance
- My OFFSCRPT → Settings supports Light/Dark mode.
- Theme choice is cached locally for instant startup and synced to the signed-in user's Firestore account.

## Reading indicators
- Admin Control Panel → Site controls exposes independent colors for the current-page indicator and persistent reading-progress indicator.
- Current-page position retracts when scrolling upward.
- Persistent reading progress never retracts unless reset or explicitly changed by completion logic.

## Creator Studio
- Draft autosave to local storage + Firestore.
- Offline state is surfaced in the editor.
- Recover/discard draft management in Admin Studio.
- Existing articles create cloud revision snapshots before updates.
- Revision History can inspect and restore prior article snapshots.

## Views
- Articles and community posts expose real Firestore-backed view counters.
- Signed-in users generate at most one counted view per content item per UTC day through a deterministic receipt.
- New articles/posts start from zero rather than seeded fake view totals.
- View counts are displayed across article/post surfaces where metadata is rendered.

## Firebase
Deploy the included `firestore.rules` before enabling the new settings, revision, draft, and view-sync behavior. Existing security boundaries are retained; new rules cover the UI theme preference and view-count updates.

## Validation
Source files were checked for TypeScript/TSX transpilation and Firestore rule structural integrity. A full production build should be run in a normal dependency-complete environment.
