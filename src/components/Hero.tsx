import React, { useState } from 'react';
import { 
  ArrowRight, 
  Terminal, 
  Sparkles, 
  Code2, 
  Cpu, 
  CheckCircle2, 
  Flame, 
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { PageView, SiteConfig } from '../types';

interface HeroProps {
  onNavigate: (page: PageView) => void;
  postsCount: number;
  siteConfig: SiteConfig;
}

export const Hero: React.FC<HeroProps> = ({ onNavigate, postsCount, siteConfig }) => {
  const [showTerminal, setShowTerminal] = useState(false);
  const [activeTab, setActiveTab] = useState<'stack' | 'status' | 'manifesto'>('stack');

  return (
    <section 
      className="relative w-full border-b-4 border-black overflow-hidden transition-colors duration-500"
      style={{ backgroundColor: siteConfig.heroBgColor }}
    >
      {/* Decorative dashed yellow pulse circle from High Density specs */}
      <div className="absolute -bottom-8 -right-8 w-56 h-56 bg-[var(--color-primary)] rounded-full neo-border border-dashed animate-pulse opacity-60 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 lg:py-14 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left / Main Column: High Density Bold Headline */}
          <div className="lg:col-span-7 space-y-5">
            {/* Badges / Stickers Row */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-[var(--color-primary)] text-black font-display font-black text-xs uppercase neo-border-2 neo-shadow-sm">
                <Sparkles className="w-3.5 h-3.5 fill-black" />
                <span>TECH + CODE + IDEAS</span>
              </span>

              <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-[var(--color-accent)] text-black font-display font-black text-xs uppercase neo-border-2 neo-shadow-sm">
                <Flame className="w-3.5 h-3.5 fill-black" />
                <span>BUILDING ON THE INTERNET</span>
              </span>
            </div>

            {/* Giant High Density Headline */}
            <h1 className="text-4xl xs:text-5xl sm:text-7xl lg:text-[88px] xl:text-[96px] leading-[0.9] sm:leading-[0.85] font-black tracking-tighter uppercase text-black whitespace-pre-wrap break-words">
              {siteConfig.heroHeadline}
            </h1>

            {/* Supporting Text */}
            <p className="max-w-xl font-bold text-base sm:text-lg text-black leading-snug">
              {siteConfig.heroSubheadline}
            </p>

            {/* CTAs matching High Density spec */}
            <div className="pt-2 flex flex-wrap gap-3 items-center">
              <button
                id="hero-read-blog-btn"
                onClick={() => onNavigate('blog')}
                className="bg-black text-white px-6 py-3 font-bold uppercase text-xs sm:text-sm neo-shadow-sm transition-transform active:translate-x-1 active:translate-y-1 active:shadow-none hover:bg-[var(--color-primary)] hover:text-black border-2 border-black flex items-center space-x-2"
              >
                <span>READ THE BLOG</span>
                <ArrowRight className="w-4 h-4 stroke-[3]" />
              </button>

              <button
                id="hero-about-me-btn"
                onClick={() => onNavigate('about')}
                className="bg-white text-black px-6 py-3 font-bold uppercase text-xs sm:text-sm neo-shadow-sm transition-transform active:translate-x-1 active:translate-y-1 active:shadow-none hover:bg-[var(--color-accent)] border-2 border-black flex items-center space-x-2"
              >
                <span>ABOUT AUTHOR</span>
                <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
              </button>

              <button
                onClick={() => setShowTerminal(!showTerminal)}
                className="bg-[var(--color-success)] text-black px-4 py-3 font-mono font-bold text-xs uppercase neo-shadow-sm border-2 border-black hover:bg-white transition-all flex items-center space-x-1.5"
                title="Toggle Live Tech Specs"
              >
                <Terminal className="w-4 h-4 stroke-[2.5]" />
                <span>{showTerminal ? 'HIDE SPECS' : 'SYS SPECS'}</span>
              </button>
            </div>
          </div>

          {/* Right Column: High Density Floating Stat Cards & Interactive Specs */}
          <div className="lg:col-span-5 flex flex-col items-center lg:items-end justify-center">
            
            {/* Stat Cards from Design Spec */}
            <div className="flex flex-wrap sm:flex-nowrap gap-4 sm:gap-6 justify-center lg:justify-end items-center">
              {/* Pink Card */}
              <div 
                onClick={() => onNavigate('blog')}
                className="bg-[var(--color-accent)] neo-border p-6 sm:p-7 neo-shadow rotate-3 hover:rotate-0 transition-transform cursor-pointer flex flex-col items-center min-w-[130px] sm:min-w-[150px]"
              >
                <span className="text-4xl sm:text-5xl font-black text-black leading-none">
                  {postsCount > 0 ? postsCount : 142}
                </span>
                <span className="uppercase font-bold text-xs text-black mt-2 tracking-wider">
                  Articles
                </span>
              </div>

              {/* Green Card */}
              <div className="bg-[var(--color-success)] neo-border p-6 sm:p-7 neo-shadow -rotate-6 hover:rotate-0 transition-transform flex flex-col items-center min-w-[130px] sm:min-w-[150px]">
                <span className="text-4xl sm:text-5xl font-black text-black leading-none">
                  24k
                </span>
                <span className="uppercase font-bold text-xs text-black mt-2 tracking-wider">
                  Readers
                </span>
              </div>
            </div>

            {/* Quick Micro Pillars */}
            <div className="mt-6 flex flex-wrap gap-2 justify-center lg:justify-end">
              <span className="bg-white text-black font-mono font-bold text-xs px-2.5 py-1 neo-border-2 neo-shadow-sm">
                ZERO FLUFF
              </span>
              <span className="bg-[var(--color-primary)] text-black font-mono font-bold text-xs px-2.5 py-1 neo-border-2 neo-shadow-sm">
                PRODUCTION CODE
              </span>
              <span className="bg-black text-[var(--color-success)] font-mono font-bold text-xs px-2.5 py-1 neo-border-2 neo-shadow-sm">
                LOCAL-FIRST AI
              </span>
            </div>

          </div>
        </div>

        {/* Expandable Architecture Specs & Terminal */}
        {showTerminal && (
          <div className="mt-8 bg-black text-white neo-border neo-shadow overflow-hidden">
            {/* Terminal Header */}
            <div className="bg-neutral-900 px-4 py-2.5 border-b-2 border-neutral-700 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-black" />
                <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-black" />
                <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-black" />
                <span className="ml-2 font-mono text-xs text-neutral-400">
                  krishficient-core.sh
                </span>
              </div>
              <div className="font-mono text-xs text-[var(--color-primary)] font-bold">
                HIGH DENSITY RUNTIME
              </div>
            </div>

            {/* Tabs */}
            <div className="grid grid-cols-3 border-b-2 border-neutral-800 font-mono text-xs font-bold text-center">
              <button
                onClick={() => setActiveTab('stack')}
                className={`py-2 transition-colors ${
                  activeTab === 'stack' ? 'bg-[var(--color-primary)] text-black' : 'bg-black text-neutral-400 hover:text-white'
                }`}
              >
                STACK
              </button>
              <button
                onClick={() => setActiveTab('status')}
                className={`py-2 border-x border-neutral-800 transition-colors ${
                  activeTab === 'status' ? 'bg-[var(--color-primary)] text-black' : 'bg-black text-neutral-400 hover:text-white'
                }`}
              >
                SYSTEM SPECS
              </button>
              <button
                onClick={() => setActiveTab('manifesto')}
                className={`py-2 transition-colors ${
                  activeTab === 'manifesto' ? 'bg-[var(--color-primary)] text-black' : 'bg-black text-neutral-400 hover:text-white'
                }`}
              >
                PHILOSOPHY
              </button>
            </div>

            <div className="p-5 font-mono text-xs sm:text-sm space-y-3">
              {activeTab === 'stack' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-neutral-300">
                  <div className="bg-neutral-900 p-3 border border-neutral-800">
                    <span className="text-[var(--color-secondary)] font-bold">Languages:</span> TypeScript, Rust, Python
                  </div>
                  <div className="bg-neutral-900 p-3 border border-neutral-800">
                    <span className="text-[var(--color-secondary)] font-bold">Frontend:</span> React, Vite, Tailwind v4
                  </div>
                  <div className="bg-neutral-900 p-3 border border-neutral-800">
                    <span className="text-[var(--color-secondary)] font-bold">AI Systems:</span> Local SLMs, PyTorch, Gemini
                  </div>
                  <div className="bg-neutral-900 p-3 border border-neutral-800">
                    <span className="text-[var(--color-secondary)] font-bold">Cloud Architecture:</span> Firestore Cloud CMS &amp; Edge Sync
                  </div>
                </div>
              )}

              {activeTab === 'status' && (
                <div className="bg-neutral-900 p-3 border border-neutral-800 space-y-1.5 text-neutral-300">
                  <div className="flex items-center space-x-2 text-[var(--color-success)]">
                    <span className="w-2 h-2 rounded-full bg-[var(--color-success)] animate-ping" />
                    <span className="font-bold">STATUS: PRODUCTION ONLINE (EDGE LATENCY &lt; 20ms)</span>
                  </div>
                  <div>Theme: High Density Neo-Brutalism (var(--color-primary), var(--color-accent), var(--color-secondary), var(--color-success))</div>
                  <div>Security: 100% Tracking-free, Client & Edge Verified</div>
                </div>
              )}

              {activeTab === 'manifesto' && (
                <div className="bg-neutral-900 p-3 border border-neutral-800 text-neutral-300">
                  <p className="font-serif text-base italic leading-relaxed text-[var(--color-primary)]">
                    "{siteConfig.manifestoText || `${siteConfig.logoPart1}${siteConfig.logoPart2} exists to write the deep technical essays I wish I had found when architecting complex, scale-resistant systems.`}"
                  </p>
                  <div className="text-neutral-500 text-xs font-mono mt-2">{siteConfig.manifestoAuthor || "— Founder"}</div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </section>
  );
};

