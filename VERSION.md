# OFFSCRPT V75.6.1

R2 media upload authentication hotfix.

- Correctly validates Firebase ID tokens with Firebase Auth `accounts:lookup` instead of Google OAuth `tokeninfo`.
- Accepts both the canonical R2 environment names and the earlier Vercel aliases for a smoother upgrade.
- Keeps R2 credentials server-side and uses short-lived presigned uploads.
