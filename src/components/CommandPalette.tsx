import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Home, BookOpen, Layers, Bookmark, History, Bell, Compass, PlusCircle, X, Settings2, UserRound, Sparkles } from 'lucide-react';
import { PageView } from '../types';

interface Props { isOpen: boolean; onClose: ()=>void; onOpenSearch: ()=>void; onNavigate:(page:PageView,param?:string)=>void; onCreatePost?:()=>void; onOpenSiteAI?:()=>void; }

type Command = { id:string; label:string; hint?:string; icon:React.ComponentType<{className?:string}>; run:()=>void };

export const CommandPalette: React.FC<Props> = ({ isOpen, onClose, onOpenSearch, onNavigate, onCreatePost, onOpenSiteAI }) => {
  const [query,setQuery]=useState(''); const inputRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{ if(!isOpen) return; setQuery(''); setTimeout(()=>inputRef.current?.focus(),30); },[isOpen]);
  useEffect(()=>{ const h=(e:KeyboardEvent)=>{ if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){ e.preventDefault(); return; } if(e.key==='Escape'&&isOpen) onClose(); }; window.addEventListener('keydown',h); return ()=>window.removeEventListener('keydown',h); },[isOpen,onClose]);
  const commands:Command[] = useMemo(()=>[
    {id:'search',label:'Search OFFSCRPT',hint:'Everything on OFFSCRPT',icon:Search,run:()=>{onClose();onOpenSearch();}},
    {id:'knowledge',label:'Ask OFFSCRPT',hint:'Search + grounded knowledge',icon:Sparkles,run:()=>{onClose();onNavigate('knowledge');}},
    {id:'vault',label:'My Vault',hint:'Saved library + notes',icon:Bookmark,run:()=>{onClose();onNavigate('vault');}},
    {id:'research',label:'OFFSCRPT Research',hint:'Synthesize published sources',icon:Sparkles,run:()=>{onClose();onNavigate('research');}},
    {id:'home',label:'Go Home',icon:Home,run:()=>{onClose();onNavigate('home');}},
    {id:'dashboard',label:'My OFFSCRPT',hint:'Account dashboard',icon:UserRound,run:()=>{onClose();onNavigate('dashboard');}},
    {id:'preferences',label:'Notification Settings',icon:Settings2,run:()=>{onClose();onNavigate('preferences');}},
    {id:'blog',label:'Open Blog',icon:BookOpen,run:()=>{onClose();onNavigate('blog');}},
    {id:'series',label:'Open Series',icon:Layers,run:()=>{onClose();onNavigate('series');}},
    {id:'saved',label:'Open Saved',icon:Bookmark,run:()=>{onClose();onNavigate('saved');}},
    {id:'history',label:'Reading History',icon:History,run:()=>{onClose();onNavigate('history');}},
    {id:'notifications',label:'Notifications',icon:Bell,run:()=>{onClose();onNavigate('notifications');}},
    {id:'explore',label:'Explore',icon:Compass,run:()=>{onClose();onNavigate('explore');}},
    ...(onOpenSiteAI ? [{id:'ai',label:'Ask OFFSCRPT AI',hint:'Site-wide grounded assistant',icon:Sparkles,run:()=>{onClose();onOpenSiteAI();}}] : []),
    ...(onCreatePost ? [{id:'create',label:'Create a Post',icon:PlusCircle,run:()=>{onClose();onCreatePost();}}] : []),
  ],[onClose,onCreatePost,onNavigate,onOpenSearch]);
  const filtered=commands.filter(c=>`${c.label} ${c.hint||''}`.toLowerCase().includes(query.trim().toLowerCase()));
  useEffect(()=>{ if(!isOpen) return; const h=(e:KeyboardEvent)=>{ if(e.key==='Enter' && !e.shiftKey && filtered.length===1){ e.preventDefault(); filtered[0].run(); } }; window.addEventListener('keydown',h); return ()=>window.removeEventListener('keydown',h); },[filtered,isOpen]);
  if(!isOpen) return null;
  return <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-xs flex items-start justify-center pt-20 px-4" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div className="w-full max-w-2xl bg-white border-4 border-black neo-shadow-lg overflow-hidden">
      <div className="flex items-center border-b-4 border-black px-4 py-3 gap-3"><Search className="w-5 h-5 stroke-[3]"/><input ref={inputRef} value={query} onChange={e=>setQuery(e.target.value)} className="flex-1 outline-none font-display font-bold text-lg" placeholder="What do you want to do?"/><button onClick={onClose} className="border-2 border-black p-1.5"><X className="w-4 h-4"/></button></div>
      <div className="max-h-[62vh] overflow-y-auto p-3">{filtered.map((c,i)=>{const Icon=c.icon;return <button key={c.id} onClick={c.run} className="w-full flex items-center gap-3 text-left border-2 border-transparent px-3 py-3 hover:border-black hover:bg-[var(--color-primary)]"><Icon className="w-5 h-5"/><span className="font-display font-black uppercase flex-1">{c.label}</span>{c.hint&&<span className="font-mono text-[9px] text-neutral-500">{c.hint}</span>}{i===0&&<kbd className="font-mono text-[9px] border border-black px-1">ENTER</kbd>}</button>})}{!filtered.length&&<div className="p-8 text-center font-mono text-xs">NO COMMANDS MATCHED.</div>}</div>
      <div className="border-t-4 border-black px-4 py-2 bg-neutral-100 font-mono text-[9px] flex justify-between"><span>COMMAND PALETTE</span><span>CTRL/⌘ + K · ESC CLOSE</span></div>
    </div>
  </div>;
};
