# V38 — Visual carousel builder + staff access hardening

- Added a cloud-synced visual carousel builder for admin users.
- Carousel slides can now position/zoom the source image and click the preview to choose a focal point without re-uploading the image.
- Added editable overlay elements: text, badges and CTA buttons with position, font size, text/background colors and optional links.
- Added carousel pagination dots while preserving the existing auto-advance and arrow controls.
- Existing slide data remains backward compatible; legacy slides fall back to centered crop, 100% zoom, dots enabled and no overlay elements.
- Fixed moderator membership detection so an assigned moderator can verify their own `siteModerators/{uid}` record without opening the moderator registry to everyone.
- Hardened Firestore user-profile rules to prevent non-admin users from self-assigning `moderator` or `master_admin` platform roles during profile creation or update.
- Master Control remains admin-only; moderators are restricted to moderation surfaces.
