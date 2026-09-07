import React, { useState } from 'react';
import { X, Copy, Check, Rss, Code2, Globe } from 'lucide-react';
import { Article } from '../types';

interface RssModalProps {
  isOpen: boolean;
  onClose: () => void;
  articles: Article[];
}

export const RssModal: React.FC<RssModalProps> = ({ isOpen, onClose, articles }) => {
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<'rss' | 'sitemap' | 'robots'>('rss');

  if (!isOpen) return null;

  const rssFeedXml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
<channel>
  <title>KRISHFICIENT</title>
  <link>https://krishficient.dev</link>
  <description>An independent personal technology publication by Krish.</description>
  <language>en-us</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  ${articles.map(art => `
  <item>
    <title><![CDATA[${art.title}]]></title>
    <link>https://krishficient.dev/blog/${art.slug}</link>
    <description><![CDATA[${art.excerpt}]]></description>
    <category>${art.category}</category>
    <pubDate>${new Date(art.publishedAt).toUTCString()}</pubDate>
    <guid>https://krishficient.dev/blog/${art.slug}</guid>
  </item>`).join('')}
</channel>
</rss>`;

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://krishficient.dev/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://krishficient.dev/blog</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://krishficient.dev/about</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://krishficient.dev/contact</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  ${articles.map(art => `
  <url>
    <loc>https://krishficient.dev/blog/${art.slug}</loc>
    <lastmod>${art.publishedAt}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`).join('')}
</urlset>`;

  const robotsTxt = `User-agent: *
Allow: /
Sitemap: https://krishficient.dev/sitemap.xml`;

  const activeContent = tab === 'rss' ? rssFeedXml : tab === 'sitemap' ? sitemapXml : robotsTxt;

  const handleCopy = () => {
    navigator.clipboard.writeText(activeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="w-full max-w-2xl bg-white border-4 border-black neo-shadow-lg overflow-hidden">
        <div className="bg-[var(--color-primary)] px-6 py-4 border-b-4 border-black flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Rss className="w-5 h-5 text-black stroke-[3]" />
            <h3 className="font-display font-black text-lg text-black uppercase">
              SYNDICATION &amp; SEO ENGINE
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 bg-white border-2 border-black neo-shadow-sm hover:bg-black hover:text-white transition-colors active:translate-x-0.5 active:translate-y-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 border-b-2 border-black font-mono text-xs font-bold text-center bg-white">
          <button
            onClick={() => setTab('rss')}
            className={`py-2.5 border-r border-black transition-colors ${
              tab === 'rss' ? 'bg-black text-[var(--color-primary)]' : 'hover:bg-neutral-100 text-black'
            }`}
          >
            RSS FEED (XML)
          </button>
          <button
            onClick={() => setTab('sitemap')}
            className={`py-2.5 border-r border-black transition-colors ${
              tab === 'sitemap' ? 'bg-black text-[var(--color-primary)]' : 'hover:bg-neutral-100 text-black'
            }`}
          >
            SITEMAP.XML
          </button>
          <button
            onClick={() => setTab('robots')}
            className={`py-2.5 transition-colors ${
              tab === 'robots' ? 'bg-black text-[var(--color-primary)]' : 'hover:bg-neutral-100 text-black'
            }`}
          >
            ROBOTS.TXT
          </button>
        </div>

        <div className="p-4 bg-[#0F172A] max-h-[50vh] overflow-y-auto">
          <pre className="text-xs font-mono text-[var(--color-success)] leading-relaxed whitespace-pre-wrap">
            {activeContent}
          </pre>
        </div>

        <div className="p-4 bg-neutral-100 border-t-4 border-black flex items-center justify-between">
          <span className="font-mono text-xs text-neutral-600">
            Validated specification format
          </span>
          <button
            onClick={handleCopy}
            className="px-4 py-2 bg-[var(--color-primary)] text-black font-display font-black text-xs uppercase neo-border-2 neo-shadow-sm hover:bg-[var(--color-secondary)] active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center space-x-1.5"
          >
            {copied ? <Check className="w-4 h-4 text-black stroke-[3]" /> : <Copy className="w-4 h-4 text-black" />}
            <span>{copied ? 'COPIED!' : 'COPY TO CLIPBOARD'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
