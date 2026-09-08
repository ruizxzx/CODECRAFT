# OFFSCRPT V44 — Series Production QA

## Public
1. Open `/series` and verify cards load, cover images render, and counts/times are correct.
2. Open a series and verify the hero, curriculum, tags, progress, Start/Resume, search, sort and Share controls.
3. Mark several parts complete; refresh; verify completion persists on the same device.
4. Click Start/Resume and verify it opens the first incomplete article.
5. Search by title/tag/excerpt; verify zero-result state.
6. Test mobile width; verify no horizontal overflow and controls remain usable.

## Owner controls
1. Sign in as the series owner and open the series page.
2. Click Edit Series; change title/description/cover/tags/duration; save; hard refresh; verify persistence.
3. Verify unauthorized users do not see owner controls.
4. Delete only a test series and verify its articles remain intact.

## Admin controls
1. Sign in as an authorized admin.
2. Open Manage Parts.
3. Add an article; verify it appears as the next part.
4. Move a part up/down; refresh and verify order persisted.
5. Remove a part; verify the article remains published but leaves the series.
6. Verify revisions are created where existing article content is updated.

## Security
- Ordinary user cannot write `/series/*` metadata.
- Ordinary user cannot modify article `seriesId` or `seriesOrder`.
- Only authorized admin can reorder/add/remove parts in the current architecture.
