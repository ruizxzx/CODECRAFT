import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import type { Notification, UserSavedItem } from '../types';
import { subscribeArticleHistory, type ArticleHistoryItem } from './reading';

export type ReadingQueueItem = {
  id: string;
  itemId: string;
  itemType: 'article' | 'post';
  title: string;
  createdAt?: string;
};

export interface NotificationPreferences {
  comments: boolean;
  replies: boolean;
  mentions: boolean;
  follows: boolean;
  reactions: boolean;
  productNews: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  comments: true,
  replies: true,
  mentions: true,
  follows: true,
  reactions: true,
  productNews: true,
};

const iso = (value: any) => value?.toDate?.()?.toISOString?.() || (typeof value === 'string' ? value : undefined);

function queueDocId(itemType: 'article' | 'post', itemId: string) {
  return `${itemType}_${encodeURIComponent(itemId).slice(0, 300)}`;
}

export async function toggleReadingQueue(itemId: string, itemType: 'article' | 'post', title: string, queued: boolean) {
  const uid = auth.currentUser?.uid;
  if (!uid || !itemId) return !queued;
  const ref = doc(db, 'users', uid, 'readingQueue', queueDocId(itemType, itemId));
  if (queued) {
    await deleteDoc(ref);
    return false;
  }
  await setDoc(ref, { itemId, itemType, title: String(title || '').slice(0, 300), createdAt: serverTimestamp() });
  return true;
}

export async function getReadingQueue(): Promise<ReadingQueueItem[]> {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];
  const snap = await getDocs(query(collection(db, 'users', uid, 'readingQueue'), orderBy('createdAt', 'desc'), limit(100)));
  return snap.docs.map((d) => ({ id: d.id, itemId: d.data().itemId, itemType: d.data().itemType, title: d.data().title || 'Untitled', createdAt: iso(d.data().createdAt) } as ReadingQueueItem));
}

export function subscribeReadingQueue(callback: (items: ReadingQueueItem[]) => void): () => void {
  const uid = auth.currentUser?.uid;
  if (!uid) { callback([]); return () => {}; }
  return onSnapshot(
    query(collection(db, 'users', uid, 'readingQueue'), orderBy('createdAt', 'desc'), limit(100)),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, itemId: d.data().itemId, itemType: d.data().itemType, title: d.data().title || 'Untitled', createdAt: iso(d.data().createdAt) } as ReadingQueueItem))),
    () => callback([]),
  );
}

export async function removeReadingQueueItem(itemType: 'article' | 'post', itemId: string) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  await deleteDoc(doc(db, 'users', uid, 'readingQueue', queueDocId(itemType, itemId)));
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const uid = auth.currentUser?.uid;
  if (!uid) return DEFAULT_NOTIFICATION_PREFERENCES;
  try {
    const snap = await import('firebase/firestore').then(({ getDoc }) => getDoc(doc(db, 'users', uid, 'preferences', 'notifications')));
    return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(snap.exists() ? snap.data() : {}) } as NotificationPreferences;
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

export async function saveNotificationPreferences(prefs: Partial<NotificationPreferences>) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sign in required');
  await setDoc(doc(db, 'users', uid, 'preferences', 'notifications'), { ...DEFAULT_NOTIFICATION_PREFERENCES, ...prefs, updatedAt: serverTimestamp() }, { merge: true });
}

export function subscribeNotificationPreferences(callback: (prefs: NotificationPreferences) => void): () => void {
  const uid = auth.currentUser?.uid;
  if (!uid) { callback(DEFAULT_NOTIFICATION_PREFERENCES); return () => {}; }
  return onSnapshot(doc(db, 'users', uid, 'preferences', 'notifications'), (snap) => {
    callback({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...(snap.exists() ? snap.data() : {}) } as NotificationPreferences);
  }, () => callback(DEFAULT_NOTIFICATION_PREFERENCES));
}

export async function saveDraftSnapshot(draftId: string, data: Record<string, unknown>) {
  const uid = auth.currentUser?.uid;
  if (!uid || !draftId) throw new Error('Sign in required');
  await setDoc(doc(db, 'users', uid, 'drafts', draftId), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

export async function getDraftSnapshot<T extends Record<string, unknown> = Record<string, unknown>>(draftId: string): Promise<T | null> {
  const uid = auth.currentUser?.uid;
  if (!uid || !draftId) return null;
  const snap = await getDoc(doc(db, 'users', uid, 'drafts', draftId));
  return snap.exists() ? snap.data() as T : null;
}

export async function deleteDraftSnapshot(draftId: string) {
  const uid = auth.currentUser?.uid;
  if (!uid || !draftId) return;
  await deleteDoc(doc(db, 'users', uid, 'drafts', draftId));
}


export type DraftSummary = { id: string; title: string; type?: string; updatedAt?: string; wordCount?: number; payload?: Record<string, unknown> };

export async function getAccountDrafts(): Promise<DraftSummary[]> {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];
  try {
    const snap = await getDocs(query(collection(db, 'users', uid, 'drafts'), orderBy('updatedAt', 'desc'), limit(50)));
    return snap.docs.map(d => { const x = d.data() as any; const blocks = Array.isArray(x.contentBlocks) ? x.contentBlocks : []; const text = blocks.map((b:any)=>String(b.content||'')).join(' '); return { id:d.id, title:String(x.title||x.name||'Untitled Draft'), type:String(x.type || (d.id==='community' ? 'community' : 'article')), updatedAt:iso(x.updatedAt), wordCount:text.trim()?text.trim().split(/\s+/).length:0, payload:x }; });
  } catch { return []; }
}

export async function deleteAccountDraft(draftId: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid || !draftId) return;
  await deleteDoc(doc(db, 'users', uid, 'drafts', draftId));
}

export type AccountActivity = {
  id: string;
  kind: 'read' | 'saved' | 'notification';
  title: string;
  subtitle: string;
  at?: string;
  targetSlug?: string;
  targetType?: string;
};

export async function getUnifiedAccountActivity(): Promise<AccountActivity[]> {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];
  const [historySnap, saveSnap, notificationSnap, draftsSnap, articleSnap, seriesFollowSnap] = await Promise.all([
    getDocs(query(collection(db, 'users', uid, 'history'), orderBy('viewedAt', 'desc'), limit(40))).catch(() => ({ docs: [] } as any)),
    getDocs(query(collection(db, 'users', uid, 'saves'), orderBy('createdAt', 'desc'), limit(40))).catch(() => ({ docs: [] } as any)),
    getDocs(query(collection(db, 'users', uid, 'notifications'), orderBy('createdAt', 'desc'), limit(40))).catch(() => ({ docs: [] } as any)),
    getDocs(query(collection(db, 'users', uid, 'drafts'), orderBy('updatedAt', 'desc'), limit(20))).catch(() => ({ docs: [] } as any)),
    getDocs(query(collection(db, 'articles'), limit(250))).catch(() => ({ docs: [] } as any)),
    getDocs(query(collectionGroup(db, 'followers'), where('userId', '==', uid), limit(50))).catch(() => ({ docs: [] } as any)),
  ]);
  const activities: AccountActivity[] = [];
  historySnap.docs.forEach((d: any) => { const x = d.data(); activities.push({ id:`read:${d.id}`, kind:'read', title:x.title||'Article', subtitle:x.progress >= 100 ? 'Completed article' : `Read ${Math.round(Number(x.progress||0))}%`, at:iso(x.viewedAt), targetSlug:x.slug, targetType:'article' }); });
  saveSnap.docs.forEach((d: any) => { const x=d.data(); activities.push({ id:`save:${d.id}`, kind:'saved', title:x.title||'Saved item', subtitle:`Saved ${x.itemType||'item'}`, at:iso(x.createdAt), targetSlug:x.itemId, targetType:x.itemType }); });
  notificationSnap.docs.forEach((d: any) => { const x=d.data(); activities.push({ id:`notification:${d.id}`, kind:'notification', title:x.message||'Notification', subtitle:x.actorUsername ? `From @${x.actorUsername}` : 'Notification', at:iso(x.createdAt), targetSlug:x.targetId, targetType:x.targetType }); });
  draftsSnap.docs.forEach((d: any) => { const x=d.data(); activities.push({ id:`draft:${d.id}`, kind:'notification', title:x.title||'Untitled draft', subtitle:'Draft autosaved to cloud', at:iso(x.updatedAt), targetType:'draft' }); });
  seriesFollowSnap.docs.forEach((d:any) => { const x=d.data(); const seriesId=d.ref.parent.parent?.id || x.seriesId || ''; activities.push({ id:`series-follow:${d.id}`, kind:'notification', title:String(x.seriesName || seriesId || 'Series'), subtitle:'Following series', at:iso(x.createdAt), targetSlug:seriesId, targetType:'series' }); });
  articleSnap.docs.forEach((d:any) => { const x=d.data(); const au=x.author||{}; if (au.uid!==uid) return; if (x.isPublished===false || x.mainPublicationStatus==='unpublished') return; activities.push({ id:`published:${d.id}`, kind:'notification', title:x.title||'Published article', subtitle:'Published article', at:iso(x.publishedAt||x.updatedAt), targetSlug:d.id, targetType:'article' }); });
  return activities.filter(x=>x.at).sort((a,b)=>new Date(b.at||0).getTime()-new Date(a.at||0).getTime()).slice(0,80);
}

export function mergeDashboardData(
  saved: UserSavedItem[],
  history: ArticleHistoryItem[],
  notifications: Notification[],
): AccountActivity[] {
  const rows: AccountActivity[] = [
    ...history.map((x) => ({ id: `read:${x.slug}`, kind: 'read' as const, title: x.title, subtitle: `Read ${Math.round(Number(x.progress || 0))}%`, at: x.viewedAt, targetSlug: x.slug, targetType: 'article' })),
    ...saved.map((x) => ({ id: `save:${x.id}`, kind: 'saved' as const, title: x.title || 'Saved item', subtitle: `Saved ${x.itemType}`, at: x.createdAt, targetSlug: x.itemId, targetType: x.itemType })),
    ...notifications.map((x) => ({ id: `notification:${x.id}`, kind: 'notification' as const, title: x.message, subtitle: x.actorUsername ? `From @${x.actorUsername}` : 'Notification', at: x.createdAt, targetSlug: x.targetId, targetType: x.targetType })),
  ];
  return rows.sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime()).slice(0, 60);
}


export type ThemePreference = 'light' | 'dark';
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'light';

export async function getThemePreference(): Promise<ThemePreference> {
  const uid = auth.currentUser?.uid;
  if (!uid) return DEFAULT_THEME_PREFERENCE;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'preferences', 'ui'));
    return snap.exists() && snap.data()?.theme === 'dark' ? 'dark' : 'light';
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

export async function saveThemePreference(theme: ThemePreference): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sign in required');
  await setDoc(doc(db, 'users', uid, 'preferences', 'ui'), { theme, updatedAt: serverTimestamp() }, { merge: true });
}

export function subscribeThemePreference(callback: (theme: ThemePreference) => void): () => void {
  const uid = auth.currentUser?.uid;
  if (!uid) { callback(DEFAULT_THEME_PREFERENCE); return () => {}; }
  return onSnapshot(doc(db, 'users', uid, 'preferences', 'ui'), (snap) => {
    callback(snap.exists() && snap.data()?.theme === 'dark' ? 'dark' : 'light');
  }, () => callback(DEFAULT_THEME_PREFERENCE));
}

export async function saveDraftVersion(draftId: string, data: Record<string, unknown>) {
  const uid = auth.currentUser?.uid;
  if (!uid || !draftId) throw new Error('Sign in required');
  const ref = doc(collection(db, 'users', uid, 'drafts', draftId, 'versions'));
  await setDoc(ref, { ...data, savedAt: serverTimestamp(), createdBy: uid }, { merge: true });
  return ref.id;
}

export async function getDraftVersions<T extends Record<string, unknown> = Record<string, unknown>>(draftId: string): Promise<Array<T & { id: string }>> {
  const uid = auth.currentUser?.uid;
  if (!uid || !draftId) return [];
  try {
    const snap = await getDocs(query(collection(db, 'users', uid, 'drafts', draftId, 'versions'), orderBy('savedAt', 'desc'), limit(30)));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as T) }));
  } catch { return []; }
}

export async function deleteDraftVersion(draftId: string, versionId: string) {
  const uid = auth.currentUser?.uid;
  if (!uid || !draftId || !versionId) return;
  await deleteDoc(doc(db, 'users', uid, 'drafts', draftId, 'versions', versionId));
}
