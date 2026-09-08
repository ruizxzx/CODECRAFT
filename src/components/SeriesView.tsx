import React, { useEffect, useMemo, useState } from 'react';
import { Article, Series } from '../types';
import { getSeriesList } from '../lib/series';
import { BookOpen, Clock, Layers, ArrowRight, Search } from 'lucide-react';

interface Props { articles: Article[]; onNavigate: (page: any, param?: string) => void; selectedSeriesId?: string | null; }

export const SeriesView: React.FC<Props> = ({ articles, onNavigate, selectedSeriesId }) => {
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { let active=true; setLoading(true); getSeriesList().then(x=>active&&setSeries(x)).catch(()=>active&&setSeries([])).finally(()=>active&&setLoading(false)); return ()=>{active=false}; }, []);
  const hydrated = useMemo(() => series.map(s=>({ ...s, items: articles.filter(a=>a.seriesId===s.id || a.seriesId===s.slug).sort((a,b)=>(a.seriesOrder||999)-(b.seriesOrder||999)) })), [series,articles]);
  const active = selectedSeriesId ? hydrated.find(s=>s.id===selectedSeriesId || s.slug===selectedSeriesId) : null;
  if (active) {
    const total = active.items.length || active.articleCount || 0;
    const mins = active.items.reduce((n,a)=>n+(a.readingTimeMinutes||0),0);
    return <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <button onClick={()=>onNavigate('series')} className="border-2 border-black px-3 py-2 font-mono text-xs bg-white hover:bg-[var(--color-primary)]">← ALL SERIES</button>
      <section className="border-4 border-black bg-black text-white p-6 sm:p-8 neo-shadow-lg">
        <div className="font-mono text-[10px] text-[var(--color-primary)] uppercase">SERIES / {total} PARTS</div>
        <h1 className="font-display font-black text-4xl sm:text-6xl uppercase tracking-tight mt-1">{active.title}</h1>
        <p className="mt-3 max-w-3xl text-neutral-300">{active.description}</p>
        <div className="mt-5 flex flex-wrap gap-4 font-mono text-[10px] uppercase"><span>{total} ARTICLES</span><span>{mins || active.estimatedMinutes || 0} MIN TOTAL</span><span>@{active.ownerUsername || 'creator'}</span></div>
      </section>
      <div className="grid gap-3">
        {active.items.map((a,i)=><button key={a.slug} onClick={()=>onNavigate('article',a.slug)} className="text-left border-4 border-black bg-white p-5 hover:bg-[var(--color-primary)] neo-shadow-sm"><div className="font-mono text-[10px]">PART {a.seriesOrder || i+1} · {a.readingTimeMinutes || 0} MIN</div><div className="font-display font-black text-xl sm:text-2xl uppercase mt-1">{a.title}</div><p className="text-sm mt-2 text-neutral-600">{a.excerpt}</p><div className="font-mono text-[10px] mt-3">READ PART <ArrowRight className="inline w-3 h-3"/></div></button>)}
        {!active.items.length && <div className="border-4 border-dashed border-black p-10 text-center font-mono text-xs">Series metadata exists, but its articles are not loaded in this publication.</div>}
      </div>
    </div>;
  }
  return <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
    <header className="border-4 border-black bg-[var(--color-primary)] p-6 sm:p-8 neo-shadow-lg"><div className="font-mono text-[10px] uppercase">OFFSCRPT / SERIES LIBRARY</div><h1 className="font-display font-black text-4xl sm:text-6xl uppercase">Series</h1><p className="max-w-2xl mt-2 text-sm">Structured reading paths for ideas that deserve more than one article.</p></header>
    {loading ? <div className="py-20 text-center font-mono text-xs">LOADING SERIES…</div> : <div className="grid md:grid-cols-2 gap-5">{hydrated.map(s=><button key={s.id} onClick={()=>onNavigate('series',s.id)} className="text-left border-4 border-black bg-white p-5 hover:bg-[var(--color-secondary)] neo-shadow-sm"><div className="flex items-center gap-2 font-mono text-[10px]"><Layers className="w-4 h-4"/>{s.items.length||s.articleCount} PARTS</div><h2 className="font-display font-black text-2xl uppercase mt-2">{s.title}</h2><p className="text-sm mt-2 text-neutral-700">{s.description}</p><div className="mt-4 flex gap-3 font-mono text-[10px]"><span><BookOpen className="inline w-3 h-3"/> {s.items.length||s.articleCount} ARTICLES</span><span><Clock className="inline w-3 h-3"/> {s.items.reduce((n,a)=>n+(a.readingTimeMinutes||0),0)} MIN</span></div></button>)}{!hydrated.length&&<div className="col-span-full border-4 border-dashed border-black p-12 text-center font-mono text-xs">NO SERIES YET. CREATE ONE FROM ADMIN STUDIO.</div>}</div>}
  </div>;
};
