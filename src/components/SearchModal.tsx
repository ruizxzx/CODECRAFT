import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Article, CommunityPost, CommunityUser, Series, SiteConfig } from '../types';
import { getAllCommunityUsers, getAllCommentsForSearch, getPosts, extractHashtags } from '../lib/community';
import { getSeriesList } from '../lib/series';
import { getTopics, SocialTopic } from '../lib/social';
import { Search, X, ArrowUpRight, User, Hash, MessageSquare, FileText, Loader2, Layers } from 'lucide-react';
import { VerifiedBadge } from './VerifiedBadge';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  articles: Article[];
  onSelectArticle: (slug: string) => void;
  onNavigate: (page: any, param?: string) => void;
  siteConfig: SiteConfig;
}

type SearchTab = 'all' | 'articles' | 'posts' | 'series' | 'people' | 'hashtags' | 'comments';

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose, articles, onSelectArticle, onNavigate, siteConfig }) => {
  const brandName = `${siteConfig.logoPart1 || ''}${siteConfig.logoPart2 || ''}`.trim() || 'OFFSCRPT';
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<SearchTab>('all');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [users, setUsers] = useState<CommunityUser[]>([]);
  const [comments, setComments] = useState<Awaited<ReturnType<typeof getAllCommentsForSearch>>>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [topics, setTopics] = useState<SocialTopic[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) { setQuery(''); setTab('all'); return; }
    setTimeout(() => inputRef.current?.focus(), 50);
    let active = true;
    setLoading(true);
    Promise.all([getPosts(), getAllCommunityUsers(), getAllCommentsForSearch(), getSeriesList(100), getTopics()]).then(([p, u, c, s, t]) => {
      if (!active) return;
      setPosts(p); setUsers(u); setComments(c); setSeries(s); setTopics(t);
    }).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (isOpen) onClose(); }
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const q = query.trim().toLowerCase();
  const normalized = q.replace(/^[@#]/, '');
  const matchingArticles = useMemo(() => articles.filter(a => !q || [a.title,a.excerpt,a.category,...(a.tags||[])].some(v => String(v).toLowerCase().includes(normalized))), [articles,q,normalized]);
  const matchingPosts = useMemo(() => posts.filter(p => !q || [p.title,p.content,p.authorUsername,p.authorName,...(p.hashtags||[]),...extractHashtags(`${p.title} ${p.content}`)].some(v => String(v).toLowerCase().includes(normalized))), [posts,q,normalized]);
  const matchingSeries = useMemo(() => series.filter(s => s.visibility !== 'private' && s.status !== 'archived' && (!q || [s.title,s.description,...(s.tags||[]),s.ownerUsername||''].some(v => String(v).toLowerCase().includes(normalized)))), [series,q,normalized]);
  const matchingUsers = useMemo(() => users.filter(u => !q || u.username.toLowerCase().includes(normalized) || u.displayName.toLowerCase().includes(normalized) || (u.bio||'').toLowerCase().includes(normalized)), [users,q,normalized]);
  const matchingTags = useMemo(() => {
    const map = new Map<string,number>();
    posts.forEach(p => (p.hashtags || extractHashtags(`${p.title} ${p.content}`)).forEach(tag => map.set(tag,(map.get(tag)||0)+1)));
    articles.forEach(a => (a.tags||[]).forEach(tag => map.set(tag,(map.get(tag)||0)+1)));
    series.forEach(s => (s.tags||[]).forEach(tag => map.set(tag,(map.get(tag)||0)+1)));
    return [...map.entries()].filter(([tag]) => !q || tag.toLowerCase().includes(normalized)).sort((a,b)=>b[1]-a[1]);
  }, [posts,articles,series,q,normalized]);
  const matchingTopics = useMemo(() => topics.filter(t => !q || `${t.name} ${t.description}`.toLowerCase().includes(normalized)), [topics,q,normalized]);
  const matchingComments = useMemo(() => comments.filter(c => !q || c.content.toLowerCase().includes(normalized) || c.authorUsername.toLowerCase().includes(normalized) || c.authorName.toLowerCase().includes(normalized)), [comments,q,normalized]);

  const counts = { articles: matchingArticles.length, posts: matchingPosts.length, series: matchingSeries.length, people: matchingUsers.length, hashtags: matchingTags.length, comments: matchingComments.length, topics: matchingTopics.length };
  const sections = tab === 'all' ? (['articles','posts','series','people','topics','hashtags','comments'] as SearchTab[]) : [tab];

  if (!isOpen) return null;
  const tabButton = (id: SearchTab, label: string, count?: number) => <button onClick={() => setTab(id)} className={`px-2.5 py-1.5 border-2 border-black font-mono text-[9px] font-black uppercase ${tab===id ? 'bg-[var(--color-primary)]' : 'bg-white hover:bg-neutral-100'}`}>{label}{count !== undefined ? ` ${count}` : ''}</button>;

  return <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/70 backdrop-blur-xs">
    <div className="w-full max-w-3xl bg-white border-4 border-black neo-shadow-lg overflow-hidden">
      <div className="flex items-center px-4 py-3.5 border-b-4 border-black">
        <Search className="w-5 h-5 stroke-[3] mr-3 shrink-0" />
        <input ref={inputRef} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search everything: articles, posts, people, #hashtags, comments..." className="w-full font-display font-bold text-lg sm:text-xl outline-none" />
        {query && <button onClick={()=>setQuery('')} className="p-1 border-2 border-black mr-2"><X className="w-4 h-4" /></button>}
        <button onClick={onClose} className="px-2.5 py-1 bg-neutral-200 border-2 border-black font-mono text-xs font-bold">ESC</button>
      </div>
      {q && (matchingUsers.slice(0,3).length || matchingTopics.slice(0,3).length || matchingSeries.slice(0,3).length) && <div className="px-4 py-2 border-b-2 border-black bg-[var(--color-primary)] overflow-x-auto"><div className="flex gap-2 min-w-max items-center"><span className="font-mono text-[9px] font-black uppercase">Suggestions</span>{matchingUsers.slice(0,2).map(u=><button key={`s-user-${u.uid}`} onClick={()=>{onNavigate('creator',u.username);onClose();}} className="border-2 border-black bg-white px-2 py-1 font-mono text-[9px] font-black">@{u.username}</button>)}{matchingTopics.slice(0,2).map(t=><button key={`s-topic-${t.id}`} onClick={()=>{onNavigate('topic',t.slug);onClose();}} className="border-2 border-black bg-white px-2 py-1 font-mono text-[9px] font-black">#{t.slug}</button>)}{matchingSeries.slice(0,2).map(s=><button key={`s-series-${s.id}`} onClick={()=>{onNavigate('series',s.id);onClose();}} className="border-2 border-black bg-white px-2 py-1 font-mono text-[9px] font-black">{s.title}</button>)}</div></div>}
      <div className="px-4 py-3 border-b-2 border-black flex flex-wrap gap-2">
        {tabButton('all','All')} {tabButton('articles','Articles',counts.articles)} {tabButton('posts','Posts',counts.posts)} {tabButton('series','Series',counts.series)} {tabButton('people','People',counts.people)} {tabButton('topics','Topics',counts.topics)} {tabButton('hashtags','Tags',counts.hashtags)} {tabButton('comments','Comments',counts.comments)}
      </div>
      <div className="max-h-[65vh] overflow-y-auto p-4 space-y-5">
        {loading && <div className="flex items-center gap-2 font-mono text-xs uppercase"><Loader2 className="w-4 h-4 animate-spin"/>Indexing community search...</div>}
        {!q && <div className="bg-neutral-50 border-2 border-dashed border-black p-4 font-mono text-xs uppercase">Search across the complete public OFFSCRPT index.</div>}
        {sections.map(section => {
          if (section==='articles') return <section key={section}><h3 className="font-display font-black text-sm uppercase border-b-2 border-black pb-2 mb-2 flex items-center gap-2"><FileText className="w-4 h-4"/> Articles ({counts.articles})</h3><div className="space-y-2">{matchingArticles.slice(0,8).map(a=><button key={a.id} onClick={()=>{onSelectArticle(a.slug);onClose();}} className="w-full text-left p-3 border-2 border-black hover:bg-[var(--color-primary)] flex justify-between gap-3"><span><span className="font-mono text-[9px] uppercase">{a.category}</span><span className="block font-display font-black">{a.title}</span><span className="block text-xs text-neutral-600 line-clamp-1">{a.excerpt}</span></span><ArrowUpRight className="w-4 h-4 shrink-0"/></button>)}</div></section>;
          if (section==='series') return <section key={section}><h3 className="font-display font-black text-sm uppercase border-b-2 border-black pb-2 mb-2 flex items-center gap-2"><Layers className="w-4 h-4"/> Series ({counts.series})</h3><div className="space-y-2">{matchingSeries.slice(0,8).map(s=><button key={s.id} onClick={()=>{onNavigate('series',s.id);onClose();}} className="w-full text-left p-3 border-2 border-black hover:bg-[var(--color-primary)] flex justify-between gap-3"><span><span className="font-mono text-[9px] uppercase">{s.articleCount||0} PARTS · {s.ownerUsername?'@'+s.ownerUsername:'CREATOR'}</span><span className="block font-display font-black">{s.title}</span><span className="block text-xs text-neutral-600 line-clamp-1">{s.description}</span></span><ArrowUpRight className="w-4 h-4 shrink-0"/></button>)}</div></section>;
          if (section==='posts') return <section key={section}><h3 className="font-display font-black text-sm uppercase border-b-2 border-black pb-2 mb-2 flex items-center gap-2"><MessageSquare className="w-4 h-4"/> Community Posts ({counts.posts})</h3><div className="space-y-2">{matchingPosts.slice(0,8).map(p=><button key={p.id} onClick={()=>{onNavigate('community_post',p.id);onClose();}} className="w-full text-left p-3 border-2 border-black hover:bg-[var(--color-secondary)]"><span className="font-mono text-[9px] uppercase">@{p.authorUsername}</span><span className="block font-display font-black">{p.title}</span><span className="block text-xs text-neutral-600 line-clamp-1">{p.content}</span></button>)}</div></section>;
          if (section==='people') return <section key={section}><h3 className="font-display font-black text-sm uppercase border-b-2 border-black pb-2 mb-2 flex items-center gap-2"><User className="w-4 h-4"/> People ({counts.people})</h3><div className="space-y-2">{matchingUsers.slice(0,10).map(u=><button key={u.uid} onClick={()=>{onNavigate('community_profile',u.username);onClose();}} className="w-full text-left p-3 border-2 border-black hover:bg-[var(--color-accent)] flex items-center gap-3">{u.photoURL?<img src={u.photoURL} className="w-9 h-9 rounded-full border-2 border-black object-cover"/>:<div className="w-9 h-9 rounded-full border-2 border-black flex items-center justify-center font-black">{u.displayName.charAt(0)}</div>}<span><span className="font-display font-black uppercase flex items-center gap-1">{u.displayName}<VerifiedBadge verified={u.isVerified} color={u.verificationColor} className="w-4 h-4"/></span><span className="font-mono text-[10px] text-neutral-500">@{u.username}</span></span></button>)}</div></section>;
          if (section==='topics') return <section key={section}><h3 className="font-display font-black text-sm uppercase border-b-2 border-black pb-2 mb-2 flex items-center gap-2"><Hash className="w-4 h-4"/> Topics ({counts.topics})</h3><div className="space-y-2">{matchingTopics.slice(0,10).map(t=><button key={t.id} onClick={()=>{onNavigate('topic',t.slug);onClose();}} className="w-full text-left p-3 border-2 border-black hover:bg-[var(--color-primary)]"><span className="font-display font-black">{t.name}</span><span className="block text-xs text-neutral-600 line-clamp-1">{t.description}</span><span className="block font-mono text-[9px] text-neutral-500 mt-1">{t.followersCount||0} FOLLOWERS</span></button>)}</div></section>;
          if (section==='hashtags') return <section key={section}><h3 className="font-display font-black text-sm uppercase border-b-2 border-black pb-2 mb-2 flex items-center gap-2"><Hash className="w-4 h-4"/> Hashtags ({counts.hashtags})</h3><div className="flex flex-wrap gap-2">{matchingTags.slice(0,20).map(([tag,count])=><button key={tag} onClick={()=>{onNavigate('topic',tag);onClose();}} className="px-3 py-2 border-2 border-black bg-white hover:bg-[var(--color-primary)] font-mono text-xs font-black">#{tag} <span className="text-neutral-500">({count})</span></button>)}</div></section>;
          return <section key={section}><h3 className="font-display font-black text-sm uppercase border-b-2 border-black pb-2 mb-2 flex items-center gap-2"><MessageSquare className="w-4 h-4"/> Comments ({counts.comments})</h3><div className="space-y-2">{matchingComments.slice(0,8).map(c=><button key={`${c.id}-${c.postId||c.articleSlug}`} onClick={()=>{c.postId?onNavigate('community_post',c.postId):c.articleSlug?onNavigate('article',c.articleSlug):null;onClose();}} className="w-full text-left p-3 border-2 border-black hover:bg-neutral-100"><span className="font-mono text-[9px] uppercase text-neutral-500">@{c.authorUsername}</span><span className="block text-sm line-clamp-2">{c.content}</span></button>)}</div></section>;
        })}
        {q && !sections.some(section => ({articles:counts.articles,posts:counts.posts,series:counts.series,people:counts.people,topics:counts.topics,hashtags:counts.hashtags,comments:counts.comments}[section]||0)>0) && <div className="text-center py-12 border-2 border-dashed border-black"><p className="font-display font-black text-xl uppercase">No matches</p><p className="font-mono text-xs text-neutral-500 mt-2">Try a different keyword, @handle, or #hashtag.</p></div>}
      </div>
      <div className="px-4 py-2.5 bg-neutral-100 border-t-4 border-black flex items-center justify-between text-[10px] font-mono text-neutral-600"><span>GLOBAL SEARCH INDEX</span><span className="font-bold text-black">{brandName}</span></div>
    </div>
  </div>;
};
