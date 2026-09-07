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
  Sparkles,
  Layers,
  Terminal,
  List,
  HeartPulse
} from 'lucide-react';
import { ArticleCard } from './ArticleCard';
import { CommentsSection } from './CommentsSection';
import { auth, loginWithGoogle } from '../lib/firebase';
import { getArticleLikeStatus, toggleArticleLike, getPost, getCommunityProfile } from '../lib/community';
import { recordArticleView, ARTICLE_REACTIONS, getArticleReaction, setArticleReaction, getSeriesArticles } from '../lib/cms';
import type { ArticleReaction } from '../lib/cms';
import { useAuthState } from 'react-firebase-hooks/auth';

interface ArticleViewProps {
  article: Article;
  allArticles: Article[];
  onBack: () => void;
  onSelectArticle: (slug: string) => void;
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
  onOpenAuthorProfile,
  isSaved,
  onToggleSave,
  siteConfig,
}) => {
  const [copiedCodeIdx, setCopiedCodeIdx] = useState<number | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [claps, setClaps] = useState(article.clapsCount || 42);
  const [hasClapped, setHasClapped] = useState(false);
  const [fontSize, setFontSize] = useState<'normal' | 'large'>('normal');
  const [scrollProgress, setScrollProgress] = useState(0);
  const [user] = useAuthState(auth);
  const [reaction, setReaction] = useState<ArticleReaction|null>(null);
  const [reactionBusy, setReactionBusy] = useState(false);
  const [seriesArticles, setSeriesArticles] = useState<Article[]>([]);
  const [resolvedOriginalAuthor, setResolvedOriginalAuthor] = useState<any>(article.originalAuthor || article.author);

  useEffect(() => { void recordArticleView(article.slug, user?.uid); }, [article.slug, user?.uid]);

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

  // Track reading progress
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const currentProgress = (window.scrollY / totalHeight) * 100;
        setScrollProgress(Math.min(100, Math.max(0, currentProgress)));
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
      setClaps(prev => (newLiked ? prev + 1 : Math.max(0, prev - 1)));
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
  const toc = article.content.map((b,i)=>({b,i})).filter(x=>x.b.type==='heading2'||x.b.type==='heading3');

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
          {article.excerpt}
        </p>

        {/* Author Metadata Strip */}
        <div className="p-4 bg-white neo-border neo-shadow mb-10 flex flex-wrap items-center justify-between gap-4">
          <button type="button" onClick={() => { const authorHandle = resolvedOriginalAuthor?.username || article.author.username || siteConfig.authorProfileUsername; if (authorHandle && onOpenAuthorProfile) onOpenAuthorProfile(authorHandle); }} className="flex items-center space-x-3.5 text-left">
            <img
              src={resolvedOriginalAuthor?.avatar || article.author.avatar}
              alt={resolvedOriginalAuthor?.name || article.author.name}
              className="w-12 h-12 neo-border-2 object-cover"
            />
            <div>
              <div className="font-display font-black text-base text-black flex items-center space-x-1.5">
                <span className="inline-flex items-center gap-1">{resolvedOriginalAuthor?.name || article.author.name}<VerifiedBadge verified={resolvedOriginalAuthor?.isVerified ?? article.author.isVerified} color={resolvedOriginalAuthor?.verificationColor || article.author.verificationColor} className="w-4 h-4" /></span>
                <span className="text-[11px] font-mono font-bold bg-[var(--color-success)] text-black px-1.5 py-0.2 border-2 border-black">AUTHOR</span>
              </div>
              <div className="font-mono text-xs text-neutral-500">@{resolvedOriginalAuthor?.username || article.author.username || siteConfig.authorProfileUsername}</div>
            </div>
          </button>

          <div className="flex items-center space-x-4 text-xs font-mono font-bold text-neutral-700">
            <div className="flex items-center space-x-1.5">
              <Calendar className="w-4 h-4 text-black" />
              <span>{article.publishedAt}</span>
            </div>
            <span>•</span>
            <div className="flex items-center space-x-1.5">
              <Clock className="w-4 h-4 text-black" />
              <span>{article.readingTimeMinutes} MIN READ</span>
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

        {toc.length > 0 && (
          <nav className="mb-10 border-4 border-black bg-neutral-50 p-4 neo-shadow">
            <div className="font-display font-black uppercase mb-3">Table of contents</div>
            <div className="grid gap-1">
              {toc.map(({b,i})=><button key={i} onClick={()=>document.getElementById(`article-block-${i}`)?.scrollIntoView({behavior:'smooth',block:'start'})} className={`text-left font-mono text-xs py-1 ${b.type==='heading3'?'pl-5':'font-black'}`}>{b.content}</button>)}
            </div>
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
                  {block.content}
                </p>
              );
            }

            if (block.type === 'heading2') {
              return (
                <h2 
                  key={index} 
                  id={`article-block-${index}`}
                  className="font-display font-black text-2xl sm:text-3xl text-black tracking-tight mt-12 pt-6 border-t-2 border-black/20 uppercase"
                >
                  {block.content}
                </h2>
              );
            }

            if (block.type === 'heading3') {
              return (
                <h3 
                  key={index} 
                  id={`article-block-${index}`}
                  className="font-display font-black text-xl sm:text-2xl text-black mt-8"
                >
                  {block.content}
                </h3>
              );
            }

            if (block.type === 'quote') {
              return (
                <figure key={index} className="my-8 p-6 bg-gray-50 border-l-8 border-black neo-border neo-shadow-sm">
                  <blockquote className="font-serif italic text-xl sm:text-2xl text-black leading-snug">
                    "{block.content}"
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
                    {block.content}
                  </div>
                </div>
              );
            }

            if (block.type === 'image' && block.imageUrl) {
              return (
                <figure key={index} className="my-10 neo-border neo-shadow overflow-hidden bg-neutral-900">
                  <img src={block.imageUrl} alt={block.imageAlt || article.title} className="w-full h-auto max-h-[680px] object-cover" loading="lazy" />
                  {block.imageCaption && <figcaption className="p-3 bg-neutral-100 border-t-2 border-black font-mono text-xs text-neutral-700 italic">{block.imageCaption}</figcaption>}
                </figure>
              );
            }

            if (block.type === 'list' && block.items) {
              return (
                <ul key={index} className="my-8 list-disc pl-7 space-y-3 font-sans text-base text-neutral-800">
                  {block.items.filter(Boolean).map((item, idx) => <li key={idx}>{item}</li>)}
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
                        <span>{item}</span>
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
            {ARTICLE_REACTIONS.map((r)=><button key={r} disabled={reactionBusy} onClick={async()=>{let u=user;if(!u){try{u=await loginWithGoogle();}catch{return}} if(!u)return;setReactionBusy(true);try{const next=reaction===r?null:r;await setArticleReaction(article.slug,u.uid,next);setReaction(next);}catch(e){console.warn(e)}finally{setReactionBusy(false)}}} className={`border-2 border-black px-3 py-2 font-mono text-[10px] font-black uppercase ${reaction===r?'bg-[var(--color-primary)]':'bg-white'}`}>{r}</button>)}
          </div>
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
              <span className="text-xl font-black text-black">{claps}</span> claps
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
