import React, { useState, useMemo } from 'react';
import { Article, Category, SiteConfig } from '../types';
import { CATEGORIES } from '../data/articles';
import { ArticleCard } from './ArticleCard';
import { Search, Filter, Bookmark, Sparkles, BookOpen, Layers, ArrowUpDown, Plus, Edit2, Trash2 } from 'lucide-react';
import { SeriesStrip } from './SeriesStrip';

interface BlogViewProps {
  articles: Article[];
  onSelectArticle: (slug: string) => void;
  savedSlugs: string[];
  onToggleSave: (slug: string) => void;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  siteConfig: SiteConfig;
  onNavigate: (page: any, slug?: string) => void;
  isMasterAdmin?: boolean;
  onWriteNew?: () => void;
  onEditArticle?: (article: Article) => void;
  onDeleteArticle?: (slug: string) => void | Promise<void>;
}

export const BlogView: React.FC<BlogViewProps> = ({
  articles,
  onSelectArticle,
  savedSlugs,
  onToggleSave,
  selectedCategory,
  onSelectCategory,
  siteConfig,
  onNavigate,
  isMasterAdmin = false,
  onWriteNew,
  onEditArticle,
  onDeleteArticle,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'reading-time' | 'popular'>('newest');
  const customCategories = Array.isArray(siteConfig.customCategories) ? siteConfig.customCategories : [];
  const categories = useMemo(() => Array.from(new Set([...CATEGORIES, ...customCategories, ...articles.map(a => a.category).filter(Boolean)])), [customCategories, articles]);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    articles.forEach((art) => (Array.isArray(art.tags) ? art.tags : []).forEach((t) => tagSet.add(String(t))));
    return Array.from(tagSet);
  }, [articles]);

  // Filter & sort articles
  const filteredArticles = useMemo(() => {
    let list = articles.filter((art) => {
      // Saved filter
      if (showSavedOnly && !savedSlugs.includes(art.slug)) {
        return false;
      }
      // Category filter
      if (selectedCategory !== 'All Posts' && art.category !== selectedCategory) {
        return false;
      }
      // Tag filter
      if (selectedTag && !(Array.isArray(art.tags) ? art.tags : []).includes(selectedTag)) {
        return false;
      }
      // Query filter
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchesTitle = String(art.title || '').toLowerCase().includes(q);
        const matchesExcerpt = String(art.excerpt || '').toLowerCase().includes(q);
        const matchesTags = (Array.isArray(art.tags) ? art.tags : []).some((t) => String(t).toLowerCase().includes(q));
        if (!matchesTitle && !matchesExcerpt && !matchesTags) return false;
      }
      return true;
    });

    // Sorting
    return list.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      }
      if (sortBy === 'reading-time') {
        return b.readingTimeMinutes - a.readingTimeMinutes;
      }
      if (sortBy === 'popular') {
        return (b.viewsCount || 0) - (a.viewsCount || 0);
      }
      return 0;
    });
  }, [articles, selectedCategory, selectedTag, searchQuery, showSavedOnly, savedSlugs, sortBy]);

  // Determine top featured article
  const featuredArticle = useMemo(() => {
    return articles.find((a) => a.pinned) || articles.find((a) => a.featured) || articles[0];
  }, [articles]);

  return (
    <div className="w-full bg-white min-h-screen pb-20">
      {/* Editorial Header Section — fully CMS controlled, with a live published count */}
      {(() => {
        const header = siteConfig.blogHeader || {
          eyebrow: 'THE DISPATCHES ARCHIVE',
          title: 'ENGINEERING & ARCHITECTURE',
          description: 'Rigorous, hands-on writing dissecting modern web technologies, AI agent architectures, distributed database internals, and developer productivity systems.',
          backgroundColor: siteConfig.themePrimaryColor || '#FFD600',
          textColor: '#000000',
          showEssayCount: true,
          essayCountLabel: 'ESSAYS PUBLISHED'
        };
        const publishedCount = articles.filter(a => a.isPublished !== false && a.mainPublicationStatus !== 'unpublished').length;
        return (
          <section
            className="border-b-4 border-black py-12 sm:py-16"
            style={{ backgroundColor: header.backgroundColor, color: header.textColor }}
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {header.eyebrow && (
                  <span className="px-3 py-1 bg-black text-white font-mono text-xs font-bold uppercase">
                    {header.eyebrow}
                  </span>
                )}
                {header.showEssayCount !== false && (
                  <span className="px-2.5 py-1 bg-white text-black neo-border-2 font-display font-black text-xs uppercase neo-shadow-sm">
                    {publishedCount} {header.essayCountLabel || 'ESSAYS PUBLISHED'}
                  </span>
                )}
              </div>

              <h1 className="font-display font-black text-4xl sm:text-5xl md:text-6xl uppercase tracking-tighter mb-4">
                {header.title}
              </h1>

              {header.description && (
                <p className="font-sans text-lg sm:text-xl max-w-3xl leading-relaxed font-medium">
                  {header.description}
                </p>
              )}
            </div>
          </section>
        );
      })()}

      <SeriesStrip articles={articles} onNavigate={onNavigate} compact />

      {isMasterAdmin && (
        <div className="border-b-4 border-black bg-black text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="font-mono text-[10px] font-black uppercase tracking-wider">EDITORIAL ADMIN · LIVE FIRESTORE CONTENT</div>
            <div className="flex gap-2">
              <button type="button" onClick={onWriteNew} className="px-4 py-2 bg-[var(--color-primary)] text-black border-2 border-black font-display font-black text-xs uppercase neo-shadow-sm inline-flex items-center gap-1.5"><Plus className="w-4 h-4"/> WRITE NEW BLOG</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        
        {/* Featured Article of the Month (Show only if no search/filter is applied) */}
        {selectedCategory === 'All Posts' && !selectedTag && searchQuery === '' && !showSavedOnly && featuredArticle && (
          <div className="space-y-3">
            <div className="flex items-center space-x-2 font-display font-black text-sm uppercase tracking-wider text-black">
              <Sparkles className="w-4 h-4 fill-black" />
              <span>CURRENT EDITORIAL SPOTLIGHT</span>
            </div>
            <ArticleCard
              article={featuredArticle}
              onSelect={onSelectArticle}
              isSaved={savedSlugs.includes(featuredArticle.slug)}
              onToggleSave={onToggleSave}
              variant="featured"
              siteConfig={siteConfig}
            />
          </div>
        )}

        {/* Controls, Filters & Search Toolbar */}
        <div className="bg-white neo-border neo-shadow p-5 space-y-5">
          {/* Search + Sort + Saved Toggle Bar */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Search input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-black stroke-[2.5]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter essays by keyword or topic..."
                className="w-full pl-10 pr-4 py-2.5 border-2 border-black font-sans font-medium text-sm text-black placeholder-neutral-400 focus:outline-none focus:bg-gray-50"
              />
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center space-x-2 shrink-0">
              <span className="font-mono text-xs font-bold text-neutral-600 uppercase flex items-center space-x-1">
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>SORT:</span>
              </span>
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="px-3 py-2 neo-border-2 font-display font-black text-xs uppercase bg-white focus:outline-none cursor-pointer"
              >
                <option value="newest">NEWEST FIRST</option>
                <option value="popular">MOST POPULAR</option>
                <option value="reading-time">LONGEST READ</option>
              </select>

              {/* Saved Filter Toggle */}
              <button
                onClick={() => setShowSavedOnly(!showSavedOnly)}
                className={`px-3.5 py-2 neo-border-2 font-display font-black text-xs uppercase flex items-center space-x-1.5 transition-colors active:translate-x-0.5 active:translate-y-0.5 ${
                  showSavedOnly
                    ? 'bg-[var(--color-primary)] text-black neo-shadow-sm'
                    : 'bg-white hover:bg-neutral-100 text-neutral-800'
                }`}
              >
                <Bookmark className={`w-3.5 h-3.5 ${showSavedOnly ? 'fill-current' : ''}`} />
                <span>SAVED ({savedSlugs.length})</span>
              </button>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="border-t-2 border-black pt-4">
            <div className="flex items-center space-x-2 text-xs font-mono font-bold text-neutral-500 mb-2 uppercase">
              <Filter className="w-3.5 h-3.5" />
              <span>CATEGORIES:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => onSelectCategory(cat)}
                    className={`px-3.5 py-1.5 font-display font-black text-xs uppercase tracking-wide neo-border-2 transition-all active:translate-x-0.5 active:translate-y-0.5 ${
                      isSelected
                        ? 'bg-black text-[var(--color-primary)] neo-shadow-sm'
                        : 'bg-white text-black hover:bg-[var(--color-primary)]'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tags cloud */}
          <div className="border-t border-neutral-200 pt-3 flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[11px] font-bold text-neutral-500 mr-2 uppercase">
              TAGS:
            </span>
            {allTags.map((tag) => {
              const isSelected = selectedTag === tag;
              return (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(isSelected ? null : tag)}
                  className={`px-2 py-0.5 font-mono text-xs transition-colors border-2 ${
                    isSelected
                      ? 'bg-[var(--color-accent)] text-black border-black font-bold neo-shadow-sm'
                      : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border-black/30'
                  }`}
                >
                  #{tag}
                </button>
              );
            })}
            {selectedTag && (
              <button
                onClick={() => setSelectedTag(null)}
                className="text-xs font-mono text-red-600 underline ml-2 cursor-pointer font-bold"
              >
                Clear Tag
              </button>
            )}
          </div>
        </div>

        {/* Results Counter & Active Status */}
        <div className="flex items-center justify-between font-mono text-xs font-bold text-neutral-600 px-1">
          <span>
            SHOWING {filteredArticles.length} OF {articles.length} DISPATCHES
          </span>
          {(searchQuery || selectedCategory !== 'All Posts' || selectedTag || showSavedOnly) && (
            <button
              onClick={() => {
                setSearchQuery('');
                onSelectCategory('All Posts');
                setSelectedTag(null);
                setShowSavedOnly(false);
              }}
              className="text-black underline hover:text-[var(--color-secondary)]"
            >
              RESET ALL FILTERS
            </button>
          )}
        </div>

        {/* Articles Grid */}
        {filteredArticles.length === 0 ? (
          <div className="bg-white neo-border neo-shadow-lg p-12 text-center space-y-4">
            <BookOpen className="w-12 h-12 mx-auto text-neutral-400 stroke-[1.5]" />
            <h3 className="font-display font-black text-2xl text-black">
              No matching articles found
            </h3>
            <p className="font-sans text-neutral-600 max-w-md mx-auto text-sm">
              We couldn't find any dispatches matching your selected criteria. Try resetting your filters or searching for another topic.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                onSelectCategory('All Posts');
                setSelectedTag(null);
                setShowSavedOnly(false);
              }}
              className="px-6 py-2.5 bg-[var(--color-primary)] text-black font-display font-black text-sm uppercase neo-border neo-shadow-sm active:translate-x-1 active:translate-y-1 active:shadow-none"
            >
              VIEW ALL ARTICLES
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {filteredArticles.map((art) => (
              <div key={art.id} className="min-w-0">
                <ArticleCard
                  article={art}
                  onSelect={onSelectArticle}
                  isSaved={savedSlugs.includes(art.slug)}
                  onToggleSave={onToggleSave}
                  variant="standard"
                  siteConfig={siteConfig}
                />
                {isMasterAdmin && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => onEditArticle?.(art)} className="py-2 bg-white border-2 border-black font-mono text-[10px] font-black uppercase inline-flex items-center justify-center gap-1.5 hover:bg-[var(--color-primary)]"><Edit2 className="w-3.5 h-3.5"/> EDIT BLOG</button>
                    <button type="button" onClick={() => { if (window.confirm(`Delete the article \"${art.title}\" permanently?`)) void onDeleteArticle?.(art.slug); }} className="py-2 bg-[var(--color-accent)] border-2 border-black font-mono text-[10px] font-black uppercase inline-flex items-center justify-center gap-1.5 hover:bg-black hover:text-white"><Trash2 className="w-3.5 h-3.5"/> DELETE</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
};
