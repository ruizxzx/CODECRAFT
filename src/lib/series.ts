import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
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
