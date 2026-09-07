import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, Clock, Trash2, LogIn } from 'lucide-react';
import { auth, loginWithGoogle, checkIsAdmin } from '../lib/firebase';
import { subscribeArticleComments, addArticleComment, deleteArticleComment } from '../lib/cms';
import { ArticleComment } from '../types';
import { formatDisplayDate } from '../lib/dateUtils';

interface CommentsSectionProps {
  articleSlug: string;
}

export const CommentsSection: React.FC<CommentsSectionProps> = ({ articleSlug }) => {
  const [comments, setComments] = useState<ArticleComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync auth state
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return () => unsubAuth();
  }, []);

  // Real-time Firestore subscription for article comments
  useEffect(() => {
    if (!articleSlug) return;
    const unsubscribe = subscribeArticleComments(articleSlug, (fetched) => {
      setComments(fetched);
    });
    return () => unsubscribe();
  }, [articleSlug]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error("Sign-in failed:", err);
      setError("Google authentication failed. Please try again.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    if (!currentUser) {
      setError("Please sign in to post a comment.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await addArticleComment(articleSlug, {
        authorId: currentUser.uid,
        authorName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Architect',
        authorAvatar: currentUser.photoURL || '',
        authorUsername: currentUser.email?.split('@')[0] || '',
        content: newComment.trim()
      });
      setNewComment('');
    } catch (err: any) {
      console.error("Failed to post comment to Firestore:", err);
      setError(err.message || "Failed to post comment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm("Are you sure you want to delete this comment?")) return;
    try {
      await deleteArticleComment(articleSlug, commentId);
    } catch (err: any) {
      console.error("Failed to delete comment:", err);
      alert("Failed to delete comment: " + (err.message || "Permission denied"));
    }
  };

  const isAdmin = checkIsAdmin(currentUser?.email);

  return (
    <div className="pt-10 border-t-4 border-black mt-16 space-y-8">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-[var(--color-primary)] neo-border flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-black stroke-[2.5]" />
        </div>
        <h3 className="font-display font-black text-3xl uppercase tracking-tight text-black">
          DISCUSSION ({comments.length})
        </h3>
      </div>

      {/* Comment Form or Sign-in Prompt */}
      <div className="bg-gray-50 neo-border neo-shadow-sm p-6">
        <h4 className="font-mono text-sm font-bold uppercase mb-4 text-black border-b-2 border-black pb-2 inline-block">
          JOIN THE ARCHITECTURAL DISCUSSION
        </h4>

        {currentUser ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center space-x-3 bg-white p-2.5 neo-border-2 w-fit">
              {currentUser.photoURL ? (
                <img 
                  src={currentUser.photoURL} 
                  alt={currentUser.displayName || 'Avatar'} 
                  className="w-7 h-7 rounded-full border border-black"
                />
              ) : (
                <div className="w-7 h-7 bg-black text-white font-display font-black text-xs flex items-center justify-center">
                  {(currentUser.displayName || currentUser.email || 'A').charAt(0).toUpperCase()}
                </div>
              )}
              <span className="font-mono text-xs font-bold text-black uppercase">
                Commenting as: <span className="text-[var(--color-primary)] bg-black px-1.5 py-0.5 ml-1">{currentUser.displayName || currentUser.email}</span>
              </span>
            </div>

            <div>
              <label className="block font-mono text-xs font-bold text-neutral-600 uppercase mb-1">
                COMMENT
              </label>
              <textarea
                required
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Share your thoughts, architectural counter-arguments, or production metrics..."
                rows={4}
                maxLength={2000}
                className="w-full px-4 py-3 bg-white neo-border-2 font-sans font-medium text-black focus:outline-none focus:bg-[var(--color-primary)]/10 resize-y"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-100 border-2 border-red-600 font-mono text-xs text-red-800 font-bold">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !newComment.trim()}
              className="px-6 py-3 bg-black text-white font-display font-black text-sm uppercase neo-border neo-shadow-sm hover:bg-[var(--color-success)] hover:text-black active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <span>{isSubmitting ? 'POSTING TO FIRESTORE...' : 'POST COMMENT'}</span>
              <Send className="w-4 h-4 stroke-[3]" />
            </button>
          </form>
        ) : (
          <div className="bg-white neo-border-2 p-6 text-center space-y-3">
            <p className="font-mono text-xs text-neutral-600 uppercase font-bold">
              Authentication required to participate in engineering discussions and prevent spam.
            </p>
            {error && (
              <div className="p-2 bg-red-100 border border-red-500 font-mono text-xs text-red-800">
                {error}
              </div>
            )}
            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="px-6 py-3 bg-[var(--color-primary)] text-black font-display font-black text-sm uppercase neo-border neo-shadow-sm hover:bg-[var(--color-secondary)] active:translate-x-1 active:translate-y-1 transition-all inline-flex items-center space-x-2 disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              <span>{isLoggingIn ? 'CONNECTING...' : 'SIGN IN WITH GOOGLE TO COMMENT'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Real-time Comments List */}
      <div className="space-y-6">
        {comments.length === 0 ? (
          <div className="py-8 text-center text-neutral-500 font-mono text-sm border-2 border-dashed border-neutral-300">
            NO COMMENTS YET. BE THE FIRST TO CONTRIBUTE TO THIS THREAD.
          </div>
        ) : (
          comments.map((comment) => {
            const isAuthor = currentUser?.uid === comment.authorId;
            const canDelete = isAuthor || isAdmin;

            return (
              <div key={comment.id} className="bg-white neo-border p-5">
                <div className="flex items-center justify-between mb-3 border-b-2 border-neutral-100 pb-2">
                  <div className="flex items-center space-x-2">
                    {comment.authorAvatar ? (
                      <img 
                        src={comment.authorAvatar} 
                        alt={comment.authorName} 
                        className="w-8 h-8 rounded-full border border-black" 
                      />
                    ) : (
                      <div className="w-8 h-8 bg-black text-white neo-border-2 flex items-center justify-center font-display font-black text-sm uppercase">
                        {comment.authorName.charAt(0)}
                      </div>
                    )}
                    <div>
                      <span className="font-display font-black text-sm uppercase text-black">
                        {comment.authorName}
                      </span>
                      {comment.authorUsername && (
                        <span className="text-neutral-500 font-mono text-xs ml-1.5">
                          @{comment.authorUsername}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1 text-neutral-500 font-mono text-[10px] font-bold uppercase">
                      <Clock className="w-3 h-3" />
                      <span>{formatDisplayDate(comment.createdAt)}</span>
                    </div>

                    {canDelete && (
                      <button
                        onClick={() => handleDelete(comment.id)}
                        title="Delete comment"
                        className="text-neutral-400 hover:text-red-600 transition-colors p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <p className="font-serif text-base text-neutral-800 leading-relaxed whitespace-pre-wrap">
                  {comment.content}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
