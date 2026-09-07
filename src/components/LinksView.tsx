import React from 'react';
import { BentoLink, SiteConfig } from '../types';
import { 
  Instagram, 
  Twitter, 
  Github, 
  Music, 
  Globe, 
  Link as LinkIcon, 
  Youtube,
  Linkedin
} from 'lucide-react';

interface LinksViewProps {
  links: BentoLink[];
  siteConfig: SiteConfig;
}

export const LinksView: React.FC<LinksViewProps> = ({ links, siteConfig }) => {
  const getIcon = (iconName: string) => {
    switch (iconName.toLowerCase()) {
      case 'instagram': return <Instagram className="w-8 h-8 md:w-12 md:h-12" />;
      case 'twitter': return <Twitter className="w-8 h-8 md:w-12 md:h-12" />;
      case 'github': return <Github className="w-8 h-8 md:w-12 md:h-12" />;
      case 'youtube': return <Youtube className="w-8 h-8 md:w-12 md:h-12" />;
      case 'music':
      case 'spotify': return <Music className="w-8 h-8 md:w-12 md:h-12" />;
      case 'globe': return <Globe className="w-8 h-8 md:w-12 md:h-12" />;
      case 'linkedin': return <Linkedin className="w-8 h-8 md:w-12 md:h-12" />;
      default: return <LinkIcon className="w-8 h-8 md:w-12 md:h-12" />;
    }
  };

  const sortedLinks = [...links].sort((a, b) => a.order - b.order);

  return (
    <div className="bg-neutral-100 min-h-screen pt-12 pb-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Profile Header */}
        <div className="text-center mb-12 space-y-4">
          <div className="inline-block relative">
            <img 
              src={siteConfig.authorAvatarUrl} 
              alt={siteConfig.authorName} 
              className="w-24 h-24 sm:w-32 sm:h-32 object-cover neo-border neo-shadow bg-white"
            />
            <div className="absolute -bottom-3 -right-3 bg-[var(--color-primary)] text-black font-mono text-xs font-bold px-2 py-1 border-2 border-black rotate-[5deg]">
              LINKS
            </div>
          </div>
          <div>
            <h1 className="font-display font-black text-3xl sm:text-4xl uppercase tracking-tighter text-black">
              {siteConfig.authorName}
            </h1>
            <p className="font-mono text-neutral-600 uppercase text-sm mt-1">
              {siteConfig.authorRole}
            </p>
          </div>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {sortedLinks.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`
                group relative block neo-border neo-shadow transition-transform hover:-translate-y-1 hover:translate-x-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]
                ${link.isFeatured ? 'col-span-2 md:col-span-2 row-span-2 aspect-square md:aspect-auto p-6 md:p-8' : 'col-span-1 md:col-span-2 aspect-square md:aspect-auto md:h-32 p-4 md:p-6'}
              `}
              style={{ backgroundColor: link.color || '#ffffff' }}
            >
              <div className={`h-full flex ${link.isFeatured ? 'flex-col justify-between' : 'flex-col md:flex-row items-center justify-center md:justify-start space-y-3 md:space-y-0 md:space-x-6'}`}>
                <div className="text-black transform transition-transform group-hover:scale-110 duration-200">
                  {getIcon(link.icon)}
                </div>
                <div className={`${link.isFeatured ? 'mt-4' : 'text-center md:text-left'}`}>
                  <h3 className={`font-display font-black uppercase text-black leading-tight ${link.isFeatured ? 'text-2xl md:text-4xl' : 'text-base md:text-xl'}`}>
                    {link.title}
                  </h3>
                </div>
                
                {/* Arrow indicator */}
                <div className="absolute top-4 right-4 md:top-6 md:right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center -rotate-45">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>

      </div>
    </div>
  );
};

// Add ArrowRight since I used it above
import { ArrowRight } from 'lucide-react';
