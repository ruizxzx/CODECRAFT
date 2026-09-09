# OFFSCRPT V71.5 — Batch 2 build notes

This release is cumulative from V71. The active Vite entrypoint is `index.html` -> `main.tsx` -> `App.tsx`.

The release adds Batch 2 cloud-backed systems without replacing the V71 article history system.

## Firestore rules syntax hotfix

Fixed the Firestore deployment error `Line 743: Unexpected '}'` by removing one stray closing brace after the `/articles/{slug}/comments/{commentId}` match. The root `firestore.rules` and active `src/firestore.rules` copies are now identical and balanced.

The final closing structure is:
- close article comments match
- close articles match
- close database documents match
- close service
