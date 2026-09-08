# OFFSCRPT V40 — Phase 1 Publishing Upgrade

## Phase 1: Articles + editor + links + media + TOC

### Article editor
- Expanded the Admin Studio article block editor with a dedicated VIDEO block.
- VIDEO supports YouTube, Vimeo, and direct `.mp4` / `.webm` URLs.
- Added "LINK SELECTED TEXT" authoring control to text-based article blocks.
- Inline Markdown-style links remain supported: `[label](https://example.com)`.
- Raw `https://...` and `www...` URLs are auto-linked when rendered.
- Existing linked-image, link, button, code, quote, callout, list, and takeaways blocks remain supported.

### Public/community blog editor
- Added VIDEO block support.
- Added linked-image URL field.
- Added selected-text link insertion for paragraphs/headings.
- Existing article-style content blocks remain compatible.

### Article rendering
- Added embedded YouTube/Vimeo rendering and direct video playback.
- Enhanced table of contents with:
  - stable heading IDs
  - section numbering
  - collapsible navigation
  - active-section highlighting while scrolling
  - deep-linkable headings
  - copy-section-link controls
  - hash navigation on article load
- Existing reading progress, bookmarks, reactions, related articles, and series navigation remain intact.

### Community blog rendering
- Added rendering for VIDEO content blocks created by the public/community editor.

### Data / security
- Added optional video metadata fields to `ArticleContentBlock`.
- No Firestore rule relaxation is required for these Phase 1 fields; article writes remain protected by the existing admin rules and community writes remain governed by their existing rules.
- No existing stored article content is migrated or rewritten.

### Validation
- TypeScript/TSX syntax checked with the installed TypeScript compiler API for all modified source files.
- Full dependency installation could not complete in the build environment before timeout, so a full production Vite build was not available for this build.
