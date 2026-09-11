import { retrieveOffscrpt } from '../lib/offscript-retrieval.js';

const FIREBASE_API_KEY = process.env.FIREBASE_WEB_API_KEY || process.env.VITE_FIREBASE_API_KEY || 'AIzaSyC1_eau-5rsMTreEzCNMtn2FGfSa448ug';
const FIREBASE_LOOKUP_URL = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_API_KEY)}`;

async function verifyFirebaseIdToken(token: string) {
  const response = await fetch(FIREBASE_LOOKUP_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }) });
  if (!response.ok) throw Object.assign(new Error('INVALID_FIREBASE_TOKEN'), { status: 401 });
  const data = await response.json() as any;
  const user = data.users?.[0];
  if (!user?.localId) throw Object.assign(new Error('INVALID_FIREBASE_TOKEN'), { status: 401 });
  if (user.disabled) throw Object.assign(new Error('ACCOUNT_DISABLED'), { status: 403 });
  return String(user.localId);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  try {
    const authorization = String(req.headers.authorization || '');
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    if (!token) return res.status(401).json({ error: 'Authentication required.', code: 'AI_AUTH' });
    const body = req.body || {};
    const verifiedUid = await verifyFirebaseIdToken(token);
    const suppliedUid = String(body.uid || '').slice(0, 128);
    if (suppliedUid && suppliedUid !== verifiedUid) return res.status(403).json({ error: 'Authenticated user mismatch.', code: 'AI_RETRIEVAL_AUTH' });
    const uid = verifiedUid;
    const result = await retrieveOffscrpt(token, { query: String(body.query || ''), uid, scope: ['site','saved','page'].includes(body.scope) ? body.scope : 'site', current: body.current, savedIds: Array.isArray(body.savedIds) ? body.savedIds.slice(0, 100) : [], limit: Number(body.limit || 8) });
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('OFFSCRPT retrieval failed', error);
    if (error?.message === 'INVALID_FIREBASE_TOKEN') return res.status(401).json({ error: 'Authentication expired. Please sign in again.', code: 'AI_AUTH' });
    if (error?.message === 'ACCOUNT_DISABLED') return res.status(403).json({ error: 'Account disabled.', code: 'AI_AUTH' });
    if (Number(error?.status) === 403) return res.status(403).json({ error: 'Authenticated user mismatch.', code: 'AI_RETRIEVAL_AUTH' });
    return res.status(Number(error?.status) === 401 ? 401 : 502).json({ error: 'OFFSCRPT retrieval failed.', code: 'AI_RETRIEVAL_FAILED' });
  }
}
