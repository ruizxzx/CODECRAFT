# OFFSCRPT V75.5

Announcement system safety fixes + problem-report bug fixes. No features removed.

- **Fixed the site-blocking announcement bug** (present since V75.3): an admin could publish a
  popup announcement with "ALLOW DISMISS" unchecked and no action/link button configured,
  producing a full-screen overlay with no possible way to close it — targeting all pages by
  default, this could lock every visitor out of the entire site. Two layers of fix:
  - `AdminControlPanel.tsx`'s PUBLISH ANNOUNCEMENT button now refuses to save an enabled
    announcement that has neither `dismissible` nor a working primary/secondary action button,
    with a clear error explaining why.
  - `SiteAnnouncementPopup.tsx` now has a safety-net `effectivelyDismissible` check that forces
    dismiss controls to render (and Escape-to-close now works) whenever no other close route
    exists, protecting against stale pre-existing config or any future editing path that skips
    the admin-side validation above.
- **Fixed `users/{uid}/announcementState/{id}` having no Firestore rule at all.** This collection
  (added in V75.4 for cloud-synced seen/dismissed state) was denied by the rules file's default
  `allow read, write: if false`, so `markAnnouncementSeen()` and `dismissAnnouncementForUser()`
  silently failed for every signed-in user — clicking DISMISS did nothing, and the announcement
  would reappear on next page load. Added an owner-only read/write rule matching the shape
  `markAnnouncementSeen`/`dismissAnnouncementForUser` actually write.
- **Fixed the problem-report form discarding typed input on first sign-in.** `ChangelogView.tsx`
  previously called `loginWithGoogle()` and returned immediately when a signed-out user clicked
  SUBMIT, silently dropping their typed title/description. It now proceeds to submit the
  already-typed report after a successful sign-in.
- **Fixed "Your reports" not updating after signing in from the same page.**
  `subscribeProblemReportsForReporter()` previously checked `auth.currentUser` once at call
  time and never re-subscribed; a user who signed in via the report form's own prompt had to
  reload the page to see their reports populate. It now re-subscribes on every auth state
  change, matching the pattern already used correctly elsewhere in `SiteAnnouncementPopup.tsx`.
- Deleted the duplicate root-level `components/`, `lib/`, `data/`, `App.tsx`, `main.tsx`,
  `index.html`, `index.css`, `vite-env.d.ts`, `types.ts`, `firestore.rules`, `package.json`
  tree (never the active build source — `src/` is, per `vite.config.ts`) and the stale
  `src/VERSION.md`, `src/package.json` duplicates. This is the third time this tree has
  reappeared across V74.2, V75.3, and V75.4; see `README.md`'s "Project conventions" section.

All V75.4 features (cloud changelog, audience/scheduling/priority/display-mode announcement
options, comment identity sync, and everything from earlier releases) are preserved as-is.
