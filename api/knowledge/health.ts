import { providerHealth } from '../../server/knowledge-engine.js';

const FIREBASE_API_KEY = process.env.FIREBASE_WEB_API_KEY || process.env.VITE_FIREBASE_API_KEY || '';
const FIREBASE_LOOKUP_URL = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_API_KEY)}`;
const ADMIN_EMAILS = new Set(['ruizxzxz@gmail.com', 'krishsarkar456@gmail.com']);

async function verifyAdmin(token: string) {
  if (!FIREBASE_API_KEY) throw Object.assign(new Error('FIREBASE_WEB_API_KEY is not configured.'), { status: 503 });
  const r = await fetch(FIREBASE_LOOKUP_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }) });
  if (!r.ok) throw Object.assign(new Error('INVALID_FIREBASE_TOKEN'), { status: 401 });
  const data = await r.json() as any;
  const user = data.users?.[0];
  if (!user?.localId) throw Object.assign(new Error('INVALID_FIREBASE_TOKEN'), { status: 401 });
  if (user.disabled) throw Object.assign(new Error('ACCOUNT_DISABLED'), { status: 403 });
  if (!ADMIN_EMAILS.has(String(user.email || '').toLowerCase())) throw Object.assign(new Error('MASTER_ADMIN_REQUIRED'), { status: 403 });
  return String(user.localId);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  try {
    const auth = String(req.headers.authorization || '');
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token) return res.status(401).json({ error: 'Authentication required.' });
    await verifyAdmin(token);
    const health = await providerHealth();
    return res.status(200).json({ schemaVersion: 84, ...health, checkedAt: new Date().toISOString() });
  } catch (error: any) {
    return res.status(Number(error?.status) || 502).json({ error: String(error?.message || 'Knowledge health check failed.') });
  }
}
