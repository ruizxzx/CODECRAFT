# OFFSCRPT V75.7

Site-wide Cloudflare R2 media upload expansion.

- Added a Master Admin Media Center with destination folders and multi-file uploads.
- Added upload support across creator publishing, community posting, series editing, creator pages, carousel management, site branding and Master User Control.
- Added image previews and video previews after selection in major media fields.
- Added multiple-file upload support to the shared media uploader.
- Added `site` media storage for Master Admin site assets.
- Added admin-targeted profile uploads so Master Control stores another user's avatar/cover under the target user's media path.
- Kept Firestore as the application database; media binaries remain in Cloudflare R2 and URLs are stored with content.
