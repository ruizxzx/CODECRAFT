import {
  DocumentReference,
  DocumentSnapshot,
  QuerySnapshot,
  getDoc,
  getDocs,
  getCountFromServer,
} from 'firebase/firestore';

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
  cachedAt: number;
};

const docCache = new Map<string, CacheEntry<DocumentSnapshot>>();
const docInflight = new Map<string, Promise<DocumentSnapshot>>();
const queryCache = new Map<string, CacheEntry<QuerySnapshot>>();
const queryInflight = new Map<string, Promise<QuerySnapshot>>();
const countCache = new Map<string, CacheEntry<number>>();
const countInflight = new Map<string, Promise<number>>();

let quotaCooldownUntil = 0;
let lastQuotaWarningAt = 0;
const DEFAULT_DOC_TTL = 30_000;
const DEFAULT_QUERY_TTL = 30_000;
const DEFAULT_COUNT_TTL = 300_000;
const QUOTA_COOLDOWN_MS = 20_000;

export function isFirestoreQuotaError(error: unknown): boolean {
  const e = error as any;
  const code = String(e?.code || '').toLowerCase();
  const message = String(e?.message || error || '').toLowerCase();
  return code.includes('resource-exhausted')
    || code.includes('quota')
    || message.includes('quota exceeded')
    || message.includes('resource-exhausted')
    || message.includes('429');
}

function markQuotaCooldown(error: unknown) {
  if (!isFirestoreQuotaError(error)) return;
  quotaCooldownUntil = Math.max(quotaCooldownUntil, Date.now() + QUOTA_COOLDOWN_MS);
  if (Date.now() - lastQuotaWarningAt > 5000) {
    lastQuotaWarningAt = Date.now();
    console.warn('Firestore quota cooldown active; suppressing duplicate reads/retries briefly.', error);
  }
}

export function isFirestoreQuotaCooldownActive(): boolean {
  return Date.now() < quotaCooldownUntil;
}

export function clearFirestoreOptimizationCaches() {
  docCache.clear();
  queryCache.clear();
  countCache.clear();
}

export function invalidateFirestoreDocument(path: string) {
  docCache.delete(path);
}

export function getFirestoreOptimizationStats() {
  return {
    cachedDocuments: docCache.size,
    cachedQueries: queryCache.size,
    cachedCounts: countCache.size,
    inFlightDocuments: docInflight.size,
    inFlightQueries: queryInflight.size,
    inFlightCounts: countInflight.size,
    quotaCooldown: isFirestoreQuotaCooldownActive(),
    quotaCooldownUntil,
  };
}

export async function optimizedGetDoc<T = any>(
  ref: DocumentReference<T>,
  options: { ttlMs?: number; allowStaleOnQuota?: boolean } = {},
): Promise<DocumentSnapshot<T>> {
  const ttlMs = options.ttlMs ?? DEFAULT_DOC_TTL;
  const key = ref.path;
  const cached = docCache.get(key) as CacheEntry<DocumentSnapshot<T>> | undefined;
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  if (isFirestoreQuotaCooldownActive()) {
    if (cached && options.allowStaleOnQuota !== false) return cached.value;
    throw new Error('Firestore quota cooldown is active. Please retry shortly.');
  }

  const existing = docInflight.get(key) as Promise<DocumentSnapshot<T>> | undefined;
  if (existing) return existing;

  const request = getDoc(ref).then((snap) => {
    docCache.set(key, { value: snap as DocumentSnapshot, expiresAt: Date.now() + ttlMs, cachedAt: Date.now() });
    return snap;
  }).catch((error) => {
    markQuotaCooldown(error);
    if (cached && options.allowStaleOnQuota !== false && isFirestoreQuotaError(error)) return cached.value;
    throw error;
  }).finally(() => {
    docInflight.delete(key);
  });

  docInflight.set(key, request as Promise<DocumentSnapshot>);
  return request;
}

export async function optimizedGetDocs<T = any>(
  key: string,
  loader: () => Promise<QuerySnapshot<T>>,
  options: { ttlMs?: number; allowStaleOnQuota?: boolean } = {},
): Promise<QuerySnapshot<T>> {
  const ttlMs = options.ttlMs ?? DEFAULT_QUERY_TTL;
  const cached = queryCache.get(key) as CacheEntry<QuerySnapshot<T>> | undefined;
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  if (isFirestoreQuotaCooldownActive()) {
    if (cached && options.allowStaleOnQuota !== false) return cached.value;
    throw new Error('Firestore quota cooldown is active. Please retry shortly.');
  }

  const existing = queryInflight.get(key) as Promise<QuerySnapshot<T>> | undefined;
  if (existing) return existing;

  const request = loader().then((snap) => {
    queryCache.set(key, { value: snap as QuerySnapshot, expiresAt: Date.now() + ttlMs, cachedAt: Date.now() });
    return snap;
  }).catch((error) => {
    markQuotaCooldown(error);
    if (cached && options.allowStaleOnQuota !== false && isFirestoreQuotaError(error)) return cached.value;
    throw error;
  }).finally(() => {
    queryInflight.delete(key);
  });

  queryInflight.set(key, request as Promise<QuerySnapshot>);
  return request;
}

export async function optimizedGetCount(
  key: string,
  loader: () => Promise<Awaited<ReturnType<typeof getCountFromServer>>>,
  ttlMs = DEFAULT_COUNT_TTL,
): Promise<number> {
  const cached = countCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  if (isFirestoreQuotaCooldownActive()) {
    if (cached) return cached.value;
    throw new Error('Firestore quota cooldown is active. Please retry shortly.');
  }

  const existing = countInflight.get(key);
  if (existing) return existing;

  const request = loader().then((snap) => {
    const value = Number(snap.data().count || 0);
    countCache.set(key, { value, expiresAt: Date.now() + ttlMs, cachedAt: Date.now() });
    return value;
  }).catch((error) => {
    markQuotaCooldown(error);
    if (cached && isFirestoreQuotaError(error)) return cached.value;
    throw error;
  }).finally(() => countInflight.delete(key));

  countInflight.set(key, request);
  return request;
}

/**
 * Generic guard for non-GET Firestore calls.
 * Quota failures are never retried automatically.
 * Other transient errors receive one bounded retry after a short delay.
 */
export async function guardedFirestoreWrite<T>(
  operation: () => Promise<T>,
  options: { retryTransient?: boolean; retryDelayMs?: number } = {},
): Promise<T> {
  const retryTransient = options.retryTransient ?? true;
  try {
    return await operation();
  } catch (firstError) {
    if (isFirestoreQuotaError(firstError)) {
      markQuotaCooldown(firstError);
      throw firstError;
    }
    if (!retryTransient) throw firstError;
    await new Promise((resolve) => setTimeout(resolve, options.retryDelayMs ?? 350));
    try {
      return await operation();
    } catch (secondError) {
      if (isFirestoreQuotaError(secondError)) markQuotaCooldown(secondError);
      throw secondError;
    }
  }
}
