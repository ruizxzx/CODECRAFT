# KRISHFICIENT Firebase Production Deployment

## Firebase project
- Project: `krishficient-portfolio`
- Firestore database: `(default)`
- Google Authentication: required
- Firebase Storage: not used

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

## Images
Image fields use public HTTPS image URLs stored in Firestore. No Firebase Storage bucket or storage rules are required.

## Profile synchronization
Deploy `firestore.rules`. Users can update their profile image by pasting a public image URL. Profile changes propagate to their existing community posts and comments.

## Production Firestore rules — offscrpt.vercel.app

The production app uses Firebase project `krishficient-portfolio` and Firestore `(default)`. The `firestore.rules` file in this repository must be published to that database.

### Firebase Console
1. Open Firebase Console → `krishficient-portfolio` → Firestore Database → Rules.
2. Replace the deployed rules with this repository's `firestore.rules`.
3. Click **Publish**.
4. Sign out/in on `https://offscrpt.vercel.app` and test admin deletion.

### Why this is required
Admin post deletion is a batch operation that removes the post's comments, votes, claps, repost records, and then the post. The rules explicitly allow the post author or an admin to remove those nested records. If an older ruleset is still deployed, Firestore will return `Missing or insufficient permissions` even though the frontend is correct.

Verification badges are also protected server-side: normal users cannot self-verify; only an authenticated admin can change `isVerified` and `verificationColor`.
