# OFFSCRPT V69

Authenticated-runtime hardening release.

## Critical fix
- Fixed `ReferenceError: inputRef is not defined` in MentionTextarea.
- MentionTextarea now owns a safe internal textarea ref when a parent ref is not supplied.
- Preserves the existing parent textarea ref when supplied.

## Additional latent runtime fixes
- Added missing CommunityEditor autosave sync state.
- Added missing admin-role derivation in CommunityProfileView.
- Fixed Explore creator Promise destructuring.
- Restored the missing `writeAdminAudit` import used by CMS operations.
- Restored orange creator theme fallback for uncustomized profiles.

## Source integrity
- Synchronized modified application files between the root and `src/` trees.
