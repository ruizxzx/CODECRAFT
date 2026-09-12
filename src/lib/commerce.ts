import { auth, db } from './firebase';
import { collection, doc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';

export type CommerceProductType = 'content'|'digital_product'|'course'|'subscription'|'community'|'service'|'bundle'|'tip';
export type CommerceProductStatus = 'draft'|'active'|'archived'|'disabled';
export type CommerceBillingType = 'one_time'|'recurring';
export type CommerceOrderStatus = 'created'|'pending_payment'|'paid'|'partially_refunded'|'refunded'|'cancelled'|'failed';
export type CommerceEntitlementStatus = 'pending'|'active'|'expired'|'cancelled'|'refunded'|'revoked';

export interface CommerceProduct {
  id: string; creatorId: string; creatorUsername?: string; title: string; description: string;
  type: CommerceProductType; status: CommerceProductStatus; visibility: 'private'|'public';
  currency: string; priceIds: string[]; version: number; createdAt?: string; updatedAt?: string; publishedAt?: string; archivedAt?: string;
}
export interface CommercePrice {
  id: string; productId: string; amount: number; currency: string; billingType: CommerceBillingType;
  interval?: 'month'|'year'; intervalCount?: number; trialDays?: number; active: boolean; validFrom?: string; validUntil?: string;
}
export interface CommerceOrder {
  id: string; customerId: string; creatorId?: string; items: Array<{productId:string;priceId:string;quantity:number;unitAmount:number;lineTotal:number;title:string;type:CommerceProductType}>;
  subtotal: number; discount: number; tax: number; fees: number; total: number; currency: string; status: CommerceOrderStatus;
  paymentId?: string; entitlementIds?: string[]; createdAt?: string; paidAt?: string; refundedAt?: string;
}
export interface CommerceEntitlement {
  id: string; userId: string; sourceType: string; sourceId: string; resourceType: string; resourceId: string;
  status: CommerceEntitlementStatus; grantedAt?: string; startsAt?: string; expiresAt?: string;
  orderId?: string; revokedAt?: string;
}

const apiBase = '/api/commerce';
const getIdToken = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in required.');
  return user.getIdToken();
};

async function callApi<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const token = await getIdToken();
  const response = await fetch(`${apiBase}?action=${encodeURIComponent(action)}`, {
    method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(payload?.error || `Commerce request failed (${response.status}).`));
  return payload as T;
}

export async function createCommerceProduct(input: Pick<CommerceProduct,'title'|'description'|'type'|'visibility'|'currency'> & { price?: {amount:number;currency:string;billingType:CommerceBillingType;interval?:'month'|'year';intervalCount?:number;trialDays?:number} }): Promise<{product:CommerceProduct;price?:CommercePrice}> {
  return callApi('createProduct', input);
}
export async function createCommercePrice(input: {productId:string;amount:number;currency:string;billingType:CommerceBillingType;interval?:'month'|'year';intervalCount?:number;trialDays?:number}): Promise<{price:CommercePrice}> {
  return callApi('createPrice', input);
}
export async function setCommerceProductStatus(productId:string,status:'draft'|'active'|'archived'|'disabled'):Promise<{product:CommerceProduct}> {
  return callApi('setProductStatus',{productId,status});
}

export async function createCommerceCheckout(productId:string, priceId:string, idempotencyKey?:string): Promise<{order:CommerceOrder;payment:{id:string;status:string;testMode:boolean};entitlement?:CommerceEntitlement}> {
  return callApi('createCheckout', {productId,priceId,idempotencyKey:idempotencyKey || crypto.randomUUID()});
}
export async function confirmTestPayment(orderId:string, paymentId:string, idempotencyKey?:string): Promise<{order:CommerceOrder;payment:{id:string;status:string;testMode:boolean};entitlement:CommerceEntitlement}> {
  return callApi('confirmTestPayment', {orderId,paymentId,idempotencyKey:idempotencyKey || crypto.randomUUID()});
}
export async function requestCommerceRefund(orderId:string, reason?:string): Promise<{refundId:string;status:string;orderStatus:string;entitlementStatus?:string}> {
  return callApi('refundTestPayment', {orderId,reason:reason || 'Customer requested refund',idempotencyKey:crypto.randomUUID()});
}
export async function checkCommerceAccess(userId:string, resourceType:string, resourceId:string):Promise<boolean> {
  if (!userId || auth.currentUser?.uid !== userId) return false;
  const result = await callApi<{access:boolean}>('checkAccess',{resourceType,resourceId});
  return result.access === true;
}

export async function listCreatorCommerceProducts(userId: string): Promise<CommerceProduct[]> {
  if (!userId || auth.currentUser?.uid !== userId) return [];
  const snap = await getDocs(query(collection(db,'commerceProducts'), where('creatorId','==',userId), limit(100)));
  return snap.docs.map(d => ({id:d.id,...d.data()} as CommerceProduct)).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
}
export async function listActiveCommerceProducts(limitCount=50): Promise<CommerceProduct[]> {
  const snap = await getDocs(query(collection(db,'commerceProducts'), where('status','==','active'), limit(limitCount)));
  return snap.docs.map(d => ({id:d.id,...d.data()} as CommerceProduct)).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
}
export async function listUserCommerceOrders(userId:string):Promise<CommerceOrder[]> {
  if (!userId || auth.currentUser?.uid !== userId) return [];
  const snap = await getDocs(query(collection(db,'commerceOrders'), where('customerId','==',userId), limit(100)));
  return snap.docs.map(d => ({id:d.id,...d.data()} as CommerceOrder)).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
}
export async function listUserEntitlements(userId:string):Promise<CommerceEntitlement[]> {
  if (!userId || auth.currentUser?.uid !== userId) return [];
  const snap = await getDocs(query(collection(db,'entitlements'), where('userId','==',userId), limit(100)));
  return snap.docs.map(d => ({id:d.id,...d.data()} as CommerceEntitlement)).sort((a,b)=>String(b.grantedAt||'').localeCompare(String(a.grantedAt||'')));
}
export async function hasCommerceAccess(userId:string, resourceType:string, resourceId:string):Promise<boolean> {
  if (!userId || auth.currentUser?.uid !== userId) return false;
  const snap = await getDocs(query(collection(db,'entitlements'), where('userId','==',userId), limit(100)));
  const now=Date.now();
  return snap.docs.some(d => { const x:any=d.data(); if(x.status!=='active') return false; const startsRaw=x.startsAt?.toDate?.()?.getTime?.(); const starts=Number.isFinite(startsRaw)?startsRaw:(x.startsAt?Date.parse(x.startsAt):0); const expiresRaw=x.expiresAt?.toDate?.()?.getTime?.(); const expires=Number.isFinite(expiresRaw)?expiresRaw:(x.expiresAt?Date.parse(x.expiresAt):NaN); return (!starts || starts<=now) && (!Number.isFinite(expires) || expires>now); });
}
