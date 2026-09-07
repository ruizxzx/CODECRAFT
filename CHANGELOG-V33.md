# OFFSCRPT V33 — Original Creator Attribution & Publication Integrity

- Main-publication articles created from public/community blogs now preserve and display the original creator as the article author.
- Original creator avatar, name, @handle, verification state and profile navigation are resolved from the source post/profile when necessary.
- Republished-by-admin attribution remains separate and clickable.
- Existing promoted community blogs with stale/wrong author data are hydrated from their source post when read, so the creator attribution is corrected without destructive migration.
- Fixed a latent republish path bug where content blocks could be referenced before initialization.
- Article cards use original-author metadata when available.
- No new Firestore index is required for these changes.
