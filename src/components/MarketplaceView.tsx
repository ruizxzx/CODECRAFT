import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Filter, Loader2, Search, SlidersHorizontal, X } from 'lucide-react';
import type { PageView } from '../types';
import type { CommerceProduct, CommercePublicPrice } from '../lib/commerce';
import { listUserEntitlements } from '../lib/commerce';
import { auth, loginWithGoogle } from '../lib/firebase';
import { getMarketplaceHome, listMarketplaceProducts, getSavedMarketplaceProductIds, toggleMarketplaceSave, recordMarketplaceEvent, type MarketplaceSort, type MarketplacePage, type MarketplaceCreatorSummary } from '../lib/marketplace';
import { MarketplaceProductCard } from './MarketplaceProductCard';
import { notifyToast } from '../lib/toast';

interface Props { onNavigate:(page:PageView,param?:string)=>void; }
const CATEGORIES=['Design','Development','Education','Business','Productivity','Writing','Marketing','Finance','Fitness','Photography','Video','Audio','Career','Templates','Guides','Tools','Other'];
const TYPES=['digital_product'];
const PRICE_FILTERS=[{label:'ANY PRICE',key:'any'},{label:'FREE',key:'free'},{label:'UNDER ₹500',key:'under500'},{label:'₹500–₹1,000',key:'500to1000'},{label:'₹1,000+',key:'1000plus'}];
const priceBucket=(price?:CommercePublicPrice)=>{const amount=Number(price?.amount||0)/100;if(!price)return 'any';if(amount===0)return 'free';if(amount<500)return 'under500';if(amount<=1000)return '500to1000';return '1000plus';};

export const MarketplaceView:React.FC<Props>=({onNavigate})=>{
 const [home,setHome]=useState<{featured:CommerceProduct[];trending:CommerceProduct[];newest:CommerceProduct[];creators:MarketplaceCreatorSummary[];prices:Record<string,CommercePublicPrice|undefined>}|null>(null);
 const [products,setProducts]=useState<CommerceProduct[]>([]); const [prices,setPrices]=useState<Record<string,CommercePublicPrice|undefined>>({}); const [resultTotal,setResultTotal]=useState(0); const [owned,setOwned]=useState<Set<string>>(new Set()); const [saved,setSaved]=useState<Set<string>>(new Set());
 const initialParams=useMemo(()=>{const raw=window.location.hash.replace(/^#(?:shop|marketplace)(?:\?|\/category\/)?/,''); if(raw.includes('=')||raw.includes('&')){const p=new URLSearchParams(raw);return {q:p.get('q')||'',category:p.get('category')||'',type:p.get('type')||'',priceFilter:p.get('price')||'any',sort:(p.get('sort') as MarketplaceSort)||'newest',creatorId:p.get('creatorId')||''};} const m=window.location.hash.match(/^#(?:shop|marketplace)\/category\/([^?]+)/);return {q:'',category:m?decodeURIComponent(m[1]):'',type:'',priceFilter:'any',sort:'newest' as MarketplaceSort,creatorId:''};},[]);
 const [q,setQ]=useState(initialParams.q); const [category,setCategory]=useState(initialParams.category); const [type,setType]=useState(initialParams.type); const [creatorId,setCreatorId]=useState(initialParams.creatorId); const [priceFilter,setPriceFilter]=useState(initialParams.priceFilter); const [sort,setSort]=useState<MarketplaceSort>(initialParams.sort); const [nextCursor,setNextCursor]=useState<string|undefined>(); const [hasMore,setHasMore]=useState(false); const [searching,setSearching]=useState(false); const [initialLoading,setInitialLoading]=useState(true); const [error,setError]=useState('');
 const [mobileFilters,setMobileFilters]=useState(false); const debounceRef=useRef<number|undefined>(); const requestSeqRef=useRef(0); const previousParamsKeyRef=useRef('');
 const isFiltered=Boolean(q||category||type||creatorId||priceFilter!=='any'||sort!=='newest');
 const paramsKey=useMemo(()=>JSON.stringify({q:q.trim(),category,type,creatorId,priceFilter,sort}),[q,category,type,creatorId,priceFilter,sort]);

 const loadOwnershipAndSaved=useCallback(async()=>{
   const uid=auth.currentUser?.uid; if(!uid){setOwned(new Set());setSaved(new Set());return;}
   const [ents,savedIds]=await Promise.all([listUserEntitlements(uid).catch(()=>[]),getSavedMarketplaceProductIds(uid).catch(()=>[])]);
   setOwned(new Set((ents||[]).filter((e:any)=>e.status==='active'&&e.resourceType==='product').map((e:any)=>String(e.resourceId||'')))); setSaved(new Set(savedIds));
 },[]);

 useEffect(()=>{let live=true;setInitialLoading(true);recordMarketplaceEvent('marketplace_view','',{source:'shop'});Promise.all([getMarketplaceHome(),loadOwnershipAndSaved()]).then(([data])=>{if(!live)return;setHome(data);setProducts(data.newest||[]);setPrices(data.prices||{});setInitialLoading(false);}).catch((e:any)=>{if(live){setError(e?.message||'Could not load the marketplace.');setInitialLoading(false);}});return()=>{live=false}},[loadOwnershipAndSaved]);

 const executeSearch=useCallback(async(nextCursorArg?:string)=>{
   const requestId=++requestSeqRef.current; setSearching(true);setError('');
   try{
     const page:MarketplacePage=await listMarketplaceProducts({q:q.trim(),category,type,creatorId,sort,cursor:nextCursorArg,limit:24});
     if(requestId!==requestSeqRef.current)return;
     let rows=page.products; if(priceFilter!=='any')rows=rows.filter(p=>priceBucket(page.prices[p.id])===priceFilter);
     if(nextCursorArg)setProducts(prev=>[...prev,...rows]); else setProducts(rows);
     setPrices(prev=>({...prev,...page.prices}));setResultTotal(page.total);setNextCursor(page.nextCursor);setHasMore(page.hasMore);
     if(!nextCursorArg&&q.trim())recordMarketplaceEvent('marketplace_search','',{query:q.trim(),category,creatorId,sort});
   }catch(e:any){
     if(requestId===requestSeqRef.current)setError(e?.message||'Marketplace search failed.');
   }finally{
     if(requestId===requestSeqRef.current)setSearching(false);
   }
 },[q,category,type,creatorId,sort,priceFilter]);

 useEffect(()=>{
   if(initialLoading)return;
   if(debounceRef.current)window.clearTimeout(debounceRef.current);
   debounceRef.current=window.setTimeout(()=>{ void executeSearch(); },q.trim()?320:20);
   return()=>{if(debounceRef.current)window.clearTimeout(debounceRef.current)};
 },[paramsKey,initialLoading]);

 useEffect(()=>{
   if(initialLoading)return;
   const params=new URLSearchParams(); if(q.trim())params.set('q',q.trim()); if(category)params.set('category',category); if(type)params.set('type',type); if(creatorId)params.set('creatorId',creatorId); if(priceFilter!=='any')params.set('price',priceFilter); if(sort!=='newest')params.set('sort',sort);
   const hash=`shop${params.toString()?`?${params.toString()}`:''}`; if(window.location.hash!==`#${hash}`) window.history.replaceState(null,'',`${window.location.pathname}${window.location.search}#${hash}`);
 },[paramsKey,initialLoading,q,category,type,creatorId,priceFilter,sort]);
 useEffect(()=>{
   if(initialLoading)return;
   if(previousParamsKeyRef.current && previousParamsKeyRef.current!==paramsKey){
     recordMarketplaceEvent('marketplace_filter','',{category,subcategory:'',type,creatorId,priceFilter,sort,query:q.trim()});
   }
   previousParamsKeyRef.current=paramsKey;
 },[paramsKey,initialLoading,category,type,creatorId,priceFilter,sort,q]);

 const loadMore=async()=>{if(!nextCursor||searching)return;await executeSearch(nextCursor);};
 const toggleSave=async(product:CommerceProduct)=>{
   if(!auth.currentUser){
     try{const signedIn=await loginWithGoogle(); if(!signedIn)return;}catch(e:any){notifyToast(e?.message||'Sign-in failed.','error');return;}
   }
   const currently=saved.has(product.id);
   try{const next=await toggleMarketplaceSave(product,currently);setSaved(prev=>{const n=new Set(prev);if(next)n.add(product.id);else n.delete(product.id);return n});notifyToast(next?'Saved product.':'Removed from saved products.','success');}
   catch(e:any){notifyToast(e?.message||'Could not save product.','error');}
 };
 const clear=()=>{setQ('');setCategory('');setType('');setCreatorId('');setPriceFilter('any');setSort('newest');recordMarketplaceEvent('marketplace_filter','',{cleared:true});};
 const openProduct=(id:string,source='marketplace')=>{recordMarketplaceEvent('product_open',id,{source}); if(source==='search')recordMarketplaceEvent('search_result_click',id,{source}); onNavigate('product',id)};
 const displayRows=isFiltered?products:(home?.newest||products);
 const creators=home?.creators||[];
 const section=(title:string,label:string,items:CommerceProduct[])=>items.length>0?<section className="mb-14"><div className="flex items-end justify-between gap-3 mb-4"><div><div className="font-mono text-[9px] font-black uppercase text-neutral-500">{label}</div><h2 className="font-display font-black text-3xl sm:text-4xl uppercase">{title}</h2></div><button onClick={()=>{setSort('newest');setQ('');setCategory('');setType('');setCreatorId('');setPriceFilter('any');}} className="font-mono text-[8px] font-black uppercase underline">VIEW ALL →</button></div><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{items.slice(0,8).map(p=><MarketplaceProductCard key={p.id} product={p} price={prices[p.id]} owned={owned.has(p.id)} saved={saved.has(p.id)} onOpen={(id)=>openProduct(id,'home')} onToggleSave={(product)=>void toggleSave(product)}/>)}</div></section>:null;
 return <div className="min-h-screen bg-[#f6f6f3]">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
   <header className="max-w-4xl"><div className="font-mono text-[10px] font-black uppercase text-neutral-500">OFFSCRPT MARKETPLACE</div><h1 className="font-display font-black text-6xl sm:text-8xl uppercase leading-[.84] tracking-tight mt-2">SHOP</h1><p className="mt-5 text-base sm:text-lg max-w-2xl text-neutral-700">Digital products made by OFFSCRPT creators — guides, templates, resources, tools and more.</p>
    <div className="mt-7 border-4 border-black bg-white flex items-center gap-3 p-3 shadow-[6px_6px_0_#000]"><Search className="w-5 h-5 shrink-0"/><input value={q} onChange={e=>setQ(e.target.value.slice(0,100))} onKeyDown={e=>{if(e.key==='Enter')void executeSearch()}} placeholder="SEARCH PRODUCTS…" aria-label="Search products" className="w-full outline-none font-mono text-sm bg-transparent"/><button onClick={()=>q&&setQ('')} aria-label="Clear search" className={`w-8 h-8 border-2 border-black ${q?'bg-[var(--color-primary)]':'bg-white'} ${q?'':'invisible'}`}><X className="w-4 h-4 mx-auto"/></button></div>
   </header>

   {!isFiltered&&!initialLoading&&<>{section('FEATURED','CURATED',home?.featured||[])}{section('TRENDING','DISCOVERY',home?.trending||[])}
   <section className="mb-14"><div className="font-mono text-[9px] font-black uppercase text-neutral-500">BROWSE BY TOPIC</div><h2 className="font-display font-black text-3xl sm:text-4xl uppercase mb-4">CATEGORIES</h2><div className="flex flex-wrap gap-2">{CATEGORIES.map(c=><button key={c} onClick={()=>{setCategory(c);recordMarketplaceEvent('category_open','',{category:c});}} className="border-2 border-black bg-white px-3 py-2 font-mono text-[9px] font-black uppercase hover:bg-[var(--color-primary)]">{c}</button>)}</div></section>
   <section className="mb-14"><div className="flex items-end justify-between mb-4"><div><div className="font-mono text-[9px] font-black uppercase text-neutral-500">DISCOVERY</div><h2 className="font-display font-black text-3xl sm:text-4xl uppercase">NEW RELEASES</h2></div><span className="font-mono text-[8px] font-black uppercase text-neutral-500">LATEST PRODUCTS</span></div><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{(home?.newest||[]).slice(0,8).map(p=><MarketplaceProductCard key={p.id} product={p} price={prices[p.id]} owned={owned.has(p.id)} saved={saved.has(p.id)} onOpen={(id)=>openProduct(id,'new-releases')} onToggleSave={(product)=>void toggleSave(product)}/>)}</div></section>
   {creators.length>0&&<section className="mb-14"><div className="font-mono text-[9px] font-black uppercase text-neutral-500">CREATOR ECONOMY</div><h2 className="font-display font-black text-3xl sm:text-4xl uppercase mb-4">POPULAR CREATORS</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{creators.slice(0,8).map(c=><button key={c.id} onClick={()=>onNavigate('creator',c.username)} className="border-4 border-black bg-white p-4 text-left hover:bg-[var(--color-secondary)]"><div className="flex items-center gap-3"><div className="w-12 h-12 border-2 border-black bg-neutral-100 overflow-hidden shrink-0">{c.cover?<img src={c.cover} alt="" className="w-full h-full object-cover"/>:<span className="w-full h-full flex items-center justify-center font-display font-black">{(c.displayName||c.username||'?').slice(0,1)}</span>}</div><div className="min-w-0"><div className="font-mono text-[9px] font-black uppercase truncate">@{c.username||'creator'}</div><div className="font-display font-black text-xl uppercase truncate">{c.displayName||c.username}</div><div className="font-mono text-[8px] text-neutral-500 uppercase">{c.productCount} PRODUCTS</div></div></div></button>)}</div></section>}</>}

   {(isFiltered||initialLoading)&&<section className="mt-8">
      <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between mb-5"><div><div className="font-mono text-[9px] font-black uppercase text-neutral-500">PRODUCT DISCOVERY</div><h2 className="font-display font-black text-3xl uppercase">{category||q||'ALL PRODUCTS'}</h2></div><button onClick={()=>setMobileFilters(true)} className="md:hidden border-2 border-black bg-white px-3 py-2 font-mono text-[9px] font-black uppercase inline-flex items-center gap-2"><SlidersHorizontal className="w-4 h-4"/> FILTERS</button></div>
      <div className="grid md:grid-cols-[230px_minmax(0,1fr)] gap-6 items-start">
       <aside className={`md:block ${mobileFilters?'block fixed inset-0 z-[200] bg-[#f6f6f3] p-4 overflow-auto':''}`}>
        <div className="border-4 border-black bg-white p-4 shadow-[5px_5px_0_#000]">{mobileFilters&&<div className="flex items-center justify-between mb-4"><div className="font-display font-black text-xl uppercase">FILTERS</div><button onClick={()=>setMobileFilters(false)} className="border-2 border-black p-2"><X className="w-4 h-4"/></button></div>}
         <label className="block font-mono text-[8px] font-black uppercase mb-2">Category</label><select value={category} onChange={e=>setCategory(e.target.value)} className="w-full border-2 border-black p-2 font-mono text-[9px] bg-white mb-4"><option value="">All categories</option>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select>
         <label className="block font-mono text-[8px] font-black uppercase mb-2">Product type</label><select value={type} onChange={e=>setType(e.target.value)} className="w-full border-2 border-black p-2 font-mono text-[9px] bg-white mb-4"><option value="">All types</option>{TYPES.map(t=><option key={t} value={t}>{t.replaceAll('_',' ')}</option>)}</select>
         <label className="block font-mono text-[8px] font-black uppercase mb-2">Creator</label><select value={creatorId} onChange={e=>setCreatorId(e.target.value)} className="w-full border-2 border-black p-2 font-mono text-[9px] bg-white mb-4"><option value="">All creators</option>{creators.map(c=><option key={c.id} value={c.id}>@{c.username||c.displayName}</option>)}</select>
         <label className="block font-mono text-[8px] font-black uppercase mb-2">Price</label><select value={priceFilter} onChange={e=>setPriceFilter(e.target.value)} className="w-full border-2 border-black p-2 font-mono text-[9px] bg-white mb-4">{PRICE_FILTERS.map(p=><option key={p.key} value={p.key}>{p.label}</option>)}</select>
         <label className="block font-mono text-[8px] font-black uppercase mb-2">Sort</label><select value={sort} onChange={e=>setSort(e.target.value as MarketplaceSort)} className="w-full border-2 border-black p-2 font-mono text-[9px] bg-white"><option value="relevance">Relevance</option><option value="newest">Newest</option><option value="popular">Popular</option><option value="price_asc">Price: Low → High</option><option value="price_desc">Price: High → Low</option></select>
         <button onClick={()=>{clear();setMobileFilters(false)}} className="mt-4 w-full border-2 border-black bg-[var(--color-primary)] px-3 py-2 font-mono text-[9px] font-black uppercase">CLEAR FILTERS</button>
        </div>
       </aside>
       <div>{searching||initialLoading?<div className="border-4 border-black bg-white p-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto"/><div className="font-mono text-[9px] font-black uppercase mt-3">LOADING PRODUCTS…</div></div>:error?<div className="border-4 border-black bg-red-100 p-8"><div className="font-display font-black text-2xl uppercase">COULDN'T LOAD MARKETPLACE</div><p className="font-mono text-xs mt-2 break-words">{error}</p><button onClick={()=>void executeSearch()} className="mt-4 border-2 border-black bg-[var(--color-primary)] px-3 py-2 font-mono text-[9px] font-black uppercase">TRY AGAIN</button></div>:displayRows.length===0?<div className="border-4 border-dashed border-black bg-white p-12 text-center"><Filter className="w-10 h-10 mx-auto"/><div className="font-display font-black text-3xl uppercase mt-3">NO PRODUCTS FOUND</div><p className="font-mono text-xs text-neutral-500 mt-2">Try a different search or remove some filters.</p></div>:<><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{displayRows.map(p=><MarketplaceProductCard key={p.id} product={p} price={prices[p.id]} owned={owned.has(p.id)} saved={saved.has(p.id)} onOpen={(id)=>openProduct(id,'search')} onToggleSave={(product)=>void toggleSave(product)}/>)}</div>{hasMore&&<div className="mt-8 text-center"><button onClick={()=>void loadMore()} disabled={searching} className="border-4 border-black bg-black text-white px-6 py-3 font-mono text-[10px] font-black uppercase hover:bg-[var(--color-primary)] hover:text-black disabled:opacity-50">LOAD MORE</button></div>}<div className="mt-5 font-mono text-[8px] text-neutral-500 uppercase">{priceFilter==='any' ? `${resultTotal} PRODUCTS` : `${displayRows.length} SHOWN · ${resultTotal} DISCOVERY CANDIDATES`} · FILTERED DISCOVERY</div></>}</div>
      </div>
   </section>}
  </div>
 </div>;
};
