import React, { useEffect, useState } from 'react';
import { Clock3, Trash2, RotateCcw, History as HistoryIcon, Loader2, ArrowRight } from 'lucide-react';
import { ArticleHistoryItem, clearArticleHistory, deleteArticleHistoryItem, subscribeArticleHistory } from '../lib/reading';
import { useAuthUser } from '../lib/useAuthUser';
import { loginWithGoogle } from '../lib/firebase';
import { PageView } from '../types';

interface Props { onNavigate: (page: PageView, param?: string) => void; }

function formatViewedAt(value?: string) {
  if (!value) return 'RECENTLY';
  const d = new Date(value);
  const diff = Math.max(0, Date.now() - d.getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'JUST NOW';
  if (mins < 60) return `${mins}M AGO`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}H AGO`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}D AGO`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }).toUpperCase();
}

export const HistoryView: React.FC<Props> = ({ onNavigate }) => {
  const [items, setItems] = useState<ArticleHistoryItem[]>([]);
  const user = useAuthUser();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const load = () => {
    if (!user) { setItems([]); setLoading(false); return () => {}; }
    setLoading(true);
    const unsub = subscribeArticleHistory(next => { setItems(next); setLoading(false); }, 100);
    return unsub;
  };
  useEffect(() => load(), [user?.uid]);
  const remove = async (slug: string) => {
    setItems(prev => prev.filter(item => item.slug !== slug));
    try { await deleteArticleHistoryItem(slug); } catch { load(); }
  };
  const clear = async () => {
    if (!items.length || !window.confirm('Clear your OFFSCRPT reading history?')) return;
    setBusy(true);
    try { await clearArticleHistory(); setItems([]); } catch (error) { console.error(error); load(); }
    finally { setBusy(false); }
  };

  if (!user) return <section className="max-w-2xl mx-auto px-4 py-20 sm:py-28 text-center"><HistoryIcon className="w-12 h-12 mx-auto mb-4"/><div className="font-mono text-[10px] uppercase text-neutral-500">PRIVATE READING HISTORY</div><h1 className="font-display font-black text-4xl uppercase mt-2">SIGN IN TO VIEW HISTORY</h1><p className="text-neutral-600 mt-3">Your reading history is tied to your account and is never shown to other users.</p><button onClick={async()=>{try{await loginWithGoogle();}catch(e){console.error(e)}}} className="mt-6 border-2 border-black bg-[var(--color-primary)] px-5 py-3 font-mono text-[10px] font-black uppercase">SIGN IN WITH GOOGLE</button></section>;

  return <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
    <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
      <div>
        <div className="font-mono text-[10px] uppercase text-neutral-500 flex items-center gap-2"><HistoryIcon className="w-4 h-4"/> YOUR READING HISTORY</div>
        <h1 className="font-display font-black text-4xl sm:text-6xl uppercase leading-none mt-2">HISTORY</h1>
        <p className="mt-3 text-neutral-600 max-w-2xl">Your latest reads, synced to your account. Opening an article again updates its existing entry instead of creating duplicates.</p>
      </div>
      <button disabled={!items.length || busy} onClick={clear} className="border-2 border-black bg-white px-4 py-3 font-mono text-[10px] font-black uppercase flex items-center gap-2 hover:bg-red-100 disabled:opacity-40"><Trash2 className="w-4 h-4"/> CLEAR HISTORY</button>
    </div>
    {loading ? <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin"/></div> : !items.length ? <div className="border-4 border-dashed border-black p-12 text-center"><Clock3 className="w-10 h-10 mx-auto mb-3"/><div className="font-display font-black text-2xl uppercase">NO READING HISTORY</div><p className="font-mono text-xs text-neutral-500 mt-2">Open an article while signed in and it will appear here.</p><button onClick={()=>onNavigate('blog')} className="mt-5 border-2 border-black bg-[var(--color-primary)] px-4 py-3 font-mono text-[10px] font-black uppercase">EXPLORE ARTICLES →</button></div> :
      <div className="grid gap-3">{items.map(item => <article key={item.slug} className="border-4 border-black bg-white neo-shadow-sm p-3 sm:p-4 flex gap-4 items-stretch">
        <button onClick={()=>onNavigate('article', item.slug)} className="w-28 sm:w-40 shrink-0 border-2 border-black bg-neutral-100 overflow-hidden" aria-label={`Open ${item.title}`}>
          {item.coverImage ? <img src={item.coverImage} alt="" className="w-full h-full min-h-28 object-cover" loading="lazy"/> : <div className="min-h-28 h-full bg-[var(--color-secondary)] bg-grid-pattern"/>}
        </button>
        <div className="min-w-0 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase text-neutral-500"><span>{formatViewedAt(item.viewedAt)}</span>{item.category && <><span>•</span><span>{item.category}</span></>}</div>
            <button onClick={()=>onNavigate('article', item.slug)} className="text-left font-display font-black text-xl sm:text-2xl uppercase mt-1 hover:underline">{item.title}</button>
            {item.authorUsername && <div className="mt-1 font-mono text-[10px] text-neutral-500">BY @{item.authorUsername}</div>}
            <p className="text-sm text-neutral-600 mt-2 line-clamp-2">{item.excerpt}</p>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-[160px]"><div className="h-2 border-2 border-black bg-white"><div className="h-full bg-[var(--color-primary)]" style={{width:`${Math.max(0, Math.min(100, item.progress || 0))}%`}}/></div><div className="font-mono text-[9px] uppercase mt-1">{item.progress || 0}% LAST PROGRESS</div></div>
            <button onClick={()=>onNavigate('article', item.slug)} className="border-2 border-black bg-black text-white px-3 py-2 font-mono text-[9px] font-black uppercase inline-flex items-center gap-1">{item.progress && item.progress < 100 ? 'RESUME' : 'OPEN'} <ArrowRight className="w-3 h-3"/></button>
            <button onClick={()=>remove(item.slug)} className="border-2 border-black bg-white px-3 py-2 font-mono text-[9px] font-black uppercase inline-flex items-center gap-1 hover:bg-red-100"><Trash2 className="w-3 h-3"/> REMOVE</button>
          </div>
        </div>
      </article>)}</div>}
  </section>;
};
