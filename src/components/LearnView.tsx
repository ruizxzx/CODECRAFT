import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Brain, ChevronRight, GraduationCap, RefreshCw, Target } from 'lucide-react';
import { requestAI } from '../lib/ai';
import { auth } from '../lib/firebase';

type History = { topic:string; title:string; content:string; date:string };
const KEY = 'offscrpt:learn:history:v1';

export const LearnView: React.FC = () => {
  const [history, setHistory] = useState<History[]>([]);
  const [busy, setBusy] = useState(false);
  const [recap, setRecap] = useState<any>(null);
  const [mode, setMode] = useState('study');

  useEffect(() => {
    try { setHistory(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch (error) { console.warn('Learning history load skipped:', error); setHistory([]); }
  }, []);

  const topics = useMemo(() => Array.from(new Set(history.map(h => h.topic).filter(Boolean))), [history]);

  const runRecap = async () => {
    if (!auth.currentUser || !history.length) return;
    setBusy(true);
    try {
      const data = await requestAI('recap', {
        contentType: 'learning-history',
        title: 'OFFSCRPT Learning History',
        content: history.map(h => `${h.date} | ${h.topic} | ${h.title}\n${h.content}`).join('\n\n')
      }, { mode });
      setRecap(data);
    } catch (error) { console.warn('Learning recap unavailable:', error); }
    finally { setBusy(false); }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <header className="border-4 border-black bg-black text-white p-6 neo-shadow-lg">
        <div className="font-mono text-[9px] text-[var(--color-primary)] font-black uppercase">V79 · AI LEARNING DASHBOARD</div>
        <h1 className="font-display font-black text-5xl uppercase mt-2">LEARN</h1>
        <p className="text-sm text-neutral-300 mt-3">AI-assisted study, recaps, concepts, quizzes and personalized next steps.</p>
      </header>

      <div className="grid md:grid-cols-4 gap-3">
        {[
          ['SESSIONS', history.length, BookOpen],
          ['TOPICS', topics.length, Brain],
          ['MODE', mode.toUpperCase(), GraduationCap],
          ['STATUS', auth.currentUser ? 'SIGNED IN' : 'SIGN IN', Target]
        ].map(([label, value, Icon]: any) => (
          <div key={label} className="border-4 border-black bg-white p-4">
            <Icon className="w-5 h-5" />
            <div className="font-mono text-[9px] text-neutral-500 uppercase mt-3">{label}</div>
            <div className="font-display font-black text-2xl uppercase">{value}</div>
          </div>
        ))}
      </div>

      <section className="border-4 border-black bg-[var(--color-primary)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-mono text-[9px] font-black uppercase">AI RECAP</div>
            <h2 className="font-display font-black text-2xl uppercase">YOUR KNOWLEDGE</h2>
          </div>
          <div className="flex gap-2">
            <select value={mode} onChange={e => setMode(e.target.value)} className="border-2 border-black bg-white px-2 py-2 font-mono text-[9px] font-black">
              <option value="study">STUDY</option><option value="revision">REVISION</option><option value="deep">DEEP DIVE</option>
            </select>
            <button onClick={() => void runRecap()} disabled={busy || !history.length} className="border-2 border-black bg-black text-white px-4 py-2 font-mono text-[9px] font-black">
              {busy ? 'PROCESSING…' : 'GENERATE RECAP'}
            </button>
          </div>
        </div>
        {recap && (
          <div className="mt-4 border-2 border-black bg-white p-4">
            <p className="text-sm">{recap.summary || recap.overview || 'No recap returned.'}</p>
            {Array.isArray(recap.topics) && <p className="font-mono text-[9px] mt-3">TOPICS: {recap.topics.join(' · ')}</p>}
            {Array.isArray(recap.recommendedNext) && recap.recommendedNext.length > 0 && (
              <div className="mt-4">
                <div className="font-mono text-[9px] font-black">WHAT TO READ NEXT</div>
                {recap.recommendedNext.map((r:any, i:number) => (
                  <div key={i} className="border-2 border-black p-2 mt-2 flex items-center justify-between">
                    <span>{r.title || r.reason || JSON.stringify(r)}</span><ChevronRight className="w-4 h-4" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-black text-2xl uppercase">RECENT AI LEARNING</h2>
          <button onClick={() => { try { localStorage.removeItem(KEY); setHistory([]); } catch (error) { console.warn('Learning history clear skipped:', error); } }} className="border-2 border-black px-3 py-2 font-mono text-[9px] font-black">
            <RefreshCw className="inline w-3 h-3" /> CLEAR
          </button>
        </div>
        {history.length ? history.slice().reverse().slice(0,20).map((h,i) => (
          <article key={`${h.date}-${i}`} className="border-4 border-black bg-white p-4">
            <div className="font-mono text-[9px] text-neutral-500">{h.date} · {h.topic}</div>
            <h3 className="font-display font-black text-xl uppercase mt-1">{h.title}</h3>
            <p className="text-sm mt-2 line-clamp-3">{h.content}</p>
          </article>
        )) : (
          <div className="border-4 border-dashed border-black p-10 text-center font-mono text-xs">USE AI READING ASSISTANT ON ARTICLES, DISCUSSIONS OR QUESTIONS TO BUILD YOUR LEARNING HISTORY.</div>
        )}
      </section>
    </div>
  );
};
