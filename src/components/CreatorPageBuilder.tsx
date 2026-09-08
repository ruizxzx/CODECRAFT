import React, { useState } from 'react';
import { Article, CreatorPageConfig, Series } from '../types';
import { updateCommunityProfile } from '../lib/community';
import { Save, Layout, ArrowUp, ArrowDown } from 'lucide-react';

interface Props { profile: any; articles: Article[]; series: Series[]; onSaved: (config: CreatorPageConfig)=>void; }

export const CreatorPageBuilder: React.FC<Props> = ({ profile, articles, series, onSaved }) => {
  const existing: CreatorPageConfig = profile.creatorPage || {};
  const [config,setConfig]=useState<CreatorPageConfig>({ layout:'grid', themeColor:profile.themeColor||'#FFD600', showStats:true, showSocialLinks:true, ...existing });
  const [saving,setSaving]=useState(false);
  const [articleQuery,setArticleQuery]=useState('');
  const [seriesQuery,setSeriesQuery]=useState('');
  const chosenArticles = config.featuredArticleSlugs || [];
  const chosenSeries = config.featuredSeriesIds || [];
  const filteredArticles=articles.filter(a=>!articleQuery||a.title.toLowerCase().includes(articleQuery.toLowerCase())).slice(0,10);
  const filteredSeries=series.filter(s=>!seriesQuery||s.title.toLowerCase().includes(seriesQuery.toLowerCase())).slice(0,10);
  const toggle=(key:'featuredArticleSlugs'|'featuredSeriesIds',id:string)=>setConfig(c=>({...c,[key]:((c[key]||[]).includes(id)?(c[key]||[]).filter(x=>x!==id):[...(c[key]||[]),id]).slice(0,8)}));
  const move=(key:'featuredArticleSlugs'|'featuredSeriesIds',idx:number,dir:-1|1)=>setConfig(c=>{const arr=[...(c[key]||[])];const t=idx+dir;if(t<0||t>=arr.length)return c;[arr[idx],arr[t]]=[arr[t],arr[idx]];return {...c,[key]:arr}});
  const save=async()=>{setSaving(true);try{await updateCommunityProfile(profile.uid,{creatorPage:config});onSaved(config);}catch(e:any){alert(e?.message||'Could not save creator page.')}finally{setSaving(false)}};
  return <div className="border-4 border-black bg-white p-5 space-y-6">
    <div><div className="font-mono text-[10px] uppercase text-neutral-500">CREATOR PAGE BUILDER</div><h3 className="font-display font-black text-2xl uppercase">Make your profile feel like your site</h3></div>
    <div className="grid md:grid-cols-2 gap-3"><input value={config.heroTitle||''} onChange={e=>setConfig(c=>({...c,heroTitle:e.target.value}))} placeholder="Hero title" className="border-2 border-black p-3"/><input value={config.tagline||''} onChange={e=>setConfig(c=>({...c,tagline:e.target.value}))} placeholder="Tagline" className="border-2 border-black p-3"/></div>
    <textarea value={config.heroText||''} onChange={e=>setConfig(c=>({...c,heroText:e.target.value}))} placeholder="Hero description" rows={4} className="w-full border-2 border-black p-3"/>
    <div className="grid sm:grid-cols-3 gap-2"><label className="border-2 border-black p-3 font-mono text-xs">THEME <input type="color" value={config.themeColor||'#FFD600'} onChange={e=>setConfig(c=>({...c,themeColor:e.target.value}))} className="float-right"/></label>{(['grid','list','magazine'] as const).map(l=><button key={l} onClick={()=>setConfig(c=>({...c,layout:l}))} className={`border-2 border-black p-3 font-mono text-xs uppercase ${config.layout===l?'bg-[var(--color-primary)] font-black':''}`}><Layout className="inline w-4 h-4 mr-1"/>{l}</button>)}</div>
    <div className="grid lg:grid-cols-2 gap-5"><div className="border-2 border-black p-4"><h4 className="font-display font-black uppercase">Featured articles</h4><input value={articleQuery} onChange={e=>setArticleQuery(e.target.value)} placeholder="Filter articles" className="w-full border-2 border-black p-2 mt-2 font-mono text-xs"/><div className="space-y-2 mt-3">{filteredArticles.map(a=><button key={a.slug} onClick={()=>toggle('featuredArticleSlugs',a.slug)} className={`w-full text-left border-2 border-black p-2 text-sm ${chosenArticles.includes(a.slug)?'bg-[var(--color-primary)]':''}`}>{a.title}</button>)}</div><div className="mt-3 space-y-1">{chosenArticles.map((id,i)=><div key={id} className="flex gap-1"><div className="flex-1 border-2 border-black p-2 font-mono text-[10px]">{i+1}. {articles.find(a=>a.slug===id)?.title||id}</div><button onClick={()=>move('featuredArticleSlugs',i,-1)} className="border-2 border-black p-2"><ArrowUp className="w-3 h-3"/></button><button onClick={()=>move('featuredArticleSlugs',i,1)} className="border-2 border-black p-2"><ArrowDown className="w-3 h-3"/></button></div>)}</div></div><div className="border-2 border-black p-4"><h4 className="font-display font-black uppercase">Featured series</h4><input value={seriesQuery} onChange={e=>setSeriesQuery(e.target.value)} placeholder="Filter series" className="w-full border-2 border-black p-2 mt-2 font-mono text-xs"/><div className="space-y-2 mt-3">{filteredSeries.map(s=><button key={s.id} onClick={()=>toggle('featuredSeriesIds',s.id)} className={`w-full text-left border-2 border-black p-2 text-sm ${chosenSeries.includes(s.id)?'bg-[var(--color-secondary)]':''}`}>{s.title}</button>)}</div></div></div>
    <button onClick={save} disabled={saving} className="border-2 border-black bg-black text-white px-5 py-3 font-mono text-xs font-black uppercase"><Save className="inline w-4 h-4 mr-2"/>{saving?'SAVING…':'SAVE CREATOR PAGE'}</button>
  </div>
};
