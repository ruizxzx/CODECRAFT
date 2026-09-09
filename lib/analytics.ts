import { auth, db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  setDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

export type AnalyticsEventType = 'session' | 'share' | 'bookmark' | 'reaction' | 'complete';

export interface AnalyticsSessionPatch {
  maxScrollPercent?: number;
  durationMs?: number;
  completed?: boolean;
  currentSection?: string;
  scrollY?: number;
  seriesId?: string;
  seriesOrder?: number;
  source?: string;
}

function visitorId(): string {
  if (typeof window === 'undefined') return 'server';
  const key = 'offscrpt:analytics-visitor:v3';
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const value = crypto.randomUUID();
    localStorage.setItem(key, value);
    return value;
  } catch (error) {
    console.warn('Analytics visitor ID fallback used:', error);
    return `anon-${Math.random().toString(36).slice(2)}`;
  }
}

function sessionId(slug: string): string {
  const uid = auth.currentUser?.uid || visitorId();
  const key = `offscrpt:analytics-session:${uid}:${slug}`;
  if (typeof window === 'undefined') return `server-${uid}-${slug}`;
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const value = crypto.randomUUID();
    sessionStorage.setItem(key, value);
    return value;
  } catch (error) {
    console.warn('Analytics session ID fallback used:', error);
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

const device = () =>
  typeof navigator === 'undefined'
    ? 'unknown'
    : `${navigator.platform || 'unknown'} · ${typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'unknown'}`;

const cleanPercent = (value: unknown) => Math.max(0, Math.min(100, Number(value || 0)));
const cleanDuration = (value: unknown) => Math.max(0, Math.min(86_400_000, Number(value || 0)));

export async function upsertArticleAnalyticsSession(slug: string, patch: AnalyticsSessionPatch = {}): Promise<void> {
  if (!slug) return;

  const uid = auth.currentUser?.uid || '';
  const visitor = uid ? '' : visitorId();
  const sid = sessionId(slug);
  const ref = doc(db, 'articles', slug, 'analytics', sid);

  const existing = await getDoc(ref);
  const previous = existing.exists() ? (existing.data() as Record<string, unknown>) : undefined;

  const payload: Record<string, unknown> = {
    id: sid,
    type: 'session',
    slug,
    userId: uid,
    visitorId: visitor,
    device: device(),
    source: String(patch.source || previous?.source || 'article').slice(0, 80),
    lastSeenAt: serverTimestamp(),
    maxScrollPercent: Math.max(cleanPercent(previous?.maxScrollPercent), cleanPercent(patch.maxScrollPercent)),
    durationMs: Math.max(cleanDuration(previous?.durationMs), cleanDuration(patch.durationMs)),
    completed: Boolean(patch.completed || previous?.completed),
    currentSection: String(patch.currentSection || previous?.currentSection || '').slice(0, 200),
    scrollY: Math.max(0, Math.min(100_000_000, Number(patch.scrollY ?? previous?.scrollY ?? 0))),
    seriesId: String(patch.seriesId ?? previous?.seriesId ?? '').slice(0, 200),
    seriesOrder: Number(patch.seriesOrder ?? previous?.seriesOrder ?? 0),
  };

  if (!previous) {
    payload.openedAt = serverTimestamp();
    payload.createdAt = serverTimestamp();
  }

  await setDoc(ref, payload, { merge: true });
}

export async function recordArticleAnalyticsEvent(
  slug: string,
  type: Exclude<AnalyticsEventType, 'session'>,
  payload: Record<string, unknown> = {},
): Promise<void> {
  if (!slug) return;
  const eventRef = doc(collection(db, 'articles', slug, 'analytics'));
  const uid = auth.currentUser?.uid || '';
  await setDoc(eventRef, {
    type,
    slug,
    userId: uid,
    visitorId: uid ? '' : visitorId(),
    createdAt: serverTimestamp(),
    ...payload,
  });
}

export interface ArticleAnalyticsAggregate {
  views: number;
  uniqueReaders: number;
  averageReadingTimeMs: number;
  completionRate: number;
  scrollDepth: number;
  reactions: number;
  bookmarks: number;
  comments: number;
  shares: number;
  returnReaders: number;
  funnel: { opened: number; p25: number; p50: number; p75: number; completed: number };
  hasSessionData?: boolean;
  lastUpdatedAt?: number;
}

const empty = (): ArticleAnalyticsAggregate => ({
  views: 0,
  uniqueReaders: 0,
  averageReadingTimeMs: 0,
  completionRate: 0,
  scrollDepth: 0,
  reactions: 0,
  bookmarks: 0,
  comments: 0,
  shares: 0,
  returnReaders: 0,
  funnel: { opened: 0, p25: 0, p50: 0, p75: 0, completed: 0 },
  hasSessionData: false,
});

function dateValue(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof value === 'string') return Date.parse(value) || 0;
  if (typeof value === 'number') return value;
  return 0;
}

function readerKey(row: Record<string, unknown>): string {
  return String(row.userId || row.visitorId || row.sessionId || '');
}

export async function getArticleAnalyticsAggregate(
  slug: string,
  fallbackViews = 0,
  days: number | 'all' = 'all',
): Promise<ArticleAnalyticsAggregate> {
  if (!slug) return empty();

  const base = empty();
  const cutoff = days === 'all' ? 0 : Date.now() - days * 86_400_000;

  // One bounded query protects the admin dashboard from unbounded historical reads.
  const snap = await getDocs(query(collection(db, 'articles', slug, 'analytics'), limit(1500)));
  const rows = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
    .filter((row) => dateValue(row.lastSeenAt || row.createdAt || row.openedAt) >= cutoff);

  const sessions = rows.filter((row) => row.type === 'session');
  const events = rows.filter((row) => row.type !== 'session');

  base.hasSessionData = sessions.length > 0;
  base.views = Math.max(fallbackViews, sessions.length);

  const uniqueIds = new Set<string>();
  const sessionCounts = new Map<string, number>();
  sessions.forEach((session) => {
    const key = readerKey(session);
    if (!key) return;
    uniqueIds.add(key);
    sessionCounts.set(key, (sessionCounts.get(key) || 0) + 1);
  });

  base.uniqueReaders = uniqueIds.size;
  base.returnReaders = [...sessionCounts.values()].filter((count) => count > 1).length;

  if (sessions.length) {
    const totalDuration = sessions.reduce((sum, session) => sum + cleanDuration(session.durationMs), 0);
    const totalScroll = sessions.reduce((sum, session) => sum + cleanPercent(session.maxScrollPercent), 0);
    const completed = sessions.filter((session) => Boolean(session.completed) || cleanPercent(session.maxScrollPercent) >= 100).length;

    base.averageReadingTimeMs = Math.round(totalDuration / sessions.length);
    base.scrollDepth = Math.round(totalScroll / sessions.length);
    base.completionRate = Math.round((completed / sessions.length) * 100);

    base.funnel = {
      opened: sessions.length,
      p25: sessions.filter((session) => cleanPercent(session.maxScrollPercent) >= 25).length,
      p50: sessions.filter((session) => cleanPercent(session.maxScrollPercent) >= 50).length,
      p75: sessions.filter((session) => cleanPercent(session.maxScrollPercent) >= 75).length,
      completed,
    };
  }

  base.shares = events.filter((event) => event.type === 'share').length;
  base.bookmarks = events.filter((event) => event.type === 'bookmark' && event.active !== false).length;
  base.reactions = events.filter((event) => event.type === 'reaction' && event.active !== false).length;

  base.lastUpdatedAt = rows.reduce((latest, row) => Math.max(latest, dateValue(row.lastSeenAt || row.createdAt || row.openedAt)), 0);
  return base;
}

export function subscribeArticleAnalytics(
  slug: string,
  cb: (aggregate: ArticleAnalyticsAggregate) => void,
  days: number | 'all' = 'all',
): () => void {
  if (!slug) {
    cb(empty());
    return () => undefined;
  }

  const unsubscribe = onSnapshot(
    query(collection(db, 'articles', slug, 'analytics'), limit(1500)),
    () => {
      void getArticleAnalyticsAggregate(slug, 0, days)
        .then(cb)
        .catch((error) => {
          console.error('Article analytics aggregation failed:', error);
          cb(empty());
        });
    },
    (error) => {
      console.error('Article analytics subscription failed:', error);
      cb(empty());
    },
  );

  return unsubscribe;
}
