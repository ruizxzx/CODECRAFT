# Firebase deployment

This project uses the `krishficient-portfolio` Firebase project and Firestore `(default)` database.

## Firestore rules

Deploy the included rules to the production project:

```bash
firebase use krishficient-portfolio
firebase deploy --only firestore:rules
```

## Firestore indexes

The project includes `firestore.indexes.json` with the recommended collection-group index for `comments.authorId`:

```bash
firebase use krishficient-portfolio
firebase deploy --only firestore:indexes
```

The app also contains a fallback cloud scan for this query, so a missing index no longer blocks core admin configuration or article publishing. The index is still recommended for efficient profile-comment queries as the site grows.

## Vercel

Set the Firebase `VITE_*` variables for the production deployment. No Firebase Storage variable or Storage setup is required by this project.
