import React from 'react';
import { CommunityPost } from '../types';
import { extractHashtags } from '../lib/community';
import { Hash } from 'lucide-react';
import { FeedMediaPreview } from './FeedMediaPreview';

interface Props { post: CommunityPost; onHashtag?: (tag: string) => void; compact?: boolean; }

export const CommunityPostExtras: React.FC<Props> = ({ post, onHashtag, compact = false }) => {
  const media = (post.mediaUrls || []).filter(Boolean).slice(0, 6);
  const tags = (post.hashtags || extractHashtags(`${post.title} ${post.content}`)).slice(0, 12);
  return <>
    {media.length > 0 && <div className="mt-4"><FeedMediaPreview mediaUrls={media} coverImage={post.coverImage} coverImageAlt={post.coverImageAlt} compact={compact} /></div>}
    {tags.length > 0 && (
      <div className="flex flex-wrap gap-1.5 mt-3">
        {tags.map(tag => onHashtag ? (
          <button key={tag} type="button" onClick={e => { e.stopPropagation(); onHashtag(tag); }} className="inline-flex items-center gap-1 px-2 py-1 bg-neutral-100 hover:bg-[var(--color-secondary)] border border-black font-mono text-[10px] font-bold uppercase">
            <Hash className="w-3 h-3" />{tag}
          </button>
        ) : <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-neutral-100 border border-black font-mono text-[10px] font-bold uppercase"><Hash className="w-3 h-3" />{tag}</span>)}
      </div>
    )}
  </>;
};
