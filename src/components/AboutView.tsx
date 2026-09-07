import React from 'react';
import { 
  Terminal, 
  Cpu, 
  Sparkles, 
  Code2, 
  BookOpen, 
  CheckCircle, 
  Layers, 
  ArrowRight,
  Flame,
  Award,
  Compass,
  Laptop
} from 'lucide-react';
import { PageView, SiteConfig } from '../types';

interface AboutViewProps {
  onNavigate: (page: PageView) => void;
  siteConfig: SiteConfig;
}

export const AboutView: React.FC<AboutViewProps> = ({ onNavigate, siteConfig }) => {
  const principles = [
    {
      num: '01',
      title: 'Radical Clarity Over Cleverness',
      desc: 'Code that is easily read, understood, and modified by another human always defeats convoluted abstractions and golfed one-liners in real production systems.',
      color: 'bg-[var(--color-primary)]',
    },
    {
      num: '02',
      title: 'Zero Fluff, 100% Craft',
      desc: `No speculative buzzwords, sponsored content, or superficial hype cycles. Every essay published on ${siteConfig.logoPart1}${siteConfig.logoPart2} is verified against real code and reproducible architecture.`,
      color: 'bg-[var(--color-accent)]',
    },
    {
      num: '03',
      title: 'First-Principles Understanding',
      desc: 'From physical disk pages and B-Trees to tokenizer logit sampling, true engineering mastery comes from unpacking what is happening under the hood.',
      color: 'bg-[var(--color-success)]',
    },
    {
      num: '04',
      title: 'Build in Public & Share Knowledge',
      desc: 'The best way to solidify your grasp of complex systems is to explain them with ruthless precision to fellow builders around the world.',
      color: 'bg-[var(--color-secondary)]',
    },
  ];

  const techStack = [
    { category: 'Languages', items: ['TypeScript', 'Rust', 'Python', 'Go', 'SQL (PostgreSQL)'] },
    { category: 'Web & Runtimes', items: ['React 19', 'Next.js', 'Vite', 'Node.js', 'Tailwind CSS'] },
    { category: 'AI & Data Systems', items: ['PyTorch', 'Local SLMs / ONNX', 'Gemini GenAI', 'Redis', 'Kafka'] },
    { category: 'DevOps & Tooling', items: ['Docker', 'Linux / Bash', 'Neovim / tmux', 'Git', 'GitHub Actions'] },
  ];

  return (
    <div className="w-full bg-white min-h-screen pb-20">
      {/* Header Banner */}
      <section className="bg-[var(--color-accent)] border-b-4 border-black py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="px-3 py-1 bg-black text-white font-mono text-xs font-bold uppercase">
              {siteConfig.aboutMeTitle}
            </span>
            <span className="px-2.5 py-1 bg-white text-black neo-border-2 font-display font-black text-xs uppercase neo-shadow-sm">
              ENGINEERING MANIFESTO
            </span>
          </div>

          <h1 className="font-display font-black text-4xl sm:text-6xl uppercase tracking-tighter text-black mb-3">
            HELLO, I'M {siteConfig.authorName}.
          </h1>
          <p className="font-sans text-lg sm:text-xl text-neutral-900 max-w-2xl font-medium leading-relaxed">
            {siteConfig.authorRole} and author behind <strong>{siteConfig.logoPart1}{siteConfig.logoPart2}</strong>.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 space-y-16">
        
        {/* Main Bio Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Bio Text */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white neo-border neo-shadow-lg p-6 sm:p-8 space-y-5">
              <h2 className="font-display font-black text-2xl sm:text-3xl text-black uppercase tracking-tight pb-3 border-b-2 border-black flex items-center space-x-2">
                <Terminal className="w-6 h-6 stroke-[3]" />
                <span>WHAT IS {siteConfig.logoPart1}{siteConfig.logoPart2}?</span>
              </h2>

              {siteConfig.aboutMeBio.split('\n\n').map((paragraph, idx) => (
                <p key={idx} className="font-serif text-lg text-neutral-800 leading-relaxed">
                  {paragraph}
                </p>
              ))}

              <div className="pt-4 border-t-2 border-black/20 flex flex-wrap gap-3">
                <span className="px-3 py-1 bg-[var(--color-primary)] text-black neo-border-2 font-mono text-xs font-bold uppercase">
                  ⚡ 100% INDEPENDENT
                </span>
                <span className="px-3 py-1 bg-[var(--color-success)] text-black neo-border-2 font-mono text-xs font-bold uppercase">
                  ⚡ PRODUCTION PROVEN
                </span>
                <span className="px-3 py-1 bg-[var(--color-secondary)] text-black neo-border-2 font-mono text-xs font-bold uppercase">
                  ⚡ NO SPONSORED BIAS
                </span>
              </div>
            </div>

            {/* What Readers Can Expect */}
            <div className="bg-white neo-border neo-shadow p-6 space-y-4">
              <h3 className="font-display font-black text-xl text-black uppercase flex items-center space-x-2">
                <Sparkles className="w-5 h-5 fill-black" />
                <span>WHAT READERS CAN EXPECT</span>
              </h3>
              <ul className="space-y-3 font-sans text-neutral-800 text-base">
                <li className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-black shrink-0 mt-0.5" />
                  <span><strong>Exhaustive Deep Dives:</strong> Essays that explore why systems fail, why abstractions matter, and how low-level mechanics function.</span>
                </li>
                <li className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-black shrink-0 mt-0.5" />
                  <span><strong>Real Working Code:</strong> Every code snippet is tested, annotated, and written for modern production stacks.</span>
                </li>
                <li className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-black shrink-0 mt-0.5" />
                  <span><strong>Emerging Horizons:</strong> Practical coverage of local-first LLMs, WebGPU runtimes, Rust tooling in web dev, and distributed storage.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Right Column: Founder Card & Specs */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[var(--color-primary)] neo-border neo-shadow-lg p-6 sm:p-8 space-y-6">
              <div className="relative">
                <img
                  src={siteConfig.authorAvatarUrl}
                  alt={`${siteConfig.authorName} - Founder`}
                  className="w-full aspect-square object-cover neo-border neo-shadow"
                />
                <div className="absolute -bottom-3 -right-3 bg-black text-white font-mono text-xs font-bold px-3 py-1 border-2 border-black rotate-[-2deg]">
                  {siteConfig.authorName} // {siteConfig.authorRole.split(' ')[0]}
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="font-display font-black text-2xl text-black uppercase">
                  KRISH
                </div>
                <div className="font-mono text-xs font-bold text-neutral-800 space-y-1">
                  <div>ROLE: Founder &amp; System Architect</div>
                  <div>LOCATION: Earth // Building on the Web</div>
                  <div>CORE FOCUS: Systems, Local AI, TypeScript</div>
                </div>
              </div>

              <div className="pt-4 border-t-2 border-black flex gap-3">
                <button
                  onClick={() => onNavigate('contact')}
                  className="w-full py-3 bg-black text-white hover:bg-[var(--color-secondary)] hover:text-black font-display font-black text-xs uppercase neo-border neo-shadow-sm active:translate-x-1 active:translate-y-1 active:shadow-none transition-all text-center"
                >
                  GET IN TOUCH →
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* The 4 Principles of KRISHFICIENT */}
        <div className="space-y-6">
          <div className="flex items-center space-x-3">
            <div className="w-4 h-4 bg-black" />
            <h2 className="font-display font-black text-3xl sm:text-4xl text-black uppercase tracking-tight">
              CORE ENGINEERING PRINCIPLES
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {principles.map((item) => (
              <div
                key={item.num}
                className="bg-white neo-border neo-shadow p-6 flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className={`w-10 h-10 ${item.color} neo-border-2 font-mono font-black text-base flex items-center justify-center mb-4 neo-shadow-sm`}>
                    {item.num}
                  </div>
                  <h3 className="font-display font-black text-xl text-black leading-snug mb-2">
                    {item.title}
                  </h3>
                  <p className="font-sans text-neutral-700 text-sm leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tech Stack & Arsenal */}
        <div className="bg-white neo-border neo-shadow-lg p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between border-b-2 border-black pb-4">
            <h2 className="font-display font-black text-2xl sm:text-3xl text-black uppercase tracking-tight flex items-center space-x-2">
              <Laptop className="w-6 h-6" />
              <span>THE PRODUCTION ARSENAL</span>
            </h2>
            <span className="font-mono text-xs font-bold text-neutral-500 uppercase hidden sm:inline">
              STACK SPECS 2026
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {techStack.map((col) => (
              <div key={col.category} className="space-y-3">
                <div className="font-mono text-xs font-black uppercase text-black bg-gray-50 p-2 neo-border-2">
                  {col.category}
                </div>
                <div className="flex flex-col gap-1.5">
                  {col.items.map((tech) => (
                    <div
                      key={tech}
                      className="px-3 py-1.5 bg-neutral-50 border-2 border-black font-mono text-xs font-bold text-neutral-900 flex items-center justify-between"
                    >
                      <span>{tech}</span>
                      <span className="w-2 h-2 bg-[var(--color-success)] rounded-full border border-black" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Final CTA Banner */}
        <div className="bg-[var(--color-success)] neo-border neo-shadow-lg p-8 sm:p-12 text-center space-y-6">
          <h2 className="font-display font-black text-3xl sm:text-5xl uppercase tracking-tighter text-black">
            READY TO DIVE INTO THE DISPATCHES?
          </h2>
          <p className="font-sans text-lg text-neutral-900 max-w-xl mx-auto font-medium">
            Explore our curated deep dives on distributed runtimes, database indexing, and AI state machines.
          </p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => onNavigate('blog')}
              className="px-8 py-4 bg-black text-[var(--color-primary)] font-display font-black text-base uppercase neo-border neo-shadow-sm hover:bg-[var(--color-primary)] hover:text-black active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center space-x-2"
            >
              <span>EXPLORE ALL ESSAYS</span>
              <ArrowRight className="w-5 h-5 stroke-[3]" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
