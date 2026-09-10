import React from 'react';

interface Props {
  mediaUrls?: string[];
  coverImage?: string;
  coverImageAlt?: string;
  compact?: boolean;
  className?: string;
}

/**
 * Shared fixed-height media treatment for feed/discovery/list cards.
 * Images are cropped inside a stable frame so a portrait/huge source cannot
 * expand the feed card and push other discoveries below the fold.
 */
export const FeedMediaPreview: React.FC<Props> = ({
  mediaUrls,
  coverImage,
  coverImageAlt = '',
  compact = true,
  className = '',
}) => {
  const urls = Array.from(new Set([
    ...(Array.isArray(mediaUrls) ? mediaUrls : []),
    ...(coverImage ? [coverImage] : []),
  ].filter((url): url is string => typeof url === 'string' && url.trim().length > 0))).slice(0, 4);

  if (!urls.length) return null;

  return (
    <div
      className={`grid gap-2 border-2 border-black bg-neutral-100 overflow-hidden ${
        urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
      } ${compact ? 'h-36 sm:h-40 md:h-44' : 'h-52 sm:h-60 md:h-64'} ${className}`}
      aria-label={`${urls.length} media ${urls.length === 1 ? 'item' : 'items'}`}
    >
      {urls.map((url, index) => (
        <div key={`${url}-${index}`} className="min-w-0 min-h-0 overflow-hidden bg-neutral-100">
          <img
            src={url}
            alt={coverImageAlt || 'Post media'}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = 'none';
            }}
          />
        </div>
      ))}
    </div>
  );
};
