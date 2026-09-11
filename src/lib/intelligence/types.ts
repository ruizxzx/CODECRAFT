export type ContentType = 'article' | 'post' | 'question' | 'answer' | 'discussion' | 'comment' | 'series' | 'community' | 'user' | 'tag' | 'topic';

export type Visibility = 'public' | 'authenticated' | 'followers' | 'community' | 'private' | 'owner';
export type ContentStatus = 'draft' | 'pending_review' | 'scheduled' | 'published' | 'unlisted' | 'archived' | 'deleted';

export interface ContentEntityStats {
  views?: number;
  likes?: number;
  saves?: number;
  shares?: number;
  comments?: number;
  answers?: number;
  followers?: number;
  quality?: number;
}

export interface ContentRelationship {
  id?: string;
  fromId: string;
  fromType: ContentType;
  toId: string;
  toType: ContentType;
  type: 'related' | 'references' | 'belongs_to' | 'part_of' | 'follow_up' | 'discusses' | 'answers' | 'inspired_by' | 'similar_to' | 'next_in_series' | 'previous_in_series';
  score?: number;
  source?: 'explicit' | 'derived' | 'ai';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ContentEntity {
  id: string;
  type: ContentType;
  authorId?: string;
  title: string;
  body: string;
  excerpt?: string;
  media?: unknown[];
  tags: string[];
  topics: string[];
  seriesId?: string;
  communityId?: string;
  parentId?: string;
  rootId?: string;
  visibility: Visibility;
  status: ContentStatus;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
  stats: ContentEntityStats;
  search: { normalizedText: string; tokens: string[] };
  relationships: ContentRelationship[];
  sourceCollection?: string;
  sourcePath?: string;
}
