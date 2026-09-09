import { collection, doc, getDoc, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { auth, db } from './firebase';
import { collectionGroup } from 'firebase/firestore';
import { optimizedGetDocs, isFirestoreQuotaError } from './firestoreOptimization';
import type { Article, Series } from '../types';

const norm = (v: string) => String(v || '').trim().toLowerCase().replace(/^#/, '');

export interface PersonalizedHomeData {
  continueSlug: string | null;
  recommended: Article[];
  followedCreatorArticles: Article[];
  followedSeriesArticles: Article[];
  topicArticles: Article[];
  trending: Article[];
  finishingSeries: Array<{ seriesId: string; seriesName: string; article: Article; progress: number }>;
  followedCreatorUsernames: string[];
  followedTopics: string[];
  followedSeriesIds: string[];
}

async function readUserSubcollection(uid: string, sub: string, max = 100) {
  try {
    const snap = await getDocs(query(collection(db, 'users', uid, sub), orderBy('createdAt', 'desc'), limit(max)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
  } catch (error) {
    // Never retry a quota failure with another billed query. Only the index/orderBy
    // fallback is attempted for genuine query-shape errors.
    if (isFirestoreQuotaError(error)) return [];
    try {
      const snap = await getDocs(query(collection(db, 'users', uid, sub), limit(max)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    } catch { return []; }
  }
}

export async function getPersonalizedHomeData(articles: Article[], series: Series[] = []): Promise<PersonalizedHomeData> {
  const uid = auth.currentUser?.uid;
  const base: PersonalizedHomeData = { continueSlug: null, recommended: [], followedCreatorArticles: [], followedSeriesArticles: [], topicArticles: [], trending: [], finishingSeries: [], followedCreatorUsernames: [], followedTopics: [], followedSeriesIds: [] };
  if (!uid) return base;

  const [history, saves, following, topics, progress] = await Promise.all([
    readUserSubcollection(uid, 'history', 100),
    readUserSubcollection(uid, 'saves', 100),
    readUserSubcollection(uid, 'following', 100),
    readUserSubcollection(uid, 'followedTopics', 100),
    readUserSubcollection(uid, 'readingProgress', 200),
  ]);

  const followedCreators = new Set<string>(following.map(x => String(x.username || '').toLowerCase()).filter(Boolean));
  const followedCreatorIds = new Set<string>(following.map(x => String(x.uid || x.id || '')).filter(Boolean));
  const followedTopics: string[] = Array.from(new Set(topics.map((x:any) => norm(x.topic || x.slug || x.id)).filter(Boolean))) as string[];
  const followedTopicSet = new Set(followedTopics);
  const historyRows = history.map(x => ({ slug: String(x.slug || ''), progress: Number(x.progress || 0), viewedAt: x.viewedAt?.toDate?.()?.toISOString?.() || x.viewedAt })).filter(x => x.slug);
  const historyBySlug = new Map(historyRows.map(x => [x.slug, x]));
  const saveSlugs = new Set(saves.filter(x => x.itemType === 'article').map(x => String(x.itemId || '')).filter(Boolean));

  const sortedHistory = [...historyRows].sort((a,b) => new Date(String(b.viewedAt || 0)).getTime() - new Date(String(a.viewedAt || 0)).getTime());
  base.continueSlug = sortedHistory.find(x => x.progress > 0 && x.progress < 100)?.slug || null;

  const candidates = articles.filter(a => a.isPublished !== false && a.mainPublicationStatus !== 'unpublished');
  const topicScore = (a: Article) => {
    const articleTopics = new Set([norm(a.category), ...(a.tags || []).map(norm)].filter(Boolean));
    return Array.from(articleTopics).filter(t => followedTopicSet.has(t)).length;
  };
  const historyTopics = new Set<string>();
  historyRows.forEach(h => {
    const a = articles.find(x => x.slug === h.slug);
    if (a) { if (a.category) historyTopics.add(norm(a.category)); (a.tags || []).forEach(t => historyTopics.add(norm(t))); }
  });
  const saveTopics = new Set<string>();
  saves.forEach(s => { const a = articles.find(x => x.slug === s.itemId); if (a) { saveTopics.add(norm(a.category)); (a.tags || []).forEach(t => saveTopics.add(norm(t))); } });

  base.followedCreatorUsernames = Array.from(followedCreators) as string[];
  base.followedTopics = followedTopics;

  base.followedCreatorArticles = candidates
    .filter(a => followedCreators.has(String(a.author?.username || '').toLowerCase()) || followedCreatorIds.has(String(a.author?.uid || '')))
    .sort((a,b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime())
    .slice(0, 8);

  base.topicArticles = candidates
    .filter(a => topicScore(a) > 0)
    .sort((a,b) => topicScore(b) - topicScore(a) || new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime())
    .slice(0, 8);

  base.recommended = candidates
    .filter(a => a.slug !== base.continueSlug && !saveSlugs.has(a.slug) && !base.followedCreatorArticles.some(x => x.slug === a.slug))
    .map(a => {
      const topics = new Set([norm(a.category), ...(a.tags || []).map(norm)].filter(Boolean));
      let score = 0;
      topics.forEach(t => { if (historyTopics.has(t)) score += 2; if (saveTopics.has(t)) score += 3; if (followedTopicSet.has(t)) score += 4; });
      if (a.trending) score += 3;
      score += Math.min(2, Number(a.viewsCount || 0) / 5000);
      return { a, score };
    })
    .sort((x,y) => y.score - x.score || new Date(y.a.publishedAt || 0).getTime() - new Date(x.a.publishedAt || 0).getTime())
    .slice(0, 8)
    .map(x => x.a);

  base.trending = [...candidates]
    .sort((a,b) => (Number(b.viewsCount || 0) + Object.values(b.reactionCounts || {}).reduce((n,v) => n + Number(v || 0), 0) * 8) - (Number(a.viewsCount || 0) + Object.values(a.reactionCounts || {}).reduce((n,v) => n + Number(v || 0), 0) * 8))
    .slice(0, 8);

  const progressRows: any[] = progress as any[];
  const progressMap = new Map<string, any>(progressRows.map((x:any) => [String(x.slug || x.id), x]));
  base.finishingSeries = candidates
    .filter(a => a.seriesId && progressMap.has(a.slug))
    .map(a => ({ seriesId: String(a.seriesId), seriesName: String(a.seriesName || series.find(s => s.id === a.seriesId)?.title || 'Series'), article: a, progress: Number((progressMap.get(a.slug) as any)?.percent || 0) }))
    .filter(x => x.progress > 0 && x.progress < 100)
    .sort((a,b) => b.progress - a.progress)
    .slice(0, 6);

  // Series-follow state is read from the public follower subcollections. This is intentionally
  // best-effort and never blocks the personalized article sections.
  if (series.length) {
    try {
      // One collection-group read replaces up to 100 per-series follower reads.
      // The follower documents contain userId, so the same information can be
      // resolved with a single bounded query.
      const followed = await optimizedGetDocs(
        `series-followers:${uid}`,
        () => getDocs(query(collectionGroup(db, 'followers'), where('userId', '==', uid), limit(100))),
        { ttlMs: 120_000, allowStaleOnQuota: true },
      );
      const ids = new Set(followed.docs.map(d => String(d.ref.parent.parent?.id || d.data().seriesId || '')).filter(Boolean));
      base.followedSeriesIds = series.map(s => s.id).filter(id => ids.has(id));
      const followedSeriesSet = new Set(base.followedSeriesIds);
      base.followedSeriesArticles = candidates.filter(a => a.seriesId && followedSeriesSet.has(a.seriesId))
        .sort((a,b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime()).slice(0, 8);
    } catch {
      // Fallback to the existing mirrored user subcollection without N per-series reads.
      const followed = await readUserSubcollection(uid, 'followedSeries', Math.min(100, series.length));
      base.followedSeriesIds = followed.map((x:any) => String(x.seriesId || x.id || '')).filter(Boolean);
      const followedSeriesSet = new Set(base.followedSeriesIds);
      base.followedSeriesArticles = candidates.filter(a => a.seriesId && followedSeriesSet.has(a.seriesId))
        .sort((a,b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime()).slice(0, 8);
    }
  }
  return base;
}

export async function followTopic(topic: string): Promise<boolean> {
  const uid = auth.currentUser?.uid;
  const value = norm(topic);
  if (!uid || !value) throw new Error('Sign in required.');
  const ref = doc(db, 'users', uid, 'followedTopics', encodeURIComponent(value));
  const existing = await getDoc(ref);
  if (existing.exists()) { const { deleteDoc } = await import('firebase/firestore'); await deleteDoc(ref); return false; }
  const { serverTimestamp, setDoc } = await import('firebase/firestore');
  await setDoc(ref, { topic: value, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return true;
}

export async function getTopicFollowStatus(topic: string): Promise<boolean> {
  const uid = auth.currentUser?.uid;
  const value = norm(topic);
  if (!uid || !value) return false;
  const snap = await getDoc(doc(db, 'users', uid, 'followedTopics', encodeURIComponent(value)));
  return snap.exists();
}
