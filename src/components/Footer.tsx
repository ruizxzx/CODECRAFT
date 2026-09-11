import React, { useMemo } from 'react';
import { Article, FooterLink, PageView, SiteConfig } from '../types';
import { NewsletterSignup } from './NewsletterSignup';
import { ArrowUpRight, Rss, Sparkles } from 'lucide-react';

interface FooterProps {
  onNavigate: (page: PageView, param?: string) => void;
  onOpenCms?: () => void;
  onOpenRssModal: () => void;
  siteConfig: SiteConfig;
  articles: Article[];
}

const DEFAULT_NAV: FooterLink[] = [
  { id: 'fallback-home', label: 'Home', type: 'internal', target: 'home', visible: true },
  { id: 'fallback-blog', label: 'SCRPTS', type: 'internal', target: 'blog', visible: true },
  { id: 'fallback-explore', label: 'Explore', type: 'internal', target: 'explore', visible: true },
  { id: 'fallback-series', label: 'Series', type: 'internal', target: 'series', visible: true },
  { id: 'fallback-about', label: 'About Krish', type: 'internal', target: 'about', visible: true },
  { id: 'fallback-contact', label: 'Contact Desk', type: 'internal', target: 'contact', visible: true },
  { id: 'fallback-changelog', label: 'Changelog', type: 'internal', target: 'changelog', visible: true },
];

const DEFAULT_HUB: FooterLink[] = [
  { id: 'fallback-rss', label: 'RSS / XML Feed', type: 'rss', target: 'rss', visible: true },
];

const normalizeExternal = (value: string) => {
  const v = value.trim();
  if (!v) return '';
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
};

const iconForType = (type: FooterLink['type']) => type === 'rss' ? <Rss className="w-3 h-3" /> : type === 'external' ? <ArrowUpRight className="w-3 h-3" /> : null;

export const Footer: React.FC<FooterProps> = ({ onNavigate, onOpenCms, onOpenRssModal, siteConfig, articles }) => {
  const brandName = `${siteConfig.logoPart1 || ''}${siteConfig.logoPart2 || ''}`.trim() || 'OFFSCRPT';
  const navLinks = (siteConfig.footerNavigationLinks?.length ? siteConfig.footerNavigationLinks : DEFAULT_NAV).filter(x => x.visible !== false);
  const hubLinks = (siteConfig.footerHubLinks?.length ? siteConfig.footerHubLinks : DEFAULT_HUB).filter(x => x.visible !== false);

  const topics = useMemo(() => {
    const configured = (siteConfig.footerTopicCategories || []).map(x => x.trim()).filter(Boolean);
    if (configured.length) return Array.from(new Set(configured)).slice(0, 8);
    const counts = new Map<string, number>();
    articles
      .filter(a => a.isPublished !== false && a.mainPublicationStatus !== 'unpublished')
      .forEach(a => (a.tags || []).forEach(tag => {
        const clean = tag.trim();
        if (clean) counts.set(clean, (counts.get(clean) || 0) + 1);
      }));
    return Array.from(counts.entries()).sort((a,b) => b[1]-a[1]).map(([tag]) => tag).slice(0, 5);
  }, [siteConfig.footerTopicCategories, articles]);

  const renderLink = (link: FooterLink) => {
    if (link.type === 'internal') {
      return (
        <button
          key={link.id}
          type="button"
          onClick={() => onNavigate(link.target as PageView)}
          className="text-left hover:text-[var(--color-primary)] transition-colors"
        >
          {link.label}
        </button>
      );
    }
    if (link.type === 'topic') {
      return (
        <button
          key={link.id}
          type="button"
          onClick={() => onNavigate('topic', link.target)}
          className="text-left hover:text-[var(--color-secondary)] transition-colors"
        >
          {link.label}
        </button>
      );
    }
    if (link.type === 'rss') {
      return (
        <button
          key={link.id}
          type="button"
          onClick={onOpenRssModal}
          className="flex items-center gap-1.5 text-neutral-300 hover:text-[var(--color-primary)] transition-colors"
        >
          {iconForType(link.type)}<span>{link.label}</span>
        </button>
      );
    }
    const href = normalizeExternal(link.target);
    if (!href) return null;
    return (
      <a
        key={link.id}
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="flex items-center gap-1.5 text-neutral-300 hover:text-[var(--color-secondary)] transition-colors"
      >
        <span>{link.label}</span>{iconForType(link.type)}
      </a>
    );
  };

  return (
    <footer className="w-full bg-[#0A0A0A] text-white border-t-4 border-black selection:bg-[var(--color-primary)] selection:text-black">
      <div className="border-b-4 border-black bg-[#141414] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-2">
              <div className="inline-flex items-center space-x-2 bg-[var(--color-primary)] text-black px-2.5 py-1 font-mono text-xs font-black uppercase neo-border-2 mb-1">
                <Sparkles className="w-3.5 h-3.5 fill-black" />
                <span>{brandName} DISPATCHES</span>
              </div>
              <h3 className="font-display font-black text-3xl sm:text-4xl uppercase tracking-tight text-white">
                {siteConfig.footerNewsletterTitle || 'RECEIVE DEEP TECHNICAL ESSAYS IN YOUR INBOX'}
              </h3>
              <p className="font-sans text-neutral-400 text-sm max-w-xl">
                {siteConfig.footerNewsletterSubtitle || 'Zero spam. Zero generic marketing. Only in-depth software architectural breakdowns, local AI research, and production post-mortems.'}
              </p>
            </div>
            <div className="lg:col-span-5"><NewsletterSignup variant="footer" /></div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-white flex items-center justify-center neo-border-2 overflow-hidden">
                {siteConfig.logoImageUrl ? <img src={siteConfig.logoImageUrl} alt={brandName} className="w-full h-full object-contain" /> : <span className="font-display font-black text-xl text-black">{(siteConfig.logoPart1 || 'OFF').charAt(0)}</span>}
              </div>
              <span className="font-display font-black text-3xl tracking-tighter text-white uppercase">
                {siteConfig.logoPart1 || 'OFF'}<span className="text-[var(--color-accent)]">{siteConfig.logoPart2 || 'SCRPT'}</span>
              </span>
            </div>
            <p className="font-sans text-neutral-400 text-sm leading-relaxed max-w-sm">
              {siteConfig.footerBrandStatement || 'An independent technology publication engineered by Krish.'}
            </p>
            <div className="pt-2 flex flex-wrap gap-2 font-mono text-xs font-bold text-neutral-400">
              <span className="px-2 py-1 bg-neutral-900 border border-neutral-700">FIRESTORE CLOUD CMS</span>
              <span className="px-2 py-1 bg-neutral-900 border border-neutral-700">HIGH DENSITY DESIGN</span>
              <span className="px-2 py-1 bg-neutral-900 border border-neutral-700">NO FLUFF</span>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-3 font-display">
            <div className="font-mono text-xs font-bold text-[var(--color-primary)] uppercase tracking-wider">{siteConfig.footerNavigationTitle || 'NAVIGATION'}</div>
            <ul className="space-y-2 text-sm font-bold uppercase">{navLinks.map(renderLink)}{!navLinks.some(x => x.type === 'internal' && x.target === 'changelog') && renderLink({id:'footer-nav-changelog',label:'Changelog',type:'internal',target:'changelog',visible:true})}</ul>
          </div>

          <div className="lg:col-span-3 space-y-3">
            <div className="font-mono text-xs font-bold text-[var(--color-secondary)] uppercase tracking-wider">{siteConfig.footerTopicsTitle || 'CURATED TOPICS'}</div>
            <ul className="space-y-2 text-sm font-sans text-neutral-300">
              {topics.length ? topics.map(topic => <li key={topic}>{renderLink({ id: `topic-${topic}`, label: topic, type: 'topic', target: topic, visible: true })}</li>) : <li className="text-neutral-500">No published topics yet.</li>}
            </ul>
          </div>

          <div className="lg:col-span-2 space-y-3">
            <div className="font-mono text-xs font-bold text-[var(--color-success)] uppercase tracking-wider">{siteConfig.footerHubTitle || 'PUBLICATION HUB'}</div>
            <ul className="space-y-2 text-xs font-mono">
              {hubLinks.map(link => <li key={link.id}>{renderLink(link)}</li>)}
              {onOpenCms && <li><button type="button" onClick={onOpenCms} className="text-neutral-500 hover:text-white transition-colors">ADMIN STUDIO / MODERATOR PANEL</button></li>}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-neutral-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="font-mono text-xs text-neutral-500">© {new Date().getFullYear()} {brandName}. {siteConfig.footerLegalText || 'All rights reserved.'}</div>
          <div className="font-mono text-xs uppercase text-neutral-500 text-center md:text-right">GUMROAD × MEDIUM × NEO-BRUTALISM <span className="mx-2">•</span> <span className="font-bold text-white">{siteConfig.footerBottomRightText || 'HIGH DENSITY SPECIFICATION'}</span></div>
        </div>
      </div>
    </footer>
  );
};
