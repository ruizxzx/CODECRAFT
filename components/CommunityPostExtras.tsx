import React from 'react';
import { CommunityPost } from '../types';
import { extractHashtags } from '../lib/community';
import { Hash } from 'lucide-react';

interface Props { post: CommunityPost; onHashtag?: (tag: string) => void; compact?: boolean; }

export const CommunityPostExtras: React.FC<Props> = ({ post, onHashtag, compact = false }) => {
  const media = (post.mediaUrls || []).filter(Boolean).slice(0, 6);
  const tags = (post.hashtags || extractHashtags(`${post.title} ${post.content}`)).slice(0, 12);
  return <>
    {media.length > 0 && (
      <div className={`grid gap-2 mt-4 ${media.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {media.map((url, i) => (
          <a key={`${url}-${i}`} href={url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="block border-2 border-black overflow-hidden bg-neutral-100 group/media">
            <img src={url} alt="Post media" loading="lazy" className={`w-full object-cover ${compact ? 'max-h-48' : 'max-h-80'} group-hover/media:scale-[1.01] transition-transform`} onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} />
          </a>
        ))}
      </div>
    )}
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
