import React,{useEffect,useMemo,useState} from 'react';
import {Bot,Loader2,MessageCircleQuestion,Trash2,RefreshCw} from 'lucide-react';
import {AIChatMessage,AIContentInput,clearAIConversation,loadAIConversation,requestAI,saveAIConversation} from '../lib/ai';
import {getPosts} from '../lib/community';
import {getQuestions} from '../lib/social';
import {getSeriesList} from '../lib/series';
import {notifyToast} from '../lib/toast';
import {Article,PageView} from '../types';
import {auth} from '../lib/firebase';

type Props={open:boolean;onClose:()=>void;articles:Article[];currentPage?:PageView;currentContent?:AIContentInput;onNavigate:(page:PageView,param?:string)=>void};
export const SiteAIAssistant:React.FC<Props>=({open,onClose,articles,currentPage,currentContent,onNavigate})=>{
 const [q,setQ]=useState(''); const [busy,setBusy]=useState(false); const [messages,setMessages]=useState<AIChatMessage[]>([]); const [mode,setMode]=useState<'site'|'page'|'saved'>('site'); const [catalog,setCatalog]=useState(''); const [lastResult,setLastResult]=useState<any>(null);
 const input=useMemo<AIContentInput>(()=>({contentType:'site-ai',contentId:'global',title:'OFFSCRPT Global AI',content:'Global OFFSCRPT assistant context',metadata:{currentPage}}),[currentPage]);
 useEffect(()=>{if(open)setMessages(loadAIConversation(input));},[open,currentPage]);
 useEffect(()=>{if(!open)return;let active=true;(async()=>{try{
   const [posts,series,questions]=await Promise.all([getPosts().catch(()=>[]),getSeriesList(50).catch(()=>[]),getQuestions().catch(()=>[])]);
   const compact=[...articles.slice(0,80).map(a=>({type:'article',id:a.slug,title:a.title,summary:a.excerpt,tags:a.tags||[]})),...(posts as any[]).slice(0,80).map(p=>({type:'post',id:p.id,title:p.title,summary:p.excerpt||p.content,tags:p.hashtags||[]})),(series as any[]).slice(0,50).map(s=>({type:'series',id:s.id,title:s.title,summary:s.description,tags:s.tags||[]})),(questions as any[]).slice(0,80).map(x=>({type:'question',id:x.id,title:x.title,summary:x.details,tags:x.topics||[]}))];
   let savedIds:{articles:string[];posts:string[]}={articles:[],posts:[]};
   try{const uid=auth.currentUser?.uid; const aKey=uid?`offscrpt:saved:articles:${uid}:v2`:''; const pKey=uid?`offscrpt:saved:posts:${uid}:v2`:'offscrpt_saved_community_guest_v1'; savedIds={articles:aKey?JSON.parse(localStorage.getItem(aKey)||'[]'):[],posts:JSON.parse(localStorage.getItem(pKey)||'[]')};}catch(error){console.warn('Site AI saved-content scope unavailable:',error);}
   const savedSetA=new Set(savedIds.articles.map(String)); const savedSetP=new Set(savedIds.posts.map(String));
   const scoped={all:compact,saved:compact.filter((x:any)=>(x.type==='article'&&savedSetA.has(String(x.id)))||(x.type==='post'&&savedSetP.has(String(x.id))))};
   if(active)setCatalog(JSON.stringify(scoped).slice(0,24000));
 }catch(error){console.warn('Site AI catalog unavailable:',error)}})();return()=>{active=false}},[open,articles]);
 if(!open)return null;
 const ask=async()=>{const question=q.trim();if(!question){notifyToast('Enter a question first.','error');return;}setBusy(true);try{
   const base=currentContent&&mode==='page'?{...currentContent,content:`CURRENT PAGE SOURCE\n${currentContent.content}\n\nSITE CATALOG\n${catalog}`}:{...input,content:`${mode==='saved'?'MY SAVED OFFSCRPT CONTENT':'OFFSCRPT CONTENT CATALOG'}\n${catalog}${mode==='page'&&currentContent?`\nCURRENT PAGE\n${JSON.stringify(currentContent)}`:''}`,metadata:{currentPage,scope:mode}};
   const result:any=await requestAI('ask',base,{question,mode:'standard',conversation:messages.slice(-12)});
   setLastResult(result);
   const assistant=String(result?.answer||'No answer returned.');const next=[...messages,{role:'user',content:question,createdAt:new Date().toISOString()},{role:'assistant',content:assistant,createdAt:new Date().toISOString()}];setMessages(next);saveAIConversation(input,next);setQ('');
   (window as any).__offscrptAIResult=result;
 }catch(e:any){notifyToast(e?.message||'AI unavailable.','error')}finally{setBusy(false)}};
 const clear=()=>{clearAIConversation(input);setMessages([]);setLastResult(null);};
 const retryLast=async()=>{const last=messages.filter(m=>m.role==='user').at(-1);if(!last||busy)return;setQ(last.content);setBusy(true);try{const base=currentContent&&mode==='page'?{...currentContent,content:`CURRENT PAGE SOURCE\n${currentContent.content}\n\nSITE CATALOG\n${catalog}`}:{...input,content:`OFFSCRPT CONTENT CATALOG\n${catalog}`,metadata:{currentPage,scope:mode}};const result:any=await requestAI('ask',base,{question:last.content,mode:'standard',conversation:messages.slice(-12)});setLastResult(result);}catch(e:any){notifyToast(e?.message||'AI unavailable.','error')}finally{setBusy(false)}};
 const openSource=(s:any)=>{if(!s?.type||!s?.id)return; if(s.type==='article')onNavigate('article',s.id);else if(s.type==='post')onNavigate('community_post',s.id);else if(s.type==='question')onNavigate('question',s.id);else if(s.type==='series')onNavigate('series',s.id);onClose();};
 return <div className="fixed inset-0 z-[110] bg-black/70 flex items-start justify-center p-4 sm:p-8 overflow-auto" role="dialog" aria-modal="true" aria-label="OFFSCRPT AI">
  <div className="w-full max-w-4xl bg-white border-4 border-black neo-shadow-lg mt-8">
   <div className="bg-[var(--color-primary)] border-b-4 border-black p-5 flex items-center justify-between gap-3"><div className="flex items-center gap-3"><Bot className="w-6 h-6"/><div><div className="font-mono text-[9px] font-black">SITE-WIDE AI</div><h2 className="font-display font-black text-3xl uppercase">ASK OFFSCRPT AI</h2></div></div><button onClick={onClose} className="border-2 border-black bg-white px-3 py-2 font-mono text-[9px] font-black">CLOSE</button></div>
   <div className="p-5 space-y-4">
    <div className="flex flex-wrap gap-2"><button onClick={()=>setMode('site')} className={`border-2 border-black px-3 py-2 font-mono text-[9px] font-black ${mode==='site'?'bg-[var(--color-primary)]':''}`}>ALL OFFSCRPT</button><button onClick={()=>setMode('saved')} className={`border-2 border-black px-3 py-2 font-mono text-[9px] font-black ${mode==='saved'?'bg-[var(--color-primary)]':''}`}>MY SAVED</button><button onClick={()=>setMode('page')} disabled={!currentContent} className={`border-2 border-black px-3 py-2 font-mono text-[9px] font-black ${mode==='page'?'bg-[var(--color-primary)]':''}`}>CURRENT PAGE</button><button onClick={clear} className="border-2 border-black px-3 py-2 font-mono text-[9px] font-black inline-flex items-center gap-1"><Trash2 className="w-3 h-3"/> CLEAR CHAT</button></div>
    <div className="border-2 border-black bg-neutral-50 p-4 min-h-64 max-h-[55vh] overflow-auto space-y-3">{messages.length===0?<div className="font-mono text-xs text-neutral-500">ASK ABOUT ARTICLES, POSTS, DISCUSSIONS, QUESTIONS, SERIES, OR THE CURRENT PAGE.</div>:messages.map((m,i)=><div key={`${m.createdAt}-${i}`} className={`border-2 border-black p-3 ${m.role==='user'?'bg-white':'bg-[var(--color-primary)]'}`}><div className="font-mono text-[8px] font-black uppercase mb-1">{m.role==='user'?'YOU':'OFFSCRPT AI'}</div><div className="text-sm whitespace-pre-wrap">{m.content}</div></div>)}</div>
    {busy&&<div className="border-2 border-black p-3 font-mono text-[9px] font-black"><Loader2 className="inline w-4 h-4 animate-spin mr-2"/>PROCESSING GROUNDED OFFSCRPT CONTEXT…</div>}
    {lastResult&&<div className="border-2 border-black bg-white p-3 space-y-2"><div className="font-mono text-[8px] font-black uppercase">LATEST ANSWER TOOLS</div><div className="flex flex-wrap gap-2"><button onClick={()=>navigator.clipboard?.writeText(String(lastResult.answer||''))} className="border-2 border-black px-2 py-1 font-mono text-[8px]">COPY ANSWER</button><button onClick={()=>void retryLast()} disabled={busy} className="border-2 border-black px-2 py-1 font-mono text-[8px] inline-flex items-center gap-1"><RefreshCw className="w-3 h-3"/>RETRY LAST</button></div>{Array.isArray(lastResult.sources)&&lastResult.sources.length>0&&<div><div className="font-mono text-[8px] font-black mt-2">SOURCES</div>{lastResult.sources.slice(0,8).map((src:any,i:number)=><button key={i} onClick={()=>openSource(src)} className="w-full text-left border-2 border-black p-2 mt-1 hover:bg-[var(--color-primary)]"><b className="font-display uppercase">{src.title||src.name||`Source ${i+1}`}</b><span className="block font-mono text-[8px] text-neutral-500 uppercase">{src.type||''} {src.id?`· ${src.id}`:''}</span></button>)}</div>}</div>}
    <div className="flex gap-2"><textarea value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void ask()}}} placeholder="Ask anything about OFFSCRPT…" className="flex-1 min-h-20 border-2 border-black p-3 text-sm"/><button onClick={()=>void ask()} disabled={busy} className="border-2 border-black bg-black text-white px-5 font-display font-black uppercase inline-flex items-center gap-2"><MessageCircleQuestion className="w-4 h-4"/> ASK</button></div>
    <div className="font-mono text-[8px] text-neutral-500 uppercase">Context: {mode==='site'?'OFFSCRPT catalog':mode==='page'?'current page + OFFSCRPT catalog':'your saved content'}. AI answers are grounded in supplied content.</div>
   </div>
  </div>
 </div>;
};
