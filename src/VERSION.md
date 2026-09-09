# OFFSCRPT V74.1

Master Control cloud-integrity and diagnostics patch.

- Fixes Master Control presence diagnostics by avoiding broad collection-group member scans.
- Fixes admin community-post inventory by querying each community posts collection directly instead of a broad collection-group scan.
- Fixes platform analytics collection access by reading article analytics through their authorized article subcollections.
- Removes the initial Master Control presence count from the core load failure path; presence is checked independently in System Health.
- Preserves real Firestore-backed analytics and synchronization; no synthetic fallback data added.
- Keeps V74 legacy Master Control parity: Dashboard, Access, Users, Posts, Communities, Questions, Topics, Reports, Messages, Moderators, Comments, Content, Site Control, Navigation, Backups, Analytics, Recommendations, System, Audit.
