import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Layers, Search, Sparkles, Clock3 } from 'lucide-react';
import { Article, PageView, Series } from '../types';
import { subscribeSeriesList } from '../lib/series';
import { calculateArticleReadingTime } from '../lib/reading';
import { UserIdentity } from './UserIdentity';

interface Props {
  articles: Article[];
  onNavigate: (page: PageView, param?: string) => void;
  compact?: boolean;
}

const formatDuration = (minutes: number) => minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;

export const SeriesStrip: React.FC<Props> = ({ articles, onNavigate, compact = false }) => {
  const [series, setSeries] = useState<Series[]>([]);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => subscribeSeriesList(items => setSeries(items)), []);

  const hydrated = useMemo(() => (Array.isArray(series) ? series : []).map(raw => {
    const s: any = raw && typeof raw === 'object' ? raw : {};
    const safeId = String(s.id || s.slug || '');
    const safeSlug = String(s.slug || s.id || '');
    const safeTags = Array.isArray(s.tags) ? s.tags.map((tag:any) => String(tag)) : [];
    const safeArticles = Array.isArray(articles) ? articles : [];
    return {
      ...s,
      id: safeId,
      slug: safeSlug,
      title: String(s.title || 'Untitled Series'),
      description: String(s.description || ''),
      tags: safeTags,
      ownerUsername: s.ownerUsername ? String(s.ownerUsername) : '',
      items: safeArticles.filter(a => a.seriesId === safeId || a.seriesId === safeSlug)
        .sort((a, b) => (a.seriesOrder ?? 999999) - (b.seriesOrder ?? 999999)),
    };
  }), [series, articles]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = hydrated.filter(s => !q || `${s.title} ${s.description} ${s.tags.join(' ')} ${s.ownerUsername}`.toLowerCase().includes(q));
    return showAll ? list : list.slice(0, 3);
  }, [hydrated, query, showAll]);

  if (!hydrated.length) return null;

  return <section className="border-b-4 border-black bg-white py-14 sm:py-18">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-8">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase font-black tracking-[0.15em]">
            <Layers className="w-4 h-4" /> STRUCTURED READING
          </div>
          <h2 className="font-display font-black text-4xl sm:text-5xl uppercase tracking-tight mt-2">SERIES</h2>
          <p className="mt-3 text-sm sm:text-base text-neutral-600 max-w-2xl">Follow connected articles as one structured reading path. Progress carries across devices when you're signed in.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="border-2 border-black px-3 py-2 flex items-center gap-2 bg-white min-w-[230px]">
            <Search className="w-4 h-4" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="SEARCH SERIES" className="w-full outline-none font-mono text-[10px] font-black uppercase" />
          </label>
          <button onClick={() => onNavigate('series')} className="border-2 border-black bg-[var(--color-primary)] px-4 py-2 font-mono text-[10px] font-black uppercase inline-flex items-center gap-2 hover:bg-black hover:text-white transition-colors">
            ALL SERIES <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className={`grid ${compact ? 'md:grid-cols-2' : 'lg:grid-cols-3'} gap-5`}>
        {filtered.map(s => {
          const minutes = s.items.reduce((sum, a) => sum + calculateArticleReadingTime(a), 0);
          return <article key={s.id} className="border-4 border-black bg-white neo-shadow-sm overflow-hidden">
            {s.coverImage ? <div className="aspect-[16/7] border-b-4 border-black overflow-hidden"><img src={s.coverImage} alt={s.coverImageAlt || s.title} className="w-full h-full object-cover" loading="lazy" /></div> : <div className="aspect-[16/7] border-b-4 border-black bg-[var(--color-secondary)] bg-grid-pattern" />}
            <div className="p-5">
              <div className="flex items-center justify-between gap-3 font-mono text-[9px] uppercase font-black">
                <span className="inline-flex items-center gap-1"><Sparkles className="w-3 h-3" />{s.items.length} PARTS</span>
                <span className="inline-flex items-center gap-1"><Clock3 className="w-3 h-3" />{formatDuration(minutes)}</span>
              </div>
              <h3 className="font-display font-black text-2xl uppercase mt-3 line-clamp-2">{s.title}</h3>
              <p className="text-sm text-neutral-600 mt-2 line-clamp-3">{s.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">{(s.tags || []).slice(0, 3).map(tag => <span key={tag} className="border border-black px-2 py-1 font-mono text-[8px] uppercase">#{tag}</span>)}</div>
              <div className="mt-5 flex items-center justify-between gap-3">
                <UserIdentity name={s.ownerName || 'Creator'} username={s.ownerUsername} uid={s.ownerId} size="sm" />
                <button onClick={() => onNavigate('series', s.id)} className="border-2 border-black bg-black text-white px-3 py-2 font-mono text-[9px] font-black uppercase inline-flex items-center gap-2 hover:bg-[var(--color-primary)] hover:text-black transition-colors">OPEN <ArrowRight className="w-3 h-3" /></button>
              </div>
            </div>
          </article>;
        })}
      </div>

      {hydrated.length > 3 && <div className="mt-6 flex justify-center">
        <button onClick={() => setShowAll(v => !v)} className="border-2 border-black bg-white px-4 py-2 font-mono text-[10px] font-black uppercase hover:bg-[var(--color-primary)]">
          {showAll ? 'SHOW FEATURED' : `VIEW ALL SERIES (${hydrated.length})`}
        </button>
      </div>}
    </div>
  </section>;
};
