import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Article, CommunityPost, CommunityUser, Series, SiteConfig } from '../types';
import { getAllCommunityUsers, getAllCommentsForSearch, getPosts, extractHashtags } from '../lib/community';
import { getSeriesList } from '../lib/series';
import { getTopics, getQuestions, SocialTopic, SocialQuestion } from '../lib/social';
import { Search, X, ArrowUpRight, User, Hash, MessageSquare, FileText, Loader2, Layers } from 'lucide-react';
import { VerifiedBadge } from './VerifiedBadge';
import { PostMediaPreview } from './PostMediaPreview';
import { auth, db } from '../lib/firebase';
import { emitActivityEvent } from '../lib/activity';
import { articleToContent, postToContent, questionToContent, seriesToContent, userToContent, topicToContent, normalizeContent } from '../lib/content';
import { searchEverything } from '../lib/unifiedSearch';
import type { ContentEntity } from '../lib/intelligence/types';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
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
  const [indexWarnings, setIndexWarnings] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) { setQuery(''); setTab('all'); return; }
    setTimeout(() => inputRef.current?.focus(), 50);
    try { const saved = JSON.parse(localStorage.getItem('offscrpt:search:recent:v2') || '[]'); setRecentSearches(Array.isArray(saved) ? saved.map(String).slice(0,8) : []); } catch { setRecentSearches([]); }
    let active = true;
    setLoading(true);
    setIndexWarnings([]);
    Promise.allSettled([getPosts(), getAllCommunityUsers(), getAllCommentsForSearch(), getSeriesList(100), getTopics(), getQuestions()]).then((results) => {
      if (!active) return;
      const [p, u, c, s, t, q] = results;
      const warnings: string[] = [];
      if (p.status === 'fulfilled') setPosts(p.value); else { warnings.push('posts'); console.warn('Search posts index unavailable:', p.reason); }
      if (u.status === 'fulfilled') setUsers(u.value); else { warnings.push('people'); console.warn('Search user index unavailable:', u.reason); }
      if (c.status === 'fulfilled') setComments(c.value); else { warnings.push('comments'); console.warn('Search comments index unavailable:', c.reason); }
      if (s.status === 'fulfilled') setSeries(s.value); else { warnings.push('series'); console.warn('Search series index unavailable:', s.reason); }
      if (t.status === 'fulfilled') setTopics(t.value); else { warnings.push('topics'); console.warn('Search topics index unavailable:', t.reason); }
      if (q.status === 'fulfilled') setQuestions(q.value); else { warnings.push('questions'); console.warn('Search questions index unavailable:', q.reason); }
      setIndexWarnings(warnings);
    }).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [isOpen]);

  useEffect(() => {
    const value = query.trim();
    if (!auth.currentUser || value.length < 2) return;
    const timer = window.setTimeout(() => {
      const recent = [value.slice(0, 120), ...recentSearches.filter(x => x.toLowerCase() !== value.toLowerCase())].slice(0, 8);
      setRecentSearches(recent);
      try { localStorage.setItem('offscrpt:search:recent:v2', JSON.stringify(recent)); } catch (error) { console.warn('Recent search cache unavailable:', error); }
      void Promise.all([
        addDoc(collection(db, 'users', auth.currentUser!.uid, 'searches'), { query: value.slice(0, 120), createdAt: serverTimestamp() }),
        emitActivityEvent({ type: 'search', targetId: value.slice(0,120), targetType: 'search', source: 'global-search' }),
      ]).catch((error) => console.warn('Search behavior sync failed:', error));
    }, 900);
    return () => window.clearTimeout(timer);
  }, [query]);

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
  const normalized = plan.text;
  const unifiedEntities = useMemo<ContentEntity[]>(() => [
    ...articles.map(articleToContent),
    ...posts.map(postToContent),
    ...questions.map(questionToContent),
    ...series.map(seriesToContent),
    ...users.map(userToContent),
    ...topics.map(topicToContent),
    ...comments.map(c => normalizeContent({
      id: c.id,
      type: 'comment',
      authorId: c.authorId,
      authorUsername: c.authorUsername,
      title: '',
      content: c.content,
      visibility: 'public',
      status: c.isDeleted ? 'deleted' : 'published',
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      sourceCollection: 'comments',
      sourcePath: c.id,
    }))
  ], [articles,posts,questions,series,users,topics,comments]);
  const unifiedResults = useMemo(() => searchEverything(unifiedEntities, {
    query,
    viewer: { userId: auth.currentUser?.uid },
    limit: Math.max(120, unifiedEntities.length),
  }), [unifiedEntities, query]);
  const idsByType = useMemo(() => {
    const map = new Map<string, Set<string>>();
    unifiedResults.forEach(r => {
      const set = map.get(r.type) || new Set<string>();
      set.add(r.id);
      map.set(r.type, set);
    });
    return map;
  }, [unifiedResults]);

  const rankMap = useMemo(
    () => new Map(unifiedResults.map((r, index) => [r.id, { index, score: r.score, reasons: r.reasons }])),
    [unifiedResults]
  );

  const sortByDiscovery = <T extends { id?: string }>(items: T[]) =>
    [...items].sort(
      (a, b) =>
        (rankMap.get(String(a.id || ''))?.index ?? 99999) -
        (rankMap.get(String(b.id || ''))?.index ?? 99999)
    );

  const matchingArticles = useMemo(
    () => [...articles]
      .filter(a => idsByType.get('article')?.has(String(a.slug || a.id)))
      .sort((a,b) => (rankMap.get(String(a.slug || a.id))?.index ?? 99999) - (rankMap.get(String(b.slug || b.id))?.index ?? 99999)),
    [articles, idsByType, rankMap]
  );
  const matchingPosts = useMemo(
    () => sortByDiscovery(posts.filter(p => idsByType.get(p.type === 'discussion' ? 'discussion' : 'post')?.has(String(p.id)))),
    [posts, idsByType, rankMap]
  );
  const matchingQuestions = useMemo(
    () => sortByDiscovery(questions.filter(item => idsByType.get('question')?.has(String(item.id)))),
    [questions, idsByType, rankMap]
  );
  const matchingSeries = useMemo(
    () => sortByDiscovery(series.filter(s => idsByType.get('series')?.has(String(s.id)))),
    [series, idsByType, rankMap]
  );
  const matchingUsers = useMemo(
    () => sortByDiscovery(users.filter(u => idsByType.get('user')?.has(String(u.uid)))),
    [users, idsByType, rankMap]
  );

  const activeType = plan.filters.type?.toLowerCase();
  const facetTypeAllowed = (types: string[]) => !activeType || types.includes(activeType);
  const hasUnsupportedFacetFilter = Boolean(plan.filters.author || plan.filters.community || plan.filters.series || plan.filters.before || plan.filters.after);

  const matchingTags = useMemo(() => {
    if (!facetTypeAllowed(['article','post','discussion','series']) || hasUnsupportedFacetFilter) return [];
    const map = new Map<string,number>();
    if (facetTypeAllowed(['post','discussion'])) {
      posts.forEach(p => (p.hashtags || extractHashtags(`${p.title} ${p.content}`)).forEach(tag => map.set(tag,(map.get(tag)||0)+1)));
    }
    if (facetTypeAllowed(['article'])) {
      articles.forEach(a => (a.tags||[]).forEach(tag => map.set(tag,(map.get(tag)||0)+1)));
    }
    if (facetTypeAllowed(['series'])) {
      series.forEach(s => (s.tags||[]).forEach(tag => map.set(tag,(map.get(tag)||0)+1)));
    }
    return [...map.entries()]
      .filter(([tag]) => {
        const wanted = plan.filters.tag?.toLowerCase();
        return (!wanted || tag.toLowerCase() === wanted) &&
          (!normalized || tag.toLowerCase().includes(normalized.toLowerCase()));
      })
      .sort((a,b)=>b[1]-a[1]);
  }, [posts, articles, series, normalized, plan.filters.tag, activeType, hasUnsupportedFacetFilter]);

  const matchingTopics = useMemo(() => {
    if (!facetTypeAllowed(['topic','article','post','discussion','question','series','community']) || hasUnsupportedFacetFilter) return [];
    const wanted = plan.filters.topic?.toLowerCase();
    return topics.filter(t => {
      const hay = `${t.name} ${t.description} ${t.slug}`.toLowerCase();
      return (!wanted || t.slug.toLowerCase() === wanted || t.name.toLowerCase() === wanted) &&
        (!normalized || hay.includes(normalized.toLowerCase()));
    });
  }, [topics, normalized, plan.filters.topic, activeType, hasUnsupportedFacetFilter]);

  const matchingComments = useMemo(() => {
    if (!facetTypeAllowed(['comment'])) return [];
    const wantedAuthor = plan.filters.author?.toLowerCase();
    return comments.filter(c => {
      const hay = `${c.content} ${c.authorUsername} ${c.authorName}`.toLowerCase();
      const authorMatch = !wantedAuthor || c.authorUsername.toLowerCase() === wantedAuthor || c.authorId.toLowerCase() === wantedAuthor;
      return authorMatch && (!normalized || hay.includes(normalized.toLowerCase()));
    });
  }, [comments, normalized, activeType, plan.filters.author]);

  const trackResultClick = (type: string, id: string, position: number, extra: Record<string, unknown> = {}) => {
    void emitActivityEvent({
      type: 'search_result_click',
      targetId: id,
      targetType: type,
      source: 'global-search',
      metadata: {
        query: q.slice(0, 120),
        normalizedQuery: normalized.slice(0, 120),
        filterState: JSON.stringify(plan.filters).slice(0, 500),
        position,
        ...extra,
      }
    }).catch(() => undefined);
  };

  const counts = { articles: matchingArticles.length, posts: matchingPosts.length, questions: matchingQuestions.length, series: matchingSeries.length, people: matchingUsers.length, hashtags: matchingTags.length, comments: matchingComments.length, topics: matchingTopics.length };
  const sections = tab === 'all' ? (['articles','posts','questions','series','people','topics','hashtags','comments'] as SearchTab[]) : [tab];

  if (!isOpen) return null;
  let resultPosition = 0;
  const clickAndClose = (type: string, id: string, navigate: () => void, extra?: Record<string, unknown>) => {
    const position = resultPosition++;
    trackResultClick(type, id, position, extra);
    navigate();
    onClose();
  };
  const tabButton = (id: SearchTab, label: string, count?: number) => <button onClick={() => setTab(id)} className={`px-2.5 py-1.5 border-2 border-black font-mono text-[9px] font-black uppercase ${tab===id ? 'bg-[var(--color-primary)]' : 'bg-white hover:bg-neutral-100'}`}>{label}{count !== undefined ? ` ${count}` : ''}</button>;

  return <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/70 backdrop-blur-xs">
    <div className="w-full max-w-3xl bg-white border-4 border-black neo-shadow-lg overflow-hidden">
      <div className="flex items-center px-4 py-3.5 border-b-4 border-black">
        <Search className="w-5 h-5 stroke-[3] mr-3 shrink-0" />
        <input ref={inputRef} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search OFFSCRPT — try topic:travel type:article or @handle / #topic" className="w-full font-display font-bold text-lg sm:text-xl outline-none" />
        {query && <button onClick={()=>setQuery('')} className="p-1 border-2 border-black mr-2"><X className="w-4 h-4" /></button>}
        <button onClick={onClose} className="px-2.5 py-1 bg-neutral-200 border-2 border-black font-mono text-xs font-bold">ESC</button>
      </div>
      {q && (matchingUsers.slice(0,3).length || matchingTopics.slice(0,3).length || matchingSeries.slice(0,3).length) && <div className="px-4 py-2 border-b-2 border-black bg-[var(--color-primary)] overflow-x-auto"><div className="flex gap-2 min-w-max items-center"><span className="font-mono text-[9px] font-black uppercase">Suggestions</span>{matchingUsers.slice(0,2).map(u=><button key={`s-user-${u.uid}`} onClick={()=>clickAndClose('user',u.uid,()=>onNavigate('creator',u.username),{surface:'suggestion'})} className="border-2 border-black bg-white px-2 py-1 font-mono text-[9px] font-black">@{u.username}</button>)}{matchingTopics.slice(0,2).map(t=><button key={`s-topic-${t.id}`} onClick={()=>clickAndClose('topic',t.id,()=>onNavigate('topic',t.slug))} className="border-2 border-black bg-white px-2 py-1 font-mono text-[9px] font-black">#{t.slug}</button>)}{matchingSeries.slice(0,2).map(s=><button key={`s-series-${s.id}`} onClick={()=>clickAndClose('series',s.id,()=>onNavigate('series',s.id),{surface:'suggestion'})} className="border-2 border-black bg-white px-2 py-1 font-mono text-[9px] font-black">{s.title}</button>)}</div></div>}
      <div className="px-4 py-3 border-b-2 border-black flex flex-wrap gap-2">
        {tabButton('all','All')} {tabButton('articles','Articles',counts.articles)} {tabButton('posts','Posts',counts.posts)} {tabButton('questions','Questions',counts.questions)} {tabButton('series','Series',counts.series)} {tabButton('people','People',counts.people)} {tabButton('topics','Topics',counts.topics)} {tabButton('hashtags','Tags',counts.hashtags)} {tabButton('comments','Comments',counts.comments)}
      </div>
      <div className="max-h-[65vh] overflow-y-auto p-4 space-y-5">
        {loading && <div className="flex items-center gap-2 font-mono text-xs uppercase"><Loader2 className="w-4 h-4 animate-spin"/>Indexing community search...</div>}{!loading && indexWarnings.length > 0 && <div className="border-2 border-black bg-yellow-100 p-3 font-mono text-[10px] uppercase">Some search sources are temporarily unavailable: {indexWarnings.join(', ')}. Other available results remain searchable.</div>}
        {!q && <div className="space-y-3"><div className="bg-neutral-50 border-2 border-dashed border-black p-4 font-mono text-xs uppercase">Search across indexed public OFFSCRPT content.</div>{recentSearches.length>0&&<div><div className="font-mono text-[9px] font-black uppercase mb-2">Recent searches</div><div className="flex flex-wrap gap-2">{recentSearches.map(item=><button key={item} type="button" onClick={()=>setQuery(item)} className="px-3 py-2 border-2 border-black bg-white hover:bg-[var(--color-primary)] font-mono text-[10px] font-black">{item}</button>)}</div></div>}</div>}
        {sections.map(section => {
          if (section==='articles') return <section key={section}><h3 className="font-display font-black text-sm uppercase border-b-2 border-black pb-2 mb-2 flex items-center gap-2"><FileText className="w-4 h-4"/> Articles ({counts.articles})</h3><div className="space-y-2">{matchingArticles.slice(0,8).map(a=><button key={a.id} onClick={()=>clickAndClose('article',String(a.slug || a.id),()=>onSelectArticle(a.slug))} className="w-full text-left p-3 border-2 border-black hover:bg-[var(--color-primary)] flex justify-between gap-3"><span><span className="font-mono text-[9px] uppercase">{a.category}</span><span className="block font-display font-black">{a.title}</span><span className="block text-xs text-neutral-600 line-clamp-1">{a.excerpt}</span></span><ArrowUpRight className="w-4 h-4 shrink-0"/></button>)}</div></section>;
          if (section==='questions') return <section key={section}><h3 className="font-display font-black text-sm uppercase border-b-2 border-black pb-2 mb-2 flex items-center gap-2"><MessageSquare className="w-4 h-4"/> Questions ({counts.questions})</h3><div className="space-y-2">{matchingQuestions.slice(0,8).map(item=><button key={item.id} onClick={()=>clickAndClose('question',item.id,()=>onNavigate('question',item.id))} className="w-full text-left p-3 border-2 border-black hover:bg-[var(--color-primary)] flex justify-between gap-3"><span><span className="font-mono text-[9px] uppercase">QUESTION · {item.answersCount||0} ANSWERS</span><span className="block font-display font-black">{item.title}</span><span className="block text-xs text-neutral-600 line-clamp-1">{item.details}</span></span><ArrowUpRight className="w-4 h-4 shrink-0"/></button>)}</div></section>;
          if (section==='series') return <section key={section}><h3 className="font-display font-black text-sm uppercase border-b-2 border-black pb-2 mb-2 flex items-center gap-2"><Layers className="w-4 h-4"/> Series ({counts.series})</h3><div className="space-y-2">{matchingSeries.slice(0,8).map(s=><button key={s.id} onClick={()=>clickAndClose('series',s.id,()=>onNavigate('series',s.id),{surface:'suggestion'})} className="w-full text-left p-3 border-2 border-black hover:bg-[var(--color-primary)] flex justify-between gap-3"><span><span className="font-mono text-[9px] uppercase">{s.articleCount||0} PARTS · {s.ownerUsername?'@'+s.ownerUsername:'CREATOR'}</span><span className="block font-display font-black">{s.title}</span><span className="block text-xs text-neutral-600 line-clamp-1">{s.description}</span></span><ArrowUpRight className="w-4 h-4 shrink-0"/></button>)}</div></section>;
          if (section==='posts') return <section key={section}><h3 className="font-display font-black text-sm uppercase border-b-2 border-black pb-2 mb-2 flex items-center gap-2"><MessageSquare className="w-4 h-4"/> Community Posts ({counts.posts})</h3><div className="space-y-2">{matchingPosts.slice(0,8).map(p=><button key={p.id} onClick={()=>clickAndClose(p.type === 'discussion' ? 'discussion' : 'post',p.id,()=>onNavigate('community_post',p.id))} className="w-full text-left p-3 border-2 border-black hover:bg-[var(--color-secondary)]"><span className="font-mono text-[9px] uppercase">@{p.authorUsername}</span><span className="block font-display font-black">{p.title}</span><PostMediaPreview post={p} className="mt-2"/><span className="block text-xs text-neutral-600 line-clamp-1 mt-1">{p.content}</span></button>)}</div></section>;
          if (section==='people') return <section key={section}><h3 className="font-display font-black text-sm uppercase border-b-2 border-black pb-2 mb-2 flex items-center gap-2"><User className="w-4 h-4"/> People ({counts.people})</h3><div className="space-y-2">{matchingUsers.slice(0,10).map(u=><button key={u.uid} onClick={()=>clickAndClose('user',u.uid,()=>onNavigate('community_profile',u.username))} className="w-full text-left p-3 border-2 border-black hover:bg-[var(--color-accent)] flex items-center gap-3">{u.photoURL?<img src={u.photoURL} className="w-9 h-9 rounded-full border-2 border-black object-cover"/>:<div className="w-9 h-9 rounded-full border-2 border-black flex items-center justify-center font-black">{u.displayName.charAt(0)}</div>}<span><span className="font-display font-black uppercase flex items-center gap-1">{u.displayName}<VerifiedBadge verified={u.isVerified} color={u.verificationColor} className="w-4 h-4"/></span><span className="font-mono text-[10px] text-neutral-500">@{u.username}</span></span></button>)}</div></section>;
          if (section==='topics') return <section key={section}><h3 className="font-display font-black text-sm uppercase border-b-2 border-black pb-2 mb-2 flex items-center gap-2"><Hash className="w-4 h-4"/> Topics ({counts.topics})</h3><div className="space-y-2">{matchingTopics.slice(0,10).map(t=><button key={t.id} onClick={()=>clickAndClose('topic',t.id,()=>onNavigate('topic',t.slug))} className="w-full text-left p-3 border-2 border-black hover:bg-[var(--color-primary)]"><span className="font-display font-black">{t.name}</span><span className="block text-xs text-neutral-600 line-clamp-1">{t.description}</span><span className="block font-mono text-[9px] text-neutral-500 mt-1">{t.followersCount||0} FOLLOWERS</span></button>)}</div></section>;
          if (section==='hashtags') return <section key={section}><h3 className="font-display font-black text-sm uppercase border-b-2 border-black pb-2 mb-2 flex items-center gap-2"><Hash className="w-4 h-4"/> Hashtags ({counts.hashtags})</h3><div className="flex flex-wrap gap-2">{matchingTags.slice(0,20).map(([tag,count])=><button key={tag} onClick={()=>clickAndClose('tag',tag,()=>onNavigate('topic',tag))} className="px-3 py-2 border-2 border-black bg-white hover:bg-[var(--color-primary)] font-mono text-xs font-black">#{tag} <span className="text-neutral-500">({count})</span></button>)}</div></section>;
          return <section key={section}><h3 className="font-display font-black text-sm uppercase border-b-2 border-black pb-2 mb-2 flex items-center gap-2"><MessageSquare className="w-4 h-4"/> Comments ({counts.comments})</h3><div className="space-y-2">{matchingComments.slice(0,8).map(c=><button key={`${c.id}-${c.postId||c.articleSlug}`} onClick={()=>clickAndClose('comment',c.id,()=>{if(c.postId) onNavigate('community_post',c.postId); else if(c.articleSlug) onNavigate('article',c.articleSlug);})} className="w-full text-left p-3 border-2 border-black hover:bg-neutral-100"><span className="font-mono text-[9px] uppercase text-neutral-500">@{c.authorUsername}</span><span className="block text-sm line-clamp-2">{c.content}</span></button>)}</div></section>;
        })}
        {q && !sections.some(section => ({articles:counts.articles,posts:counts.posts,questions:counts.questions,series:counts.series,people:counts.people,topics:counts.topics,hashtags:counts.hashtags,comments:counts.comments}[section]||0)>0) && <div className="text-center py-12 border-2 border-dashed border-black"><p className="font-display font-black text-xl uppercase">No matches</p><p className="font-mono text-xs text-neutral-500 mt-2">Try a different keyword, @handle, or #hashtag.</p></div>}
      </div>
      <div className="px-4 py-2.5 bg-neutral-100 border-t-4 border-black flex items-center justify-between text-[10px] font-mono text-neutral-600"><span>DISCOVERY CORE · {unifiedResults.length} INDEXED RESULTS{Object.values(plan.filters).some(Boolean) ? ' · FILTERED' : ''}</span><span className="font-bold text-black">{brandName}</span></div>
    </div>
  </div>;
};
