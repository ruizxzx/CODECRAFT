import { db } from './firebase';
import {
  collection, doc, setDoc, getDocs, query, where, orderBy, deleteDoc, serverTimestamp, limit as fsLimit,
} from 'firebase/firestore';
import type { VaultHighlight, VaultNote } from '../types';

function mapHighlight(id: string, data: any): VaultHighlight {
  return {
    id,
    articleSlug: String(data.articleSlug || ''),
    articleTitle: String(data.articleTitle || ''),
    quote: String(data.quote || ''),
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString()),
  };
}

function mapNote(id: string, data: any): VaultNote {
  return {
    id,
    title: String(data.title || ''),
    body: String(data.body || ''),
    articleSlug: data.articleSlug || undefined,
    articleTitle: data.articleTitle || undefined,
    quote: data.quote || undefined,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString()),
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : (data.updatedAt || data.createdAt || new Date().toISOString()),
  };
}

/** Save a highlighted quote from an article. Requires a signed-in user (uid). */
export async function saveHighlight(uid: string, input: { articleSlug: string; articleTitle: string; quote: string }): Promise<VaultHighlight> {
  const quote = input.quote.trim().slice(0, 2000);
  if (!quote) throw new Error('Select some text to highlight.');
  const ref = doc(collection(db, 'users', uid, 'highlights'));
  const payload = { articleSlug: input.articleSlug, articleTitle: input.articleTitle.slice(0, 200), quote, createdAt: serverTimestamp() };
  await setDoc(ref, payload);
  return mapHighlight(ref.id, { ...payload, createdAt: new Date().toISOString() });
}

/** Highlights for one article (used on the article page), or all of a user's highlights (Vault). */
export async function getHighlights(uid: string, articleSlug?: string): Promise<VaultHighlight[]> {
  if (!uid) return [];
  try {
    const base = collection(db, 'users', uid, 'highlights');
    const q = articleSlug ? query(base, where('articleSlug', '==', articleSlug), fsLimit(200)) : query(base, orderBy('createdAt', 'desc'), fsLimit(200));
    const snap = await getDocs(q);
    return snap.docs.map(d => mapHighlight(d.id, d.data()));
  } catch (error) {
    console.warn('Could not fetch highlights:', error);
    return [];
  }
}

export async function deleteHighlight(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'highlights', id));
}

/** Save a note, optionally linked to the article/quote the person was reading when they wrote it. */
export async function saveVaultNote(uid: string, input: { title?: string; body: string; articleSlug?: string; articleTitle?: string; quote?: string }): Promise<VaultNote> {
  const body = input.body.trim().slice(0, 5000);
  if (!body) throw new Error('Write something to save.');
  const ref = doc(collection(db, 'users', uid, 'vaultNotes'));
  const payload = {
    title: (input.title || '').trim().slice(0, 120) || 'Untitled note',
    body,
    articleSlug: input.articleSlug || null,
    articleTitle: (input.articleTitle || '').slice(0, 200) || null,
    quote: (input.quote || '').slice(0, 2000) || null,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload);
  const now = new Date().toISOString();
  return mapNote(ref.id, { ...payload, createdAt: now, updatedAt: now });
}

export async function getVaultNotes(uid: string): Promise<VaultNote[]> {
  if (!uid) return [];
  try {
    const snap = await getDocs(query(collection(db, 'users', uid, 'vaultNotes'), orderBy('createdAt', 'desc'), fsLimit(200)));
    return snap.docs.map(d => mapNote(d.id, d.data()));
  } catch (error) {
    console.warn('Could not fetch vault notes:', error);
    return [];
  }
}

export async function deleteVaultNote(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'vaultNotes', id));
}
