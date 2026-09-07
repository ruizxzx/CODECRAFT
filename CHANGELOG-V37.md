# OFFSCRPT V37 — Published Blog Edit / Review Sync Repair

## Fixed
- Public creators can edit blogs after an admin has published them on the main site.
- Creator edits of a published blog remain stored in the creator's canonical Firebase `posts/{postId}` record.
- Published main articles immediately hydrate from the canonical creator blog, so edited title/content/metadata appear site-wide while the edit is pending review.
- Pending creator edits surface `EDITED` and `EDIT PENDING REVIEW` consistently in article cards, article pages, public blog listings, and admin moderation.
- Firestore rules now explicitly permit the creator's pending-review edit fields while preventing creators from self-approving those fields.
- Approved edits clear the pending warning while retaining the `EDITED` indicator and synchronize the approved content to the main `articles/{slug}` record.
- Community blogs follow the same pending-review behavior when their source has been published to the main site.
- Post edits now read the document back from Firebase and fail loudly if the change was not confirmed in the cloud.

## Safety
- No existing posts, articles, discussions, or community content are migrated or deleted.
- No new Firestore composite index is required.
