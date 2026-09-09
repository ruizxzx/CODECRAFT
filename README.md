# OFFSCRPT

OFFSCRPT is a full-stack creator platform: a technical blog/publication engine with a
built-in social layer (posts, comments, follows, communities), creator analytics, a
personalized recommendation feed, moderation tooling, and a Firestore-authoritative admin
control center. It's a single-page React app backed entirely by Firebase (Auth + Firestore),
deployed as a static build to Vercel.

This README is written for two audiences: a human picking up the repo, and an AI coding
agent working on it. If you're an agent, **read the "Project conventions" section before
editing anything** — it documents a real failure mode this codebase has hit more than once.

---

## Stack

- **React 19 + TypeScript**, built with **Vite 6**
- **Firebase**: Auth (Google sign-in) and Firestore (all app data, no other backend)
- **Tailwind v4** (via `@tailwindcss/vite`) for styling
- **lucide-react** for icons, **motion** for animation
- Deployed as a static SPA to **Vercel** (see `vercel.json`)

There is no server component. All reads/writes go directly from the client to Firestore,
authorized entirely by `src/firestore.rules`. Treat that rules file as a second copy of your
application's authorization logic — a feature isn't done until the rules permit exactly the
read/write shape the client code actually sends.

---

## Project conventions

### `src/` is the only source tree. There is no second copy.

Vite's `root` is explicitly set to `src/` in `vite.config.ts`, and `src/index.html` loading
`src/main.tsx` is the real entry point. **Every application source file lives under `src/`.**

This project has twice accumulated a duplicate top-level `components/`, `lib/`, `data/` tree
(with copies of `App.tsx`, `main.tsx`, `index.html`, etc. at the repo root) that looked like a
mirror of `src/` but silently drifted out of sync — in one case an entire runtime-error
reporting feature existed in one tree and not the other; in another, a component referenced a
variable (`inputRef`) that only failed at runtime for signed-in users, because the file that
actually shipped was not the file that had been edited. **If you ever see a root-level
`components/` or `lib/` directory that mirrors `src/`, it is stale. Delete it — do not try to
keep it in sync by hand.** Editing a file means editing it under `src/`, full stop.

### Verify before you call something done

```bash
npm run verify
```

This runs the full check pipeline: deployment config, `tsc --strict` typecheck, production
build, syntax parse, import resolution, export resolution, **undeclared-identifier detection**
(this is the check that would have caught the `inputRef` bug — it uses the TypeScript compiler
API to flag `TS2304`/`TS2552` diagnostics across every file in `src/`), Firebase client
sanity, Firestore rules structure, schema presence, and runtime-pattern checks. Individual
checks are also available separately (`npm run check:identifiers`, `npm run check:rules`,
etc. — see `scripts/`).

If you change `src/firestore.rules`, also run the actual rules simulator:

```bash
npm test   # or: npx vitest run firestore.rules.test.ts
```

This spins up the Firestore emulator's rules engine (`@firebase/rules-unit-testing`) and
asserts real allow/deny behavior against `src/firestore.rules`, rather than just checking the
file contains certain strings.

### When you add a new Firestore collection

Three things need to agree, or the write will silently fail (Firestore denies by default) or
succeed with a shape nothing else expects:

1. The client write (whatever calls `addDoc`/`setDoc`)
2. `src/firestore.rules` — add a `match` block with a validation function describing the exact
   field shape the client sends. Copy the pattern of an existing collection (e.g.
   `runtimeErrors`, `reports`) rather than starting from scratch.
3. If it's read from an admin/moderator surface, confirm the permission function used
   (`isAdmin()`, `isPlatformModerator()`, `hasModeratorPermission(...)`) matches what you
   actually want to gate on.

A mismatch here doesn't throw a build error — it fails at runtime, in production, for real
users, which is exactly how the `runtimeErrors` collection briefly had client code and
security rules disagreeing on field names (`userId`/`route` vs `uid`/`path`).

---

## Getting started

```bash
npm install
cp .env.example .env       # fill in Firebase Web SDK config
npm run dev                # http://localhost:3000
```

Required env vars (see `.env.example`): `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
`VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`,
`VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`. Do not set a
`VITE_FIREBASE_DATABASE_ID` — this app uses Firestore's default database.

To deploy Firestore security rule changes, publish `src/firestore.rules` via the Firebase
Console (Firestore Database → Rules) or the Firebase CLI. The app will not enforce new
permissions until this is done — the rules file in the repo is not automatically synced to
your Firebase project.

```bash
npm run build       # production build to dist/
npm run preview      # serve the production build locally
```

---

## Architecture

```
src/
  App.tsx            Route/page switch, top-level state, error boundaries
  main.tsx            Entry point: root error boundary, PWA SW registration,
                       global runtime-error listeners
  types.ts            Shared TypeScript types (Article, Series, CommunityUser, ...)
  firestore.rules      Authorization for every collection — the real access-control layer
  components/          ~50 React components, one per view/feature surface
  lib/                 Firestore access + business logic, grouped by domain
  data/                Static seed data (default categories, etc.)
```

### `lib/` modules (by domain)

| Area | File |
|---|---|
| Firebase init, admin allowlist | `firebase.ts` |
| Articles, series, site config (CMS) | `cms.ts` |
| Community posts, follows, profiles | `community.ts` |
| Personal reading history/progress | `reading.ts`, `account.ts` |
| Recommendation scoring & cold-start | `personalization.ts`, `recommendations.ts` |
| Per-article analytics events & aggregation | `analytics.ts` |
| Social graph, moderation-adjacent social features | `social.ts` |
| Master Control admin operations (grants, moderator permissions, comment moderation, report resolution) | `masterControl.ts` |
| Admin audit log writer | `audit.ts` |
| User-submitted content reports | `reporting.ts` |
| Realtime presence (heartbeat + TTL) | `presence.ts` |
| Canonical URLs & sharing | `share.ts` |
| Runtime error capture (global listeners + Firestore/local-queue reporting) | `runtime.ts` |
| System/Firebase health checks | `health.ts` |
| Cross-tab/offline sync helpers | `sync.ts` |
| Toast notifications | `toast.ts` |

### Feature surfaces

- **Publishing**: articles, series, drafts, revisions, a rich CMS admin (`AdminStudioModal`,
  `AdminControlPanel`), public/community blog composers.
- **Discovery**: Explore (For You / Following / Latest / Trending), global search, topic
  pages, creator discovery.
- **Personalization**: weighted recommendation scoring (completed articles, bookmarks,
  followed creators/topics/series, trending, with per-recommendation "because you..."
  explanations and creator-diversity capping), cold-start topic picker for new accounts.
- **Community**: posts, nested comments with @mentions, reactions, follows, communities,
  direct messages.
- **Creator tools**: Creator Studio analytics dashboard (funnel, completion, scroll depth,
  return-reader rate, series drop-off, article comparison).
- **Trust & safety**: universal content reporting (`ReportButton` → `reports` collection),
  granular moderator permissions enforced in both the UI and Firestore rules, comment
  moderation, an admin audit log.
- **Realtime**: lightweight presence indicators (community/thread/article-level "N active"),
  TTL-based so presence documents don't accumulate unbounded.
- **Reliability**: page- and app-level React error boundaries, both wired to
  `lib/runtime.ts`'s error reporting (Firestore-backed for signed-in users, local-queued and
  flushed-on-login for signed-out users), plus a System Health view for admins.

### Admin / moderator model

Two tiers, enforced in both the client UI and `firestore.rules` (never trust the client-side
check alone — rules are the actual authority):

- **Master admin**: allowlisted by verified email in `firestore.rules`'
  `isAdmin()`, or granted dynamically via `masterAdmins`/`masterAdminEmails` documents
  (`lib/masterControl.ts`). Full access to every admin surface.
- **Platform moderator**: an entry in `siteModerators/{uid}` with a granular permission map
  (e.g. `manageReports`, `moderatePosts`, `moderateComments`). `hasModeratorPermission(...)`
  in the rules file checks this per-action, not just "is a moderator."

Every sensitive admin/moderator mutation should call the shared `audit()` helper (in
`masterControl.ts`) or `writeAdminAudit()` (in `audit.ts`) so it lands in `adminAuditLog`,
visible from the Admin panel's Audit tab.

---

## Version history

Each release used to get its own `V*.md`/`*_VALIDATION.md` file at the repo root; those have
been consolidated away since they were single-use scratch notes that didn't stay accurate
after the next release. `VERSION.md` holds the current release's changelog. For anything
older, check git history / prior zip exports rather than expecting a markdown file per version
going forward.

## V74.9
Identity controls now support safe self-service and Master Admin handle changes with UID-preserving propagation.
