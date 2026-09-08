import React from 'react';
import { PageView, SiteConfig, Article } from '../types';
import { NewsletterSignup } from './NewsletterSignup';
import { ArrowUpRight, Rss, Sparkles, Github, Instagram, Send, Mail, ExternalLink } from 'lucide-react';

interface FooterProps {
  onNavigate: (page: PageView) => void;
  onOpenCms: () => void;
  onOpenRssModal: () => void;
  onSelectCategory?: (category: string) => void;
  siteConfig: SiteConfig;
  articles?: Article[];
}

const isExternal = (url: string) => /^(https?:\/\/|mailto:|tel:)/i.test(url);
const isInternalPath = (url: string) => url.startsWith('#') || url.startsWith('/');
const normalizeExternal = (url: string) => {
  const value = url.trim();
  if (/^(https?:\/\/|mailto:|tel:)/i.test(value)) return value;
  if (value.startsWith('@')) return `https://x.com/${value.slice(1)}`;
  return `https://${value}`;
};

export const Footer: React.FC<FooterProps> = ({ onNavigate, onOpenRssModal, onSelectCategory, siteConfig, articles = [] }) => {
  const brandName = `${siteConfig.logoPart1 || ''}${siteConfig.logoPart2 || ''}`.trim() || 'OFFSCRPT';
  const navLinks = (siteConfig.footerNavigationLinks || []).filter(l => l.enabled !== false && l.label.trim() && l.url.trim());
  const hubLinks = (siteConfig.footerHubLinks || []).filter(l => l.enabled !== false && l.label.trim() && l.url.trim());
  const availableCategories = Array.from(new Set(articles.map(a => a.category).filter(Boolean)));
  const configuredTopics = (siteConfig.footerTopicCategories || []).filter(Boolean);
  const topics = (configuredTopics.length ? configuredTopics : availableCategories).filter((topic, i, arr) => arr.indexOf(topic) === i).slice(0, 7);

  const navigateInternal = (url: string) => {
    const hash = url.replace(/^#/, '');
    const known: Record<string, PageView> = {
      home: 'home', blog: 'blog', explore: 'explore', social: 'social', community: 'social', saved: 'saved',
      history: 'history', notifications: 'notifications', dashboard: 'dashboard', preferences: 'preferences',
      about: 'about', contact: 'contact', series: 'series', links: 'links'
    };
    if (known[hash]) onNavigate(known[hash]);
    else window.location.hash = hash;
  };

  const renderLink = (label: string, url: string, className = '') => {
    if (url === '#rss') return <button onClick={onOpenRssModal} className={`${className} hover:text-[var(--color-primary)] transition-colors inline-flex items-center gap-1`}><Rss className="w-3 h-3" />{label}</button>;
    if (url.startsWith('#')) return <button onClick={() => navigateInternal(url)} className={`${className} hover:text-[var(--color-primary)] transition-colors`}>{label}</button>;
    if (url.startsWith('/')) return <a href={url} className={`${className} hover:text-[var(--color-primary)] transition-colors`}>{label}</a>;
    return <a href={normalizeExternal(url)} target={isExternal(normalizeExternal(url)) && !normalizeExternal(url).startsWith('mailto:') && !normalizeExternal(url).startsWith('tel:') ? '_blank' : undefined} rel="noopener noreferrer" className={`${className} hover:text-[var(--color-primary)] transition-colors inline-flex items-center gap-1`}>{label}<ExternalLink className="w-3 h-3 opacity-50" /></a>;
  };

  const socialLinks = [
    siteConfig.contactGithub ? { label: `GitHub: ${siteConfig.contactGithub}`, url: `https://github.com/${siteConfig.contactGithub.replace(/^@/, '').replace(/^https?:\/\/github\.com\//i, '')}`, icon: Github } : null,
    siteConfig.contactTelegram ? { label: `Telegram: ${siteConfig.contactTelegram}`, url: `https://t.me/${siteConfig.contactTelegram.replace(/^@/, '').replace(/^https?:\/\/t\.me\//i, '')}`, icon: Send } : null,
    siteConfig.contactInstagram ? { label: `Instagram: ${siteConfig.contactInstagram}`, url: `https://instagram.com/${siteConfig.contactInstagram.replace(/^@/, '')}`, icon: Instagram } : null,
    siteConfig.contactEmail ? { label: `Email: ${siteConfig.contactEmail}`, url: `mailto:${siteConfig.contactEmail}`, icon: Mail } : null,
  ].filter(Boolean) as Array<{label:string;url:string;icon:React.ComponentType<{className?:string}>}>;

  return (
    <footer className="w-full bg-[#0A0A0A] text-white border-t-4 border-black selection:bg-[var(--color-primary)] selection:text-black">
      <div className="border-b-4 border-black bg-[#141414] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-2">
              <div className="inline-flex items-center space-x-2 bg-[var(--color-primary)] text-black px-2.5 py-1 font-mono text-xs font-black uppercase neo-border-2 mb-1">
                <Sparkles className="w-3.5 h-3.5 fill-black" /><span>{brandName} DISPATCHES</span>
              </div>
              <h3 className="font-display font-black text-3xl sm:text-4xl uppercase tracking-tight text-white">{siteConfig.footerNewsletterTitle || 'RECEIVE DEEP TECHNICAL ESSAYS IN YOUR INBOX'}</h3>
              <p className="font-sans text-neutral-400 text-sm max-w-xl">{siteConfig.footerNewsletterSubtitle || 'Zero spam. Zero generic marketing. Only in-depth software architectural breakdowns, local AI research, and production post-mortems.'}</p>
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
              <span className="font-display font-black text-3xl tracking-tighter text-white uppercase">{siteConfig.logoPart1 || 'OFF'}<span className="text-[var(--color-accent)]">{siteConfig.logoPart2 || 'SCRPT'}</span></span>
            </div>
            <p className="font-sans text-neutral-400 text-sm leading-relaxed max-w-sm">{siteConfig.footerBrandStatement || 'An independent technology publication engineered by Krish.'}</p>
            <div className="pt-2 flex flex-wrap gap-2 font-mono text-xs font-bold text-neutral-400">
              <span className="px-2 py-1 bg-neutral-900 border border-neutral-700">FIRESTORE CLOUD CMS</span>
              <span className="px-2 py-1 bg-neutral-900 border border-neutral-700">HIGH DENSITY DESIGN</span>
              <span className="px-2 py-1 bg-neutral-900 border border-neutral-700">NO FLUFF</span>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-3 font-display">
            <div className="font-mono text-xs font-bold text-[var(--color-primary)] uppercase tracking-wider">{siteConfig.footerNavigationTitle || 'NAVIGATION'}</div>
            <ul className="space-y-2 text-sm font-bold uppercase">
              {navLinks.map(link => <li key={link.id}>{renderLink(link.label, link.url)}</li>)}
            </ul>
          </div>

          <div className="lg:col-span-3 space-y-3">
            <div className="font-mono text-xs font-bold text-[var(--color-secondary)] uppercase tracking-wider">{siteConfig.footerTopicsTitle || 'CURATED TOPICS'}</div>
            <ul className="space-y-2 text-sm font-sans text-neutral-300">
              {topics.map(topic => <li key={topic}><button onClick={() => { onSelectCategory?.(topic); onNavigate('blog'); }} className="text-left hover:text-[var(--color-secondary)] transition-colors">{topic}</button></li>)}
              {!topics.length && <li className="text-neutral-500">Topics appear as published categories.</li>}
            </ul>
          </div>

          <div className="lg:col-span-2 space-y-3">
            <div className="font-mono text-xs font-bold text-[var(--color-success)] uppercase tracking-wider">{siteConfig.footerHubTitle || 'PUBLICATION HUB'}</div>
            <ul className="space-y-2 text-xs font-mono">
              {hubLinks.map(link => <li key={link.id}>{renderLink(link.label, link.url, 'text-neutral-300')}</li>)}
              {socialLinks.map(({label,url,icon:Icon}) => <li key={label}><a href={normalizeExternal(url)} target={url.startsWith('mailto:') ? undefined : '_blank'} rel="noopener noreferrer" className="text-neutral-300 hover:text-[var(--color-success)] inline-flex items-center gap-2"><Icon className="w-3 h-3" />{label}</a></li>)}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs text-neutral-500">
          <div className="flex items-center space-x-2"><span>{siteConfig.footerLegalText || `© ${new Date().getFullYear()} ${brandName}. All rights reserved.`}</span></div>
          <div className="flex items-center space-x-4"><span>{siteConfig.footerBottomRightText || 'GUMROAD × MEDIUM × NEO-BRUTALISM'}</span><span>•</span><span className="text-white font-bold">HIGH DENSITY SPECIFICATION</span></div>
        </div>
      </div>
    </footer>
  );
};
