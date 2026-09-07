import React, { useState } from 'react';
import { CommunityUser, CommunityPost } from '../types';
import { createPost } from '../lib/community';
import { X, Send, Loader2, BookOpen, MessageSquare, AtSign, Info } from 'lucide-react';

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
  const [isPublishing, setIsPublishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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
        authorAvatar: profile.photoURL || ''
      });
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
          <div className="text-neutral-600">
            Posting in Community feed
          </div>
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
            <textarea 
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                type === 'blog' 
                  ? "Write your full engineering write-up here. Break it down with sections, code insights, and key architecture takeaways..."
                  : "Share your thoughts, ask technical questions, or propose a debate topic for the community..."
              }
              className="w-full px-4 py-3 border-2 border-black font-sans text-sm sm:text-base min-h-[260px] focus:outline-none focus:bg-neutral-50 leading-relaxed"
              required
            />
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-100 border-2 border-red-500 font-mono text-xs text-red-800">
              {errorMessage}
            </div>
          )}

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
