import type { ContentEntity, ContentType } from './intelligence/types';
import { filterAuthorizedContent } from './permissions';
import { engagementScore, freshnessScore, lexicalMatchScore, parseDiscoveryQuery } from './discovery';

export interface UnifiedSearchFilters {
  types?: ContentType[];
  creatorId?: string;
  topic?: string;
  tag?: string;
  communityId?: string;
  seriesId?: string;
  dateFrom?: string;
  dateTo?: string;
  maxReadingMinutes?: number;
}

export interface UnifiedSearchOptions {
  query?: string;
  filters?: UnifiedSearchFilters;
  limit?: number;
  viewer?: { userId?: string; isAdmin?: boolean };
}

export interface UnifiedSearchResult extends ContentEntity { score: number; reasons: string[]; }
const normalize = (v: unknown) => String(v ?? '').toLowerCase().trim();

export function searchEverything(entities: ContentEntity[], options: UnifiedSearchOptions = {}): UnifiedSearchResult[] {
  const parsed = parseDiscoveryQuery(options.query || '');
  const q = normalize(parsed.text);
  const terms = parsed.terms;
  let candidates = filterAuthorizedContent(entities, { userId: options.viewer?.userId, isAdmin: options.viewer?.isAdmin });
  const f = options.filters || {};
  const typeFromQuery = parsed.filters.type;
  if (f.types?.length) candidates = candidates.filter(x => f.types!.includes(x.type));
  if (typeFromQuery) candidates = candidates.filter(x => normalize(x.type) === normalize(typeFromQuery));
  if (f.creatorId || parsed.filters.author) {
    const creator = normalize(f.creatorId || parsed.filters.author);
    candidates = candidates.filter(x => normalize(x.authorId) === creator || normalize(x.authorUsername) === creator);
  }
  if (f.topic || parsed.filters.topic) candidates = candidates.filter(x => x.topics.some(t => normalize(t) === normalize(f.topic || parsed.filters.topic)));
  if (f.tag || parsed.filters.tag) candidates = candidates.filter(x => x.tags.some(t => normalize(t) === normalize(f.tag || parsed.filters.tag)));
  if (f.communityId || parsed.filters.community) candidates = candidates.filter(x => normalize(x.communityId) === normalize(f.communityId || parsed.filters.community));
  if (f.seriesId || parsed.filters.series) candidates = candidates.filter(x => normalize(x.seriesId) === normalize(f.seriesId || parsed.filters.series));
  const from = f.dateFrom || parsed.filters.after;
  const to = f.dateTo || parsed.filters.before;
  if (from) candidates = candidates.filter(x => new Date(x.publishedAt || x.createdAt || 0) >= new Date(from));
  if (to) candidates = candidates.filter(x => new Date(x.publishedAt || x.createdAt || 0) <= new Date(to));
  if (typeof f.maxReadingMinutes === 'number') candidates = candidates.filter(x => Number((x as any).readingTimeMinutes ?? Number.POSITIVE_INFINITY) <= f.maxReadingMinutes!);

  const scored = candidates.map(entity => {
    const lexical = lexicalMatchScore(entity, terms, q);
    let score = lexical.score;
    const reasons = [...lexical.reasons];
    if (!q) score = 5;
    score += freshnessScore(entity) * 8;
    score += engagementScore(entity) * 0.65;
    if (entity.stats?.quality) score += Math.min(8, Number(entity.stats.quality));
    if (entity.status !== 'published' && entity.status !== 'unlisted') score -= 1000;
    if (entity.publishedAt) {
      const ageDays = Math.max(0, (Date.now() - new Date(entity.publishedAt).getTime()) / 86400000);
      if (ageDays <= 14) reasons.push('recent');
    }
    return { ...entity, score, reasons: [...new Set(reasons)] };
  });

  return scored
    .filter(x => x.score > -500)
    .sort((a, b) => b.score - a.score || normalize(a.title).localeCompare(normalize(b.title)))
    .slice(0, Math.max(1, Math.min(100, options.limit || 20)));
}
