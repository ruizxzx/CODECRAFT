import type { ContentEntity } from './intelligence/types';

export interface SemanticChunk {
  id: string;
  contentId: string;
  contentType: ContentEntity['type'];
  index: number;
  text: string;
  tokenEstimate: number;
  metadata: { title: string; authorId: string; tags: string[]; topics: string[]; visibility: ContentEntity['visibility'] };
}

export interface EmbeddingProvider {
  model: string;
  embed(input: string | string[]): Promise<number[][]>;
}

export interface HybridCandidate {
  id: string;
  lexicalScore: number;
  semanticScore: number;
  freshnessScore: number;
  personalizationScore: number;
  metadataScore: number;
}

/** Foundation-only semantic layer. It deliberately does not persist vectors in Firestore. */
export function chunkContent(entity: ContentEntity, maxWords = 180): SemanticChunk[] {
  const text = [entity.title, entity.excerpt, entity.body].filter(Boolean).join('\n\n').trim();
  if (!text) return [];
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: SemanticChunk[] = [];
  for (let i = 0, index = 0; i < words.length; i += Math.max(20, maxWords), index += 1) {
    const slice = words.slice(i, i + Math.max(20, maxWords));
    chunks.push({ id: `${entity.type}:${entity.id}:chunk:${index}`, contentId: entity.id, contentType: entity.type, index, text: slice.join(' '), tokenEstimate: slice.length, metadata: { title: entity.title, authorId: entity.authorId, tags: entity.tags, topics: entity.topics, visibility: entity.visibility } });
  }
  return chunks;
}

export function mergeHybridCandidates(candidates: HybridCandidate[], weights = { lexical: 0.38, semantic: 0.32, freshness: 0.1, personalization: 0.15, metadata: 0.05 }): HybridCandidate[] {
  return candidates.map(candidate => ({ ...candidate, lexicalScore: candidate.lexicalScore * weights.lexical, semanticScore: candidate.semanticScore * weights.semantic, freshnessScore: candidate.freshnessScore * weights.freshness, personalizationScore: candidate.personalizationScore * weights.personalization, metadataScore: candidate.metadataScore * weights.metadata }))
    .sort((a, b) => (b.lexicalScore + b.semanticScore + b.freshnessScore + b.personalizationScore + b.metadataScore) - (a.lexicalScore + a.semanticScore + a.freshnessScore + a.personalizationScore + a.metadataScore));
}
