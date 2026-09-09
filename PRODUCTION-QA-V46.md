# OFFSCRPT V46 Production QA

1. Sign out and wait for Firebase auth initialization. Header and navigation drawer must show SIGN IN WITH GOOGLE.
2. Sign in again. Header must show the user identity and profile link.
3. Home page: SERIES section renders, search works, OPEN and ALL SERIES buttons navigate correctly.
4. Blog page: SERIES section renders, OPEN and ALL SERIES buttons navigate correctly.
5. Open a series. Verify the total progress bar uses partial article progress, not only completed article count.
6. Open a partially read series article, scroll, wait for a checkpoint, return to the series page and verify progress updates without a manual refresh.
7. Open the same account on another browser/device and verify saved reading progress is visible after sign-in.
8. At the end of a series article, click MARK AS COMPLETE. Verify it becomes COMPLETED and the series completion count increases.
9. From the article end, click VIEW ALL SERIES. Verify the hash becomes #series and the Series Library appears.
10. Complete all parts and verify SERIES COMPLETE appears.
11. Sign out and verify signed-out users can still view public articles/series but cannot mutate private progress.
12. On mobile, verify the series strips, auth controls, article end actions, and series progress remain usable without horizontal overflow.
13. Open an old article created before V46 and confirm it still renders and can be edited/published without data loss.
