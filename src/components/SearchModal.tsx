import React, { useState, useEffect, useRef } from 'react';
import { Article } from '../types';
import { Search, X, ArrowUpRight, Sparkles, Hash } from 'lucide-react';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  articles: Article[];
  onSelectArticle: (slug: string) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  articles,
  onSelectArticle,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        // Toggle search modal
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filtered = query.trim() === ''
    ? articles.slice(0, 4)
    : articles.filter((art) => {
        const q = query.toLowerCase();
        return (
          art.title.toLowerCase().includes(q) ||
          art.excerpt.toLowerCase().includes(q) ||
          art.category.toLowerCase().includes(q) ||
          art.tags.some((t) => t.toLowerCase().includes(q))
        );
      });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/70 backdrop-blur-xs">
      <div 
        className="w-full max-w-2xl bg-white border-4 border-black neo-shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b-4 border-black bg-white">
          <Search className="w-5 h-5 text-black stroke-[3] mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search articles, tags, system designs, AI..."
            className="w-full font-display font-bold text-lg sm:text-xl text-black placeholder-neutral-400 focus:outline-none bg-transparent"
          />
          {query && (
            <button 
              onClick={() => setQuery('')}
              className="p-1 hover:bg-neutral-100 border-2 border-black mr-2"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="px-2.5 py-1 bg-neutral-200 neo-border-2 font-mono text-xs font-bold hover:bg-[var(--color-primary)] transition-colors"
          >
            ESC
          </button>
        </div>

        {/* Search Results Area */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-mono font-bold text-neutral-500 px-1 mb-2">
            <span>{query ? `RESULTS (${filtered.length})` : 'POPULAR DISPATCHES'}</span>
            <span>PRESS ENTER TO VIEW</span>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-10 neo-border-2 border-dashed bg-white p-6">
              <p className="font-display font-black text-xl text-black mb-1">
                No matching dispatches found
              </p>
              <p className="font-sans text-sm text-neutral-600">
                Try searching for keywords like "Vite", "AI", "Database", or "TypeScript".
              </p>
            </div>
          ) : (
            filtered.map((art) => (
              <div
                key={art.id}
                onClick={() => {
                  onSelectArticle(art.slug);
                  onClose();
                }}
                className="group p-3.5 bg-white neo-border-2 neo-shadow-sm hover:bg-[var(--color-primary)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all cursor-pointer flex items-start justify-between"
              >
                <div className="space-y-1 pr-3">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 bg-black text-white text-[10px] font-mono font-bold uppercase">
                      {art.category}
                    </span>
                    <span className="text-[11px] font-mono text-neutral-500">
                      {art.readingTimeMinutes} min read
                    </span>
                  </div>
                  <h4 className="font-display font-black text-base text-black group-hover:text-black leading-snug">
                    {art.title}
                  </h4>
                  <p className="font-sans text-xs text-neutral-600 line-clamp-1">
                    {art.excerpt}
                  </p>
                </div>
                <ArrowUpRight className="w-5 h-5 text-black stroke-[2.5] shrink-0 mt-1 opacity-60 group-hover:opacity-100" />
              </div>
            ))
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2.5 bg-neutral-100 border-t-4 border-black flex items-center justify-between text-[11px] font-mono text-neutral-600">
          <div className="flex items-center space-x-3">
            <span>Navigate: Click or Tab</span>
            <span>Close: [Esc]</span>
          </div>
          <span className="font-bold text-black">KRISHFICIENT DISPATCHES</span>
        </div>
      </div>
    </div>
  );
};
