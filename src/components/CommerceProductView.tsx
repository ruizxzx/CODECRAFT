import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, Image as ImageIcon, LockKeyhole, ShoppingBag, UserRound } from 'lucide-react';
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
  const [activeImage,setActiveImage]=useState(0);

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
        setProduct(p); setPrices(priceRows); setCreator(creatorRow); setOwned(alreadyOwned); setActiveImage(0);
      }catch(e:any){ if(active)setError(e?.message||'Could not load this product.'); }
      finally{if(active)setLoading(false);}
    })();
    return ()=>{active=false;};
  },[productId]);

  const primaryPrice=useMemo(()=>prices[0]||null,[prices]);
  // Keep every hook unconditional: this component renders loading/error states
  // before the product data arrives, so gallery must be derived before any
  // early return to preserve React hook order.
  const gallery=useMemo(()=>{
    const values=[...(product?.gallery||[])];
    if(product?.thumbnail && !values.includes(product.thumbnail)) values.unshift(product.thumbnail);
    return values.filter(Boolean).slice(0,12);
  },[product]);

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

  const currentImage=gallery[activeImage]||'';

  return <div className="min-h-screen bg-[#f6f6f3]">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8">
      <button onClick={()=>onNavigate('creator',product.creatorUsername||'')} className="border-2 border-black bg-white px-3 py-2 font-mono text-[9px] font-black uppercase inline-flex items-center gap-2 shadow-[3px_3px_0_#000]"><ArrowLeft className="w-3 h-3"/> BACK TO CREATOR</button>
      <div className="grid lg:grid-cols-[minmax(0,1.15fr)_420px] gap-6 mt-5 items-start">
        <section className="space-y-5">
          <div className="border-4 border-black bg-white overflow-hidden shadow-[7px_7px_0_#000]">
            <div className="aspect-[4/3] sm:aspect-[5/4] bg-neutral-100 relative">
              {currentImage ? <>
                <img src={currentImage} alt={product.title} className="w-full h-full object-cover"/>
                {gallery.length>1&&<>
                  <button aria-label="Previous image" onClick={()=>setActiveImage(i=>(i-1+gallery.length)%gallery.length)} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 border-2 border-black bg-white flex items-center justify-center shadow-[3px_3px_0_#000]"><ChevronLeft className="w-5 h-5"/></button>
                  <button aria-label="Next image" onClick={()=>setActiveImage(i=>(i+1)%gallery.length)} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 border-2 border-black bg-white flex items-center justify-center shadow-[3px_3px_0_#000]"><ChevronRight className="w-5 h-5"/></button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 border-2 border-black bg-white px-2 py-1 font-mono text-[8px] font-black">{activeImage+1}/{gallery.length}</div>
                </>}
              </> : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-12 h-12"/></div>}
            </div>
          </div>
          {gallery.length>1&&<div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
            {gallery.map((url,index)=><button key={`${url}-${index}`} aria-label={`View image ${index+1}`} onClick={()=>setActiveImage(index)} className={`aspect-square border-2 border-black overflow-hidden bg-white ${index===activeImage?'ring-2 ring-offset-2 ring-black':''}`}><img src={url} alt="" className="w-full h-full object-cover"/></button>)}
          </div>}
          <article className="border-4 border-black bg-white p-5 sm:p-8 shadow-[7px_7px_0_#000]">
            <div className="font-mono text-[9px] font-black text-neutral-500 uppercase">OFFSCRPT PRODUCT · {String(product.subtype||product.type).replaceAll('_',' ')}</div>
            <h1 className="font-display font-black text-4xl sm:text-6xl uppercase leading-[.9] mt-2 break-words">{product.title}</h1>
            {product.subtitle&&<p className="mt-3 font-mono text-xs sm:text-sm uppercase text-neutral-600">{product.subtitle}</p>}
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="border-2 border-black px-3 py-2 font-mono text-[8px] font-black uppercase bg-[var(--color-primary)]">{product.currency}</span>
              <span className="border-2 border-black px-3 py-2 font-mono text-[8px] font-black uppercase">DIGITAL PRODUCT</span>
              {product.version&&<span className="border-2 border-black px-3 py-2 font-mono text-[8px] font-black uppercase">V{product.version}</span>}
            </div>
            <div className="mt-7 whitespace-pre-wrap text-sm sm:text-base leading-7">{product.description}</div>
          </article>
        </section>
        <aside className="border-4 border-black bg-white shadow-[7px_7px_0_#000] lg:sticky lg:top-24 overflow-hidden">
          <div className="p-5 sm:p-6">
            <div className="font-mono text-[9px] font-black uppercase text-neutral-500">BUY THIS PRODUCT</div>
            <div className="mt-2 text-4xl sm:text-5xl font-display font-black">{primaryPrice?money(primaryPrice.amount,primaryPrice.currency):'UNAVAILABLE'}</div>
            {creator&&<button onClick={()=>onNavigate('creator',creator.username)} className="mt-5 w-full border-2 border-black p-3 text-left inline-flex items-center gap-3 bg-neutral-50 hover:bg-[var(--color-primary)]">
              <div className="w-11 h-11 border-2 border-black bg-white overflow-hidden shrink-0">{creator.photoURL?<img src={creator.photoURL} alt="" className="w-full h-full object-cover"/>:<UserRound className="w-full h-full p-2"/>}</div>
              <div className="min-w-0"><div className="font-mono text-[8px] text-neutral-500 uppercase">CREATED BY</div><div className="font-mono text-[10px] font-black uppercase truncate">@{creator.username}</div></div>
              <ExternalLink className="w-4 h-4 ml-auto"/>
            </button>}
            {owned?<div className="mt-5 border-2 border-black bg-[var(--color-primary)] text-black p-4 font-mono text-[10px] font-black uppercase flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/> YOU OWN THIS</div>:
              <button disabled={busy||!primaryPrice} onClick={()=>void purchase()} className="mt-5 w-full border-2 border-black bg-black text-white px-4 py-4 font-mono text-[10px] font-black uppercase disabled:opacity-40 inline-flex items-center justify-center gap-2 hover:bg-[var(--color-primary)] hover:text-black"><ShoppingBag className="w-4 h-4"/>{busy?'PROCESSING…':'BUY NOW'}</button>}
            <div className="mt-4 text-xs leading-5 text-neutral-600">Secure commerce access is confirmed server-side. Protected delivery will use the entitlement/download flow in the upcoming commerce builds.</div>
          </div>
        </aside>
      </div>
    </div>
  </div>;
};
