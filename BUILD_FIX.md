# V64 Build Hotfix

Fixed the Vercel production build error in `src/components/ExploreView.tsx`.

Cause: the label `Editor's Picks` was wrapped in a single-quoted TypeScript string, so the apostrophe terminated the string early and esbuild reported `Expected "]" but found "s"`.

The label is now a valid double-quoted string. The duplicate root `components/ExploreView.tsx` copy was synchronized as well.
