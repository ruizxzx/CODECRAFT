import type { ContentEntity } from './intelligence/types';

export interface SemanticChunk {
  id: string;
  contentId: string;
  contentType: ContentEntity['type'];
  index: number;
  text: string;
  tokenEstimate: number;
  checksum: string;
  metadata: {
    title: string;
    authorId?: string;
    tags: string[];
    topics: string[];
    visibility: ContentEntity['visibility'];
    status: ContentEntity['status'];
    sourceCollection?: string;
    sourcePath?: string;
    headingPath?: string[];
  };
}

export interface EmbeddingProvider {
  model: string;
  dimensions?: number;
  embed(input: string | string[]): Promise<number[][]>;
}

export interface VectorIndexProvider {
  name: string;
  upsert(items: Array<{ id: string; vector: number[]; metadata?: Record<string, unknown> }>): Promise<void>;
  delete(ids: string[]): Promise<void>;
  query(vector: number[], options?: { limit?: number; filter?: Record<string, unknown> }): Promise<Array<{ id: string; score: number; metadata?: Record<string, unknown> }>>;
  health(): Promise<{ ok: boolean; detail?: string }>;
}

export interface HybridCandidate {
  id: string;
  lexicalScore: number;
  semanticScore: number;
  freshnessScore: number;
  personalizationScore: number;
  metadataScore: number;
}

const sha256 = async (value: string): Promise<string> => {
  if (typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined') {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(x => x.toString(16).padStart(2, '0')).join('');
  }
  let h1 = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) { h1 ^= value.charCodeAt(i); h1 = Math.imul(h1, 0x01000193); }
  return `fnv1a-${(h1 >>> 0).toString(16)}`;
};

/** Deterministic, dependency-free fallback checksum for runtimes where SubtleCrypto is unavailable. */
export const deterministicChecksum = async (value: string) => sha256(value);

function splitSections(text: string): Array<{ text: string; headingPath: string[] }> {
  const lines = text.split(/\n+/);
  const chunks: Array<{ text: string; headingPath: string[] }> = [];
  let headingPath: string[] = [];
  let buffer: string[] = [];
  const flush = () => {
    const body = buffer.join('\n').trim();
    if (body) chunks.push({ text: body, headingPath: [...headingPath] });
    buffer = [];
  };
  for (const line of lines) {
    const trimmed = line.trim();
    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flush();
      const depth = heading[1].length;
      headingPath = headingPath.slice(0, depth - 1);
      headingPath.push(heading[2].trim());
      continue;
    }
    buffer.push(line);
  }
  flush();
  return chunks.length ? chunks : [{ text, headingPath: [] }];
}

/**
 * V84 chunker: prefers headings/paragraph boundaries, then packs bounded word windows.
 * Chunk IDs are deterministic for the same source version/content.
 */
export async function chunkContentV84(entity: ContentEntity, maxWords = 180, overlapWords = 30): Promise<SemanticChunk[]> {
  const normalized = [entity.title, entity.excerpt, entity.body].filter(Boolean).join('\n\n').trim();
  if (!normalized) return [];
  const sections = splitSections(normalized);
  const chunks: SemanticChunk[] = [];
  let index = 0;
  for (const section of sections) {
    const words = section.text.split(/\s+/).filter(Boolean);
    const step = Math.max(20, maxWords - Math.max(0, Math.min(overlapWords, maxWords - 20)));
    for (let offset = 0; offset < words.length; offset += step) {
      const slice = words.slice(offset, offset + Math.max(20, maxWords));
      if (!slice.length) break;
      const text = slice.join(' ').trim();
      const seed = [entity.type, entity.id, entity.updatedAt || entity.createdAt || '', String(index), text].join('|');
      const checksum = await deterministicChecksum(seed);
      chunks.push({
        id: `${entity.type}:${entity.id}:v84:${index}`,
        contentId: entity.id,
        contentType: entity.type,
        index,
        text,
        tokenEstimate: slice.length,
        checksum,
        metadata: {
          title: entity.title,
          authorId: entity.authorId,
          tags: entity.tags,
          topics: entity.topics,
          visibility: entity.visibility,
          status: entity.status,
          sourceCollection: entity.sourceCollection,
          sourcePath: entity.sourcePath,
          headingPath: section.headingPath,
        },
      });
      index += 1;
      if (offset + slice.length >= words.length) break;
    }
  }
  return chunks;
}

/** Synchronous legacy-compatible chunker used by existing callers. */
export function chunkContent(entity: ContentEntity, maxWords = 180): SemanticChunk[] {
  const text = [entity.title, entity.excerpt, entity.body].filter(Boolean).join('\n\n').trim();
  if (!text) return [];
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: SemanticChunk[] = [];
  for (let i = 0, index = 0; i < words.length; i += Math.max(20, maxWords), index += 1) {
    const slice = words.slice(i, i + Math.max(20, maxWords));
    if (!slice.length) break;
    let h1 = 0x811c9dc5; const raw = slice.join(' ');
    const seed = `${entity.type}|${entity.id}|${entity.updatedAt || entity.createdAt || ''}|${index}|${raw}`;
    for (let j = 0; j < seed.length; j++) { h1 ^= seed.charCodeAt(j); h1 = Math.imul(h1, 0x01000193); }
    chunks.push({
      id: `${entity.type}:${entity.id}:v84:${index}`,
      contentId: entity.id,
      contentType: entity.type,
      index,
      text: raw,
      tokenEstimate: slice.length,
      checksum: `fnv1a-${(h1 >>> 0).toString(16)}`,
      metadata: {
        title: entity.title,
        authorId: entity.authorId,
        tags: entity.tags,
        topics: entity.topics,
        visibility: entity.visibility,
        status: entity.status,
        sourceCollection: entity.sourceCollection,
        sourcePath: entity.sourcePath,
      },
    });
  }
  return chunks;
}

export function mergeHybridCandidates(candidates: HybridCandidate[], weights = { lexical: 0.38, semantic: 0.32, freshness: 0.1, personalization: 0.15, metadata: 0.05 }): HybridCandidate[] {
  return candidates.map(candidate => ({
    ...candidate,
    lexicalScore: candidate.lexicalScore * weights.lexical,
    semanticScore: candidate.semanticScore * weights.semantic,
    freshnessScore: candidate.freshnessScore * weights.freshness,
    personalizationScore: candidate.personalizationScore * weights.personalization,
    metadataScore: candidate.metadataScore * weights.metadata,
  })).sort((a, b) => {
    const sa = a.lexicalScore + a.semanticScore + a.freshnessScore + a.personalizationScore + a.metadataScore;
    const sb = b.lexicalScore + b.semanticScore + b.freshnessScore + b.personalizationScore + b.metadataScore;
    return sb - sa;
  });
}
