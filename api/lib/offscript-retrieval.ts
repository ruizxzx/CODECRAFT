const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'krishficient-portfolio';
const DATABASE = '(default)';
const ROOT = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/databases/${encodeURIComponent(DATABASE)}/documents`;

const clip = (v: unknown, max: number) => String(v ?? '').slice(0, max);
const asDate = (v: any) => typeof v === 'string' ? v : undefined;

function fromValue(v: any): any {
  if (!v || typeof v !== 'object') return v;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return Boolean(v.booleanValue);
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('referenceValue' in v) return v.referenceValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, fromValue(x)]));
  return v;
}

function decodeDocument(doc: any) {
  const fields = Object.fromEntries(Object.entries(doc.fields || {}).map(([k, v]) => [k, fromValue(v)]));
  const path = String(doc.name || '').split('/documents/')[1] || '';
  const pieces = path.split('/');
  return { id: pieces.at(-1) || '', path, ...fields };
}

async function firestoreRequest(token: string, url: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(String(data?.error?.message || 'Firestore retrieval failed.')), { status: response.status });
  return data;
}

async function listCollection(token: string, collectionName: string, pageSize = 80) {
  const data = await firestoreRequest(token, `${ROOT}/${collectionName}?pageSize=${Math.max(1, Math.min(100, pageSize))}`);
  return Array.isArray(data.documents) ? data.documents.map(decodeDocument) : [];
}

async function getDocument(token: string, path: string) {
  const data = await firestoreRequest(token, `${ROOT}/${path}`);
  return decodeDocument(data);
}

async function visible(token: string, row: any, uid: string, scope: RetrievalRequest['scope'] = 'site') {
  const visibility = String(row.visibility || 'public');
  const state = String(row.status || (row.isPublished === false ? 'unlisted' : 'published'));
  const ownerId = String(row.authorId || row.ownerId || row.author?.uid || row.owner?.uid || row.uid || '');
  if (row.isDeleted === true || state === 'deleted') return false;
  if (visibility === 'owner' || visibility === 'private') return Boolean(uid && ownerId === uid);
  if (visibility === 'public' || !row.visibility) return state === 'published' || (state === 'unlisted' && scope === 'page');
  if (visibility === 'unlisted') return scope === 'page';
  if (visibility === 'authenticated') return Boolean(uid) && state === 'published';
  if (visibility === 'followers') {
    if (!uid || !ownerId || ownerId === uid) return Boolean(uid);
    try { await getDocument(token, `users/${encodeURIComponent(ownerId)}/followers/${encodeURIComponent(uid)}`); return state === 'published'; } catch { return false; }
  }
  if (visibility === 'community') {
    const communityId = String(row.communityId || row.community?.id || '');
    if (!uid || !communityId) return false;
    try { await getDocument(token, `communities/${encodeURIComponent(communityId)}/members/${encodeURIComponent(uid)}`); return state === 'published'; } catch { return false; }
  }
  return false;
}

function plainText(row: any) {
  const blocks = Array.isArray(row.contentBlocks) ? row.contentBlocks.flatMap((b: any) => [b?.content, b?.calloutTitle, b?.items?.join(' '), b?.codeBlock?.code]) : [];
  return clip([row.title, row.excerpt, row.summary, row.content, row.details, row.description, ...blocks, ...(row.tags || []), ...(row.hashtags || []), ...(row.topics || [])].filter(Boolean).join(' '), 9000);
}

function rank(row: any, q: string) {
  const hay = plainText(row).toLowerCase();
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  let score = 0;
  if (!q) score = 1;
  if (q && String(row.title || '').toLowerCase() === q.toLowerCase()) score += 100;
  if (q && String(row.title || '').toLowerCase().includes(q.toLowerCase())) score += 50;
  for (const t of terms) score += hay.includes(t) ? 8 : 0;
  score += Math.min(5, Number(row.viewsCount || row.followersCount || row.upvotesCount || 0) / 2000);
  const date = Date.parse(String(row.publishedAt || row.createdAt || ''));
  if (date) score += Math.max(0, 4 - (Date.now() - date) / 86400000 / 30);
  return score;
}

export async function getIntelligenceFlags(token: string) {
  try {
    const data = await firestoreRequest(token, `${ROOT}/intelligenceConfig/global`);
    const row = decodeDocument(data);
    return { unifiedSearch: row.unifiedSearch !== false, semanticSearch: row.semanticSearch === true, aiRetrieval: row.aiRetrieval !== false, recommendations: row.recommendations !== false, personalizedFeed: row.personalizedFeed !== false, activityEngine: row.activityEngine !== false, contentGraph: row.contentGraph !== false };
  } catch {
    return { unifiedSearch: true, semanticSearch: false, aiRetrieval: true, recommendations: true, personalizedFeed: true, activityEngine: true, contentGraph: true };
  }
}

export interface RetrievalRequest {
  query: string;
  uid: string;
  scope?: 'site' | 'saved' | 'page';
  current?: { type: string; id: string };
  savedIds?: Array<{ type: string; id: string }>;
  limit?: number;
}

const supported: Record<string, string> = { article: 'articles', post: 'posts', discussion: 'posts', question: 'questions', series: 'series', user: 'users', topic: 'topics', tag: 'tags' };

export async function retrieveOffscrpt(token: string, request: RetrievalRequest) {
  const flags = await getIntelligenceFlags(token);
  if (!flags.aiRetrieval) return { sources: [], context: '', retrievedAt: new Date().toISOString(), count: 0, disabled: true };
  const limit = Math.max(1, Math.min(20, request.limit || 8));
  const q = clip(request.query, 600).trim();
  const collections = request.scope === 'saved' && request.savedIds?.length ? Array.from(new Set(request.savedIds.map(x => supported[x.type]).filter(Boolean))) : Object.values(supported).filter(Boolean);
  const rows: any[] = [];

  if (request.scope === 'page' && request.current) {
    const coll = supported[request.current.type];
    if (coll) {
      try { rows.push(await getDocument(token, `${coll}/${encodeURIComponent(request.current.id)}`)); } catch { /* permissions/not found */ }
    }
  } else {
    const results = await Promise.all(collections.map(c => listCollection(token, c, c === 'users' ? 40 : 80).catch(() => [])));
    results.flat().forEach(row => rows.push(row));
    if (request.scope === 'saved' && request.savedIds?.length) {
      const wanted = new Set(request.savedIds.map(x => `${x.type}:${x.id}`));
      rows.splice(0, rows.length, ...rows.filter(x => wanted.has(`${x.type || 'article'}:${x.id}`) || wanted.has(`post:${x.id}`) || wanted.has(`article:${x.id}`)));
    }
  }

  const typed = rows.map(row => {
    const collection = String(row.path || '').split('/')[0];
    const type = collection === 'posts' ? (row.type === 'discussion' ? 'discussion' : 'post') : collection === 'articles' ? 'article' : collection === 'questions' ? 'question' : collection === 'series' ? 'series' : collection === 'users' ? 'user' : collection === 'topics' ? 'topic' : collection;
    return { type, id: String(row.id || ''), title: clip(row.title || row.name || row.username || row.id, 220), excerpt: clip(row.excerpt || row.summary || row.description || row.details || row.content, 800), content: plainText(row), authorId: String(row.authorId || row.ownerId || row.uid || ''), status: String(row.status || (row.isPublished === false ? 'unlisted' : 'published')), visibility: String(row.visibility || 'public'), publishedAt: asDate(row.publishedAt || row.createdAt), path: row.path, score: rank(row, q) };
  });
  const authorized: any[] = [];
  for (const x of typed) {
    if (!supported[x.type] || x.status === 'deleted') continue;
    if (await visible(token, x, request.uid, request.scope || 'site')) authorized.push(x);
  }

  const permitted = authorized;

  permitted.sort((a,b) => b.score - a.score);
  const dedupe = new Set<string>();
  const sources = permitted.filter(x => { const key = `${x.type}:${x.id}`; if (dedupe.has(key)) return false; dedupe.add(key); return true; }).slice(0, limit);
  const context = sources.map((s, i) => `[SOURCE ${i + 1}]\nTYPE: ${s.type}\nID: ${s.id}\nTITLE: ${s.title}\nEXCERPT: ${s.excerpt}\nCONTENT: ${s.content.slice(0, 5000)}`).join('\n\n');
  return { sources: sources.map(({ content, ...s }) => s), context, retrievedAt: new Date().toISOString(), count: sources.length };
}
