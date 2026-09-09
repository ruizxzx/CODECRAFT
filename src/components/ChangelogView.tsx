import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileText, Send } from 'lucide-react';
import { auth, loginWithGoogle } from '../lib/firebase';
import { RECENT_CHANGELOG, ChangelogEntry, ProblemReport, submitProblemReport, subscribeProblemReportsForReporter, subscribeChangelogEntries } from '../lib/siteFeatures';
import { PageView } from '../types';

export const ChangelogView: React.FC<{ onNavigate: (page: PageView, param?: string) => void; currentPage?: PageView }> = ({ onNavigate, currentPage }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [issues, setIssues] = useState<ProblemReport[]>([]);
  const [entries, setEntries] = useState<ChangelogEntry[]>(RECENT_CHANGELOG);
  const [status, setStatus] = useState('');

  useEffect(() => subscribeProblemReportsForReporter(setIssues), []);
  useEffect(() => subscribeChangelogEntries(items => setEntries(items.length ? items : RECENT_CHANGELOG)), []);

  const report = async () => {
    try {
      if (!auth.currentUser) await loginWithGoogle();
      if (!auth.currentUser) { setStatus('Sign-in was not completed. Your draft is still here — try SUBMIT again.'); return; }
      await submitProblemReport({ title, description, targetPage: currentPage || 'changelog' });
      setTitle(''); setDescription(''); setStatus('REPORT SUBMITTED TO OFFSCRPT.');
    } catch (e: any) { setStatus(e?.message || 'Could not submit report.'); }
  };

  const kind = (value?: string) => value === 'feature' ? 'FEATURE' : value === 'security' ? 'SECURITY' : value === 'fix' ? 'FIX' : 'MAINTENANCE';

  return <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-10">
    <header className="border-4 border-black bg-black text-white p-6 neo-shadow">
      <div className="font-mono text-[10px] text-[var(--color-primary)] font-black uppercase">OFFSCRPT CHANGELOG</div>
      <h1 className="font-display font-black text-5xl sm:text-7xl uppercase mt-2">WHAT CHANGED.</h1>
      <p className="font-mono text-xs text-neutral-300 mt-4 max-w-3xl">Version history, production fixes and a direct path for reporting problems to the team.</p>
    </header>
    <section className="space-y-4">
      {entries.map(entry => <article key={`${entry.version}-${entry.title}`} className="border-4 border-black p-5 bg-white neo-shadow-sm">
        <div className="flex flex-wrap justify-between gap-3 items-start"><div><div className="font-mono text-[10px] font-black">{entry.version} · {entry.date}</div><h2 className="font-display font-black text-2xl uppercase mt-1">{entry.title}</h2></div><span className="border-2 border-black px-2 py-1 font-mono text-[9px] font-black">{kind(entry.kind)}</span></div>
        <ul className="mt-4 space-y-2">{entry.changes.map((change, i) => <li key={i} className="font-sans text-sm flex gap-2"><span className="mt-1">→</span><span>{change}</span></li>)}</ul>
      </article>)}
    </section>
    <section className="grid lg:grid-cols-2 gap-6">
      <div className="border-4 border-black p-5 bg-white">
        <div className="font-mono text-[10px] font-black uppercase">REPORT A PROBLEM</div>
        <h2 className="font-display font-black text-3xl uppercase mt-1">FOUND A BUG?</h2>
        <p className="font-mono text-[10px] text-neutral-500 mt-2">Reports are stored in Firestore. Admin can mark them noted, under review, fixed or closed and add a response.</p>
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Short problem title" className="w-full border-2 border-black p-3 mt-4 font-mono text-xs" />
        <textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="What happened? Include the page and steps to reproduce." className="w-full min-h-32 border-2 border-black p-3 mt-2 font-mono text-xs" />
        <div className="flex items-center gap-3 mt-3"><button onClick={()=>void report()} className="border-2 border-black bg-[var(--color-primary)] px-4 py-2 font-mono text-[10px] font-black"><Send className="inline w-3 h-3 mr-1"/> SUBMIT</button>{status&&<span className="font-mono text-[9px]">{status}</span>}</div>
      </div>
      <div className="border-4 border-black p-5 bg-neutral-50">
        <div className="font-mono text-[10px] font-black uppercase">YOUR REPORTS</div>
        {!auth.currentUser ? <p className="font-mono text-xs mt-4">Sign in to submit and track problem reports.</p> : issues.length ? <div className="space-y-2 mt-4">{issues.map(x=><div key={x.id} className="border-2 border-black p-3"><div className="flex justify-between gap-2"><div className="font-display font-black uppercase">{x.title}</div><span className="font-mono text-[9px]">{x.status}</span></div><div className="font-mono text-[9px] mt-1">{x.description}</div>{x.adminComment&&<div className="border-l-4 border-black pl-2 mt-2 font-mono text-[9px]">ADMIN: {x.adminComment}</div>}</div>)}</div> : <p className="font-mono text-xs mt-4">No reports submitted from this account.</p>}
      </div>
    </section>
  </div>;
};
