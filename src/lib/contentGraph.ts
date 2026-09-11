import { collection, doc, getDocs, limit, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from './firebase';
import type { ContentEntity, ContentRelationship, ContentType } from './intelligence/types';

export async function upsertContentRelationship(rel: Omit<ContentRelationship, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const id = `${rel.fromType}_${rel.fromId}__${rel.type}__${rel.toType}_${rel.toId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 450);
  await setDoc(doc(db, 'contentRelationships', id), { ...rel, updatedAt: serverTimestamp(), createdAt: serverTimestamp() }, { merge: true });
  return id;
}

export async function getContentRelationships(contentId: string, direction: 'both' | 'from' | 'to' = 'both', max = 40): Promise<ContentRelationship[]> {
  const out: ContentRelationship[] = [];
  if (direction !== 'to') {
    const snap = await getDocs(query(collection(db, 'contentRelationships'), where('fromId', '==', contentId), limit(Math.min(100, max))));
    snap.docs.forEach(d => out.push({ id: d.id, ...(d.data() as any) }));
  }
  if (direction !== 'from' && out.length < max) {
    const snap = await getDocs(query(collection(db, 'contentRelationships'), where('toId', '==', contentId), limit(Math.min(100, max - out.length))));
    snap.docs.forEach(d => out.push({ id: d.id, ...(d.data() as any) }));
  }
  return out.slice(0, max);
}

function overlap(a: ContentEntity, b: ContentEntity) {
  const bTokens = new Set(b.search.tokens);
  let score = 0;
  for (const t of a.search.tokens) if (bTokens.has(t)) score += 1;
  score += a.tags.filter(t => b.tags.includes(t)).length * 2;
  score += a.topics.filter(t => b.topics.includes(t)).length * 2.5;
  if (a.authorId && a.authorId === b.authorId) score += 2;
  if (a.seriesId && a.seriesId === b.seriesId) score += 4;
  return score;
}

export function deriveRelatedContent(current: ContentEntity, candidates: ContentEntity[], max = 8): ContentEntity[] {
  return candidates.filter(x => x.id !== current.id).map(candidate => ({ candidate, score: overlap(current, candidate) + Math.max(0, 3 - ((Date.now() - new Date(candidate.publishedAt || candidate.createdAt || 0).getTime()) / 86400000 / 30)) })).filter(x => x.score > 0).sort((a,b) => b.score - a.score).slice(0, max).map(x => x.candidate);
}

export async function getRelatedContent(contentId: string, candidates: ContentEntity[] = [], max = 8): Promise<ContentEntity[]> {
  const explicit = await getContentRelationships(contentId, 'both', max);
  const ids = new Set(explicit.map(x => x.fromId === contentId ? x.toId : x.fromId));
  const explicitEntities = candidates.filter(c => ids.has(c.id));
  const current = candidates.find(c => c.id === contentId);
  const derived = current ? deriveRelatedContent(current, candidates.filter(c => !ids.has(c.id)), max - explicitEntities.length) : [];
  return [...explicitEntities, ...derived].slice(0, max);
}

export function relationshipForSeries(current: ContentEntity, next: ContentEntity): ContentRelationship {
  const direction: ContentRelationship['type'] = Number(next.search.tokens.indexOf('part')) >= 0 ? 'part_of' : 'related';
  return { fromId: current.id, fromType: current.type as ContentType, toId: next.id, toType: next.type as ContentType, type: direction, source: 'derived' };
}
