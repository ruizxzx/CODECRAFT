import React from 'react';
import { Terminal, Zap, Code2, Sparkles, Cpu } from 'lucide-react';

export const MarqueeTicker: React.FC = () => {
  const items = [
    { text: 'BUILD. LEARN. CREATE.', icon: Zap, color: 'text-[var(--color-primary)]' },
    { text: 'NEW DISPATCHES EVERY TUESDAY', icon: Terminal, color: 'text-[var(--color-secondary)]' },
    { text: 'NO FLUFF • REAL PRODUCTION CODE', icon: Code2, color: 'text-[var(--color-success)]' },
    { text: 'DISTRIBUTED SYSTEMS & LOCAL AI', icon: Cpu, color: 'text-[var(--color-accent)]' },
    { text: 'BUILDING ON THE OPEN INTERNET', icon: Sparkles, color: 'text-[var(--color-primary)]' },
    { text: 'KRISHFICIENT TECH PRESS', icon: Zap, color: 'text-white' },
  ];

  return (
    <div className="w-full h-[40px] bg-black text-white border-b-4 border-black flex items-center px-4 sm:px-8 overflow-hidden select-none">
      <div className="flex w-max animate-marquee space-x-8 sm:space-x-12 whitespace-nowrap text-xs font-black uppercase tracking-widest">
        {[...items, ...items, ...items].map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className="flex items-center space-x-2.5 text-white">
              <Icon className={`w-3.5 h-3.5 ${item.color} stroke-[2.5]`} />
              <span className="font-bold">{item.text}</span>
              <span className="text-white/40 font-mono text-base">•</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

