import React, { useEffect, useMemo, useState } from 'react';
import { Article, Series } from '../types';
import { deleteSeries, getSeriesList, reorderSeriesArticles, setArticleSeriesMembership, updateSeries } from '../lib/series';
import { auth, checkIsAdmin } from '../lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BookOpen, Check, ChevronDown,
  Edit3, ExternalLink, Filter, Layers, ListChecks,
  Play, Save, Search, Settings2, Share2, Sparkles,
  Trash2, X
} from 'lucide-react';

interface Props {
  articles: Article[];
  onNavigate: (page: any, param?: string) => void;
  selectedSeriesId?: string | null;
}

type SortMode = 'order' | 'newest' | 'shortest' | 'longest';

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
const safeMinutes = (article: Article) => Math.max(0, Number(article.readingTimeMinutes || 0));

export const SeriesView: React.FC<Props> = ({ articles, onNavigate, selectedSeriesId }) => {
  const [series, setSeries] = useState<Series[]>([]);
  const [user] = useAuthState(auth);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('order');
  const [filterOpen, setFilterOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [managingParts, setManagingParts] = useState(false);
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    try { setSeries(await getSeriesList()); setError(null); }
    catch (e:any) { setError(e?.message || 'Could not load series.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const hydrated = useMemo(() => series.map(s => ({
    ...s,
    items: articles.filter(a => a.seriesId === s.id || a.seriesId === s.slug).sort((a,b) => (a.seriesOrder ?? 999999) - (b.seriesOrder ?? 999999))
  })), [series, articles]);

  const active = selectedSeriesId ? hydrated.find(s => s.id === selectedSeriesId || s.slug === selectedSeriesId) : null;
  const currentUser = user;
  const canEditSeries = !!active && !!currentUser && (active.ownerId === currentUser.uid || checkIsAdmin(currentUser.email));
  const canManageParts = !!currentUser && checkIsAdmin(currentUser.email);

  useEffect(() => {
    if (!active) return;
    const key = `offscpt:series-progress:${active.id}`;
    try { setCompleted(JSON.parse(localStorage.getItem(key) || '{}')); } catch { setCompleted({}); }
  }, [active?.id]);

  const toggleComplete = (slug: string) => {
    if (!active) return;
    const next = { ...completed, [slug]: !completed[slug] };
    setCompleted(next);
    try { localStorage.setItem(`offscpt:series-progress:${active.id}`, JSON.stringify(next)); } catch {}
  };

  const copyUrl = async () => {
    if (!active) return;
    const url = `${window.location.origin}${window.location.pathname}#series/${active.id}`;
    try { await navigator.clipboard.writeText(url); setNotice('SERIES LINK COPIED'); } catch { setNotice(url); }
    window.setTimeout(() => setNotice(null), 2200);
  };

  const startOrResume = () => {
    if (!active) return;
    const first = active.items.find(a => !completed[a.slug]) || active.items[0];
    if (first) onNavigate('article', first.slug);
  };

  const filteredItems = useMemo(() => {
    if (!active) return [];
    const q = search.trim().toLowerCase();
    const list = active.items.filter(a => !q || `${a.title} ${a.excerpt} ${a.tags?.join(' ') || ''}`.toLowerCase().includes(q));
    if (sortMode === 'newest') return [...list].sort((a,b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime());
    if (sortMode === 'shortest') return [...list].sort((a,b) => safeMinutes(a) - safeMinutes(b));
    if (sortMode === 'longest') return [...list].sort((a,b) => safeMinutes(b) - safeMinutes(a));
    return list;
  }, [active, search, sortMode]);

  const movePart = async (article: Article, direction: -1 | 1) => {
    if (!active || !canManageParts || busy) return;
    const ordered = [...active.items];
    const index = ordered.findIndex(x => x.slug === article.slug);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    setBusy(true); setError(null);
    try {
      await reorderSeriesArticles(active.id, active.title, ordered);
      setNotice('SERIES ORDER SAVED');
      await load();
    } catch (e:any) { setError(e?.message || 'Could not save series order.'); }
    finally { setBusy(false); }
  };

  const setSeriesMetadata = async (patch: Partial<Series>) => {
    if (!active || !canEditSeries || busy) return;
    setBusy(true); setError(null);
    try { await updateSeries(active.id, patch); setSeries(prev => prev.map(s => s.id === active.id ? { ...s, ...patch } : s)); setNotice('SERIES UPDATED'); setEditing(false); }
    catch (e:any) { setError(e?.message || 'Could not update series.'); }
    finally { setBusy(false); }
  };

  const addArticleToSeries = async (slug: string) => {
    if (!active || !canManageParts || busy || !slug) return;
    const article = articles.find(a => a.slug === slug);
    if (!article) return;
    setBusy(true); setError(null);
    try {
      await setArticleSeriesMembership(article.slug, active.id, active.title, active.items.length + 1);
      setNotice('ARTICLE ADDED TO SERIES');
      await load();
    } catch (e:any) { setError(e?.message || 'Could not add article.'); }
    finally { setBusy(false); }
  };

  const removeArticleFromSeries = async (article: Article) => {
    if (!active || !canManageParts || busy) return;
    if (!window.confirm(`Remove “${article.title}” from this series? The article itself will not be deleted.`)) return;
    setBusy(true); setError(null);
    try {
      await setArticleSeriesMembership(article.slug, undefined, undefined, undefined);
      setNotice('ARTICLE REMOVED FROM SERIES');
      await load();
    } catch (e:any) { setError(e?.message || 'Could not remove article.'); }
    finally { setBusy(false); }
  };

  const removeSeries = async () => {
    if (!active || !canEditSeries || busy) return;
    if (!window.confirm(`Delete the series “${active.title}”? Articles will remain published.`)) return;
    setBusy(true); setError(null);
    try { await deleteSeries(active.id); setNotice('SERIES DELETED'); onNavigate('series'); await load(); }
    catch (e:any) { setError(e?.message || 'Could not delete series.'); }
    finally { setBusy(false); }
  };

  if (active) {
    const total = active.items.length || active.articleCount || 0;
    const mins = active.items.reduce((n,a)=>n+safeMinutes(a),0) || active.estimatedMinutes || 0;
    const completedCount = active.items.filter(a => completed[a.slug]).length;
    const progress = total ? Math.round((completedCount / total) * 100) : 0;
    const remaining = Math.max(0, total - completedCount);
    const availableToAdd = canManageParts ? articles.filter(a => a.seriesId !== active.id && a.seriesId !== active.slug) : [];

    return <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <button onClick={()=>onNavigate('series')} className="border-2 border-black px-3 py-2 font-mono text-[10px] font-black bg-white hover:bg-[var(--color-primary)] inline-flex items-center gap-2"><ArrowLeft className="w-3 h-3"/> ALL SERIES</button>
        <div className="flex flex-wrap gap-2">
          <button onClick={copyUrl} className="border-2 border-black px-3 py-2 font-mono text-[10px] font-black bg-white hover:bg-neutral-100 inline-flex items-center gap-2"><Share2 className="w-3 h-3"/> SHARE</button>
          {canEditSeries && <button onClick={()=>setEditing(v=>!v)} className="border-2 border-black px-3 py-2 font-mono text-[10px] font-black bg-white hover:bg-[var(--color-primary)] inline-flex items-center gap-2"><Edit3 className="w-3 h-3"/> EDIT SERIES</button>}
          {canManageParts && <button onClick={()=>setManagingParts(v=>!v)} className={`border-2 border-black px-3 py-2 font-mono text-[10px] font-black inline-flex items-center gap-2 ${managingParts?'bg-black text-white':'bg-white hover:bg-[var(--color-secondary)]'}`}><Settings2 className="w-3 h-3"/> MANAGE PARTS</button>}
        </div>
      </div>

      {notice && <div className="mb-4 border-2 border-black bg-[var(--color-primary)] p-3 font-mono text-[10px] font-black uppercase" role="status">{notice}</div>}
      {error && <div className="mb-4 border-2 border-black bg-red-100 p-3 font-mono text-[10px] font-black uppercase" role="alert">{error}</div>}

      {editing && canEditSeries && <SeriesEditor series={active} busy={busy} onSave={setSeriesMetadata} onDelete={removeSeries} onClose={()=>setEditing(false)} />}

      <section className="relative overflow-hidden border-4 border-black bg-black text-white neo-shadow-lg">
        {active.coverImage && <img src={active.coverImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-35" />}
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/90 to-black/45" />
        <div className="relative p-6 sm:p-10 lg:p-12">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-[var(--color-primary)] uppercase font-black">
            <span className="border border-[var(--color-primary)] px-2 py-1">SERIES</span><span>{total} PARTS</span><span>•</span><span>{mins} MIN</span>
          </div>
          <h1 className="font-display font-black text-4xl sm:text-6xl lg:text-7xl uppercase tracking-tight mt-3 max-w-4xl">{active.title}</h1>
          <p className="mt-4 max-w-3xl text-neutral-200 text-sm sm:text-base leading-relaxed">{active.description}</p>
          {active.tags?.length ? <div className="flex flex-wrap gap-2 mt-5">{active.tags.map(tag=><span key={tag} className="border-2 border-white/60 px-2 py-1 font-mono text-[9px] uppercase">#{tag}</span>)}</div> : null}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-7 max-w-3xl">
            <Stat label="PARTS" value={String(total)} />
            <Stat label="READ TIME" value={`${mins}m`} />
            <Stat label="COMPLETED" value={`${completedCount}/${total}`} />
            <Stat label="PROGRESS" value={`${progress}%`} />
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button onClick={startOrResume} disabled={!total} className="border-2 border-black bg-[var(--color-primary)] text-black px-5 py-3 font-display font-black text-sm uppercase hover:translate-x-0.5 hover:translate-y-0.5 inline-flex items-center gap-2 disabled:opacity-40"><Play className="w-4 h-4 fill-current"/> {completedCount ? 'RESUME SERIES' : 'START SERIES'}</button>
            <div className="font-mono text-[10px] uppercase text-neutral-300">{remaining ? `${remaining} PART${remaining===1?'':'S'} REMAINING` : 'SERIES COMPLETE'}</div>
          </div>
          <div className="mt-7 max-w-4xl">
            <div className="flex items-center justify-between font-mono text-[9px] uppercase mb-2"><span>YOUR PROGRESS</span><span>{progress}%</span></div>
            <div className="h-4 border-2 border-white bg-white/10"><div className="h-full bg-[var(--color-primary)] transition-all" style={{width:`${progress}%`}} /></div>
          </div>
        </div>
      </section>

      {managingParts && canManageParts && <div className="mt-5 border-4 border-black bg-[var(--color-secondary)] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div><div className="font-mono text-[10px] font-black uppercase">PART MANAGER</div><h2 className="font-display font-black text-2xl uppercase">Build the sequence</h2></div>
          <div className="flex items-center gap-2 font-mono text-[9px] uppercase"><span>{active.items.length} assigned</span><span>•</span><span>{availableToAdd.length} available</span></div>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <select disabled={busy || !availableToAdd.length} defaultValue="" onChange={e=>{void addArticleToSeries(e.target.value); e.currentTarget.value='';}} className="border-2 border-black bg-white p-3 font-mono text-[10px] min-w-[260px] max-w-full"><option value="">+ ADD ARTICLE TO SERIES</option>{availableToAdd.map(a=><option key={a.slug} value={a.slug}>{a.title}</option>)}</select>
          <div className="border-2 border-black bg-white px-3 py-3 font-mono text-[9px] uppercase">Reordering saves article metadata and may create a revision.</div>
        </div>
      </div>}

      <section className="mt-5 border-4 border-black bg-white">
        <div className="p-4 sm:p-5 border-b-2 border-black flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div><div className="font-mono text-[9px] uppercase text-neutral-500">CURRICULUM</div><h2 className="font-display font-black text-2xl uppercase">{total} parts</h2></div>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search this series" className="border-2 border-black pl-9 pr-3 py-2.5 font-mono text-[10px] w-[220px] max-w-full" /></div>
            <button onClick={()=>setFilterOpen(v=>!v)} className="border-2 border-black px-3 py-2.5 font-mono text-[10px] font-black bg-white hover:bg-neutral-100 inline-flex items-center gap-2"><Filter className="w-3 h-3"/> FILTER <ChevronDown className="w-3 h-3"/></button>
          </div>
        </div>
        {filterOpen && <div className="p-4 border-b-2 border-black bg-neutral-50 flex flex-wrap gap-2">
          {([['order','CURRICULUM ORDER'],['newest','NEWEST'],['shortest','SHORTEST'],['longest','LONGEST']] as Array<[SortMode,string]>).map(([value,label])=><button key={value} onClick={()=>setSortMode(value)} className={`border-2 border-black px-3 py-2 font-mono text-[9px] font-black ${sortMode===value?'bg-black text-white':'bg-white'}`}>{label}</button>)}
        </div>}

        <div className="divide-y-2 divide-black">
          {filteredItems.map((a, i) => {
            const actualIndex = active.items.findIndex(x=>x.slug===a.slug);
            const done = !!completed[a.slug];
            return <article key={a.slug} className={`p-4 sm:p-5 transition-colors ${done ? 'bg-neutral-50' : 'bg-white hover:bg-[var(--color-primary)]/10'}`}>
              <div className="flex items-start gap-3 sm:gap-4">
                <button onClick={()=>toggleComplete(a.slug)} aria-label={done ? 'Mark part incomplete' : 'Mark part complete'} className={`shrink-0 w-10 h-10 border-2 border-black flex items-center justify-center font-mono text-xs ${done?'bg-[var(--color-primary)]':'bg-white'}`}>{done?<Check className="w-5 h-5"/>:String(actualIndex+1).padStart(2,'0')}</button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-2 items-center font-mono text-[9px] uppercase"><span>PART {actualIndex+1}</span><span>•</span><span>{safeMinutes(a)} MIN</span>{done&&<span className="border border-black px-1 bg-[var(--color-primary)]">DONE</span>}</div>
                  <h3 className={`font-display font-black text-xl sm:text-2xl uppercase mt-1 ${done?'line-through decoration-2':''}`}>{a.title}</h3>
                  {a.excerpt && <p className="mt-2 text-sm text-neutral-600 max-w-3xl">{a.excerpt}</p>}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button onClick={()=>onNavigate('article',a.slug)} className="border-2 border-black bg-black text-white px-3 py-2 font-mono text-[9px] font-black inline-flex items-center gap-2 hover:bg-[var(--color-primary)] hover:text-black"><BookOpen className="w-3 h-3"/> READ PART</button>
                    {a.tags?.slice(0,3).map(tag=><span key={tag} className="border border-black px-2 py-1 font-mono text-[8px] uppercase">#{tag}</span>)}
                  </div>
                </div>
                {managingParts && canManageParts && <div className="shrink-0 flex flex-col gap-1"><button disabled={busy || actualIndex===0} onClick={()=>void movePart(a,-1)} title="Move up" className="border-2 border-black p-2 bg-white disabled:opacity-30"><ArrowUp className="w-3 h-3"/></button><button disabled={busy || actualIndex===active.items.length-1} onClick={()=>void movePart(a,1)} title="Move down" className="border-2 border-black p-2 bg-white disabled:opacity-30"><ArrowDown className="w-3 h-3"/></button><button disabled={busy} onClick={()=>void removeArticleFromSeries(a)} title="Remove from series" className="border-2 border-black p-2 bg-red-100"><X className="w-3 h-3"/></button></div>}
              </div>
            </article>;
          })}
          {!filteredItems.length && <div className="p-12 text-center"><Layers className="w-8 h-8 mx-auto mb-3"/><div className="font-mono text-[10px] font-black uppercase">{search?'NO MATCHES':'NO PARTS IN THIS SERIES'}</div>{canManageParts && !search && <p className="text-sm mt-2 text-neutral-600">Turn on Manage Parts above to add the first article.</p>}</div>}
        </div>
      </section>

      <section className="mt-5 grid md:grid-cols-3 gap-3">
        <InfoCard icon={<ListChecks className="w-4 h-4"/>} title="Built as a path" text="Each part has an explicit position, progress state and direct reading action." />
        <InfoCard icon={<Sparkles className="w-4 h-4"/>} title="Resume anywhere" text="Your completion state is remembered on this device so you can pick up where you stopped." />
        <InfoCard icon={<ExternalLink className="w-4 h-4"/>} title="Shareable" text="Use the series URL to send readers to the full curriculum instead of a single article." />
      </section>
    </div>;
  }

  return <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-7">
    <header className="border-4 border-black bg-[var(--color-primary)] p-6 sm:p-9 neo-shadow-lg">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase"><Layers className="w-4 h-4"/> OFFSCRPT / SERIES LIBRARY</div>
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
        <div><h1 className="font-display font-black text-5xl sm:text-7xl uppercase leading-[0.9] mt-2">Series</h1><p className="max-w-2xl mt-4 text-sm sm:text-base">Structured reading paths for ideas that deserve more than one article.</p></div>
        <div className="grid grid-cols-3 gap-2 min-w-[260px]"><Stat label="SERIES" value={String(hydrated.length)} /><Stat label="PARTS" value={String(hydrated.reduce((n,s)=>n+s.items.length,0))}/><Stat label="READ TIME" value={`${hydrated.reduce((n,s)=>n+s.items.reduce((m,a)=>m+safeMinutes(a),0),0)}m`}/></div>
      </div>
    </header>
    {loading ? <div className="py-20 text-center font-mono text-xs">LOADING SERIES…</div> : error ? <div className="border-4 border-black bg-red-100 p-8 text-center"><div className="font-mono text-[10px] font-black uppercase">{error}</div><button onClick={()=>void load()} className="mt-4 border-2 border-black bg-white px-4 py-2 font-mono text-[10px] font-black">RETRY</button></div> : <div className="grid lg:grid-cols-2 gap-5">
      {hydrated.map(s=>{ const count=s.items.length||s.articleCount||0; const mins=s.items.reduce((n,a)=>n+safeMinutes(a),0)||s.estimatedMinutes||0; return <button key={s.id} onClick={()=>onNavigate('series',s.id)} className="group text-left border-4 border-black bg-white neo-shadow-sm hover:-translate-y-1 transition-transform overflow-hidden">
        {s.coverImage ? <div className="h-44 border-b-4 border-black overflow-hidden"><img src={s.coverImage} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" /></div> : <div className="h-28 border-b-4 border-black bg-[var(--color-secondary)] bg-grid-pattern" />}
        <div className="p-5"><div className="flex items-center gap-2 font-mono text-[9px] uppercase"><Layers className="w-3 h-3"/>{count} PARTS <span>•</span>{mins} MIN</div><h2 className="font-display font-black text-3xl uppercase mt-2">{s.title}</h2><p className="text-sm mt-2 text-neutral-700 line-clamp-3">{s.description}</p><div className="mt-5 flex items-center justify-between gap-3"><span className="font-mono text-[9px] uppercase">BY @{s.ownerUsername||'creator'}</span><span className="border-2 border-black bg-[var(--color-primary)] px-3 py-2 font-mono text-[9px] font-black">OPEN SERIES <ArrowRight className="inline w-3 h-3"/></span></div></div>
      </button>; })}
      {!hydrated.length && <div className="lg:col-span-2 border-4 border-dashed border-black p-12 text-center"><Layers className="w-10 h-10 mx-auto mb-3"/><div className="font-mono text-xs font-black uppercase">NO SERIES YET</div><p className="text-sm text-neutral-600 mt-2">Create a series from Admin Studio, then assign articles to build the curriculum.</p></div>}
    </div>}
  </div>;
};

const Stat = ({label,value}:{label:string;value:string}) => <div className="border-2 border-current px-3 py-2"><div className="font-mono text-[8px] uppercase opacity-70">{label}</div><div className="font-display font-black text-lg leading-none mt-1">{value}</div></div>;
const InfoCard = ({icon,title,text}:{icon:React.ReactNode;title:string;text:string}) => <div className="border-2 border-black bg-white p-4"><div className="flex items-center gap-2 font-mono text-[9px] uppercase font-black"><span className="border-2 border-black p-1 bg-[var(--color-primary)]">{icon}</span>{title}</div><p className="text-sm mt-3 text-neutral-600">{text}</p></div>;

const SeriesEditor: React.FC<{series: Series; busy:boolean; onSave:(patch:Partial<Series>)=>void; onDelete:()=>void; onClose:()=>void}> = ({series,busy,onSave,onDelete,onClose}) => {
  const [title,setTitle]=useState(series.title); const [slug,setSlug]=useState(series.slug); const [description,setDescription]=useState(series.description); const [cover,setCover]=useState(series.coverImage||''); const [tags,setTags]=useState((series.tags||[]).join(', ')); const [minutes,setMinutes]=useState(String(series.estimatedMinutes||''));
  useEffect(()=>{setTitle(series.title);setSlug(series.slug);setDescription(series.description);setCover(series.coverImage||'');setTags((series.tags||[]).join(', '));setMinutes(String(series.estimatedMinutes||''));},[series.id]);
  return <div className="mb-5 border-4 border-black bg-white p-4 sm:p-5 neo-shadow-sm">
    <div className="flex items-center justify-between gap-3 mb-4"><div><div className="font-mono text-[9px] uppercase">SERIES SETTINGS</div><h2 className="font-display font-black text-2xl uppercase">Edit this series</h2></div><button onClick={onClose} className="border-2 border-black p-2"><X className="w-4 h-4"/></button></div>
    <div className="grid md:grid-cols-2 gap-3">
      <label className="block md:col-span-2"><span className="font-mono text-[9px] uppercase font-black">Title</span><input value={title} onChange={e=>setTitle(e.target.value)} className="w-full mt-1 border-2 border-black p-3" /></label>
      <label className="block"><span className="font-mono text-[9px] uppercase font-black">Slug</span><input value={slug} onChange={e=>setSlug(slugify(e.target.value))} className="w-full mt-1 border-2 border-black p-3 font-mono text-xs" /></label>
      <label className="block"><span className="font-mono text-[9px] uppercase font-black">Estimated minutes</span><input type="number" min="0" value={minutes} onChange={e=>setMinutes(e.target.value)} className="w-full mt-1 border-2 border-black p-3 font-mono text-xs" /></label>
      <label className="block md:col-span-2"><span className="font-mono text-[9px] uppercase font-black">Description</span><textarea rows={4} value={description} onChange={e=>setDescription(e.target.value)} className="w-full mt-1 border-2 border-black p-3" /></label>
      <label className="block md:col-span-2"><span className="font-mono text-[9px] uppercase font-black">Cover image URL</span><input value={cover} onChange={e=>setCover(e.target.value)} className="w-full mt-1 border-2 border-black p-3 font-mono text-xs" /></label>
      <label className="block md:col-span-2"><span className="font-mono text-[9px] uppercase font-black">Tags</span><input value={tags} onChange={e=>setTags(e.target.value)} placeholder="react, javascript, web-dev" className="w-full mt-1 border-2 border-black p-3 font-mono text-xs" /></label>
    </div>
    <div className="mt-4 flex flex-wrap justify-between gap-2"><button disabled={busy} onClick={onDelete} className="border-2 border-black bg-red-100 px-3 py-2 font-mono text-[9px] font-black inline-flex items-center gap-2"><Trash2 className="w-3 h-3"/> DELETE SERIES</button><div className="flex gap-2"><button onClick={onClose} className="border-2 border-black bg-white px-3 py-2 font-mono text-[9px] font-black">CANCEL</button><button disabled={busy || !title.trim() || !slug.trim()} onClick={()=>onSave({title:title.trim(),slug:slug.trim(),description:description.trim(),coverImage:cover.trim()||undefined,tags:tags.split(',').map(x=>x.trim()).filter(Boolean).slice(0,20),estimatedMinutes:minutes?Number(minutes):undefined})} className="border-2 border-black bg-black text-white px-4 py-2 font-mono text-[9px] font-black inline-flex items-center gap-2"><Save className="w-3 h-3"/> {busy?'SAVING…':'SAVE CHANGES'}</button></div></div>
  </div>;
};
