# OFFSCRPT V48

## Reading progress
- Fixed missing article content root ref that prevented automatic scroll tracking.
- Progress is bounded by the rendered article body, ending at the final article content marker instead of reactions/footer.
- Automatic progress is monotonic and no longer regresses when readers scroll upward or reopen at the top.
- Manual completion remains sticky at 100% until explicit reset.
- Firestore rules now reject automatic downgrades from completed=true to completed=false.
- Saved progress checkpoints are written to account-scoped Firestore documents.

## Account hub
- Added My OFFSCRPT dashboard.
- Added reading queue with deterministic cloud IDs to prevent duplicates.
- Added unified account activity from cloud history, saves, and notifications.
- Added notification preferences and cloud persistence.
- Added dashboard shortcuts to history, saved items, notifications and preferences.

## Draft resilience
- Added cloud and local autosave for public blog composer.
- Added cloud and local recovery for community editor.
- Added cloud and local recovery for admin article drafts.

## Navigation
- Added My OFFSCRPT and Notification Settings to command palette.
- Added account shortcuts to the navigation drawer.
- Added READ LATER control to article pages.
