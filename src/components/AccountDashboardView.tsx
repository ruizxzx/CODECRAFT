import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Bell, BookOpen, Bookmark, CheckCircle2, Clock3, ExternalLink, History, ListTodo, Loader2, Settings, Sparkles, Trash2, User, Package } from 'lucide-react';
import { useAuthUser } from '../lib/useAuthUser';
import { loginWithGoogle } from '../lib/firebase';
import { getUserSaves, getUserNotifications } from '../lib/community';
import { subscribeArticleHistory, type ArticleHistoryItem } from '../lib/reading';
import { getNotificationPreferences, type NotificationPreferences, subscribeNotificationPreferences, getReadingQueue, removeReadingQueueItem, type ReadingQueueItem, mergeDashboardData, type AccountActivity, getAccountDrafts, deleteAccountDraft, type DraftSummary } from '../lib/account';
import type { CommunityUser, Notification, PageView, UserSavedItem, Article } from '../types';

interface Props {
  onNavigate: (page: PageView, param?: string) => void;
  articles: Article[];
  userProfile: CommunityUser | null;
}

const timeLabel = (value?: string) => value ? new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'RECENTLY';

export const AccountDashboardView: React.FC<Props> = ({ onNavigate, articles, userProfile }) => {
  const user = useAuthUser();
  const [saved, setSaved] = useState<UserSavedItem[]>([]);
  const [history, setHistory] = useState<ArticleHistoryItem[]>([]);
  const [queue, setQueue] = useState<ReadingQueueItem[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [prefs, setPrefs] = useState<NotificationPreferences>({ comments: true, replies: true, mentions: true, follows: true, reactions: true, productNews: true });
  const [activity, setActivity] = useState<AccountActivity[]>([]);
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    let dead = false;
    const load = async () => {
      const [s, n, q, p, d] = await Promise.all([getUserSaves(user.uid), getUserNotifications(user.uid), getReadingQueue(), getNotificationPreferences(), getAccountDrafts()]);
      if (dead) return;
      setSaved(s); setNotifications(n); setQueue(q); setPrefs(p); setDrafts(d);
      setLoading(false);
    };
    void load();
    const unsubHistory = subscribeArticleHistory((h) => { setHistory(h); setActivity((prev) => mergeDashboardData(saved, h, notifications)); }, 60);
    const unsubPrefs = subscribeNotificationPreferences(setPrefs);
    return () => { dead = true; unsubHistory(); unsubPrefs(); };
  }, [user?.uid]);

  useEffect(() => {
    if (!user) return;
    void getReadingQueue().then(setQueue).catch(() => setQueue([]));
  }, [user?.uid]);

  useEffect(() => {
    if (user) setActivity(mergeDashboardData(saved, history, notifications));
  }, [user?.uid, saved, history, notifications]);

  const unread = notifications.filter((n) => !n.read).length;
  const savedArticleCount = saved.filter((x) => x.itemType === 'article').length;
  const continueArticle = useMemo(() => history.find((x) => (x.progress || 0) > 0 && (x.progress || 0) < 100)?.slug, [history]);
  const continueTitle = continueArticle ? articles.find((a) => a.slug === continueArticle)?.title : undefined;

  const togglePref = async (key: keyof NotificationPreferences) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    try { const { saveNotificationPreferences } = await import('../lib/account'); await saveNotificationPreferences(next); } catch { setPrefs(prefs); }
  };

  const removeQueue = async (item: ReadingQueueItem) => {
    setQueue((prev) => prev.filter((x) => x.id !== item.id));
    try { await removeReadingQueueItem(item.itemType, item.itemId); } catch { setQueue(await getReadingQueue()); }
  };

  if (!user) {
    return <section className="max-w-3xl mx-auto px-4 py-20 sm:py-28 text-center"><Sparkles className="w-12 h-12 mx-auto mb-4"/><div className="font-mono text-[10px] uppercase text-neutral-500">YOUR PRIVATE CONTROL CENTER</div><h1 className="font-display font-black text-4xl sm:text-6xl uppercase mt-2">MY OFFSCRPT</h1><p className="mt-4 text-neutral-600">Sign in to sync reading progress, bookmarks, queue, history, notifications and account activity.</p><button onClick={()=>loginWithGoogle()} className="mt-6 border-2 border-black bg-[var(--color-primary)] px-5 py-3 font-mono text-[10px] font-black uppercase">SIGN IN WITH GOOGLE</button></section>;
  }

  return <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-14">
    <header className="border-4 border-black bg-[var(--color-primary)] neo-shadow-lg p-5 sm:p-8 mb-8 flex flex-wrap items-end justify-between gap-6">
      <div><div className="font-mono text-[10px] uppercase font-black">ACCOUNT CONTROL CENTER</div><h1 className="font-display font-black text-4xl sm:text-6xl uppercase leading-none mt-2">MY OFFSCRPT</h1><p className="mt-3 max-w-xl">Everything you save, read, follow and configure — synced to your account.</p></div>
      <div className="flex flex-wrap gap-2 items-center">
        <button onClick={()=>userProfile?.username ? onNavigate('community_profile', userProfile.username) : onNavigate('preferences')} className="border-2 border-black bg-white px-4 py-3 font-mono text-[10px] font-black uppercase inline-flex items-center gap-2"><User className="w-4 h-4"/> {userProfile?.username ? `@${userProfile.username}` : (userProfile?.displayName || user.displayName || 'ACCOUNT')}</button>
        <button onClick={()=>onNavigate('activity')} className="border-2 border-black bg-white px-4 py-3 font-mono text-[10px] font-black uppercase inline-flex items-center gap-2"><Activity className="w-4 h-4"/> ACTIVITY</button>
        <button onClick={()=>onNavigate('creator_studio')} className="border-2 border-black bg-black text-white px-4 py-3 font-mono text-[10px] font-black uppercase">CREATOR STUDIO</button>
      </div>
    </header>

    {loading ? <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin"/></div> : <>
      {continueArticle && <button onClick={()=>onNavigate('article', continueArticle)} className="w-full mb-8 border-4 border-black bg-black text-white p-5 text-left neo-shadow-lg hover:bg-[var(--color-primary)] hover:text-black"><div className="font-mono text-[10px] uppercase text-[var(--color-primary)]">CONTINUE READING</div><div className="font-display font-black text-2xl uppercase mt-1">{continueTitle || continueArticle}</div><div className="font-mono text-[10px] mt-2">RESUME FROM YOUR LAST CLOUD CHECKPOINT →</div></button>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <button onClick={()=>onNavigate('purchases')} className="border-2 border-black p-4 text-left bg-black text-white hover:bg-[var(--color-primary)] hover:text-black"><Package className="w-5 h-5"/><div className="font-mono text-[9px] uppercase mt-4">PURCHASES</div><div className="font-display font-black text-2xl uppercase mt-2">MY LIBRARY</div><div className="font-mono text-[9px] mt-1">DIGITAL DOWNLOADS</div></button>
        <button onClick={()=>onNavigate('saved')} className="border-2 border-black p-4 text-left bg-white hover:bg-[var(--color-primary)]"><Bookmark className="w-5 h-5"/><div className="font-mono text-[9px] uppercase mt-4">SAVED</div><div className="font-display font-black text-3xl">{saved.length}</div><div className="font-mono text-[9px] mt-1">{savedArticleCount} ARTICLES</div></button>
        <button onClick={()=>onNavigate('history')} className="border-2 border-black p-4 text-left bg-white hover:bg-[var(--color-secondary)]"><History className="w-5 h-5"/><div className="font-mono text-[9px] uppercase mt-4">HISTORY</div><div className="font-display font-black text-3xl">{history.length}</div><div className="font-mono text-[9px] mt-1">NO DUPLICATE OPENS</div></button>
        <button onClick={()=>onNavigate('notifications')} className="border-2 border-black p-4 text-left bg-white hover:bg-[var(--color-accent)]"><Bell className="w-5 h-5"/><div className="font-mono text-[9px] uppercase mt-4">NOTIFICATIONS</div><div className="font-display font-black text-3xl">{unread}</div><div className="font-mono text-[9px] mt-1">UNREAD</div></button>
        <button onClick={()=>onNavigate('preferences')} className="border-2 border-black p-4 text-left bg-white hover:bg-neutral-100"><Settings className="w-5 h-5"/><div className="font-mono text-[9px] uppercase mt-4">PREFERENCES</div><div className="font-display font-black text-2xl uppercase mt-2">CONTROL</div><div className="font-mono text-[9px] mt-1">NOTIFICATION + APPEARANCE</div></button>
        <div className="border-2 border-black p-4 text-left bg-white"><div className="font-mono text-[9px] uppercase">DRAFTS</div><div className="font-display font-black text-3xl mt-2">{drafts.length}</div><div className="font-mono text-[9px] mt-1">AUTO-SAVED / RECOVERABLE</div></div>
      </div>

      {drafts.length>0 && <section className="border-4 border-black bg-white neo-shadow p-5 mb-5"><div className="flex items-center justify-between gap-3 mb-4"><div><div className="font-mono text-[10px] uppercase">CREATOR STUDIO</div><h2 className="font-display font-black text-3xl uppercase">DRAFT MANAGER</h2></div><div className="font-mono text-[9px] text-neutral-500">{drafts.length} CLOUD DRAFTS</div></div><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{drafts.map(d=><div key={d.id} className="border-2 border-black p-3"><div className="font-mono text-[9px] text-neutral-500 uppercase">{d.type||'draft'} · {d.updatedAt?timeLabel(d.updatedAt):'recent'}</div><div className="font-display font-black uppercase mt-1 line-clamp-2">{d.title}</div><div className="font-mono text-[9px] mt-2">{d.wordCount||0} WORDS</div><button onClick={()=>{void deleteAccountDraft(d.id).then(()=>setDrafts(prev=>prev.filter(x=>x.id!==d.id)));}} className="mt-3 border-2 border-black px-2 py-1 font-mono text-[9px] font-black">DELETE DRAFT</button></div>)}</div></section>}

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 border-4 border-black bg-white neo-shadow p-5">
          <div className="flex items-center justify-between gap-3 mb-5"><div><div className="font-mono text-[10px] uppercase">YOUR READING QUEUE</div><h2 className="font-display font-black text-3xl uppercase">READ NEXT</h2></div><button onClick={()=>onNavigate('saved')} className="font-mono text-[10px] font-black underline">MANAGE SAVED</button></div>
          {!queue.length ? <div className="border-2 border-dashed border-black p-8 text-center"><ListTodo className="w-8 h-8 mx-auto mb-2"/><div className="font-display font-black uppercase">QUEUE IS EMPTY</div><button onClick={()=>onNavigate('blog')} className="mt-3 border-2 border-black bg-[var(--color-primary)] px-3 py-2 font-mono text-[9px] font-black uppercase">FIND SOMETHING TO READ</button></div> : <div className="space-y-2">{queue.slice(0, 8).map((item) => <div key={item.id} className="border-2 border-black p-3 flex items-center gap-3"><button onClick={()=>item.itemType==='article' ? onNavigate('article', item.itemId) : onNavigate('community_post', item.itemId)} className="flex-1 min-w-0 text-left"><div className="font-display font-black uppercase truncate">{item.title}</div><div className="font-mono text-[9px] uppercase text-neutral-500 mt-1">{item.itemType} · {timeLabel(item.createdAt)}</div></button><button onClick={()=>removeQueue(item)} className="border-2 border-black bg-white p-2 hover:bg-red-100" aria-label="Remove from reading queue"><Trash2 className="w-4 h-4"/></button></div>)}</div>}
        </div>

        <div className="border-4 border-black bg-white neo-shadow p-5">
          <div className="flex items-center gap-2 mb-5"><Activity className="w-5 h-5"/><div><div className="font-mono text-[10px] uppercase">ACCOUNT ACTIVITY</div><h2 className="font-display font-black text-3xl uppercase">RECENT</h2></div></div>
          <div className="space-y-3 max-h-[520px] overflow-auto pr-1">{activity.slice(0, 10).map((a) => <button key={a.id} onClick={()=>a.targetType==='article'&&a.targetSlug ? onNavigate('article', a.targetSlug) : a.targetType==='post'&&a.targetSlug ? onNavigate('community_post', a.targetSlug) : onNavigate('notifications')} className="w-full text-left border-b-2 border-black pb-3"><div className="font-mono text-[9px] uppercase text-neutral-500">{a.kind} · {timeLabel(a.at)}</div><div className="font-display font-black uppercase mt-1 line-clamp-2">{a.title}</div><div className="font-mono text-[9px] mt-1">{a.subtitle}</div></button>)}{!activity.length && <div className="font-mono text-xs text-neutral-500">NO ACTIVITY YET.</div>}</div>
        </div>
      </div>
    </>}
  </section>;
};
