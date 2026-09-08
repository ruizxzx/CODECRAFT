# OFFSCRPT V68 Bug Audit

## Root causes found in V67
1. `components/MentionAutocomplete.tsx` and `src/components/MentionAutocomplete.tsx` referenced `inputRef` without declaring it. This caused `ReferenceError: inputRef is not defined` when article comments/community editor rendered the shared mention textarea.
2. `components/CommunityEditor.tsx` referenced `syncState`/`setSyncState` without declaring the state pair. This would fail when the community composer mounted.
3. `components/CommunityProfileView.tsx` referenced `isAdmin` without defining it. This would fail when rendering profile post actions.
4. `components/ExploreView.tsx` fetched community users but destructured only six Promise results, then used the missing seventh result `u`.
5. `lib/cms.ts` called `writeAdminAudit` without importing it. This would fail when an admin changed CMS state.
6. `components/SearchModal.tsx` exposed a `topics` tab while `SearchTab` omitted the `topics` member.
7. `components/ArticleCard.tsx` assumed `article.author` existed; a legacy article without author data could crash rendering.

## Checks performed
- Searched all TSX files for `.current` references and verified they are backed by declared refs after the fix.
- Performed a static TypeScript diagnostic pass with external-module stubs; no remaining `TS2304`, `TS2552`, `TS2454`, `TS2448`, `TS2459`, or `TS2345` diagnostics remained from the audited code paths.
- Confirmed root and `src/` copies of shared files are synchronized.
- Confirmed the final archive is structurally valid.

## Deployment note
A full Vite build was not available in this container because the extracted dependency tree is incomplete. The Vercel build environment should run the normal `npm ci` followed by `npm run build`.
