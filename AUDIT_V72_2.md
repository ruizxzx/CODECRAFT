# OFFSCRPT V72.2 — Integrity & Cloud-Sync Audit

## Verified in the source package
- Vite emits to repository-root `dist/`; `vercel.json` expects `dist/`.
- `inputRef` in `MentionAutocomplete.tsx` is explicitly declared and points to either the supplied ref or an internal ref.
- Article, site configuration and Bento CMS data use Firestore realtime subscriptions in the main app.
- Article comments use a Firestore realtime listener.
- Signed-in user saves now use a per-account Firestore realtime listener; cloud state is authoritative across tabs/devices.
- Creator analytics now use a realtime Firestore analytics listener per owned article; comment counts also listen to Firestore changes.
- Bookmark/reaction analytics aggregation uses the latest state per reader rather than counting every toggle as an active state.
- Profile photo hydration now uses the correct `photoURL` field.
- Optimistic save and CMS UI changes roll back when cloud persistence fails.
- Production article loading no longer silently replaces failed cloud data with the bundled local article archive.

## Known limitations — not honestly claimable as 100% production-proof
1. Client-written analytics are not cryptographically trustworthy. A malicious client can fabricate analytics writes that satisfy the current Firestore shape rules. A truly authoritative analytics system requires trusted server-side ingestion (Cloud Functions/Cloud Run/App Check + server validation, or equivalent).
2. Article/community counter fields such as views/reactions/follower counts contain client-mediated update paths. They are protected by ownership/shape checks, but some counters are not fully server-authoritative.
3. The environment used for this audit does not contain a complete `node_modules` installation. `npm ci` cannot finish offline because a package tarball is not cached, so a fresh local production build and TypeScript compile could not be rerun here.
4. Firestore emulator integration tests were not executable because the Firebase emulator/toolchain is not installed in the package runtime environment.

## Conclusion
The package is materially hardened versus V72.1, but it is not scientifically valid to call it “100% bug-free” or “100% real/anti-fraud analytics” without running the deployed application against the real Firebase project and moving trust-sensitive analytics/counters to a server-authoritative backend.

## Additional content-safety correction
- Global comment search now excludes Firestore comments marked `isHidden` or `isDeleted`, so moderation state is respected in search results.
