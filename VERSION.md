# OFFSCRPT V77.0.1

## Questions + Answers Engine

First-class Questions and Answers with rich answer media, voting, accepted answers, follows, related questions, search and moderation.


## V77.0.1 — Vercel build fix

Fixed duplicate `getQuestionForModeration` export in `src/lib/social.ts` that caused the Vercel production build to fail with multiple-export / duplicate-declaration errors. No Q&A or existing platform functionality was removed.
