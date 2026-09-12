import { chunkText, embedTexts, upsertVectors, deleteVectors, getKnowledgeProviderConfig } from '../../server/knowledge-engine.js';

function authorizedWorker(req: any) {
  const expected = String(process.env.OFFSCRPT_KNOWLEDGE_WORKER_SECRET || '').trim();
  if (!expected) return false;
  return String(req.headers['x-offscrpt-worker-secret'] || '') === expected;
}

export default async function handler(req: any, res: any) {
  if (!['POST','DELETE'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed.' });
  if (!authorizedWorker(req)) return res.status(401).json({ error: 'Knowledge worker authorization required.' });
  if (!getKnowledgeProviderConfig().configured) return res.status(503).json({ error: 'Semantic provider is not configured.' });
  try {
    const body = req.body || {};
    const contentId = String(body.contentId || '').trim().slice(0, 256);
    const contentType = String(body.contentType || '').trim().slice(0, 64);
    if (!contentId || !contentType) return res.status(400).json({ error: 'contentId and contentType are required.' });
    if (req.method === 'DELETE') {
      const ids = Array.isArray(body.ids) ? body.ids : [`${contentType}:${contentId}`];
      const result = await deleteVectors(ids);
      return res.status(200).json({ ok: true, operation: 'delete', ...result });
    }
    const sourceText = String(body.text || '').trim();
    if (!sourceText) return res.status(400).json({ error: 'text is required.' });
    const chunks = chunkText(sourceText, { maxWords: body.maxWords, overlapWords: body.overlapWords });
    if (!chunks.length) return res.status(400).json({ error: 'No indexable text found.' });
    const vectors = await embedTexts(chunks.map(x => x.text));
    if (!vectors || vectors.length !== chunks.length) return res.status(502).json({ error: 'Embedding provider returned an invalid result.' });
    const prefix = `${contentType}:${contentId}:v84:`;
    const items = chunks.map((chunk, i) => ({
      id: `${prefix}${i}`,
      vector: vectors[i],
      metadata: {
        contentId,
        contentType,
        authorId: String(body.authorId || '').slice(0, 128),
        title: String(body.title || '').slice(0, 220),
        tags: Array.isArray(body.tags) ? body.tags.slice(0, 50).map((x: any) => String(x).slice(0, 80)) : [],
        topics: Array.isArray(body.topics) ? body.topics.slice(0, 50).map((x: any) => String(x).slice(0, 80)) : [],
        visibility: String(body.visibility || 'public').slice(0, 32),
        status: String(body.status || 'published').slice(0, 32),
        sourcePath: String(body.sourcePath || '').slice(0, 500),
        chunkIndex: i,
        chunkText: chunk.text.slice(0, 4000),
        headingPath: chunk.headingPath,
        indexedAt: new Date().toISOString(),
      },
    }));
    const result = await upsertVectors(items);
    return res.status(200).json({ ok: true, operation: 'upsert', contentId, contentType, chunks: chunks.length, ...result });
  } catch (error: any) {
    console.error('OFFSCRPT knowledge indexing failed', error);
    return res.status(Number(error?.status) || 502).json({ error: String(error?.message || 'Knowledge indexing failed.') });
  }
}
