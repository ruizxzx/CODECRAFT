import { collection, doc, getDocs, getCountFromServer, getDoc, setDoc, deleteDoc, serverTimestamp, query, onSnapshot, limit, orderBy } from 'firebase/firestore';
import { auth, db } from './firebase';
import { Article, ArticleContentBlock } from '../types';
import { emitActivityEvent, activitySessionId } from './activity';

export interface ArticleReadingProgress {
  slug: string;
  percent: number;
  completed: boolean;
  updatedAt?: string;
  lastSection?: string;
  scrollY?: number;
  viewportHeight?: number;
  device?: string;
  source?: string;
  seriesId?: string;
  seriesOrder?: number;
}

export interface ArticleHistoryItem {
  slug: string;
  title: string;
  excerpt?: string;
  coverImage?: string;
  category?: string;
  authorName?: string;
  authorUsername?: string;
  authorAvatar?: string;
  viewedAt?: string;
  progress?: number;
  lastSection?: string;
  scrollY?: number;
  device?: string;
  source?: string;
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

export async function saveArticleReadingProgress(
  slug: string,
  percent: number,
  lastSection = '',
  completed = percent >= 90,
  details: { scrollY?: number; viewportHeight?: number; device?: string; source?: string; seriesId?: string; seriesOrder?: number } = {}
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid || !slug) return;
  const ref = doc(db, 'users', uid, 'readingProgress', slug);
  const existing = await getDoc(ref);
  if (existing.exists() && existing.data()?.completed === true && !completed) return;
  const safePercent = completed ? 100 : Math.max(0, Math.min(100, Math.round(percent)));
  await setDoc(ref, {
    slug, percent: safePercent, completed: !!completed,
    lastSection: String(lastSection || '').slice(0, 200),
    scrollY: Math.max(0, Math.min(100000000, Number(details.scrollY || 0))),
    viewportHeight: Math.max(1, Math.min(20000, Number(details.viewportHeight || 0))),
    device: String(details.device || '').slice(0, 120),
    source: String(details.source || 'article').slice(0, 80),
    seriesId: String(details.seriesId || '').slice(0, 200),
    seriesOrder: Number(details.seriesOrder || 0),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  void emitActivityEvent({ type: completed ? 'content_complete' : safePercent > 0 ? 'content_progress' : 'content_start', targetId: slug, targetType: 'article', sessionId: activitySessionId(`article:${slug}`), source: String(details.source || 'article'), metadata: { percent: safePercent, lastSection: String(lastSection || '').slice(0, 120), seriesId: details.seriesId || '' } }).catch(() => {});
}

export async function resetArticleReadingProgress(slug: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid || !slug) return;
  await deleteDoc(doc(db, 'users', uid, 'readingProgress', slug));
}

function historyDocId(slug: string): string {
  return encodeURIComponent(slug).slice(0, 1500);
}

export async function recordArticleHistory(
  article: Pick<Article, 'slug'|'title'|'excerpt'|'coverImage'|'category'|'author'>,
  progress = 0,
  details: { lastSection?: string; scrollY?: number; device?: string; source?: string; seriesId?: string; seriesOrder?: number } = {}
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid || !article.slug) return;
  const author = article.author || ({} as Article['author']);
  await setDoc(doc(db, 'users', uid, 'history', historyDocId(article.slug)), {
    slug: article.slug, title: article.title, excerpt: String(article.excerpt || '').slice(0, 320),
    coverImage: article.coverImage || '', category: article.category || '', authorName: author.name || '',
    authorUsername: author.username || '', authorAvatar: author.avatar || '',
    progress: Math.max(0, Math.min(100, Math.round(progress))),
    lastSection: String(details.lastSection || '').slice(0, 200),
    scrollY: Math.max(0, Math.min(100000000, Number(details.scrollY || 0))),
    device: String(details.device || '').slice(0, 120), source: String(details.source || 'article').slice(0, 80),
    seriesId: String(details.seriesId || '').slice(0, 200), seriesOrder: Number(details.seriesOrder || 0),
    viewedAt: serverTimestamp(),
  }, { merge: true });
  void emitActivityEvent({ type: 'content_open', targetId: article.slug, targetType: 'article', sessionId: activitySessionId(`article:${article.slug}`), source: String(details.source || 'article'), metadata: { progress: Math.max(0, Math.min(100, Math.round(progress))) } }).catch(() => {});
}

export function subscribeArticleHistory(callback: (items: ArticleHistoryItem[]) => void, maxItems = 50): () => void {
  const uid = auth.currentUser?.uid;
  if (!uid) { callback([]); return () => {}; }
  const q = query(collection(db, 'users', uid, 'history'), orderBy('viewedAt', 'desc'), limit(Math.max(1, Math.min(maxItems, 100))));
  return onSnapshot(q, snap => callback(snap.docs.map(d => {
    const data = d.data() as any;
    return {
      slug: data.slug || decodeURIComponent(d.id),
      title: data.title || 'Untitled article',
      excerpt: data.excerpt || '',
      coverImage: data.coverImage || '',
      category: data.category || '',
      authorName: data.authorName || '',
      authorUsername: data.authorUsername || '',
      authorAvatar: data.authorAvatar || '',
      progress: Math.max(0, Math.min(100, Number(data.progress || 0))),
      lastSection: data.lastSection || '', scrollY: Number(data.scrollY || 0), device: data.device || '', source: data.source || '', seriesId: data.seriesId || '', seriesOrder: Number(data.seriesOrder || 0),
      viewedAt: data.viewedAt?.toDate?.()?.toISOString?.(),
    };
  })), () => callback([]));
}

export async function getArticleHistory(maxItems = 50): Promise<ArticleHistoryItem[]> {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];
  const snap = await getDocs(query(collection(db, 'users', uid, 'history'), orderBy('viewedAt', 'desc'), limit(Math.max(1, Math.min(maxItems, 100)))));
  return snap.docs.map(d => {
    const data = d.data() as any;
    return {
      slug: data.slug || decodeURIComponent(d.id),
      title: data.title || 'Untitled article',
      excerpt: data.excerpt || '',
      coverImage: data.coverImage || '',
      category: data.category || '',
      authorName: data.authorName || '',
      authorUsername: data.authorUsername || '',
      authorAvatar: data.authorAvatar || '',
      progress: Math.max(0, Math.min(100, Number(data.progress || 0))),
      lastSection: data.lastSection || '', scrollY: Number(data.scrollY || 0), device: data.device || '', source: data.source || '', seriesId: data.seriesId || '', seriesOrder: Number(data.seriesOrder || 0),
      viewedAt: data.viewedAt?.toDate?.()?.toISOString?.(),
    };
  });
}

export async function deleteArticleHistoryItem(slug: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid || !slug) return;
  await deleteDoc(doc(db, 'users', uid, 'history', historyDocId(slug)));
}

export async function clearArticleHistory(): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const snap = await getDocs(collection(db, 'users', uid, 'history'));
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
}

export async function getArticleReadingProgress(slug: string): Promise<ArticleReadingProgress | null> {
  const uid = auth.currentUser?.uid;
  if (!uid || !slug) return null;
  const snap = await getDoc(doc(db, 'users', uid, 'readingProgress', slug));
  if (!snap.exists()) return null;
  const data = snap.data() as any;
  return { slug, percent: Number(data.percent || 0), completed: !!data.completed, updatedAt: data.updatedAt?.toDate?.()?.toISOString?.(), lastSection: data.lastSection || '', scrollY: Number(data.scrollY || 0), viewportHeight: Number(data.viewportHeight || 0), device: data.device || '', source: data.source || '', seriesId: data.seriesId || '', seriesOrder: Number(data.seriesOrder || 0) };
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
        scrollY: Number(data.scrollY || 0), viewportHeight: Number(data.viewportHeight || 0), device: data.device || '', source: data.source || '', seriesId: data.seriesId || '', seriesOrder: Number(data.seriesOrder || 0),
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
