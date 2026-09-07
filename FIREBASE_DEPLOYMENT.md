# Firebase deployment checklist

This build uses the `krishficient-portfolio` Firebase project and its `(default)` Firestore database. It does not use the former `curious-studio-jc9s2` project or its named database.

## Required Firestore rules deployment

1. Open Firebase Console for `krishficient-portfolio`.
2. Open **Firestore Database** and select **`(default)`**.
3. Open **Rules**.
4. Replace the rules with the complete contents of `firestore.rules`, then publish.

The deployed rules, rather than the copy in this ZIP, decide whether an admin write succeeds.
Publishing this revision also enables the private `reading_progress` record used by Continue Reading.

## Admin access

The only CMS administrators are verified Google accounts using these exact email addresses:

- `ruizxzxz@gmail.com`
- `krishsarkar456@gmail.com`

Sign out and sign in again after publishing rules. Add another administrator by updating both `ADMIN_EMAILS` in `src/lib/firebase.ts` and the email list in `isAdmin()` in `firestore.rules`, then redeploy the site and rules together.

## Vercel settings

Set the `VITE_FIREBASE_*` variables to the values for `krishficient-portfolio`; do not set `VITE_FIREBASE_DATABASE_ID`. Remove any old project/database overrides and redeploy.

Add the Vercel/custom production domain in Firebase Authentication → Settings → Authorized domains.
