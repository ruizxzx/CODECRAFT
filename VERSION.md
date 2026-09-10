# OFFSCRPT V77.0.6

## Question Runtime + Theme + Verification UI Fix

- Fixed the QuestionView React hook-order crash that produced minified React error #310 when opening a question.
- Moved answer hierarchy memoization before all conditional render returns so hook order is stable across loading and loaded renders.
- Removed a redundant no-op effect from QuestionView.
- Retained the V77.0.4 behavior where first-time visitors default to light mode instead of inheriting the device OS dark-mode preference.
- Fixed oversized verified badge in Question & Answer answer cards to match the compact universal profile/list sizing.
- Added question-author verification metadata for newly created questions and safe display fallback for the signed-in author.
- Retained all existing Q&A, feed, recommendation, R2 media, image crop/preview, community, moderation, and Firestore optimization features.
