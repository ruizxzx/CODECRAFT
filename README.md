# OFFSCRPT V50 — Dual Reading Indicators

## This release

V50 adds a second, independent article-position indicator while preserving the existing cloud reading-progress system.

### Reading indicators

At the very top of every article there are now two joined 3px bars:

1. **Blue page-position line** — shows the reader's current viewport position inside the article. It moves forward while scrolling down and retracts when scrolling up. It does not affect saved reading progress.
2. **Reading-progress line** — shows the highest reading progress reached. It is monotonic during the visit and therefore does not retract when the reader scrolls upward. If the article is manually completed, it stays at 100% until the reader uses Reset & Recalculate.

### Progress model

- Current viewport position and persisted reading progress are intentionally separate.
- The article endpoint is based on the real article-content start/end markers, excluding reactions, comments, metadata, related content and footer areas.
- Automatic cloud checkpoints remain monotonic.
- Manual completion remains sticky at 100%.
- Reset removes the completion/progress document and allows automatic tracking to resume.
- Layout changes from images, videos, fonts, resize and content height continue to trigger recalculation.

### Existing platform functionality retained

- Structured article editor with rich content blocks, links, buttons, images, code, callouts and video.
- Table of contents with active section navigation and deep links.
- Series library/detail pages, ordering, previous/next navigation and cloud-synced series progress.
- Homepage/blog series discovery.
- Account-based history, bookmarks/reading queue, dashboard and notification preferences.
- Carousel image/canvas builder with Firebase synchronization.
- Firebase-backed reactions, comments, likes and account identity.
- Admin/moderator security model and Firestore protections.

## Firebase / deployment

No new Firestore permissions are required for V50. Existing reading-progress rules continue to protect account-owned progress documents.

Deploy the rules currently included in this package whenever your Firebase project is behind the version in the ZIP.

## Validation

- `ArticleView.tsx` TypeScript/JSX transpile validation: passed with zero diagnostics.
- ZIP integrity: validated.
- Full `npm run lint` / `npm run build` cannot be claimed in this environment because the supplied dependency installation is incomplete (`vite` is unavailable and TypeScript reports missing ambient type packages).

## Manual acceptance test

1. Open a long article at the top: blue line near 0%, reading line at the saved/highest progress.
2. Scroll down: both advance.
3. Scroll back up: blue line retracts; reading line does not.
4. Reach the last actual article-content line: both can reach 100%; footer scrolling must not be required.
5. Refresh: saved cloud progress remains.
6. Mark complete: reading line stays at 100% while scrolling anywhere.
7. Reset & Recalculate: completion lock is removed and automatic tracking resumes.
