# OFFSCRPT V31

## Main publication attribution
- Main-site republishing now preserves the original creator as the visible article author, including their avatar, name, handle and verification state.
- The article also records the admin who republished it and shows a separate republished-by attribution.
- Source community/public post remains linked and is not deleted.

## Publishing & reading
- Public blog composer supports optional article series metadata.
- Main articles expose a table of contents for heading blocks.
- Article series navigation is rendered when series metadata is present.
- Added durable signed-in view receipts without allowing clients to mutate protected article documents.
- Added per-user article reactions: Like, Useful, Insightful, Interesting.
- Related articles now rank by category/tag relevance before recency.
- Admin article edits preserve a revision snapshot in `articleRevisions`.

## Cloud safety
- Reactions write only to the authenticated user's own reaction document.
- View receipts write only with the authenticated user's UID.
- No new composite Firestore index is required.
- TypeScript/TSX parse validation: 40/40 files clean.
