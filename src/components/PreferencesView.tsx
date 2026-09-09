import React, { useEffect, useState } from 'react';
import { Bell, Check, Loader2, Settings2 } from 'lucide-react';
import { useAuthUser } from '../lib/useAuthUser';
import { loginWithGoogle } from '../lib/firebase';
import { getNotificationPreferences, saveNotificationPreferences, getThemePreference, saveThemePreference, type NotificationPreferences, type ThemePreference } from '../lib/account';
import { PageView } from '../types';

interface Props { onNavigate: (page: PageView, param?: string) => void; }

export const PreferencesView: React.FC<Props> = ({ onNavigate }) => {
  const user = useAuthUser();
  const [prefs, setPrefs] = useState<NotificationPreferences>({ comments: true, replies: true, mentions: true, follows: true, reactions: true, productNews: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemePreference>('light');
  const [themeSaving, setThemeSaving] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    Promise.all([getNotificationPreferences(), getThemePreference()]).then(([nextPrefs, nextTheme]) => { setPrefs(nextPrefs); setTheme(nextTheme); document.documentElement.classList.toggle('dark', nextTheme === 'dark'); try { localStorage.setItem('offscrpt:theme', nextTheme); } catch (error) { console.warn('OFFSCRPT recoverable operation failed:', error); } }).finally(() => setLoading(false));
  }, [user?.uid]);


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
      <div className="flex items-center justify-between gap-4">
        <div><div className="font-mono text-[10px] uppercase text-neutral-500">APPEARANCE</div><div className="font-display font-black text-2xl uppercase mt-1">DARK MODE</div><div className="font-mono text-[9px] text-neutral-500 mt-1">Saved to your OFFSCRPT account and restored across devices.</div></div>
        <div className="flex border-2 border-black"><button onClick={()=>theme!=='light'&&toggleTheme()} disabled={themeSaving} className={`px-3 py-2 font-mono text-[10px] font-black ${theme==='light'?'bg-[var(--color-primary)] text-black':'bg-white text-black'}`}>LIGHT</button><button onClick={()=>theme!=='dark'&&toggleTheme()} disabled={themeSaving} className={`px-3 py-2 font-mono text-[10px] font-black ${theme==='dark'?'bg-black text-white':'bg-white text-black'}`}>DARK</button></div>
      </div>
      <div className="font-mono text-[9px] mt-3">CURRENT: <span className="font-black">{theme.toUpperCase()}</span>{themeSaving ? ' · SAVING…' : ''}</div>
    </div>
    {loading ? <div className="py-16 flex justify-center"><Loader2 className="w-8 h-8 animate-spin"/></div> : <div className="space-y-3">{rows.map(([key,label,desc]) => <button key={key} onClick={()=>toggle(key)} className="w-full border-2 border-black p-4 bg-white flex items-center gap-4 text-left hover:bg-neutral-50"><div className={`w-12 h-7 border-2 border-black p-0.5 ${prefs[key] ? 'bg-[var(--color-primary)]' : 'bg-white'}`}><div className={`w-5 h-5 bg-black transition-transform ${prefs[key] ? 'translate-x-5' : ''}`}/></div><div className="flex-1"><div className="font-display font-black uppercase">{label}</div><div className="font-mono text-[9px] text-neutral-500 mt-1">{desc}</div></div>{saving===key ? <Loader2 className="w-4 h-4 animate-spin"/> : prefs[key] ? <Check className="w-5 h-5"/> : null}</button>)}</div>}
  </section>;
};
