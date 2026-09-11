import { retrieveOffscrpt } from '../lib/offscript-retrieval.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  try {
    const authorization = String(req.headers.authorization || '');
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    if (!token) return res.status(401).json({ error: 'Authentication required.', code: 'AI_AUTH' });
    const body = req.body || {};
    const uid = String(body.uid || '').slice(0, 128);
    if (!uid) return res.status(400).json({ error: 'Authenticated user ID required.', code: 'AI_RETRIEVAL_UID' });
    const result = await retrieveOffscrpt(token, { query: String(body.query || ''), uid, scope: ['site','saved','page'].includes(body.scope) ? body.scope : 'site', current: body.current, savedIds: Array.isArray(body.savedIds) ? body.savedIds.slice(0, 100) : [], limit: Number(body.limit || 8) });
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('OFFSCRPT retrieval failed', error);
    return res.status(Number(error?.status) === 401 ? 401 : 502).json({ error: 'OFFSCRPT retrieval failed.', code: 'AI_RETRIEVAL_FAILED' });
  }
}
