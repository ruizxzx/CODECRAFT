# OFFSCRPT V69 BUG AUDIT

## Production console issue
Reported production runtime error:
`ReferenceError: inputRef is not defined`

Cause:
`MentionTextarea` declared a `textareaRef` prop but dereferenced an undeclared `inputRef`.

Fix:
`MentionTextarea` now creates `internalRef` and selects:
`const inputRef = textareaRef ?? internalRef`

## Other undefined-name issues found by static semantic scan
- CommunityEditor: missing syncState/setSyncState
- CommunityProfileView: missing isAdmin
- ExploreView: creator Promise result u was not destructured
- lib/cms.ts: writeAdminAudit was used without import

All four were repaired.

## Authentication-specific behavior
The mention component is exercised on authenticated interactive surfaces. This explains why unauthenticated browsing could appear healthy while authenticated article/comment rendering failed.

## Validation limits
The source was parsed/transpiled with TypeScript facilities available in the environment. Full npm dependency installation was not completed because it timed out.
