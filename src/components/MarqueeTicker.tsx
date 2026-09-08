import React from 'react';
import { Terminal, Zap, Code2, Sparkles, Cpu, ArrowUpRight } from 'lucide-react';
import { MarqueeItem, SiteConfig } from '../types';

const FALLBACK: MarqueeItem[] = [
  { id: 'fallback-1', text: 'BUILDING ON THE OPEN INTERNET', enabled: true },
  { id: 'fallback-2', text: 'OFFSCRPT TECH PRESS', enabled: true },
  { id: 'fallback-3', text: 'BUILD. LEARN. CREATE.', enabled: true },
  { id: 'fallback-4', text: 'NEW DISPATCHES EVERY TUESDAY', enabled: true },
  { id: 'fallback-5', text: 'NO FLUFF • REAL PRODUCTION CODE', enabled: true },
  { id: 'fallback-6', text: 'DISTRIBUTED SYSTEMS & LOCAL AI', enabled: true },
];

const icons = [Zap, Terminal, Code2, Cpu, Sparkles, Zap];
const colors = ['text-[var(--color-primary)]', 'text-[var(--color-secondary)]', 'text-[var(--color-success)]', 'text-[var(--color-accent)]', 'text-[var(--color-primary)]', 'text-white'];

export const MarqueeTicker: React.FC<{ siteConfig: SiteConfig }> = ({ siteConfig }) => {
  const items = (siteConfig.marqueeItems?.length ? siteConfig.marqueeItems : FALLBACK).filter(item => item.enabled !== false && item.text.trim());
  if (!items.length) return null;
  const duration = Math.max(10, Math.min(120, Number(siteConfig.marqueeSpeedSeconds || 25)));
  const pauseOnHover = siteConfig.marqueePauseOnHover !== false;
  const copies = [...items, ...items, ...items];

  return (
    <div className="w-full h-[40px] bg-black text-white border-b-4 border-black flex items-center overflow-hidden select-none" aria-label="Publication announcements">
      <div
        className={`flex w-max whitespace-nowrap text-xs font-black uppercase tracking-widest ${pauseOnHover ? '[&:hover]:[animation-play-state:paused]' : ''}`}
        style={{ animation: `marquee ${duration}s linear infinite` }}
      >
        {copies.map((item, idx) => {
          const Icon = icons[idx % icons.length];
          const configuredColor = item.color?.trim();
          const colorClass = configuredColor?.startsWith('text-') ? configuredColor : colors[idx % colors.length];
          const isInternal = item.url?.startsWith('#');
          const content = (
            <span className="flex items-center gap-2.5 px-4 sm:px-8">
              <Icon className={`w-3.5 h-3.5 ${colorClass} stroke-[2.5]`} />
              <span className="font-bold">{item.text}</span>
              {item.url && <ArrowUpRight className="w-3 h-3 opacity-50" />}
              <span className="text-white/40 font-mono text-base">•</span>
            </span>
          );
          if (!item.url) return <div key={`${item.id}-${idx}`}>{content}</div>;
          if (isInternal) return <a key={`${item.id}-${idx}`} href={item.url} className="hover:text-[var(--color-primary)]">{content}</a>;
          return <a key={`${item.id}-${idx}`} href={item.url} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-primary)]">{content}</a>;
        })}
      </div>
    </div>
  );
};
