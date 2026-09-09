# OFFSCRPT V66 Reliability / Route Fix

This build addresses production route failures observed on article and community-post deep links.

## Article deep-link hardening
- Normalizes legacy and malformed article content blocks before rendering.
- Guarantees `content`, `items`, and `codeBlock` shapes used by the reader are safe.
- Defensively handles missing/non-array series tags and malformed legacy records.
- Preserves Firestore-backed article hydration and realtime updates.

## Community post deep-link hardening
- `getPost(postId)` now resolves both root `posts/{postId}` documents and community-scoped `communities/{communityId}/posts/{postId}` documents.
- Community-scoped posts normalize `postType` to the UI's `type` field.
- Community comments, edits, deletes, votes, reposts and related writes resolve the actual post location.
- Existing community deep links such as `#community/post/{postId}` continue to work.

## Validation
- Modified TS/TSX files transpile successfully with TypeScript's JSX transpiler.
- Root and src copies of modified files are synchronized.
