import React, { useCallback, useEffect, useState } from 'react';
import { Activity, CircleDollarSign, Database, RefreshCw, ShieldCheck } from 'lucide-react';
import { auth } from '../lib/firebase';
import { notifyToast } from '../lib/toast';

const collections = [
  ['commerceProducts','PRODUCTS'],['commercePrices','PRICES'],['commerceOrders','ORDERS'],['commercePayments','PAYMENTS'],
  ['commerceRefunds','REFUNDS'],['entitlements','ENTITLEMENTS'],['creatorRevenue','REVENUE LEDGER'],['creatorPayouts','PAYOUT LEDGER'],
  ['commerceAuditLogs','AUDIT EVENTS'],['commerceWebhookEvents','WEBHOOK EVENTS']
] as const;

export const CommerceAdminPanel: React.FC = () => {
  const [counts,setCounts]=useState<Record<string,number>>({});
  const [loading,setLoading]=useState(false);
  const refresh=useCallback(async()=>{
    setLoading(true);
    try{
      const user=auth.currentUser;
      if(!user) throw new Error('Sign in required.');
      const token=await user.getIdToken();
      const response=await fetch('/api/commerce?action=diagnostics',{method:'POST',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},body:'{}'});
      const payload:any=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(String(payload?.error||'Commerce diagnostics unavailable.'));
      setCounts(payload.counts||{});
      if(payload.errors && Object.keys(payload.errors).length) notifyToast('Some commerce diagnostics could not be loaded.','error');
    }catch(e:any){ notifyToast(e?.message||'Commerce diagnostics unavailable.','error'); }
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void refresh();},[refresh]);
  const cards=collections.map(([name,label])=>({name,label,value:counts[name] ?? 0}));
  return <div className="space-y-5">
    <header className="border-4 border-black bg-black text-white p-6 neo-shadow-lg"><div className="font-mono text-[10px] font-black text-[var(--color-primary)] flex items-center gap-2"><CircleDollarSign className="w-4 h-4"/> MASTER CONTROL · COMMERCE</div><h2 className="font-display font-black text-4xl uppercase mt-2">Commerce Diagnostics</h2><p className="text-sm text-neutral-300 mt-2 max-w-3xl">Read-only operational counters for the V86 commerce foundation. Financial mutation remains server-authoritative.</p></header>
    <div className="flex flex-wrap gap-2"><button onClick={()=>void refresh()} className="border-2 border-black bg-white px-3 py-2 font-mono text-[9px] font-black uppercase"><RefreshCw className="inline w-3 h-3"/> {loading?'LOADING':'REFRESH'}</button><span className="border-2 border-black bg-[var(--color-primary)] px-3 py-2 font-mono text-[9px] font-black uppercase"><ShieldCheck className="inline w-3 h-3"/> SERVER-AUTHORITATIVE</span></div>
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">{cards.map(c=><div key={c.name} className="border-2 border-black bg-white p-4"><div className="font-mono text-[8px] font-black uppercase flex items-center gap-1"><Database className="w-3 h-3"/>{c.label}</div><div className="font-display font-black text-3xl mt-2">{c.value.toLocaleString()}</div><div className="font-mono text-[8px] text-neutral-500 mt-1">/{c.name}</div></div>)}</div>
    <div className="border-2 border-black bg-white p-5 font-mono text-[9px]"><Activity className="w-4 h-4 mb-2"/><div className="font-black uppercase">Operational rule</div><p className="mt-2 text-neutral-600">Counts are diagnostics only. Do not infer successful payment, entitlement validity, or payout eligibility from a counter. Inspect the underlying server-authoritative record when investigating an incident.</p></div>
  </div>;
};
