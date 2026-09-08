import { auth, db } from './firebase';
import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, setDoc, serverTimestamp } from 'firebase/firestore';

export type AnalyticsEventType = 'session'|'share'|'bookmark'|'reaction'|'complete';

function visitorId(){
  if(typeof window==='undefined') return 'server';
  const k='offscrpt:analytics-visitor:v1';
  try { const x=localStorage.getItem(k); if(x) return x; const v=(crypto.randomUUID?.()||Math.random().toString(36).slice(2))+Date.now().toString(36); localStorage.setItem(k,v); return v; } catch { return `anon-${Math.random().toString(36).slice(2)}`; }
}
function sessionId(slug:string){
  if(typeof window==='undefined') return `server-${encodeURIComponent(slug)}`;
  const k=`offscrpt:analytics-session:${slug}`;
  try { const x=sessionStorage.getItem(k); if(x) return x; const v=crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`; sessionStorage.setItem(k,v); return v; } catch { return `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
}
const device=()=>typeof navigator==='undefined'?'unknown':`${navigator.platform||'unknown'} · ${window.innerWidth}x${window.innerHeight}`;

export async function upsertArticleAnalyticsSession(slug:string, patch:{maxScrollPercent?:number;durationMs?:number;completed?:boolean;currentSection?:string;scrollY?:number;seriesId?:string;seriesOrder?:number;source?:string;} = {}){
  if(!slug) return;
  const sid=sessionId(slug);
  const uid=auth.currentUser?.uid;
  const visitor=uid?'':visitorId();
  const ref=doc(db,'articles',slug,'analytics',sid);
  const existing = await getDoc(ref).catch(()=>null);
  const base:any = {
    id:sid, type:'session', slug, userId:uid||'', visitorId:visitor,
    device:device(), source:String(patch.source||'article'),
    ...(existing?.exists?.() ? {} : {openedAt:serverTimestamp()}), lastSeenAt:serverTimestamp(),
    maxScrollPercent:Math.max(0,Math.min(100,Number(patch.maxScrollPercent||0))),
    durationMs:Math.max(0,Math.min(86400000,Number(patch.durationMs||0))),
    completed:!!patch.completed,
    currentSection:String(patch.currentSection||'').slice(0,200),
    scrollY:Math.max(0,Math.min(100000000,Number(patch.scrollY||0))),
    seriesId:String(patch.seriesId||'').slice(0,200), seriesOrder:Number(patch.seriesOrder||0),
  };
  await setDoc(ref,base,{merge:true});
}
export async function recordArticleAnalyticsEvent(slug:string,type:Exclude<AnalyticsEventType,'session'>,payload:any={}){
  if(!slug) return;
  const ref=doc(collection(db,'articles',slug,'analytics'));
  const uid=auth.currentUser?.uid;
  await setDoc(ref,{type,slug,userId:uid||'',visitorId:uid?'':visitorId(),createdAt:serverTimestamp(),...payload});
}

export interface ArticleAnalyticsAggregate{
  views:number; uniqueReaders:number; averageReadingTimeMs:number; completionRate:number; scrollDepth:number; reactions:number; bookmarks:number; comments:number; shares:number; returnReaders:number; funnel:{opened:number;p25:number;p50:number;p75:number;completed:number};
}
export async function getArticleAnalyticsAggregate(slug:string, fallbackViews=0):Promise<ArticleAnalyticsAggregate>{
  const base={views:fallbackViews,uniqueReaders:0,averageReadingTimeMs:0,completionRate:0,scrollDepth:0,reactions:0,bookmarks:0,comments:0,shares:0,returnReaders:0,funnel:{opened:0,p25:0,p50:0,p75:0,completed:0}} as ArticleAnalyticsAggregate;
  try{
    const snap=await getDocs(query(collection(db,'articles',slug,'analytics'),orderBy('lastSeenAt','desc'),limit(500)));
    const sessions=snap.docs.map(d=>d.data() as any).filter(x=>x.type==='session');
    const events=snap.docs.map(d=>d.data() as any).filter(x=>x.type!=='session');
    base.views=Math.max(base.views,sessions.length||0);
    const ids=new Set<string>(); sessions.forEach(s=>{const k=s.userId||s.visitorId;if(k)ids.add(k)}); base.uniqueReaders=ids.size;
    if(sessions.length){base.averageReadingTimeMs=Math.round(sessions.reduce((n,s)=>n+Number(s.durationMs||0),0)/sessions.length);base.scrollDepth=Math.round(sessions.reduce((n,s)=>n+Number(s.maxScrollPercent||0),0)/sessions.length);base.completionRate=Math.round(100*sessions.filter(s=>s.completed||Number(s.maxScrollPercent||0)>=100).length/sessions.length);}
    base.funnel={opened:sessions.length,p25:sessions.filter(s=>Number(s.maxScrollPercent||0)>=25).length,p50:sessions.filter(s=>Number(s.maxScrollPercent||0)>=50).length,p75:sessions.filter(s=>Number(s.maxScrollPercent||0)>=75).length,completed:sessions.filter(s=>s.completed||Number(s.maxScrollPercent||0)>=100).length};
    base.shares=events.filter(e=>e.type==='share').length; base.bookmarks=events.filter(e=>e.type==='bookmark'&&e.active===true).length; base.reactions=events.filter(e=>e.type==='reaction'&&e.active!==false).length; base.returnReaders=sessions.filter(s=>s.returnReader===true).length;
    return base;
  }catch{return base;}
}
export async function subscribeArticleAnalytics(slug:string, cb:(a:ArticleAnalyticsAggregate)=>void){
  if(!slug){cb({views:0,uniqueReaders:0,averageReadingTimeMs:0,completionRate:0,scrollDepth:0,reactions:0,bookmarks:0,comments:0,shares:0,returnReaders:0,funnel:{opened:0,p25:0,p50:0,p75:0,completed:0}});return()=>{}};
  try{ const un=onSnapshot(query(collection(db,'articles',slug,'analytics'),limit(500)),async snap=>{
    const a=await getArticleAnalyticsAggregate(slug); cb(a);
  },()=>{}); return un;}catch{return()=>{}};
}
