import React, { useEffect, useMemo, useState } from 'react';
import { X, Megaphone } from 'lucide-react';
import { PageView, SiteConfig } from '../types';

const allowed: PageView[] = ['home','blog','article','social','explore','series','creator','changelog'];
const targetMatches = (target: string | undefined, page: PageView) => !target || target === 'all' || target === page;

export const SiteAnnouncementPopup: React.FC<{ siteConfig: SiteConfig; currentPage: PageView; onNavigate: (page: PageView, param?: string) => void }> = ({ siteConfig, currentPage, onNavigate }) => {
  const popup = siteConfig.popupAnnouncement;
  const storageKey = useMemo(() => popup ? `offscrpt:announcement-dismissed:${popup.id || `${popup.title}|${popup.message}`}` : '', [popup]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => { setDismissed(storageKey ? localStorage.getItem(storageKey) === '1' : false); }, [storageKey]);
  if (!popup?.enabled || dismissed || !targetMatches(popup.targetPage, currentPage)) return null;
  return <div className="fixed inset-0 z-[500] bg-black/70 p-4 grid place-items-center">
    <div className="w-full max-w-2xl border-4 border-black bg-white neo-shadow">
      <div className="bg-[var(--color-primary)] border-b-4 border-black p-4 flex items-center justify-between"><div className="font-display font-black text-xl uppercase flex items-center gap-2"><Megaphone className="w-5 h-5"/>{popup.title}</div>{popup.dismissible!==false&&<button onClick={()=>{localStorage.setItem(storageKey,'1');setDismissed(true)}} className="border-2 border-black bg-white p-1"><X className="w-5 h-5"/></button>}</div>
      <div className="p-5"><p className="font-sans text-sm leading-relaxed whitespace-pre-wrap">{popup.message}</p>{(popup.linkLabel&&popup.linkTarget)&&<button onClick={()=>{const target=popup.linkTarget!;if(allowed.includes(target as PageView)){onNavigate(target as PageView);}else window.location.href=target;}} className="mt-5 border-2 border-black bg-black text-white px-4 py-2 font-mono text-[10px] font-black">{popup.linkLabel}</button>} {popup.dismissible!==false&&<button onClick={()=>{localStorage.setItem(storageKey,'1');setDismissed(true)}} className="mt-5 ml-2 border-2 border-black px-4 py-2 font-mono text-[10px] font-black">DISMISS</button>}</div>
    </div>
  </div>;
};
