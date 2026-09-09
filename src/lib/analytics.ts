import { auth, db } from './firebase';
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  where,
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

  // Reader clients cannot read analytics records; analytics aggregation is creator/admin-only.
  // The article view keeps the current session totals locally and writes the complete current
  // snapshot on each bounded heartbeat/milestone.
  const payload: Record<string, unknown> = {
    id: sid,
    type: 'session',
    slug,
    userId: uid,
    visitorId: visitor,
    device: device(),
    source: String(patch.source || 'article').slice(0, 80),
    maxScrollPercent: cleanPercent(patch.maxScrollPercent),
    durationMs: cleanDuration(patch.durationMs),
    completed: Boolean(patch.completed),
    currentSection: String(patch.currentSection || '').slice(0, 200),
    scrollY: Math.max(0, Math.min(100_000_000, Number(patch.scrollY ?? 0))),
    seriesId: String(patch.seriesId ?? '').slice(0, 200),
    seriesOrder: Number(patch.seriesOrder ?? 0),
  };

  payload.lastSeenAt = serverTimestamp();

  let needsCreateFields = true;
  let createdKey = '';
  if (typeof window !== 'undefined') {
    try {
      createdKey = `offscrpt:analytics-created:${sid}`;
      needsCreateFields = !sessionStorage.getItem(createdKey);
    } catch (error) {
      console.warn('Analytics session timestamp state unavailable; retrying create safely:', error);
      needsCreateFields = true;
    }
  }

  if (needsCreateFields) {
    payload.openedAt = serverTimestamp();
    payload.createdAt = serverTimestamp();
  }

  try {
    await setDoc(ref, payload, { merge: true });
    if (createdKey && typeof window !== 'undefined') {
      try { sessionStorage.setItem(createdKey, '1'); } catch (error) { console.warn('Analytics session state could not be persisted:', error); }
    }
  } catch (error) {
    // A concurrent tab/heartbeat can win the initial create between the local check and write.
    // Retry once as an update without create-only timestamp fields. If the document truly does
    // not exist, the original create error is preserved and surfaced to the caller.
    if (needsCreateFields) {
      const updatePayload = { ...payload };
      delete updatePayload.openedAt;
      delete updatePayload.createdAt;
      try {
        await setDoc(ref, updatePayload, { merge: true });
        if (createdKey && typeof window !== 'undefined') {
          try { sessionStorage.setItem(createdKey, '1'); } catch (retryStateError) { console.warn('Analytics session state could not be persisted after retry:', retryStateError); }
        }
        return;
      } catch (retryError) {
        console.error('Analytics session write failed after create/update retry:', retryError);
        throw retryError;
      }
    }
    console.error('Analytics session write failed:', error);
    throw error;
  }
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

function aggregateAnalyticsRows(
  rows: Array<Record<string, unknown>>,
  fallbackViews = 0,
  days: number | 'all' = 'all',
): ArticleAnalyticsAggregate {
  const base = empty();
  const cutoff = days === 'all' ? 0 : Date.now() - days * 86_400_000;
  const inRange = rows.filter((row) => dateValue(row.lastSeenAt || row.createdAt || row.openedAt) >= cutoff);
  const sessions = inRange.filter((row) => row.type === 'session');
  const events = inRange.filter((row) => row.type !== 'session');

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

  // Shares are append-only events. Bookmark/reaction metrics are stateful: use the
  // latest event from each reader rather than counting every toggle as a new active state.
  base.shares = events.filter((event) => event.type === 'share').length;
  const latestState = new Map<string, Record<string, unknown>>();
  events
    .filter((event) => event.type === 'bookmark' || event.type === 'reaction')
    .sort((a, b) => dateValue(a.createdAt) - dateValue(b.createdAt))
    .forEach((event) => {
      const identity = readerKey(event);
      if (identity) latestState.set(`${event.type}:${identity}`, event);
    });
  base.bookmarks = [...latestState.values()].filter((event) => event.type === 'bookmark' && event.active !== false).length;
  base.reactions = [...latestState.values()].filter((event) => event.type === 'reaction' && event.active !== false).length;
  base.lastUpdatedAt = inRange.reduce((latest, row) => Math.max(latest, dateValue(row.lastSeenAt || row.createdAt || row.openedAt)), 0);
  return base;
}

export async function getArticleAnalyticsAggregate(
  slug: string,
  fallbackViews = 0,
  days: number | 'all' = 'all',
): Promise<ArticleAnalyticsAggregate> {
  if (!slug) return empty();
  // Read the authoritative Firestore analytics collection. No synthetic rows are generated.
  const analyticsRef = collection(db, 'articles', slug, 'analytics');
  const analyticsQuery = days === 'all' ? query(analyticsRef) : query(analyticsRef, where('createdAt', '>=', Timestamp.fromMillis(Date.now() - days * 86_400_000)));
  const snap = await getDocs(analyticsQuery);
  const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));
  return aggregateAnalyticsRows(rows, fallbackViews, days);
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
    days === 'all'
      ? query(collection(db, 'articles', slug, 'analytics'))
      : query(collection(db, 'articles', slug, 'analytics'), where('createdAt', '>=', Timestamp.fromMillis(Date.now() - days * 86_400_000))),
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));
      cb(aggregateAnalyticsRows(rows, 0, days));
    },
    (error) => {
      console.error('Article analytics subscription failed:', error);
      cb(empty());
    },
  );

  return unsubscribe;
}
