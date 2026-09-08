# OFFSCRPT V47 Production QA

## Completion persistence
1. Sign in, open an article, scroll to ~35%, refresh, verify cloud progress remains near 35%.
2. Click MARK AS COMPLETE. Refresh. Progress must remain exactly 100%.
3. Navigate away and open the same article again. It must still be 100% and must not drop from scroll tracking.
4. Scroll around the completed article. It must remain 100%.
5. Click RESET & RECALCULATE. Verify completion badge disappears and progress returns to automatic tracking.

## Article endpoint
6. Open a long article and scroll until the last line of article content is reached. The top progress indicator should hit 100% there; scrolling through reactions/footer must not increase it.
7. Resize the viewport and verify the endpoint remains tied to article content rather than total document height.

## History
8. While signed in, open Article A three times. History must contain exactly one A entry, with the latest viewed time.
9. Open B, then A. A must move above B; there must still be only one A entry.
10. Verify each history row shows the latest stored reading percentage.
11. Remove one history item and refresh; it must stay removed.
12. Clear all history and refresh; it must remain empty.
13. Open OFFSCRPT in another signed-in tab, visit an article, return to History in the first tab; the history list should update via Firestore without a manual refresh.
14. Sign out and open History. It must show the private sign-in state and never expose prior history.

## Command palette
15. Press Ctrl+K / Cmd+K from any page. Command palette opens.
16. Search within commands and press Enter on a unique result.
17. Use Home, Blog, Series, Saved, History, Notifications and Explore commands.
18. Escape and backdrop click close the palette.

## Cloud / security
19. Deploy the included firestore.rules before history testing.
20. A signed-in user must not be able to read another user's /users/{uid}/history collection.
21. Existing article likes, reactions, comments, series progress and admin controls remain functional.
