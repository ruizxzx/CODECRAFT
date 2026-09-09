# OFFSCRPT V72 — Cumulative Production Release

## Release focus
Advanced discovery and creator profiles.

### Discovery
- Explore supports For You, Following, Latest and Trending mixed-content feeds.
- Global search now covers articles, posts, series, creators, topics, comments and tags.
- Search suggestions can deep-link directly to creators, topics and series.
- Dedicated topic pages at `#topic/<slug>` with article, series and community sections plus relevant/latest filters.
- Trending topics aggregate signals from articles, posts and series.
- Explore includes creator discovery/popular creators and content-type filters.
- Direct deep links are used for creators, topics, series and articles.

### Creator profiles
- Public creator landing pages with cover, avatar, verification, follower/following counts and publishing stats.
- Follow/unfollow directly from the creator page with cloud persistence.
- Featured articles and series with configurable ordering.
- Public posts section.
- Custom hero title, tagline and description.
- Creator theme color and layout modes: grid, list, magazine.
- Optional about section.
- Custom external links with URL validation.
- Existing social profile links are surfaced consistently.
- Shareable creator links.

### Article discovery improvements
- Existing related-article section retained.
- Related-series section added using shared topics/tags.

### Cloud/sync
- Creator page configuration is stored on the creator's Firestore profile.
- Follow/unfollow uses the existing account graph.
- Topic pages read current cloud content instead of a hardcoded catalog.
- No additional public write permissions are required for the new read-only discovery surfaces.

### Compatibility
- Existing carousel, reading progress, series, dashboard, notification, draft, navigation and admin systems are preserved.
- V54 toast and navigation systems remain compatible.

### Validation
- Modified TS/TSX files passed TypeScript parser diagnostics.
- A complete production dependency install/build could not be completed in the build environment because the supplied dependency tree is incomplete and `npm ci` timed out.
- Run `npm ci` and `npm run build` in the deployment environment before release.


## V56 — Reading Progress Precision

- Rebuilt article progress anchors around the actual reader-reaction boundary.
- Current page-position indicator retracts when scrolling upward.
- Persistent reading progress remains monotonic until reset or explicit completion reset.
- Reading reaches 100% when the Reader Reactions panel reaches the bottom edge of the viewport.
- Added RAF-based smooth tracking, resize/orientation handling, and layout recalculation after media/font loading.
- Resume navigation uses the same end boundary as reading progress.


## V56 — Precision article progress (latest)

- Blue current-position tracker begins when the article body first enters the viewport and retracts with upward scrolling.
- Persistent reading progress remains monotonic and is driven by the actual highest reading percentage reached.
- Both trackers now share a precise document-coordinate model; 100% is reached when the Reader Reactions panel reaches the bottom edge of the viewport.
- The progress engine recalculates on scroll, resize, orientation changes, media/font layout changes, and delayed layout shifts.
- The end boundary used by Resume Reading matches the reading-progress boundary.


## V65 stability hotfix

V65 hardens the Blog and Article rendering path against legacy/malformed Firestore article documents by normalizing cloud records before they reach React and by adding defensive fallbacks for article arrays and author metadata. This prevents one malformed historical article from crashing the entire Blog or Article view.
