import { collection, doc, getDocs, getCountFromServer, getDoc, setDoc, serverTimestamp, query, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import { Article, ArticleContentBlock } from '../types';

export interface ArticleReadingProgress {
  slug: string;
  percent: number;
  completed: boolean;
  updatedAt?: string;
  lastSection?: string;
}

export interface ArticleEngagementStats {
  likes: number;
  applauds: number;
  comments: number;
  reactions: Record<string, number>;
}

function plainTextFromBlock(block: ArticleContentBlock): string {
  const values = [block.content, block.linkText, block.buttonText, block.imageCaption, block.videoCaption, block.calloutTitle, block.quoteAuthor];
  let text = values.filter(Boolean).join(' ');
  if (block.items?.length) text += ` ${block.items.join(' ')}`;
  if (block.codeBlock?.code) text += ` ${block.codeBlock.code}`;
  return text.replace(/https?:\/\/\S+/g, ' ').replace(/[^\S\r\n]+/g, ' ').trim();
}

/** Conservative reading-time estimate: 200 WPM, with code weighted lower. */
export function calculateArticleReadingTime(articleOrBlocks: Article | ArticleContentBlock[]): number {
  const blocks = Array.isArray(articleOrBlocks) ? articleOrBlocks : articleOrBlocks.content || [];
  const words = blocks.reduce((total, block) => total + plainTextFromBlock(block).split(/\s+/).filter(Boolean).length, 0);
  const codeWords = blocks.filter(b => b.type === 'code').reduce((n,b)=>n+(b.codeBlock?.code?.split(/\s+/).filter(Boolean).length || 0),0);
  const effectiveWords = Math.max(1, words - Math.round(codeWords * 0.55));
  return Math.max(1, Math.ceil(effectiveWords / 200));
}

export async function saveArticleReadingProgress(slug: string, percent: number, lastSection = '', completed = percent >= 90): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid || !slug) return;
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  await setDoc(doc(db, 'users', uid, 'readingProgress', slug), {
    slug,
    percent: safePercent,
    completed: !!completed,
    lastSection: String(lastSection || '').slice(0, 200),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function getArticleReadingProgress(slug: string): Promise<ArticleReadingProgress | null> {
  const uid = auth.currentUser?.uid;
  if (!uid || !slug) return null;
  const snap = await getDoc(doc(db, 'users', uid, 'readingProgress', slug));
  if (!snap.exists()) return null;
  const data = snap.data() as any;
  return { slug, percent: Number(data.percent || 0), completed: !!data.completed, updatedAt: data.updatedAt?.toDate?.()?.toISOString?.(), lastSection: data.lastSection || '' };
}

export function subscribeSeriesReadingProgress(
  seriesArticles: Article[],
  callback: (progress: Record<string, ArticleReadingProgress>) => void,
): () => void {
  const uid = auth.currentUser?.uid;
  if (!uid || !seriesArticles.length) { callback({}); return () => {}; }
  const wanted = new Set(seriesArticles.map(a => a.slug));
  return onSnapshot(collection(db, 'users', uid, 'readingProgress'), snap => {
    const result: Record<string, ArticleReadingProgress> = {};
    snap.docs.forEach(d => {
      const data = d.data() as any;
      const slug = data.slug || d.id;
      if (!wanted.has(slug)) return;
      result[slug] = {
        slug,
        percent: Math.max(0, Math.min(100, Number(data.percent || 0))),
        completed: !!data.completed,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString?.(),
        lastSection: data.lastSection || '',
      };
    });
    callback(result);
  }, () => callback({}));
}

export async function getSeriesReadingProgress(seriesArticles: Article[]): Promise<Record<string, ArticleReadingProgress>> {
  const uid = auth.currentUser?.uid;
  if (!uid || !seriesArticles.length) return {};
  const snap = await getDocs(collection(db, 'users', uid, 'readingProgress'));
  const wanted = new Set(seriesArticles.map(a => a.slug));
  const result: Record<string, ArticleReadingProgress> = {};
  snap.docs.forEach(d => {
    const data = d.data() as any;
    const slug = data.slug || d.id;
    if (!wanted.has(slug)) return;
    result[slug] = { slug, percent: Number(data.percent || 0), completed: !!data.completed, updatedAt: data.updatedAt?.toDate?.()?.toISOString?.(), lastSection: data.lastSection || '' };
  });
  return result;
}


export function subscribeArticleEngagementStats(slug: string, callback: (stats: ArticleEngagementStats) => void): () => void {
  if (!slug) { callback({ likes: 0, applauds: 0, comments: 0, reactions: {} }); return () => {}; }
  let likes = 0; let comments = 0; const reactions: Record<string, number> = {};
  const emit = () => callback({ likes, applauds: likes, comments, reactions: { ...reactions } });
  const unsubs = [
    onSnapshot(collection(db, 'articleLikes', slug, 'likes'), snap => { likes = snap.size; emit(); }, () => {}),
    onSnapshot(collection(db, 'articles', slug, 'comments'), snap => { comments = snap.size; emit(); }, () => {}),
    onSnapshot(collection(db, 'articles', slug, 'reactions'), snap => {
      Object.keys(reactions).forEach(k => delete reactions[k]);
      snap.docs.forEach(d => { const r = String(d.data()?.reaction || ''); if (r) reactions[r] = (reactions[r] || 0) + 1; });
      emit();
    }, () => {}),
  ];
  return () => unsubs.forEach(unsub => unsub());
}

export async function getArticleEngagementStats(slug: string): Promise<ArticleEngagementStats> {
  if (!slug) return { likes: 0, applauds: 0, comments: 0, reactions: {} };
  const commentsRef = collection(db, 'articles', slug, 'comments');
  const likesRef = collection(db, 'articleLikes', slug, 'likes');
  const reactionsRef = collection(db, 'articles', slug, 'reactions');
  const [likesCount, commentsCount, reactionsSnap] = await Promise.all([
    getCountFromServer(likesRef),
    getCountFromServer(commentsRef),
    getDocs(query(reactionsRef)),
  ]);
  const reactions: Record<string, number> = {};
  reactionsSnap.docs.forEach(d => {
    const reaction = String(d.data()?.reaction || '');
    if (reaction) reactions[reaction] = (reactions[reaction] || 0) + 1;
  });
  const likes = likesCount.data().count;
  return { likes, applauds: likes, comments: commentsCount.data().count, reactions };
}

export function getSeriesDerivedStats(seriesArticles: Article[]) {
  const minutes = seriesArticles.reduce((sum, article) => sum + calculateArticleReadingTime(article), 0);
  return {
    parts: seriesArticles.length,
    minutes,
    hours: Math.round((minutes / 60) * 10) / 10,
  };
}
