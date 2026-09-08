import React from 'react';
import { Code2, Cpu, ExternalLink, Sparkles, Terminal, Zap } from 'lucide-react';
import { SiteConfig } from '../types';

const ICONS = [Zap, Terminal, Code2, Cpu, Sparkles];

export const MarqueeTicker: React.FC<{ siteConfig: SiteConfig }> = ({ siteConfig }) => {
  const fallback = [
    { id: 'fallback-1', text: 'BUILDING ON THE OPEN INTERNET' },
    { id: 'fallback-2', text: 'OFFSCRPT TECH PRESS' },
    { id: 'fallback-3', text: 'BUILD. LEARN. CREATE.' },
    { id: 'fallback-4', text: 'NEW DISPATCHES EVERY TUESDAY' },
    { id: 'fallback-5', text: 'NO FLUFF • REAL PRODUCTION CODE' },
    { id: 'fallback-6', text: 'DISTRIBUTED SYSTEMS & LOCAL AI' },
  ];
  const items = (siteConfig.marqueeItems?.length ? siteConfig.marqueeItems : fallback).filter(item => item.text.trim());
  const duration = Math.max(8, Number(siteConfig.marqueeSpeedSeconds) || 25);
  const pauseOnHover = siteConfig.marqueePauseOnHover !== false;

  return (
    <div className="w-full h-[40px] bg-black text-white border-b-4 border-black flex items-center overflow-hidden select-none">
      <div
        className={`flex w-max whitespace-nowrap text-xs font-black uppercase tracking-widest animate-marquee ${pauseOnHover ? 'marquee-pause-on-hover' : ''}`}
        style={{ animationDuration: `${duration}s` }}
      >
        {[...items, ...items, ...items].map((item, idx) => {
          const Icon = ICONS[idx % ICONS.length];
          const content = (
            <span className="flex items-center space-x-2.5">
              <Icon className="w-3.5 h-3.5 text-[var(--color-primary)] stroke-[2.5]" />
              <span className="font-bold">{item.text}</span>
              <span className="text-white/40 font-mono text-base">•</span>
            </span>
          );
          return item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer noopener"
              key={`${item.id}-${idx}`}
              className="inline-flex items-center hover:text-[var(--color-primary)] transition-colors"
              title={`Open ${item.text}`}
            >
              {content}
              <ExternalLink className="w-3 h-3 ml-1 text-white/35" />
            </a>
          ) : (
            <div key={`${item.id}-${idx}`} className="inline-flex items-center">
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
};
