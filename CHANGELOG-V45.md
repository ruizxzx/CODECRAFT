# OFFSCRPT V45 — PRODUCTION PUBLISHING + SERIES + METRICS

50-feature production pack delivered in this build:

1. Cloud-synced article reading checkpoints per signed-in account
2. Automatic article completion at 90% scroll
3. Resume-reading banner with saved cloud percentage
4. Real reading-time calculation from structured blocks
5. Series time and part counts derived from actual article content
6. Series remaining-time calculation based on unfinished parts
7. Series progress calculated from cloud account state
8. Series completion state survives devices and sessions
9. Per-series follow/save control
10. Real series follower count via Firestore aggregation
11. Realtime series library updates
12. Series library search
13. Series library topic/tag filtering
14. Series library sorting by update/title/parts/time
15. Series curriculum search
16. Incomplete-parts filter
17. Curriculum sorting by order/newest/shortest/longest
18. Per-part progress bars
19. Per-part completion badges
20. Series completion banner
21. Start/resume next unfinished part
22. Copy series outline
23. Download series outline
24. Print-friendly series view
25. Keyboard shortcut for resume
26. Keyboard shortcut for save/follow
27. Collapsible curriculum
28. End-of-article next-part CTA
29. End-of-article view-series CTA
30. Previous/next series navigation
31. Admin inline series editor
32. Admin series deletion confirmation
33. Admin part reordering
34. Admin add-existing-article to series
35. Admin remove-article-from-series
36. Series cover alt text support
37. Series tags rendered throughout discovery and detail views
38. Shareable series deep link
39. Series breadcrumb/back navigation
40. Responsive mobile series controls
41. Automatic reading-time persistence in Admin Studio and the public blog composer
42. Production loading/error/empty states
43. Resettable series filters
44. Creator name/handle/avatar identity component
45. Creator UID fallback identity
46. Exact homepage article count from cloud article feed
47. Real registered-reader count from Firestore
48. Real article applause count from per-user cloud records
49. Real article reaction counts from per-user cloud records
50. Real article comment count from Firestore count aggregation

Notes:
- Cloud readingProgress is private to each signed-in user.
- Series completion is derived from cloud per-article checkpoints, avoiding a second mutable aggregate that could drift.
- Public engagement totals shown in the article UI are computed from per-user Firestore documents; hardcoded demo applause counts were removed from the public article experience.
- Series follower totals are computed with a Firestore count query.
- No public per-user view data is exposed by this feature pack.
- Firestore rules include the private readingProgress path and series follower membership.
