import {auth,db} from './firebase';
import {collection,getDocs,query,orderBy,limit,collectionGroup,where} from 'firebase/firestore';
import type {Article} from '../types';
export type RecommendationSection={title:string;reason?:string;articles:Article[]};
const published=(a:Article)=>a.isPublished!==false&&a.mainPublicationStatus!=='unpublished';
const norm=(x:string)=>x.toLowerCase().replace(/^#/,'').trim();
export async function buildRecommendations(all:Article[],uid?:string|null,current?:Article|null):Promise<RecommendationSection[]>{
 const candidates=all.filter(published); if(!uid) return [{title:'FOR YOU',articles:candidates.slice(0,6)}];
 const [historySnap,savesSnap,topicsSnap,followingSnap,reactionSnap]=await Promise.allSettled([
  getDocs(query(collection(db,'users',uid,'history'),orderBy('viewedAt','desc'),limit(50))),
  getDocs(collection(db,'users',uid,'saves')),
  getDocs(collection(db,'users',uid,'followedTopics')),
  getDocs(collection(db,'users',uid,'following')),
  getDocs(query(collectionGroup(db,'reactions'),where('userId','==',uid),limit(100)))
 ]);
 const history=historySnap.status==='fulfilled'?historySnap.value.docs.map(d=>d.data() as any):[];
 const saved=new Set(savesSnap.status==='fulfilled'?savesSnap.value.docs.map(d=>String(d.data().itemId||'')):[]);
 const topics=new Set((topicsSnap.status==='fulfilled'?topicsSnap.value.docs.map(d=>norm(String(d.data().topic||d.data().name||''))):[]).filter(Boolean));
 const following=new Set(followingSnap.status==='fulfilled'?followingSnap.value.docs.map(d=>String(d.id||d.data().uid||'')):[]);
 const reacted=new Set(reactionSnap.status==='fulfilled'?reactionSnap.value.docs.map(d=>String(d.data().slug||d.data().articleSlug||d.ref.parent.parent?.id||'')):[]);
 const historySlugs=history.map(x=>String(x.slug||'')).filter(Boolean); const historySet=new Set(historySlugs);
 const score=(a:Article)=>{let s=0; const tags=[norm(a.category),...(a.tags||[]).map(norm)]; if(tags.some(t=>topics.has(t)))s+=8; if(historySet.has(a.slug))s-=20; if(saved.has(a.slug))s+=6; if(reacted.has(a.slug))s+=5; if(following.has(a.author?.uid||'' )||following.has(a.author?.username||''))s+=10; if(current && a.slug!==current.slug && (a.category===current.category || (a.tags||[]).some(t=>(current.tags||[]).map(norm).includes(norm(t)))))s+=7; if(a.trending)s+=3; s+=Math.min(3,Number(a.viewsCount||0)/1000); return s;};
 const ranked=[...candidates].sort((a,b)=>score(b)-score(a)); const because=history[0] ? candidates.filter(a=>a.category===history[0].category || (a.tags||[]).some(t=>history[0].tags?.includes(t))).sort((a,b)=>score(b)-score(a)) : [];
 const series=current?.seriesId?candidates.filter(a=>a.seriesId===current.seriesId && Number(a.seriesOrder||0)>Number(current.seriesOrder||0)).sort((a,b)=>Number(a.seriesOrder||0)-Number(b.seriesOrder||0)):[];
 const fromFollow=candidates.filter(a=>following.has(a.author?.uid||'')||following.has(a.author?.username||''));
 const moreLike=current?candidates.filter(a=>a.slug!==current.slug&&(a.category===current.category||(a.tags||[]).some(t=>(current.tags||[]).map(norm).includes(norm(t))))).sort((a,b)=>score(b)-score(a)):[];
 const trendingTopics=candidates.filter(a=>(a.tags||[]).some(t=>topics.has(norm(t)))||topics.has(norm(a.category))).sort((a,b)=>score(b)-score(a));
 return [
  {title:'FOR YOU',articles:ranked.slice(0,6)},
  {title:'BECAUSE YOU READ...',reason:history[0]?.title,articles:because.slice(0,6)},
  {title:'CONTINUE YOUR SERIES',articles:series.slice(0,6)},
  {title:'FROM PEOPLE YOU FOLLOW',articles:fromFollow.sort((a,b)=>score(b)-score(a)).slice(0,6)},
  {title:'MORE LIKE THIS',articles:moreLike.slice(0,6)},
  {title:'TRENDING IN YOUR TOPICS',articles:trendingTopics.slice(0,6)},
 ].filter(s=>s.articles.length);
}
