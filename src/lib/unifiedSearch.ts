import type { ContentEntity, ContentType } from './intelligence/types';
import { filterAuthorizedContent } from './permissions';

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
  const q = normalize(options.query);
  const terms = q.split(/\s+/).filter(Boolean);
  let candidates = filterAuthorizedContent(entities, { userId: options.viewer?.userId, isAdmin: options.viewer?.isAdmin });
  const f = options.filters || {};
  if (f.types?.length) candidates = candidates.filter(x => f.types!.includes(x.type));
  if (f.creatorId) candidates = candidates.filter(x => x.authorId === f.creatorId);
  if (f.topic) candidates = candidates.filter(x => x.topics.map(normalize).includes(normalize(f.topic)));
  if (f.tag) candidates = candidates.filter(x => x.tags.map(normalize).includes(normalize(f.tag)));
  if (f.communityId) candidates = candidates.filter(x => x.communityId === f.communityId);
  if (f.seriesId) candidates = candidates.filter(x => x.seriesId === f.seriesId);
  if (f.dateFrom) candidates = candidates.filter(x => new Date(x.publishedAt || x.createdAt || 0) >= new Date(f.dateFrom!));
  if (f.dateTo) candidates = candidates.filter(x => new Date(x.publishedAt || x.createdAt || 0) <= new Date(f.dateTo!));
  if (typeof f.maxReadingMinutes === 'number') candidates = candidates.filter(x => Number((x as any).readingTimeMinutes ?? Number.POSITIVE_INFINITY) <= f.maxReadingMinutes!);

  const results = candidates.map(entity => {
    const hay = entity.search.normalizedText;
    let score = q ? 0 : 1;
    const reasons: string[] = [];
    if (q) {
      if (normalize(entity.title) === q) { score += 100; reasons.push('exact title match'); }
      if (normalize(entity.title).includes(q)) { score += 50; reasons.push('title match'); }
      terms.forEach(term => { if (hay.includes(term)) score += 8; if (entity.tags.some(t => normalize(t) === term)) { score += 12; reasons.push(`tag: ${term}`); } if (entity.topics.some(t => normalize(t) === term)) { score += 14; reasons.push(`topic: ${term}`); } });
    }
    const ageDays = Math.max(0, (Date.now() - new Date(entity.publishedAt || entity.createdAt || 0).getTime()) / 86400000);
    score += Math.max(0, 4 - ageDays / 30);
    score += Math.min(8, Number(entity.stats.views || 0) / 2000);
    score += Math.min(6, Number(entity.stats.likes || 0) / 100);
    if (entity.status !== 'published' && entity.status !== 'unlisted') score -= 1000;
    return { ...entity, score, reasons: Array.from(new Set(reasons)) };
  }).filter(x => x.score > -500).sort((a,b) => b.score - a.score).slice(0, Math.max(1, Math.min(100, options.limit || 20)));
  return results;
}
