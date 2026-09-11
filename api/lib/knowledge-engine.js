const clip = (v, n) => String(v ?? '').slice(0, n);

function endpoint(name) { return String(process.env[name] || '').trim(); }
function token(name) { return String(process.env[name] || '').trim(); }


export function chunkText(text, options = {}) {
  const maxWords = Math.max(40, Math.min(400, Number(options.maxWords || 180)));
  const overlap = Math.max(0, Math.min(maxWords - 20, Number(options.overlapWords ?? 30)));
  const raw = clip(text, 100000).replace(/\r/g, '').trim();
  if (!raw) return [];
  const lines = raw.split(/\n+/);
  const sections = [];
  let headingPath = [];
  let buffer = [];
  const flush = () => { const body = buffer.join('\n').trim(); if (body) sections.push({ text: body, headingPath: [...headingPath] }); buffer = []; };
  for (const line of lines) {
    const m = /^(#{1,6})\s+(.+)$/.exec(line.trim());
    if (m) { flush(); const depth = m[1].length; headingPath = headingPath.slice(0, depth - 1); headingPath.push(m[2].trim()); }
    else buffer.push(line);
  }
  flush();
  const out = [];
  let index = 0;
  for (const section of (sections.length ? sections : [{ text: raw, headingPath: [] }])) {
    const words = section.text.split(/\s+/).filter(Boolean);
    const step = Math.max(20, maxWords - overlap);
    for (let offset = 0; offset < words.length; offset += step) {
      const slice = words.slice(offset, offset + maxWords);
      if (!slice.length) break;
      out.push({ index, text: slice.join(' '), headingPath: section.headingPath });
      index += 1;
      if (offset + slice.length >= words.length) break;
    }
  }
  return out;
}

export function getKnowledgeProviderConfig() {
  return {
    embeddingEndpoint: endpoint('OFFSCRPT_EMBEDDING_ENDPOINT'),
    vectorEndpoint: endpoint('OFFSCRPT_VECTOR_ENDPOINT'),
    searchEndpoint: endpoint('OFFSCRPT_SEARCH_ENDPOINT'),
    embeddingModel: endpoint('OFFSCRPT_EMBEDDING_MODEL') || 'configured-by-provider',
    configured: Boolean(endpoint('OFFSCRPT_VECTOR_ENDPOINT') && endpoint('OFFSCRPT_EMBEDDING_ENDPOINT')),
  };
}

async function callJson(url, body, secretEnv) {
  const secret = token(secretEnv);
  const headers = { 'Content-Type': 'application/json' };
  if (secret) headers.Authorization = `Bearer ${secret}`;
  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(String(data?.error || data?.message || `Provider request failed (${response.status}).`)), { status: response.status });
  return data;
}

export async function embedTexts(texts) {
  const url = endpoint('OFFSCRPT_EMBEDDING_ENDPOINT');
  if (!url) return null;
  const clipped = texts.map(x => clip(x, 12000)).filter(Boolean).slice(0, 100);
  if (!clipped.length) return [];
  const data = await callJson(url, { input: clipped, model: endpoint('OFFSCRPT_EMBEDDING_MODEL') || undefined }, 'OFFSCRPT_EMBEDDING_API_KEY');
  const vectors = Array.isArray(data?.vectors) ? data.vectors : Array.isArray(data?.data) ? data.data.map(x => x?.embedding).filter(Array.isArray) : null;
  if (!Array.isArray(vectors) || vectors.length !== clipped.length) throw new Error('Embedding provider returned an invalid vector payload.');
  return vectors;
}

export async function queryVector(vector, options = {}) {
  const url = endpoint('OFFSCRPT_VECTOR_ENDPOINT');
  if (!url) return null;
  const data = await callJson(url, { vector, limit: Math.max(1, Math.min(50, Number(options.limit || 10))), filter: options.filter || undefined }, 'OFFSCRPT_VECTOR_API_KEY');
  const matches = Array.isArray(data?.matches) ? data.matches : Array.isArray(data?.results) ? data.results : [];
  return matches.map(x => ({ id: String(x.id || ''), score: Number(x.score || x.similarity || 0), metadata: x.metadata || {} })).filter(x => x.id);
}

export async function upsertVectors(items) {
  const url = endpoint('OFFSCRPT_VECTOR_ENDPOINT');
  if (!url) return { configured: false, written: 0 };
  const safe = Array.isArray(items) ? items.slice(0, 100).map(x => ({ id: clip(x.id, 300), vector: x.vector, metadata: x.metadata || {} })) : [];
  if (!safe.length) return { configured: true, written: 0 };
  await callJson(url, { operation: 'upsert', items: safe }, 'OFFSCRPT_VECTOR_API_KEY');
  return { configured: true, written: safe.length };
}

export async function deleteVectors(ids) {
  const url = endpoint('OFFSCRPT_VECTOR_ENDPOINT');
  if (!url) return { configured: false, deleted: 0 };
  const safe = Array.isArray(ids) ? ids.map(x => clip(x, 300)).filter(Boolean).slice(0, 200) : [];
  if (!safe.length) return { configured: true, deleted: 0 };
  await callJson(url, { operation: 'delete', ids: safe }, 'OFFSCRPT_VECTOR_API_KEY');
  return { configured: true, deleted: safe.length };
}

export async function providerHealth() {
  const cfg = getKnowledgeProviderConfig();
  const out = { ...cfg, embedding: { ok: false, detail: 'not configured' }, vector: { ok: false, detail: 'not configured' } };
  if (cfg.embeddingEndpoint) {
    try { out.embedding = { ok: true, detail: 'endpoint configured' }; } catch (e) { out.embedding = { ok: false, detail: String(e?.message || e) }; }
  }
  if (cfg.vectorEndpoint) {
    try { out.vector = { ok: true, detail: 'endpoint configured' }; } catch (e) { out.vector = { ok: false, detail: String(e?.message || e) }; }
  }
  return out;
}
