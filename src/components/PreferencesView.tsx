import React, { useEffect, useState } from 'react';
import { Bell, Check, Loader2, Settings2, AtSign, UserRound } from 'lucide-react';
import { useAuthUser } from '../lib/useAuthUser';
import { loginWithGoogle } from '../lib/firebase';
import { getNotificationPreferences, saveNotificationPreferences, getThemePreference, saveThemePreference, type NotificationPreferences, type ThemePreference } from '../lib/account';
import { PageView, CommunityUser } from '../types';
import { getCommunityProfile, isUsernameAvailable, updateCommunityProfile } from '../lib/community';

interface Props { onNavigate: (page: PageView, param?: string) => void; }

export const PreferencesView: React.FC<Props> = ({ onNavigate }) => {
  const user = useAuthUser();
  const [prefs, setPrefs] = useState<NotificationPreferences>({ comments: true, replies: true, mentions: true, follows: true, reactions: true, productNews: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemePreference>('light');
  const [themeSaving, setThemeSaving] = useState(false);
  const [profile, setProfile] = useState<CommunityUser | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [handleStatus, setHandleStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'current' | 'invalid'>('idle');
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    Promise.all([getNotificationPreferences(), getThemePreference(), getCommunityProfile(user.uid)]).then(([nextPrefs, nextTheme, nextProfile]) => { setPrefs(nextPrefs); setTheme(nextTheme); setProfile(nextProfile as CommunityUser | null); setDisplayName((nextProfile as CommunityUser | null)?.displayName || user.displayName || ''); setHandle((nextProfile as CommunityUser | null)?.username || ''); document.documentElement.classList.toggle('dark', nextTheme === 'dark'); try { localStorage.setItem('offscrpt:theme', nextTheme); } catch (error) { console.warn('OFFSCRPT recoverable operation failed:', error); } }).finally(() => setLoading(false));
  }, [user?.uid]);


  useEffect(() => {
    if (!user || !profile) return;
    const clean = handle.toLowerCase().trim().replace(/[^a-z0-9_]/g, '').slice(0, 30);
    if (!clean) { setHandleStatus('available'); return; }
    if (clean === (profile.username || '').toLowerCase()) { setHandleStatus('current'); return; }
    if (clean.length < 3) { setHandleStatus('invalid'); return; }
    setHandleStatus('checking');
    const timer = setTimeout(async () => {
      try { setHandleStatus((await isUsernameAvailable(clean)) ? 'available' : 'taken'); }
      catch { setHandleStatus('idle'); }
    }, 350);
    return () => clearTimeout(timer);
  }, [handle, profile?.username, user?.uid]);

  const saveProfileIdentity = async () => {
    if (!user || !profile || profileSaving) return;
    const cleanHandle = handle.toLowerCase().trim().replace(/[^a-z0-9_]/g, '').slice(0, 30);
    const cleanName = displayName.trim() || profile.displayName || user.displayName || 'User';
    if (cleanHandle && cleanHandle.length < 3) { setHandleStatus('invalid'); return; }
    if (handleStatus === 'taken' || handleStatus === 'checking' || handleStatus === 'invalid') return;
    setProfileSaving(true);
    try {
      await updateCommunityProfile(user.uid, { username: cleanHandle, displayName: cleanName });
      const next = await getCommunityProfile(user.uid);
      setProfile(next); setHandle(next?.username || ''); setDisplayName(next?.displayName || cleanName);
    } catch (error) {
      console.error('Profile identity update failed:', error);
    } finally { setProfileSaving(false); }
  };


  const toggleTheme = async () => {
    const next: ThemePreference = theme === 'dark' ? 'light' : 'dark';
    const previous = theme; setTheme(next); setThemeSaving(true);
    document.documentElement.classList.toggle('dark', next === 'dark');
    try { localStorage.setItem('offscrpt:theme', next); } catch (error) { console.warn('OFFSCRPT recoverable operation failed:', error); }
    try { await saveThemePreference(next); } catch { setTheme(previous); document.documentElement.classList.toggle('dark', previous === 'dark'); try { localStorage.setItem('offscrpt:theme', previous); } catch (error) { console.warn('OFFSCRPT recoverable operation failed:', error); } }
    finally { setThemeSaving(false); }
  };

  const toggle = async (key: keyof NotificationPreferences) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setSaving(key); setPrefs(next);
    try { await saveNotificationPreferences(next); } catch { setPrefs(prefs); }
    finally { setSaving(null); }
  };

  if (!user) return <section className="max-w-2xl mx-auto px-4 py-24 text-center"><Settings2 className="w-12 h-12 mx-auto mb-4"/><h1 className="font-display font-black text-4xl uppercase">SIGN IN REQUIRED</h1><button onClick={()=>loginWithGoogle()} className="mt-5 border-2 border-black bg-[var(--color-primary)] px-4 py-3 font-mono text-[10px] font-black uppercase">SIGN IN WITH GOOGLE</button></section>;
  const rows: Array<[keyof NotificationPreferences, string, string]> = [
    ['comments', 'COMMENTS', 'Someone comments on your content.'],
    ['replies', 'REPLIES', 'Someone replies to your comment.'],
    ['mentions', 'MENTIONS', 'Someone mentions your @handle.'],
    ['follows', 'FOLLOWERS', 'Someone follows your account.'],
    ['reactions', 'REACTIONS', 'Someone reacts to your content.'],
    ['productNews', 'OFFSCRPT NEWS', 'Product updates and platform announcements.'],
  ];
  return <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
    <div className="mb-8"><button onClick={()=>onNavigate('dashboard')} className="font-mono text-[10px] underline">← MY OFFSCRPT</button><div className="mt-3 font-mono text-[9px] text-neutral-500 uppercase">SETTINGS → APPEARANCE + NOTIFICATIONS</div><div className="font-mono text-[10px] uppercase text-neutral-500 mt-5 flex items-center gap-2"><Bell className="w-4 h-4"/> ACCOUNT SETTINGS</div><h1 className="font-display font-black text-4xl sm:text-6xl uppercase leading-none mt-2">CONTROL</h1><p className="mt-3 text-neutral-600">Appearance and notification controls are stored on your account and apply across devices.</p></div>
    <div className="mb-6 border-4 border-black bg-white p-4 sm:p-5 neo-shadow">
      <div className="font-mono text-[10px] uppercase text-neutral-500 flex items-center gap-2"><UserRound className="w-4 h-4"/> PROFILE</div>
      <div className="font-display font-black text-2xl uppercase mt-1">IDENTITY</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        <input value={displayName} onChange={e=>setDisplayName(e.target.value.slice(0,64))} maxLength={64} placeholder="Display name" className="px-3 py-2 border-2 border-black font-display font-bold text-sm"/>
        <div>
          <div className="relative"><AtSign className="absolute left-2 top-2.5 w-4 h-4"/><input value={handle} onChange={e=>setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,30))} maxLength={30} placeholder="Unique handle (optional)" className="w-full pl-8 pr-3 py-2 border-2 border-black font-mono text-sm"/></div>
          <div className="font-mono text-[9px] mt-1">{handleStatus==='checking'?'CHECKING…':handleStatus==='available'?'HANDLE AVAILABLE':handleStatus==='current'?'CURRENT HANDLE':handleStatus==='taken'?'HANDLE TAKEN':handleStatus==='invalid'?'3–30 CHARS OR BLANK':'OPTIONAL — LEAVE BLANK TO STAY UNCLAIMED'}</div>
        </div>
      </div>
      <button type="button" onClick={()=>void saveProfileIdentity()} disabled={profileSaving || handleStatus==='taken' || handleStatus==='checking' || handleStatus==='invalid'} className="mt-4 px-4 py-2 border-2 border-black bg-[var(--color-primary)] font-mono text-[10px] font-black uppercase disabled:opacity-50">{profileSaving?'SAVING…':'SAVE PROFILE'}</button>
      <p className="font-mono text-[9px] text-neutral-500 mt-2">Display name and @handle are separate. Handle changes are validated against the global username registry and saved to Firestore.</p>
    </div>
    <div className="mb-6 border-4 border-black bg-white p-4 sm:p-5 neo-shadow">
      <div className="flex items-center justify-between gap-4">
        <div><div className="font-mono text-[10px] uppercase text-neutral-500">APPEARANCE</div><div className="font-display font-black text-2xl uppercase mt-1">DARK MODE</div><div className="font-mono text-[9px] text-neutral-500 mt-1">Saved to your OFFSCRPT account and restored across devices.</div></div>
        <div className="flex border-2 border-black"><button onClick={()=>theme!=='light'&&toggleTheme()} disabled={themeSaving} className={`px-3 py-2 font-mono text-[10px] font-black ${theme==='light'?'bg-[var(--color-primary)] text-black':'bg-white text-black'}`}>LIGHT</button><button onClick={()=>theme!=='dark'&&toggleTheme()} disabled={themeSaving} className={`px-3 py-2 font-mono text-[10px] font-black ${theme==='dark'?'bg-black text-white':'bg-white text-black'}`}>DARK</button></div>
      </div>
      <div className="font-mono text-[9px] mt-3">CURRENT: <span className="font-black">{theme.toUpperCase()}</span>{themeSaving ? ' · SAVING…' : ''}</div>
    </div>
    {loading ? <div className="py-16 flex justify-center"><Loader2 className="w-8 h-8 animate-spin"/></div> : <div className="space-y-3">{rows.map(([key,label,desc]) => <button key={key} onClick={()=>toggle(key)} className="w-full border-2 border-black p-4 bg-white flex items-center gap-4 text-left hover:bg-neutral-50"><div className={`w-12 h-7 border-2 border-black p-0.5 ${prefs[key] ? 'bg-[var(--color-primary)]' : 'bg-white'}`}><div className={`w-5 h-5 bg-black transition-transform ${prefs[key] ? 'translate-x-5' : ''}`}/></div><div className="flex-1"><div className="font-display font-black uppercase">{label}</div><div className="font-mono text-[9px] text-neutral-500 mt-1">{desc}</div></div>{saving===key ? <Loader2 className="w-4 h-4 animate-spin"/> : prefs[key] ? <Check className="w-5 h-5"/> : null}</button>)}</div>}
  </section>;
};
