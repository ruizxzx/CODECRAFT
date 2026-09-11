import { auth, db } from './firebase';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { getUserSaves, getBookmarkCollections } from './community';
import type { Article, CommunityPost, Series } from '../types';
import { articleToContent, postToContent, seriesToContent } from './content';
import type { ContentEntity } from './intelligence/types';
import { searchEverything } from './unifiedSearch';
import { recommendationEngine } from './recommendationEngine';
import { getReadingIntelligence } from './readingIntelligence';

export interface KnowledgeSnapshot {
  entities: ContentEntity[];
  articles: Article[];
  posts: CommunityPost[];
  series: Series[];
  reading: Awaited<ReturnType<typeof getReadingIntelligence>>;
  savedIds: string[];
  collectionCount: number;
}

const uniqueById = <T extends { id?: string; slug?: string }>(items: T[]) => {
  const seen = new Set<string>();
  return items.filter(item => {
    const id = String(item.id || item.slug || '');
    if (!id || seen.has(id)) return false;
    seen.add(id); return true;
  });
};

export async function buildKnowledgeSnapshot(articles: Article[], posts: CommunityPost[] = [], series: Series[] = []): Promise<KnowledgeSnapshot> {
  const user = auth.currentUser;
  const reading = user ? await getReadingIntelligence().catch(() => ({ favoriteTopics: [], creatorAffinity: [], contentTypePreference: [], averageReadingDepth: 0, completionTendency: 0, recentInterests: [], longTermInterests: [], readingFrequency: { last7d: 0, last30d: 0 } })) : { favoriteTopics: [], creatorAffinity: [], contentTypePreference: [], averageReadingDepth: 0, completionTendency: 0, recentInterests: [], longTermInterests: [], readingFrequency: { last7d: 0, last30d: 0 } };
  let savedIds: string[] = [];
  let collectionCount = 0;
  if (user) {
    try { savedIds = (await getUserSaves(user.uid)).map(x => `${x.itemType}:${x.itemId}`); } catch { /* optional */ }
    try { collectionCount = (await getBookmarkCollections(user.uid)).length; } catch { /* optional */ }
  }
  const safeArticles = uniqueById(articles.filter(a => a.isPublished !== false && a.mainPublicationStatus !== 'unpublished'));
  const safePosts = uniqueById(posts.filter(p => (p as any).isPublished !== false && (p as any).mainPublicationStatus !== 'unpublished'));
  const safeSeries = uniqueById(series.filter(s => s.visibility !== 'private' && s.status !== 'archived'));
  const entities = [...safeArticles.map(articleToContent), ...safePosts.map(postToContent), ...safeSeries.map(seriesToContent)];
  return { entities, articles: safeArticles, posts: safePosts, series: safeSeries, reading, savedIds, collectionCount };
}

export interface KnowledgeSearchOptions { query: string; limit?: number; type?: ContentEntity['type']; }
export function searchKnowledge(entities: ContentEntity[], options: KnowledgeSearchOptions) {
  return searchEverything(entities, { query: options.query, limit: options.limit || 12, filters: options.type ? { types: [options.type] } : undefined, viewer: { userId: auth.currentUser?.uid } });
}

export function buildLearningPath(entities: ContentEntity[], snapshot: KnowledgeSnapshot, max = 8) {
  const topicWeights = new Map<string, number>();
  snapshot.reading.favoriteTopics.forEach(item => topicWeights.set(item.topic.toLowerCase(), Number(item.score || 0)));
  snapshot.reading.recentInterests.forEach(item => topicWeights.set(item.toLowerCase(), (topicWeights.get(item.toLowerCase()) || 0) + 2));
  snapshot.reading.longTermInterests.forEach(item => topicWeights.set(item.toLowerCase(), (topicWeights.get(item.toLowerCase()) || 0) + 0.5));
  const topicAffinity: Record<string, number> = {};
  topicWeights.forEach((value, key) => { topicAffinity[key] = value; });
  const creatorAffinity: Record<string, number> = {};
  snapshot.reading.creatorAffinity.forEach(item => { creatorAffinity[item.creatorId] = item.score; });
  const completed = new Set<string>();
  const ranked = recommendationEngine.recommend(entities, { userId: auth.currentUser?.uid, context: 'learning-path', limit: Math.max(max * 2, 12) }, { topicAffinity, creatorAffinity, completed, recentIds: new Set(snapshot.savedIds) });
  return ranked.slice(0, max).map((x, i) => ({ step: i + 1, entity: x, reason: x.reason || 'Suggested from your OFFSCRPT interests' }));
}

export async function getTopicPulse(topic: string) {
  const clean = String(topic || '').trim().toLowerCase().replace(/^#/, '');
  if (!clean) return { content: 0, creators: 0, latestAt: null as string | null };
  try {
    const snap = await getDocs(query(collection(db, 'topics'), orderBy('updatedAt', 'desc'), limit(50)));
    const rows = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    const matched = rows.filter(r => String(r.slug || r.name || '').toLowerCase().replace(/^#/, '') === clean);
    const row = matched[0];
    return { content: Number(row?.contentCount || row?.postsCount || 0), creators: Number(row?.creatorCount || 0), latestAt: row?.updatedAt?.toDate?.()?.toISOString?.() || row?.updatedAt || null };
  } catch { return { content: 0, creators: 0, latestAt: null }; }
}

export function knowledgeShareUrl(kind: string, id: string) {
  if (typeof window === 'undefined') return '';
  const map: Record<string, string> = { article: 'article', post: 'community/post', discussion: 'community/post', question: 'question', series: 'series', topic: 'topic' };
  return `${window.location.origin}/#${map[kind] || kind}/${encodeURIComponent(id)}`;
}
