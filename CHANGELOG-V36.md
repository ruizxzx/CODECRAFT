# OFFSCRPT V36 — Published Creator Edit Synchronization

## Fixed
- Published public creator blogs now resolve their canonical source from both root `posts/{postId}` and `communities/{communityId}/posts/{postId}`.
- Main publication now live-refreshes from its source post document, so creator edits propagate without requiring a manual page refresh.
- Public edits to a blog that is already published on Main set `editReviewStatus: pending` and retain the `editedAt` marker.
- Master Control Posts now recognizes both root `type: blog` and community `postType: blog` records.
- Added `APPROVE EDIT` in Master Control for published creator blogs with pending edits.
- Approval clears the pending-review warning while preserving the EDITED marker and sync metadata.
- Master/admin edits to already-published blogs are automatically marked approved.
- Article cards, article pages, and public Social/Blogs surfaces display the pending-review state where applicable.

## Data safety
- Existing creator posts and publications are not deleted or migrated.
- Republished article identity and creator attribution are preserved.
- No new Firestore index is required.
