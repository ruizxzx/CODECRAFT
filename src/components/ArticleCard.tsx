import React from 'react';
import { Article, Category, SiteConfig } from '../types';
import { Clock, Calendar, Bookmark, ArrowUpRight, Sparkles } from 'lucide-react';

interface ArticleCardProps {
  article: Article;
  onSelect: (slug: string) => void;
  isSaved?: boolean;
  onToggleSave?: (slug: string) => void;
  variant?: 'featured' | 'standard' | 'compact' | 'horizontal';
  siteConfig?: SiteConfig;
}

const CATEGORY_COLORS: Record<Category, { bg: string; text: string; border: string }> = {
  'Web Development': { bg: 'bg-[var(--color-primary)]', text: 'text-black', border: 'border-black' },
  'Artificial Intelligence': { bg: 'bg-[var(--color-accent)]', text: 'text-black', border: 'border-black' },
  'Software Engineering': { bg: 'bg-[var(--color-success)]', text: 'text-black', border: 'border-black' },
  'Computer Science': { bg: 'bg-[var(--color-secondary)]', text: 'text-black', border: 'border-black' },
  'Developer Tools': { bg: 'bg-[#FF7A00]', text: 'text-white', border: 'border-black' },
  'System Design': { bg: 'bg-[#B266FF]', text: 'text-white', border: 'border-black' },
};

export const ArticleCard: React.FC<ArticleCardProps> = ({
  article,
  onSelect,
  isSaved = false,
  onToggleSave,
  variant = 'standard',
  siteConfig,
}) => {
  const catStyle = CATEGORY_COLORS[article.category] || {
    bg: 'bg-neutral-100',
    text: 'text-black',
    border: 'border-black',
  };

  const handleCardClick = () => {
    onSelect(article.slug);
  };

  if (variant === 'featured') {
    return (
      <div 
        className="group relative bg-white neo-border neo-shadow hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all flex flex-col lg:flex-row overflow-hidden"
      >
        {/* Featured Left/Top Image */}
        <div 
          onClick={handleCardClick}
          className="lg:w-7/12 relative cursor-pointer overflow-hidden border-b-4 lg:border-b-0 lg:border-r-4 border-black bg-neutral-900 min-h-[300px] lg:min-h-[420px]"
        >
          <img
            src={article.coverImage}
            alt={article.coverImageAlt || article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 filter contrast-[1.05]"
            loading="lazy"
          />
          {/* Badge over image */}
          <div className="absolute top-4 left-4 flex flex-wrap gap-2">
            <span className={`px-3 py-1 font-display font-black text-xs uppercase neo-border-2 neo-shadow-sm ${catStyle.bg} ${catStyle.text}`}>
              {article.category}
            </span>
            <span className="px-2.5 py-1 bg-black text-[var(--color-primary)] font-mono font-bold text-xs uppercase border-2 border-black flex items-center space-x-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>FEATURED ESSAY</span>
            </span>
          </div>
        </div>

        {/* Featured Right Info */}
        <div className="lg:w-5/12 p-6 sm:p-8 flex flex-col justify-between bg-white">
          <div>
            <div className="flex items-center justify-between text-xs font-mono font-bold text-neutral-600 mb-3">
              <div className="flex items-center space-x-3">
                <span className="flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{article.publishedAt}</span>
                </span>
                <span>•</span>
                <span className="flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{article.readingTimeMinutes} min read</span>
                </span>
              </div>
              {onToggleSave && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSave(article.slug);
                  }}
                  className={`p-1.5 border-2 border-black neo-shadow-sm transition-transform active:translate-x-0.5 active:translate-y-0.5 ${
                    isSaved ? 'bg-[var(--color-primary)] text-black' : 'bg-white hover:bg-neutral-100 text-neutral-800'
                  }`}
                  title={isSaved ? 'Saved to reading list' : 'Save for later'}
                >
                  <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                </button>
              )}
            </div>

            <h2 
              onClick={handleCardClick}
              className="font-display font-black text-2xl sm:text-3xl text-black leading-tight cursor-pointer hover:text-[var(--color-secondary)] transition-colors mb-4"
            >
              {article.title}
            </h2>

            <p className="text-neutral-800 font-serif text-base sm:text-lg leading-relaxed line-clamp-4 mb-6">
              {article.excerpt}
            </p>
          </div>

          <div>
            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mb-6">
              {article.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-gray-100 text-black neo-border-2 font-mono text-xs font-semibold"
                >
                  #{tag}
                </span>
              ))}
            </div>

            {/* Bottom Author & CTA */}
            <div className="pt-4 border-t-2 border-black flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <img
                  src={siteConfig?.authorAvatarUrl || article.author.avatar}
                  alt={siteConfig?.authorName || article.author.name}
                  className="w-8 h-8 rounded-none border-2 border-black object-cover"
                />
                <div>
                  <div className="font-display font-black text-xs text-black">
                    {siteConfig?.authorName || article.author.name}
                  </div>
                  <div className="font-mono text-[10px] text-neutral-500">
                    {siteConfig?.authorRole || "KRISHFICIENT Lead"}
                  </div>
                </div>
              </div>

              <button
                onClick={handleCardClick}
                className="px-4 py-2 bg-black text-white font-display font-black text-xs uppercase flex items-center space-x-1.5 hover:bg-[var(--color-primary)] hover:text-black transition-colors border-2 border-black neo-shadow-sm active:translate-x-0.5 active:translate-y-0.5"
              >
                <span>READ ESSAY</span>
                <ArrowUpRight className="w-4 h-4 stroke-[3]" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Standard Grid Card
  return (
    <div 
      className="group bg-white neo-border neo-shadow-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_#000] transition-all flex flex-col justify-between overflow-hidden"
    >
      <div>
        {/* Card Image */}
        <div 
          onClick={handleCardClick}
          className="relative cursor-pointer aspect-video overflow-hidden border-b-4 border-black bg-neutral-900"
        >
          <img
            src={article.coverImage}
            alt={article.coverImageAlt || article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          {/* Category Chip */}
          <div className="absolute top-3 left-3">
            <span className={`px-2.5 py-1 font-display font-black text-xs uppercase neo-border-2 neo-shadow-sm ${catStyle.bg} ${catStyle.text}`}>
              {article.category}
            </span>
          </div>

          {/* Bookmark Button */}
          {onToggleSave && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleSave(article.slug);
              }}
              className={`absolute top-3 right-3 p-1.5 border-2 border-black neo-shadow-sm transition-colors ${
                isSaved ? 'bg-[var(--color-primary)] text-black' : 'bg-white hover:bg-neutral-100 text-neutral-700'
              }`}
              title={isSaved ? 'Saved' : 'Save article'}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
            </button>
          )}
        </div>

        {/* Card Content */}
        <div className="p-5">
          <div className="flex items-center space-x-2 text-xs font-mono font-semibold text-neutral-500 mb-2.5">
            <span>{article.publishedAt}</span>
            <span>•</span>
            <span>{article.readingTimeMinutes} min read</span>
          </div>

          <h3 
            onClick={handleCardClick}
            className="font-display font-black text-xl text-black leading-snug cursor-pointer hover:text-[var(--color-secondary)] transition-colors mb-3 line-clamp-2"
          >
            {article.title}
          </h3>

          <p className="text-neutral-700 font-serif text-sm leading-relaxed line-clamp-3 mb-4">
            {article.excerpt}
          </p>

          <div className="flex flex-wrap gap-1 mb-2">
            {article.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-gray-100 text-black border border-black font-mono text-[11px] font-semibold"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Card Footer */}
      <div className="px-5 py-3 border-t-2 border-black bg-gray-50 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <img
            src={siteConfig?.authorAvatarUrl || article.author.avatar}
            alt={siteConfig?.authorName || article.author.name}
            className="w-6 h-6 border border-black object-cover"
          />
          <span className="font-display font-bold text-xs text-neutral-900">
            {siteConfig?.authorName || article.author.name}
          </span>
        </div>

        <button
          onClick={handleCardClick}
          className="font-display font-black text-xs uppercase flex items-center space-x-1 text-black hover:text-[var(--color-secondary)] transition-colors"
        >
          <span>READ</span>
          <ArrowUpRight className="w-3.5 h-3.5 stroke-[3]" />
        </button>
      </div>
    </div>
  );
};
