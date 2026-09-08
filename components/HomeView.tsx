import React, { useState, useEffect } from 'react';
import { Article, PageView, Category, SiteConfig, CommunityPost } from '../types';
import { Hero } from './Hero';
import { ArticleCard } from './ArticleCard';
import { NewsletterSignup } from './NewsletterSignup';
import { getPosts, subscribeCarouselSlides } from '../lib/community';
import { 
  Sparkles, 
  ArrowRight, 
  Terminal, 
  Cpu, 
  Zap, 
  Flame, 
  BookOpen, 
  Layers, 
  ArrowUpRight,
  Code2,
  CheckCircle2,
  TrendingUp,
  MessageSquare,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { CATEGORIES } from '../data/articles';
import { CarouselSlide } from '../types';
import { SeriesStrip } from './SeriesStrip';
import { PersonalizedHomeSections } from './PersonalizedHomeSections';
import { subscribeSeriesList } from '../lib/series';

interface HomeViewProps {
  articles: Article[];
  onNavigate: (page: PageView, slug?: string) => void;
  onSelectArticle: (slug: string) => void;
  savedSlugs: string[];
  onToggleSave: (slug: string) => void;
  onSelectCategory: (cat: string) => void;
  siteConfig: SiteConfig;
  continueReadingArticle: Article | null;
  userAuth?: any;
}

const CarouselComponent: React.FC<{ slides: CarouselSlide[] }> = ({ slides }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          setCurrentIndex(current => (current + 1) % slides.length);
          return 0;
        }
        return prev + (100 / (5000 / 100));
      });
    }, 100);
    return () => clearInterval(interval);
  }, [slides.length, currentIndex]);

  useEffect(() => { if (currentIndex >= slides.length) setCurrentIndex(0); }, [slides.length, currentIndex]);
  if (!slides.length) return null;

  const currentSlide = slides[Math.min(currentIndex, slides.length - 1)];
  const showDots = slides.some(slide => slide.showDots !== false);
  const openLink = (url: string) => {
    const value = url.trim();
    if (!value) return;
    const external = /^(https?:|mailto:|tel:)/i.test(value);
    if (external) window.open(value, '_blank', 'noopener,noreferrer');
    else window.location.href = value;
  };
  const handleSurfaceClick = () => { if (currentSlide.linkUrl?.trim()) openLink(currentSlide.linkUrl); };

  return (
    <div className="w-full bg-black border-b-4 border-black p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div
          className={`relative w-full aspect-[21/9] sm:aspect-[3/1] neo-border overflow-hidden group ${currentSlide.linkUrl?.trim() ? 'cursor-pointer' : ''}`}
          style={{ backgroundColor: currentSlide.backgroundColor || '#111111' }}
          onClick={handleSurfaceClick}
          role={currentSlide.linkUrl?.trim() ? 'link' : undefined}
          tabIndex={currentSlide.linkUrl?.trim() ? 0 : undefined}
          onKeyDown={e => { if (currentSlide.linkUrl?.trim() && (e.key === 'Enter' || e.key === ' ')) handleSurfaceClick(); }}
        >
          {currentSlide.mode !== 'scratch' && currentSlide.imageUrl && (
            <img src={currentSlide.imageUrl} alt={currentSlide.title || 'Carousel slide'} className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: `${currentSlide.imagePositionX ?? 50}% ${currentSlide.imagePositionY ?? 50}%`, transform: `scale(${(currentSlide.imageZoom ?? 100) / 100})` }} />
          )}
          {currentSlide.mode !== 'scratch' && !currentSlide.imageUrl && <div className="absolute inset-0 grid place-items-center text-white font-mono text-xs uppercase">Carousel image unavailable</div>}
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10 pointer-events-none" />

          {currentSlide.title && !currentSlide.elements?.some(el => el.text === currentSlide.title) && (
            <div className="absolute left-6 bottom-10 sm:left-10 sm:bottom-12 max-w-2xl pointer-events-none">
              <h2 className="text-white font-display font-black text-2xl sm:text-4xl uppercase drop-shadow-[3px_3px_0_#000]">{currentSlide.title}</h2>
            </div>
          )}

          {currentSlide.elements?.map(el => {
            const style: React.CSSProperties = { left: `${el.x}%`, top: `${el.y}%`, color: el.color, fontSize: `${el.fontSize || 12}px` };
            if (el.type === 'button') return <button key={el.id} type="button" onClick={e => { e.stopPropagation(); if (el.href) openLink(el.href); }} className="absolute inline-block border-2 border-black px-3 py-1.5 font-mono font-black uppercase shadow-[3px_3px_0_0_#000]" style={{ ...style, backgroundColor: el.backgroundColor || '#FF00A8' }}>{el.text}</button>;
            if (el.type === 'badge') return <span key={el.id} className="absolute inline-block border-2 border-black px-2 py-1 font-mono font-black uppercase" style={{ ...style, backgroundColor: el.backgroundColor || '#FFFFFF' }}>{el.text}</span>;
            if (el.type === 'link') return <button key={el.id} type="button" onClick={e => { e.stopPropagation(); if (el.href) openLink(el.href); }} className="absolute font-mono font-black uppercase underline decoration-2 underline-offset-4 drop-shadow-[2px_2px_0_#000] text-left" style={style}>{el.text}</button>;
            return <span key={el.id} className="absolute max-w-[78%] font-display font-black uppercase leading-none drop-shadow-[3px_3px_0_#000]" style={style}>{el.text}</span>;
          })}

          {slides.length > 1 && <>
            <div className="absolute bottom-0 left-0 h-1.5 sm:h-2 bg-neutral-900/50 w-full pointer-events-none"><div className="h-full bg-[var(--color-primary)] transition-all duration-100 ease-linear" style={{ width: `${progress}%` }} /></div>
            <button aria-label="Previous slide" onClick={e => { e.stopPropagation(); setCurrentIndex(i => (i - 1 + slides.length) % slides.length); setProgress(0); }} className="absolute top-1/2 -translate-y-1/2 left-4 w-8 h-8 sm:w-10 sm:h-10 bg-white/10 hover:bg-white text-white hover:text-black neo-border backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-colors"><ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" /></button>
            <button aria-label="Next slide" onClick={e => { e.stopPropagation(); setCurrentIndex(i => (i + 1) % slides.length); setProgress(0); }} className="absolute top-1/2 -translate-y-1/2 right-4 w-8 h-8 sm:w-10 sm:h-10 bg-white/10 hover:bg-white text-white hover:text-black neo-border backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-colors"><ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" /></button>
          </>}
          {showDots && slides.length > 1 && <div className="absolute left-1/2 -translate-x-1/2 bottom-3 flex items-center gap-2 z-10">
            {slides.map((slide, index) => <button key={slide.id} type="button" aria-label={`Go to slide ${index + 1}`} onClick={e => { e.stopPropagation(); setCurrentIndex(index); setProgress(0); }} className={`w-2.5 h-2.5 sm:w-3 sm:h-3 border-2 border-black transition-all ${index === currentIndex ? 'bg-[var(--color-primary)] scale-125' : 'bg-white hover:bg-neutral-200'}`} />)}
          </div>}
        </div>
      </div>
    </div>
  );
};

export const HomeView: React.FC<HomeViewProps> = ({
  articles,
  onNavigate,
  onSelectArticle,
  savedSlugs,
  onToggleSave,
  onSelectCategory,
  siteConfig,
  continueReadingArticle,
  userAuth,
}) => {
  const [featuredCommunityPosts, setFeaturedCommunityPosts] = useState<CommunityPost[]>([]);
  const [carouselSlides, setCarouselSlides] = useState<CarouselSlide[]>([]);
  const [series, setSeries] = useState<import('../types').Series[]>([]);
  useEffect(() => subscribeSeriesList(setSeries), []);

  useEffect(() => {
    const fetchCommunityPosts = async () => {
      // Get discussions and blogs
      const d = await getPosts('discussion');
      const b = await getPosts('blog');
      const all = [...d, ...b];
      const featured = all.filter(p => p.isFeatured).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setFeaturedCommunityPosts(featured.slice(0, 3));
    };
    fetchCommunityPosts();

    const unsubCarousel = subscribeCarouselSlides((slides) => {
      setCarouselSlides(slides);
    });

    return () => {
      unsubCarousel();
    };
  }, []);

  const featuredArticle = articles.find((a) => a.pinned) || articles.find((a) => a.featured) || articles[0];
  const latestArticles = articles.filter((a) => a.id !== featuredArticle?.id).slice(0, 5);

  const topicSpotlights: { title: Category; desc: string; color: string; count: number }[] = [
    { 
      title: 'Web Development', 
      desc: 'Modern frontend runtimes, Vite, Rust compilation, and high-performance DOM architecture.',
      color: 'bg-[#FFE600]',
      count: articles.filter(a => a.category === 'Web Development').length
    },
    { 
      title: 'Artificial Intelligence', 
      desc: 'Local-first SLMs, deterministic grammar sampling, and autonomous agent systems.',
      color: 'bg-[#FF66C4]',
      count: articles.filter(a => a.category === 'Artificial Intelligence').length
    },
    { 
      title: 'Computer Science', 
      desc: 'Storage engine mechanics, B-Trees vs LSM-Trees, and low-level memory layouts.',
      color: 'bg-[#38B6FF]',
      count: articles.filter(a => a.category === 'Computer Science').length
    },
    { 
      title: 'System Design', 
      desc: 'Transactional outbox patterns, distributed idempotency, and resilient message brokers.',
      color: 'bg-[#B266FF]',
      count: articles.filter(a => a.category === 'System Design').length
    },
    { 
      title: 'Developer Tools', 
      desc: 'Terminal mastery, CLI tooling, Neovim/tmux workflows, and developer ergonomics.',
      color: 'bg-[#FF7A00]',
      count: articles.filter(a => a.category === 'Developer Tools').length
    },
    { 
      title: 'Software Engineering', 
      desc: 'Advanced TypeScript type systems, zero-cost abstractions, and clean code hygiene.',
      color: 'bg-[#00E599]',
      count: articles.filter(a => a.category === 'Software Engineering').length
    },
  ];

  return (
    <div className="w-full bg-white pb-20">
      {/* 1. Hero Section */}
      <Hero onNavigate={onNavigate} postsCount={articles.length} siteConfig={siteConfig} />

      {/* 1.5 Carousel Section */}
      {carouselSlides.length > 0 && <CarouselComponent slides={carouselSlides} />}

      {/* Signed-in reader resume point */}
      {continueReadingArticle && (
        <section className="border-b-4 border-black bg-[var(--color-primary)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-mono text-[11px] font-black uppercase tracking-widest text-black mb-1">
                <BookOpen className="w-4 h-4" />
                Continue Reading
              </div>
              <p className="font-display font-black text-lg sm:text-2xl uppercase tracking-tight text-black truncate">
                {continueReadingArticle.title}
              </p>
            </div>
            <button
              onClick={() => onSelectArticle(continueReadingArticle.slug)}
              className="shrink-0 px-5 py-3 bg-black text-white border-2 border-black neo-shadow-sm hover:bg-white hover:text-black font-display font-black text-xs uppercase flex items-center gap-2 transition-colors"
            >
              Resume Post <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      )}

      <PersonalizedHomeSections articles={articles} series={series} userAuth={userAuth} onNavigate={onNavigate} />

      {/* 2. High Density Main Split: 2/3 Featured Column & 1/3 Dispatch Updates / Newsletter */}
      {featuredArticle && (
        <section className="border-b-4 border-black bg-white">
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row">
            
            {/* Left 2/3: Featured Essay from High Density spec */}
            <div className="w-full lg:w-2/3 lg:border-r-4 border-black p-6 sm:p-10 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 sm:gap-4 mb-4 flex-wrap">
                  <span className="bg-[var(--color-primary)] neo-border px-3 py-1 text-xs font-black uppercase text-black flex items-center space-x-1">
                    <Sparkles className="w-3.5 h-3.5 fill-black text-black" />
                    <span>{featuredArticle.pinned ? 'PINNED ESSAY' : 'FEATURED ESSAY'}</span>
                  </span>
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-600">
                    {featuredArticle.category} • {featuredArticle.readingTimeMinutes} Min Read
                  </span>
                </div>

                <h2 
                  onClick={() => onSelectArticle(featuredArticle.slug)}
                  className="text-3xl sm:text-5xl font-black leading-tight mb-4 tracking-tight text-black hover:text-[var(--color-secondary)] cursor-pointer transition-colors"
                >
                  {featuredArticle.title}
                </h2>

                <p className="text-lg sm:text-xl font-serif text-neutral-800 leading-relaxed mb-6">
                  {featuredArticle.excerpt}
                </p>

                {/* Featured Cover Preview */}
                <div 
                  onClick={() => onSelectArticle(featuredArticle.slug)}
                  className="w-full aspect-[21/9] neo-border overflow-hidden mb-6 cursor-pointer group bg-neutral-900"
                >
                  <img
                    src={featuredArticle.coverImage}
                    alt={featuredArticle.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-8">
                  {featuredArticle.tags.map((tag) => (
                    <span 
                      key={tag}
                      className="bg-gray-100 neo-border-2 px-2.5 py-1 text-xs font-mono font-bold text-black"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* High Density Author & Action Bar */}
              <div className="bg-black p-4 neo-shadow flex items-center justify-between text-white neo-border mt-auto">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white text-black neo-border flex items-center justify-center font-display font-black text-base overflow-hidden">
                    <img 
                      src={featuredArticle.author.avatar} 
                      alt={featuredArticle.author.name} 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                  <div>
                    <div className="text-white font-bold text-sm">
                      {featuredArticle.author.name}
                    </div>
                    <div className="text-neutral-400 text-xs font-mono">
                      {featuredArticle.author.role}
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => onSelectArticle(featuredArticle.slug)}
                  className="bg-[var(--color-secondary)] neo-border px-4 py-2 font-black uppercase text-xs text-black hover:bg-[var(--color-primary)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
                >
                  Continue Reading
                </button>
              </div>
            </div>

            {/* Right 1/3: High Density Sidebar (Latest Updates & Newsletter) */}
            <div className="w-full lg:w-1/3 p-6 sm:p-8 flex flex-col gap-6 bg-gray-50 border-t-4 lg:border-t-0 border-black">
              
              {/* Card 1: Latest Updates */}
              <div className="neo-border bg-white p-5 neo-shadow-sm">
                <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-4">
                  <h3 className="font-black uppercase text-sm text-black">
                    Latest Updates
                  </h3>
                  <button
                    onClick={() => onNavigate('blog')}
                    className="text-xs font-mono font-bold uppercase underline hover:text-[var(--color-secondary)]"
                  >
                    View All
                  </button>
                </div>

                <div className="space-y-4">
                  {latestArticles.slice(0, 3).map((art) => (
                    <div key={art.id} className="border-b border-neutral-200 pb-3 last:border-0 last:pb-0">
                      <span className="text-[10px] font-mono font-bold uppercase bg-[var(--color-accent)] text-black px-1.5 py-0.5 neo-border-2 inline-block mb-1">
                        {art.category}
                      </span>
                      <h4 
                        onClick={() => onSelectArticle(art.slug)}
                        className="font-bold text-sm text-black hover:underline cursor-pointer leading-snug"
                      >
                        {art.title}
                      </h4>
                      <div className="text-[11px] font-mono text-neutral-500 mt-1">
                        {art.publishedAt} • {art.readingTimeMinutes} min
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card 2: Subscribe to the Dispatch */}
              <NewsletterSignup variant="sidebar" />

              {/* Card 3: Sticker / Publication Status */}
              <div className="neo-border bg-white p-4 neo-shadow-sm flex items-center justify-between">
                <div>
                  <div className="text-xs font-mono font-black uppercase text-black">
                    SYSTEM RUNTIME
                  </div>
                  <div className="text-[11px] text-neutral-600 font-mono">
                    High Density Neo-Brutalist
                  </div>
                </div>
                <span className="inline-flex items-center px-2 py-1 bg-[var(--color-success)] text-black font-mono text-[10px] font-black uppercase neo-border-2">
                  100% ONLINE
                </span>
              </div>

            </div>

          </div>
        </section>
      )}

      {/* 3. Latest Articles Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-18 border-b-4 border-black">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Flame className="w-4 h-4 text-black" />
              <span className="font-mono text-xs font-bold text-neutral-500 uppercase tracking-widest">
                FRESH ANALYSIS
              </span>
            </div>
            <h2 className="font-display font-black text-3xl sm:text-4xl md:text-5xl text-black uppercase tracking-tight">
              MORE ARTICLES
            </h2>
          </div>

          <button
            onClick={() => onNavigate('blog')}
            className="px-5 py-2.5 bg-[var(--color-primary)] text-black font-display font-black text-xs uppercase neo-border neo-shadow-sm hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-1 active:translate-y-1 active:shadow-none flex items-center space-x-2 self-start sm:self-auto transition-all"
          >
            <span>BROWSE ARCHIVE</span>
            <ArrowRight className="w-4 h-4 stroke-[3]" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {latestArticles.map((art) => (
            <ArticleCard
              key={art.id}
              article={art}
              onSelect={onSelectArticle}
              isSaved={savedSlugs.includes(art.slug)}
              onToggleSave={onToggleSave}
              variant="standard"
              siteConfig={siteConfig}
            />
          ))}
        </div>
      </section>

      <SeriesStrip articles={articles} onNavigate={onNavigate} />

      {/* Featured Community Posts */}
      {featuredCommunityPosts.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-18 border-b-4 border-black">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-6 h-6 text-[var(--color-primary)] stroke-[2.5]" />
                <h2 className="font-display font-black text-2xl sm:text-3xl uppercase tracking-tighter">
                  Community Highlights
                </h2>
              </div>
              <p className="font-mono text-xs sm:text-sm text-neutral-600 font-bold uppercase">
                Featured discussions and blogs from the community
              </p>
            </div>
            <button 
              onClick={() => onNavigate('community')}
              className="flex-shrink-0 flex items-center space-x-1.5 px-4 py-2 border-2 border-black font-display font-black text-xs uppercase hover:bg-black hover:text-white transition-colors"
            >
              <span>View Community</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredCommunityPosts.map(post => (
              <div 
                key={post.id}
                onClick={() => onNavigate('community_post', post.id)}
                className="bg-white border-4 border-black p-5 cursor-pointer neo-shadow-sm hover:-translate-y-1 hover:neo-shadow transition-all group flex flex-col h-full"
              >
                <div className="inline-block self-start px-2 py-0.5 bg-[var(--color-secondary)] border-2 border-black font-mono text-[10px] font-black uppercase mb-3">
                  {post.type}
                </div>
                <h3 className="font-display font-black text-xl group-hover:text-[var(--color-primary)] transition-colors line-clamp-3 mb-4">
                  {post.title}
                </h3>
                <div className="mt-auto pt-4 border-t-2 border-black flex justify-between items-center font-mono text-xs font-bold uppercase">
                  <span className="truncate max-w-[120px]">@{post.authorUsername}</span>
                  <div className="flex items-center space-x-2">
                    <span className="flex items-center space-x-1"><Sparkles className="w-3 h-3"/> <span>{post.clapsCount}</span></span>
                    <span className="flex items-center space-x-1"><MessageSquare className="w-3 h-3"/> <span>{post.commentsCount}</span></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. Topics / Category Explorer */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-18 border-b-4 border-black">
        <div className="space-y-1 mb-8">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-black" />
            <span className="font-mono text-xs font-bold text-neutral-500 uppercase tracking-widest">
              CURATED DOMAINS
            </span>
          </div>
          <h2 className="font-display font-black text-3xl sm:text-4xl md:text-5xl text-black uppercase tracking-tight">
            EXPLORE BY TOPIC
          </h2>
          <p className="font-sans text-base text-neutral-700 max-w-xl">
            Select a specialized technical vertical to read tailored architectural essays and practical tutorials.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {topicSpotlights.map((topic) => (
            <div
              key={topic.title}
              onClick={() => {
                onSelectCategory(topic.title);
                onNavigate('blog');
              }}
              className="group bg-white neo-border neo-shadow hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[10px_10px_0px_0px_#000] p-6 transition-all cursor-pointer flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className={`px-2.5 py-1 ${topic.color} neo-border-2 font-display font-black text-xs uppercase text-black`}>
                    {topic.count} {topic.count === 1 ? 'POST' : 'POSTS'}
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-black stroke-[2.5] opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>

                <h3 className="font-display font-black text-2xl text-black uppercase tracking-tight group-hover:text-[var(--color-secondary)] transition-colors">
                  {topic.title}
                </h3>

                <p className="font-sans text-sm text-neutral-700 leading-relaxed">
                  {topic.desc}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t-2 border-neutral-200 font-display font-black text-xs uppercase text-black flex items-center space-x-1">
                <span>VIEW TOPIC DISPATCHES</span>
                <span>&rarr;</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. About / Creator Spotlight Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-18 border-b-4 border-black">
        <div className="bg-[var(--color-primary)] neo-border neo-shadow-lg p-8 sm:p-12 lg:p-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            
            <div className="lg:col-span-8 space-y-5">
              <div className="inline-block px-3 py-1 bg-black text-white font-mono text-xs font-bold uppercase">
                THE MANIFESTO &amp; PHILOSOPHY
              </div>

              <h2 className="font-display font-black text-3xl sm:text-5xl text-black uppercase tracking-tight leading-tight">
                WHY I CREATED {siteConfig.logoPart1}{siteConfig.logoPart2}
              </h2>

              <p className="font-serif text-lg sm:text-xl text-neutral-900 leading-relaxed font-normal">
                "{siteConfig.manifestoText}"
              </p>

              <div className="flex flex-wrap gap-4 pt-2">
                <button
                  onClick={() => onNavigate('about')}
                  className="px-6 py-3 bg-black text-white font-display font-black text-sm uppercase neo-border neo-shadow-sm hover:bg-white hover:text-black active:translate-x-1 active:translate-y-1 active:shadow-none flex items-center space-x-2 transition-all"
                >
                  <span>READ ABOUT {siteConfig.authorName.toUpperCase()}</span>
                  <ArrowRight className="w-4 h-4 stroke-[3]" />
                </button>

                <button
                  onClick={() => onNavigate('contact')}
                  className="px-6 py-3 bg-white text-black font-display font-black text-sm uppercase neo-border neo-shadow-sm hover:bg-[var(--color-accent)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
                >
                  <span>GET IN TOUCH</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-4 flex justify-center lg:justify-end">
              <div className="relative">
                <img
                  src={siteConfig.authorAvatarUrl}
                  alt={siteConfig.authorName}
                  className="w-52 sm:w-60 aspect-square object-cover neo-border neo-shadow"
                />
                <div className="absolute -bottom-3 -left-3 bg-[var(--color-accent)] text-black font-mono text-xs font-bold px-3 py-1 neo-border-2 rotate-[-3deg]">
                  {siteConfig.authorName} // {siteConfig.authorRole.split(' ')[0]}
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 6. Final Call to Action */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-18">
        <div className="bg-white neo-border neo-shadow-lg p-8 sm:p-12 text-center space-y-6">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-[var(--color-success)] text-black font-mono text-xs font-bold uppercase neo-border-2 neo-shadow-sm">
            <Sparkles className="w-3.5 h-3.5 fill-black" />
            <span>START READING TODAY</span>
          </div>

          <h2 className="font-display font-black text-4xl sm:text-6xl text-black uppercase tracking-tighter max-w-2xl mx-auto leading-none">
            CONTINUE YOUR TECHNICAL JOURNEY
          </h2>

          <p className="font-sans text-base sm:text-lg text-neutral-700 max-w-xl mx-auto">
            Explore all deep-dive dispatches, save articles for offline reading, or connect with Krish.
          </p>

          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <button
              onClick={() => onNavigate('blog')}
              className="px-8 py-4 bg-[var(--color-primary)] text-black font-display font-black text-base uppercase neo-border neo-shadow active:translate-x-1 active:translate-y-1 active:shadow-none flex items-center space-x-2 transition-all hover:bg-[var(--color-secondary)]"
            >
              <span>EXPLORE ALL ESSAYS</span>
              <ArrowRight className="w-5 h-5 stroke-[3]" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
