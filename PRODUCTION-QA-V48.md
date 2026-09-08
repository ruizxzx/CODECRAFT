# OFFSCRPT V48 Production QA

## P0 — reading progress
1. Sign in. Open a long article. Confirm the top progress bar increases while scrolling through the article body.
2. Confirm the progress bar is not affected by reactions, tags, comments or footer content.
3. Scroll upward after reaching 60%; progress should not regress.
4. Click MARK AS COMPLETE; refresh and reopen. It must remain 100% COMPLETE.
5. Click RESET & RECALCULATE; automatic progress should resume from the current position.
6. Open the same article on another signed-in device/browser and verify cloud progress follows the account.

## P0 — account dashboard
1. Open Menu → My OFFSCRPT.
2. Verify Saved, History, Notifications, Preferences and Reading Queue cards navigate correctly.
3. Add an article to READ LATER, refresh and confirm it persists.
4. Add the same article twice; only one queue item must exist.
5. Remove the queue item; verify cloud deletion.
6. Confirm account activity combines reading, saved and notification events without duplicate article-open rows.

## P0 — notifications
1. Open Notifications → Settings.
2. Toggle each preference and refresh; state must persist.
3. Trigger a supported event (comment/reply/follow/mention/reaction) with the corresponding preference disabled and confirm no new notification is created.

## P0 — drafts
1. Start a public blog draft, disconnect network, keep typing, refresh/reopen and confirm local recovery.
2. Reconnect; confirm cloud draft persistence.
3. Publish; confirm draft is cleared.
4. Repeat with community and admin article editors.

## P1 — navigation
- Ctrl/Cmd+K opens command palette.
- My OFFSCRPT and Notification Settings commands navigate correctly.
- Signed-out users still see the sign-in action in the navigation drawer.

## Release checks
- Deploy V48 Firestore rules.
- Test on desktop and mobile.
- Check browser console for permission-denied or unhandled promise errors.
- Confirm Firebase writes are account-scoped and survive refresh/device changes.
