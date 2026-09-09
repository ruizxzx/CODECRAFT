import React, { useEffect, useMemo, useState } from 'react';
import { X, Megaphone, AlertTriangle, CheckCircle2, Info, Wrench } from 'lucide-react';
import { PageView, SiteConfig } from '../types';
import { auth, checkIsAdmin } from '../lib/firebase';
import { getCommunityProfile } from '../lib/community';
import { isPlatformModerator } from '../lib/social';
import { dismissAnnouncementForUser, markAnnouncementSeen, subscribeAnnouncementState } from '../lib/siteFeatures';

const allowed: PageView[] = ['home','blog','article','social','explore','series','creator','changelog'];
const targetMatches = (target: string | undefined, page: PageView) => !target || target === 'all' || target === page;
const now = () => Date.now();

export const SiteAnnouncementPopup: React.FC<{ siteConfig: SiteConfig; currentPage: PageView; onNavigate: (page: PageView, param?: string) => void }> = ({ siteConfig, currentPage, onNavigate }) => {
  const popup = siteConfig.popupAnnouncement;
  const id = popup?.id || `${popup?.title||''}|${popup?.message||''}`;
  const [dismissed, setDismissed] = useState(false);
  const [seen, setSeen] = useState(false);
  const [authUid, setAuthUid] = useState(auth.currentUser?.uid || '');
  const [audienceAllowed, setAudienceAllowed] = useState(true);
  const storageKey = useMemo(() => `offscrpt:announcement:${id}`, [id]);

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async user => {
      setAuthUid(user?.uid || '');
      const audience = popup?.audience || 'everyone';
      if (!user) { setAudienceAllowed(audience === 'everyone' || audience === 'guests'); return; }
      if (audience === 'everyone' || audience === 'signed_in') { setAudienceAllowed(true); return; }
      if (audience === 'master_admin') { setAudienceAllowed(checkIsAdmin(user.email)); return; }
      if (audience === 'moderators') { setAudienceAllowed(await isPlatformModerator(user.uid)); return; }
      if (audience === 'creators') { const p = await getCommunityProfile(user.uid); setAudienceAllowed(Boolean(p?.isAuthor || p?.creatorPage)); return; }
      setAudienceAllowed(true);
    });
    return unsubAuth;
  }, [popup?.audience]);

  useEffect(() => {
    setDismissed(false); setSeen(false);
    if (!popup?.enabled || !id) return;
    const freq = popup.frequency || 'until_dismissed';
    if (freq === 'every_visit') return;
    if (freq === 'session') { setDismissed(sessionStorage.getItem(storageKey) === '1'); return; }
    if (authUid) {
      return subscribeAnnouncementState(id, state => {
        const dismissedAt = state?.dismissedAt?.toMillis?.() || 0;
        const seenAt = state?.seenAt?.toMillis?.() || 0;
        setDismissed(Boolean(dismissedAt) && (freq === 'until_dismissed' || freq === 'once' || (freq === 'daily' && Date.now() - dismissedAt < 86400000)));
        setSeen(Boolean(seenAt));
      });
    }
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    if (freq === 'daily') setDismissed(Date.now() - Date.parse(raw) < 86400000);
    else setDismissed(raw === '1');
    return () => {};
  }, [authUid, id, popup?.enabled, popup?.frequency, storageKey]);

  useEffect(() => {
    if (!popup?.enabled || !id || dismissed || !targetMatches(popup.targetPage, currentPage)) return;
    const audience = popup.audience || 'everyone';
    const isSignedIn = !!auth.currentUser;
    if ((audience === 'signed_in' && !isSignedIn) || (audience === 'guests' && isSignedIn)) return;
    if (popup.startAt && Date.parse(popup.startAt) > now()) return;
    if (popup.endAt && Date.parse(popup.endAt) < now()) return;
    if (!seen && authUid) void markAnnouncementSeen(id);
  }, [popup, currentPage, dismissed, id, authUid, seen, storageKey]);

  const dismiss = () => {
    const freq = popup?.frequency || 'until_dismissed';
    if (freq === 'every_visit') return;
    if (freq === 'session') { sessionStorage.setItem(storageKey, '1'); setDismissed(true); return; }
    if (authUid) void dismissAnnouncementForUser(id);
    else localStorage.setItem(storageKey, freq === 'daily' ? new Date().toISOString() : '1');
    setDismissed(true);
  };
  // Safety net: if this announcement has no primary/secondary action button, it MUST be
  // dismissible, or a visitor would have no way to ever close it. Config should already be
  // validated at publish time (see AdminControlPanel's PUBLISH ANNOUNCEMENT handler), but this
  // check protects against stale/pre-existing config, direct Firestore edits, or a future
  // editing path that skips that validation.
  const hasActionEscape = Boolean(popup?.actionLabel && popup?.actionTarget) || Boolean(popup?.linkLabel && popup?.linkTarget);
  const effectivelyDismissible = popup?.dismissible !== false || !hasActionEscape;

  useEffect(() => {
    if (!effectivelyDismissible) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectivelyDismissible, id]);

  if (!popup?.enabled || dismissed || !audienceAllowed || !targetMatches(popup.targetPage, currentPage)) return null;
  if (popup.startAt && Date.parse(popup.startAt) > now()) return null;
  if (popup.endAt && Date.parse(popup.endAt) < now()) return null;
  const audience = popup.audience || 'everyone';
  const isSignedIn = !!auth.currentUser;
  if ((audience === 'signed_in' && !isSignedIn) || (audience === 'guests' && isSignedIn)) return null;

  const go = (target?: string) => {
    if (!target) return;
    if (allowed.includes(target as PageView)) onNavigate(target as PageView); else window.location.href = target;
  };

  const Icon = popup.type === 'warning' || popup.type === 'urgent' ? AlertTriangle : popup.type === 'bugfix' ? Wrench : popup.type === 'feature' ? CheckCircle2 : Info;
  const display = popup.displayMode || 'popup';
  const shell = display === 'banner' ? 'fixed top-0 left-0 right-0 z-[500] p-3' : 'fixed inset-0 z-[500] bg-black/70 p-4 grid place-items-center';
  const box = display === 'banner' ? 'w-full border-4 border-black bg-white neo-shadow' : 'w-full max-w-2xl border-4 border-black bg-white neo-shadow';
  return <div className={shell}>
    <div className={box}>
      <div className={`border-b-4 border-black p-4 flex items-center justify-between ${popup.priority === 'critical' || popup.type === 'urgent' ? 'bg-red-400' : 'bg-[var(--color-primary)]'}`}>
        <div className="font-display font-black text-xl uppercase flex items-center gap-2"><Icon className="w-5 h-5"/>{popup.title}</div>
        {effectivelyDismissible && <button onClick={dismiss} aria-label="Dismiss announcement" className="border-2 border-black bg-white p-1"><X className="w-5 h-5"/></button>}
      </div>
      <div className="p-5">
        <p className="font-sans text-sm leading-relaxed whitespace-pre-wrap">{popup.message}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {(popup.actionLabel && popup.actionTarget) && <button onClick={()=>go(popup.actionTarget)} className="border-2 border-black bg-black text-white px-4 py-2 font-mono text-[10px] font-black">{popup.actionLabel}</button>}
          {(popup.linkLabel && popup.linkTarget) && <button onClick={()=>go(popup.linkTarget)} className="border-2 border-black bg-white px-4 py-2 font-mono text-[10px] font-black">{popup.linkLabel}</button>}
          {effectivelyDismissible && <button onClick={dismiss} className="border-2 border-black px-4 py-2 font-mono text-[10px] font-black">DISMISS</button>}
        </div>
      </div>
    </div>
  </div>;
};
