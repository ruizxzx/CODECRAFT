# OFFSCRPT V43 — Phases 2 + 3 + 4

## Phase 2 — Series / structured publishing
- Added `series` Firestore collection and typed `Series` model.
- Public Series Library and individual series pages.
- Article publisher can assign an article to a series and set its part number.
- Article series navigation now shows part progress plus Previous / Next controls.
- Public discovery surfaces series in Explore.

## Phase 3 — Creator / audience layer
- Public creator pages at `#creator/<username>`.
- Creator pages show selected articles, selected series, stats and creator identity.
- Community profiles now expose a Series tab.
- Follow/follower infrastructure remains integrated with the existing Firebase social graph.

## Phase 4 — Creator page customization
- Owners can open `CUSTOMIZE PAGE` from their profile.
- Creator Page Builder supports hero title, tagline, hero text, theme color, layout, featured articles, featured series, ordering and stats/social visibility flags.
- Creator page configuration is stored on the user's Firestore profile.

## Security
- Added Firestore rules for the new `series` collection.
- Extended user-profile update permissions for owner-controlled `creatorPage` configuration.
- Existing admin/moderator security boundaries are preserved.

## Validation
- TypeScript/TSX syntax validation passed for all modified files using the TypeScript compiler parser.
- Full dependency install and Vite production build were not available in this environment because `npm ci` timed out before dependencies completed.
