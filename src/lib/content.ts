import type { Article, CommunityPost, Series, CommunityUser } from '../types';
import type { SocialQuestion, SocialAnswer, SocialTopic } from './social';
import type { ContentEntity, ContentStatus, ContentType, Visibility } from './intelligence/types';

const str = (v: unknown) => String(v ?? '').trim();
const arr = (v: unknown) => Array.isArray(v) ? v.map(str).filter(Boolean).slice(0, 50) : [];
const date = (v: unknown) => {
  if (!v) return undefined;
  if (typeof (v as any)?.toDate === 'function') return (v as any).toDate().toISOString();
  const d = new Date(String(v));
  return Number.isFinite(d.getTime()) ? d.toISOString() : undefined;
};
const tokenise = (value: string) => Array.from(new Set(value.toLowerCase().split(/[^a-z0-9@#_-]+/).map(x => x.replace(/^[@#]/, '')).filter(x => x.length >= 2))).slice(0, 200);
const visibility = (value: unknown, fallback: Visibility = 'public'): Visibility => ['public','authenticated','followers','community','private','owner'].includes(String(value)) ? value as Visibility : fallback;
const status = (value: unknown, fallback: ContentStatus = 'published'): ContentStatus => ['draft','pending_review','scheduled','published','unlisted','archived','deleted'].includes(String(value)) ? value as ContentStatus : fallback;

export function normalizeContent(input: Partial<ContentEntity> & Record<string, any>): ContentEntity {
  const title = str(input.title);
  const body = str(input.body || input.content || input.details || input.description);
  const excerpt = str(input.excerpt || body.slice(0, 280));
  const normalizedText = [title, excerpt, body, ...(input.tags || []), ...(input.topics || [])].join(' ').toLowerCase();
  return {
    id: str(input.id), type: input.type as ContentType,
    authorId: str(input.authorId) || undefined,
    title, body, excerpt,
    media: Array.isArray(input.media) ? input.media.slice(0, 20) : [],
    tags: arr(input.tags), topics: arr(input.topics || input.category ? [input.category, ...(input.topics || [])] : []),
    seriesId: str(input.seriesId) || undefined, communityId: str(input.communityId) || undefined,
    parentId: str(input.parentId) || undefined, rootId: str(input.rootId) || undefined,
    visibility: visibility(input.visibility), status: status(input.status, input.isPublished === false || input.mainPublicationStatus === 'unpublished' ? 'unlisted' : 'published'),
    createdAt: date(input.createdAt), updatedAt: date(input.updatedAt), publishedAt: date(input.publishedAt || input.createdAt),
    stats: { ...(input.stats || {}), views: Number(input.viewsCount ?? input.stats?.views ?? 0), likes: Number(input.likesCount ?? input.stats?.likes ?? input.upvotesCount ?? 0), comments: Number(input.commentsCount ?? input.stats?.comments ?? 0), answers: Number(input.answersCount ?? input.stats?.answers ?? 0), saves: Number(input.savesCount ?? input.stats?.saves ?? 0), shares: Number(input.sharesCount ?? input.stats?.shares ?? 0), quality: Number(input.qualityScore ?? input.stats?.quality ?? 0) },
    search: { normalizedText, tokens: tokenise(normalizedText) },
    relationships: Array.isArray(input.relationships) ? input.relationships.slice(0, 50) : [],
    sourceCollection: str(input.sourceCollection) || undefined,
    sourcePath: str(input.sourcePath) || undefined,
  };
}

export const articleToContent = (a: Article): ContentEntity => normalizeContent({ id: a.slug || a.id, type: 'article', authorId: a.author?.uid, authorUsername: a.author?.username, title: a.title, content: a.content?.map((b: any) => [b.content,b.calloutTitle,b.codeBlock?.code,b.items?.join(' '),b.imageCaption,b.videoCaption].filter(Boolean).join(' ')).join('\n') || '', excerpt: a.excerpt, tags: a.tags, topics: [a.category], seriesId: a.seriesId, status: a.isPublished === false || a.mainPublicationStatus === 'unpublished' ? 'unlisted' : 'published', publishedAt: a.publishedAt, updatedAt: a.editedAt, stats: { views: a.viewsCount, likes: Object.values(a.reactionCounts || {}).reduce((n, v) => n + Number(v || 0), 0), quality: a.featured ? 1 : 0 }, sourceCollection: 'articles', sourcePath: `articles/${a.slug}` });
export const postToContent = (p: CommunityPost): ContentEntity => normalizeContent({ id: p.id, type: p.type === 'discussion' ? 'discussion' : 'post', authorId: p.authorId, authorUsername: p.authorUsername, title: p.title, content: p.content, excerpt: p.excerpt, tags: p.tags || p.hashtags, topics: [p.category, ...(p.hashtags || [])], seriesId: p.seriesId, communityId: (p as any).communityId, parentId: p.quotedPostId, status: p.isPublished === false || p.mainPublicationStatus === 'unpublished' ? 'unlisted' : 'published', createdAt: p.createdAt, updatedAt: p.updatedAt, stats: { views: p.viewsCount, likes: p.upvotesCount, comments: p.commentsCount, shares: p.repostsCount }, sourceCollection: 'posts', sourcePath: `posts/${p.id}` });
export const questionToContent = (q: SocialQuestion): ContentEntity => normalizeContent({ id: q.id, type: 'question', authorId: q.authorId, authorUsername: q.authorUsername, title: q.title, content: q.details, tags: q.topics, topics: q.topics, communityId: q.relatedCommunityId, status: q.moderationState === 'HIDDEN' ? 'archived' : 'published', createdAt: q.createdAt, updatedAt: q.updatedAt, stats: { comments: q.followersCount, answers: q.answersCount, likes: q.upvotesCount }, sourceCollection: 'questions', sourcePath: `questions/${q.id}` });
export const answerToContent = (a: SocialAnswer): ContentEntity => normalizeContent({ id: a.id, type: 'answer', authorId: a.authorId, title: '', content: a.content, parentId: a.questionId, tags: [], topics: [], status: 'published', createdAt: a.createdAt, updatedAt: a.updatedAt, stats: { comments: a.repliesCount, likes: a.upvotesCount - a.downvotesCount }, sourceCollection: 'answers', sourcePath: `questions/${a.questionId}/answers/${a.id}` });
export const seriesToContent = (s: Series): ContentEntity => normalizeContent({ id: s.id, type: 'series', authorId: s.ownerId, authorUsername: s.ownerUsername, title: s.title, content: s.description, excerpt: s.description, tags: s.tags, status: s.status === 'archived' ? 'archived' : (s.status || 'published'), visibility: s.visibility === 'private' ? 'private' : 'public', createdAt: s.createdAt, updatedAt: s.updatedAt, stats: { views: s.viewsCount }, sourceCollection: 'series', sourcePath: `series/${s.id}` });
export const userToContent = (u: CommunityUser): ContentEntity => normalizeContent({ id: u.uid, type: 'user', authorId: u.uid, authorUsername: u.username, title: u.displayName || u.username, content: u.bio, tags: [], topics: [], visibility: 'public', status: u.isBlocked || u.isSuspended ? 'archived' : 'published', createdAt: u.createdAt, updatedAt: u.updatedAt, sourceCollection: 'users', sourcePath: `users/${u.uid}` });
export const topicToContent = (t: SocialTopic): ContentEntity => normalizeContent({ id: t.id, type: 'topic', title: t.name, content: t.description, tags: [t.slug], topics: [t.slug], visibility: 'public', status: 'published', createdAt: t.createdAt, updatedAt: t.updatedAt, stats: { followers: t.followersCount }, sourceCollection: 'topics', sourcePath: `topics/${t.id}` });
