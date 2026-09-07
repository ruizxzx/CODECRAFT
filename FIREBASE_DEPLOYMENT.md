# KRISHFICIENT Firebase Production Deployment

## Firebase project
- Project: `krishficient-portfolio`
- Firestore database: `(default)`
- Google Authentication: required
- Firebase Storage: intentionally not used by the application

## Vercel environment variables
Set these for the production deployment:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

The application uses the default Firestore database and does not require `VITE_FIREBASE_DATABASE_ID`.

## Firestore rules
Deploy the repository `firestore.rules` to the `(default)` Firestore database before testing CMS writes, profiles, upvotes, or reposts.

## Author profile
When an authorized admin signs in, the app creates/synchronizes the canonical author profile:

- Username: `@krishsarkar`
- Profile document: `users/<admin-auth-uid>`

The admin profile is linked into site configuration and every new/synchronized main article stores the author's UID and username.

## Community data
- User profiles: `users/<uid>`
- Upvotes: `users/<uid>/upvotes/<postId>`
- Reposts: `users/<uid>/reposts/<postId>` and `posts/<postId>/reposts/<uid>`
- Community posts: `posts/<postId>`
- Community comments: `posts/<postId>/comments/<commentId>`
- Article comments: `articles/<slug>/comments/<commentId>`

## Custom categories
Admin-created categories are stored in `siteConfig/global.customCategories` and are immediately available in the article editor and public Blog category filter.
