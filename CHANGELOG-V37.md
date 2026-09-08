# V37 — Public creator edit + republished blog review fix

- Fixed Firestore root-post update rules so creators can edit their own public blogs, including Series metadata fields.
- Published/republished creator blogs remain editable by their original creator.
- Edits to republished blogs set editReviewStatus=pending and preserve the source post as canonical.
- Main-site article hydration reflects source edits and shows EDITED / EDIT PENDING REVIEW until a master admin approves.
- Master admin approval copies the latest source content/metadata to the main article and clears review status.
- No destructive migration of existing posts or articles.
