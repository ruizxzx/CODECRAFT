import type { ContentEntity } from './intelligence/types';

export interface RecommendationRequest { userId?: string; context?: string; contentType?: ContentEntity['type']; limit?: number; }
export interface RecommendationSignals {
  topicAffinity?: Record<string, number>;
  creatorAffinity?: Record<string, number>;
  contentAffinity?: Record<string, number>;
  completed?: Set<string>;
  negative?: Set<string>;
  recentIds?: Set<string>;
  followedCreators?: Set<string>;
  followedTopics?: Set<string>;
}

export class RecommendationEngine {
  constructor(private readonly defaults = { diversityPenalty: 2.5, repetitionPenalty: 4 }) {}

  recommend(candidates: ContentEntity[], request: RecommendationRequest = {}, signals: RecommendationSignals = {}): Array<ContentEntity & { score: number; reason: string }> {
    const limit = Math.max(1, Math.min(50, request.limit || 10));
    const filtered = candidates.filter(x => (!request.contentType || x.type === request.contentType) && x.status === 'published' && !signals.completed?.has(x.id) && !signals.negative?.has(x.id));
    const rows = filtered.map(entity => {
      let score = 0; const reasons: string[] = [];
      for (const t of entity.topics) { const s = signals.topicAffinity?.[t.toLowerCase()] || 0; score += s; if (s >= 3) reasons.push(`Because you read ${t}`); }
      const c = entity.authorId ? signals.creatorAffinity?.[entity.authorId] || 0 : 0; score += c * 1.5; if (c >= 3) reasons.push('From a creator you engage with');
      score += signals.contentAffinity?.[entity.id] || 0;
      const ageDays = Math.max(0, (Date.now() - new Date(entity.publishedAt || entity.createdAt || 0).getTime()) / 86400000);
      score += Math.max(0, 5 - ageDays / 14);
      score += Math.min(4, Number(entity.stats.quality || 0));
      score += Math.min(3, Number(entity.stats.views || 0) / 3000);
      if (signals.recentIds?.has(entity.id)) score -= this.defaults.repetitionPenalty;
      return { entity, score, reasons };
    }).sort((a,b) => b.score - a.score);
    const selected: Array<ContentEntity & { score: number; reason: string }> = [];
    const topicCounts = new Map<string, number>();
    const creatorCounts = new Map<string, number>();
    for (const row of rows) {
      const diversity = row.entity.topics.reduce((sum, t) => sum + (topicCounts.get(t) || 0), 0) + (creatorCounts.get(row.entity.authorId || '') || 0);
      const adjusted = row.score - diversity * this.defaults.diversityPenalty;
      if (adjusted < 0 && selected.length >= Math.ceil(limit / 2)) continue;
      row.entity.topics.forEach(t => topicCounts.set(t, (topicCounts.get(t) || 0) + 1));
      if (row.entity.authorId) creatorCounts.set(row.entity.authorId, (creatorCounts.get(row.entity.authorId) || 0) + 1);
      selected.push({ ...row.entity, score: Math.round(adjusted * 100) / 100, reason: row.reasons[0] || (row.entity.status === 'published' ? 'Fresh on OFFSCRPT' : '') });
      if (selected.length >= limit) break;
    }
    return selected;
  }
}

export const recommendationEngine = new RecommendationEngine();
