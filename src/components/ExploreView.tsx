import React, { useEffect, useMemo, useState } from 'react';
import { Article, CommunityPost, CommunityUser, PageView } from '../types';
import { getPosts, getUserFollowing, extractHashtags } from '../lib/community';
import { getCommunities, getQuestions, getTopics, SocialCommunity, SocialQuestion, SocialTopic } from '../lib/social';
import { Search, Compass, TrendingUp, Sparkles, Hash, ArrowUp, MessageSquare, Repeat2, Loader2, BookOpen } from 'lucide-react';
import { VerifiedBadge } from './VerifiedBadge';
import { CommunityPostExtras } from './CommunityPostExtras';
import { formatDisplayDate } from '../lib/dateUtils';

interface Props { articles: Article[]; userAuth?: { uid: string } | null; userProfile?: CommunityUser | null; onNavigate: (page: PageView, param?: string) => void; initialHashtag?: string; }

export const ExploreView: React.FC<Props> = ({ articles, userAuth, userProfile, onNavigate, initialHashtag = '' }) => {
  const [tab, setTab] = useState<'explore'|'for-you'>('explore');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [query, setQuery] = useState(initialHashtag ? `#${initialHashtag.replace(/^#/, '')}` : '');
  const [loading, setLoading] = useState(true);
  const [communities, setCommunities] = useState<SocialCommunity[]>([]);
  const [questions, setQuestions] = useState<SocialQuestion[]>([]);
  const [topics, setTopics] = useState<SocialTopic[]>([]);

  useEffect(() => { setQuery(initialHashtag ? `#${initialHashtag.replace(/^#/, '')}` : ''); }, [initialHashtag]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([getPosts(), userAuth ? getUserFollowing(userAuth.uid).catch(() => []) : Promise.resolve([]), getCommunities().catch(() => []), getQuestions().catch(() => []), getTopics().catch(() => [])])
      .then(([all, following, cs, qs, ts]) => { if (!active) return; setPosts(all); setFollowingIds((following as any[]).map(x => x.uid)); setCommunities(cs as SocialCommunity[]); setQuestions(qs as SocialQuestion[]); setTopics(ts as SocialTopic[]); })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [userAuth?.uid]);

  const trending = useMemo(() => {
    const counts = new Map<string, number>();
    posts.forEach(p => (p.hashtags || extractHashtags(`${p.title} ${p.content}`)).forEach(t => counts.set(t, (counts.get(t)||0)+1)));
    return [...counts.entries()].sort((a,b) => b[1]-a[1]).slice(0,12);
  }, [posts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let pool = posts;
    if (tab === 'for-you' && followingIds.length) pool = posts.filter(p => followingIds.includes(p.authorId) || p.authorId === userProfile?.uid);
    if (q) {
      const tag = q.replace(/^#/, '');
      pool = pool.filter(p => p.title.toLowerCase().includes(q.replace(/^#/, '')) || p.content.toLowerCase().includes(q.replace(/^#/, '')) || p.authorUsername.toLowerCase().includes(q.replace(/^@/, '')) || (p.hashtags || extractHashtags(`${p.title} ${p.content}`)).includes(tag));
    }
    return [...pool].sort((a,b) => {
      const score = (p: CommunityPost) => (p.upvotesCount||0)*3 + (p.commentsCount||0)*2 + (p.repostsCount||0)*4 + (p.isFeatured?12:0);
      if (!q && tab === 'explore') return score(b)-score(a) || new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime();
      return new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime();
    }).slice(0,40);
  }, [posts, followingIds, tab, query, userProfile?.uid]);

  const articleResults = useMemo(() => {
    const q=query.trim().toLowerCase(); if (!q) return [];
    const needle=q.replace(/^#/,'').replace(/^@/,'');
    return articles.filter(a => a.title.toLowerCase().includes(needle)||a.excerpt.toLowerCase().includes(needle)||a.category.toLowerCase().includes(needle)||a.tags.some(t=>t.toLowerCase().includes(needle))).slice(0,8);
  }, [articles, query]);

  const editorArticles = articles.filter(a => a.featured || a.pinned).slice(0, 4);
  const editorPosts = posts.filter(p => p.isFeatured).slice(0, 4);

  return <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14 space-y-8">
      {(editorArticles.length > 0 || editorPosts.length > 0) && <section className="mb-10 bg-black text-white border-4 border-black neo-shadow-lg p-5 sm:p-7">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div><div className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-primary)]">EDITORIAL</div><h2 className="font-display font-black text-2xl sm:text-3xl uppercase">Editor's Picks</h2></div>
          <span className="font-mono text-[9px] border border-white px-2 py-1 uppercase">Curated</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {editorArticles.map(a => <button key={`ea-${a.slug}`} onClick={() => onNavigate('article', a.slug)} className="text-left p-4 border-2 border-white hover:bg-[var(--color-primary)] hover:text-black transition-colors"><span className="font-mono text-[9px] uppercase">ARTICLE • {a.category}</span><span className="block font-display font-black text-lg uppercase mt-1">{a.title}</span></button>)}
          {editorPosts.map(p => <button key={`ep-${p.id}`} onClick={() => onNavigate('community_post', p.id)} className="text-left p-4 border-2 border-white hover:bg-[var(--color-secondary)] hover:text-black transition-colors"><span className="font-mono text-[9px] uppercase">COMMUNITY • @{p.authorUsername}</span><span className="block font-display font-black text-lg uppercase mt-1">{p.title}</span></button>)}
        </div>
      </section>}

    <div className="bg-black text-white border-4 border-black neo-shadow p-6 sm:p-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
        <div>
          <div className="font-mono text-xs font-bold text-[var(--color-secondary)] uppercase tracking-widest mb-2">OFFSCRPT / DISCOVERY</div>
          <h1 className="font-display font-black text-4xl sm:text-6xl uppercase tracking-tighter">Explore</h1>
          <p className="font-sans text-sm text-neutral-300 mt-2 max-w-2xl">Find community conversations, engineering blogs, hashtags and dispatches worth reading.</p>
        </div>
        <div className="flex border-2 border-white">
          <button onClick={()=>setTab('explore')} className={`px-4 py-2 font-mono text-xs font-black uppercase ${tab==='explore'?'bg-[var(--color-primary)] text-black':'hover:bg-white hover:text-black'}`}><Compass className="inline w-4 h-4 mr-1"/>Explore</button>
          <button onClick={()=>setTab('for-you')} className={`px-4 py-2 font-mono text-xs font-black uppercase ${tab==='for-you'?'bg-[var(--color-secondary)] text-black':'hover:bg-white hover:text-black'}`}><Sparkles className="inline w-4 h-4 mr-1"/>For You</button>
        </div>
      </div>
      <div className="mt-6 flex items-center bg-white text-black border-2 border-white px-3 py-2">
        <Search className="w-5 h-5 mr-2"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search posts, articles, @handles or #hashtags..." className="w-full bg-transparent focus:outline-none font-mono text-sm"/>
      </div>
    </div>

    {(communities.length > 0 || questions.length > 0 || topics.length > 0) && <section className="grid md:grid-cols-3 gap-4">
      <div className="bg-white border-4 border-black p-5"><div className="font-mono text-[10px] font-black uppercase text-neutral-500">COMMUNITIES</div><h3 className="font-display font-black text-xl uppercase mt-1">Find your people</h3><div className="space-y-2 mt-4">{communities.slice(0,3).map(c=><button key={c.id} onClick={()=>onNavigate('social')} className="w-full text-left border-2 border-black p-3 hover:bg-[var(--color-primary)]"><b>c/{c.slug}</b><div className="font-mono text-[9px]">{c.membersCount} members · by @{c.ownerUsername||'creator'}</div></button>)}</div><button onClick={()=>onNavigate('social')} className="mt-3 font-mono text-[10px] font-black underline">VIEW ALL →</button></div>
      <div className="bg-[var(--color-primary)] border-4 border-black p-5"><div className="font-mono text-[10px] font-black uppercase">QUESTIONS</div><h3 className="font-display font-black text-xl uppercase mt-1">Ask / answer</h3><div className="space-y-2 mt-4">{questions.slice(0,3).map(q=><button key={q.id} onClick={()=>onNavigate('social')} className="w-full text-left border-2 border-black p-3 bg-white hover:bg-neutral-100"><b className="line-clamp-2">{q.title}</b><div className="font-mono text-[9px]">{q.answersCount} answers · @{q.authorUsername}</div></button>)}</div></div>
      <div className="bg-white border-4 border-black p-5"><div className="font-mono text-[10px] font-black uppercase text-neutral-500">TOPICS</div><h3 className="font-display font-black text-xl uppercase mt-1">Follow ideas</h3><div className="flex flex-wrap gap-2 mt-4">{topics.slice(0,8).map(t=><button key={t.id} onClick={()=>onNavigate('social')} className="px-2 py-1 border-2 border-black font-mono text-[10px] hover:bg-[var(--color-secondary)]">#{t.slug}</button>)}</div></div>
    </section>}

    <div className="grid lg:grid-cols-[1fr_280px] gap-8">
      <section className="space-y-5">
        {query && articleResults.length>0 && <div className="space-y-2"><div className="font-mono text-xs font-black uppercase">Dispatch matches</div>{articleResults.map(a=><button key={a.id} onClick={()=>onNavigate('article',a.slug)} className="w-full text-left bg-white border-2 border-black p-3 hover:bg-[var(--color-primary)]"><BookOpen className="inline w-4 h-4 mr-2"/><b>{a.title}</b><span className="font-mono text-[10px] ml-2">{a.category}</span></button>)}</div>}
        {loading ? <div className="py-24 flex justify-center"><Loader2 className="animate-spin"/></div> : tab==='for-you' && !followingIds.length ? <div className="border-4 border-dashed border-black p-12 text-center"><h2 className="font-display font-black text-2xl uppercase">Your feed is waiting</h2><p className="text-sm text-neutral-600 mt-2">Follow community builders to personalize For You. Explore still works without follows.</p></div> : filtered.length===0 ? <div className="border-4 border-dashed border-black p-12 text-center font-mono text-sm">No matching posts.</div> : filtered.map(post=><article key={post.id} onClick={()=>onNavigate('community_post',post.id)} className="bg-white border-4 border-black p-5 sm:p-6 neo-shadow-sm hover:-translate-y-1 transition-all cursor-pointer">
          <div className="flex items-center justify-between gap-3"><span className="px-2 py-1 bg-[var(--color-secondary)] border-2 border-black font-mono text-[10px] font-black uppercase">{post.type==='blog'?'Community Blog':'Discussion'}</span><span className="font-mono text-[10px] text-neutral-500">{formatDisplayDate(post.createdAt)}</span></div>
          <h2 className="font-display font-black text-xl sm:text-2xl mt-3">{post.title}</h2>
          <p className="text-sm text-neutral-600 mt-2 line-clamp-3 whitespace-pre-wrap">{post.content}</p>
          <CommunityPostExtras post={post} onHashtag={tag=>setQuery(`#${tag}`)} compact />
          <div className="mt-4 pt-3 border-t-2 border-neutral-200 flex items-center justify-between font-mono text-xs"><button onClick={e=>{e.stopPropagation();onNavigate('community_profile',post.authorUsername)}} className="font-bold hover:underline inline-flex items-center gap-1">@{post.authorUsername}{((post as any).platformRole==='master_admin'||(post as any).platformRole==='moderator')&&<span className="px-1 border border-black bg-[var(--color-primary)] font-mono text-[9px] font-black">{(post as any).platformRole==='master_admin'?'MASTER':'MOD'}</span>}<VerifiedBadge verified={post.isVerified} color={post.verificationColor} className="w-3.5 h-3.5 inline"/></button><div className="flex gap-4"><span><ArrowUp className="inline w-3.5 h-3.5"/> {post.upvotesCount||0}</span><span><MessageSquare className="inline w-3.5 h-3.5"/> {post.commentsCount||0}</span><span><Repeat2 className="inline w-3.5 h-3.5"/> {post.repostsCount||0}</span></div></div>
        </article>)}
      </section>
      <aside className="space-y-5">
        <div className="bg-white border-4 border-black p-5 neo-shadow-sm"><div className="flex items-center gap-2 border-b-2 border-black pb-3"><TrendingUp className="w-5 h-5"/><h3 className="font-display font-black uppercase">Trending Topics</h3></div><div className="pt-3 space-y-2">{trending.length?trending.map(([tag,count],i)=><button key={tag} onClick={()=>setQuery(`#${tag}`)} className="w-full text-left flex items-center justify-between p-2 border-2 border-transparent hover:border-black hover:bg-[var(--color-primary)]"><span className="font-mono text-xs font-bold"><span className="text-neutral-400 mr-2">{String(i+1).padStart(2,'0')}</span><Hash className="inline w-3 h-3"/>{tag}</span><span className="font-mono text-[10px] text-neutral-500">{count} posts</span></button>):<span className="text-xs text-neutral-500">Hashtags appear here as the community grows.</span>}</div></div>
        <div className="bg-[var(--color-primary)] border-4 border-black p-5"><div className="font-mono text-xs font-black uppercase mb-2">Discovery tip</div><p className="font-sans text-sm">Use <b>#hashtags</b> in posts to make topics discoverable. Use <b>@handles</b> to connect directly with builders.</p></div>
      </aside>
    </div>
  </div>;
};
