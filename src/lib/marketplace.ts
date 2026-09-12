import { auth, db } from './firebase';
import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { emitActivityEvent, activitySessionId } from './activity';
import type { CommerceProduct, CommercePublicPrice } from './commerce';

export type MarketplaceSort = 'relevance' | 'newest' | 'popular' | 'price_asc' | 'price_desc';
export interface MarketplaceQuery {
  q?: string;
  category?: string;
  subcategory?: string;
  type?: string;
  creatorId?: string;
  sort?: MarketplaceSort;
  cursor?: string;
  limit?: number;
}
export interface MarketplaceCreatorSummary {
  id: string;
  username: string;
  displayName: string;
  productCount: number;
  cover?: string;
}
export interface MarketplacePage {
  products: CommerceProduct[];
  prices: Record<string, CommercePublicPrice | undefined>;
  nextCursor?: string;
  hasMore: boolean;
  total: number;
  generatedAt: string;
}
export interface MarketplaceHome {
  featured: CommerceProduct[];
  trending: CommerceProduct[];
  newest: CommerceProduct[];
  creators: MarketplaceCreatorSummary[];
  prices: Record<string, CommercePublicPrice | undefined>;
  generatedAt: string;
}

const normalize = (value: unknown) => String(value ?? '').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, ' ').trim();
const cleanQuery = (value: unknown) => normalize(value).slice(0, 100);
const qs = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value) search.set(key, value); });
  return search.toString();
};

async function publicApi<T>(params: Record<string, string | undefined>): Promise<T> {
  const url = `/api/commerce?${qs(params)}`;
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(payload?.error || `Marketplace request failed (${response.status}).`));
  return payload as T;
}

export async function listMarketplaceProducts(input: MarketplaceQuery = {}): Promise<MarketplacePage> {
  const q = cleanQuery(input.q);
  return publicApi<MarketplacePage>({
    action: 'marketplace', q: q || undefined,
    category: input.category?.trim() || undefined,
    subcategory: input.subcategory?.trim() || undefined,
    type: input.type?.trim() || undefined,
    creatorId: input.creatorId?.trim() || undefined,
    sort: input.sort || 'relevance',
    cursor: input.cursor || undefined,
    limit: String(Math.max(6, Math.min(24, Number(input.limit || 24)))),
  });
}

export async function getMarketplaceHome(): Promise<MarketplaceHome> {
  return publicApi<MarketplaceHome>({ action: 'marketplaceHome' });
}

export async function getMarketplaceProductsByIds(ids: string[]): Promise<{ products: CommerceProduct[]; prices: Record<string, CommercePublicPrice | undefined> }> {
  const uniqueIds = Array.from(new Set(ids.map(String).map(s => s.trim()).filter(Boolean))).slice(0, 100);
  if (!uniqueIds.length) return { products: [], prices: {} };
  return publicApi({ action: 'marketplaceByIds', ids: uniqueIds.join(',') });
}

export async function isMarketplaceProductSaved(productId: string): Promise<boolean> {
  const uid = auth.currentUser?.uid;
  if (!uid || !productId) return false;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'savedProducts', productId));
    return snap.exists();
  } catch { return false; }
}

export async function getSavedMarketplaceProductIds(userId?: string): Promise<string[]> {
  const uid = userId || auth.currentUser?.uid;
  if (!uid || auth.currentUser?.uid !== uid) return [];
  try {
    const snap = await getDocs(query(collection(db, 'users', uid, 'savedProducts'), orderBy('createdAt', 'desc'), limit(200)));
    return snap.docs.map(d => d.id).filter(Boolean);
  } catch {
    try {
      const snap = await getDocs(query(collection(db, 'users', uid, 'savedProducts'), limit(200)));
      return snap.docs.map(d => d.id).filter(Boolean);
    } catch { return []; }
  }
}

export async function saveMarketplaceProduct(product: CommerceProduct): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in to save products.');
  if (!product.id) throw new Error('Product ID is missing.');
  const ref = doc(db, 'users', user.uid, 'savedProducts', product.id);
  try {
    const existing = await getDoc(ref);
    if (existing.exists()) return;
  } catch { /* creation attempt below remains authoritative */ }
  try {
    await setDoc(ref, {
      productId: product.id,
      uid: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: false });
  } catch (error) {
    const winner = await getDoc(ref).catch(() => null);
    if (!winner?.exists()) throw error;
  }
  void emitActivityEvent({ type: 'product_save', targetId: product.id, targetType: 'product', source: 'marketplace', sessionId: activitySessionId('marketplace'), metadata: { title: product.title } }).catch(() => {});
}

export async function unsaveMarketplaceProduct(productId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in to manage saved products.');
  if (!productId) return;
  await deleteDoc(doc(db, 'users', user.uid, 'savedProducts', productId));
  void emitActivityEvent({ type: 'product_unsave', targetId: productId, targetType: 'product', source: 'marketplace', sessionId: activitySessionId('marketplace') }).catch(() => {});
}

export async function toggleMarketplaceSave(product: CommerceProduct, saved: boolean): Promise<boolean> {
  if (saved) { await unsaveMarketplaceProduct(product.id); return false; }
  await saveMarketplaceProduct(product); return true;
}

export function recordMarketplaceEvent(type: 'marketplace_view' | 'marketplace_search' | 'marketplace_filter' | 'product_impression' | 'product_open' | 'product_gallery_open' | 'product_gallery_next' | 'creator_store_open' | 'category_open' | 'related_product_open' | 'search_result_click' | 'content_view' | 'content_open' | 'recommendation_click' | 'recommendation_impression' | 'share', targetId = '', metadata: Record<string, unknown> = {}): void {
  void emitActivityEvent({ type, targetId, targetType: 'product', source: 'marketplace', sessionId: activitySessionId('marketplace'), metadata }).catch(() => {});
}
