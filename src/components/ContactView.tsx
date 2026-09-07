import React, { useState } from 'react';
import { SiteConfig } from '../types';
import { 
  Mail, 
  Send, 
  Copy, 
  Check, 
  MessageSquare, 
  Sparkles, 
  ExternalLink,
  Phone,
  ShieldCheck,
  Terminal
} from 'lucide-react';

export const ContactView: React.FC<{siteConfig: SiteConfig}> = ({ siteConfig }) => {
  const [copiedChannel, setCopiedChannel] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    topic: 'Engineering Collaboration',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  // Social / Communication Channels Placeholders
  const channels = [
    {
      id: 'email',
      name: 'Email (Direct)',
      handle: siteConfig.contactEmail || 'hello@krishficient.dev',
      description: 'Primary inbox for serious architectural inquiries and essays.',
      actionText: 'Copy Email',
      copyValue: siteConfig.contactEmail || 'hello@krishficient.dev',
      color: 'bg-[var(--color-primary)]',
      icon: Mail,
    },
    {
      id: 'telegram',
      name: 'Telegram',
      handle: siteConfig.contactTelegram || '@krishficient',
      description: 'Encrypted direct messaging for asynchronous developer sync.',
      actionText: 'Copy Handle',
      copyValue: siteConfig.contactTelegram || '@krishficient',
      color: 'bg-[var(--color-secondary)]',
      icon: Send,
    },
    {
      id: 'twitter',
      name: 'X (Twitter)',
      handle: siteConfig.contactTwitter || '@krishficient',
      description: 'Public thoughts, micro-essays, and shitposting about tech.',
      actionText: 'Copy Handle',
      copyValue: siteConfig.contactTwitter || '@krishficient',
      color: 'bg-[var(--color-accent)]',
      icon: MessageSquare,
    },
    {
      id: 'github',
      name: 'GitHub',
      handle: siteConfig.contactGithub || 'github.com/krishficient',
      description: 'Open source system architectures and tooling.',
      actionText: 'Copy Link',
      copyValue: siteConfig.contactGithub || 'https://github.com/krishficient',
      color: 'bg-[var(--color-success)]',
      icon: Terminal,
    }
  ];

  const handleCopy = (id: string, val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedChannel(id);
    setTimeout(() => setCopiedChannel(null), 2500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) return;
    setSubmitted(true);
  };

  return (
    <div className="w-full bg-white min-h-screen pb-20">
      {/* Header Banner */}
      <section className="bg-[var(--color-secondary)] border-b-4 border-black py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="px-3 py-1 bg-black text-white font-mono text-xs font-bold uppercase">
              GET IN TOUCH
            </span>
            <span className="px-2.5 py-1 bg-white text-black neo-border-2 font-display font-black text-xs uppercase neo-shadow-sm">
              DIRECT DESK
            </span>
          </div>

          <h1 className="font-display font-black text-4xl sm:text-6xl uppercase tracking-tighter text-black mb-3">
            {siteConfig.contactTitle || 'CONNECT & COLLABORATE'}
          </h1>
          <p className="font-sans text-lg sm:text-xl text-neutral-900 max-w-2xl font-medium leading-relaxed">
            {siteConfig.contactSubtitle || 'Have thoughts on an essay, want to discuss software architecture, or explore technical consulting? Reach out directly.'}
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 space-y-12">
        
        {/* Contact Channels Grid */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Terminal className="w-5 h-5 stroke-[2.5]" />
            <h2 className="font-display font-black text-2xl uppercase tracking-tight text-black">
              DIRECT COMMUNICATION CHANNELS
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {channels.map((ch) => {
              const Icon = ch.icon;
              const isCopied = copiedChannel === ch.id;
              return (
                <div
                  key={ch.id}
                  className="bg-white neo-border neo-shadow-sm p-6 flex flex-col justify-between space-y-4 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:neo-shadow transition-all"
                >
                  <div className="space-y-3">
                    <div className={`w-12 h-12 ${ch.color} neo-border-2 flex items-center justify-center neo-shadow-sm`}>
                      <Icon className="w-6 h-6 text-black stroke-[2.5]" />
                    </div>

                    <div>
                      <h3 className="font-display font-black text-lg text-black uppercase">
                        {ch.name}
                      </h3>
                      <div className="font-mono text-xs font-bold text-neutral-800 bg-neutral-100 p-1.5 border-2 border-black truncate mt-1">
                        {ch.handle}
                      </div>
                    </div>

                    <p className="font-sans text-xs text-neutral-600 leading-relaxed">
                      {ch.description}
                    </p>
                  </div>

                  <button
                    onClick={() => handleCopy(ch.id, ch.copyValue)}
                    className="w-full py-2.5 bg-neutral-50 hover:bg-[var(--color-primary)] neo-border-2 font-display font-black text-xs uppercase flex items-center justify-center space-x-2 transition-colors active:translate-x-0.5 active:translate-y-0.5"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-4 h-4 text-black stroke-[3]" />
                        <span>COPIED TO CLIPBOARD!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-black stroke-[2]" />
                        <span>{ch.actionText}</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Message Dispatcher Terminal Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 bg-white neo-border neo-shadow p-6 sm:p-8">
            <div className="flex items-center justify-between pb-4 border-b-2 border-black mb-6">
              <div>
                <h3 className="font-display font-black text-2xl text-black uppercase">
                  DISPATCH DIRECT MESSAGE
                </h3>
                <p className="font-sans text-xs text-neutral-500 font-medium">
                  Send a structured note straight to Krish's priority review queue.
                </p>
              </div>
              <span className="hidden sm:inline-block px-2.5 py-1 bg-[var(--color-success)] text-black font-mono text-xs font-bold uppercase neo-border-2">
                FAST RESPONSE
              </span>
            </div>

            {submitted ? (
              <div className="py-12 text-center space-y-4 bg-gray-50 neo-border-2 p-8">
                <div className="w-14 h-14 bg-[var(--color-success)] neo-border-2 flex items-center justify-center mx-auto neo-shadow-sm">
                  <Check className="w-8 h-8 text-black stroke-[3]" />
                </div>
                <h4 className="font-display font-black text-2xl text-black uppercase">
                  DISPATCH TRANSMITTED!
                </h4>
                <p className="font-sans text-neutral-700 max-w-md mx-auto text-sm">
                  Thank you, <strong>{formData.name}</strong>. Your message regarding <em>"{formData.topic}"</em> has been logged. I typically respond within 24 to 48 hours.
                </p>
                <button
                  onClick={() => {
                    setSubmitted(false);
                    setFormData({ name: '', email: '', topic: 'Engineering Collaboration', message: '' });
                  }}
                  className="px-6 py-2.5 bg-[var(--color-primary)] text-black font-display font-black text-xs uppercase neo-border neo-shadow-sm active:translate-x-1 active:translate-y-1 active:shadow-none"
                >
                  SEND ANOTHER NOTE
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-mono text-xs font-black uppercase text-black">
                      YOUR NAME *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Alex Chen"
                      className="w-full px-3.5 py-2.5 border-2 border-black font-sans text-sm focus:outline-none focus:bg-gray-50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-mono text-xs font-black uppercase text-black">
                      YOUR EMAIL ADDRESS *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="alex@company.com"
                      className="w-full px-3.5 py-2.5 border-2 border-black font-sans text-sm focus:outline-none focus:bg-gray-50"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-mono text-xs font-black uppercase text-black">
                    TOPIC OF DISCUSSION
                  </label>
                  <select
                    value={formData.topic}
                    onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                    className="w-full px-3.5 py-2.5 border-2 border-black font-display font-bold text-sm bg-white focus:outline-none"
                  >
                    <option value="Engineering Collaboration">Engineering Collaboration &amp; Advisory</option>
                    <option value="Article Feedback / Question">Article Feedback or Deep Dive Request</option>
                    <option value="Speaking & Podcasts">Speaking / Technical Podcast Invitation</option>
                    <option value="General Greetings">General Tech Exchange &amp; Greetings</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="font-mono text-xs font-black uppercase text-black">
                      YOUR MESSAGE *
                    </label>
                    <span className="font-mono text-[11px] text-neutral-500">
                      {formData.message.length} chars
                    </span>
                  </div>
                  <textarea
                    required
                    rows={5}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Provide context, system specs, or your specific questions..."
                    className="w-full p-3.5 border-2 border-black font-sans text-sm focus:outline-none focus:bg-gray-50"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-4 bg-[var(--color-primary)] text-black font-display font-black text-sm uppercase neo-border neo-shadow-sm hover:bg-[var(--color-secondary)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center justify-center space-x-2"
                >
                  <span>TRANSMIT DISPATCH MESSAGE</span>
                  <Send className="w-4 h-4 stroke-[2.5]" />
                </button>
              </form>
            )}
          </div>

          {/* Right Column: Information Desk FAQ */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-gray-50 neo-border neo-shadow-sm p-6 space-y-4">
              <h4 className="font-display font-black text-xl text-black uppercase flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-black stroke-[2.5]" />
                <span>COMMUNICATION POLICY</span>
              </h4>
              
              <div className="space-y-3 font-sans text-sm text-neutral-700 leading-relaxed">
                <p>
                  <strong>No Sponsored Reviews:</strong> KRISHFICIENT does not accept paid promotional articles, backlink placements, or unreviewed product endorsements.
                </p>
                <p>
                  <strong>Open Source Inquiries:</strong> If you find an issue in any published code snippet or architectural diagram, feel free to submit an email with reproducing steps.
                </p>
                <p>
                  <strong>Timezone:</strong> Operating globally with responsive developer hours.
                </p>
              </div>

              <div className="p-3 bg-[var(--color-primary)] neo-border-2 font-mono text-xs text-neutral-900 font-bold">
                ⚡ KRISHFICIENT // RADICAL CLARITY IN SOFTWARE
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
