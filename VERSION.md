# OFFSCRPT V74.3

Stability & documentation cleanup. No user-facing features were added, changed, or removed.

- Deleted the duplicate root-level `components/`, `lib/`, `data/`, `App.tsx`, `main.tsx`,
  `index.html`, `index.css`, `vite-env.d.ts`, `types.ts`, `firestore.rules` tree. This tree was
  never the active build source (`src/` is, per `vite.config.ts`'s `root` setting) and had
  drifted out of sync with `src/` on 25 component files and 9 lib files, including three
  features (presence, universal sharing, reporting) that existed only in `src/` and were never
  even copied to the root tree despite prior release notes claiming synchronization.
- Fixed `firestore.rules.test.ts` and `scripts/check-firebase.mjs` /
  `scripts/check-rules.mjs`, which read `firestore.rules` from the repo root — updated to read
  `src/firestore.rules`, the actual canonical file, now that the root duplicate is gone.
- Wired `App.tsx`'s page-level error boundary (`PageErrorBoundary.componentDidCatch`) to
  `lib/runtime.ts`'s `reportRuntimeError()`. Previously this boundary — the one that renders
  "THIS PAGE COULD NOT RENDER" on a component crash — only logged to the browser console, so
  page-level crashes never reached the runtime-error pipeline that both `main.tsx`'s
  app-level boundary and the global `window.error`/`unhandledrejection` listeners already used.
- Hardened `lib/masterControl.ts`'s internal `audit()` helper to require
  `checkIsAdmin(...)` or `resolveMasterAccess(...)` before writing to `adminAuditLog`,
  matching the authorization standard already used by `lib/audit.ts`'s `writeAdminAudit()`.
  Previously it wrote an audit entry for any signed-in caller with no privilege check.
- Deleted 15 single-use, per-release scratch files (`AUDIT_V72_2.md`, `BUILD_FIX.md`,
  `DEPLOYMENT_FIX.md`, `FIREBASE_DEPLOYMENT.md`, `MASTER_CONTROL_V73.md`,
  `MASTER_CONTROL_V74.md`, `MASTER_CONTROL_V74_1.md`, `V73_VALIDATION.md`,
  `V74.1_VALIDATION.md`, `V74.2_VALIDATION.md`, `V74_DEPLOYMENT_CHECKLIST.md`,
  `V74_VALIDATION.md`, `security_spec.md`, `BUILD_COMPARISON_REPORT.txt`,
  `BUILD_VALIDATION.txt`) and two stale duplicate files that were one version behind the real
  ones and never read by any tool (`src/VERSION.md`, `src/package.json` — Vite/npm only ever
  read the root `package.json`). Their operationally relevant content (deploy-rules-before-use
  reminders, etc.) is folded into `README.md`.
- Replaced `README.md` with a project overview covering architecture, the `lib/` module map,
  the admin/moderator permission model, the `npm run verify` check pipeline, and — explicitly
  — the root-duplicate-tree failure mode described above, so it doesn't recur a third time.
- All V74.2 fixes (the `reportResponse` crash fix) and every feature from V72–V74
  (analytics, recommendations, comments, sharing, moderator permissions, reporting,
  presence, system health) are preserved as-is; this release only touched error-boundary
  wiring, one authorization check, dead/duplicate files, and documentation.
