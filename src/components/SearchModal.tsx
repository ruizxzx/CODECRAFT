import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Article, CommunityPost, CommunityUser, Series, SiteConfig } from '../types';
import { getAllCommunityUsers, getAllCommentsForSearch, getPosts, extractHashtags } from '../lib/community';
import { getSeriesList } from '../lib/series';
import { getTopics, SocialTopic, SocialQuestion } from '../lib/social';
import { Search, X, ArrowUpRight, User, Hash, MessageSquare, FileText, Loader2, Layers } from 'lucide-react';
import { VerifiedBadge } from './VerifiedBadge';
import { PostMediaPreview } from './PostMediaPreview';
import { auth, db } from '../lib/firebase';
import { emitActivityEvent } from '../lib/activity';
import { articleToContent, postToContent, questionToContent, seriesToContent, userToContent, topicToContent, normalizeContent } from '../lib/content';
import { searchEverything } from '../lib/unifiedSearch';
import type { ContentEntity } from '../lib/intelligence/types';
import { collection, addDoc, serverTimestamp, getDocs, limit, orderBy, query as firestoreQuery } from 'firebase/firestore';
import { parseDiscoveryQuery } from '../lib/discovery';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  articles: Article[];
  onSelectArticle: (slug: string) => void;
  onNavigate: (page: any, param?: string) => void;
  siteConfig: SiteConfig;
}

type SearchTab = 'all' | 'articles' | 'posts' | 'questions' | 'series' | 'people' | 'topics' | 'hashtags' | 'comments';

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose, articles, onSelectArticle, onNavigate, siteConfig }) => {
  const brandName = `${siteConfig.logoPart1 || ''}${siteConfig.logoPart2 || ''}`.trim() || 'OFFSCRPT';
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<SearchTab>('all');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [users, setUsers] = useState<CommunityUser[]>([]);
  const [comments, setComments] = useState<Awaited<ReturnType<typeof getAllCommentsForSearch>>>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [topics, setTopics] = useState<SocialTopic[]>([]);
  const [questions, setQuestions] = useState<SocialQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [questionSearchLoading, setQuestionSearchLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) { setQuery(''); setTab('all'); return; }
    setTimeout(() => inputRef.current?.focus(), 50);
    try { const saved = JSON.parse(localStorage.getItem('offscrpt:search:recent:v2') || '[]'); setRecentSearches(Array.isArray(saved) ? saved.map(String).slice(0,8) : []); } catch { setRecentSearches([]); }
    let active = true;
    setLoading(true);
    Promise.all([getPosts(), getAllCommunityUsers(), getAllCommentsForSearch(), getSeriesList(100), getTopics()]).then(([p, u, c, s, t]) => {
      if (!active) return;
      setPosts(p); setUsers(u); setComments(c); setSeries(s); setTopics(t);
    }).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [isOpen]);

  useEffect(() => {
    const value = query.trim();
    if (!auth.currentUser || value.length < 2) return;
    const timer = window.setTimeout(() => {
      const recent = [value.slice(0, 120), ...recentSearches.filter(x => x.toLowerCase() !== value.toLowerCase())].slice(0, 8);
      setRecentSearches(recent);
      try { localStorage.setItem('offscrpt:search:recent:v2', JSON.stringify(recent)); } catch {}
      void Promise.all([
        addDoc(collection(db, 'users', auth.currentUser!.uid, 'searches'), { query: value.slice(0, 120), createdAt: serverTimestamp() }),
        emitActivityEvent({ type: 'search', targetId: value.slice(0,120), targetType: 'search', source: 'global-search' }),
      ]).catch((error) => console.warn('Search behavior sync failed:', error));
    }, 900);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const q = query.trim();
    if (!isOpen || q.length < 2) { setQuestions([]); return; }
    let active = true;
    setQuestionSearchLoading(true);
    const timer = window.setTimeout(() => {
      void getDocs(firestoreQuery(collection(db, 'questions'), orderBy('createdAt', 'desc'), limit(60))).then((snap) => {
        if (!active) return;
        setQuestions(snap.docs.map(d => ({ id:d.id, ...(d.data() as any) })) as SocialQuestion[]);
      }).catch((error) => console.warn('Question search failed:', error)).finally(() => active && setQuestionSearchLoading(false));
    }, 150);
    return () => { active = false; window.clearTimeout(timer); };
  }, [isOpen, query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (isOpen) onClose(); }
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const q = query.trim().toLowerCase();
  const plan = useMemo(() => parseDiscoveryQuery(query), [query]);
  const normalized = plan.text.replace(/^[@#]/, '');
  const unifiedEntities = useMemo<ContentEntity[]>(() => [
    ...articles.map(articleToContent),
    ...posts.map(postToContent),
    ...questions.map(questionToContent),
    ...series.map(seriesToContent),
    ...users.map(userToContent),
    ...topics.map(topicToContent),
    ...comments.map(c => normalizeContent({ id: c.id, type: 'comment', authorId: (c as any).authorId, title: '', content: c.content, visibility: 'public', status: (c as any).isDeleted ? 'deleted' : 'published', createdAt: (c as any).createdAt, updatedAt: (c as any).updatedAt, sourceCollection: 'comments', sourcePath: c.id }))
  ], [articles,posts,questions,series,users,topics,comments]);
  const unifiedResults = useMemo(() => searchEverything(unifiedEntities, {
    query: normalized,
    viewer: { userId: auth.currentUser?.uid },
    limit: Math.max(120, unifiedEntities.length),
  }), [unifiedEntities, normalized]);
  const idsByType = useMemo(() => {
    const map = new Map<string, Set<string>>();
    unifiedResults.forEach(r => { const set = map.get(r.type) || new Set<string>(); set.add(r.id); map.set(r.type, set); });
    return map;
  }, [unifiedResults]);
  const rankMap = useMemo(() => new Map(unifiedResults.map((r, index) => [r.id, { index, score: r.score, reasons: r.reasons }])), [unifiedResults]);
  const sortByDiscovery = <T extends { id?: string }>(items: T[]) => [...items].sort((a,b) => (rankMap.get(String(a.id || ''))?.index ?? 99999) - (rankMap.get(String(b.id || ''))?.index ?? 99999));
  const matchingArticles = useMemo(() => [...articles].filter(a => idsByType.get('article')?.has(String(a.slug || a.id))).sort((a,b) => (rankMap.get(String(a.slug || a.id))?.index ?? 99999) - (rankMap.get(String(b.slug || b.id))?.index ?? 99999)), [articles,idsByType,rankMap]);
  const matchingPosts = useMemo(() => sortByDiscovery(posts.filter(p => idsByType.get(p.type === 'discussion' ? 'discussion' : 'post')?.has(String(p.id)))), [posts,idsByType,rankMap]);
  const matchingQuestions = useMemo(() => sortByDiscovery(questions.filter(item => idsByType.get('question')?.has(String(item.id)))), [questions,idsByType]);
  const matchingSeries = useMemo(() => sortByDiscovery(series.filter(s => idsByType.get('series')?.has(String(s.id)))), [series,idsByType]);
  const matchingUsers = useMemo(() => sortByDiscovery(users.filter(u => idsByType.get('user')?.has(String(u.uid)))), [users,idsByType]);
  const matchingTags = useMemo(() => {
    const map = new Map<string,number>();
    posts.forEach(p => (p.hashtags || extractHashtags(`${p.title} ${p.content}`)).forEach(tag => map.set(tag,(map.get(tag)||0)+1)));
    articles.forEach(a => (a.tags||[]).forEach(tag => map.set(tag,(map.get(tag)||0)+1)));
    series.forEach(s => (s.tags||[]).forEach(tag => map.set(tag,(map.get(tag)||0)+1)));
    return [...map.entries()].filter(([tag]) => !q || tag.toLowerCase().includes(normalized)).sort((a,b)=>b[1]-a[1]);
  }, [posts,articles,series,q,normalized]);
  const matchingTopics = useMemo(() => topics.filter(t => !q || `${t.name} ${t.description}`.toLowerCase().includes(normalized)), [topics,q,normalized]);
  const matchingComments = useMemo(() => comments.filter(c => !q || c.content.toLowerCase().includes(normalized) || c.authorUsername.toLowerCase().includes(normalized) || c.authorName.toLowerCase().includes(normalized)), [comments,q,normalized]);

  const trackResultClick = (type: string, id: string) => { void emitActivityEvent({ type: 'search_result_click', targetId: id, targetType: type, source: 'global-search', metadata: { query: q.slice(0,120) } }).catch(() => undefined); };

  const counts = { articles: matchingArticles.length, posts: matchingPosts.length, questions: matchingQuestions.length, series: matchingSeries.length, people: matchingUsers.length, hashtags: matchingTags.length, comments: matchingComments.length, topics: matchingTopics.length };
  const sections = tab === 'all' ? (['articles','posts','questions','series','people','topics','hashtags','comments'] as SearchTab[]) : [tab];

  if (!isOpen) return null;
  const tabButton = (id: SearchTab, label: string, count?: number) => <button onClick={() => setTab(id)} className={`px-2.5 py-1.5 border-2 border-black font-mono text-[9px] font-black uppercase ${tab===id ? 'bg-[var(--color-primary)]' : 'bg-white hover:bg-neutral-100'}`}>{label}{count !== undefined ? ` ${count}` : ''}</button>;

  return <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/70 backdrop-blur-xs">
    <div className="w-full max-w-3xl bg-white border-4 border-black neo-shadow-lg overflow-hidden">
      <div className="flex items-center px-4 py-3.5 border-b-4 border-black">
        <Search className="w-5 h-5 stroke-[3] mr-3 shrink-0" />
        <input ref={inputRef} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search OFFSCRPT — try topic:travel type:article or @handle / #topic" className="w-full font-display font-bold text-lg sm:text-xl outline-none" />
        {query && <button onClick={()=>setQuery('')} className="p-1 border-2 border-black mr-2"><X className="w-4 h-4" /></button>}
        <button onClick={onClose} className="px-2.5 py-1 bg-neutral-200 border-2 border-black font-mono text-xs font-bold">ESC</button>
      </div>
      {q && (matchingUsers.slice(0,3).length || matchingTopics.slice(0,3).length || matchingSeries.slice(0,3).length) && <div className="px-4 py-2 border-b-2 border-black bg-[var(--color-primary)] overflow-x-auto"><div className="flex gap-2 min-w-max items-center"><span className="font-mono text-[9px] font-black uppercase">Suggestions</span>{matchingUsers.slice(0,2).map(u=><button key={`s-user-${u.uid}`} onClick={()=>{onNavigate('creator',u.username);onClose();}} className="border-2 border-black bg-white px-2 py-1 font-mono text-[9px] font-black">@{u.username}</button>)}{matchingTopics.slice(0,2).map(t=><button key={`s-topic-${t.id}`} onClick={()=>{onNavigate('topic',t.slug);onClose();}} className="border-2 border-black bg-white px-2 py-1 font-mono text-[9px] font-black">#{t.slug}</button>)}{matchingSeries.slice(0,2).map(s=><button key={`s-series-${s.id}`} onClick={()=>{onNavigate('series',s.id);onClose();}} className="border-2 border-black bg-white px-2 py-1 font-mono text-[9px] font-black">{s.title}</button>)}</div></div>}
      <div className="px-4 py-3 border-b-2 border-black flex flex-wrap gap-2">
        {tabButton('all','All')} {tabButton('articles','Articles',counts.articles)} {tabButton('posts','Posts',counts.posts)} {tabButton('questions','Questions',counts.questions)} {tabButton('series','Series',counts.series)} {tabButton('people','People',counts.people)} {tabButton('topics','Topics',counts.topics)} {tabButton('hashtags','Tags',counts.hashtags)} {tabButton('comments','Comments',counts.comments)}
      </div>
      <div className="max-h-[65vh] overflow-y-auto p-4 space-y-5">
        {loading && <div className="flex items-center gap-2 font-mono text-xs uppercase"><Loader2 className="w-4 h-4 animate-spin"/>Indexing community search...</div>}
        {!q && <div className="space-y-3"><div className="bg-neutral-50 border-2 border-dashed border-black p-4 font-mono text-xs uppercase">Search across the complete public OFFSCRPT index.</div>{recentSearches.length>0&&<div><div className="font-mono text-[9px] font-black uppercase mb-2">Recent searches</div><div className="flex flex-wrap gap-2">{recentSearches.map(item=><button key={item} type="button" onClick={()=>setQuery(item)} className="px-3 py-2 border-2 border-black bg-white hover:bg-[var(--color-primary)] font-mono text-[10px] font-black">{item}</button>)}</div></div>}</div>}
        {sections.map(section => {
          if (section==='articles') return <section key={section}><h3 className="font-display font-black text-sm uppercase border-b-2 border-black pb-2 mb-2 flex items-center gap-2"><FileText className="w-4 h-4"/> Articles ({counts.articles})</h3><div className="space-y-2">{matchingArticles.slice(0,8).map(a=><button key={a.id} onClick={()=>{onSelectArticle(a.slug);onClose();}} className="w-full text-left p-3 border-2 border-black hover:bg-[var(--color-primary)] flex justify-between gap-3"><span><span className="font-mono text-[9px] uppercase">{a.category}</span><span className="block font-display font-black">{a.title}</span><span className="block text-xs text-neutral-600 line-clamp-1">{a.excerpt}</span></span><ArrowUpRight className="w-4 h-4 shrink-0"/></button>)}</div></section>;
          if (section==='questions') return <section key={section}><h3 className="font-display font-black text-sm uppercase border-b-2 border-black pb-2 mb-2 flex items-center gap-2"><MessageSquare className="w-4 h-4"/> Questions ({counts.questions})</h3>{questionSearchLoading&&<div className="font-mono text-[9px] uppercase">Loading questions…</div>}<div className="space-y-2">{matchingQuestions.slice(0,8).map(item=><button key={item.id} onClick={()=>{onNavigate('question',item.id);onClose();}} className="w-full text-left p-3 border-2 border-black hover:bg-[var(--color-primary)] flex justify-between gap-3"><span><span className="font-mono text-[9px] uppercase">QUESTION · {item.answersCount||0} ANSWERS</span><span className="block font-display font-black">{item.title}</span><span className="block text-xs text-neutral-600 line-clamp-1">{item.details}</span></span><ArrowUpRight className="w-4 h-4 shrink-0"/></button>)}</div></section>;
          if (section==='series') return <section key={section}><h3 className="font-display font-black text-sm uppercase border-b-2 border-black pb-2 mb-2 flex items-center gap-2"><Layers className="w-4 h-4"/> Series ({counts.series})</h3><div className="space-y-2">{matchingSeries.slice(0,8).map(s=><button key={s.id} onClick={()=>{onNavigate('series',s.id);onClose();}} className="w-full text-left p-3 border-2 border-black hover:bg-[var(--color-primary)] flex justify-between gap-3"><span><span className="font-mono text-[9px] uppercase">{s.articleCount||0} PARTS · {s.ownerUsername?'@'+s.ownerUsername:'CREATOR'}</span><span className="block font-display font-black">{s.title}</span><span className="block text-xs text-neutral-600 line-clamp-1">{s.description}</span></span><ArrowUpRight className="w-4 h-4 shrink-0"/></button>)}</div></section>;
          if (section==='posts') return <section key={section}><h3 className="font-display font-black text-sm uppercase border-b-2 border-black pb-2 mb-2 flex items-center gap-2"><MessageSquare className="w-4 h-4"/> Community Posts ({counts.posts})</h3><div className="space-y-2">{matchingPosts.slice(0,8).map(p=><button key={p.id} onClick={()=>{onNavigate('community_post',p.id);onClose();}} className="w-full text-left p-3 border-2 border-black hover:bg-[var(--color-secondary)]"><span className="font-mono text-[9px] uppercase">@{p.authorUsername}</span><span className="block font-display font-black">{p.title}</span><PostMediaPreview post={p} className="mt-2"/><span className="block text-xs text-neutral-600 line-clamp-1 mt-1">{p.content}</span></button>)}</div></section>;
          if (section==='people') return <section key={section}><h3 className="font-display font-black text-sm uppercase border-b-2 border-black pb-2 mb-2 flex items-center gap-2"><User className="w-4 h-4"/> People ({counts.people})</h3><div className="space-y-2">{matchingUsers.slice(0,10).map(u=><button key={u.uid} onClick={()=>{onNavigate('community_profile',u.username);onClose();}} className="w-full text-left p-3 border-2 border-black hover:bg-[var(--color-accent)] flex items-center gap-3">{u.photoURL?<img src={u.photoURL} className="w-9 h-9 rounded-full border-2 border-black object-cover"/>:<div className="w-9 h-9 rounded-full border-2 border-black flex items-center justify-center font-black">{u.displayName.charAt(0)}</div>}<span><span className="font-display font-black uppercase flex items-center gap-1">{u.displayName}<VerifiedBadge verified={u.isVerified} color={u.verificationColor} className="w-4 h-4"/></span><span className="font-mono text-[10px] text-neutral-500">@{u.username}</span></span></button>)}</div></section>;
          if (section==='topics') return <section key={section}><h3 className="font-display font-black text-sm uppercase border-b-2 border-black pb-2 mb-2 flex items-center gap-2"><Hash className="w-4 h-4"/> Topics ({counts.topics})</h3><div className="space-y-2">{matchingTopics.slice(0,10).map(t=><button key={t.id} onClick={()=>{onNavigate('topic',t.slug);onClose();}} className="w-full text-left p-3 border-2 border-black hover:bg-[var(--color-primary)]"><span className="font-display font-black">{t.name}</span><span className="block text-xs text-neutral-600 line-clamp-1">{t.description}</span><span className="block font-mono text-[9px] text-neutral-500 mt-1">{t.followersCount||0} FOLLOWERS</span></button>)}</div></section>;
          if (section==='hashtags') return <section key={section}><h3 className="font-display font-black text-sm uppercase border-b-2 border-black pb-2 mb-2 flex items-center gap-2"><Hash className="w-4 h-4"/> Hashtags ({counts.hashtags})</h3><div className="flex flex-wrap gap-2">{matchingTags.slice(0,20).map(([tag,count])=><button key={tag} onClick={()=>{onNavigate('topic',tag);onClose();}} className="px-3 py-2 border-2 border-black bg-white hover:bg-[var(--color-primary)] font-mono text-xs font-black">#{tag} <span className="text-neutral-500">({count})</span></button>)}</div></section>;
          return <section key={section}><h3 className="font-display font-black text-sm uppercase border-b-2 border-black pb-2 mb-2 flex items-center gap-2"><MessageSquare className="w-4 h-4"/> Comments ({counts.comments})</h3><div className="space-y-2">{matchingComments.slice(0,8).map(c=><button key={`${c.id}-${c.postId||c.articleSlug}`} onClick={()=>{c.postId?onNavigate('community_post',c.postId):c.articleSlug?onNavigate('article',c.articleSlug):null;onClose();}} className="w-full text-left p-3 border-2 border-black hover:bg-neutral-100"><span className="font-mono text-[9px] uppercase text-neutral-500">@{c.authorUsername}</span><span className="block text-sm line-clamp-2">{c.content}</span></button>)}</div></section>;
        })}
        {q && !sections.some(section => ({articles:counts.articles,posts:counts.posts,questions:counts.questions,series:counts.series,people:counts.people,topics:counts.topics,hashtags:counts.hashtags,comments:counts.comments}[section]||0)>0) && <div className="text-center py-12 border-2 border-dashed border-black"><p className="font-display font-black text-xl uppercase">No matches</p><p className="font-mono text-xs text-neutral-500 mt-2">Try a different keyword, @handle, or #hashtag.</p></div>}
      </div>
      <div className="px-4 py-2.5 bg-neutral-100 border-t-4 border-black flex items-center justify-between text-[10px] font-mono text-neutral-600"><span>DISCOVERY CORE · {unifiedResults.length} INDEXED RESULTS{Object.values(plan.filters).some(Boolean) ? ' · FILTERED' : ''}</span><span className="font-bold text-black">{brandName}</span></div>
    </div>
  </div>;
};
