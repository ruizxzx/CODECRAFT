# OFFSCRPT V77.0.5

## Question Runtime + Theme Hardening

- Fixed the QuestionView React hook-order crash that produced minified React error #310 when opening a question.
- Moved answer hierarchy memoization before all conditional render returns so hook order is stable across loading and loaded renders.
- Removed a redundant no-op effect from QuestionView.
- Retained the V77.0.4 behavior where first-time visitors default to light mode instead of inheriting the device OS dark-mode preference.
- Retained all existing Q&A, feed, recommendation, R2 media, image crop/preview, community, moderation, and Firestore optimization features.
