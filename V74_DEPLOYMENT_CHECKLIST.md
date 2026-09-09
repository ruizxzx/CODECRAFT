# V74.0 Deployment Checklist

1. Deploy the repository with V74 source.
2. Deploy `firestore.rules` to the production Firebase project.
3. Verify the master account is either a bootstrap email or present in `masterAdmins`/`masterAdminEmails` according to the rules.
4. Open `/` then `#cms` and Master Control.
5. Run System → RUN REAL CHECKS. Realtime/Presence should no longer use `__health__`.
6. Run Analytics → REFRESH REAL DATA and verify 7D/30D/90D/ALL.
7. Test with a second non-admin account: no master tabs or master writes should be available.
8. Change one Site Control flag and confirm another browser receives the Firestore-backed site config update.
9. Create a backup, change configuration, then restore and verify the public site changes.
10. Moderate a comment/report/post and verify the change is visible from the other account.
