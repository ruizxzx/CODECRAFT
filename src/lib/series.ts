import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db, auth, checkIsAdmin } from './firebase';
import { Article, Series } from '../types';

export async function getSeriesById(id: string): Promise<Series | null> {
  const snap = await getDoc(doc(db, 'series', id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Series) : null;
}

export async function getSeriesList(limitCount = 50): Promise<Series[]> {
  try {
    const snap = await getDocs(query(collection(db, 'series'), orderBy('updatedAt', 'desc'), limit(limitCount)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Series));
  } catch {
    const snap = await getDocs(query(collection(db, 'series'), limit(limitCount)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Series));
  }
}

export async function getSeriesArticlesFromAllArticles(seriesId: string, articles: Article[]): Promise<Article[]> {
  return articles.filter(a => a.seriesId === seriesId).sort((a,b) => (a.seriesOrder || 999) - (b.seriesOrder || 999));
}

export async function createSeries(input: Omit<Series, 'createdAt'|'updatedAt'|'articleCount'>): Promise<Series> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in to create a series.');
  if (input.ownerId !== user.uid && !checkIsAdmin(user.email)) throw new Error('You can only create your own series.');
  const id = input.id || input.slug;
  if (!id) throw new Error('Series ID is required.');
  const payload = {
    ...input,
    id: undefined,
    articleCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(doc(db, 'series', id), Object.fromEntries(Object.entries(payload).filter(([,v])=>v!==undefined)));
  return { ...input, id, articleCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Series;
}

export async function updateSeries(id: string, patch: Partial<Series>): Promise<void> {
  const ref = doc(db, 'series', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Series not found.');
  const existing = snap.data() as Series;
  const user = auth.currentUser;
  if (!user || (existing.ownerId !== user.uid && !checkIsAdmin(user.email))) throw new Error('Series editor access required.');
  const clean: any = { ...patch, updatedAt: serverTimestamp() };
  delete clean.id; delete clean.createdAt; delete clean.articleCount;
  await updateDoc(ref, clean);
}

export async function deleteSeries(id: string): Promise<void> {
  const ref = doc(db, 'series', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const existing = snap.data() as Series;
  const user = auth.currentUser;
  if (!user || (existing.ownerId !== user.uid && !checkIsAdmin(user.email))) throw new Error('Series delete access required.');
  await deleteDoc(ref);
}


/** Atomically update the order/membership fields of series articles. Admin-only because
 * article documents are protected by the article Firestore rules. */
export async function reorderSeriesArticles(seriesId: string, seriesName: string, articles: Article[]): Promise<void> {
  const user = auth.currentUser;
  if (!user || !checkIsAdmin(user.email)) throw new Error('Master admin access required.');
  const batch = writeBatch(db);
  articles.forEach((article, index) => {
    batch.update(doc(db, 'articles', article.slug), {
      seriesId,
      seriesName,
      seriesOrder: index + 1,
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

/** Add/remove one article from a series. Undefined fields are deleted so an article
 * that leaves a series is returned to a clean, legacy-compatible shape. */
export async function setArticleSeriesMembership(articleSlug: string, seriesId?: string, seriesName?: string, seriesOrder?: number): Promise<void> {
  const user = auth.currentUser;
  if (!user || !checkIsAdmin(user.email)) throw new Error('Master admin access required.');

  const articleRef = doc(db, 'articles', articleSlug);
  const articleSnap = await getDoc(articleRef);
  if (!articleSnap.exists()) throw new Error('Article not found.');
  const previousSeriesId = (articleSnap.data() as any).seriesId as string | undefined;

  const batch = writeBatch(db);
  const patch: any = { updatedAt: serverTimestamp() };
  if (seriesId === undefined) {
    patch.seriesId = deleteField();
    patch.seriesName = deleteField();
    patch.seriesOrder = deleteField();
  } else {
    patch.seriesId = seriesId;
    patch.seriesName = seriesName || '';
    patch.seriesOrder = seriesOrder || 1;
  }
  batch.update(articleRef, patch);
  await batch.commit();

  if (previousSeriesId && previousSeriesId !== seriesId) {
    const oldRef = doc(db, 'series', previousSeriesId);
    const oldSnap = await getDoc(oldRef);
    if (oldSnap.exists()) await updateDoc(oldRef, { articleCount: Math.max(0, Number(oldSnap.data().articleCount || 0) - 1), updatedAt: serverTimestamp() });
  }
  if (seriesId && previousSeriesId !== seriesId) {
    const newRef = doc(db, 'series', seriesId);
    const newSnap = await getDoc(newRef);
    if (newSnap.exists()) await updateDoc(newRef, { articleCount: Number(newSnap.data().articleCount || 0) + 1, updatedAt: serverTimestamp() });
  }
}
