import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { auth, db } from './firebase';

export interface ReadingIntelligence {
  favoriteTopics: Array<{ topic: string; score: number }>;
  creatorAffinity: Array<{ creatorId: string; score: number }>;
  contentTypePreference: Array<{ type: string; score: number }>;
  averageReadingDepth: number;
  completionTendency: number;
  recentInterests: string[];
  longTermInterests: string[];
  readingFrequency: { last7d: number; last30d: number };
}

const norm = (v: unknown) => String(v ?? '').toLowerCase().trim();
const dateMs = (v: any) => typeof v?.toDate === 'function' ? v.toDate().getTime() : Date.parse(String(v || '')) || 0;

export async function getReadingIntelligence(): Promise<ReadingIntelligence> {
  const uid = auth.currentUser?.uid;
  if (!uid) return { favoriteTopics: [], creatorAffinity: [], contentTypePreference: [], averageReadingDepth: 0, completionTendency: 0, recentInterests: [], longTermInterests: [], readingFrequency: { last7d: 0, last30d: 0 } };
  const [history, progress, searches] = await Promise.all([
    getDocs(query(collection(db, 'users', uid, 'history'), orderBy('viewedAt', 'desc'), limit(200))).catch(() => null),
    getDocs(query(collection(db, 'users', uid, 'readingProgress'), limit(200))).catch(() => null),
    getDocs(query(collection(db, 'users', uid, 'searches'), orderBy('createdAt', 'desc'), limit(100))).catch(() => null),
  ]);
  const topicScores = new Map<string, number>();
  const creatorScores = new Map<string, number>();
  const typeScores = new Map<string, number>();
  const now = Date.now();
  const recentTopicScores = new Map<string, number>();
  let depth = 0; let depthCount = 0; let completions = 0; let completionCount = 0; let last7 = 0; let last30 = 0;
  (history?.docs || []).forEach(d => {
    const row: any = d.data(); const at = dateMs(row.viewedAt || row.createdAt); const age = Math.max(0, now - at); const weight = at && age < 30 * 86400000 ? 1.5 : 1;
    const terms = [row.category, ...(Array.isArray(row.tags) ? row.tags : []), ...(String(row.title || '').toLowerCase().match(/[a-z0-9]{3,}/g) || []).slice(0, 8)].map(norm).filter(Boolean);
    terms.forEach(t => topicScores.set(t, (topicScores.get(t) || 0) + weight));
    if (at && age <= 7 * 86400000) { last7++; terms.forEach(t => recentTopicScores.set(t, (recentTopicScores.get(t) || 0) + 1)); }
    if (at && age <= 30 * 86400000) last30++;
    const creator = norm(row.authorUsername || row.authorId); if (creator) creatorScores.set(creator, (creatorScores.get(creator) || 0) + weight);
    const type = norm(row.contentType || 'article'); typeScores.set(type, (typeScores.get(type) || 0) + weight);
    const p = Math.max(0, Math.min(100, Number(row.progress || 0))); depth += p; depthCount++; if (p >= 100 || row.completed === true) completions++; completionCount++;
  });
  (progress?.docs || []).forEach(d => { const p = Math.max(0, Math.min(100, Number((d.data() as any).percent || 0))); depth += p; depthCount++; if (p >= 100 || (d.data() as any).completed) completions++; completionCount++; });
  (searches?.docs || []).forEach(d => { const q = norm((d.data() as any).query); q.split(/\s+/).filter(Boolean).forEach(t => topicScores.set(t, (topicScores.get(t) || 0) + 0.5)); });
  const top = (m: Map<string, number>, n = 12) => [...m.entries()].sort((a,b) => b[1] - a[1]).slice(0, n).map(([key, score]) => ({ topic: key, score }));
  return {
    favoriteTopics: top(topicScores).map(x => ({ topic: x.topic, score: x.score })),
    creatorAffinity: [...creatorScores.entries()].sort((a,b) => b[1] - a[1]).slice(0, 12).map(([creatorId, score]) => ({ creatorId, score })),
    contentTypePreference: [...typeScores.entries()].sort((a,b) => b[1] - a[1]).map(([type, score]) => ({ type, score })),
    averageReadingDepth: depthCount ? Math.round((depth / depthCount) * 10) / 10 : 0,
    completionTendency: completionCount ? Math.round((completions / completionCount) * 1000) / 10 : 0,
    recentInterests: [...recentTopicScores.entries()].sort((a,b) => b[1] - a[1]).slice(0, 10).map(([x]) => x),
    longTermInterests: [...topicScores.keys()].slice(0, 15),
    readingFrequency: { last7d: last7, last30d: last30 },
  };
}
