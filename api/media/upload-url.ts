import { createHash, createHmac, randomBytes } from 'node:crypto';

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || 'krishficient-portfolio';
const ADMIN_EMAILS = new Set(
  (process.env.OFFSCRPT_ADMIN_EMAILS || 'ruizxzxz@gmail.com,krishsarkar456@gmail.com')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
);
const MAX_IMAGE_BYTES = Number(process.env.OFFSCRPT_MAX_IMAGE_BYTES || 10 * 1024 * 1024);
const MAX_VIDEO_BYTES = Number(process.env.OFFSCRPT_MAX_VIDEO_BYTES || 250 * 1024 * 1024);
const MAX_FILE_BYTES = Number(process.env.OFFSCRPT_MAX_FILE_BYTES || 25 * 1024 * 1024);
const FIREBASE_API_KEY = process.env.FIREBASE_WEB_API_KEY || process.env.VITE_FIREBASE_API_KEY || 'AIzaSyC1_eau-5rsMTreEzCNmTsn2FGcSa448ug';
const FIREBASE_LOOKUP_URL = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_API_KEY)}`;

const hmac = (key: Buffer | string, value: string) => createHmac('sha256', key).update(value).digest();
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

const awsEncode = (value: string) => encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
const canonicalUri = (key: string) => `/${key.split('/').map(awsEncode).join('/')}`;
const amzDate = (date: Date) => date.toISOString().replace(/[-:]|\.\d{3}/g, '');
const shortDate = (date: Date) => amzDate(date).slice(0, 8);

function signPresignedPut(input: { endpoint: string; accessKey: string; secretKey: string; bucket: string; key: string; expiresIn: number; region: string }) {
  const now = new Date();
  const date = amzDate(now);
  const day = shortDate(now);
  const service = 's3';
  const credentialScope = `${day}/${input.region}/${service}/aws4_request`;
  const host = new URL(input.endpoint).host;
  const params = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${input.accessKey}/${credentialScope}`,
    'X-Amz-Date': date,
    'X-Amz-Expires': String(input.expiresIn),
    'X-Amz-SignedHeaders': 'host',
  });
  const canonicalQuery = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${awsEncode(k)}=${awsEncode(v)}`)
    .join('&');
  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = 'host';
  const canonicalRequest = [
    'PUT',
    canonicalUri(`${input.bucket}/${input.key}`),
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    date,
    credentialScope,
    hash(canonicalRequest),
  ].join('\n');
  const kDate = hmac(`AWS4${input.secretKey}`, day);
  const kRegion = hmac(kDate, input.region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  params.set('X-Amz-Signature', signature);
  return `${input.endpoint.replace(/\/$/, '')}/${awsEncode(input.bucket)}/${input.key.split('/').map(awsEncode).join('/') }?${params.toString()}`;
}

async function verifyFirebaseIdToken(token: string) {
  // Firebase ID tokens are not Google OAuth ID tokens. Use Firebase Auth's
  // accounts:lookup endpoint so valid Firebase sessions are accepted while
  // invalid/revoked tokens are rejected server-side.
  const response = await fetch(FIREBASE_LOOKUP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token }),
  });
  if (!response.ok) {
    const failure = await response.json().catch(() => ({} as Record<string, unknown>));
    const code = String((failure as any)?.error?.message || 'INVALID_ID_TOKEN');
    if (code.includes('USER_DISABLED')) throw new Error('FIREBASE_USER_DISABLED');
    if (code.includes('TOKEN_EXPIRED')) throw new Error('EXPIRED_FIREBASE_TOKEN');
    throw new Error('INVALID_FIREBASE_TOKEN');
  }
  const data = await response.json() as { users?: Array<Record<string, unknown>> };
  const authUser = data.users?.[0];
  if (!authUser?.localId) throw new Error('INVALID_FIREBASE_TOKEN');
  return {
    uid: String(authUser.localId),
    email: String(authUser.email || '').toLowerCase(),
    emailVerified: Boolean(authUser.emailVerified),
  };
}

const sanitizeName = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').slice(0, 120) || 'upload';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const authorization = String(req.headers.authorization || '');
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    if (!token) return res.status(401).json({ error: 'Authentication required.' });

    const user = await verifyFirebaseIdToken(token);
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const fileName = sanitizeName(String(body.fileName || 'upload'));
    const contentType = String(body.contentType || '').toLowerCase();
    const size = Number(body.size || 0);
    const requestedFolder = String(body.folder || 'users').toLowerCase();
    const targetUid = String(body.targetUid || '').trim();

    if (!contentType || !Number.isFinite(size) || size <= 0) return res.status(400).json({ error: 'A valid file type and size are required.' });
    const kind = contentType.startsWith('image/') ? 'image' : contentType.startsWith('video/') ? 'video' : 'file';
    const max = kind === 'image' ? MAX_IMAGE_BYTES : kind === 'video' ? MAX_VIDEO_BYTES : MAX_FILE_BYTES;
    if (size > max) return res.status(413).json({ error: `File is too large. Maximum allowed is ${Math.round(max / (1024 * 1024))} MB.` });
    if (kind === 'image' && !['image/jpeg','image/png','image/webp','image/gif','image/avif'].includes(contentType)) return res.status(415).json({ error: 'Unsupported image format.' });
    if (kind === 'video' && !['video/mp4','video/webm','video/quicktime'].includes(contentType)) return res.status(415).json({ error: 'Unsupported video format.' });
    if (kind === 'file' && !['application/pdf'].includes(contentType)) return res.status(415).json({ error: 'Only PDF files are supported as generic attachments.' });

    const accountId = process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
    const bucket = process.env.R2_BUCKET_NAME;
    const accessKey = process.env.R2_ACCESS_KEY_ID;
    const secretKey = process.env.R2_SECRET_ACCESS_KEY;
    const publicBaseUrl = String(process.env.R2_PUBLIC_BASE_URL || process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
    const endpoint = String(process.env.R2_S3_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : ''));
    if (!accountId || !bucket || !accessKey || !secretKey || !publicBaseUrl) {
      return res.status(503).json({ error: 'R2 media storage is not configured on the server.' });
    }

    const isAdmin = ADMIN_EMAILS.has(user.email);
    const folder = ['profile', 'articles', 'posts', 'videos', 'attachments', 'answers', 'discussion-replies', 'carousel', 'site'].includes(requestedFolder) ? requestedFolder : 'users';
    if ((folder === 'articles' || folder === 'carousel' || folder === 'site') && !isAdmin) return res.status(403).json({ error: 'Only authorized administrators can upload site-wide media.' });

    const ext = fileName.includes('.') ? fileName.split('.').pop() : (contentType.split('/')[1] || 'bin');
    const random = cryptoRandom(18);
    const targetPathUid = isAdmin && targetUid && /^[A-Za-z0-9_-]{1,180}$/.test(targetUid) && folder === 'profile' ? targetUid : user.uid;
    const prefix = isAdmin && (folder === 'articles' || folder === 'carousel' || folder === 'site') ? `site/${folder === 'site' ? 'assets' : folder}` : `users/${targetPathUid}/${folder}`;
    const key = `${prefix}/${Date.now()}-${random}-${fileName.replace(/\.[^.]+$/, '')}.${ext}`;
    const uploadUrl = signPresignedPut({ endpoint, accessKey, secretKey, bucket, key, expiresIn: 900, region: 'auto' });
    const publicUrl = `${publicBaseUrl}/${key.split('/').map(encodeURIComponent).join('/')}`;
    return res.status(200).json({ uploadUrl, publicUrl, objectKey: key, expiresIn: 900, contentType, size, kind, uid: user.uid });
  } catch (error: any) {
    console.error('R2 upload URL error:', error);
    return res.status(500).json({ error: error?.message || 'Could not create upload URL.' });
  }
}

function cryptoRandom(length: number) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let output = '';
  const random = randomBytes(length);
  for (let i = 0; i < length; i += 1) output += alphabet[random[i] % alphabet.length];
  return output;
}
