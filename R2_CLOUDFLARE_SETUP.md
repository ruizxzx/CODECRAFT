# OFFSCRPT V75.6 — Cloudflare R2 setup

## 1. Create the bucket
Create a Cloudflare R2 bucket named `offscrpt-media` (or any name you prefer). The application does not create buckets automatically.

## 2. Create R2 credentials
Create an R2 API token/key with object read/write access to the OFFSCRPT bucket. Keep the Access Key ID and Secret Access Key private.

## 3. Configure public delivery
For public OFFSCRPT content, attach a custom domain to the R2 bucket, for example `media.offscrpt.app`, and use that exact origin as `R2_PUBLIC_BASE_URL`. Do not put a trailing slash in the variable.

## 4. Configure CORS
Use a CORS policy equivalent to:

```json
[{
  "AllowedOrigins": [
    "https://offscrpt.vercel.app"
  ],
  "AllowedMethods": ["PUT", "GET", "HEAD"],
  "AllowedHeaders": ["Content-Type"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3600
}]
```

Add the production custom domain as another allowed origin when you deploy it.

## 5. Vercel environment variables
Add the following to the Vercel project. These are server-side values; never prefix them with `VITE_`.

- `R2_ACCOUNT_ID`
- `R2_BUCKET_NAME`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_S3_ENDPOINT` — `https://<account-id>.r2.cloudflarestorage.com`
- `R2_PUBLIC_BASE_URL` — for example `https://media.offscrpt.app`
- `OFFSCRPT_ADMIN_EMAILS` — comma-separated authorized admin emails
- `OFFSCRPT_MAX_IMAGE_BYTES` — defaults to 10 MB
- `OFFSCRPT_MAX_VIDEO_BYTES` — defaults to 250 MB
- `OFFSCRPT_MAX_FILE_BYTES` — defaults to 25 MB

## 6. Upload flow
The frontend calls `/api/media/upload-url` with a Firebase ID token. The API verifies the token with Google's Firebase secure-token endpoint, validates the media type/size, and creates a 15-minute R2 presigned PUT URL. The browser uploads the file directly to R2. Firestore receives the resulting public URL in the existing article/profile/post data.

## 7. Current UI integrations
- Profile avatar upload
- Profile cover upload
- Admin article cover upload
- Admin inline article image upload
- Admin inline article video upload
- Admin carousel image upload
- Community post image/video upload

## 8. Important
This release does not remove Firebase Storage rules or migrate existing Firebase Storage objects. The new upload buttons use R2. Existing legacy URLs continue to work.
