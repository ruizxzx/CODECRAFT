# V64 Build Hotfix

Fixed the Vercel production build error in `src/components/ExploreView.tsx`.

Cause: the label `Editor's Picks` was wrapped in a single-quoted TypeScript string, so the apostrophe terminated the string early and esbuild reported `Expected "]" but found "s"`.

The label is now a valid double-quoted string. The duplicate root `components/ExploreView.tsx` copy was synchronized as well.


## V65 Blog runtime fix

Observed production symptom: `/article/...` rendered the application runtime-error boundary instead of the article.

The V64 path allowed raw Firestore article documents into the React tree. Some legacy documents can omit `tags`, `content`, or nested `author` data while still being valid enough to be returned from `articles`. Components such as BlogView and ArticleView directly called `.forEach()`/`.map()` on those fields.

V65 normalizes cloud article records at the CMS subscription/fetch boundary and adds defensive UI fallbacks. This prevents one malformed legacy article from crashing the entire React tree.
