import React, { useState } from 'react';
import { PageView, SiteConfig } from '../types';
import { NewsletterSignup } from './NewsletterSignup';
import { loginWithGoogle, auth, logout } from '../lib/firebase';
import { 
  Terminal, 
  ArrowUpRight, 
  Send, 
  Check, 
  Rss, 
  Shield, 
  Code2, 
  Sparkles,
  Heart
} from 'lucide-react';

interface FooterProps {
  onNavigate: (page: PageView) => void;
  onOpenCms: () => void;
  onOpenRssModal: () => void;
  siteConfig: SiteConfig;
}

const ALLOWED_ADMIN_EMAILS = ['ruizxzxz@gmail.com', 'krishsarkar456@gmail.com'];

export const Footer: React.FC<FooterProps> = ({
  onNavigate,
  onOpenCms,
  onOpenRssModal,
  siteConfig
}) => {

  return (
    <footer className="w-full bg-[#0A0A0A] text-white border-t-4 border-black selection:bg-[var(--color-primary)] selection:text-black">
      {/* Top Newsletter / Dispatch signup section */}
      <div className="border-b-4 border-black bg-[#141414] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-2">
              <div className="inline-flex items-center space-x-2 bg-[var(--color-primary)] text-black px-2.5 py-1 font-mono text-xs font-black uppercase neo-border-2 mb-1">
                <Sparkles className="w-3.5 h-3.5 fill-black" />
                <span>KRISHFICIENT DISPATCHES</span>
              </div>
              <h3 className="font-display font-black text-3xl sm:text-4xl uppercase tracking-tight text-white">
                {siteConfig.footerNewsletterTitle || "RECEIVE DEEP TECHNICAL ESSAYS IN YOUR INBOX"}
              </h3>
              <p className="font-sans text-neutral-400 text-sm max-w-xl">
                {siteConfig.footerNewsletterSubtitle || "Zero spam. Zero generic marketing. Only in-depth software architectural breakdowns, local AI research, and production post-mortems."}
              </p>
            </div>

            <div className="lg:col-span-5">
              <NewsletterSignup variant="footer" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10">
          
          {/* Col 1: Giant Logo & Brand Statement */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-[var(--color-primary)] text-black flex items-center justify-center font-display font-black text-xl neo-border-2">
                K
              </div>
              <span className="font-display font-black text-3xl tracking-tighter text-white uppercase">
                KRISH<span className="text-[var(--color-accent)]">FICIENT</span>
              </span>
            </div>

            <p className="font-sans text-neutral-400 text-sm leading-relaxed max-w-sm">
              {siteConfig.footerBrandStatement || "An independent technology publication engineered by Krish. Fusing Neo-Brutalism, Gumroad minimalism, and Medium-grade editorial craft for software builders worldwide."}
            </p>

            <div className="pt-2 flex flex-wrap gap-2 font-mono text-xs font-bold text-neutral-400">
              <span className="px-2 py-1 bg-neutral-900 border border-neutral-700">FIRESTORE CLOUD CMS</span>
              <span className="px-2 py-1 bg-neutral-900 border border-neutral-700">HIGH DENSITY DESIGN</span>
              <span className="px-2 py-1 bg-neutral-900 border border-neutral-700">NO FLUFF</span>
            </div>
          </div>

          {/* Col 2: Navigation Links */}
          <div className="lg:col-span-2 space-y-3 font-display">
            <div className="font-mono text-xs font-bold text-[var(--color-primary)] uppercase tracking-wider">
              NAVIGATION
            </div>
            <ul className="space-y-2 text-sm font-bold uppercase">
              <li>
                <button
                  onClick={() => onNavigate('home')}
                  className="hover:text-[var(--color-primary)] transition-colors"
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('blog')}
                  className="hover:text-[var(--color-primary)] transition-colors"
                >
                  The Dispatches
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('about')}
                  className="hover:text-[var(--color-primary)] transition-colors"
                >
                  About Krish
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('contact')}
                  className="hover:text-[var(--color-primary)] transition-colors"
                >
                  Contact Desk
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Categories */}
          <div className="lg:col-span-3 space-y-3">
            <div className="font-mono text-xs font-bold text-[var(--color-secondary)] uppercase tracking-wider">
              CURATED TOPICS
            </div>
            <ul className="space-y-2 text-sm font-sans text-neutral-300">
              <li>Web Development &amp; Modern Runtimes</li>
              <li>Artificial Intelligence &amp; Local SLMs</li>
              <li>Database Engines &amp; LSM Internals</li>
              <li>Distributed Microservices &amp; Outbox</li>
              <li>Developer Ergonomics &amp; CLI Workflows</li>
            </ul>
          </div>

          {/* Col 4: Channels & Utilities */}
          <div className="lg:col-span-2 space-y-3">
            <div className="font-mono text-xs font-bold text-[var(--color-success)] uppercase tracking-wider">
              PUBLICATION HUB
            </div>
            <ul className="space-y-2 text-xs font-mono">
              <li>
                <button
                  onClick={() => onNavigate('cms')}
                  className="text-neutral-300 hover:text-[var(--color-secondary)] flex items-center space-x-1"
                >
                  <span>Admin Studio CMS (Restricted)</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenRssModal}
                  className="text-neutral-300 hover:text-[var(--color-primary)] flex items-center space-x-1"
                >
                  <Rss className="w-3 h-3" />
                  <span>RSS / XML Feed</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('contact')}
                  className="text-neutral-300 hover:text-[var(--color-success)]"
                >
                  Telegram: {siteConfig.contactTelegram || '@krishficient'}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('contact')}
                  className="text-neutral-300 hover:text-[var(--color-accent)]"
                >
                  Email: {siteConfig.contactEmail || 'hello@krishficient.dev'}
                </button>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom ASCII / Legal Bar */}
        <div className="mt-12 pt-8 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs text-neutral-500">
          <div className="flex items-center space-x-2">
            <span>&copy; {new Date().getFullYear()} KRISHFICIENT.</span>
            <span>All rights reserved.</span>
          </div>

          <div className="flex items-center space-x-4">
            <span>GUMROAD &times; MEDIUM &times; NEO-BRUTALISM</span>
            <span>&bull;</span>
            <span className="text-white font-bold">HIGH DENSITY SPECIFICATION</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
