import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, ExternalLink, LockKeyhole, ShoppingBag, UserRound } from 'lucide-react';
import type { CommunityUser, PageView } from '../types';
import { getCommerceProduct, listCommercePrices, hasCommerceAccess, createCommerceCheckout, confirmTestPayment, type CommerceProduct, type CommercePublicPrice } from '../lib/commerce';
import { getProfileByUsername } from '../lib/community';
import { auth } from '../lib/firebase';
import { notifyToast } from '../lib/toast';

interface Props { productId:string; userProfile:CommunityUser|null; onNavigate:(page:PageView,param?:string)=>void; }
const money=(amount:number,currency:string)=>new Intl.NumberFormat(undefined,{style:'currency',currency}).format((Number(amount)||0)/100);
const safeUsername=(value:string)=>String(value||'').replace(/^@/,'').trim();

export const CommerceProductView:React.FC<Props>=({productId,userProfile,onNavigate})=>{
  const [product,setProduct]=useState<CommerceProduct|null>(null);
  const [prices,setPrices]=useState<CommercePublicPrice[]>([]);
  const [creator,setCreator]=useState<CommunityUser|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [owned,setOwned]=useState(false);
  const [error,setError]=useState('');

  useEffect(()=>{
    let active=true;
    (async()=>{
      setLoading(true); setError('');
      try{
        const p=await getCommerceProduct(productId);
        if(!p){ if(active){setProduct(null);setError('PRODUCT NOT AVAILABLE.');} return; }
        const [priceRows,creatorRow]=await Promise.all([
          listCommercePrices(p.id),
          p.creatorUsername ? getProfileByUsername(safeUsername(String(p.creatorUsername))) : Promise.resolve(null),
        ]);
        if(!active)return;
        const alreadyOwned=auth.currentUser ? await hasCommerceAccess(auth.currentUser.uid,'product',p.id).catch(()=>false) : false;
        if(!active)return;
        setProduct(p); setPrices(priceRows); setCreator(creatorRow); setOwned(alreadyOwned);
      }catch(e:any){ if(active)setError(e?.message||'Could not load this product.'); }
      finally{if(active)setLoading(false);}
    })();
    return ()=>{active=false;};
  },[productId]);

  const primaryPrice=useMemo(()=>prices[0]||null,[prices]);

  const purchase=async()=>{
    if(!product||!primaryPrice)return notifyToast('This product is not currently purchasable.','error');
    if(!auth.currentUser){notifyToast('Sign in to purchase this product.','info');return;}
    setBusy(true);
    try{
      const checkout=await createCommerceCheckout(product.id,primaryPrice.id,crypto.randomUUID());
      const done=await confirmTestPayment(checkout.order.id,checkout.payment.id,crypto.randomUUID());
      setOwned(Boolean(done.entitlement));
      notifyToast('Test purchase completed. Access has been granted.','success');
    }catch(e:any){notifyToast(e?.message||'Purchase failed.','error');}
    finally{setBusy(false);}
  };

  if(loading)return <div className="max-w-5xl mx-auto px-4 py-24 text-center font-mono text-xs uppercase">LOADING PRODUCT…</div>;
  if(!product)return <div className="max-w-3xl mx-auto px-4 py-24"><div className="border-4 border-black bg-white p-8 text-center"><div className="font-mono text-[10px] font-black">{error||'PRODUCT NOT FOUND.'}</div><button onClick={()=>onNavigate('creators')} className="mt-5 border-2 border-black bg-[var(--color-primary)] px-4 py-2 font-mono text-[10px] font-black uppercase">BACK TO CREATORS</button></div></div>;

  return <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
    <button onClick={()=>onNavigate('creator',product.creatorUsername||'')} className="border-2 border-black bg-white px-3 py-2 font-mono text-[9px] font-black uppercase inline-flex items-center gap-2"><ArrowLeft className="w-3 h-3"/> CREATOR</button>
    <div className="grid lg:grid-cols-[1.3fr_.7fr] gap-5 mt-5 items-start">
      <article className="border-4 border-black bg-white neo-shadow-lg p-6 sm:p-9">
        <div className="font-mono text-[10px] font-black text-neutral-500 uppercase">OFFSCRPT PRODUCT · {product.type.replace('_',' ')}</div>
        <h1 className="font-display font-black text-4xl sm:text-6xl uppercase leading-[.95] mt-2 break-words">{product.title}</h1>
        <p className="mt-5 text-base sm:text-lg whitespace-pre-wrap">{product.description}</p>
        <div className="mt-7 flex flex-wrap gap-2 font-mono text-[9px] font-black uppercase"><span className="border-2 border-black px-3 py-2">{product.currency}</span><span className="border-2 border-black px-3 py-2">DIGITAL PRODUCT</span><span className="border-2 border-black px-3 py-2">TEST MODE</span></div>
        <section className="mt-8 border-2 border-black bg-[var(--color-secondary)] p-5"><div className="font-mono text-[9px] font-black uppercase">Access</div><div className="mt-2 text-sm">Purchases are recorded server-side and access is granted only after the authoritative commerce flow completes.</div></section>
      </article>
      <aside className="border-4 border-black bg-black text-white p-6 sm:p-8 neo-shadow-lg sticky top-24">
        <div className="font-mono text-[9px] font-black text-[var(--color-primary)] uppercase">PURCHASE</div>
        <div className="mt-3 text-4xl font-display font-black">{primaryPrice?money(primaryPrice.amount,primaryPrice.currency):'UNAVAILABLE'}</div>
        {creator&&<button onClick={()=>onNavigate('creator',creator.username)} className="mt-5 w-full border-2 border-white p-3 text-left inline-flex items-center gap-3"><div className="w-10 h-10 border-2 border-white bg-white overflow-hidden shrink-0">{creator.photoURL?<img src={creator.photoURL} alt="" className="w-full h-full object-cover"/>:<UserRound className="w-full h-full p-2 text-black"/>}</div><span className="font-mono text-[10px] font-black uppercase">@{creator.username}</span><ExternalLink className="w-4 h-4 ml-auto"/></button>}
        {owned?<div className="mt-5 border-2 border-black bg-[var(--color-primary)] text-black p-4 font-mono text-[10px] font-black uppercase flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/> YOU OWN THIS</div>:<button disabled={busy||!primaryPrice} onClick={()=>void purchase()} className="mt-5 w-full border-2 border-black bg-[var(--color-primary)] text-black px-4 py-4 font-mono text-[10px] font-black uppercase disabled:opacity-40 inline-flex items-center justify-center gap-2"><ShoppingBag className="w-4 h-4"/>{busy?'PROCESSING…':'TEST PURCHASE'}</button>}
        <div className="mt-4 border-2 border-white p-3 font-mono text-[9px] uppercase text-neutral-300 inline-flex gap-2"><LockKeyhole className="w-3 h-3 shrink-0 mt-0.5"/> Server-authoritative commerce · no real money charged</div>
      </aside>
    </div>
  </div>;
};
