# OFFSCRPT V61

## Access control + direct editorial management

- Admin Studio / staff entry points are hidden unless the signed-in account is a master admin or an explicitly assigned site moderator.
- Moderator access is determined from `siteModerators/{uid}` and is not granted by UI state alone.
- Moderators receive moderation-only tools; master settings, global CMS, article authoring and article deletion remain master-admin only.
- Blog now exposes direct master-admin `WRITE NEW BLOG`, `EDIT BLOG`, and `DELETE` actions backed by Firestore.
- Added admin edit/create request handoff between Blog and Admin Studio.
