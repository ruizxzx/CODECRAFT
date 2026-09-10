import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { optimizedGetDoc, optimizedGetDocs, isFirestoreQuotaError } from './firestoreOptimization';
import type { Article, Series } from '../types';

export type RecommendationSection = { title: string; reason?: string; articles: Article[] };

export interface RecommendationSignals {
  history: any[];
  saves: any[];
  following: any[];
  followedTopics: any[];
  followedSeries: any[];
  readingProgress: any[];
  searches: any[];
  reactions: any[];
}

const published = (a: Article) => a.isPublished !== false && a.mainPublicationStatus !== 'unpublished';
const norm = (x: unknown) => String(x || '').toLowerCase().replace(/^[@#]/, '').trim();
const unique = <T,>(items: T[]) => Array.from(new Set(items));

async function readSubcollection(uid: string, sub: string, max = 120): Promise<any[]> {
  const key = `recommendation:${uid}:${sub}:${max}`;
  try {
    const snap = await optimizedGetDocs(
      key,
      () => getDocs(query(collection(db, 'users', uid, sub), orderBy('createdAt', 'desc'), limit(max))),
      { ttlMs: 60_000, allowStaleOnQuota: true },
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    if (isFirestoreQuotaError(error)) return [];
    try {
      const snap = await optimizedGetDocs(
        `${key}:unordered`,
        () => getDocs(query(collection(db, 'users', uid, sub), limit(max))),
        { ttlMs: 60_000, allowStaleOnQuota: true },
      );
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch {
      return [];
    }
  }
}

export async function loadRecommendationSignals(uid: string): Promise<RecommendationSignals> {
  const [history, saves, following, followedTopics, followedSeries, readingProgress, searches, reactions] = await Promise.all([
    readSubcollection(uid, 'history', 150),
    readSubcollection(uid, 'saves', 150),
    readSubcollection(uid, 'following', 150),
    readSubcollection(uid, 'followedTopics', 100),
    readSubcollection(uid, 'followedSeries', 100),
    readSubcollection(uid, 'readingProgress', 200),
    readSubcollection(uid, 'searches', 100),
    readSubcollection(uid, 'reactionIndex', 150),
  ]);
  return { history, saves, following, followedTopics, followedSeries, readingProgress, searches, reactions };
}

export function subscribeRecommendationSignals(uid: string, callback: (signals: RecommendationSignals) => void, onError?: (error: unknown) => void): () => void {
  if (!uid) {
    callback({ history: [], saves: [], following: [], followedTopics: [], followedSeries: [], readingProgress: [], searches: [], reactions: [] });
    return () => {};
  }

  const names: Array<keyof RecommendationSignals> = ['history', 'saves', 'following', 'followedTopics', 'followedSeries', 'readingProgress'];
  const values: RecommendationSignals = { history: [], saves: [], following: [], followedTopics: [], followedSeries: [], readingProgress: [], searches: [], reactions: [] };
  let stopped = false;
  let pending = names.length;
  let intervalId: number | null = null;

  const emit = () => {
    if (!stopped && pending === 0) callback({ ...values });
  };

  // Keep high-value personalization signals realtime. Search/reaction indexes are
  // intentionally loaded on a throttled cadence instead of maintaining eight
  // permanent listeners; this materially lowers initial and ongoing Firestore reads.
  const unsubscribers = names.map((name) => {
    const coll = collection(db, 'users', uid, name);
    const q = name === 'history'
      ? query(coll, orderBy('viewedAt', 'desc'), limit(75))
      : query(coll, limit(name === 'readingProgress' ? 120 : 75));
    return onSnapshot(q, snap => {
      values[name] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      pending = Math.max(0, pending - 1);
      emit();
    }, error => {
      pending = Math.max(0, pending - 1);
      onError?.(error);
      emit();
    });
  });

  let secondaryLoading = false;
  const loadSecondarySignals = async () => {
    if (stopped || secondaryLoading) return;
    secondaryLoading = true;
    try {
      const [searches, reactions] = await Promise.all([
        readSubcollection(uid, 'searches', 50),
        readSubcollection(uid, 'reactionIndex', 75),
      ]);
      if (stopped) return;
      values.searches = searches;
      values.reactions = reactions;
      if (pending === 0) callback({ ...values });
    } catch (error) {
      if (!stopped) onError?.(error);
    } finally {
      secondaryLoading = false;
    }
  };

  void loadSecondarySignals();
  intervalId = window.setInterval(() => void loadSecondarySignals(), 120_000);

  return () => {
    stopped = true;
    if (intervalId !== null) window.clearInterval(intervalId);
    unsubscribers.forEach(unsub => unsub());
  };
}

function asDate(value: any): number {
  if (!value) return 0;
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  const n = new Date(value).getTime();
  return Number.isFinite(n) ? n : 0;
}

function articleTokens(a: Article): Set<string> {
  return new Set([norm(a.category), ...(a.tags || []).map(norm)].filter(Boolean));
}

function getAuthorKeys(a: Article): Set<string> {
  return new Set([norm(a.author?.uid), norm(a.author?.username)].filter(Boolean));
}

function getHistoryEntry(signals: RecommendationSignals): Map<string, any> {
  return new Map(signals.history.map(x => [String(x.slug || ''), x]).filter(([k]) => Boolean(k)));
}

function searchTokens(signals: RecommendationSignals): Set<string> {
  const values = signals.searches.flatMap(s => norm(s.query).split(/\s+/)).filter(Boolean);
  return new Set(values);
}

function isRecent(value: any, days = 30): boolean {
  const t = asDate(value);
  return t > 0 && Date.now() - t <= days * 86400000;
}

export function rankRecommendations(all: Article[], signals: RecommendationSignals, current?: Article | null, maxItems = 8): Article[] {
  const candidates = all.filter(published).filter(a => !current || a.slug !== current.slug);
  const historyBySlug = getHistoryEntry(signals);
  const saved = new Set(signals.saves.map(x => String(x.itemId || '')).filter(Boolean));
  const reacted = new Set(signals.reactions.flatMap(x => [x.slug, x.articleSlug, x.itemId]).map(x => String(x || '')).filter(Boolean));
  const followedTopics = new Set(signals.followedTopics.map(x => norm(x.topic || x.slug || x.id)).filter(Boolean));
  const followedSeries = new Set(signals.followedSeries.map(x => String(x.seriesId || x.id || '')).filter(Boolean));
  const followedCreators = new Set(signals.following.flatMap(x => [norm(x.uid || x.id), norm(x.username)]).filter(Boolean));
  const progressBySlug = new Map(signals.readingProgress.map(x => [String(x.slug || x.id || ''), Number(x.percent || 0)]).filter(([k]) => Boolean(k)));
  const queryTerms = searchTokens(signals);
  const recentActivityAt = Math.max(...signals.history.map(x => asDate(x.viewedAt || x.createdAt)), ...signals.saves.map(x => asDate(x.createdAt || x.updatedAt)), ...signals.following.map(x => asDate(x.createdAt || x.updatedAt)), ...signals.followedTopics.map(x => asDate(x.createdAt || x.updatedAt)), ...signals.followedSeries.map(x => asDate(x.createdAt || x.updatedAt)), ...signals.readingProgress.map(x => asDate(x.updatedAt)), ...signals.searches.map(x => asDate(x.createdAt)), ...signals.reactions.map(x => asDate(x.updatedAt)), 0);
  const recentActivity = recentActivityAt > 0 && Date.now() - recentActivityAt < 14 * 86400000;
  const historyTopics = new Set<string>();
  for (const h of signals.history) {
    const a = all.find(x => x.slug === h.slug);
    if (a) articleTokens(a).forEach(t => historyTopics.add(t));
  }
  const savedTopics = new Set<string>();
  for (const s of signals.saves) {
    const a = all.find(x => x.slug === s.itemId);
    if (a) articleTokens(a).forEach(t => savedTopics.add(t));
  }

  const scored = candidates.map(a => {
    const tokens = articleTokens(a);
    const authors = getAuthorKeys(a);
    let score = 0;
    const reasons: string[] = [];

    let overlap = 0;
    tokens.forEach(t => {
      if (followedTopics.has(t)) overlap += 1;
      if (historyTopics.has(t)) overlap += 0.6;
      if (savedTopics.has(t)) overlap += 0.8;
      if (queryTerms.has(t)) overlap += 1.2;
    });
    score += overlap * 6;
    if (overlap > 0 && queryTerms.size) reasons.push('matches your recent searches');
    if (tokens.size && [...tokens].some(t => followedTopics.has(t))) reasons.push('because you follow this topic');
    if (tokens.size && [...tokens].some(t => historyTopics.has(t))) reasons.push('based on what you read');
    if (tokens.size && [...tokens].some(t => savedTopics.has(t))) reasons.push('similar to something you saved');

    if ([...authors].some(k => followedCreators.has(k))) { score += 16; reasons.push('from a creator you follow'); }
    if (a.seriesId && followedSeries.has(String(a.seriesId))) { score += 13; reasons.push('from a series you follow'); }
    if (recentActivity && ([...tokens].some(t => historyTopics.has(t) || followedTopics.has(t)))) score += 2;

    const progress = progressBySlug.get(a.slug) ?? Number(historyBySlug.get(a.slug)?.progress || 0);
    const completed = progress >= 100 || historyBySlug.get(a.slug)?.completed === true;
    const partiallyRead = progress > 0 && progress < 100;
    if (completed) score -= 30;
    else if (partiallyRead) score -= 4;
    if (completed) reasons.push('reduced because you already completed it');

    if (saved.has(a.slug)) score -= 5;
    if (reacted.has(a.slug)) score -= 4;
    if (a.trending) score += 3;
    score += Math.min(3, Number(a.viewsCount || 0) / 2000);
    const freshnessDays = Math.max(0, (Date.now() - asDate(a.publishedAt)) / 86400000);
    score += Math.max(0, 4 - freshnessDays / 14);
    if (isRecent(a.publishedAt, 14)) reasons.push('recently published');

    return { a, score, reason: reasons[0] || 'recommended from your reading profile' };
  }).sort((x, y) => y.score - x.score || asDate(y.a.publishedAt) - asDate(x.a.publishedAt));

  const chosen: typeof scored = [];
  const authorCounts = new Map<string, number>();
  const topicCounts = new Map<string, number>();
  for (const item of scored) {
    if (chosen.length >= maxItems) break;
    const authors = [...getAuthorKeys(item.a)];
    const topics = [...articleTokens(item.a)];
    const maxAuthor = authors.length ? Math.max(...authors.map(k => authorCounts.get(k) || 0)) : 0;
    const maxTopic = topics.length ? Math.max(...topics.map(k => topicCounts.get(k) || 0)) : 0;
    const diversityPenalty = maxAuthor >= 2 || maxTopic >= 3;
    if (diversityPenalty && scored.length > maxItems * 2) continue;
    chosen.push(item);
    authors.forEach(k => authorCounts.set(k, (authorCounts.get(k) || 0) + 1));
    topics.slice(0, 3).forEach(k => topicCounts.set(k, (topicCounts.get(k) || 0) + 1));
  }
  if (chosen.length < maxItems) {
    for (const item of scored) {
      if (chosen.length >= maxItems || chosen.some(x => x.a.slug === item.a.slug)) continue;
      chosen.push(item);
    }
  }
  return chosen.map(x => x.a);
}

export async function buildRecommendations(all: Article[], uid?: string | null, current?: Article | null): Promise<RecommendationSection[]> {
  const candidates = all.filter(published);
  if (!uid) return [{ title: 'LATEST', articles: candidates.slice(0, 6) }];
  const signals = await loadRecommendationSignals(uid);
  return buildRecommendationSections(all, signals, current);
}

export function buildRecommendationSections(all: Article[], signals: RecommendationSignals, current?: Article | null): RecommendationSection[] {
  const candidates = all.filter(published);
  const history = [...signals.history].sort((a, b) => asDate(b.viewedAt || b.createdAt) - asDate(a.viewedAt || a.createdAt));
  const followedCreators = new Set(signals.following.flatMap(x => [norm(x.uid || x.id), norm(x.username)]).filter(Boolean));
  const followedTopics = new Set(signals.followedTopics.map(x => norm(x.topic || x.slug || x.id)).filter(Boolean));
  const followedSeries = new Set(signals.followedSeries.map(x => String(x.seriesId || x.id || '')).filter(Boolean));
  const historySet = new Set(history.map(x => String(x.slug || '')).filter(Boolean));
  const latestRead = history[0];
  const latestReadArticle = latestRead ? candidates.find(a => a.slug === latestRead.slug) : undefined;

  const recommended = rankRecommendations(all, signals, current, 8);
  const because = latestReadArticle ? candidates
    .filter(a => a.slug !== latestReadArticle.slug)
    .filter(a => [...articleTokens(a)].some(t => articleTokens(latestReadArticle).has(t)))
    .sort((a, b) => rankRecommendations([a, b], signals, current, 2).findIndex(x => x.slug === b.slug) - rankRecommendations([a, b], signals, current, 2).findIndex(x => x.slug === a.slug))
    .slice(0, 6) : [];
  const series = current?.seriesId ? candidates.filter(a => a.seriesId === current.seriesId && Number(a.seriesOrder || 0) > Number(current.seriesOrder || 0)).sort((a,b)=>Number(a.seriesOrder||0)-Number(b.seriesOrder||0)).slice(0,6) : [];
  const fromFollow = candidates.filter(a => [...getAuthorKeys(a)].some(k => followedCreators.has(k))).sort((a,b)=>asDate(b.publishedAt)-asDate(a.publishedAt)).slice(0,6);
  const topicArticles = candidates.filter(a => [...articleTokens(a)].some(t => followedTopics.has(t))).sort((a,b)=>asDate(b.publishedAt)-asDate(a.publishedAt)).slice(0,6);
  const followedSeriesArticles = candidates.filter(a => a.seriesId && followedSeries.has(String(a.seriesId))).sort((a,b)=>asDate(b.publishedAt)-asDate(a.publishedAt)).slice(0,6);
  const trending = [...candidates].sort((a,b)=>{
    const av = Number(a.viewsCount||0) + Object.values(a.reactionCounts||{}).reduce((n,v)=>n+Number(v||0),0)*8;
    const bv = Number(b.viewsCount||0) + Object.values(b.reactionCounts||{}).reduce((n,v)=>n+Number(v||0),0)*8;
    return bv-av || asDate(b.publishedAt)-asDate(a.publishedAt);
  }).slice(0,6);

  return [
    { title: 'FOR YOU', articles: recommended },
    { title: 'BECAUSE YOU READ...', reason: latestReadArticle?.title, articles: because },
    { title: 'CONTINUE YOUR SERIES', articles: series },
    { title: 'FROM PEOPLE YOU FOLLOW', articles: fromFollow },
    { title: 'MORE LIKE THIS', articles: current ? candidates.filter(a => a.slug !== current.slug && [...articleTokens(a)].some(t => articleTokens(current).has(t))).slice(0,6) : [] },
    { title: 'NEW IN YOUR TOPICS', articles: topicArticles },
    { title: 'CONTINUE FOLLOWED SERIES', articles: followedSeriesArticles },
    { title: 'TRENDING FOR YOU', articles: trending.filter(a => [...articleTokens(a)].some(t => followedTopics.has(t)) || recommended.some(r=>r.slug===a.slug)).slice(0,6) },
  ].filter(s => s.articles.length);
}


export interface FeedPreferences {
  mode?: 'algorithmic' | 'chronological';
  hiddenContentIds?: string[];
  mutedCreators?: string[];
  mutedTopics?: string[];
  mutedCommunities?: string[];
  updatedAt?: any;
}

const FEED_PREF_MAX = 100;

export async function getFeedPreferences(uid: string): Promise<FeedPreferences> {
  if (!uid) return {};
  try {
    const snap = await optimizedGetDoc(
      doc(db, 'users', uid, 'feedPreferences', 'default'),
      { ttlMs: 120_000, allowStaleOnQuota: true },
    );
    return snap.exists() ? (snap.data() as FeedPreferences) : {};
  } catch {
    return {};
  }
}

export async function updateFeedPreferences(uid: string, patch: Partial<FeedPreferences>): Promise<void> {
  if (!uid || auth.currentUser?.uid !== uid) throw new Error('Authentication required.');
  const clean = { ...patch } as FeedPreferences;
  if (clean.hiddenContentIds) clean.hiddenContentIds = unique(clean.hiddenContentIds.map(String).filter(Boolean)).slice(-FEED_PREF_MAX);
  if (clean.mutedCreators) clean.mutedCreators = unique(clean.mutedCreators.map(norm).filter(Boolean)).slice(-FEED_PREF_MAX);
  if (clean.mutedTopics) clean.mutedTopics = unique(clean.mutedTopics.map(norm).filter(Boolean)).slice(-FEED_PREF_MAX);
  if (clean.mutedCommunities) clean.mutedCommunities = unique(clean.mutedCommunities.map(String).filter(Boolean)).slice(-FEED_PREF_MAX);
  await setDoc(doc(db, 'users', uid, 'feedPreferences', 'default'), { ...clean, updatedAt: serverTimestamp() }, { merge: true });
}

export function applyFeedPreferences(items: Article[], prefs: FeedPreferences): Article[] {
  const hidden = new Set((prefs.hiddenContentIds || []).map(String));
  const mutedCreators = new Set((prefs.mutedCreators || []).map(norm));
  const mutedTopics = new Set((prefs.mutedTopics || []).map(norm));
  const mutedCommunities = new Set((prefs.mutedCommunities || []).map(norm));
  return items.filter(a => {
    if (hidden.has(a.slug) || hidden.has(a.id)) return false;
    const creatorKeys = [norm(a.author?.uid), norm(a.author?.username)].filter(Boolean);
    if (creatorKeys.some(k => mutedCreators.has(k))) return false;
    const topics = [...articleTokens(a)];
    if (topics.some(t => mutedTopics.has(t))) return false;
    const communityId = String((a as any).sourceCommunityId || (a as any).communityId || '').trim().toLowerCase();
    if (communityId && mutedCommunities.has(communityId)) return false;
    return true;
  });
}

export function buildChronologicalArticles(all: Article[], maxItems = 12, prefs: FeedPreferences = {}): Article[] {
  return applyFeedPreferences(all.filter(published), prefs)
    .sort((a, b) => asDate(b.publishedAt) - asDate(a.publishedAt))
    .slice(0, maxItems);
}

export async function saveColdStartTopics(topics: string[]): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sign in required.');
  const values = unique(topics.map(norm).filter(Boolean)).slice(0, 12);
  if (!values.length) throw new Error('Choose at least one topic.');
  await Promise.all(values.map(topic => setDoc(doc(db, 'users', uid, 'followedTopics', encodeURIComponent(topic)), {
    topic,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    source: 'cold-start',
  }, { merge: true })));
}
