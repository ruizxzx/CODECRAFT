# OFFSCRPT V53

## Release
Discovery / Explore FYP build based on V52.1.

### Added
- Rebuilt Explore as a one-page, mixed-content discovery stream for Articles, Community Posts and Series.
- Added Explore tabs: **For You**, **Following**, **Latest**, **Trending**.
- Added infinite-style progressive loading with safe client-side batching (Load More) instead of rendering the entire pool at once.
- Added relevance/freshness/engagement-based ranking for For You and Trending, with format rotation to avoid one content type dominating the stream.
- Added direct article/post/series cards with real author identity, avatar, handle, views and available engagement metadata.
- Added trending topics across articles, posts and series.
- Added direct topic filtering from trending chips and hashtags.
- Added **Surprise Me** and **Go Down the Rabbit Hole** discovery actions.
- Added **Why this?** explanations for discovery ranking.
- Added per-item **Not interested** suppression persisted locally.
- Added one-click share/copy links on Explore items.
- Added keyboard shortcuts: `J` / `↓` for next viewport and `R` for a surprise discovery.
- Added responsive desktop sidebar with trending topics, communities and questions.
- Added empty/loading states and a clear reset path.
- Preserved the existing Community page as the social/conversation surface; Explore is discovery-first.

### Navigation
- Existing `#explore` route remains the Explore entry point.
- No new top-level Community Feed route was introduced.

### Firebase
- No new Firestore collections or permission changes are required for the Explore build.
- Existing account/following/content reads are reused.
- Local Explore suppression is intentionally browser-local and does not modify cloud content.

### Validation
- Explore source was rebuilt against the existing V52.1 type/data model.
- Package remains on the project's existing React/Firebase stack.
- Full dependency-backed production compilation should be run in the deployment environment before release because this working environment may not contain the complete installed dependency tree.

### Product direction
- **HOME** = curated publication front page.
- **BLOG** = article archive.
- **EXPLORE** = mixed-content discovery / FYP.
- **COMMUNITY** = social conversation.
- **SERIES** = structured reading.
- **MY OFFSCRPT** = personal workspace.
