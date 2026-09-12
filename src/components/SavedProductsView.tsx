import React, { useEffect, useMemo, useState } from 'react';
import { Bookmark, Loader2, Package, RefreshCcw } from 'lucide-react';
import type { CommunityUser, PageView } from '../types';
import { getSavedMarketplaceProductIds, getMarketplaceProductsByIds, toggleMarketplaceSave, recordMarketplaceEvent } from '../lib/marketplace';
import { listUserEntitlements, type CommerceEntitlement, type CommerceProduct, type CommercePublicPrice } from '../lib/commerce';
import { MarketplaceProductCard } from './MarketplaceProductCard';
import { auth, loginWithGoogle } from '../lib/firebase';
import { notifyToast } from '../lib/toast';
import { useAuthUser } from '../lib/useAuthUser';

interface Props { onNavigate:(page:PageView,param?:string)=>void; userProfile:CommunityUser|null; }

export const SavedProductsView:React.FC<Props>=({onNavigate})=>{
  const user=useAuthUser();
  const [ids,setIds]=useState<string[]>([]);
  const [products,setProducts]=useState<CommerceProduct[]>([]);
  const [prices,setPrices]=useState<Record<string,CommercePublicPrice|undefined>>({});
  const [owned,setOwned]=useState<Set<string>>(new Set());
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  const load=async()=>{
    const uid=auth.currentUser?.uid;
    if(!uid){setIds([]);setProducts([]);setLoading(false);return;}
    setLoading(true);setError('');
    try{
      const savedIds=await getSavedMarketplaceProductIds(uid);
      const result=await getMarketplaceProductsByIds(savedIds);
      const ents=await listUserEntitlements(uid).catch(()=>[] as CommerceEntitlement[]);
      const ownedIds=new Set(ents.filter(e=>e.status==='active'&&e.resourceType==='product').map(e=>e.resourceId));
      const byId=new Map(result.products.map(p=>[p.id,p]));
      setIds(savedIds.filter(id=>byId.has(id)));setProducts(savedIds.map(id=>byId.get(id)).filter(Boolean) as CommerceProduct[]);setPrices(result.prices||{});setOwned(ownedIds);
    }catch(e:any){setError(e?.message||'Could not load saved products.');}
    finally{setLoading(false);}
  };
  useEffect(()=>{void load();},[user?.uid]);
  const empty=useMemo(()=>!loading && products.length===0,[loading,products.length]);
  if(!user) return <section className="max-w-3xl mx-auto px-4 py-24 text-center"><Bookmark className="w-12 h-12 mx-auto mb-4"/><div className="font-mono text-[10px] uppercase text-neutral-500">PRIVATE BUYER LIBRARY</div><h1 className="font-display font-black text-4xl sm:text-6xl uppercase mt-2">SAVED PRODUCTS</h1><p className="mt-4 text-neutral-600">Sign in to access products you saved across OFFSCRPT.</p><button onClick={()=>void loginWithGoogle()} className="mt-6 border-2 border-black bg-[var(--color-primary)] px-5 py-3 font-mono text-[10px] font-black uppercase">SIGN IN WITH GOOGLE</button></section>;
  const remove=async(product:CommerceProduct)=>{
    try{await toggleMarketplaceSave(product,true);setIds(p=>p.filter(x=>x!==product.id));setProducts(p=>p.filter(x=>x.id!==product.id));notifyToast('Removed from saved products.','success');}catch(e:any){notifyToast(e?.message||'Could not update saved product.','error');}
  };
  return <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-8">
      <div><div className="font-mono text-[10px] font-black uppercase text-neutral-500">BUYER LIBRARY</div><h1 className="font-display font-black text-5xl sm:text-7xl uppercase leading-none mt-1">SAVED PRODUCTS</h1><p className="mt-3 max-w-2xl text-sm text-neutral-600">Products you bookmarked for later. Saved privately to your OFFSCRPT account.</p></div>
      <div className="flex gap-2"><button onClick={()=>onNavigate('shop')} className="border-2 border-black bg-[var(--color-primary)] px-4 py-3 font-mono text-[9px] font-black uppercase">BROWSE SHOP</button><button onClick={()=>void load()} className="border-2 border-black bg-white px-4 py-3 font-mono text-[9px] font-black uppercase"><RefreshCcw className="inline w-3 h-3 mr-1"/>REFRESH</button></div>
    </div>
    {loading&&<div className="border-4 border-black bg-white p-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto"/><div className="font-mono text-xs font-black uppercase mt-3">LOADING SAVED PRODUCTS…</div></div>}
    {!loading&&error&&<div className="border-4 border-black bg-red-100 p-8"><div className="font-display font-black text-2xl uppercase">COULDN'T LOAD SAVED PRODUCTS</div><p className="font-mono text-xs mt-2 break-words">{error}</p></div>}
    {empty&&<div className="border-4 border-dashed border-black p-12 text-center bg-white"><Bookmark className="w-10 h-10 mx-auto"/><div className="font-display font-black text-3xl uppercase mt-3">NO SAVED PRODUCTS</div><p className="font-mono text-xs text-neutral-500 mt-2">Save products from the Shop or creator storefronts to find them here.</p><button onClick={()=>onNavigate('shop')} className="mt-5 border-2 border-black bg-[var(--color-primary)] px-4 py-3 font-mono text-[9px] font-black uppercase">EXPLORE PRODUCTS</button></div>}
    {!loading&&!error&&products.length>0&&<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{products.map(product=><MarketplaceProductCard key={product.id} product={product} price={prices[product.id]} owned={owned.has(product.id)} saved onOpen={(id)=>{recordMarketplaceEvent('content_open',id,{source:'saved-products'});onNavigate('product',id)}} onToggleSave={()=>void remove(product)}/>)}</div>}
    {!loading&&ids.length>0&&products.length===0&&<div className="mt-5 font-mono text-[9px] text-neutral-500 uppercase">Some saved products are no longer publicly available and were hidden.</div>}
  </div>;
};
