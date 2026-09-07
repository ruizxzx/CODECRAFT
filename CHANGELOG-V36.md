# OFFSCRPT V36

## Republished creator-edit synchronization
- Public/root and community blog edits now synchronize atomically to a linked main article when that source blog is republished.
- Main article retains the original creator as author and the admin as republisher.
- A creator edit sets `sourceEditPendingApproval=true` on the linked main article.
- Main article displays an explicit pending-review warning with creator handle and edit time.
- Master admin can approve the creator edit from Admin Control; approval clears the warning and syncs the source record.
- Existing source content is preserved; no destructive migration.

## Public blog editing
- Existing public blog edits use the same cloud update path as new blogs.
- Optional fields are sanitized before Firestore writes.
- Edited timestamps are persisted and surfaced across article cards/views.
