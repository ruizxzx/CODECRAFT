import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Check, CheckCheck, Settings2 } from 'lucide-react';
import { CommunityUser, Notification, PageView } from '../types';
import { markAllNotificationsRead, markNotificationRead, subscribeUserNotifications } from '../lib/community';

interface Props { userProfile: CommunityUser | null; onNavigate: (page: PageView, param?: string) => void; }

const groupLabel = (iso?: string) => {
  const d = iso ? new Date(iso) : new Date();
  const now = new Date();
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (day === today) return 'TODAY';
  if (day === today - 86400000) return 'YESTERDAY';
  return 'THIS WEEK';
};
const formatTime = (iso?: string) => iso ? new Date(iso).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }) : '';

export const NotificationsView: React.FC<Props> = ({ userProfile, onNavigate }) => {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  useEffect(() => {
    if (!userProfile) { setItems([]); setLoading(false); return; }
    setLoading(true);
    const unsub = subscribeUserNotifications(userProfile.uid, next => { setItems(next); setLoading(false); });
    return unsub;
  }, [userProfile?.uid]);
  const groups = useMemo(() => {
    const out: Record<string, Notification[]> = {};
    items.forEach(n => { const key = groupLabel(n.createdAt); (out[key] ||= []).push(n); });
    return out;
  }, [items]);
  const groupedRows = useMemo(() => Object.entries(groups).flatMap(([key, list]) => {
    const result: Array<{ kind:'single'|'batch'; key:string; item?:Notification; list?:Notification[] }> = [];
    let i = 0;
    while (i < list.length) {
      const first = list[i];
      const same = list.slice(i).filter(n => n.type === first.type && n.targetType === first.targetType && n.targetId === first.targetId && n.actorId !== first.actorId);
      if (same.length >= 3) {
        const batch = list.slice(i, i + Math.min(6, same.length));
        result.push({ kind:'batch', key:`${key}:batch:${first.id}`, list:batch }); i += batch.length;
      } else { result.push({ kind:'single', key:first.id, item:first }); i += 1; }
    }
    return [{ kind:'day', key } as any, ...result];
  }), [groups]);
  const open = (n: Notification) => {
    void markNotificationRead(userProfile!.uid, n.id).catch((error) => console.warn('OFFSCRPT recoverable operation failed:', error));
    if (n.targetType === 'post' && n.targetId) onNavigate('community_post', n.targetId);
    else if (n.targetType === 'article' && n.targetId) onNavigate('article', n.targetId);
    else if (n.targetType === 'question' && n.targetId) onNavigate('social', 'questions');
    else if (n.targetType === 'profile' && n.targetId) onNavigate('community_profile', n.targetId);
    else if (n.actorUsername) onNavigate('community_profile', n.actorUsername);
  };
  const markAll = async () => { if (!userProfile || markingAll || !items.some(n=>!n.read)) return; setMarkingAll(true); try { await markAllNotificationsRead(userProfile.uid); } finally { setMarkingAll(false); } };
  if (!userProfile) return <div className="max-w-2xl mx-auto py-24 px-4 text-center"><Bell className="w-10 h-10 mx-auto mb-4"/><h2 className="font-display font-black text-2xl uppercase">Sign in for notifications</h2></div>;
  return <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-8"><div className="flex items-center gap-3"><Bell className="w-7 h-7"/><h1 className="font-display font-black text-3xl uppercase">Notifications</h1><span className="border-2 border-black bg-[var(--color-primary)] px-2 py-1 font-mono text-[9px] font-black">{items.filter(n=>!n.read).length} UNREAD</span></div><div className="flex gap-2"><button disabled={markingAll} onClick={()=>void markAll()} className="border-2 border-black bg-white px-3 py-2 font-mono text-[9px] font-black uppercase inline-flex items-center gap-2"><CheckCheck className="w-4 h-4"/>{markingAll?'MARKING…':'MARK ALL READ'}</button><button onClick={()=>onNavigate('preferences')} className="border-2 border-black bg-white px-3 py-2 font-mono text-[9px] font-black uppercase inline-flex items-center gap-2"><Settings2 className="w-4 h-4"/> SETTINGS</button></div></div>
    {loading ? <div className="py-20 text-center font-mono text-xs uppercase">SYNCING NOTIFICATIONS…</div> : items.length === 0 ? <div className="border-4 border-black p-10 text-center font-mono text-sm">NO NOTIFICATIONS YET.</div> : <div className="space-y-6">{groupedRows.map((row:any)=> row.kind==='day' ? <div key={row.key} className="font-mono text-[10px] font-black uppercase border-b-2 border-black pb-2">{row.key}</div> : row.kind==='batch' ? <button key={row.key} onClick={()=>row.list?.forEach((n:Notification)=>open(n))} className="w-full text-left border-2 border-black bg-white p-4 hover:bg-neutral-50"><div className="font-mono text-xs font-black">{row.list?.length} people {row.list?.[0]?.message || 'interacted with your content'}</div><div className="font-mono text-[10px] text-neutral-500 mt-1">{row.list?.slice(0,3).map((n:Notification)=>`@${n.actorUsername}`).join(', ')}{row.list?.length>3?' + more':''}</div></button> : <button key={row.key} onClick={()=>open(row.item!)} className={`w-full text-left border-2 border-black p-4 flex gap-3 hover:bg-neutral-50 ${row.item?.read?'bg-white':'bg-[var(--color-secondary)]/20'}`}><div className="w-10 h-10 border-2 border-black rounded-full overflow-hidden shrink-0">{row.item?.actorAvatar?<img src={row.item.actorAvatar} className="w-full h-full object-cover"/>:<Bell className="w-full h-full p-2"/>}</div><div className="min-w-0 flex-1"><div className="font-mono text-xs"><b>@{row.item?.actorUsername}</b> {row.item?.message}</div><div className="text-[10px] text-neutral-500 mt-1">{formatTime(row.item?.createdAt)}</div></div>{!row.item?.read&&<Check className="ml-auto w-4 h-4 shrink-0"/>}</button>)}</div>}
  </div>;
};
