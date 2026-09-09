# OFFSCRPT V71.5 — Stability / Infrastructure Verification

## Canonical pipeline

```text
CANONICAL SOURCE TREE
        ↓
TYPE CHECK
        ↓
VITE BUILD
        ↓
STATIC IMPORT CHECK
        ↓
RUNTIME ERROR CAPTURE
        ↓
FIREBASE HEALTH CHECK
```

## Implemented

- Canonical application source is `src/`.
- Removed the stale root application tree and duplicate `src/package.json` / root `index.html` entry.
- Vite now uses `src/` as its application root and the root `public/` directory as the shared public directory.
- Strict TypeScript command: `npm run typecheck`.
- Static syntax parser: `npm run check:syntax`.
- Local import resolution audit: `npm run check:imports`.
- Local named/default export audit: `npm run check:exports`.
- Undefined identifier audit: `npm run check:identifiers`.
- Firebase initialization/import audit: `npm run check:firebase`.
- Firestore rules safety audit: `npm run check:rules`.
- Firebase blueprint/schema audit plus article normalization check: `npm run check:schema`.
- Runtime-risk pattern audit: `npm run check:runtime`.
- Runtime errors are captured by the global error/unhandled-rejection handlers, persisted to Firestore for authenticated users, and queued locally when signed out/offline.
- Queued runtime errors are flushed after authentication.
- Firestore `runtimeErrors` is restricted to authenticated self-reporting and staff review.
- Sync state is standardized in `src/lib/sync.ts`; the known V71 `syncState` undefined pattern is removed.
- Build version is injected as `__OFFSCRPT_VERSION__` and `__OFFSCRPT_BUILD_TIME__`.
- Admin-only `#health` infrastructure dashboard exposes real client-side health results instead of fake green indicators.
- Deployment health command: `OFFSCRPT_DEPLOYMENT_URL=https://your-deployment.example npm run health:deployment`.
- Existing V71 article normalization remains the cloud-content safety boundary.
- Global root and page-level error recovery remain enabled.

## Verification performed in the build sandbox

Passed:

- TypeScript parser / TSX syntax validation: 69 files.
- Undefined-identifier audit: 69 files.
- Local import audit: 69 files.
- Local export audit: 69 files.
- Firebase client/rules audit.
- Firestore rules safety audit.
- Firebase schema/normalization audit: 8 blueprint entities.
- Runtime-risk pattern audit: 69 files.

Blocked by environment:

- `npm run typecheck` could not complete because the sandbox's interrupted dependency installation left several `@types/*` packages unavailable.
- `npm run build` could not execute because the local `vite` binary was unavailable after the dependency installation timeout.

The source and lockfile are retained for a normal clean install. No claim is made that the production Vite build passed in this sandbox.
