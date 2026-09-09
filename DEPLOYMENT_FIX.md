# OFFSCRPT V72.1 — Deployment Fix

## Root cause
Vite is intentionally configured with `src/` as its project root. With no explicit
build output directory, Vite writes `dist/` relative to that root, producing:

`src/dist/`

Vercel was configured with:

`outputDirectory: "dist"`

which points to repository-root:

`dist/`

The production bundle itself completed successfully in the supplied Vercel log;
Vercel failed only after the build because it could not find the configured output
directory.

## Fix
`vite.config.ts` now explicitly sets:

- `build.outDir = path.resolve(__dirname, 'dist')`
- `build.emptyOutDir = true`

This keeps `src/` as the active source root while emitting the bundle to the
repository-root `dist/` directory expected by Vercel.

`vercel.json` remains aligned with `outputDirectory: "dist"`.

## Additional hardening
- Added `check:deployment-config` to prevent this exact mismatch from returning.
- Added the deployment guard to the `verify` pipeline.
- Version bumped to `V72.1` / package version `0.72.1`.
- Preserved the V72 `inputRef` runtime fix in the active `src/components/MentionAutocomplete.tsx`.
- Relative import audit over the active source tree reports 0 missing local imports.

## V72.2 Integrity Hardening

Production data is cloud-only. Creator analytics use real-time Firestore listeners, and stateful bookmark/reaction analytics aggregate the latest reader state instead of counting every toggle as an active action. Client saved-state and CMS UI changes now roll back when cloud persistence fails.
