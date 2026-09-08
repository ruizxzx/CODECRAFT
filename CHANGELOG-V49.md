# OFFSCRPT V49 — Reading Progress Rebuild

- Rebuilt article reading progress around rendered article-body sentinel geometry.
- Visual top progress bar now tracks current scroll position independently from cloud checkpoint progress.
- Progress endpoint is the final article-content marker, excluding reactions, comments, metadata, and footer.
- Added requestAnimationFrame scroll handling, resize handling, ResizeObserver, font/layout settling recalculation, and high-z-index progress bar rendering.
- Cloud automatic progress remains monotonic for cross-device resume; explicit Mark as Complete remains authoritative until Reset.
- Reaching the article end records 100% read progress but does not silently mark the article completed.
- Reset clears the local completion lock so automatic tracking can resume.
- Added V49 QA checklist.
