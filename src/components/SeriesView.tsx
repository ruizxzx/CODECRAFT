import { ShareMenu } from './ShareMenu';
import React, { useEffect, useMemo, useState } from 'react';
import { Article, Series } from '../types';
import { deleteSeries, getSeriesList, reorderSeriesArticles, setArticleSeriesMembership, updateSeries, toggleSeriesFollow, getSeriesFollowStatus, subscribeSeriesList, subscribeSeriesFollowerCount } from '../lib/series';
import { auth, checkIsAdmin } from '../lib/firebase';
import { useAuthUser } from '../lib/useAuthUser';
import { UserIdentity } from './UserIdentity';
import { calculateArticleReadingTime, getSeriesReadingProgress, getSeriesDerivedStats, ArticleReadingProgress, subscribeSeriesReadingProgress } from '../lib/reading';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BookOpen, Check, ChevronDown, ChevronUp,
  Edit3, ExternalLink, Filter, Layers, ListChecks, Play, Save, Search, Settings2,
  Share2, Sparkles, Trash2, X, Clock3, CircleCheck, Bookmark, Printer, Download,
  RotateCcw, SlidersHorizontal, Users, Zap, CalendarDays
} from 'lucide-react';

interface Props { articles: Article[]; onNavigate: (page: any, param?: string) => void; selectedSeriesId?: string | null; }
type SortMode = 'order' | 'newest' | 'shortest' | 'longest';
type LibrarySort = 'updated' | 'title' | 'parts' | 'time';
const safeMinutes = (a: Article) => calculateArticleReadingTime(a);
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0,80);
const formatDuration = (minutes:number) => minutes >= 60 ? `${Math.floor(minutes/60)}h ${minutes%60}m` : `${minutes}m`;

export const SeriesView: React.FC<Props> = ({ articles, onNavigate, selectedSeriesId }) => {
  const [series, setSeries] = useState<Series[]>([]);
  const user = useAuthUser();
  const [loading, setLoading] = useState(true);
  const [librarySearch, setLibrarySearch] = useState('');
  const [librarySort, setLibrarySort] = useState<LibrarySort>('updated');
  const [tagFilter, setTagFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('order');
  const [filterOpen, setFilterOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [managingParts, setManagingParts] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Record<string, ArticleReadingProgress>>({});
  const [followed, setFollowed] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [partsOpen, setPartsOpen] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setSeries(await getSeriesList(100)); setError(null); }
    catch (e:any) { setError(e?.message || 'Could not load series.'); }
    finally { setLoading(false); }
  };
  useEffect(() => subscribeSeriesList(items => { setSeries(items); setLoading(false); }), []);
  useEffect(() => { if (!series.length && loading) void load(); }, [series.length, loading]);

  const hydrated = useMemo(() => series.map(s => ({ ...s, items: articles.filter(a => a.seriesId === s.id || a.seriesId === s.slug).sort((a,b)=>(a.seriesOrder??999999)-(b.seriesOrder??999999)) })), [series, articles]);
  const allTags = useMemo((): string[] => Array.from(new Set<string>(hydrated.flatMap(s => s.tags || []))).sort((a,b)=>a.localeCompare(b)), [hydrated]);
  const active = selectedSeriesId ? hydrated.find(s => s.id === selectedSeriesId || s.slug === selectedSeriesId) : null;
  const canEditSeries = !!active && !!user && (active.ownerId === user.uid || checkIsAdmin(user.email));
  const canManageParts = !!user && checkIsAdmin(user.email);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    setProgress({});
    getSeriesReadingProgress(active.items).then(p => { if (alive) setProgress(p); }).catch(()=>{});
    const unsubProgress = subscribeSeriesReadingProgress(active.items, p => alive && setProgress(p));
    if (user) { getSeriesFollowStatus(active.id, user.uid).then(v=>alive&&setFollowed(v)).catch(()=>setFollowed(false)); } else setFollowed(false);
    const unsubFollowers = subscribeSeriesFollowerCount(active.id, v=>alive&&setFollowers(v));
    return () => { alive = false; unsubFollowers(); unsubProgress(); };
  }, [active?.id, active?.items.length, user?.uid]);

  const computedLibrary = useMemo(() => {
    const q = librarySearch.trim().toLowerCase();
    const filtered = hydrated.filter(s => {
      const matchesText = !q || `${s.title} ${s.description} ${(s.tags||[]).join(' ')} ${s.ownerUsername||''}`.toLowerCase().includes(q);
      const matchesTag = tagFilter === 'ALL' || (s.tags||[]).includes(tagFilter);
      return matchesText && matchesTag;
    });
    return [...filtered].sort((a,b)=> {
      if (librarySort==='title') return a.title.localeCompare(b.title);
      if (librarySort==='parts') return b.items.length-a.items.length;
      if (librarySort==='time') return getSeriesDerivedStats(b.items).minutes-getSeriesDerivedStats(a.items).minutes;
      return new Date(b.updatedAt||0).getTime()-new Date(a.updatedAt||0).getTime();
    });
  }, [hydrated, librarySearch, tagFilter, librarySort]);

  const filteredItems = useMemo(() => {
    if (!active) return [];
    const q=search.trim().toLowerCase();
    let list=active.items.filter(a=>!q||`${a.title} ${a.excerpt} ${(a.tags||[]).join(' ')}`.toLowerCase().includes(q));
    if (onlyIncomplete) list=list.filter(a=>!progress[a.slug]?.completed);
    if (sortMode==='newest') list=[...list].sort((a,b)=>new Date(b.publishedAt||0).getTime()-new Date(a.publishedAt||0).getTime());
    if (sortMode==='shortest') list=[...list].sort((a,b)=>safeMinutes(a)-safeMinutes(b));
    if (sortMode==='longest') list=[...list].sort((a,b)=>safeMinutes(b)-safeMinutes(a));
    return list;
  }, [active, search, sortMode, onlyIncomplete, progress]);

  const refreshProgress = async () => { if (active) setProgress(await getSeriesReadingProgress(active.items)); };
  const showNotice = (message:string) => { setNotice(message); window.setTimeout(()=>setNotice(null),2200); };
  const copyUrl = async () => { if (!active) return; const url=`${window.location.origin}${window.location.pathname}#series/${active.id}`; try { await navigator.clipboard.writeText(url); showNotice('SERIES LINK COPIED'); } catch { showNotice(url); } };
  const copyOutline = async () => { if (!active) return; const text=[active.title,'',active.description,'',...active.items.map((a,i)=>`${String(i+1).padStart(2,'0')}. ${a.title} — ${safeMinutes(a)} min`)].join('\n'); try { await navigator.clipboard.writeText(text); showNotice('SERIES OUTLINE COPIED'); } catch {} };
  const printSeries = () => window.print();
  const downloadOutline = () => { if(!active) return; const text=[active.title,active.description,'',...active.items.map((a,i)=>`${i+1}. ${a.title}\n${a.excerpt}`)].join('\n\n'); const blob=new Blob([text],{type:'text/plain'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`${slugify(active.title)}-outline.txt`; a.click(); URL.revokeObjectURL(url); };
  const toggleFollow = async () => { if (!user || !active) return; setBusy(true); try { const next=await toggleSeriesFollow(active.id,user.uid); setFollowed(next); setFollowers(v=>Math.max(0,v+(next?1:-1))); showNotice(next?'SERIES SAVED TO YOUR LIBRARY':'SERIES REMOVED FROM YOUR LIBRARY'); } catch(e:any){setError(e?.message||'Could not update series follow.');} finally{setBusy(false);} };

  const movePart = async (article:Article,direction:-1|1) => { if(!active||!canManageParts||busy)return; const ordered=[...active.items]; const i=ordered.findIndex(x=>x.slug===article.slug); const t=i+direction; if(i<0||t<0||t>=ordered.length)return; [ordered[i],ordered[t]]=[ordered[t],ordered[i]]; setBusy(true); try{await reorderSeriesArticles(active.id,active.title,ordered);showNotice('SERIES ORDER SAVED');await load();}catch(e:any){setError(e?.message||'Could not save series order.');}finally{setBusy(false);} };
  const setSeriesMetadata = async (patch:Partial<Series>) => { if(!active||!canEditSeries||busy)return; setBusy(true); try{await updateSeries(active.id,patch);setSeries(prev=>prev.map(s=>s.id===active.id?{...s,...patch}:s));setEditing(false);showNotice('SERIES UPDATED');}catch(e:any){setError(e?.message||'Could not update series.');}finally{setBusy(false);} };
  const addArticleToSeries = async (slug:string) => { if(!active||!canManageParts||busy)return; setBusy(true); try{await setArticleSeriesMembership(slug,active.id,active.title,active.items.length+1);showNotice('ARTICLE ADDED');await load();}catch(e:any){setError(e?.message||'Could not add article.');}finally{setBusy(false);} };
  const removeArticleFromSeries = async (article:Article) => { if(!active||!canManageParts||busy)return; if(!window.confirm(`Remove “${article.title}” from this series? The article remains published.`))return; setBusy(true); try{await setArticleSeriesMembership(article.slug);showNotice('ARTICLE REMOVED');await load();}catch(e:any){setError(e?.message||'Could not remove article.');}finally{setBusy(false);} };
  const removeSeries = async () => { if(!active||!canEditSeries||busy)return; if(!window.confirm(`Delete “${active.title}”? Articles will remain published.`))return; setBusy(true); try{await deleteSeries(active.id);onNavigate('series');await load();}catch(e:any){setError(e?.message||'Could not delete series.');}finally{setBusy(false);} };

  useEffect(() => { if(!active)return; const onKey=(e:KeyboardEvent)=>{ if(['INPUT','TEXTAREA'].includes((e.target as HTMLElement)?.tagName||''))return; if(e.key.toLowerCase()==='r') startOrResume(); if(e.key.toLowerCase()==='f'&&user) void toggleFollow(); }; window.addEventListener('keydown',onKey); return()=>window.removeEventListener('keydown',onKey); });
  const startOrResume = () => {
    if (!active) return;
    const next = active.items.find(a => (progress[a.slug]?.percent || 0) > 0 && !progress[a.slug]?.completed)
      || active.items.find(a => !progress[a.slug]?.completed)
      || active.items[0];
    if (next) onNavigate('article', next.slug);
  };

  if (active) {
    const stats=getSeriesDerivedStats(active.items);
    const completedCount=active.items.filter(a=>progress[a.slug]?.completed).length;
    const overallPct=stats.parts ? Math.round(active.items.reduce((sum,a)=>sum + Math.max(0, Math.min(100, Number(progress[a.slug]?.percent || 0))),0) / stats.parts) : 0;
    const remainingParts=Math.max(0,stats.parts-completedCount);
    const remainingMinutes=active.items.filter(a=>!progress[a.slug]?.completed).reduce((n,a)=>n+Math.max(0, Math.round(safeMinutes(a) * (1-(Number(progress[a.slug]?.percent||0)/100)))),0);
    const creatorName=active.ownerName||'Creator';
    const availableToAdd=canManageParts?articles.filter(a=>!active.items.some(x=>x.slug===a.slug)):[];
    return <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 print:max-w-none">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 print:hidden">
        <button onClick={()=>onNavigate('series')} className="border-2 border-black px-3 py-2 font-mono text-[10px] font-black bg-white hover:bg-[var(--color-primary)] inline-flex items-center gap-2"><ArrowLeft className="w-3 h-3"/> SERIES LIBRARY</button>
        <div className="flex flex-wrap gap-2">
          <button onClick={startOrResume} className="border-2 border-black px-3 py-2 font-mono text-[10px] font-black bg-black text-white inline-flex items-center gap-2"><Play className="w-3 h-3"/> {completedCount?'RESUME':'START'} SERIES</button>
          <button disabled={!user||busy} onClick={()=>void toggleFollow()} className={`border-2 border-black px-3 py-2 font-mono text-[10px] font-black inline-flex items-center gap-2 ${followed?'bg-[var(--color-primary)]':'bg-white hover:bg-[var(--color-primary)]'}`}><Bookmark className={`w-3 h-3 ${followed?'fill-current':''}`}/>{followed?'SAVED':'SAVE SERIES'}</button>
          <ShareMenu target={{type:'series',slug:active.slug}} title={active.title} />

          <button onClick={copyOutline} className="border-2 border-black px-3 py-2 font-mono text-[10px] font-black bg-white hidden sm:inline-flex items-center gap-2"><Download className="w-3 h-3"/> OUTLINE</button>
          <button onClick={printSeries} className="border-2 border-black px-3 py-2 font-mono text-[10px] font-black bg-white hidden sm:inline-flex items-center gap-2"><Printer className="w-3 h-3"/> PRINT</button>
          {canEditSeries&&<button onClick={()=>setEditing(v=>!v)} className="border-2 border-black px-3 py-2 font-mono text-[10px] font-black bg-white hover:bg-[var(--color-primary)] inline-flex items-center gap-2"><Edit3 className="w-3 h-3"/> EDIT</button>}
          {canManageParts&&<button onClick={()=>setManagingParts(v=>!v)} className={`border-2 border-black px-3 py-2 font-mono text-[10px] font-black inline-flex items-center gap-2 ${managingParts?'bg-black text-white':'bg-white'}`}><Settings2 className="w-3 h-3"/> MANAGE PARTS</button>}
        </div>
      </div>
      {notice&&<div className="mb-4 border-2 border-black bg-[var(--color-primary)] p-3 font-mono text-[10px] font-black uppercase" role="status">{notice}</div>}
      {error&&<div className="mb-4 border-2 border-black bg-red-100 p-3 font-mono text-[10px] font-black uppercase" role="alert">{error}</div>}
      {editing&&<SeriesEditor series={active} busy={busy} onSave={setSeriesMetadata} onDelete={removeSeries} onClose={()=>setEditing(false)}/>}      

      <section className="relative overflow-hidden border-4 border-black bg-black text-white neo-shadow-lg">
        {active.coverImage&&<img src={active.coverImage} alt={active.coverImageAlt||active.title} className="absolute inset-0 w-full h-full object-cover opacity-30"/>}
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/90 to-black/55"/>
        <div className="relative p-6 sm:p-10 lg:p-12">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-[var(--color-primary)] uppercase font-black"><span className="border border-[var(--color-primary)] px-2 py-1">SERIES</span><span>{stats.parts} PARTS</span><span>•</span><span>{formatDuration(stats.minutes)}</span><span>•</span><span>{followers} FOLLOWERS</span></div>
          <h1 className="font-display font-black text-4xl sm:text-6xl lg:text-7xl uppercase tracking-tight mt-3 max-w-5xl">{active.title}</h1>
          <p className="mt-4 max-w-3xl text-base sm:text-lg text-neutral-200 leading-relaxed">{active.description}</p>
          <div className="mt-5 max-w-sm"><UserIdentity name={creatorName} username={active.ownerUsername} uid={active.ownerId} size="md"/></div>
          <div className="mt-7 max-w-3xl border-2 border-white/40 p-4 bg-black/30">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase"><span>{completedCount}/{stats.parts} parts completed</span><span>{overallPct}% read</span></div>
            <div className="h-4 border-2 border-white mt-2 bg-white/10"><div className="h-full bg-[var(--color-primary)]" style={{width:`${overallPct}%`}}/></div>
            <div className="mt-3 flex flex-wrap gap-2 font-mono text-[10px] uppercase text-neutral-300"><span>{remainingParts} parts left</span><span>•</span><span>{formatDuration(remainingMinutes)} remaining</span><span>•</span><span>{overallPct===100?'SERIES COMPLETE':'AUTO PROGRESS · CLOUD SYNC'}</span></div>
          </div>
          {active.tags?.length?<div className="mt-5 flex flex-wrap gap-2">{active.tags.map(tag=><span key={tag} className="border border-white/60 px-2 py-1 font-mono text-[9px] uppercase">#{tag}</span>)}</div>:null}
        </div>
      </section>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
        <Metric icon={<Layers/>} label="PARTS" value={String(stats.parts)} />
        <Metric icon={<Clock3/>} label="TOTAL READ" value={formatDuration(stats.minutes)} />
        <Metric icon={<CircleCheck/>} label="PROGRESS" value={`${overallPct}%`} />
        <Metric icon={<Users/>} label="FOLLOWERS" value={String(followers)} />
      </div>

      {completedCount===stats.parts&&stats.parts>0&&<div className="mt-4 border-4 border-black bg-[var(--color-success)] p-5 neo-shadow"><div className="flex items-center gap-2 font-display font-black text-2xl uppercase"><Sparkles className="w-5 h-5"/> SERIES COMPLETE</div><p className="font-mono text-xs uppercase mt-2">Every part is explicitly completed. Your progress is synced to your account.</p></div>}
      {overallPct > 0 && overallPct < 100 && <div className="mt-4 border-2 border-black bg-white p-4 font-mono text-[10px] uppercase"><strong>HOW PROGRESS WORKS:</strong> scrolling updates each article's reading percentage automatically. Use <strong>MARK AS COMPLETE</strong> at the end of an article when you are done. Your progress follows your account across devices.</div>}

      <section className="mt-5 border-4 border-black bg-white neo-shadow print:shadow-none">
        <div className="border-b-2 border-black p-4 flex flex-wrap items-center justify-between gap-3">
          <div><div className="font-display font-black text-2xl uppercase">Curriculum</div><div className="font-mono text-[10px] text-neutral-500 uppercase">Search, filter, resume, complete</div></div>
          <div className="flex flex-wrap gap-2">
            <label className="border-2 border-black px-3 py-2 flex items-center gap-2"><Search className="w-3 h-3"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="SEARCH PARTS" className="outline-none font-mono text-[10px] w-32 bg-transparent"/></label>
            <button onClick={()=>setFilterOpen(v=>!v)} className="border-2 border-black px-3 py-2 font-mono text-[10px] font-black inline-flex items-center gap-2"><SlidersHorizontal className="w-3 h-3"/> FILTER <span className="text-[9px]">{filterOpen?'−':'+'}</span></button>
            <button onClick={()=>setPartsOpen(v=>!v)} className="border-2 border-black px-3 py-2 font-mono text-[10px] font-black inline-flex items-center gap-2">{partsOpen?<ChevronUp className="w-3 h-3"/>:<ChevronDown className="w-3 h-3"/>} {partsOpen?'COLLAPSE':'EXPAND'}</button>
          </div>
        </div>
        {filterOpen&&<div className="border-b-2 border-black p-3 bg-neutral-50 flex flex-wrap gap-2 print:hidden">
          {(['order','newest','shortest','longest'] as SortMode[]).map(v=><button key={v} onClick={()=>setSortMode(v)} className={`border-2 border-black px-3 py-2 font-mono text-[9px] font-black uppercase ${sortMode===v?'bg-[var(--color-primary)]':'bg-white'}`}>{v}</button>)}
          <button onClick={()=>setOnlyIncomplete(v=>!v)} className={`border-2 border-black px-3 py-2 font-mono text-[9px] font-black uppercase ${onlyIncomplete?'bg-[var(--color-success)]':'bg-white'}`}>{onlyIncomplete?'SHOWING INCOMPLETE':'ALL PARTS'}</button>
          <button onClick={()=>{setSearch('');setOnlyIncomplete(false);setSortMode('order');}} className="border-2 border-black px-3 py-2 font-mono text-[9px] font-black bg-white"><RotateCcw className="inline w-3 h-3 mr-1"/> RESET</button>
        </div>}
        {partsOpen&&<div className="divide-y-2 divide-black">
          {filteredItems.map((a,displayIndex)=>{ const actualIndex=active.items.findIndex(x=>x.slug===a.slug); const p=progress[a.slug]; const done=!!p?.completed; return <article key={a.slug} className={`p-4 sm:p-5 flex gap-4 ${done?'bg-neutral-50':''}`}>
            <div className="w-10 h-10 sm:w-12 sm:h-12 border-2 border-black bg-[var(--color-primary)] grid place-items-center font-display font-black shrink-0 text-lg">{String(actualIndex+1).padStart(2,'0')}</div>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase text-neutral-500"><span>{safeMinutes(a)} MIN</span><span>•</span><span>{a.category}</span>{done&&<span className="border-2 border-black bg-[var(--color-success)] text-black px-1.5 py-0.5 font-black">COMPLETED</span>}</div><h3 className="font-display font-black text-xl sm:text-2xl uppercase mt-1">{a.title}</h3>{a.excerpt&&<p className="text-sm mt-1 text-neutral-600 max-w-3xl">{a.excerpt}</p>}
              <div className="mt-3 h-2 border-2 border-black bg-white max-w-2xl"><div className="h-full bg-[var(--color-secondary)]" style={{width:`${p?.percent||0}%`}}/></div>
              <div className="mt-2 flex flex-wrap gap-2"><button onClick={()=>onNavigate('article',a.slug)} className="border-2 border-black bg-black text-white px-3 py-2 font-mono text-[9px] font-black inline-flex items-center gap-2 hover:bg-[var(--color-primary)] hover:text-black"><BookOpen className="w-3 h-3"/> {p?.percent?'CONTINUE':'READ PART'}</button>{p?.percent&&<span className="border-2 border-black px-3 py-2 font-mono text-[9px] font-black">{p.percent}% READ</span>}{a.tags?.slice(0,3).map(tag=><span key={tag} className="border border-black px-2 py-1 font-mono text-[8px] uppercase">#{tag}</span>)}</div>
            </div>
            {managingParts&&canManageParts&&<div className="shrink-0 flex flex-col gap-1 print:hidden"><button disabled={busy||actualIndex===0} onClick={()=>void movePart(a,-1)} title="Move up" className="border-2 border-black p-2 bg-white disabled:opacity-30"><ArrowUp className="w-3 h-3"/></button><button disabled={busy||actualIndex===active.items.length-1} onClick={()=>void movePart(a,1)} title="Move down" className="border-2 border-black p-2 bg-white disabled:opacity-30"><ArrowDown className="w-3 h-3"/></button><button disabled={busy} onClick={()=>void removeArticleFromSeries(a)} title="Remove from series" className="border-2 border-black p-2 bg-red-100"><X className="w-3 h-3"/></button></div>}
          </article>;})}
          {!filteredItems.length&&<div className="p-12 text-center"><Layers className="w-8 h-8 mx-auto mb-3"/><div className="font-mono text-[10px] font-black uppercase">NO MATCHES</div></div>}
        </div>}
      </section>

      {managingParts&&canManageParts&&<section className="mt-4 border-4 border-black bg-white p-4 sm:p-5 neo-shadow print:hidden"><div className="font-display font-black uppercase text-xl">Add a part</div><p className="font-mono text-[10px] text-neutral-500 mt-1 uppercase">Choose an existing published article. The article stays intact; only its series membership changes.</p><div className="mt-3 flex flex-wrap gap-2">{availableToAdd.slice(0,20).map(a=><button key={a.slug} disabled={busy} onClick={()=>void addArticleToSeries(a.slug)} className="border-2 border-black px-3 py-2 bg-white hover:bg-[var(--color-primary)] text-left"><span className="block font-display font-black text-sm uppercase">{a.title}</span><span className="block font-mono text-[8px] mt-1">{safeMinutes(a)} MIN · {a.category}</span></button>)}{!availableToAdd.length&&<div className="font-mono text-[10px] uppercase text-neutral-500">No available articles.</div>}</div></section>}

      <div className="mt-6 flex justify-center print:hidden"><button onClick={()=>onNavigate('series')} className="border-2 border-black bg-[var(--color-primary)] px-5 py-3 font-mono text-[10px] font-black uppercase inline-flex items-center gap-2 hover:bg-black hover:text-white transition-colors"><Layers className="w-4 h-4"/> VIEW ALL SERIES</button></div>

      <div className="mt-5 grid md:grid-cols-3 gap-3 print:hidden"><InfoCard icon={<Zap/>} title="Keyboard" text="Press R to resume the next unfinished part. Press F to save or unsave the series when signed in."/><InfoCard icon={<CloudIcon/>} title="Cloud synced" text="Completion and reading checkpoints are stored per account, not only in this browser."/><InfoCard icon={<ExternalLink/>} title="Shareable path" text="Send one URL for the whole curriculum; each part remains individually addressable."/></div>
    </div>;
  }

  return <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6">
    <header className="border-4 border-black bg-[var(--color-primary)] p-6 sm:p-9 neo-shadow-lg"><div className="flex items-center gap-2 font-mono text-[10px] uppercase"><Layers className="w-4 h-4"/> OFFSCRPT / SERIES LIBRARY</div><div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5"><div><h1 className="font-display font-black text-5xl sm:text-7xl uppercase leading-[0.9] mt-2">Series</h1><p className="max-w-2xl mt-4 text-sm sm:text-base">Structured reading paths for ideas that deserve more than one article.</p></div><div className="grid grid-cols-3 gap-2 min-w-[260px]"><Stat label="SERIES" value={String(hydrated.length)}/><Stat label="PARTS" value={String(hydrated.reduce((n,s)=>n+s.items.length,0))}/><Stat label="READ TIME" value={formatDuration(hydrated.reduce((n,s)=>n+getSeriesDerivedStats(s.items).minutes,0))}/></div></div></header>
    <div className="border-4 border-black bg-white p-3 neo-shadow-sm flex flex-wrap gap-2"><label className="border-2 border-black px-3 py-2 flex items-center gap-2 flex-1 min-w-[220px]"><Search className="w-4 h-4"/><input value={librarySearch} onChange={e=>setLibrarySearch(e.target.value)} placeholder="SEARCH SERIES, AUTHORS, TOPICS" className="outline-none font-mono text-xs w-full"/></label><select value={librarySort} onChange={e=>setLibrarySort(e.target.value as LibrarySort)} className="border-2 border-black px-3 py-2 font-mono text-[10px] font-black bg-white"><option value="updated">LATEST UPDATED</option><option value="title">TITLE A-Z</option><option value="parts">MOST PARTS</option><option value="time">LONGEST READ</option></select><select value={tagFilter} onChange={e=>setTagFilter(e.target.value)} className="border-2 border-black px-3 py-2 font-mono text-[10px] font-black bg-white"><option value="ALL">ALL TOPICS</option>{allTags.map(t=><option key={t} value={t}>{t.toUpperCase()}</option>)}</select></div>
    {loading?<div className="py-20 text-center font-mono text-xs uppercase">SYNCHRONIZING SERIES…</div>:error?<div className="border-4 border-black bg-red-100 p-8 text-center"><div className="font-mono text-[10px] font-black uppercase">{error}</div><button onClick={()=>void load()} className="mt-4 border-2 border-black bg-white px-4 py-2 font-mono text-[10px] font-black">RETRY</button></div>:<div className="grid lg:grid-cols-2 gap-5">{computedLibrary.map(s=>{const stats=getSeriesDerivedStats(s.items);return <button key={s.id} onClick={()=>onNavigate('series',s.id)} className="group text-left border-4 border-black bg-white neo-shadow-sm hover:-translate-y-1 transition-transform overflow-hidden">{s.coverImage?<div className="h-48 border-b-4 border-black overflow-hidden"><img src={s.coverImage} alt={s.coverImageAlt||s.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform"/></div>:<div className="h-28 border-b-4 border-black bg-[var(--color-secondary)] bg-grid-pattern"/>}<div className="p-5"><div className="flex items-center gap-2 font-mono text-[9px] uppercase"><Layers className="w-3 h-3"/>{stats.parts} PARTS<span>•</span>{formatDuration(stats.minutes)}</div><h2 className="font-display font-black text-3xl uppercase mt-2">{s.title}</h2><p className="text-sm mt-2 text-neutral-700 line-clamp-3">{s.description}</p><div className="mt-4 flex flex-wrap gap-2">{(s.tags||[]).slice(0,4).map(t=><span key={t} className="border border-black px-2 py-1 font-mono text-[8px] uppercase">#{t}</span>)}</div><div className="mt-5 flex items-center justify-between gap-3"><UserIdentity name={s.ownerName||'Creator'} username={s.ownerUsername} uid={s.ownerId} size="sm"/><span className="border-2 border-black bg-[var(--color-primary)] px-3 py-2 font-mono text-[9px] font-black">OPEN SERIES <ArrowRight className="inline w-3 h-3"/></span></div></div></button>})}{!computedLibrary.length&&<div className="lg:col-span-2 border-4 border-dashed border-black p-12 text-center"><Layers className="w-10 h-10 mx-auto mb-3"/><div className="font-mono text-xs font-black uppercase">NO SERIES MATCHED</div></div>}</div>}
  </div>;
};

const CloudIcon=()=> <span className="text-lg">☁</span>;
const Stat=({label,value}:{label:string;value:string})=><div className="border-2 border-current px-3 py-2"><div className="font-mono text-[8px] uppercase opacity-70">{label}</div><div className="font-display font-black text-lg leading-none mt-1">{value}</div></div>;
const Metric=({icon,label,value}:{icon:React.ReactNode;label:string;value:string})=><div className="border-2 border-black bg-white p-4"><div className="flex items-center gap-2 font-mono text-[9px] uppercase font-black"><span className="border-2 border-black p-1 bg-[var(--color-primary)]">{icon}</span>{label}</div><div className="font-display font-black text-3xl uppercase mt-2">{value}</div></div>;
const InfoCard=({icon,title,text}:{icon:React.ReactNode;title:string;text:string})=><div className="border-2 border-black bg-white p-4"><div className="flex items-center gap-2 font-mono text-[9px] uppercase font-black"><span className="border-2 border-black p-1 bg-[var(--color-primary)]">{icon}</span>{title}</div><p className="text-sm mt-3 text-neutral-600">{text}</p></div>;
const SeriesEditor:React.FC<{series:Series;busy:boolean;onSave:(patch:Partial<Series>)=>void;onDelete:()=>void;onClose:()=>void}>=({series,busy,onSave,onDelete,onClose})=>{const [title,setTitle]=useState(series.title),[slug,setSlug]=useState(series.slug),[description,setDescription]=useState(series.description),[cover,setCover]=useState(series.coverImage||''),[tags,setTags]=useState((series.tags||[]).join(', ')),[minutes,setMinutes]=useState(String(series.estimatedMinutes||''));useEffect(()=>{setTitle(series.title);setSlug(series.slug);setDescription(series.description);setCover(series.coverImage||'');setTags((series.tags||[]).join(', '));setMinutes(String(series.estimatedMinutes||''));},[series.id]);return <div className="mb-5 border-4 border-black bg-white p-4 sm:p-5 neo-shadow-sm print:hidden"><div className="flex items-center justify-between gap-3 mb-4"><div><div className="font-mono text-[9px] uppercase">SERIES SETTINGS</div><h2 className="font-display font-black text-2xl uppercase">Edit series</h2></div><button onClick={onClose} className="border-2 border-black p-2"><X className="w-4 h-4"/></button></div><div className="grid md:grid-cols-2 gap-3"><label className="block md:col-span-2"><span className="font-mono text-[9px] uppercase font-black">Title</span><input value={title} onChange={e=>setTitle(e.target.value)} className="w-full mt-1 border-2 border-black p-3"/></label><label className="block"><span className="font-mono text-[9px] uppercase font-black">Slug</span><input value={slug} onChange={e=>setSlug(slugify(e.target.value))} className="w-full mt-1 border-2 border-black p-3 font-mono text-xs"/></label><label className="block"><span className="font-mono text-[9px] uppercase font-black">Optional manual estimate</span><input type="number" min="0" value={minutes} onChange={e=>setMinutes(e.target.value)} className="w-full mt-1 border-2 border-black p-3 font-mono text-xs"/></label><label className="block md:col-span-2"><span className="font-mono text-[9px] uppercase font-black">Description</span><textarea rows={4} value={description} onChange={e=>setDescription(e.target.value)} className="w-full mt-1 border-2 border-black p-3"/></label><label className="block md:col-span-2"><span className="font-mono text-[9px] uppercase font-black">Cover image URL</span><input value={cover} onChange={e=>setCover(e.target.value)} className="w-full mt-1 border-2 border-black p-3 font-mono text-xs"/></label><label className="block md:col-span-2"><span className="font-mono text-[9px] uppercase font-black">Tags</span><input value={tags} onChange={e=>setTags(e.target.value)} placeholder="react, javascript, web-dev" className="w-full mt-1 border-2 border-black p-3 font-mono text-xs"/></label></div><div className="mt-4 flex flex-wrap justify-between gap-2"><button disabled={busy} onClick={onDelete} className="border-2 border-black bg-red-100 px-3 py-2 font-mono text-[9px] font-black inline-flex items-center gap-2"><Trash2 className="w-3 h-3"/> DELETE SERIES</button><div className="flex gap-2"><button onClick={onClose} className="border-2 border-black bg-white px-3 py-2 font-mono text-[9px] font-black">CANCEL</button><button disabled={busy||!title.trim()||!slug.trim()} onClick={()=>onSave({title:title.trim(),slug:slug.trim(),description:description.trim(),coverImage:cover.trim()||undefined,tags:tags.split(',').map(x=>x.trim()).filter(Boolean).slice(0,20),estimatedMinutes:minutes?Number(minutes):undefined})} className="border-2 border-black bg-black text-white px-4 py-2 font-mono text-[9px] font-black inline-flex items-center gap-2"><Save className="w-3 h-3"/> {busy?'SAVING…':'SAVE CHANGES'}</button></div></div></div>};
