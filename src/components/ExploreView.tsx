import React, { useEffect, useMemo, useState } from 'react';
import { Article, CommunityPost, CommunityUser, PageView, Series } from '../types';
import { getPosts, getUserFollowing, extractHashtags, getAllCommunityUsers } from '../lib/community';
import { getSeriesList } from '../lib/series';
import { getCommunities, getQuestions, getTopics, SocialCommunity, SocialQuestion, SocialTopic } from '../lib/social';
import { ArrowUp, BookOpen, Compass, Eye, Hash, Layers, Loader2, MessageSquare, MoreHorizontal, Repeat2, Search, Share2, Sparkles, TrendingUp, UserPlus, Users, X, Zap } from 'lucide-react';
import { VerifiedBadge } from './VerifiedBadge';
import { CommunityPostExtras } from './CommunityPostExtras';
import { formatDisplayDate } from '../lib/dateUtils';

interface Props {
  articles: Article[];
  userAuth?: { uid: string } | null;
  userProfile?: CommunityUser | null;
  onNavigate: (page: PageView, param?: string) => void;
  initialHashtag?: string;
}

type ExploreTab = 'for-you' | 'following' | 'latest' | 'trending' | 'rising' | 'discussed' | 'editors';
type ExploreItem =
  | { kind: 'article'; key: string; article: Article; score: number }
  | { kind: 'post'; key: string; post: CommunityPost; score: number }
  | { kind: 'series'; key: string; series: Series; score: number };

const HIDDEN_KEY = 'offscrpt:explore:hidden:v1';
const seenForYouKey = 'offscrpt:explore:seen:v1';

function readStringSet(key: string): Set<string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

function writeStringSet(key: string, values: Set<string>) {
  try { localStorage.setItem(key, JSON.stringify([...values])); } catch { /* local persistence is optional */ }
}

function articleAuthor(article: Article) {
  const a: any = article.originalAuthor || article.author || {};
  return {
    uid: a.uid || article.author?.uid || '',
    username: a.username || article.author?.username || '',
    name: a.name || article.author?.name || 'Author',
    avatar: a.avatar || article.author?.avatar || '',
    role: a.role || article.author?.role || 'Author',
    verified: a.isVerified ?? article.author?.isVerified,
    verificationColor: a.verificationColor || article.author?.verificationColor,
  };
}

function articleText(article: Article) {
  const blocks = Array.isArray(article.content) ? article.content : [];
  return blocks.map(b => [b.content, b.calloutTitle, b.codeBlock?.code, b.items?.join(' ')].filter(Boolean).join(' ')).join(' ');
}

export const ExploreView: React.FC<Props> = ({ articles, userAuth, userProfile, onNavigate, initialHashtag = '' }) => {
  const [tab, setTab] = useState<ExploreTab>('for-you');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [followingUsernames, setFollowingUsernames] = useState<string[]>([]);
  const [query, setQuery] = useState(initialHashtag ? `#${initialHashtag.replace(/^#/, '')}` : '');
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(12);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set<string>(readStringSet(HIDDEN_KEY)));
  const [dismissedTip, setDismissedTip] = useState(false);
  const [showWhy, setShowWhy] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [surprise, setSurprise] = useState<ExploreItem | null>(null);
  const [communities, setCommunities] = useState<SocialCommunity[]>([]);
  const [questions, setQuestions] = useState<SocialQuestion[]>([]);
  const [topics, setTopics] = useState<SocialTopic[]>([]);
  const [creators, setCreators] = useState<CommunityUser[]>([]);
  const [contentType, setContentType] = useState<'all'|'articles'|'posts'|'series'|'creators'|'topics'>('all');
  const liveCreatorsByUid = useMemo(() => new Map(creators.map(u => [String(u.uid || ''), u])), [creators]);
  const liveCreatorsByUsername = useMemo(() => new Map(creators.map(u => [String(u.username || '').toLowerCase(), u])), [creators]);

  useEffect(() => {
    setQuery(initialHashtag ? `#${initialHashtag.replace(/^#/, '')}` : '');
  }, [initialHashtag]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      getPosts().catch(() => []),
      getSeriesList(50).catch(() => []),
      userAuth ? getUserFollowing(userAuth.uid).catch(() => []) : Promise.resolve([]),
      getCommunities().catch(() => []),
      getQuestions().catch(() => []),
      getTopics().catch(() => []),
      getAllCommunityUsers().catch(() => []),
    ]).then(([p, s, f, c, q, t, u]) => {
      if (!active) return;
      setPosts(p as CommunityPost[]);
      setSeries(s as Series[]);
      const follows = f as any[];
      setFollowingIds(follows.map(x => String(x.uid || '')).filter(Boolean));
      setFollowingUsernames(follows.map(x => String(x.username || '')).filter(Boolean));
      setCommunities(c as SocialCommunity[]);
      setQuestions(q as SocialQuestion[]);
      setTopics(t as SocialTopic[]);
      setCreators(u as CommunityUser[]);
    }).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [userAuth?.uid]);

  const trendingTopics = useMemo(() => {
    const counts = new Map<string, number>();
    const add = (tags: string[]) => tags.forEach(t => {
      const clean = String(t).replace(/^#/, '').trim().toLowerCase();
      if (clean) counts.set(clean, (counts.get(clean) || 0) + 1);
    });
    posts.forEach(p => add(p.hashtags || extractHashtags(`${p.title} ${p.content}`)));
    articles.forEach(a => add(a.tags || []));
    series.forEach(s => add(s.tags || []));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [posts, articles, series]);

  const items = useMemo<ExploreItem[]>(() => {
    const needle = query.trim().toLowerCase();
    const normalizedNeedle = needle.replace(/^#|^@/, '');
    const matches = (title: string, body: string, tags: string[] = [], username = '') => {
      if (!normalizedNeedle) return true;
      return title.toLowerCase().includes(normalizedNeedle)
        || body.toLowerCase().includes(normalizedNeedle)
        || username.toLowerCase().includes(normalizedNeedle)
        || tags.some(t => t.toLowerCase().replace(/^#/, '').includes(normalizedNeedle));
    };
    const now = Date.now();
    const freshScore = (createdAt: string | undefined) => {
      const hours = Math.max(1, (now - new Date(createdAt || now).getTime()) / 36e5);
      return Math.max(0, 80 - Math.log1p(hours) * 12);
    };

    const result: ExploreItem[] = [];
    articles.forEach(a => {
      const author = articleAuthor(a);
      if (!matches(a.title, `${a.excerpt} ${articleText(a)}`, a.tags, author.username)) return;
      if (contentType !== 'all' && contentType !== 'articles') return;
      if (hidden.has(`article:${a.slug}`)) return;
      const follows = followingIds.includes(author.uid) || (!!author.username && followingUsernames.includes(author.username));
      const engagement = Number(a.viewsCount || 0) * 0.08 + Object.values(a.reactionCounts || {}).reduce<number>((n, x) => n + Number(x || 0), 0) * 3;
      const score = freshScore(a.publishedAt) + engagement + (a.featured ? 45 : 0) + (a.pinned ? 35 : 0) + (a.trending ? 25 : 0) + (follows ? 100 : 0);
      result.push({ kind: 'article', key: `article:${a.slug}`, article: a, score });
    });
    posts.forEach(p => {
      const tags = p.hashtags || extractHashtags(`${p.title} ${p.content}`);
      if (!matches(p.title, p.content, tags, p.authorUsername)) return;
      if (contentType !== 'all' && contentType !== 'posts') return;
      if (hidden.has(`post:${p.id}`)) return;
      const follows = followingIds.includes(p.authorId) || followingUsernames.includes(p.authorUsername);
      const engagement = Number(p.upvotesCount || 0) * 4 + Number(p.commentsCount || 0) * 5 + Number(p.repostsCount || 0) * 6 + Number(p.viewsCount || 0) * 0.05;
      const score = freshScore(p.createdAt) + engagement + (p.isFeatured ? 55 : 0) + (follows ? 100 : 0);
      result.push({ kind: 'post', key: `post:${p.id}`, post: p, score });
    });
    series.forEach(s => {
      if (contentType !== 'all' && contentType !== 'series') return;
      if (s.visibility === 'private' || s.status === 'archived') return;
      const tags = s.tags || [];
      if (!matches(s.title, s.description, tags, s.ownerUsername || '')) return;
      if (hidden.has(`series:${s.id}`)) return;
      const follows = followingIds.includes(s.ownerId) || followingUsernames.includes(s.ownerUsername || '');
      const score = freshScore(s.updatedAt) + Number(s.viewsCount || 0) * 0.05 + (s.articleCount || 0) * 4 + (follows ? 100 : 0);
      result.push({ kind: 'series', key: `series:${s.id}`, series: s, score });
    });
    return result;
  }, [articles, posts, series, query, followingIds, followingUsernames, hidden, contentType]);

  const rankedItems = useMemo(() => {
    const copy = [...items];
    if (tab === 'latest') {
      return copy.sort((a, b) => {
        const da = a.kind === 'article' ? a.article.publishedAt : a.kind === 'post' ? a.post.createdAt : a.series.updatedAt;
        const db = b.kind === 'article' ? b.article.publishedAt : b.kind === 'post' ? b.post.createdAt : b.series.updatedAt;
        return new Date(db || 0).getTime() - new Date(da || 0).getTime();
      });
    }
    if (tab === 'trending') return copy.sort((a, b) => b.score - a.score);
    if (tab === 'rising') return copy.sort((a,b)=>((b.kind==='article'?Number(b.article.viewsCount||0):b.kind==='post'?Number(b.post.viewsCount||0):Number(b.series.viewsCount||0))-(a.kind==='article'?Number(a.article.viewsCount||0):a.kind==='post'?Number(a.post.viewsCount||0):Number(a.series.viewsCount||0))));
    if (tab === 'discussed') return copy.sort((a,b)=>((b.kind==='article'?Number((b.article as any).commentsCount||0):b.kind==='post'?Number(b.post.commentsCount||0):Number(b.series.followersCount||0))-(a.kind==='article'?Number((a.article as any).commentsCount||0):a.kind==='post'?Number(a.post.commentsCount||0):Number(a.series.followersCount||0))));
    if (tab === 'editors') return copy.filter(item => item.kind==='article' ? !!item.article.featured : item.kind==='post' ? !!item.post.isFeatured : !!(item.series as any).featured).sort((a,b)=>b.score-a.score);
    if (tab === 'following') {
      return copy.filter(item => item.kind === 'article'
        ? followingIds.includes(articleAuthor(item.article).uid) || followingUsernames.includes(articleAuthor(item.article).username)
        : item.kind === 'post'
          ? followingIds.includes(item.post.authorId) || followingUsernames.includes(item.post.authorUsername)
          : followingIds.includes(item.series.ownerId) || followingUsernames.includes(item.series.ownerUsername || '')
      ).sort((a, b) => b.score - a.score);
    }
    // For You: relevance + freshness + diversity. Rotate formats so one type cannot dominate the first page.
    const scored = copy.sort((a, b) => b.score - a.score);
    const out: ExploreItem[] = [];
    const buckets: Record<ExploreItem['kind'], ExploreItem[]> = { article: [], post: [], series: [] };
    scored.forEach(i => buckets[i.kind].push(i));
    while (out.length < scored.length) {
      const rotation: ExploreItem['kind'][] = ['article', 'post', 'series'];
      const nextKind = rotation[out.length % rotation.length];
      const candidate = buckets[nextKind].shift();
      if (candidate) out.push(candidate);
      else {
        const fallback = scored.find(i => !out.includes(i));
        if (!fallback) break;
        out.push(fallback);
      }
    }
    return out;
  }, [items, tab, followingIds, followingUsernames]);

  const visibleItems = rankedItems.slice(0, visibleCount);
  const hasMore = visibleCount < rankedItems.length;

  const loadMore = () => setVisibleCount(n => Math.min(n + 9, rankedItems.length));

  const hideItem = (key: string) => {
    const next = new Set(hidden);
    next.add(key);
    setHidden(next);
    writeStringSet(HIDDEN_KEY, new Set<string>(next as Set<string>));
    setOpenMenu(null);
  };

  const openRecommendationMenu = (key: string) => {
    setOpenMenu(current => current === key ? null : key);
  };

  const explainItem = (item: ExploreItem) => {
    const key = item.key;
    setShowWhy(key);
  };

  const surpriseMe = () => {
    if (!rankedItems.length) return;
    const index = Math.floor(Math.random() * rankedItems.length);
    setSurprise(rankedItems[index]);
  };

  const labelForWhy = (item: ExploreItem) => {
    if (tab === 'following') return 'You follow this creator or series owner.';
    if (item.kind === 'article' && item.article.featured) return 'Featured by OFFSCRPT editorial.';
    if (item.kind === 'post' && item.post.isFeatured) return 'Featured community conversation.';
    if (tab === 'trending') return 'Trending based on recent engagement, freshness and saves/reactions where available.';
    if (item.kind === 'series') return 'Series are weighted for freshness, depth and reader interest.';
    return 'Recommended using freshness, relevance, engagement and format diversity.';
  };

  useEffect(() => {
    setVisibleCount(12);
  }, [tab, query, contentType]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'j' || e.key === 'ArrowDown') && !(e.target instanceof HTMLInputElement)) window.scrollBy({ top: window.innerHeight * 0.75, behavior: 'smooth' });
      if (e.key === 'r' && !(e.target instanceof HTMLInputElement) && rankedItems.length) surpriseMe();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rankedItems]);

  const showNoFollowing = tab === 'following' && !followingIds.length && !followingUsernames.length;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <section className="bg-black text-white border-4 border-black neo-shadow-lg p-5 sm:p-8 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <div className="font-mono text-[10px] font-black tracking-[0.18em] text-[var(--color-secondary)] uppercase mb-2">OFFSCRPT / DISCOVERY ENGINE</div>
            <h1 className="font-display font-black text-5xl sm:text-7xl uppercase tracking-tighter leading-[0.9]">EXPLORE</h1>
            <p className="max-w-2xl text-neutral-300 text-sm sm:text-base mt-4">One stream for the things worth discovering: articles, posts, series and creators.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={surpriseMe} className="px-3 py-2 bg-[var(--color-primary)] text-black border-2 border-white font-mono text-[10px] font-black uppercase inline-flex items-center gap-2"><Zap className="w-4 h-4"/> Surprise Me</button>
            <button onClick={() => setQuery('')} className="px-3 py-2 bg-white text-black border-2 border-white font-mono text-[10px] font-black uppercase inline-flex items-center gap-2"><X className="w-4 h-4"/> Clear Search</button>
          </div>
        </div>
        <div className="mt-6 grid md:grid-cols-[1fr_auto] gap-3">
          <div className="flex items-center bg-white text-black border-2 border-white px-3 py-2">
            <Search className="w-5 h-5 mr-2 shrink-0"/>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search articles, posts, series, @handles, #topics..." className="w-full bg-transparent focus:outline-none font-mono text-sm"/>
          </div>
          <button onClick={surpriseMe} className="px-5 py-2 bg-[var(--color-secondary)] text-black border-2 border-white font-display font-black uppercase">GO DOWN THE RABBIT HOLE →</button>
        </div>
      </section>

      <div className="mb-6 flex flex-wrap gap-2 items-center">
        <span className="font-mono text-[9px] font-black uppercase px-3 py-2 border-2 border-black bg-white">FILTER</span>
        {([['all','All'],['articles','Articles'],['posts','Posts'],['series','Series'],['creators','Creators'],['topics','Topics']] as const).map(([key,label])=><button key={key} onClick={()=>setContentType(key)} className={`border-2 border-black px-3 py-2 font-mono text-[9px] font-black uppercase ${contentType===key?'bg-[var(--color-primary)]':''}`}>{label}</button>)}
        {query && <button onClick={()=>setQuery('')} className="border-2 border-black px-3 py-2 font-mono text-[9px] font-black uppercase bg-white">CLEAR</button>}
      </div>

      <div className="sticky top-[4.5rem] sm:top-[5.5rem] z-30 bg-white border-4 border-black neo-shadow-sm p-2 mb-7">
        <div className="flex overflow-x-auto gap-2">
          {([
            ['for-you','For You',Sparkles], ['following','Following',Users], ['latest','Latest',Zap], ['trending','Trending',TrendingUp], ['rising','Rising',ArrowUp], ['discussed','Most Discussed',MessageSquare], ['editors',"Editor's Picks",Sparkles]
          ] as const).map(([key,label,Icon]) => (
            <button key={key} onClick={()=>setTab(key)} className={`shrink-0 px-4 py-2 border-2 border-black font-mono text-[10px] font-black uppercase inline-flex items-center gap-2 ${tab===key?'bg-[var(--color-primary)] text-black':'bg-white hover:bg-neutral-100'}`}>
              <Icon className="w-4 h-4"/>{label}
            </button>
          ))}
          <span className="ml-auto hidden md:flex items-center px-3 font-mono text-[9px] text-neutral-500 uppercase">J / ↓ = next · R = surprise</span>
        </div>
      </div>

      {!dismissedTip && (
        <div className="border-2 border-black bg-[var(--color-primary)] p-3 mb-7 flex items-start justify-between gap-4">
          <div className="font-mono text-[10px] sm:text-xs"><b>DISCOVERY RULE:</b> Explore mixes formats so you don't get trapped in one type of content. Use “Following” for people you trust and “Latest” for chronological browsing.</div>
          <button onClick={()=>setDismissedTip(true)} aria-label="Dismiss discovery tip" className="border-2 border-black bg-white p-1"><X className="w-4 h-4"/></button>
        </div>
      )}

      {trendingTopics.length > 0 && (
        <section className="mb-7 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            <div className="px-3 py-2 bg-black text-white border-2 border-black font-mono text-[10px] font-black uppercase inline-flex items-center gap-2"><Hash className="w-4 h-4"/> Trending Now</div>
            {trendingTopics.map(([tag,count]) => (
              <button key={tag} onClick={()=>onNavigate('topic',tag)} className="px-3 py-2 border-2 border-black bg-white font-mono text-[10px] font-black hover:bg-[var(--color-secondary)]">#{tag} · {count}</button>
            ))}
          </div>
        </section>
      )}

      {showNoFollowing ? (
        <div className="border-4 border-dashed border-black bg-white p-14 text-center">
          <Users className="w-10 h-10 mx-auto mb-4"/>
          <h2 className="font-display font-black text-3xl uppercase">YOUR FOLLOWING FEED IS EMPTY</h2>
          <p className="text-sm text-neutral-600 mt-2 max-w-xl mx-auto">Follow creators you actually want to hear from. Your Following tab will become a focused stream of their articles, posts and series.</p>
          <button onClick={()=>setTab('for-you')} className="mt-5 px-5 py-3 bg-[var(--color-primary)] border-2 border-black font-display font-black uppercase">GO TO FOR YOU</button>
        </div>
      ) : loading ? (
        <div className="py-24 flex justify-center"><Loader2 className="animate-spin w-8 h-8"/></div>
      ) : visibleItems.length === 0 ? (
        <div className="border-4 border-dashed border-black bg-white p-14 text-center">
          <h2 className="font-display font-black text-3xl uppercase">NOTHING HERE YET</h2>
          <p className="text-sm text-neutral-600 mt-2">Try another topic, clear the search, or switch discovery modes.</p>
          <button onClick={()=>{setQuery('');setTab('for-you');}} className="mt-5 px-5 py-3 bg-[var(--color-primary)] border-2 border-black font-display font-black uppercase">RESET DISCOVERY</button>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-7 items-start">
          <main className="space-y-5">
            {visibleItems.map(item => {
              if (item.kind === 'article') {
                const a = item.article;
                const baseAuthor = articleAuthor(a);
                const liveAuthor = liveCreatorsByUid.get(baseAuthor.uid) || liveCreatorsByUsername.get(String(baseAuthor.username || '').toLowerCase());
                const author = liveAuthor ? { ...baseAuthor, name: liveAuthor.displayName || baseAuthor.name, username: liveAuthor.username || baseAuthor.username, avatar: liveAuthor.photoURL || baseAuthor.avatar, verified: liveAuthor.isVerified ?? baseAuthor.verified, verificationColor: liveAuthor.verificationColor || baseAuthor.verificationColor } : baseAuthor;
                return (
                  <article key={item.key} className="bg-white border-4 border-black neo-shadow-sm overflow-hidden">
                    {a.coverImage && <button onClick={()=>onNavigate('article',a.slug)} className="block w-full aspect-[16/7] bg-neutral-900 overflow-hidden border-b-4 border-black"><img src={a.coverImage} alt={a.coverImageAlt || a.title} className="w-full h-full object-cover hover:scale-[1.015] transition-transform" loading="lazy"/></button>}
                    <div className="p-5 sm:p-6">
                      <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase text-neutral-500">
                        <span className="px-2 py-1 bg-[var(--color-primary)] border-2 border-black text-black font-black">ARTICLE</span>
                        <span>{a.category}</span><span>•</span><span>{a.readingTimeMinutes || 1} MIN</span><span>•</span><span><Eye className="inline w-3 h-3"/> {Number(a.viewsCount||0).toLocaleString()} VIEWS</span>
                      </div>
                      <button onClick={()=>onNavigate('article',a.slug)} className="text-left w-full mt-3"><h2 className="font-display font-black text-2xl sm:text-3xl uppercase leading-tight hover:text-[var(--color-secondary)]">{a.title}</h2><p className="text-sm text-neutral-700 mt-2 line-clamp-3">{a.excerpt}</p></button>
                      <div className="flex flex-wrap gap-2 mt-4">{a.tags.slice(0,5).map(tag=><button key={tag} onClick={()=>onNavigate('topic',tag)} className="font-mono text-[10px] border border-black px-2 py-1 hover:bg-[var(--color-secondary)]">#{tag}</button>)}</div>
                      <div className="flex items-center justify-between gap-4 mt-5 pt-4 border-t-2 border-black">
                        <button onClick={()=>onNavigate('community_profile', author.username)} className="flex items-center gap-2 text-left">
                          <div className="w-9 h-9 border-2 border-black overflow-hidden bg-neutral-100 shrink-0">{author.avatar && <img src={author.avatar} alt="" className="w-full h-full object-cover"/>}</div>
                          <span><span className="block font-display font-black text-xs uppercase">{author.name} <VerifiedBadge verified={author.verified} color={author.verificationColor} className="inline w-3.5 h-3.5"/></span><span className="block font-mono text-[9px] text-neutral-500">@{author.username || 'author'}</span></span>
                        </button>
                        <div className="flex gap-2 relative">
                          <button type="button" aria-label="Recommendation options" aria-expanded={openMenu===item.key} onClick={(e)=>{e.stopPropagation();openRecommendationMenu(item.key)}} className="p-2 border-2 border-black hover:bg-neutral-100"><MoreHorizontal className="w-4 h-4"/></button>
                          {openMenu===item.key && <div className="absolute right-0 top-full z-20 mt-1 w-44 border-2 border-black bg-white shadow-[3px_3px_0_#000] p-1" onClick={e=>e.stopPropagation()}>
                            <button type="button" onClick={()=>{setShowWhy(item.key);setOpenMenu(null)}} className="w-full text-left px-2 py-2 font-mono text-[9px] font-black hover:bg-[var(--color-primary)]">WHY THIS?</button>
                            <button type="button" onClick={()=>hideItem(item.key)} className="w-full text-left px-2 py-2 font-mono text-[9px] font-black hover:bg-[var(--color-primary)]">NOT INTERESTED / HIDE</button>
                          </div>}
                          <button onClick={()=>navigator.clipboard?.writeText(`${location.origin}/#article/${a.slug}`)} className="p-2 border-2 border-black hover:bg-[var(--color-secondary)]" title="Copy link"><Share2 className="w-4 h-4"/></button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              }
              if (item.kind === 'series') {
                const s = item.series;
                return (
                  <article key={item.key} className="bg-[var(--color-primary)] border-4 border-black neo-shadow-sm overflow-hidden">
                    <div className="grid md:grid-cols-[220px_1fr]">
                      <button onClick={()=>onNavigate('series',s.id)} className="bg-black min-h-[210px] md:min-h-full overflow-hidden">{s.coverImage ? <img src={s.coverImage} alt={s.coverImageAlt || s.title} className="w-full h-full object-cover hover:scale-[1.02] transition-transform"/> : <div className="h-full flex items-center justify-center text-[var(--color-primary)]"><Layers className="w-16 h-16"/></div>}</button>
                      <div className="p-5 sm:p-6">
                        <div className="font-mono text-[10px] uppercase font-black">SERIES · STRUCTURED PATH</div>
                        <button onClick={()=>onNavigate('series',s.id)} className="text-left"><h2 className="font-display font-black text-2xl sm:text-3xl uppercase mt-1 hover:underline">{s.title}</h2></button>
                        <p className="text-sm mt-2 line-clamp-3">{s.description}</p>
                        <div className="flex flex-wrap gap-2 mt-4 font-mono text-[10px] uppercase"><span className="border-2 border-black px-2 py-1 bg-white">{s.articleCount || 0} PARTS</span><span className="border-2 border-black px-2 py-1 bg-white">{s.estimatedMinutes || 0} MIN</span><span className="border-2 border-black px-2 py-1 bg-white">{Number(s.viewsCount||0).toLocaleString()} VIEWS</span></div>
                        <div className="flex items-center justify-between gap-4 mt-5 pt-4 border-t-2 border-black"><button onClick={()=>onNavigate('community_profile',s.ownerUsername || '')} className="font-mono text-xs font-black uppercase inline-flex items-center gap-2"><UserPlus className="w-4 h-4"/> @{s.ownerUsername || 'creator'}</button><div className="flex gap-2 relative"><button type="button" aria-label="Recommendation options" aria-expanded={openMenu===item.key} onClick={(e)=>{e.stopPropagation();openRecommendationMenu(item.key)}} className="p-2 border-2 border-black hover:bg-neutral-100"><MoreHorizontal className="w-4 h-4"/></button>{openMenu===item.key&&<div className="absolute right-0 bottom-full z-20 mb-1 w-44 border-2 border-black bg-white shadow-[3px_3px_0_#000] p-1" onClick={e=>e.stopPropagation()}><button type="button" onClick={()=>{setShowWhy(item.key);setOpenMenu(null)}} className="w-full text-left px-2 py-2 font-mono text-[9px] font-black hover:bg-[var(--color-primary)]">WHY THIS?</button><button type="button" onClick={()=>hideItem(item.key)} className="w-full text-left px-2 py-2 font-mono text-[9px] font-black hover:bg-[var(--color-primary)]">NOT INTERESTED / HIDE</button></div>}<button onClick={()=>onNavigate('series',s.id)} className="px-4 py-2 bg-black text-white border-2 border-black font-display font-black uppercase">OPEN SERIES →</button></div></div>
                      </div>
                    </div>
                  </article>
                );
              }
              const p = item.post;
              const livePostAuthor = liveCreatorsByUid.get(String(p.authorId || '')) || liveCreatorsByUsername.get(String(p.authorUsername || '').toLowerCase());
              const displayPost = livePostAuthor ? { ...p, authorName: livePostAuthor.displayName || p.authorName, authorUsername: livePostAuthor.username || p.authorUsername, authorAvatar: livePostAuthor.photoURL || p.authorAvatar, isVerified: livePostAuthor.isVerified ?? p.isVerified, verificationColor: livePostAuthor.verificationColor || p.verificationColor } : p;
              return (
                <article key={item.key} className="bg-white border-4 border-black neo-shadow-sm p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 font-mono text-[10px] uppercase"><span className="px-2 py-1 bg-[var(--color-secondary)] border-2 border-black font-black">{p.type==='blog'?'COMMUNITY BLOG':'POST'}</span><span>{formatDisplayDate(p.createdAt)}</span></div><div className="relative"><button type="button" aria-label="Recommendation options" aria-expanded={openMenu===item.key} onClick={(e)=>{e.stopPropagation();openRecommendationMenu(item.key)}} className="p-1 border-2 border-transparent hover:border-black"><MoreHorizontal className="w-4 h-4"/></button>{openMenu===item.key&&<div className="absolute right-0 top-full z-20 mt-1 w-40 border-2 border-black bg-white shadow-[3px_3px_0_#000] p-1" onClick={e=>e.stopPropagation()}><button type="button" onClick={()=>{setShowWhy(item.key);setOpenMenu(null)}} className="w-full text-left px-2 py-2 font-mono text-[9px] font-black hover:bg-[var(--color-primary)]">WHY THIS?</button><button type="button" onClick={()=>hideItem(item.key)} className="w-full text-left px-2 py-2 font-mono text-[9px] font-black hover:bg-[var(--color-primary)]">NOT INTERESTED / HIDE</button></div>}</div></div>
                  <button onClick={()=>onNavigate('community_post',p.id)} className="text-left w-full mt-3"><h2 className="font-display font-black text-2xl sm:text-3xl uppercase leading-tight hover:text-[var(--color-secondary)]">{displayPost.title}</h2><p className="text-sm text-neutral-700 mt-2 line-clamp-4 whitespace-pre-wrap">{displayPost.excerpt || displayPost.content}</p></button>
                  <CommunityPostExtras post={p} onHashtag={tag=>setQuery(`#${tag}`)} compact />
                  <div className="flex items-center justify-between gap-4 mt-5 pt-4 border-t-2 border-neutral-200">
                    <button onClick={()=>onNavigate('community_profile',displayPost.authorUsername)} className="flex items-center gap-2 text-left"><div className="w-8 h-8 rounded-full border-2 border-black overflow-hidden bg-neutral-100">{displayPost.authorAvatar&&<img src={displayPost.authorAvatar} alt="" className="w-full h-full object-cover"/>}</div><span><span className="block font-display font-black text-xs uppercase">{displayPost.authorName || displayPost.authorUsername} <VerifiedBadge verified={displayPost.isVerified} color={displayPost.verificationColor} className="inline w-3.5 h-3.5"/></span><span className="block font-mono text-[9px] text-neutral-500">@{displayPost.authorUsername}</span></span></button>
                    <div className="flex gap-4 font-mono text-[10px]"><span><ArrowUp className="inline w-3.5 h-3.5"/> {p.upvotesCount||0}</span><span><MessageSquare className="inline w-3.5 h-3.5"/> {p.commentsCount||0}</span><span><Repeat2 className="inline w-3.5 h-3.5"/> {p.repostsCount||0}</span><span><Eye className="inline w-3.5 h-3.5"/> {Number(p.viewsCount||0).toLocaleString()}</span></div>
                  </div>
                  <div className="mt-3 flex gap-2"><button onClick={()=>explainItem(item)} className="px-2 py-1 border-2 border-black font-mono text-[9px] uppercase">Why this?</button><button onClick={()=>navigator.clipboard?.writeText(`${location.origin}/#community/post/${p.id}`)} className="px-2 py-1 border-2 border-black font-mono text-[9px] uppercase inline-flex items-center gap-1"><Share2 className="w-3 h-3"/> Share</button></div>
                </article>
              );
            })}
            {hasMore && <button onClick={loadMore} className="w-full py-4 bg-black text-white border-4 border-black font-display font-black uppercase hover:bg-[var(--color-primary)] hover:text-black">LOAD MORE DISCOVERIES →</button>}
          </main>

          <aside className="space-y-5 lg:sticky lg:top-[9rem]">
            <section className="bg-white border-4 border-black neo-shadow-sm p-5">
              <div className="flex items-center gap-2 border-b-2 border-black pb-3"><TrendingUp className="w-5 h-5"/><h3 className="font-display font-black uppercase">TRENDING NOW</h3></div>
              <div className="pt-3 space-y-2">{trendingTopics.map(([tag,count],i)=><button key={tag} onClick={()=>onNavigate('topic',tag)} className="w-full text-left border-2 border-transparent hover:border-black hover:bg-[var(--color-primary)] p-2 flex items-center justify-between"><span className="font-mono text-xs font-black"><span className="text-neutral-400 mr-2">{String(i+1).padStart(2,'0')}</span>#{tag}</span><span className="font-mono text-[9px] text-neutral-500">{count}</span></button>)}</div>
            </section>
            <section className="bg-black text-white border-4 border-black p-5">
              <div className="font-mono text-[10px] font-black text-[var(--color-secondary)] uppercase">WHAT YOU CAN DO</div>
              <div className="space-y-2 mt-3 font-mono text-xs"><div>→ Follow a creator</div><div>→ Save something for later</div><div>→ Open a series</div><div>→ Hide what you don't want</div><div>→ Share a direct link</div></div>
            </section>
            {creators.length > 0 && <section className="bg-white border-4 border-black neo-shadow-sm p-5"><div className="flex items-center gap-2 border-b-2 border-black pb-3"><UserPlus className="w-5 h-5"/><h3 className="font-display font-black uppercase">POPULAR CREATORS</h3></div><div className="pt-3 space-y-2">{[...creators].sort((a,b)=>(Number(b.followersCount||0)-Number(a.followersCount||0))).slice(0,5).map(u=><button key={u.uid} onClick={()=>onNavigate('creator',u.username)} className="w-full text-left border-2 border-black p-2 hover:bg-[var(--color-primary)] flex items-center gap-2">{u.photoURL?<img src={u.photoURL} alt="" className="w-8 h-8 rounded-full object-cover border-2 border-black"/>:<div className="w-8 h-8 rounded-full bg-neutral-100 border-2 border-black flex items-center justify-center font-black">{u.displayName.charAt(0)}</div>}<span className="min-w-0"><b className="block font-display text-xs uppercase truncate">{u.displayName}<VerifiedBadge verified={u.isVerified} color={u.verificationColor} className="inline w-3 h-3 ml-1"/></b><span className="block font-mono text-[9px] text-neutral-500">@{u.username} · {Number(u.followersCount||0).toLocaleString()} followers</span></span></button>)}</div></section>}
            {communities.length > 0 && <section className="bg-[var(--color-primary)] border-4 border-black p-5"><div className="font-mono text-[10px] font-black uppercase">COMMUNITIES TO EXPLORE</div><div className="space-y-2 mt-3">{communities.slice(0,5).map(c=><button key={c.id} onClick={()=>onNavigate('social')} className="w-full text-left p-2 border-2 border-black bg-white"><b className="font-mono text-xs">c/{c.slug}</b><span className="block font-mono text-[9px] text-neutral-500">{c.membersCount} members</span></button>)}</div></section>}
            {questions.length > 0 && <section className="bg-white border-4 border-black p-5"><div className="font-mono text-[10px] font-black uppercase">QUESTIONS</div>{questions.slice(0,4).map(q=><button key={q.id} onClick={()=>onNavigate('social')} className="block w-full text-left mt-3 p-2 border-2 border-black hover:bg-neutral-100"><b className="font-display text-sm">{q.title}</b><span className="block font-mono text-[9px] text-neutral-500">{q.answersCount} answers</span></button>)}</section>}
          </aside>
        </div>
      )}

      {showWhy && (
        <div className="fixed inset-0 z-[90] bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={()=>setShowWhy(null)}>
          <div className="w-full max-w-md bg-white border-4 border-black neo-shadow-lg p-6" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between"><div className="font-mono text-[10px] font-black uppercase">WHY THIS?</div><button onClick={()=>setShowWhy(null)} className="border-2 border-black p-1"><X className="w-4 h-4"/></button></div>
            <h3 className="font-display font-black text-2xl uppercase mt-3">DISCOVERY SIGNAL</h3>
            <p className="text-sm mt-3">{labelForWhy(rankedItems.find(i=>i.key===showWhy) || items.find(i=>i.key===showWhy)!)}</p>
            <p className="font-mono text-[9px] text-neutral-500 uppercase mt-4">Explore never guarantees an item is objectively “best”. It is a ranking surface, not a quality certification.</p>
          </div>
        </div>
      )}

      {surprise && (
        <div className="fixed inset-0 z-[95] bg-black/70 flex items-end sm:items-center justify-center p-4" onClick={()=>setSurprise(null)}>
          <div className="w-full max-w-xl bg-[var(--color-primary)] border-4 border-black neo-shadow-lg p-6" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between"><span className="font-mono text-[10px] font-black uppercase inline-flex items-center gap-2"><Zap className="w-4 h-4"/> SURPRISE DISCOVERY</span><button onClick={()=>setSurprise(null)} className="border-2 border-black bg-white p-1"><X className="w-4 h-4"/></button></div>
            <h3 className="font-display font-black text-3xl uppercase mt-4">{surprise.kind==='article'?surprise.article.title:surprise.kind==='post'?surprise.post.title:surprise.series.title}</h3>
            <p className="text-sm mt-3">Randomly selected from the current Explore pool. No ranking claim implied.</p>
            <button onClick={()=>{const x=surprise;setSurprise(null); if(x.kind==='article')onNavigate('article',x.article.slug); else if(x.kind==='post')onNavigate('community_post',x.post.id); else onNavigate('series',x.series.id);}} className="mt-5 px-5 py-3 bg-black text-white font-display font-black uppercase border-2 border-black">OPEN DISCOVERY →</button>
          </div>
        </div>
      )}
    </div>
  );
};
