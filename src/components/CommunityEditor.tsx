import React, { useState, useEffect } from 'react';
import { CommunityUser, CommunityPost } from '../types';
import { createPost, getCommunityDraft, saveCommunityDraft, clearCommunityDraft } from '../lib/community';
import { X, Send, Loader2, BookOpen, MessageSquare, AtSign, Info, WifiOff } from 'lucide-react';
import { getDraftSnapshot, saveDraftSnapshot, deleteDraftSnapshot } from '../lib/account';
import { MentionTextarea } from './MentionAutocomplete';

interface CommunityEditorProps {
  profile: CommunityUser;
  defaultType: 'discussion' | 'blog';
  onClose: () => void;
  onPublished: (post: CommunityPost) => void;
}

export const CommunityEditor: React.FC<CommunityEditorProps> = ({ 
  profile, 
  defaultType, 
  onClose, 
  onPublished 
}) => {
  const [type, setType] = useState<'discussion' | 'blog'>(defaultType);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mediaInput, setMediaInput] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [syncState, setSyncState] = useState<'synced' | 'saving' | 'offline' | 'failed'>('synced');
  const localDraftKey = `offscrpt:draft:community:${profile.uid}`;

  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      try {
        const raw = localStorage.getItem(localDraftKey);
        const local = raw ? JSON.parse(raw) : null;
        const [cloud, legacy] = await Promise.all([getDraftSnapshot<any>('community-editor'), getCommunityDraft(profile.uid)]);
        const draft = cloud || legacy || local;
        if (!cancelled && draft) {
          setType(draft.type || defaultType);
          setTitle(draft.title || '');
          setContent(draft.content || '');
          setMediaInput(draft.mediaInput || (draft.mediaUrls || []).join('\n'));
        }
      } catch {}
      finally { if (!cancelled) setDraftLoaded(true); }
    };
    void restore();
    return () => { cancelled = true; };
  }, [profile.uid, defaultType, localDraftKey]);

  useEffect(() => {
    if (!draftLoaded || (!title.trim() && !content.trim())) return;
    const payload = { type, title, content, mediaInput, mediaUrls: mediaInput.split('\n').map(v => v.trim()).filter(Boolean).slice(0, 6) };
    try { localStorage.setItem(localDraftKey, JSON.stringify(payload)); } catch {}
    setSyncState(navigator.onLine?'saving':'offline');
    const timer = window.setTimeout(() => {
      Promise.all([saveCommunityDraft(profile.uid, { type, title, content, mediaUrls: payload.mediaUrls }), saveDraftSnapshot('community-editor', payload)])
        .then(()=>setSyncState('synced')).catch(()=>setSyncState('failed'));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [draftLoaded, profile.uid, localDraftKey, type, title, content, mediaInput]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setErrorMessage('Please provide both a title and content.');
      return;
    }

    setIsPublishing(true);
    setErrorMessage('');
    try {
      const post = await createPost({
        type,
        title: title.trim(),
        content: content.trim(),
        authorId: profile.uid,
        authorUsername: profile.username,
        authorName: profile.displayName || profile.username,
        authorAvatar: profile.photoURL || '',
        isVerified: !!profile.isVerified,
        verificationColor: profile.verificationColor || '#2196F3',
        mediaUrls: mediaInput.split('\n').map(v => v.trim()).filter(Boolean).slice(0, 6)
      });
      await clearCommunityDraft(profile.uid).catch(() => {});
      await deleteDraftSnapshot('community-editor').catch(() => {});
      try { localStorage.removeItem(localDraftKey); } catch {}
      onPublished(post);
    } catch (error) {
      console.error(error);
      setErrorMessage('Failed to publish. Please check your connection and try again.');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-10 p-4 sm:p-6 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-3xl bg-white border-4 border-black neo-shadow-lg my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-[var(--color-primary)] px-6 py-4 border-b-4 border-black flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h2 className="font-display font-black text-xl uppercase tracking-tight text-black">
              {type === 'blog' ? 'Publish Community Blog' : 'Start Community Discussion'}
            </h2>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 bg-white border-2 border-black hover:bg-black hover:text-white transition-colors"
            title="Close editor (Esc)"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Identity & Scope Notice */}
        <div className="bg-neutral-100 px-6 py-3 border-b-2 border-black flex flex-wrap items-center justify-between text-xs font-mono gap-2">
          <div className="flex items-center space-x-2">
            <span className="text-neutral-500">AUTHOR:</span>
            <span className="font-bold text-black flex items-center space-x-1">
              {profile.photoURL ? (
                <img src={profile.photoURL} alt="" className="w-4 h-4 rounded-full border border-black inline-block" />
              ) : (
                <AtSign className="w-3.5 h-3.5" />
              )}
              <span>@{profile.username}</span>
            </span>
          </div>
          <div className="text-neutral-600 flex items-center gap-2"><span>{syncState==='saving'?'⟳ SAVING...':syncState==='offline'?'⚠ OFFLINE · SAVED LOCALLY':syncState==='failed'?'! SYNC FAILED · RETRY':'● CLOUD SYNCED'}</span> · use @handle to mention someone</div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          {/* Format Selector */}
          <div>
            <label className="block font-mono text-xs font-bold uppercase mb-2">
              Post Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType('blog')}
                className={`p-3 border-2 border-black font-display font-bold text-xs uppercase flex items-center justify-center space-x-2 transition-all ${
                  type === 'blog' 
                    ? 'bg-[var(--color-accent)] text-black neo-shadow-sm font-black' 
                    : 'bg-white hover:bg-neutral-50 text-neutral-700'
                }`}
              >
                <BookOpen className="w-4 h-4 stroke-[2.5]" />
                <span>Community Blog (Article)</span>
              </button>
              
              <button
                type="button"
                onClick={() => setType('discussion')}
                className={`p-3 border-2 border-black font-display font-bold text-xs uppercase flex items-center justify-center space-x-2 transition-all ${
                  type === 'discussion' 
                    ? 'bg-[var(--color-secondary)] text-black neo-shadow-sm font-black' 
                    : 'bg-white hover:bg-neutral-50 text-neutral-700'
                }`}
              >
                <MessageSquare className="w-4 h-4 stroke-[2.5]" />
                <span>Quick Discussion</span>
              </button>
            </div>
          </div>

          {/* Title Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-mono text-xs font-bold uppercase">
                {type === 'blog' ? 'Blog Title' : 'Discussion Topic'}
              </label>
              <span className="font-mono text-[11px] text-neutral-500">{title.length}/256</span>
            </div>
            <input 
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={type === 'blog' ? "e.g., Implementing Distributed Rate Limiting in Go" : "e.g., What are your thoughts on React 19 Actions?"}
              className="w-full px-4 py-3 border-2 border-black font-display font-bold text-lg sm:text-xl focus:outline-none focus:bg-neutral-50"
              required
              maxLength={256}
            />
          </div>

          {/* Content Body */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-mono text-xs font-bold uppercase">Content</label>
              <span className="font-mono text-[11px] text-neutral-500">{content.length} characters</span>
            </div>
            <MentionTextarea value={content} setValue={setContent} placeholder={type === 'blog' ? 'Write your full engineering write-up here. Use @handle to mention someone...' : 'Share your thoughts, ask technical questions, or propose a debate topic...'} rows={10} className="w-full px-4 py-3 border-2 border-black font-sans text-sm sm:text-base min-h-[260px] focus:outline-none focus:bg-neutral-50 leading-relaxed" required />
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-100 border-2 border-red-500 font-mono text-xs text-red-800">
              {errorMessage}
            </div>
          )}

          {/* Media URLs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-mono text-xs font-bold uppercase">Media / Image URLs</label>
              <span className="font-mono text-[11px] text-neutral-500">Up to 6 · one URL per line</span>
            </div>
            <textarea
              value={mediaInput}
              onChange={(e) => setMediaInput(e.target.value)}
              placeholder="https://example.com/image.jpg
https://example.com/diagram.png"
              className="w-full px-4 py-3 border-2 border-black font-mono text-xs min-h-[100px] focus:outline-none focus:bg-neutral-50"
            />
            <p className="font-mono text-[10px] text-neutral-500">External image URLs only. OFFSCRPT does not upload files to Firebase Storage.</p>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-between border-t-2 border-black">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-mono text-xs font-bold uppercase border-2 border-neutral-300 hover:border-black transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isPublishing || !title.trim() || !content.trim()}
              className="px-6 py-3 bg-[var(--color-primary)] font-display font-black text-sm uppercase border-2 border-black neo-shadow-sm hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all flex items-center space-x-2 disabled:opacity-50 disabled:pointer-events-none text-black"
            >
              {isPublishing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Publishing...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 stroke-[2.5]" />
                  <span>Publish {type === 'blog' ? 'Blog Article' : 'Discussion'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
