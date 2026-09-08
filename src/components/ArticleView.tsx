import { VerifiedBadge } from './VerifiedBadge';
import React, { useState, useEffect } from 'react';
import { Article, SiteConfig } from '../types';
import { 
  ArrowLeft, 
  Clock, 
  Calendar, 
  Bookmark, 
  Share2, 
  Check, 
  Copy, 
  ThumbsUp, 
  Heart, 
  MessageSquare, 
  Twitter, 
  Linkedin, 
  ExternalLink,
  ChevronRight,
  ChevronDown,
  ArrowUp,
  Sparkles,
  Layers,
  Terminal,
  Link2,
  List,
  HeartPulse
} from 'lucide-react';
import { ArticleCard } from './ArticleCard';
import { CommentsSection } from './CommentsSection';
import { RichText } from './RichText';
import { auth, loginWithGoogle } from '../lib/firebase';
import { useAuthUser } from '../lib/useAuthUser';
import { getArticleLikeStatus, toggleArticleLike, getPost, getCommunityProfile } from '../lib/community';
import { recordArticleView, ARTICLE_REACTIONS, getArticleReaction, setArticleReaction, getSeriesArticles } from '../lib/cms';
import { calculateArticleReadingTime, getArticleReadingProgress, saveArticleReadingProgress, ArticleEngagementStats, subscribeArticleEngagementStats } from '../lib/reading';
import { UserIdentity } from './UserIdentity';
import type { ArticleReaction } from '../lib/cms';

function slugifyHeading(value: string): string {
  return String(value || 'section')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'section';
}

function getVideoEmbedUrl(url: string): string | null {
  const value = String(url || '').trim();
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.hostname.includes('youtube.com')) {
      const id = parsed.searchParams.get('v');
      return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : null;
    }
    if (parsed.hostname === 'youtu.be') {
      const id = parsed.pathname.replace(/^\//, '').split('/')[0];
      return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : null;
    }
    if (parsed.hostname.includes('vimeo.com')) {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return id ? `https://player.vimeo.com/video/${encodeURIComponent(id)}` : null;
    }
  } catch {}
  return null;
}

interface ArticleViewProps {
  article: Article;
  allArticles: Article[];
  onBack: () => void;
  onSelectArticle: (slug: string) => void;
  onOpenSeries?: (seriesId: string) => void;
  onOpenAuthorProfile?: (username: string) => void;
  isSaved: boolean;
  onToggleSave: (slug: string) => void;
  siteConfig: SiteConfig;
}

export const ArticleView: React.FC<ArticleViewProps> = ({
  article,
  allArticles,
  onBack,
  onSelectArticle,
  onOpenSeries,
  onOpenAuthorProfile,
  isSaved,
  onToggleSave,
  siteConfig,
}) => {
  const [copiedCodeIdx, setCopiedCodeIdx] = useState<number | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [engagement, setEngagement] = useState<ArticleEngagementStats>({ likes: 0, applauds: 0, comments: 0, reactions: {} });
  const [savedCloudProgress, setSavedCloudProgress] = useState(0);
  const [resumeVisible, setResumeVisible] = useState(false);
  const lastSavedProgressRef = React.useRef(-1);
  const saveTimerRef = React.useRef<number | null>(null);
  const [hasClapped, setHasClapped] = useState(false);
  const [fontSize, setFontSize] = useState<'normal' | 'large'>('normal');
  const [scrollProgress, setScrollProgress] = useState(0);
  const user = useAuthUser();
  const [reaction, setReaction] = useState<ArticleReaction|null>(null);
  const [reactionBusy, setReactionBusy] = useState(false);
  const [seriesArticles, setSeriesArticles] = useState<Article[]>([]);
  const [resolvedOriginalAuthor, setResolvedOriginalAuthor] = useState<any>(article.originalAuthor || article.author);

  const toc = article.content
    .map((b,i)=>({ b, i, id: `article-block-${i}-${slugifyHeading(String(b.content || 'section'))}` }))
    .filter(x=>x.b.type==='heading2'||x.b.type==='heading3');
  const [activeTocId, setActiveTocId] = useState<string>('');
  const [tocOpen, setTocOpen] = useState(true);
  const [copiedTocId, setCopiedTocId] = useState<string | null>(null);

  useEffect(() => { void recordArticleView(article.slug, user?.uid); }, [article.slug, user?.uid]);
  useEffect(() => subscribeArticleEngagementStats(article.slug, setEngagement), [article.slug]);
  useEffect(() => { let active = true; if (!user) { setSavedCloudProgress(0); return; } getArticleReadingProgress(article.slug).then(p => { if (active && p) { setSavedCloudProgress(p.percent); setResumeVisible(p.percent >= 10 && p.percent < 90); } }).catch(() => {}); return () => { active = false; }; }, [article.slug, user]);

  useEffect(() => { if(user) getArticleReaction(article.slug,user.uid).then(setReaction).catch(()=>setReaction(null)); else setReaction(null); }, [article.slug,user]);
  useEffect(() => { if(article.seriesId) getSeriesArticles(article.seriesId).then(setSeriesArticles).catch(()=>setSeriesArticles([])); else setSeriesArticles([]); }, [article.seriesId]);
  useEffect(() => {
    let active = true;
    const resolve = async () => {
      const fallback = article.originalAuthor || article.author;
      if (!article.sourcePostId) { if (active) setResolvedOriginalAuthor(fallback); return; }
      try {
        let post:any = null;
        if ((article as any).sourceCommunityId) {
          const { doc, getDoc } = await import('firebase/firestore');
          const { db } = await import('../lib/firebase');
          const snap = await getDoc(doc(db, 'communities', (article as any).sourceCommunityId, 'posts', article.sourcePostId));
          post = snap.exists() ? { ...snap.data(), id: snap.id } : null;
        } else {
          post = await getPost(article.sourcePostId);
          if (!post) {
            try {
              const { collectionGroup, getDocs, limit, query } = await import('firebase/firestore');
              const { db } = await import('../lib/firebase');
              const snap = await getDocs(query(collectionGroup(db, 'posts'), limit(500)));
              const match = snap.docs.find((d:any) => d.id === article.sourcePostId);
              if (match) post = { ...match.data(), id: match.id };
            } catch {}
          }
        }
        if (!post?.authorId) { if (active) setResolvedOriginalAuthor(fallback); return; }
        let profile:any = null;
        try { profile = await getCommunityProfile(post.authorId); } catch {}
        if (active) setResolvedOriginalAuthor({
          ...fallback,
          uid: post.authorId,
          username: profile?.username || post.authorUsername || fallback.username,
          name: profile?.displayName || post.authorName || fallback.name,
          avatar: profile?.photoUrl || post.authorAvatar || fallback.avatar,
          bio: profile?.bio || fallback.bio,
          isVerified: !!(profile?.isVerified ?? post.isVerified ?? fallback.isVerified),
          verificationColor: profile?.verificationColor || post.verificationColor || fallback.verificationColor
        });
      } catch { if (active) setResolvedOriginalAuthor(fallback); }
    };
    void resolve();
    return () => { active = false; };
  }, [article.slug, article.sourcePostId, (article as any).sourceCommunityId, article.originalAuthor, article.author]);


  // Check if current user has liked this article in Firestore
  useEffect(() => {
    if (user) {
      getArticleLikeStatus(article.slug, user.uid).then(liked => {
        setHasClapped(liked);
      });
    } else {
      setHasClapped(false);
    }
  }, [article.slug, user]);

  // Track reading progress locally and in the signed-in account. Writes are debounced and only sent when progress moves meaningfully.
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight <= 0) return;
      const currentProgress = Math.min(100, Math.max(0, (window.scrollY / totalHeight) * 100));
      setScrollProgress(currentProgress);
      if (user && Math.abs(currentProgress - lastSavedProgressRef.current) >= 5) {
        lastSavedProgressRef.current = currentProgress;
        if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = window.setTimeout(() => {
          void saveArticleReadingProgress(article.slug, currentProgress, activeTocId || '', currentProgress >= 90).catch(() => {});
        }, 900);
      }
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => { window.removeEventListener('scroll', handleScroll); if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current); };
  }, [article.slug, user, activeTocId]);

  useEffect(() => {
    if (!user || scrollProgress < 95) return;
    void saveArticleReadingProgress(article.slug, 100, activeTocId || '', true).catch(() => {});
  }, [scrollProgress, article.slug, user, activeTocId]);

  const resumeArticle = () => {
    const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (totalHeight > 0 && savedCloudProgress > 0) window.scrollTo({ top: totalHeight * (savedCloudProgress / 100), behavior: 'smooth' });
    setResumeVisible(false);
  };

  const handleCopyCode = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeIdx(idx);
    setTimeout(() => setCopiedCodeIdx(null), 2000);
  };

  const handleShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleClap = async () => {
    let currentUser = user;
    if (!currentUser) {
      try {
        const credUser = await loginWithGoogle();
        currentUser = credUser;
      } catch (err) {
        console.error("User sign in cancelled or failed:", err);
        return;
      }
    }
    if (!currentUser) return;

    try {
      const newLiked = await toggleArticleLike(article.slug, currentUser.uid, hasClapped);
      setHasClapped(newLiked);
      setEngagement(prev => ({ ...prev, likes: Math.max(0, prev.likes + (newLiked ? 1 : -1)), applauds: Math.max(0, prev.applauds + (newLiked ? 1 : -1)) }));
    } catch (err) {
      console.error("Error liking article:", err);
    }
  };

  // Related articles (same category or latest excluding current)
  const relatedArticles = allArticles
    .filter((a) => a.slug !== article.slug)
    .map(a => ({ a, score: (a.category === article.category ? 4 : 0) + (a.tags||[]).filter(t => (article.tags||[]).map(x=>x.toLowerCase()).includes(String(t).toLowerCase())).length * 2 }))
    .sort((x,y) => y.score - x.score || new Date(y.a.publishedAt).getTime() - new Date(x.a.publishedAt).getTime())
    .slice(0, 3)
    .map(x=>x.a);
  useEffect(() => {
    if (!toc.length) return;
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    window.setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }, [article.slug, toc.length]);

  useEffect(() => {
    if (!toc.length) return;
    const elements = toc.map(({ id }) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (!elements.length) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a,b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]?.target?.id) setActiveTocId(visible[0].target.id);
    }, { rootMargin: '-120px 0px -65% 0px', threshold: [0, 0.1, 0.5] });
    elements.forEach((element) => observer.observe(element));
    setActiveTocId(elements[0].id);
    return () => observer.disconnect();
  }, [article.slug, article.content]);

  const jumpToHeading = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${id}`);
    setActiveTocId(id);
  };

  const copyHeadingLink = async (id: string) => {
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}#${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedTocId(id);
      window.setTimeout(() => setCopiedTocId(null), 1600);
    } catch {}
  };

  return (
    <div className="w-full bg-white min-h-screen">
      {/* Top Reading Progress Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-2 bg-neutral-200">
        <div 
          className="h-full bg-[var(--color-primary)] border-b-2 border-black transition-all duration-75"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Floating Sub-Header for reading utility */}
      <div className="sticky top-20 z-30 bg-white border-b-4 border-black py-2.5 px-4 sm:px-8 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 font-display font-black text-xs uppercase px-3 py-1.5 bg-white neo-border-2 neo-shadow-sm hover:bg-[var(--color-primary)] active:translate-x-0.5 active:translate-y-0.5 transition-all"
        >
          <ArrowLeft className="w-4 h-4 stroke-[3]" />
          <span>ALL DISPATCHES</span>
        </button>

        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Font Size Adjuster */}
          <div className="hidden sm:flex items-center neo-border-2 bg-white text-xs font-mono font-bold">
            <button
              onClick={() => setFontSize('normal')}
              className={`px-2 py-1 ${fontSize === 'normal' ? 'bg-black text-white' : 'hover:bg-neutral-200'}`}
              title="Standard typography"
            >
              A
            </button>
            <button
              onClick={() => setFontSize('large')}
              className={`px-2 py-1 ${fontSize === 'large' ? 'bg-black text-white' : 'hover:bg-neutral-200'}`}
              title="Enlarged reading typography"
            >
              A+
            </button>
          </div>

          {/* Bookmark Button */}
          <button
            onClick={() => onToggleSave(article.slug)}
            className={`p-1.5 px-2.5 neo-border-2 font-display font-bold text-xs flex items-center space-x-1.5 transition-all active:translate-x-0.5 active:translate-y-0.5 ${
              isSaved ? 'bg-[var(--color-primary)] text-black neo-shadow-sm' : 'bg-white hover:bg-neutral-100 text-neutral-800'
            }`}
            title="Bookmark this essay"
          >
            <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
            <span className="hidden md:inline">{isSaved ? 'SAVED' : 'SAVE'}</span>
          </button>

          {/* Copy Link Share */}
          <button
            onClick={handleShareLink}
            className="p-1.5 px-3 neo-border-2 bg-white hover:bg-[var(--color-secondary)] font-display font-bold text-xs flex items-center space-x-1.5 transition-all text-black active:translate-x-0.5 active:translate-y-0.5"
          >
            {copiedLink ? <Check className="w-4 h-4 text-green-700 stroke-[3]" /> : <Share2 className="w-4 h-4 stroke-[2.5]" />}
            <span>{copiedLink ? 'COPIED!' : 'SHARE'}</span>
          </button>
        </div>
      </div>

      {/* Main Article Container */}
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-20">
        
        {/* Breadcrumb path */}
        <div className="flex items-center space-x-2 font-mono text-xs font-bold text-neutral-500 mb-6 uppercase">
          <button onClick={onBack} className="hover:text-black hover:underline">
            HOME
          </button>
          <ChevronRight className="w-3.5 h-3.5" />
          <button onClick={onBack} className="hover:text-black hover:underline">
            DISPATCHES
          </button>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-black">{article.category}</span>
        </div>

        {/* Category Sticker */}
        <div className="mb-4">
          <span className="inline-block px-3.5 py-1 bg-[var(--color-primary)] text-black font-display font-black text-xs sm:text-sm uppercase neo-border neo-shadow-sm">
            {article.category}
          </span>
        </div>

        {/* Title */}
        <h1 className="font-display font-black text-3xl sm:text-5xl md:text-6xl text-black tracking-tight leading-[1.05] mb-6">
          {article.title}
        </h1>
        {article.editedAt && <div className="mb-4 inline-block px-2 py-1 border-2 border-black bg-neutral-100 font-mono text-[10px] font-black uppercase">EDITED</div>}
        {article.editReviewStatus === 'pending' && <div className="mb-4 ml-2 inline-block px-2 py-1 border-2 border-black bg-yellow-200 font-mono text-[10px] font-black uppercase">EDIT PENDING REVIEW</div>}

        {/* Excerpt */}
        <p className="font-serif text-xl sm:text-2xl text-neutral-800 leading-relaxed font-normal italic mb-8 border-l-4 border-black pl-4 py-1">
          <RichText text={article.excerpt} />
        </p>

        {/* Author Metadata Strip */}
        <div className="p-4 bg-white neo-border neo-shadow mb-10 flex flex-wrap items-center justify-between gap-4">
          <UserIdentity
            name={resolvedOriginalAuthor?.name || article.author.name}
            username={resolvedOriginalAuthor?.username || article.author.username || siteConfig.authorProfileUsername}
            avatar={resolvedOriginalAuthor?.avatar || article.author.avatar}
            uid={resolvedOriginalAuthor?.uid || article.author.uid}
            verified={resolvedOriginalAuthor?.isVerified ?? article.author.isVerified}
            verificationColor={resolvedOriginalAuthor?.verificationColor || article.author.verificationColor}
            size="lg"
            onClick={() => { const authorHandle = resolvedOriginalAuthor?.username || article.author.username || siteConfig.authorProfileUsername; if (authorHandle && onOpenAuthorProfile) onOpenAuthorProfile(authorHandle); }}
          />

          <div className="flex items-center space-x-4 text-xs font-mono font-bold text-neutral-700">
            <div className="flex items-center space-x-1.5">
              <Calendar className="w-4 h-4 text-black" />
              <span>{article.publishedAt}</span>
            </div>
            <span>•</span>
            <div className="flex items-center space-x-1.5">
              <Clock className="w-4 h-4 text-black" />
              <span>{calculateArticleReadingTime(article)} MIN READ</span>
            </div>
          </div>
        </div>

        {article.republishedBy && (
          <div className="mb-8 border-2 border-black bg-[var(--color-primary)] p-3 font-mono text-xs flex flex-wrap items-center gap-2">
            <span>REPUBLISHED BY</span>
            {article.republishedBy.avatar && <img src={article.republishedBy.avatar} alt="" className="w-6 h-6 border-2 border-black object-cover" />}
            <button type="button" onClick={() => { const republisherHandle = article.republishedBy?.username; if (republisherHandle && onOpenAuthorProfile) onOpenAuthorProfile(republisherHandle); }} className="font-black underline">@{article.republishedBy.username || 'krishsarkar'}</button>
            <span>with credit to the original creator</span>
          </div>
        )}

        {article.seriesId && seriesArticles.length > 0 && (
          <aside className="mb-10 border-4 border-black p-4 bg-neutral-50">
            <div className="font-display font-black uppercase flex items-center gap-2"><List className="w-4 h-4"/> {article.seriesName || 'Article Series'}</div>
            <div className="mt-3 grid gap-2">
              {seriesArticles.map((item)=><button key={item.slug} onClick={()=>onSelectArticle(item.slug)} className={`text-left border-2 border-black p-2 font-mono text-xs ${item.slug===article.slug?'bg-[var(--color-primary)] font-black':'bg-white'}`}>{item.seriesOrder ? `${item.seriesOrder}. ` : ''}{item.title}</button>)}
            </div>
          </aside>
        )}

        {article.seriesId && seriesArticles.length > 0 && (() => {
          const idx = seriesArticles.findIndex(x => x.slug === article.slug);
          const prev = idx > 0 ? seriesArticles[idx - 1] : null;
          const next = idx >= 0 && idx < seriesArticles.length - 1 ? seriesArticles[idx + 1] : null;
          const progress = idx >= 0 ? Math.round(((idx + 1) / seriesArticles.length) * 100) : 0;
          return <div className="mb-10 border-2 border-black bg-white p-4"><div className="flex justify-between font-mono text-[10px] uppercase"><span>PART {idx + 1} OF {seriesArticles.length}</span><span>{progress}% COMPLETE</span></div><div className="h-3 border-2 border-black mt-2 bg-white"><div className="h-full bg-[var(--color-primary)]" style={{width:`${progress}%`}} /></div><div className="grid grid-cols-2 gap-2 mt-3"><button disabled={!prev} onClick={()=>prev&&onSelectArticle(prev.slug)} className="border-2 border-black p-3 text-left font-mono text-[10px] disabled:opacity-30">← PREVIOUS<br/><b className="font-display text-sm">{prev?.title || 'START'}</b></button><button disabled={!next} onClick={()=>next&&onSelectArticle(next.slug)} className="border-2 border-black p-3 text-right font-mono text-[10px] disabled:opacity-30">NEXT →<br/><b className="font-display text-sm">{next?.title || 'END'}</b></button></div></div>;
        })()}

        {resumeVisible && user && (
          <div className="mb-6 border-4 border-black bg-[var(--color-success)] p-4 neo-shadow flex flex-wrap items-center justify-between gap-3">
            <div><div className="font-mono text-[10px] font-black uppercase">Cloud reading progress</div><div className="font-display font-black text-xl uppercase mt-1">Resume at {savedCloudProgress}%</div></div>
            <button type="button" onClick={resumeArticle} className="border-2 border-black bg-black text-white px-4 py-2 font-mono text-[10px] font-black uppercase">RESUME READING</button>
          </div>
        )}

        {toc.length > 0 && (
          <nav className="mb-10 border-4 border-black bg-neutral-50 neo-shadow" aria-label="Table of contents">
            <div className="flex items-center justify-between gap-3 p-4 border-b-2 border-black">
              <div>
                <div className="font-display font-black uppercase">Table of contents</div>
                <div className="font-mono text-[10px] text-neutral-500 uppercase">{toc.length} sections · active section follows your scroll</div>
              </div>
              <button type="button" onClick={() => setTocOpen(value => !value)} className="border-2 border-black p-2 bg-white hover:bg-[var(--color-primary)]" aria-expanded={tocOpen}>
                <ChevronDown className={`w-4 h-4 transition-transform ${tocOpen ? '' : '-rotate-90'}`} />
              </button>
            </div>
            {tocOpen && (
              <div className="p-3 grid gap-1">
                {toc.map(({b,i,id}, tocIndex)=>(
                  <div key={id} className={`flex items-center gap-1 border-2 border-transparent ${activeTocId===id?'bg-[var(--color-primary)] border-black':''}`}>
                    <button type="button" onClick={()=>jumpToHeading(id)} className={`min-w-0 flex-1 text-left font-mono text-xs py-2 px-2 ${b.type==='heading3'?'pl-6 text-neutral-700':'font-black'}`} aria-current={activeTocId===id?'location':undefined}>
                      <span className="mr-2 text-neutral-500">{String(tocIndex+1).padStart(2,'0')}</span><span><RichText text={b.content} /></span>
                    </button>
                    <button type="button" onClick={()=>copyHeadingLink(id)} className="mr-1 p-1.5 border-2 border-black bg-white shrink-0" title="Copy section link" aria-label={`Copy link to ${String(b.content || 'section')}`}>
                      {copiedTocId===id ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </nav>
        )}

        {/* Featured Cover Image */}
        <div className="mb-12 neo-border neo-shadow-lg overflow-hidden bg-neutral-900">
          <img
            src={article.coverImage}
            alt={article.coverImageAlt || article.title}
            className="w-full h-auto max-h-[520px] object-cover"
          />
          {article.coverImageCaption && (
            <div className="p-3 bg-neutral-100 border-t-2 border-black font-mono text-xs text-neutral-700 italic">
              {article.coverImageCaption}
            </div>
          )}
        </div>

        {/* Article Body - Rich Medium/Editorial Typography */}
        <div className={`space-y-7 ${fontSize === 'large' ? 'text-xl leading-relaxed' : 'text-lg leading-relaxed'} font-serif text-neutral-900`}>
          {article.content.map((block, index) => {
            if (block.type === 'paragraph') {
              return (
                <p key={index} className="text-neutral-800 leading-relaxed">
                  <RichText text={block.content} />
                </p>
              );
            }

            if (block.type === 'heading2') {
              return (
                <h2 
                  key={index} 
                  id={`article-block-${index}-${slugifyHeading(String(block.content || 'section'))}`}
                  className="font-display font-black text-2xl sm:text-3xl text-black tracking-tight mt-12 pt-6 border-t-2 border-black/20 uppercase"
                >
                  <RichText text={block.content} />
                </h2>
              );
            }

            if (block.type === 'heading3') {
              return (
                <h3 
                  key={index} 
                  id={`article-block-${index}-${slugifyHeading(String(block.content || 'section'))}`}
                  className="font-display font-black text-xl sm:text-2xl text-black mt-8"
                >
                  <RichText text={block.content} />
                </h3>
              );
            }

            if (block.type === 'quote') {
              return (
                <figure key={index} className="my-8 p-6 bg-gray-50 border-l-8 border-black neo-border neo-shadow-sm">
                  <blockquote className="font-serif italic text-xl sm:text-2xl text-black leading-snug">
                    <RichText text={block.content} />
                  </blockquote>
                  {block.quoteAuthor && (
                    <figcaption className="mt-3 font-mono text-xs font-bold text-neutral-600 uppercase">
                      — {block.quoteAuthor}
                    </figcaption>
                  )}
                </figure>
              );
            }

            if (block.type === 'callout') {
              const bg = 
                block.calloutType === 'warning' ? 'bg-[var(--color-accent)]' :
                block.calloutType === 'insight' ? 'bg-[var(--color-primary)]' :
                block.calloutType === 'tip' ? 'bg-[var(--color-success)]' : 'bg-[var(--color-secondary)]';

              return (
                <div key={index} className="my-8 neo-border neo-shadow overflow-hidden bg-white">
                  <div className={`px-4 py-2 border-b-2 border-black font-display font-black text-xs uppercase tracking-wider text-black flex items-center justify-between ${bg}`}>
                    <span>{block.calloutTitle || 'KEY INSIGHT'}</span>
                    <Sparkles className="w-3.5 h-3.5 fill-black" />
                  </div>
                  <div className="p-5 font-sans font-medium text-neutral-900 text-base">
                    <RichText text={block.content} />
                  </div>
                </div>
              );
            }

            if (block.type === 'link') {
              return (
                <div key={index} className="my-6">
                  <a href={block.href || '#'} target={/^https?:/i.test(block.href || '') ? '_blank' : undefined} rel={/^https?:/i.test(block.href || '') ? 'noopener noreferrer' : undefined} className="inline-flex items-center gap-2 text-base font-sans font-black underline decoration-2 underline-offset-4 hover:opacity-70">
                    <RichText text={block.linkText || block.content || block.href || 'OPEN LINK'} />
                    <ExternalLink className="w-4 h-4 shrink-0" />
                  </a>
                </div>
              );
            }

            if (block.type === 'button') {
              const buttonStyle = block.buttonStyle === 'dark' ? 'bg-black text-white' : block.buttonStyle === 'secondary' ? 'bg-white text-black' : 'bg-[var(--color-primary)] text-black';
              return (
                <div key={index} className="my-8">
                  <a href={block.href || '#'} target={/^https?:/i.test(block.href || '') ? '_blank' : undefined} rel={/^https?:/i.test(block.href || '') ? 'noopener noreferrer' : undefined} className={`inline-flex items-center gap-2 px-5 py-3 border-2 border-black neo-shadow-sm font-display font-black uppercase text-sm hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all ${buttonStyle}`}>
                    <RichText text={block.buttonText || block.content || 'OPEN'} /> <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              );
            }

            if (block.type === 'video' && block.videoUrl) {
              const embedUrl = getVideoEmbedUrl(block.videoUrl);
              return (
                <figure key={index} className="my-10 neo-border neo-shadow overflow-hidden bg-black">
                  {embedUrl ? (
                    <div className="aspect-video w-full">
                      <iframe src={embedUrl} title={block.videoTitle || article.title} className="w-full h-full border-0" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
                    </div>
                  ) : (
                    <video src={block.videoUrl} controls preload="metadata" className="w-full h-auto max-h-[680px]" />
                  )}
                  {block.videoCaption && <figcaption className="p-3 bg-neutral-100 border-t-2 border-black font-mono text-xs text-neutral-700 italic"><RichText text={block.videoCaption} /></figcaption>}
                </figure>
              );
            }

            if (block.type === 'image' && block.imageUrl) {
              return (
                <figure key={index} className="my-10 neo-border neo-shadow overflow-hidden bg-neutral-900">
                  {block.imageHref ? <a href={block.imageHref} target={/^https?:/i.test(block.imageHref) ? '_blank' : undefined} rel={/^https?:/i.test(block.imageHref) ? 'noopener noreferrer' : undefined}><img src={block.imageUrl} alt={block.imageAlt || article.title} className="w-full h-auto max-h-[680px] object-cover" loading="lazy" /></a> : <img src={block.imageUrl} alt={block.imageAlt || article.title} className="w-full h-auto max-h-[680px] object-cover" loading="lazy" />}
                  {block.imageCaption && <figcaption className="p-3 bg-neutral-100 border-t-2 border-black font-mono text-xs text-neutral-700 italic"><RichText text={block.imageCaption} /></figcaption>}
                </figure>
              );
            }

            if (block.type === 'list' && block.items) {
              return (
                <ul key={index} className="my-8 list-disc pl-7 space-y-3 font-sans text-base text-neutral-800">
                  {block.items.filter(Boolean).map((item, idx) => <li key={idx}><RichText text={item} /></li>)}
                </ul>
              );
            }

            if (block.type === 'code' && block.codeBlock) {
              const isCopied = copiedCodeIdx === index;
              return (
                <div key={index} className="my-8 neo-border neo-shadow overflow-hidden bg-[#0F172A] text-white">
                  {/* Code block header */}
                  <div className="px-4 py-2.5 bg-[#1E293B] border-b-2 border-black flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center space-x-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                      <span className="ml-2 font-bold text-neutral-300">
                        {block.codeBlock.filename || `${block.codeBlock.language}.ts`}
                      </span>
                    </div>

                    <button
                      onClick={() => handleCopyCode(block.codeBlock?.code || '', index)}
                      className="px-2.5 py-1 bg-neutral-800 hover:bg-[var(--color-primary)] hover:text-black neo-border-2 font-bold flex items-center space-x-1.5 transition-colors"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-green-400 stroke-[3]" />
                          <span>COPIED!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>COPY</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Code block body */}
                  <pre className="p-5 overflow-x-auto font-mono text-sm leading-relaxed text-[#E2E8F0] selection:bg-[var(--color-primary)] selection:text-black">
                    <code>{block.codeBlock.code}</code>
                  </pre>
                </div>
              );
            }

            if (block.type === 'takeaways' && block.items) {
              return (
                <div key={index} className="my-10 p-6 bg-white neo-border neo-shadow">
                  <div className="flex items-center space-x-2 font-display font-black text-lg text-black uppercase mb-4 pb-2 border-b-2 border-black">
                    <Check className="w-5 h-5 text-[var(--color-success)] stroke-[3]" />
                    <span>Key Takeaways for Software Architects</span>
                  </div>
                  <ul className="space-y-3 font-sans text-base text-neutral-800">
                    {block.items.map((item, idx) => (
                      <li key={idx} className="flex items-start space-x-3">
                        <span className="font-mono font-bold text-xs bg-black text-[var(--color-primary)] px-1.5 py-0.5 border border-black shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span><RichText text={item} /></span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            }

            return null;
          })}
        </div>

        <div className="my-10 border-4 border-black bg-white p-5 neo-shadow">
          <div className="font-display font-black uppercase mb-3 flex items-center gap-2"><HeartPulse className="w-4 h-4"/> Reader reactions</div>
          <div className="flex flex-wrap gap-2">
            {ARTICLE_REACTIONS.map((r)=><button key={r} disabled={reactionBusy} onClick={async()=>{let u=user;if(!u){try{u=await loginWithGoogle();}catch{return}} if(!u)return;setReactionBusy(true);try{const previous=reaction;const next=reaction===r?null:r;await setArticleReaction(article.slug,u.uid,next);setReaction(next);setEngagement(prev=>{const counts={...prev.reactions};if(previous) counts[previous]=Math.max(0,(counts[previous]||0)-1);if(next) counts[next]=(counts[next]||0)+1;return {...prev,reactions:counts};});}catch(e){console.warn(e)}finally{setReactionBusy(false)}}} className={`border-2 border-black px-3 py-2 font-mono text-[10px] font-black uppercase ${reaction===r?'bg-[var(--color-primary)]':'bg-white'}`}>{r} <span className="ml-1 opacity-70">{engagement.reactions[r]||0}</span></button>)}
          </div>
        </div>

        {article.seriesId && seriesArticles.length > 0 && (() => {
          const idx = seriesArticles.findIndex(x => x.slug === article.slug);
          const next = idx >= 0 && idx < seriesArticles.length - 1 ? seriesArticles[idx + 1] : null;
          return <div className="my-12 border-4 border-black bg-[var(--color-primary)] p-5 neo-shadow-lg">
            <div className="font-mono text-[10px] font-black uppercase">{article.seriesName || 'SERIES'} · PART {Math.max(1,idx+1)} / {seriesArticles.length}</div>
            <div className="font-display font-black text-2xl uppercase mt-1">{next ? `Next: ${next.title}` : 'You reached the end.'}</div>
            <div className="flex flex-wrap gap-2 mt-4">
              {next && <button onClick={()=>onSelectArticle(next.slug)} className="border-2 border-black bg-black text-white px-4 py-3 font-mono text-[10px] font-black uppercase">NEXT PART →</button>}
              <button onClick={()=>onBack} className="border-2 border-black bg-white text-black px-4 py-3 font-mono text-[10px] font-black uppercase">VIEW ALL SERIES</button>
            </div>
          </div>;
        })()}

        <div className="mb-8 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="border-2 border-black bg-white p-3"><div className="font-mono text-[8px] uppercase text-neutral-500">APPLAUSE</div><div className="font-display font-black text-xl">{engagement.applauds}</div></div>
          <div className="border-2 border-black bg-white p-3"><div className="font-mono text-[8px] uppercase text-neutral-500">REACTIONS</div><div className="font-display font-black text-xl">{Object.values(engagement.reactions).reduce<number>((a,b)=>a+Number(b||0),0)}</div></div>
          <div className="border-2 border-black bg-white p-3"><div className="font-mono text-[8px] uppercase text-neutral-500">COMMENTS</div><div className="font-display font-black text-xl">{engagement.comments}</div></div>
          <div className="border-2 border-black bg-white p-3"><div className="font-mono text-[8px] uppercase text-neutral-500">READ TIME</div><div className="font-display font-black text-xl">{calculateArticleReadingTime(article)}m</div></div>
        </div>

        {/* Tags list */}
        <div className="mt-12 pt-6 border-t-2 border-black flex flex-wrap gap-2 items-center">
          <span className="font-mono text-xs font-bold text-neutral-500 uppercase mr-1">
            CATEGORIZED UNDER:
          </span>
          {article.tags.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 bg-white text-black neo-border-2 font-mono text-xs font-bold neo-shadow-sm"
            >
              #{tag}
            </span>
          ))}
        </div>

        {/* Bottom Medium-style Claps & Engagement Section */}
        <div className="my-12 p-6 bg-white neo-border neo-shadow-lg flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleClap}
              className={`p-3 neo-border font-display font-black text-sm uppercase flex items-center space-x-2 transition-all neo-shadow-sm active:translate-x-1 active:translate-y-1 active:shadow-none ${
                hasClapped ? 'bg-[var(--color-primary)] text-black' : 'bg-white hover:bg-neutral-100 text-black'
              }`}
            >
              <ThumbsUp className={`w-5 h-5 stroke-[2.5] ${hasClapped ? 'fill-black' : ''}`} />
              <span>APPLAUD ESSAY</span>
            </button>
            <div className="font-mono text-sm font-bold text-neutral-800">
              <span className="text-xl font-black text-black">{engagement.applauds}</span> applauds
            </div>
          </div>

          {/* Social Share Buttons */}
          <div className="flex items-center space-x-2">
            <span className="font-mono text-xs font-bold text-neutral-500 uppercase mr-1">
              SHARE:
            </span>
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(window.location.href)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 bg-white neo-border-2 hover:bg-[var(--color-secondary)] hover:text-black transition-colors"
              title="Share on X"
            >
              <Twitter className="w-4 h-4" />
            </a>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 bg-white neo-border-2 hover:bg-[#0077B5] hover:text-white transition-colors"
              title="Share on LinkedIn"
            >
              <Linkedin className="w-4 h-4" />
            </a>
            <button
              onClick={handleShareLink}
              className="p-2 bg-white neo-border-2 hover:bg-[var(--color-primary)] transition-colors"
              title="Copy URL"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Author Bio Box */}
        <div className="p-8 bg-gray-50 neo-border neo-shadow">
          <button type="button" onClick={() => { const authorHandle = article.author.username || siteConfig.authorProfileUsername; if (authorHandle && onOpenAuthorProfile) onOpenAuthorProfile(authorHandle); }} className="w-full flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-6 text-left">
            <img
              src={siteConfig?.authorAvatarUrl || article.author.avatar}
              alt={siteConfig?.authorName || article.author.name}
              className="w-20 h-20 neo-border object-cover shrink-0 bg-white"
            />
            <div className="space-y-2">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <h4 className="font-display font-black text-2xl text-black uppercase">
                  WRITTEN BY {siteConfig?.authorName || article.author.name}
                </h4>
                <span className="font-mono text-[10px] font-bold bg-[var(--color-primary)] text-black px-2 py-0.5 border-2 border-black uppercase">
                  {siteConfig?.authorRole || 'FOUNDER'}
                </span>
              </div>
              <p className="font-sans text-neutral-700 text-sm leading-relaxed">
                {siteConfig?.aboutMeBio || article.author.bio || "Dedicated to demystifying high-scale software engineering, cutting through hype, and sharing reproducible architectural blueprints."}
              </p>
            </div>
          </button>
        </div>

        {/* Comments Section */}
        <CommentsSection articleSlug={article.slug} />

        {/* Related Posts Section */}
        {relatedArticles.length > 0 && (
          <div className="pt-10 border-t-4 border-black mt-16 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-black text-2xl sm:text-3xl text-black uppercase tracking-tight">
                MORE FROM {siteConfig.logoPart1 || 'OFF'}{siteConfig.logoPart2 || 'SCRPT'}
              </h3>
              <button
                onClick={onBack}
                className="font-display font-black text-xs uppercase underline hover:text-[var(--color-secondary)]"
              >
                VIEW ALL DISPATCHES →
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedArticles.map((rel) => (
                <ArticleCard
                  key={rel.id}
                  article={rel}
                  onSelect={onSelectArticle}
                  variant="compact"
                  siteConfig={siteConfig}
                />
              ))}
            </div>
          </div>
        )}

      </article>
    </div>
  );
};
