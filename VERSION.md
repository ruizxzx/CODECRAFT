# OFFSCRPT V60

## Profile identity and cloud synchronization fix

### Fixed
- Removed the undefined client-side `isValidId` reference that caused every Profile Settings save to fail with `isValidId is not defined`.
- Profile Settings is now strictly self-service: a signed-in user can edit only their own profile.
- Admin Studio remains the control surface for the publication author identity.
- Removed the Profile Settings -> `siteConfig.authorName` coupling, so changing a personal account display name no longer changes the publication author name.
- Profile identity propagation targets the actual profile UID.
- Admin user edits refresh denormalized author snapshots in posts, comments, and matching published articles when identity fields change.
- Existing realtime profile subscriptions continue propagating profile changes to public viewers.

### Validation
- Root and `src/` copies of modified modules are byte-identical.
- Package and lockfile version are `0.60.0`.
- Full dependency-backed Vite build could not be completed in this environment because dependency installation timed out.
