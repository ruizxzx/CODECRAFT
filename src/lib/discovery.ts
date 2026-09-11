import type { ContentEntity } from './intelligence/types';

export interface DiscoveryQueryPlan {
  text: string;
  terms: string[];
  filters: {
    type?: string;
    topic?: string;
    tag?: string;
    author?: string;
    community?: string;
    series?: string;
    before?: string;
    after?: string;
  };
}

const norm = (v: unknown) => String(v ?? '').toLowerCase().trim();
const tokens = (v: string) => norm(v).split(/[^a-z0-9@#_-]+/).map(x => x.replace(/^[@#]/, '')).filter(x => x.length >= 2);

export function parseDiscoveryQuery(raw: string): DiscoveryQueryPlan {
  const input = String(raw || '').trim();
  const filters: DiscoveryQueryPlan['filters'] = {};
  const remaining: string[] = [];
  const parts = input.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  for (const part of parts) {
    const clean = part.replace(/^"|"$/g, '');
    const m = clean.match(/^(type|topic|tag|author|from|community|series|before|after):(.*)$/i);
    if (!m || !m[2]) { remaining.push(clean); continue; }
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === 'from') filters.author = value;
    else filters[key as keyof typeof filters] = value;
  }
  const text = remaining.join(' ').trim();
  return { text, terms: tokens(text), filters };
}

function dateMs(v: unknown): number {
  if (!v) return 0;
  const n = new Date(String(v)).getTime();
  return Number.isFinite(n) ? n : 0;
}

export function freshnessScore(entity: ContentEntity, halfLifeDays = 30): number {
  const published = dateMs(entity.publishedAt || entity.createdAt);
  if (!published) return 0;
  const ageDays = Math.max(0, (Date.now() - published) / 86400000);
  return Math.exp(-Math.log(2) * ageDays / Math.max(1, halfLifeDays));
}

export function engagementScore(entity: ContentEntity): number {
  const views = Math.max(0, Number(entity.stats?.views || 0));
  const likes = Math.max(0, Number(entity.stats?.likes || 0));
  const comments = Math.max(0, Number(entity.stats?.comments || 0));
  const answers = Math.max(0, Number(entity.stats?.answers || 0));
  const saves = Math.max(0, Number(entity.stats?.saves || 0));
  return Math.log1p(views) * 0.5 + Math.log1p(likes) * 1.4 + Math.log1p(comments) * 1.8 + Math.log1p(answers) * 1.2 + Math.log1p(saves) * 1.6;
}

export function qualityScore(entity: ContentEntity): number {
  return Math.max(0, Math.min(10, Number(entity.stats?.quality || 0))) * 0.8;
}

export function trendScore(entity: ContentEntity): number {
  return freshnessScore(entity, 7) * (4 + engagementScore(entity) + qualityScore(entity));
}

export function lexicalMatchScore(entity: ContentEntity, terms: string[], rawText: string): { score: number; reasons: string[] } {
  if (!terms.length) return { score: 0, reasons: [] };
  const title = norm(entity.title);
  const hay = norm(entity.search?.normalizedText || `${entity.title} ${entity.excerpt} ${entity.body}`);
  let score = 0;
  const reasons: string[] = [];
  if (title === norm(rawText)) { score += 120; reasons.push('exact title match'); }
  if (title.includes(norm(rawText)) && norm(rawText)) { score += 55; reasons.push('title match'); }
  for (const term of terms) {
    if (title.split(/[^a-z0-9_-]+/).some(x => x === term)) { score += 24; reasons.push(`title: ${term}`); }
    else if (title.split(/[^a-z0-9_-]+/).some(x => x.startsWith(term))) { score += 14; reasons.push(`title starts with ${term}`); }
    if (entity.tags.some(t => norm(t) === term)) { score += 18; reasons.push(`tag: ${term}`); }
    if (entity.topics.some(t => norm(t) === term)) { score += 20; reasons.push(`topic: ${term}`); }
    const occurrences = hay.split(term).length - 1;
    if (occurrences > 0) score += Math.min(18, occurrences * 4);
  }
  return { score, reasons: [...new Set(reasons)] };
}

export interface DiscoveryCandidateScore {
  score: number;
  reason: string;
  signals: Record<string, number>;
}

export function scoreDiscoveryCandidate(entity: ContentEntity, context: {
  topicAffinity?: Record<string, number>;
  creatorAffinity?: Record<string, number>;
  recentIds?: Set<string>;
  negativeIds?: Set<string>;
  queryTerms?: string[];
} = {}): DiscoveryCandidateScore {
  const signals: Record<string, number> = {};
  let score = 0;
  const topicAffinity = context.topicAffinity || {};
  const creatorAffinity = context.creatorAffinity || {};
  for (const topic of entity.topics) score += (topicAffinity[norm(topic)] || 0) * 3.5;
  score += (creatorAffinity[norm(entity.authorId)] || 0) * 2.5;
  score += trendScore(entity);
  score += qualityScore(entity);
  const novelty = context.recentIds?.has(entity.id) ? -4 : 1.25;
  if (context.negativeIds?.has(entity.id)) return { score: -1000, reason: 'excluded by preference', signals: { preference: -1000 } };
  score += novelty;
  signals.freshness = freshnessScore(entity);
  signals.engagement = engagementScore(entity);
  signals.quality = qualityScore(entity);
  signals.novelty = novelty;
  return { score, reason: entity.topics.find(t => (topicAffinity[norm(t)] || 0) >= 2) ? 'matches your interests' : freshnessScore(entity) > 0.65 ? 'fresh on OFFSCRPT' : 'popular with readers', signals };
}

export function diversifyDiscovery<T extends { id: string }>(rows: Array<T & { score: number }>, getGroup: (row: T) => string, limit: number): Array<T & { score: number }> {
  const selected: Array<T & { score: number }> = [];
  const counts = new Map<string, number>();
  for (const row of [...rows].sort((a, b) => b.score - a.score)) {
    if (selected.length >= limit) break;
    const group = getGroup(row) || '__unknown__';
    const count = counts.get(group) || 0;
    const adjusted = row.score - Math.max(0, count - 1) * 2.2;
    if (adjusted < 0 && selected.length >= Math.ceil(limit * 0.6)) continue;
    counts.set(group, count + 1);
    selected.push({ ...row, score: Math.round(adjusted * 100) / 100 });
  }
  return selected;
}

export function buildDiscoveryFacets(entities: ContentEntity[]) {
  const types = new Map<string, number>();
  const topics = new Map<string, number>();
  const tags = new Map<string, number>();
  entities.forEach(e => {
    types.set(e.type, (types.get(e.type) || 0) + 1);
    e.topics.forEach(v => { const k = norm(v); if (k) topics.set(k, (topics.get(k) || 0) + 1); });
    e.tags.forEach(v => { const k = norm(v); if (k) tags.set(k, (tags.get(k) || 0) + 1); });
  });
  return {
    types: [...types.entries()].sort((a,b) => b[1] - a[1]),
    topics: [...topics.entries()].sort((a,b) => b[1] - a[1]).slice(0, 50),
    tags: [...tags.entries()].sort((a,b) => b[1] - a[1]).slice(0, 50),
  };
}
