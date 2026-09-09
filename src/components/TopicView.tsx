import { ShareMenu } from './ShareMenu';
import React, { useEffect, useMemo, useState } from 'react';
import { Article, CommunityPost, PageView, Series } from '../types';
import { getPosts } from '../lib/community';
import { getSeriesList } from '../lib/series';
import { ArrowRight, Hash, Layers, MessageSquare, Search, TrendingUp, Bookmark } from 'lucide-react';
import { useAuthUser } from '../lib/useAuthUser';
import { getTopicFollowStatus, followTopic } from '../lib/personalization';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { notifyToast } from '../lib/toast';

interface Props {
  slug: string;
  articles: Article[];
  onNavigate: (page: PageView, param?: string) => void;
}

const norm=(s:string)=>s.toLowerCase().trim().replace(/^#/,'');
const tagsForArticle=(a:Article)=> (a.tags||[]).map(norm);
const tagsForSeries=(s:Series)=> (s.tags||[]).map(norm);
const tagsForPost=(p:CommunityPost)=> [...(p.hashtags||[]),...(p.tags||[])].map(norm);
const safeDate=(s?:string)=>new Date(s||0).getTime()||0;

export const TopicView:React.FC<Props>=({slug,articles,onNavigate})=>{
  const topic=norm(slug);
  const [posts,setPosts]=useState<CommunityPost[]>([]);
  const [series,setSeries]=useState<Series[]>([]);
  const [loading,setLoading]=useState(true);
  const [query,setQuery]=useState('');
  const [sort,setSort]=useState<'relevance'|'latest'>('relevance');
  const user=useAuthUser();
  const [followed,setFollowed]=useState(false);
  const [followBusy,setFollowBusy]=useState(false);
  const [followers,setFollowers]=useState(0);
  useEffect(()=>{let a=true;if(!user){setFollowed(false);} else { getTopicFollowStatus(topic).then(v=>a&&setFollowed(v)).catch((error) => console.warn('OFFSCRPT recoverable operation failed:', error));} getDoc(doc(db,'topics',topic)).then(s=>a&&setFollowers(Number(s.data()?.followersCount||0))).catch((error) => console.warn('OFFSCRPT recoverable operation failed:', error)); return()=>{a=false}},[topic,user?.uid]);
  /**/
  const toggleFollow=async()=>{if(!user){notifyToast('Sign in to follow topics.','info');return}setFollowBusy(true);try{const next=await followTopic(topic);setFollowed(next);notifyToast(next?`Following #${topic}.`:`Unfollowed #${topic}.`,'success')}catch(e:any){notifyToast(e?.message||'Could not update topic follow.','error')}finally{setFollowBusy(false)}};

  useEffect(()=>{
    let active=true;
    setLoading(true);
    Promise.all([getPosts().catch((error)=>{console.warn('Topic posts load failed:',error);return []}),getSeriesList(100).catch((error)=>{console.warn('Topic series load failed:',error);return []})]).then(([p,s])=>{
      if(!active)return;
      setPosts(p as CommunityPost[]); setSeries(s as Series[]);
    }).finally(()=>active&&setLoading(false));
    return()=>{active=false};
  },[topic]);

  const matched=useMemo(()=>{
    const q=query.trim().toLowerCase();
    const hit=(title:string,body:string)=>!q||title.toLowerCase().includes(q)||body.toLowerCase().includes(q);
    const a=articles.filter(x=>tagsForArticle(x).includes(topic)&&hit(x.title,x.excerpt||''));
    const p=posts.filter(x=>tagsForPost(x).includes(topic)&&hit(x.title,x.content||''));
    const s=series.filter(x=>x.visibility!=='private'&&x.status!=='archived'&&tagsForSeries(x).includes(topic)&&hit(x.title,x.description||''));
    if(sort==='latest'){
      a.sort((x,y)=>safeDate(y.publishedAt)-safeDate(x.publishedAt));
      p.sort((x,y)=>safeDate(y.createdAt)-safeDate(x.createdAt));
      s.sort((x,y)=>safeDate(y.updatedAt)-safeDate(x.updatedAt));
    }
    return {a,p,s,total:a.length+p.length+s.length};
  },[articles,posts,series,topic,query,sort]);

  return <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6">
    <header className="border-4 border-black bg-[var(--color-primary)] neo-shadow-lg p-6 sm:p-9">
      <div className="font-mono text-[10px] font-black uppercase flex items-center gap-2"><Hash className="w-4 h-4"/> Topic</div>
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mt-2">
        <div><h1 className="font-display font-black text-5xl sm:text-7xl uppercase leading-none">#{topic}</h1><p className="mt-3 max-w-2xl text-sm">Everything connected to this topic across articles, posts and series.</p></div>
        <div className="flex items-center gap-2"><div className="font-mono text-[10px] uppercase border-2 border-black bg-white px-3 py-2">{followers.toLocaleString()} FOLLOWERS</div><div className="font-mono text-[10px] uppercase border-2 border-black bg-white px-3 py-2">{matched.total} MATCHES</div><ShareMenu target={{type:'topic',name:topic}} title={`#${topic}`} /><button disabled={followBusy} onClick={()=>void toggleFollow()} className={`border-2 border-black px-3 py-2 font-mono text-[10px] font-black uppercase inline-flex items-center gap-2 ${followed?'bg-[var(--color-primary)]':'bg-white'}`}><Bookmark className={`w-3 h-3 ${followed?'fill-current':''}`}/>{followed?'FOLLOWING':'FOLLOW TOPIC'}</button></div>
      </div>
    </header>
    <div className="border-4 border-black bg-white p-3 flex flex-wrap gap-2">
      <label className="flex-1 min-w-[220px] border-2 border-black px-3 py-2 flex items-center gap-2"><Search className="w-4 h-4"/><input value={query} onChange={e=>setQuery(e.target.value)} className="w-full outline-none font-mono text-xs" placeholder="FILTER THIS TOPIC"/></label>
      <button onClick={()=>setSort('relevance')} className={`border-2 border-black px-3 py-2 font-mono text-[10px] font-black uppercase ${sort==='relevance'?'bg-[var(--color-secondary)]':''}`}>RELEVANT</button>
      <button onClick={()=>setSort('latest')} className={`border-2 border-black px-3 py-2 font-mono text-[10px] font-black uppercase ${sort==='latest'?'bg-[var(--color-secondary)]':''}`}>LATEST</button>
    </div>
    {loading?<div className="py-24 text-center font-mono text-xs uppercase">LOADING TOPIC…</div>:<>
      {matched.a.length>0&&<section><div className="flex items-end justify-between mb-3"><div><div className="font-mono text-[9px] uppercase">Long-form</div><h2 className="font-display font-black text-2xl uppercase">Articles</h2></div><span className="font-mono text-[10px]">{matched.a.length}</span></div><div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{matched.a.map(a=><button key={a.slug} onClick={()=>onNavigate('article',a.slug)} className="text-left border-4 border-black bg-white p-4 neo-shadow-sm hover:bg-[var(--color-primary)]"><div className="font-mono text-[9px] uppercase">{a.category} · {a.readingTimeMinutes||0} MIN</div><h3 className="font-display font-black text-xl uppercase mt-1">{a.title}</h3><p className="text-sm mt-2 line-clamp-3">{a.excerpt}</p><div className="mt-4 font-mono text-[9px] font-black uppercase">OPEN ARTICLE <ArrowRight className="inline w-3 h-3"/></div></button>)}</div></section>}
      {matched.s.length>0&&<section><div className="flex items-end justify-between mb-3"><div><div className="font-mono text-[9px] uppercase">Structured learning</div><h2 className="font-display font-black text-2xl uppercase">Series</h2></div><span className="font-mono text-[10px]">{matched.s.length}</span></div><div className="grid md:grid-cols-2 gap-4">{matched.s.map(s=><button key={s.id} onClick={()=>onNavigate('series',s.id)} className="text-left border-4 border-black bg-[var(--color-secondary)] p-5 neo-shadow-sm"><div className="font-mono text-[9px] uppercase"><Layers className="inline w-3 h-3"/> {s.articleCount||0} PARTS</div><h3 className="font-display font-black text-2xl uppercase mt-1">{s.title}</h3><p className="text-sm mt-2 line-clamp-3">{s.description}</p><div className="mt-4 font-mono text-[9px] font-black uppercase">OPEN SERIES <ArrowRight className="inline w-3 h-3"/></div></button>)}</div></section>}
      {matched.p.length>0&&<section><div className="flex items-end justify-between mb-3"><div><div className="font-mono text-[9px] uppercase">Conversation</div><h2 className="font-display font-black text-2xl uppercase">Community</h2></div><span className="font-mono text-[10px]">{matched.p.length}</span></div><div className="space-y-3">{matched.p.slice(0,30).map(p=><button key={p.id} onClick={()=>onNavigate('community_post',p.id)} className="w-full text-left border-4 border-black bg-white p-4 hover:bg-[var(--color-primary)]"><div className="font-mono text-[9px] uppercase"><MessageSquare className="inline w-3 h-3"/> @{p.authorUsername}</div><h3 className="font-display font-black text-xl uppercase mt-1">{p.title}</h3><p className="text-sm mt-1 line-clamp-2">{p.excerpt||p.content}</p></button>)}</div></section>}
      {!matched.total&&<div className="border-4 border-dashed border-black p-12 text-center"><TrendingUp className="w-10 h-10 mx-auto mb-3"/><div className="font-display font-black text-2xl uppercase">No content for #{topic}</div><button onClick={()=>onNavigate('explore',topic)} className="mt-4 border-2 border-black bg-[var(--color-primary)] px-4 py-2 font-mono text-[10px] font-black">EXPLORE RELATED CONTENT →</button></div>}
    </>}
  </div>
};
