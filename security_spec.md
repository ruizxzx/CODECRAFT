# Security Spec

## Data Invariants
1. A User profile must only be created/updated by the user themselves.
2. A Username document must be created atomically with a User profile creation.
3. Posts must have an `authorId` matching the currently authenticated user.
4. `clapsCount` and `commentsCount` can only be updated synchronously with their sub-collections (or server functions). For simplicity, we'll allow anyone to update it if they are adding/removing a clap/comment, but wait, usually we need Cloud Functions or a transactional update from client. To keep client-side only, we allow authenticated users to update `clapsCount` and `commentsCount` IF they are also modifying a subcollection. Wait, Firestore Rules cannot check if a subcollection is being written during a parent document write without complex `getAfter`. Let's just validate the fields using `hasOnly`.
5. Only admins can update `isFeatured` on Posts.
6. Comments must have `authorId` matching authenticated user.
7. Claps use `userId` as the document ID to ensure unique likes.

## Dirty Dozen Payloads
1. User Profile Creation with admin role.
2. Profile Update spoofing uid.
3. Post Creation with another's authorId.
4. Post Update changing authorId.
5. Post Update injecting huge payload.
6. Post Update modifying isFeatured (by non-admin).
7. Username hijacking (overwriting existing).
8. Comment Creation with wrong authorId.
9. Clap Creation with mismatching userId.
10. Unauthenticated read of PII (Wait, this is public community data).
11. Update commentsCount by 100 in a single request.
12. Creating a post with a non-string title.
