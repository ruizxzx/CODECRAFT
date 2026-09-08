# OFFSCRPT V39 — CAROUSEL CANVAS + UNIVERSAL LINKS

## Carousel
- Added `IMAGE + DESIGN` and `BUILD FROM SCRATCH` modes.
- Scratch mode supports a configurable background color without an image.
- Added visual layers for text, badge, linked text, and buttons.
- Every linked layer can target an external URL or an internal route.
- Existing image focal point, crop/zoom, slide-level link, ordering, dots, and realtime Firestore sync remain supported.
- Legacy image carousel slides continue to render with fallback `image` mode.

## Publishing / Links
- Added `LINK` and `BUTTON` content blocks to the admin article publisher.
- Added linked-image support via an optional image click-through URL.
- Added the same link/button/image-link capabilities to the public blog composer.
- Added a shared safe rich-text renderer that turns `https://...`, `www....`, and markdown-style `[label](url)` links into clickable anchors.
- Community posts and article comments now render clickable links instead of leaving URLs as plain text.
- Mention navigation remains supported alongside automatic URL linking.

## Security / Cloud
- Carousel writes remain restricted to the existing admin-only Firestore rule.
- New carousel presentation fields require no rule relaxation because the `carousel_slides` collection is already admin-write-only.
- Existing moderator/admin separation is preserved.

## Validation
- All modified TypeScript/TSX files passed TypeScript transpilation syntax checks.
- Full dependency installation/build could not be completed in this environment because `npm ci` timed out twice; therefore a production Vite bundle was not generated here.
