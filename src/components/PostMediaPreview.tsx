import React from 'react';
import { Play } from 'lucide-react';
import type { CommunityPost } from '../types';

interface Props {
  post: Pick<CommunityPost, 'coverImage' | 'coverImageAlt' | 'mediaUrls' | 'title'>;
  showAll?: boolean;
  className?: string;
}

const isVideo = (url: string) => /\.(mp4|webm|mov|m4v)(?:$|\?)/i.test(url);
const isDocument = (url: string) => /\.(pdf|doc|docx|ppt|pptx|xls|xlsx)(?:$|\?)/i.test(url);
const isImage = (url: string) => /\.(jpe?g|png|webp|gif|avif|bmp|svg)(?:$|\?)/i.test(url) || (!isDocument(url) && !isVideo(url));
const mediaIdentity = (url: string) => {
  try {
    const parsed = new URL(url, window.location.origin);
    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '').toLowerCase();
  } catch {
    return String(url).split(/[?#]/)[0].replace(/\/+$/, '').toLowerCase();
  }
};

export const PostMediaPreview: React.FC<Props> = ({ post, showAll = false, className = '' }) => {
  const seen = new Set<string>();
  const media = [
    ...(post.coverImage ? [post.coverImage] : []),
    ...(post.mediaUrls || []),
  ].filter(Boolean).filter(url => {
    if (!(isImage(url) || isVideo(url))) return false;
    const key = mediaIdentity(url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (!media.length) return null;
  const items = showAll ? media.slice(0, 8) : media.slice(0, 1);

  return <div className={`${showAll && items.length > 1 ? 'grid sm:grid-cols-2 gap-3' : ''} ${className}`}>
    {items.map((url, i) => {
      if (isVideo(url)) {
        return <div key={`${url}-${i}`} className={`relative overflow-hidden border-2 border-black bg-black ${showAll && items.length > 1 ? '' : 'aspect-video'}`}>
          <video src={url} controls preload="metadata" className="w-full h-full object-cover" aria-label={`${post.title} video ${i + 1}`} />
          <div className="absolute top-2 left-2 pointer-events-none border-2 border-black bg-white px-2 py-1 font-mono text-[9px] font-black"><Play className="inline w-3 h-3 mr-1"/>VIDEO</div>
        </div>;
      }
      if (showAll) {
        return <a key={`${url}-${i}`} href={url} target="_blank" rel="noreferrer" className={`block overflow-hidden bg-neutral-100 border-2 border-black ${items.length > 1 ? '' : 'aspect-video'}`}>
          <img src={url} alt={post.coverImageAlt || post.title || `Post image ${i + 1}`} loading="lazy" className="w-full h-full object-cover" onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} />
        </a>;
      }
      return <div key={`${url}-${i}`} className="block aspect-video overflow-hidden bg-neutral-100 border-2 border-black">
        <img src={url} alt={post.coverImageAlt || post.title || `Post image ${i + 1}`} loading="lazy" className="w-full h-full object-cover" onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} />
      </div>;
    })}
  </div>;
};
