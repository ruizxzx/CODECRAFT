import React, { useEffect, useState } from 'react';
import { Loader2, Bell, Check } from 'lucide-react';
import { CommunityUser, Notification, PageView } from '../types';
import { getUserNotifications, markNotificationsRead } from '../lib/community';

interface Props { userProfile: CommunityUser | null; onNavigate: (page: PageView, param?: string) => void; }
export const NotificationsView: React.FC<Props> = ({ userProfile, onNavigate }) => {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!userProfile) { setItems([]); setLoading(false); return; }
    setLoading(true);
    getUserNotifications(userProfile.uid).then(setItems).catch(console.error).finally(() => setLoading(false));
    markNotificationsRead(userProfile.uid).catch(() => {});
  }, [userProfile]);
  if (!userProfile) return <div className="max-w-2xl mx-auto py-24 px-4 text-center"><Bell className="w-10 h-10 mx-auto mb-4"/><h2 className="font-display font-black text-2xl uppercase">Sign in for notifications</h2></div>;
  return <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
    <div className="flex items-center gap-3 mb-8"><Bell className="w-7 h-7"/><h1 className="font-display font-black text-3xl uppercase">Notifications</h1></div>
    {loading ? <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin"/></div> : items.length === 0 ? <div className="border-4 border-black p-10 text-center font-mono text-sm">NO NOTIFICATIONS YET.</div> : <div className="space-y-2">{items.map(n => <button key={n.id} onClick={() => n.targetType === 'post' && n.targetId ? onNavigate('community_post', n.targetId) : n.targetType === 'article' && n.targetId ? onNavigate('article', n.targetId) : n.actorUsername ? onNavigate('community_profile', n.actorUsername) : undefined} className="w-full text-left border-2 border-black bg-white p-4 flex gap-3 hover:bg-neutral-50"><div className="w-10 h-10 border-2 border-black rounded-full overflow-hidden shrink-0">{n.actorAvatar ? <img src={n.actorAvatar} className="w-full h-full object-cover"/> : <Bell className="w-full h-full p-2"/>}</div><div className="min-w-0"><div className="font-mono text-xs"><b>@{n.actorUsername}</b> {n.message}</div><div className="text-[10px] text-neutral-500 mt-1">{new Date(n.createdAt).toLocaleString('en-IN')}</div></div>{!n.read && <Check className="ml-auto w-4 h-4"/>}</button>)}</div>}
  </div>;
};
