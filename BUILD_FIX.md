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


# OFFSCRPT V68 Mention Autocomplete Runtime Fix

## Root cause
- `components/MentionAutocomplete.tsx` and `src/components/MentionAutocomplete.tsx` accepted an optional `textareaRef` prop but referenced `inputRef` without declaring it.
- Opening/using the mention autocomplete path could therefore throw `ReferenceError: inputRef is not defined` and trigger the page runtime error boundary.

## Fix
- Added an unconditional internal `useRef<HTMLTextAreaElement>(null)` hook.
- The component now uses the supplied `textareaRef` when present, otherwise the internal ref.
- The textarea, cursor calculation, mention insertion, focus, and selection restoration all use the same resolved ref.
- Root and `src/` copies are synchronized.

## Validation
- Confirmed the production error's undefined `inputRef` reference is removed from both application trees.
- The source patch is localized to the mention autocomplete ref handling; no Firestore data or application data files were changed.
- A full Vite build could not be executed in this environment because dependency installation timed out and removed `node_modules`; the supplied project retains its original lockfiles for a normal clean install/build.
