# OFFSCRPT V34 — Master Control Publish Error & Attribution Repair

- Removed ambiguous `u` local identifiers from Master Control and article author navigation paths to eliminate the runtime TDZ error (`Cannot access 'u' before initialization`).
- Preserved admin publish/unpublish controls and cloud synchronization.
- Hardened legacy community-blog attribution: if an older promoted article has `sourcePostId` but no `sourceCommunityId`, Article View now attempts a community-post lookup before falling back to stored article author metadata.
- Existing data is preserved; no destructive migration.
- No new Firestore index is required.
