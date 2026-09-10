import React, { useMemo, useRef, useState } from 'react';
import { X, Plus, Trash2, GripVertical, Quote, Repeat2, MessageSquare, Upload, BarChart3 } from 'lucide-react';
import { CommunityPost, CommunityUser } from '../types';
import { createDiscussion, createQuoteDiscussion, createThread, DiscussionSourceSnapshot } from '../lib/discussion';
import { MediaUploadButton } from './MediaUploadButton';
import { notifyToast } from '../lib/toast';
import { MentionTextarea } from './MentionAutocomplete';

export type DiscussionComposerMode = 'discussion' | 'quote' | 'remix' | 'thread';
interface Props {
  user: CommunityUser | null;
  mode?: DiscussionComposerMode;
  original?: CommunityPost | null;
  source?: DiscussionSourceSnapshot;
  initialTitle?: string;
  initialContent?: string;
  initialSelectedText?: string;
  initialSource?: DiscussionSourceSnapshot;
  communityId?: string;
  onClose: () => void;
  onCreated?: (postId: string) => void;
}

const maxTitle = 256;
const maxContent = 100000;

export const DiscussionComposer: React.FC<Props> = ({ user, mode = 'discussion', original, source, initialTitle = '', initialContent = '', initialSelectedText = '', initialSource, communityId, onClose, onCreated }) => {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [selectedText, setSelectedText] = useState(initialSelectedText);
  const [topics, setTopics] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [pollEnabled, setPollEnabled] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'community' | 'restricted'>('public');
  const [busy, setBusy] = useState(false);
  const [parts, setParts] = useState<Array<{ title: string; content: string; mediaUrls: string[] }>>([{ title: '', content: '', mediaUrls: [] }]);
  const [threadTopic, setThreadTopic] = useState('');
  const [threadCover, setThreadCover] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  const modeTitle = mode === 'thread' ? 'THREAD COMPOSER' : mode === 'quote' ? 'QUOTE' : mode === 'remix' ? 'REMIX' : 'START A DISCUSSION';
  const isQuote = mode === 'quote' || mode === 'remix';
  const validPollOptions = useMemo(() => pollOptions.map(x => x.trim()).filter(Boolean).slice(0, 8), [pollOptions]);

  const insert = (prefix: string, suffix = prefix) => {
    const target = textRef.current;
    const start = target?.selectionStart ?? content.length;
    const end = target?.selectionEnd ?? content.length;
    const value = content.slice(0, start) + prefix + content.slice(start, end) + suffix + content.slice(end);
    setContent(value.slice(0, maxContent));
    requestAnimationFrame(() => {
      target?.focus();
      const next = Math.min(value.length, start + prefix.length + Math.max(0, end - start));
      target?.setSelectionRange(next, next);
    });
  };

  const effectiveSource = initialSource || source;


  const addMedia = (url: string) => setMediaUrls(prev => Array.from(new Set([...prev, url])).slice(0, 6));
  const removeMedia = (url: string) => setMediaUrls(prev => prev.filter(x => x !== url));

  const updatePart = (index: number, patch: Partial<typeof parts[number]>) => setParts(prev => prev.map((p, i) => i === index ? { ...p, ...patch } : p));
  const addPart = () => setParts(prev => [...prev, { title: '', content: '', mediaUrls: [] }]);
  const removePart = (index: number) => setParts(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== index));
  const movePart = (from: number, to: number) => setParts(prev => { const next = [...prev]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; });

  const submit = async () => {
    if (!user) { notifyToast('Sign in to publish a discussion.', 'error'); return; }
    setBusy(true);
    try {
      if (mode === 'thread') {
        const validParts = parts.map(p => ({ ...p, title: p.title.trim(), content: p.content.trim(), mediaUrls: p.mediaUrls })).filter(p => p.content);
        if (!validParts.length) throw new Error('Add at least one thread part.');
        const result = await createThread({ user, parts: validParts, topic: threadTopic.trim(), coverImage: threadCover.trim() });
        notifyToast(`Thread published: ${result.length} parts.`, 'success');
        onCreated?.(result[0].id);
      } else if (isQuote) {
        if (!original) throw new Error('The original content is no longer available.');
        const quoteText = selectedText.trim() || original.quoteText || original.content.slice(0, 1200);
        const result = await createQuoteDiscussion({
          user,
          quoteText,
          commentary: content,
          original,
          source: effectiveSource,
        });
        notifyToast(mode === 'remix' ? 'Remix published.' : 'Quote published.', 'success');
        onCreated?.(result.id);
      } else {
        const result = await createDiscussion({
          user,
          title: title.trim(), content: content.trim(),
          topics: topics.split(',').map(x => x.trim()).filter(Boolean), mediaUrls,
          source: effectiveSource, visibility, communityId,
          poll: pollEnabled ? { question: pollQuestion.trim() || title.trim(), options: validPollOptions } : undefined,
        });
        notifyToast('Discussion published and synced to Firebase.', 'success');
        onCreated?.(result.id);
      }
      onClose();
    } catch (error: any) {
      notifyToast(error?.message || 'Could not publish discussion.', 'error');
    } finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-[250] bg-black/80 p-3 sm:p-6 grid place-items-center" role="dialog" aria-modal="true" aria-label={modeTitle}>
    <div className="w-full max-w-4xl max-h-[94vh] overflow-auto bg-white border-4 border-black neo-shadow-lg">
      <header className="sticky top-0 z-10 bg-[var(--color-primary)] border-b-4 border-black p-4 flex items-center justify-between gap-3">
        <div><div className="font-mono text-[9px] font-black uppercase">OFFSCRPT · V78</div><h2 className="font-display text-2xl font-black uppercase">{modeTitle}</h2></div>
        <button onClick={onClose} className="border-2 border-black bg-white p-2" aria-label="Close"><X /></button>
      </header>
      <div className="p-4 sm:p-6 space-y-5">
        {mode === 'thread' ? <>
          <div className="border-4 border-black p-4 bg-neutral-50 space-y-3">
            <input value={threadTopic} onChange={e => setThreadTopic(e.target.value)} placeholder="THREAD TOPIC / HEADLINE" maxLength={120} className="w-full border-2 border-black p-3 font-display font-black" />
            <div className="flex gap-2 items-center"><input value={threadCover} onChange={e => setThreadCover(e.target.value)} placeholder="THREAD COVER URL (optional)" className="flex-1 border-2 border-black p-2 font-mono text-xs" /><MediaUploadButton folder="posts" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" label="UPLOAD COVER" compact onUploaded={setThreadCover} /></div>
          </div>
          <div className="flex items-center justify-between gap-3"><div className="font-mono text-[10px] font-black uppercase">{parts.length} PARTS · DRAG/REORDER READY</div><button onClick={addPart} className="border-2 border-black bg-[var(--color-primary)] px-3 py-2 font-mono text-xs font-black"><Plus className="inline w-4 h-4"/> ADD PART</button></div>
          <div className="space-y-3">
            {parts.map((part, index) => <div key={index} draggable onDragStart={() => setDragIndex(index)} onDragOver={e => e.preventDefault()} onDrop={() => { if (dragIndex !== null && dragIndex !== index) movePart(dragIndex, index); setDragIndex(null); }} className="border-4 border-black bg-white p-4 space-y-3">
              <div className="flex items-center gap-2"><GripVertical className="shrink-0"/><div className="font-display font-black text-xl">{index + 1}/{parts.length}</div><input value={part.title} onChange={e=>updatePart(index,{title:e.target.value})} maxLength={maxTitle} placeholder={index === 0 ? 'THREAD TITLE' : 'PART TITLE (optional)'} className="flex-1 border-2 border-black p-2 font-bold"/>{parts.length>1&&<button onClick={()=>removePart(index)} className="border-2 border-black p-2 bg-red-100"><Trash2 className="w-4 h-4"/></button>}</div>
              <textarea value={part.content} onChange={e=>updatePart(index,{content:e.target.value})} maxLength={maxContent} placeholder={`Write part ${index+1}…`} className="w-full min-h-32 border-2 border-black p-3" />
              <div className="flex flex-wrap gap-2"><MediaUploadButton folder="posts" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" label="IMAGE" compact onUploaded={url=>updatePart(index,{mediaUrls:Array.from(new Set([...part.mediaUrls,url])).slice(0,6)})}/><MediaUploadButton folder="posts" accept="video/mp4,video/webm,video/quicktime" label="VIDEO" compact onUploaded={url=>updatePart(index,{mediaUrls:Array.from(new Set([...part.mediaUrls,url])).slice(0,6)})}/>{part.mediaUrls.map(url=><button key={url} onClick={()=>updatePart(index,{mediaUrls:part.mediaUrls.filter(x=>x!==url)})} className="border-2 border-black px-2 py-1 font-mono text-[9px] max-w-[240px] truncate" title={url}>REMOVE {url.split('/').pop()}</button>)}</div>
            </div>)}
          </div>
        </> : <>
          {!isQuote && <div className="grid gap-3">
            <input value={title} onChange={e=>setTitle(e.target.value)} maxLength={maxTitle} placeholder="DISCUSSION TITLE" className="w-full border-2 border-black p-3 font-display text-xl font-black" />
            <div className="font-mono text-[9px] text-neutral-500 text-right">{title.length}/{maxTitle}</div>
          </div>}
          {isQuote && original && <div className="border-4 border-black bg-neutral-50 p-4 space-y-3"><div className="font-mono text-[9px] font-black uppercase">{mode === 'remix' ? 'REMIX SOURCE' : 'QUOTED SOURCE'}</div><div className="font-display text-xl font-black uppercase">{original.title}</div><div className="text-sm whitespace-pre-wrap line-clamp-6">{original.content}</div>{selectedText && <div className="border-2 border-black bg-[var(--color-primary)] p-3 italic">“{selectedText}”</div>}</div>}
          {isQuote && <div className="flex gap-2 flex-wrap"><button type="button" onClick={()=>insert('**','**')} className="border-2 border-black px-2 py-1 font-mono text-xs font-black">B</button><button type="button" onClick={()=>insert('[','](https://)')} className="border-2 border-black px-2 py-1 font-mono text-xs">LINK</button><button type="button" onClick={()=>insert('> ','')} className="border-2 border-black px-2 py-1 font-mono text-xs">QUOTE</button></div>}
          {!isQuote && <div className="flex flex-wrap gap-2"><button type="button" onClick={()=>insert('**','**')} className="border-2 border-black px-2 py-1 font-mono text-xs font-black">B</button><button type="button" onClick={()=>insert('`','`')} className="border-2 border-black px-2 py-1 font-mono text-xs">CODE</button><button type="button" onClick={()=>insert('[','](https://)')} className="border-2 border-black px-2 py-1 font-mono text-xs">LINK</button><button type="button" onClick={()=>insert('> ','')} className="border-2 border-black px-2 py-1 font-mono text-xs">QUOTE</button></div>}
          <MentionTextarea textareaRef={textRef} value={content} setValue={setContent} placeholder={isQuote ? 'Add your take… Use @username to mention people.' : 'WHAT DO YOU THINK? Use @username to mention people.'} rows={10} maxLength={maxContent} className="w-full border-2 border-black p-3" />
          {!isQuote && <>
            <input value={topics} onChange={e=>setTopics(e.target.value)} placeholder="TOPICS / TAGS — comma separated" className="w-full border-2 border-black p-3 font-mono text-xs" />
            <div className="border-2 border-black bg-neutral-50 p-3 space-y-3"><div className="font-mono text-[10px] font-black uppercase">MEDIA</div><div className="flex flex-wrap gap-2"><MediaUploadButton folder="posts" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" label="IMAGE" compact onUploaded={addMedia}/><MediaUploadButton folder="posts" accept="video/mp4,video/webm,video/quicktime" label="VIDEO" compact onUploaded={addMedia}/><MediaUploadButton folder="attachments" accept="application/pdf" label="PDF" compact onUploaded={addMedia}/></div>{mediaUrls.length>0&&<div className="flex flex-wrap gap-2">{mediaUrls.map(url=><button key={url} onClick={()=>removeMedia(url)} className="border-2 border-black px-2 py-1 font-mono text-[9px] max-w-[260px] truncate">{url.split('/').pop()} ×</button>)}</div>}</div>
            <div className="grid sm:grid-cols-2 gap-3"><label className="border-2 border-black p-3 font-mono text-[10px] font-black uppercase">Visibility<select value={visibility} onChange={e=>setVisibility(e.target.value as any)} className="mt-2 w-full border-2 border-black p-2 font-mono"><option value="public">Public</option><option value="followers">Followers</option><option value="community">Community</option><option value="restricted">Restricted</option></select></label><label className="border-2 border-black p-3 font-mono text-[10px] font-black uppercase flex gap-2 items-start"><input type="checkbox" checked={pollEnabled} onChange={e=>setPollEnabled(e.target.checked)} /><span>ADD POLL<div className="font-normal text-neutral-500 mt-1">Live single/multi-choice conversation poll.</div></span></label></div>
            {pollEnabled && <div className="border-2 border-black p-3 space-y-2"><input value={pollQuestion} onChange={e=>setPollQuestion(e.target.value)} placeholder="POLL QUESTION" className="w-full border-2 border-black p-2" />{pollOptions.map((option,i)=><div key={i} className="flex gap-2"><input value={option} onChange={e=>setPollOptions(prev=>prev.map((x,j)=>j===i?e.target.value:x))} placeholder={`OPTION ${i+1}`} className="flex-1 border-2 border-black p-2" />{pollOptions.length>2&&<button onClick={()=>setPollOptions(prev=>prev.filter((_,j)=>j!==i))} className="border-2 border-black px-2">×</button>}</div>)}{pollOptions.length<8&&<button onClick={()=>setPollOptions(prev=>[...prev,''])} className="border-2 border-black px-3 py-2 font-mono text-[10px] font-black"><Plus className="inline w-3 h-3"/> OPTION</button>}</div>}
          </>}
        </>}
        <div className="flex flex-wrap justify-end gap-2 pt-2 border-t-2 border-black"><button onClick={onClose} className="border-2 border-black bg-white px-4 py-3 font-mono text-xs font-black">CANCEL</button><button disabled={busy} onClick={()=>void submit()} className="border-2 border-black bg-[var(--color-primary)] px-5 py-3 font-mono text-xs font-black shadow-[4px_4px_0_#000] disabled:opacity-50"><MessageSquare className="inline w-4 h-4"/> {busy ? 'PUBLISHING…' : mode === 'thread' ? `PUBLISH THREAD · ${parts.length} PARTS` : mode === 'remix' ? 'PUBLISH REMIX' : mode === 'quote' ? 'PUBLISH QUOTE' : 'PUBLISH DISCUSSION'}</button></div>
      </div>
    </div>
  </div>;
};
