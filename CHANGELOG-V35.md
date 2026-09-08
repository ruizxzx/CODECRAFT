# OFFSCRPT V35 — Production Repair

- Fixed public creator blog editing by stripping undefined Firestore fields.
- Root blog edits are confirmed by re-reading the updated post from Firestore before reporting success.
- Added direct admin-only Publish/Unpublish on opened public blog posts.
- Added live hydration of published main articles from their source creator post so edits remain synchronized across the public article.
- Added EDITED indicators to public article cards, articles, and social/community listings.
- Added production-facing creator/republication attribution preservation.
- Fixed duplicate declarations and local type errors identified during static checks.
- No destructive migration of existing content.
