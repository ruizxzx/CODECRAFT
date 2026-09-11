import React, { useMemo, useState } from 'react';
import { Bot, Check, Copy, Loader2, RefreshCw, Wand2, X } from 'lucide-react';
import { AIContentInput, getAIUsageToday, requestAI } from '../lib/ai';
import { notifyToast } from '../lib/toast';

type WriterAction =
  | 'write'|'continue'|'rewrite'|'improve'|'expand'|'shorten'|'simplify'|'technical'|'casual'
  | 'tone'|'grammar'|'spelling'|'structure'|'example'|'conclusion'|'introduction'|'title'
  | 'hook'|'excerpt'|'tags'|'faq'|'counterarguments'|'claims'|'readability'|'translate'
  | 'section'|'summary'|'repurpose-discussion'|'repurpose-question'|'repurpose-post';

type Tone = 'default'|'professional'|'casual'|'gen-z'|'technical'|'academic'|'tutorial'|'storytelling'|'concise';
type Audience = 'general'|'beginner'|'intermediate'|'advanced'|'developer'|'creator';

type Props = {
  context: AIContentInput;
  draft: string;
  title?: string;
  selectedText?: string;
  topics?: string[];
  tags?: string[];
  audience?: Audience;
  onInsert: (text: string, mode?: 'cursor'|'replace-selection'|'replace-draft'|'append') => void;
  onReplaceSelection?: (text: string) => void;
  compact?: boolean;
};

const ACTIONS: Array<[WriterAction,string]> = [
  ['write','WRITE FROM PROMPT'],['continue','CONTINUE'],['rewrite','REWRITE'],['improve','IMPROVE'],['expand','EXPAND'],['shorten','SHORTEN'],
  ['simplify','SIMPLIFY'],['technical','MAKE TECHNICAL'],['casual','MAKE CASUAL'],['tone','CHANGE TONE'],['grammar','FIX GRAMMAR'],['spelling','FIX SPELLING'],
  ['structure','IMPROVE STRUCTURE'],['example','ADD EXAMPLE'],['conclusion','CONCLUSION'],['introduction','INTRODUCTION'],['title','TITLE OPTIONS'],['hook','HOOK'],
  ['excerpt','EXCERPT'],['tags','TAGS'],['faq','FAQ'],['counterarguments','COUNTERARGUMENTS'],['claims','CLAIM ASSIST'],['readability','READABILITY'],['translate','TRANSLATE'],
  ['section','REWRITE SECTION'],['summary','DRAFT SUMMARY'],['repurpose-discussion','TO DISCUSSION'],['repurpose-question','TO QUESTION'],['repurpose-post','TO POST'],
];

function resultText(data:any): string {
  return String(data?.generatedText || data?.text || data?.content || data?.summary || data?.excerpt || data?.improvedTitle || data?.answer || '');
}

export const AIWriterAssistant: React.FC<Props> = ({ context, draft, title = '', selectedText = '', topics = [], tags = [], audience = 'general', onInsert, onReplaceSelection }) => {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<WriterAction>('write');
  const [prompt, setPrompt] = useState('');
  const [tone, setTone] = useState<Tone>('default');
  const [targetLanguage, setTargetLanguage] = useState('English');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [replaceMode, setReplaceMode] = useState<'cursor'|'replace-selection'|'replace-draft'|'append'>('cursor');
  const [versionHistory, setVersionHistory] = useState<Array<{action:string;text:string;createdAt:string}>>([]);
  const sourceText = selectedText.trim() || draft.trim();
  const canWrite = !!sourceText || !!prompt.trim();
  const currentContext = useMemo<AIContentInput>(() => ({
    ...context,
    title: title || context.title,
    content: sourceText || context.content,
    metadata: { ...(context.metadata || {}), topics, tags, audience, selectedText: selectedText || undefined }
  }), [context, title, sourceText, topics, tags, audience, selectedText]);

  const run = async (nextAction = action) => {
    if (!canWrite) { notifyToast('Add some draft content or a prompt first.', 'error'); return; }
    if (busy) return;
    setBusy(true);
    try {
      const response = await requestAI('creator', currentContext, {
        creatorAction: nextAction,
        userPrompt: prompt.trim(),
        tone,
        audience,
        targetLanguage,
        selectedText: selectedText.trim() || undefined,
        insertionMode: replaceMode,
        mode: 'standard'
      });
      setAction(nextAction);
      setResult(response);
      const generatedNow = resultText(response);
      if (generatedNow) setVersionHistory(prev => [...prev, { action: nextAction, text: generatedNow.slice(0, 12000), createdAt: new Date().toISOString() }].slice(-10));
      setOpen(true);
      if (nextAction === 'title' && Array.isArray((response as any)?.titles)) {
        notifyToast('AI title options generated. Review before using one.', 'success');
      } else {
        notifyToast('AI draft ready. Review before inserting.', 'success');
      }
    } catch (error:any) {
      notifyToast(error?.message || 'AI writer unavailable. Your draft is unchanged.', 'error');
    } finally { setBusy(false); }
  };

  const generated = resultText(result);
  const insert = () => {
    if (!generated) { notifyToast('No generated text to insert.', 'error'); return; }
    if ((replaceMode === 'replace-draft' || replaceMode === 'replace-selection') && !window.confirm('Replace the current draft/selection with this AI output? Your existing text will be replaced only after confirmation.')) return;
    if (replaceMode === 'replace-selection' && onReplaceSelection) onReplaceSelection(generated); else onInsert(generated, replaceMode);
    notifyToast('AI content inserted into the draft.', 'success');
    setOpen(false);
  };

  return <div className="border-2 border-black bg-[var(--color-primary)] p-3 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="font-mono text-[10px] font-black uppercase inline-flex items-center gap-2"><Wand2 className="w-4 h-4"/> AI WRITING ASSISTANT</div>
      <button type="button" onClick={()=>setOpen(v=>!v)} className="border-2 border-black bg-white px-2 py-1 font-mono text-[9px] font-black">{open ? 'HIDE' : 'OPEN'}</button>
    </div>
    <div className="grid sm:grid-cols-[1fr_220px] gap-2">
      <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Tell AI what to write, change or improve… e.g. Write a beginner-friendly post about React Server Components." className="w-full min-h-24 border-2 border-black bg-white p-2 text-xs" />
      <div className="space-y-2">
        <select value={tone} onChange={e=>setTone(e.target.value as Tone)} className="w-full border-2 border-black bg-white p-2 font-mono text-[9px] font-black uppercase"><option value="default">DEFAULT</option><option value="professional">PROFESSIONAL</option><option value="casual">CASUAL</option><option value="gen-z">GEN-Z</option><option value="technical">TECHNICAL</option><option value="academic">ACADEMIC</option><option value="tutorial">TUTORIAL</option><option value="storytelling">STORYTELLING</option><option value="concise">CONCISE</option></select>
        <select value={targetLanguage} onChange={e=>setTargetLanguage(e.target.value)} className="w-full border-2 border-black bg-white p-2 font-mono text-[9px] font-black uppercase"><option>English</option><option>Hindi</option><option>Bengali</option><option>Spanish</option><option>French</option><option>German</option><option>Japanese</option></select>
        <select value={replaceMode} onChange={e=>setReplaceMode(e.target.value as any)} className="w-full border-2 border-black bg-white p-2 font-mono text-[9px] font-black uppercase"><option value="cursor">INSERT AT CURSOR</option><option value="append">APPEND</option><option value="replace-selection">REPLACE SELECTION</option><option value="replace-draft">REPLACE DRAFT</option></select>
      </div>
    </div>
    <div className="flex flex-wrap gap-1.5">{ACTIONS.map(([key,label])=><button key={key} type="button" disabled={busy} onClick={()=>void run(key)} className={`border-2 border-black px-2 py-1 bg-white font-mono text-[8px] font-black ${action===key?'bg-black text-white':''}`}>{label}</button>)}</div>
    <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[8px] text-neutral-600 uppercase"><span>AI USAGE TODAY: {getAIUsageToday()} · Draft-aware · selected text: {selectedText.trim() ? 'YES' : 'NO'} · audience: {audience}</span>{versionHistory.length>0&&<span>{versionHistory.length} AI VERSION{versionHistory.length===1?'':'S'}</span>}</div>
    {busy&&<div className="border-2 border-black bg-white p-3 font-mono text-[9px] font-black uppercase"><Loader2 className="inline w-4 h-4 animate-spin mr-2"/>Generating — draft remains untouched…</div>}
    {open&&result&&!busy&&<div className="border-2 border-black bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-2"><div className="font-mono text-[9px] font-black uppercase">AI PREVIEW · {String(action).replace(/-/g,' ')}</div><button type="button" onClick={()=>setOpen(false)} className="border-2 border-black p-1"><X className="w-3 h-3"/></button></div>
      {Array.isArray((result as any)?.titles) ? <div className="space-y-2">{(result as any).titles.slice(0,8).map((t:any,i:number)=><div key={i} className="border-2 border-black p-2 flex items-center justify-between gap-2"><span className="font-display font-black text-sm">{String(t)}</span><button type="button" onClick={()=>{onInsert(String(t),'replace-draft');setOpen(false);}} className="border-2 border-black bg-[var(--color-primary)] px-2 py-1 font-mono text-[8px] font-black">USE THIS</button></div>)}</div> : <pre className="whitespace-pre-wrap text-sm leading-relaxed max-h-80 overflow-auto">{generated || JSON.stringify(result,null,2)}</pre>}
      {versionHistory.length>0&&<details className="border-2 border-black bg-neutral-50 p-2"><summary className="font-mono text-[9px] font-black cursor-pointer">AI VERSION HISTORY ({versionHistory.length})</summary><div className="mt-2 space-y-2 max-h-40 overflow-auto">{versionHistory.slice().reverse().map((v,i)=><button type="button" key={i} onClick={()=>onInsert(v.text,'replace-draft')} className="w-full text-left border-2 border-black bg-white p-2"><span className="font-mono text-[8px] uppercase">{v.action} · {new Date(v.createdAt).toLocaleTimeString()}</span><span className="block text-xs mt-1 line-clamp-2">{v.text}</span></button>)}</div></details>}
      <div className="flex flex-wrap gap-2"><button type="button" onClick={insert} disabled={!generated} className="border-2 border-black bg-black text-white px-3 py-2 font-mono text-[9px] font-black inline-flex items-center gap-2"><Check className="w-3 h-3"/> INSERT INTO EDITOR</button><button type="button" onClick={()=>void run(action)} disabled={busy} className="border-2 border-black bg-white px-3 py-2 font-mono text-[9px] font-black inline-flex items-center gap-2"><RefreshCw className="w-3 h-3"/> REGENERATE</button><button type="button" onClick={()=>navigator.clipboard?.writeText(generated)} className="border-2 border-black bg-white px-3 py-2 font-mono text-[9px] font-black inline-flex items-center gap-2"><Copy className="w-3 h-3"/> COPY</button></div>
    </div>}
  </div>;
};
