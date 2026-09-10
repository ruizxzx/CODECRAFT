import { auth, db } from './firebase';
import { CommunityPost, CommunityUser } from '../types';
import { addComment, createPost, getComments, getPost, getCommunityProfile, toggleCommentReaction, updateComment, followPost, unfollowPost, isFollowingPost, markPostDiscussionRead, getPostDiscussionReadState } from './community';
import { collection, getDocs, limit, query, where, documentId } from 'firebase/firestore';

export type DiscussionSort = 'top' | 'newest' | 'oldest' | 'discussed' | 'author' | 'helpful' | 'unread';
export interface DiscussionThreadPart extends CommunityPost {
  threadId?: string;
  threadIndex?: number;
  threadTotal?: number;
  parentPostId?: string;
}
export interface DiscussionSourceSnapshot {
  sourceType: 'article' | 'post' | 'question' | 'answer' | 'discussion' | 'community' | 'series' | 'profile';
  sourceId: string;
  sourceTitle?: string;
  sourceUrl?: string;
  sourceAuthorId?: string;
  sourceAuthorUsername?: string;
  sourceAuthorName?: string;
  selectedText?: string;
  section?: string;
}

const clean = (v: unknown, max = 10000) => String(v ?? '').trim().slice(0, max);
const unique = <T,>(xs: T[]) => Array.from(new Set(xs));

export async function createDiscussion(input: {
  user: CommunityUser;
  title: string;
  content: string;
  topics?: string[];
  mediaUrls?: string[];
  source?: DiscussionSourceSnapshot;
  communityId?: string;
  visibility?: 'public' | 'followers' | 'community' | 'restricted';
  poll?: { question: string; options: string[] };
}): Promise<CommunityPost> {
  if (!auth.currentUser || auth.currentUser.uid !== input.user.uid) throw new Error('Authentication required.');
  const title = clean(input.title, 256);
  const content = clean(input.content, 100000);
  if (!title || !content) throw new Error('Discussion title and content are required.');
  const tags = unique((input.topics || []).map(x => clean(x, 40).replace(/^#/, '').toLowerCase()).filter(Boolean)).slice(0, 20);
  const payload: any = {
    type: 'discussion', title, content, authorId: input.user.uid,
    authorUsername: input.user.username, authorName: input.user.displayName,
    authorAvatar: input.user.photoURL || '', isVerified: !!input.user.isVerified,
    verificationColor: input.user.verificationColor || '#2196F3',
    platformRole: input.user.platformRole || 'member', origin: input.communityId ? 'community_post' : 'community_post',
    tags, hashtags: tags, mentionedUsernames: [], mediaUrls: (input.mediaUrls || []).filter(Boolean).slice(0, 6),
    visibility: input.visibility || 'public', discussionType: 'discussion',
    source: input.source ? { ...input.source, sourceUrl: input.source.sourceUrl || '' } : null,
    communityId: input.communityId || '',
    discussionStatus: 'active', allowQuotes: true, allowRemixes: true, allowReplies: 'everyone',
  };
  if (input.poll) payload.poll = { question: clean(input.poll.question || title, 256), options: unique(input.poll.options.map(x => clean(x, 160)).filter(Boolean)).slice(0, 8), votes: {} };
  if (input.communityId) {
    const { createCommunityPost } = await import('./social');
    const p = await createCommunityPost(input.communityId, input.user, title, content, {
      postType: 'discussion',
      mediaUrls: payload.mediaUrls,
      poll: input.poll,
      excerpt: content.slice(0, 240),
      tags,
      flair: '',
      linkUrl: '',
      visibility: input.visibility || 'community',
      discussionStatus: 'active',
      discussionType: 'discussion',
      source: input.source || undefined,
      allowQuotes: true,
      allowRemixes: true,
      allowReplies: 'everyone',
    });
    return { ...(p as any), ...(input.source ? { source: input.source } : {}), discussionStatus: 'active', visibility: input.visibility || 'community' } as any;
  }
  return await createPost(payload as any) as CommunityPost;
}

export async function createQuoteDiscussion(input: {
  user: CommunityUser;
  quoteText: string;
  original: CommunityPost;
  source?: DiscussionSourceSnapshot;
  commentary?: string;
  remix?: boolean;
}): Promise<CommunityPost> {
  const quoteText = clean(input.quoteText, 4000);
  if (!quoteText) throw new Error('Quote text is required.');
  const originalText = clean(input.original.content, 100000);
  const commentary = clean(input.commentary, 5000);
  const title = `${input.remix ? 'Remix' : 'Re'}: ${clean(input.original.title, 180)}`;
  const content = commentary || 'Quoted content';
  const source: DiscussionSourceSnapshot = input.source || {
    sourceType: 'post', sourceId: input.original.id, sourceTitle: input.original.title,
    sourceAuthorId: input.original.authorId, sourceAuthorUsername: input.original.authorUsername,
    sourceAuthorName: input.original.authorName,
  };
  return await createPost({
    type: 'discussion', title, content, authorId: input.user.uid, authorUsername: input.user.username,
    authorName: input.user.displayName, authorAvatar: input.user.photoURL || '',
    isVerified: !!input.user.isVerified, verificationColor: input.user.verificationColor || '#2196F3',
    platformRole: input.user.platformRole || 'member', origin: 'community_post',
    quoteText, quotedPostId: input.original.id,
    quoteSourceSnapshot: source, quoteSourceContent: originalText.slice(0, 5000),
    ...(input.remix ? { remixOfPostId: input.original.id, remixSourceSnapshot: source, isRemix: true } : {}),
    allowQuotes: true, allowRemixes: true, discussionStatus: 'active', visibility: 'public',
  } as any) as CommunityPost;
}

export async function createRemixDiscussion(input: { user: CommunityUser; original: CommunityPost; commentary?: string }): Promise<CommunityPost> {
  return createQuoteDiscussion({ user: input.user, original: input.original, quoteText: clean(input.original.content, 2000), commentary: input.commentary, remix: true });
}

export async function createArticleDiscussion(input: { user: CommunityUser; article: { slug: string; title: string; author?: any; publishedAt?: string }; title?: string; content: string; selectedText?: string; section?: string }): Promise<CommunityPost> {
  return createDiscussion({
    user: input.user,
    title: input.title || `Discussion: ${input.article.title}`,
    content: input.content,
    source: {
      sourceType: 'article', sourceId: input.article.slug, sourceTitle: input.article.title,
      sourceUrl: `${window.location.origin}/article/${encodeURIComponent(input.article.slug)}`,
      sourceAuthorId: input.article.author?.uid, sourceAuthorUsername: input.article.author?.username,
      sourceAuthorName: input.article.author?.name, selectedText: input.selectedText, section: input.section,
    },
  });
}

export async function createThread(input: { user: CommunityUser; parts: Array<{ title?: string; content: string; mediaUrls?: string[] }>; topic?: string; coverImage?: string }): Promise<DiscussionThreadPart[]> {
  if (!input.parts.length) throw new Error('Add at least one thread part.');
  if (input.parts.length > 50) throw new Error('A thread can contain at most 50 parts.');
  const threadId = `thr_${crypto.randomUUID()}`;
  const total = input.parts.length;
  const created: DiscussionThreadPart[] = [];
  let parentPostId = '';
  for (let index = 0; index < input.parts.length; index += 1) {
    const part = input.parts[index];
    const p = await createPost({
      type: 'discussion',
      title: clean(part.title || (index === 0 ? `${input.topic || 'Thread'}` : `Thread ${index + 1}/${total}`), 256),
      content: clean(part.content, 100000),
      authorId: input.user.uid, authorUsername: input.user.username, authorName: input.user.displayName,
      authorAvatar: input.user.photoURL || '', isVerified: !!input.user.isVerified,
      verificationColor: input.user.verificationColor || '#2196F3', platformRole: input.user.platformRole || 'member',
      origin: 'community_post', threadId, threadIndex: index + 1, threadTotal: total,
      parentPostId: parentPostId || '', threadTopic: clean(input.topic, 120), threadCoverImage: clean(input.coverImage, 2048),
      discussionStatus: 'active', visibility: 'public', allowQuotes: true, allowRemixes: true,
    } as any) as DiscussionThreadPart;
    created.push(p);
    parentPostId = p.id;
  }
  return created;
}

export async function getThread(threadId: string, communityId?: string): Promise<DiscussionThreadPart[]> {
  if (!threadId) return [];
  const reads = [getDocs(query(collection(db, 'posts'), where('threadId', '==', threadId), limit(60)))];
  if (communityId) reads.push(getDocs(query(collection(db, 'communities', communityId, 'posts'), where('threadId', '==', threadId), limit(60))));
  const snapshots = await Promise.all(reads);
  const merged = new Map<string, DiscussionThreadPart>();
  snapshots.flatMap(snap => snap.docs).forEach(d => merged.set(d.id, ({
    ...d.data(), id: d.id,
    createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() || d.data().createdAt || new Date().toISOString(),
    updatedAt: d.data().updatedAt?.toDate?.()?.toISOString?.() || d.data().updatedAt || new Date().toISOString(),
  } as DiscussionThreadPart)));
  return Array.from(merged.values()).sort((a,b) => Number(a.threadIndex || 0) - Number(b.threadIndex || 0));
}

export async function getDiscussionReplies(postId: string) { return getComments(postId); }
export async function replyToDiscussion(postId: string, user: CommunityUser, content: string, parentId?: string, meta?: { quotedText?: string; quoteSource?: any; mediaUrls?: string[]; mentionedUsernames?: string[] }) {
  const post = await getPost(postId); if (!post) throw new Error('Discussion no longer exists.');
  if ((post as any).discussionStatus === 'locked' || (post as any).isLocked) throw new Error('This discussion is locked.');
  return addComment(postId, post.commentsCount, {
    authorId: user.uid, authorUsername: user.username, authorName: user.displayName,
    authorAvatar: user.photoURL || '', content: clean(content, 5000), parentId: parentId || '',
    ...(meta || {}) as any,
  } as any);
}

export const updateDiscussionReply = updateComment;
export const toggleDiscussionReplyReaction = toggleCommentReaction;
export const followDiscussion = followPost;
export const unfollowDiscussion = unfollowPost;
export const isFollowingDiscussion = isFollowingPost;
export const saveDiscussionReadState = markPostDiscussionRead;
export const getDiscussionReadState = getPostDiscussionReadState;

export async function sortDiscussionReplies(replies: any[], sort: DiscussionSort, authorId?: string, unreadIds: Set<string> = new Set()) {
  const arr = [...replies];
  const childCount = new Map<string, number>();
  arr.forEach(r => { if (r.parentId) childCount.set(r.parentId, (childCount.get(r.parentId) || 0) + 1); });
  const helpful = (r: any) => Number(r.likeCount || 0) * 2 + Number(childCount.get(r.id) || 0) + (r.isAuthorResponse ? 3 : 0);
  if (sort === 'newest') return arr.sort((a,b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  if (sort === 'oldest') return arr.sort((a,b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
  if (sort === 'discussed') return arr.sort((a,b) => (childCount.get(b.id) || 0) - (childCount.get(a.id) || 0) || helpful(b)-helpful(a));
  if (sort === 'author') return arr.sort((a,b) => Number(b.isAuthorResponse || b.authorId === authorId) - Number(a.isAuthorResponse || a.authorId === authorId) || new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  if (sort === 'helpful') return arr.sort((a,b) => helpful(b)-helpful(a) || new Date(a.createdAt || 0).getTime()-new Date(b.createdAt || 0).getTime());
  if (sort === 'unread') return arr.sort((a,b) => Number(unreadIds.has(b.id))-Number(unreadIds.has(a.id)) || new Date(b.createdAt || 0).getTime()-new Date(a.createdAt || 0).getTime());
  return arr.sort((a,b) => helpful(b)-helpful(a) || Number(b.likeCount||0)-Number(a.likeCount||0) || new Date(b.createdAt||0).getTime()-new Date(a.createdAt||0).getTime());
}

export async function searchDiscussions(text: string): Promise<CommunityPost[]> {
  const term = clean(text, 120).toLowerCase();
  if (term.length < 2) return [];
  const snap = await getDocs(query(collection(db, 'posts'), where('type', '==', 'discussion'), limit(500)));
  return snap.docs.map(d => ({ ...d.data(), id: d.id, createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() || d.data().createdAt || new Date().toISOString(), updatedAt: d.data().updatedAt?.toDate?.()?.toISOString?.() || d.data().updatedAt || new Date().toISOString() } as CommunityPost))
    .filter(p => `${p.title} ${p.content} ${(p.tags || []).join(' ')} ${(p.hashtags || []).join(' ')}`.toLowerCase().includes(term))
    .sort((a,b) => new Date(b.createdAt||0).getTime()-new Date(a.createdAt||0).getTime()).slice(0, 30);
}

export async function getRelatedDiscussions(post: CommunityPost, max = 6): Promise<CommunityPost[]> {
  const candidates = await searchDiscussions(`${(post.tags || [])[0] || (post.hashtags || [])[0] || post.title.split(/\s+/).slice(0,2).join(' ')}`);
  const baseTopics = unique([...(post.tags || []), ...(post.hashtags || [])].map(x => String(x).toLowerCase().replace(/^#/,'')).filter(Boolean));
  return candidates.filter(p => p.id !== post.id).map(p => {
    const topics = unique([...(p.tags || []), ...(p.hashtags || [])].map(x=>String(x).toLowerCase().replace(/^#/,'')).filter(Boolean));
    const overlap = topics.filter(t => baseTopics.includes(t)).length;
    const sourceBoost = (post.sourcePostId && (p as any).source?.sourceId === post.sourcePostId) ? 5 : 0;
    return { p, score: overlap * 4 + sourceBoost + (p.authorId === post.authorId ? 1 : 0) };
  }).sort((a,b)=>b.score-a.score || new Date(b.p.createdAt||0).getTime()-new Date(a.p.createdAt||0).getTime()).slice(0,max).map(x=>x.p);
}

export async function getDiscussionParticipants(replies: any[], post: CommunityPost) {
  const byId = new Map<string, any>();
  byId.set(post.authorId, { uid: post.authorId, username: post.authorUsername, name: post.authorName, avatar: post.authorAvatar, role: 'author' });
  replies.forEach(r => byId.set(r.authorId, { uid: r.authorId, username: r.authorUsername, name: r.authorName, avatar: r.authorAvatar, role: r.isAuthorResponse ? 'author' : r.platformRole || 'member' }));
  return Array.from(byId.values());
}
