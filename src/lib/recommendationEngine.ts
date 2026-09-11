import type { ContentEntity } from './intelligence/types';
import { scoreDiscoveryCandidate, diversifyDiscovery } from './discovery';

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
      const discovery = scoreDiscoveryCandidate(entity, {
        topicAffinity: signals.topicAffinity,
        creatorAffinity: signals.creatorAffinity,
        recentIds: signals.recentIds,
        negativeIds: signals.negative,
      });
      const reasons: string[] = [];
      for (const t of entity.topics) { const s = signals.topicAffinity?.[t.toLowerCase()] || 0; if (s >= 3) reasons.push(`Because you read ${t}`); }
      const c = entity.authorId ? signals.creatorAffinity?.[entity.authorId] || 0 : 0;
      if (c >= 3) reasons.push('From a creator you engage with');
      const score = discovery.score + (signals.contentAffinity?.[entity.id] || 0);
      return { entity, score, reason: reasons[0] || discovery.reason };
    });
    const diversified = diversifyDiscovery(rows.map(row => ({ ...row.entity, score: row.score, reason: row.reason })), row => row.authorId || row.topics[0] || row.type, limit);
    return diversified.map(row => ({ ...row, reason: row.reason }));
  }
}

export const recommendationEngine = new RecommendationEngine();
