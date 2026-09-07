import React, { useState, useEffect } from 'react';
import { CommunityPost, CommunityComment, PageView, CommunityUser } from '../types';
import { getPost, getComments, addComment, toggleVote, getUserVote, deletePost, deleteComment, getCommunityProfile, updatePost } from '../lib/community';
import { auth, loginWithGoogle, checkIsAdmin } from '../lib/firebase';
import { ArrowLeft, MessageSquare, Sparkles, Loader2, User, Star, ArrowUp, ArrowDown, Bookmark, Trash } from 'lucide-react';
import { formatDisplayDate } from '../lib/dateUtils';

interface CommunityPostViewProps {
  postId: string;
  onNavigate: (page: PageView, param?: string) => void;
  isSaved?: boolean;
  onToggleSave?: (postId: string, title?: string) => void;
}

export const CommunityPostView: React.FC<CommunityPostViewProps> = ({ 
  postId, 
  onNavigate,
  isSaved: propIsSaved,
  onToggleSave
}) => {
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [userAuth, setUserAuth] = useState(auth.currentUser);
  const [profile, setProfile] = useState<CommunityUser | null>(null);
  const [vote, setVote] = useState<'up' | 'down' | null>(null);
  const [localSaved, setLocalSaved] = useState(false);
  
  const [commentInput, setCommentInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const effectiveIsSaved = propIsSaved !== undefined ? propIsSaved : localSaved;

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      setUserAuth(user);
      if (user) {
        const p = await getCommunityProfile(user.uid);
        setProfile(p);
        const v = await getUserVote(postId, user.uid);
        setVote(v);
        const savedIds = JSON.parse(localStorage.getItem('krishficient_saved_community_v1') || '[]');
        setLocalSaved(savedIds.includes(postId));
      } else {
        setProfile(null);
        setVote(null);
        const savedIds = JSON.parse(localStorage.getItem('krishficient_saved_community_v1') || '[]');
        setLocalSaved(savedIds.includes(postId));
      }
    });
    return () => unsub();
  }, [postId]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const p = await getPost(postId);
      setPost(p);
      if (p) {
        const c = await getComments(postId);
        setComments(c);
      }
      setLoading(false);
    };
    fetchData();
  }, [postId]);

  const handleVote = async (voteType: 'up' | 'down') => {
    if (!userAuth) {
      await loginWithGoogle();
      return;
    }
    if (!post) return;
    try {
      const res = await toggleVote(postId, userAuth.uid, post.upvotesCount, post.downvotesCount, voteType, vote);
      setVote(res.vote);
      setPost({ ...post, upvotesCount: res.upvotesCount, downvotesCount: res.downvotesCount });
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleSave = () => {
    if (onToggleSave) {
      onToggleSave(postId, post?.title);
      setLocalSaved(!effectiveIsSaved);
    } else {
      const savedIds = JSON.parse(localStorage.getItem('krishficient_saved_community_v1') || '[]');
      let newIds = [];
      if (savedIds.includes(postId)) {
        newIds = savedIds.filter((id: string) => id !== postId);
        setLocalSaved(false);
      } else {
        newIds = [...savedIds, postId];
        setLocalSaved(true);
      }
      localStorage.setItem('krishficient_saved_community_v1', JSON.stringify(newIds));
    }
  };

  const activeUser = auth.currentUser || userAuth;
  const isAdmin = checkIsAdmin(activeUser?.email);
  const canDeletePost = activeUser && (activeUser.uid === post?.authorId || isAdmin);

  const handleDeletePost = async () => {
    if (!confirm('Are you sure you want to permanently delete this post from the database?')) return;
    try {
      await deletePost(postId);
      alert('Post successfully deleted from the database and site!');
      onNavigate('community');
    } catch (e: any) {
      console.error(e);
      alert('Failed to delete post: ' + (e?.message || 'Permission denied'));
    }
  };

  const handleDeleteComment = async (commentId: string, commentAuthorId: string) => {
    const activeUser = auth.currentUser || userAuth;
    const currentIsAdmin = checkIsAdmin(activeUser?.email);
    const canDeleteComment = activeUser && (activeUser.uid === commentAuthorId || currentIsAdmin);
    if (!canDeleteComment) {
      alert('You do not have permission to delete this comment.');
      return;
    }
    if (!confirm('Are you sure you want to permanently delete this comment?')) return;
    try {
      await deleteComment(postId, commentId);
      setComments(comments.filter(c => c.id !== commentId));
      if (post) setPost({ ...post, commentsCount: Math.max(0, post.commentsCount - 1) });
      alert('Comment successfully deleted from database!');
    } catch (e: any) {
      console.error(e);
      alert('Failed to delete comment: ' + (e?.message || 'Permission denied'));
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !post || !commentInput.trim()) return;
    setIsSubmitting(true);
    try {
      const c = await addComment(postId, post.commentsCount, {
        authorId: profile.uid,
        authorUsername: profile.username,
        authorName: profile.displayName,
        authorAvatar: profile.photoURL,
        content: commentInput
      });
      setComments([...comments, c]);
      setPost({ ...post, commentsCount: post.commentsCount + 1 });
      setCommentInput('');
    } catch (e) {
      console.error(e);
    }
    setIsSubmitting(false);
  };

  const handleToggleFeature = async () => {
    if (!post) return;
    try {
      await updatePost(post.id, { isFeatured: !post.isFeatured });
      setPost({ ...post, isFeatured: !post.isFeatured });
    } catch (e) {
      console.error(e);
      alert('Failed to feature post');
    }
  };

  if (loading) {
    return (
      <div className="py-32 flex justify-center">
        <Loader2 className="w-10 h-10 animate-spin" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="py-32 text-center">
        <h2 className="font-display font-black text-2xl uppercase">Post not found</h2>
        <button onClick={() => onNavigate('community')} className="mt-4 px-6 py-2 bg-black text-white font-mono text-xs uppercase">Back to Community</button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <button 
        onClick={() => onNavigate('community')}
        className="flex items-center space-x-2 font-mono text-xs font-bold uppercase mb-8 hover:text-[var(--color-primary)] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Community</span>
      </button>

      <div className="bg-white border-4 border-black neo-shadow-lg p-6 sm:p-10">
        <div className="flex justify-between items-start mb-6">
          <div className="inline-block px-3 py-1 bg-[var(--color-secondary)] border-2 border-black font-mono text-xs font-black uppercase">
            {post.type}
          </div>
          {isAdmin && (
            <button 
              onClick={handleToggleFeature}
              className={`flex items-center space-x-1.5 px-3 py-1 border-2 border-black font-mono text-xs font-black uppercase transition-colors ${post.isFeatured ? 'bg-black text-white' : 'bg-white hover:bg-neutral-100 text-black'}`}
            >
              <Star className="w-3.5 h-3.5" />
              <span>{post.isFeatured ? 'Featured' : 'Feature'}</span>
            </button>
          )}
        </div>
        
        <h1 className="font-display font-black text-4xl sm:text-5xl leading-tight mb-8">
          {post.title}
        </h1>

        <div className="flex items-center space-x-4 mb-10 pb-8 border-b-4 border-black">
          <button onClick={() => onNavigate('community_profile', post.authorUsername)}>
            {post.authorAvatar ? (
              <img src={post.authorAvatar} alt="" className="w-12 h-12 rounded-full border-2 border-black" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-neutral-200 border-2 border-black flex items-center justify-center">
                <User className="w-6 h-6" />
              </div>
            )}
          </button>
          <div>
            <button 
              onClick={() => onNavigate('community_profile', post.authorUsername)}
              className="font-display font-black text-lg hover:underline"
            >
              {post.authorName || `@${post.authorUsername}`}
            </button>
            <div className="font-mono text-xs text-neutral-500">
              @{post.authorUsername} &bull; {formatDisplayDate(post.createdAt)}
            </div>
          </div>
        </div>

        <div className="font-sans text-lg leading-relaxed whitespace-pre-wrap text-neutral-800 mb-12">
          {post.content}
        </div>

        <div className="flex items-center space-x-6 pt-6 border-t-2 border-neutral-200">
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => handleVote('up')}
              className={`flex items-center space-x-1 font-mono text-sm font-bold uppercase px-3 py-2 border-2 border-black transition-colors ${vote === 'up' ? 'bg-[var(--color-primary)]' : 'hover:bg-neutral-100'}`}
            >
              <ArrowUp className="w-4 h-4" />
              <span>{post.upvotesCount}</span>
            </button>
            <button 
              onClick={() => handleVote('down')}
              className={`flex items-center space-x-1 font-mono text-sm font-bold uppercase px-3 py-2 border-2 border-black transition-colors ${vote === 'down' ? 'bg-black text-white' : 'hover:bg-neutral-100'}`}
            >
              <ArrowDown className="w-4 h-4" />
              <span>{post.downvotesCount}</span>
            </button>
          </div>
          <button 
            onClick={handleToggleSave}
            className={`flex items-center space-x-2 font-mono text-sm font-bold uppercase px-4 py-2 border-2 border-black transition-colors ${effectiveIsSaved ? 'bg-[var(--color-secondary)]' : 'hover:bg-neutral-100'}`}
          >
            <Bookmark className={`w-4 h-4 ${effectiveIsSaved ? 'fill-black' : ''}`} />
            <span>{effectiveIsSaved ? 'Saved' : 'Save'}</span>
          </button>
          {canDeletePost && (
            <button 
              onClick={handleDeletePost}
              className="ml-auto flex items-center space-x-1 font-mono text-sm font-bold uppercase px-4 py-2 border-2 border-red-500 text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash className="w-4 h-4" />
              <span>Delete</span>
            </button>
          )}
          <div className="flex items-center space-x-2 font-mono text-sm font-bold uppercase px-4 py-2 text-neutral-600">
            <MessageSquare className="w-4 h-4" />
            <span>{post.commentsCount} Comments</span>
          </div>
        </div>
      </div>

      <div className="mt-12 bg-white border-4 border-black neo-shadow p-6 sm:p-10">
        <h3 className="font-display font-black text-2xl uppercase mb-6">Discussion</h3>
        
        {!profile ? (
          <div className="bg-neutral-100 p-6 border-2 border-black text-center mb-8">
            <p className="font-mono text-sm mb-4">Join the community to participate in this discussion.</p>
            <button 
              onClick={() => loginWithGoogle()}
              className="px-6 py-2 bg-black text-white font-display font-bold uppercase text-xs"
            >
              Log in to Comment
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmitComment} className="mb-8 space-y-4">
            <textarea 
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder="Add to the discussion..."
              className="w-full px-4 py-3 border-2 border-black font-sans text-sm min-h-[100px] focus:outline-none focus:bg-neutral-50"
              required
            />
            <button 
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-[var(--color-secondary)] border-2 border-black font-display font-black text-sm uppercase neo-shadow-sm hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Posting...' : 'Post Comment'}
            </button>
          </form>
        )}

        <div className="space-y-6">
          {comments.map(c => (
            <div key={c.id} className="pb-6 border-b-2 border-neutral-100 last:border-0 last:pb-0">
              <div className="flex items-center space-x-3 mb-2">
                <button onClick={() => onNavigate('community_profile', c.authorUsername)}>
                  {c.authorAvatar ? (
                    <img src={c.authorAvatar} alt="" className="w-8 h-8 rounded-full border border-black" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-neutral-200 border border-black" />
                  )}
                </button>
                <div className="font-mono text-xs">
                  <button onClick={() => onNavigate('community_profile', c.authorUsername)} className="font-bold hover:underline text-black">
                    {c.authorName || `@${c.authorUsername}`}
                  </button>
                  <span className="text-neutral-500 ml-2">{formatDisplayDate(c.createdAt)}</span>
                </div>
                {(isAdmin || (userAuth && userAuth.uid === c.authorId)) && (
                  <button onClick={() => handleDeleteComment(c.id, c.authorId)} className="ml-auto text-red-500 hover:text-red-700" title="Delete comment">
                    <Trash className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="font-sans text-sm text-neutral-800 whitespace-pre-wrap ml-11">
                {c.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
