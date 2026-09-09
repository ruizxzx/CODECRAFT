# OFFSCRPT V72 — build and stability notes

Base: OFFSCRPT V71 article history + OFFSCRPT V71.5 Batch 2 + Stability Infrastructure.

Active Vite entrypoint:
`src/index.html` → `src/main.tsx` → `src/App.tsx`

V72 keeps Batch 2 granular Firestore permission rules and adds:
- connected article-session analytics
- engagement analytics events
- runtime error persistence
- sync-state infrastructure
- admin infrastructure health probes
- active-source QA checks

The Firestore rules retain the balanced Batch 2 ruleset and add bounded runtime diagnostics plus a corrected analytics session/event create policy.
