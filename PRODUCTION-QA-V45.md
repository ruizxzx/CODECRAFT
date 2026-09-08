# OFFSCRPT V45 Production QA

## Critical flows

1. Create/publish an article from Admin Studio. Confirm the stored reading time changes with the actual structured content.
2. Open the article as a signed-in account. Scroll past 5%, 50% and 95%; refresh and reopen. The cloud progress should survive refresh.
3. Open the same account on another browser/device. The article progress and series completion should follow the account.
4. Open a series. Confirm part/time totals are derived from the actual article set, not stale counters.
5. Mark/complete parts by reading. Confirm the series percentage changes and persists.
6. Follow/unfollow a series from two different accounts. Confirm the follower total changes exactly once per membership.
7. Open an article that belongs to a series. Verify Previous/Next navigation and the bottom Next Part / View All Series actions.
8. Open the same article signed out. Confirm viewing works while private reading progress and follow writes are unavailable.
9. Add a reaction. Confirm its count changes by one and a second click removes it.
10. Applaud an article. Confirm the count is a real Firestore-backed per-account total and does not start from a hardcoded number.
11. Add and delete a comment. Confirm the displayed cloud comment count follows the actual comment collection.
12. Check creator identity surfaces for display name, @handle, avatar, and UID fallback when a handle is unavailable.
13. Test series library search, topic filter, all sort modes, reset, empty states and mobile layout.
14. Test series owner editing. Confirm owner cannot reorder or mutate articles unless they are also an administrator, matching the article write policy.
15. Test the known unauthorized account (`ruizinusa@gmail.com`) in an incognito session. Confirm it cannot access Master Control, carousel/site controls or administrator-only operations unless explicitly granted staff access.

## Security checks

- Publish the V45 Firestore rules.
- Sign out and attempt direct admin-route access.
- Use browser DevTools to confirm unauthorized Firestore writes return permission-denied.
- Confirm `users/{uid}/readingProgress/*` cannot be read by a different account.
- Confirm `series/*/followers/*` cannot be created or deleted for another user's UID.

## Release gate

Release only after the critical flows pass in a production Firebase environment. The development environment used for the package generation did not have network access sufficient to complete dependency installation, so the final release build must still be executed in the deployment environment.
