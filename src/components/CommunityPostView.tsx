import { ReportButton } from './ReportButton';
import { ShareMenu } from './ShareMenu';
import { notifyToast } from '../lib/toast';
import { VerifiedBadge } from './VerifiedBadge';
import React, { useState, useEffect } from 'react';
import { CommunityPost, CommunityComment, PageView, CommunityUser } from '../types';
import { reportContent } from '../lib/social';
import { recordCommunityPostView, getPost, getComments, subscribeCommunityComments, addComment, toggleVote, getUserVote, deletePost, deleteComment, getCommunityProfile, updatePost, toggleRepost, getUserRepostStatus } from '../lib/community';
import { auth, loginWithGoogle, checkIsAdmin } from '../lib/firebase';
import { isPlatformModerator } from '../lib/social';
import { promoteCommunityBlogToMain, fetchAllArticlesForAdmin, unpublishMainArticle } from '../lib/cms';
import { ArrowLeft, MessageSquare, Sparkles, Loader2, User, Star, ArrowUp, ArrowDown, Bookmark, Trash, Repeat2, Quote, Share2, Pencil, X } from 'lucide-react';
import { formatDisplayDate } from '../lib/dateUtils';
import { CommunityPostExtras } from './CommunityPostExtras';
import { RichText } from './RichText';
import { MentionTextarea } from './MentionAutocomplete';
import { DiscussionPanel } from './DiscussionPanel';
import { DiscussionComposer, DiscussionComposerMode } from './DiscussionComposer';
import { PostMediaPreview } from './PostMediaPreview';
import { PollBlock } from './PollBlock';

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
  const [isReposted, setIsReposted] = useState(false);
  const [isReposting, setIsReposting] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isQuoteOpen, setIsQuoteOpen] = useState(false);
  const [quoteText, setQuoteText] = useState('');
  const [mainArticleStatus, setMainArticleStatus] = useState<'published'|'unpublished'|null>(null);
  const [discussionComposer, setDiscussionComposer] = useState<{mode: DiscussionComposerMode; selectedText?: string} | null>(null);
  
  const [commentInput, setCommentInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const effectiveIsSaved = propIsSaved !== undefined ? propIsSaved : localSaved;

  useEffect(() => { if (post?.id) void recordCommunityPostView(post.id, userAuth?.uid); }, [post?.id, userAuth?.uid]);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      setUserAuth(user);
      if (user) {
        const p = await getCommunityProfile(user.uid);
        setProfile(p);
        setIsModerator(!!user && await isPlatformModerator(user.uid));
        const v = await getUserVote(postId, user.uid);
        setVote(v);
        const savedIds = JSON.parse(localStorage.getItem('krishficient_saved_community_v1') || '[]');
        setLocalSaved(savedIds.includes(postId));
        setIsReposted(await getUserRepostStatus(postId, user.uid));
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
    let active = true;
    setLoading(true);
    getPost(postId).then(p => {
      if (active) setPost(p);
      if (active) setLoading(false);
    }).catch(error => {
      console.error(error);
      if (active) setLoading(false);
    });
    const unsubscribe = subscribeCommunityComments(postId, (cloudComments) => {
      if (active) setComments(cloudComments);
    });
    return () => { active = false; unsubscribe(); };
  }, [postId]);

  const activeUser = auth.currentUser || userAuth;
  const isAdmin = checkIsAdmin(activeUser?.email);

  useEffect(() => {
    let active = true;
    if (!isAdmin || !post?.type || post.type !== 'blog') { setMainArticleStatus(null); return; }
    (async () => {
      try {
        const articles = await fetchAllArticlesForAdmin();
        const a = articles.find((x:any) => x.sourcePostId === post.id || x.slug === (post as any).promotedToArticleSlug);
        if (active) setMainArticleStatus(a?.isPublished === false || a?.mainPublicationStatus === 'unpublished' ? 'unpublished' : a ? 'published' : null);
      } catch { if (active) setMainArticleStatus(null); }
    })();
    return () => { active = false; };
  }, [post?.id, post?.type, (post as any)?.promotedToArticleSlug, isAdmin]);

  const handlePublishOnMain = async () => {
    if (!post || !isAdmin || post.type !== 'blog') return;
    try {
      if (mainArticleStatus === 'published') {
        const articles = await fetchAllArticlesForAdmin();
        const a = articles.find((x:any) => x.sourcePostId === post.id || x.slug === (post as any).promotedToArticleSlug);
        if (a) await unpublishMainArticle(a);
        setMainArticleStatus('unpublished');
        notifyToast('Removed from the main publication. The creator blog remains intact.');
      } else {
        await promoteCommunityBlogToMain(post, true);
        setMainArticleStatus('published');
        notifyToast('Published on the main site with the original creator credited.');
      }
    } catch (e:any) { notifyToast(e?.message || 'Main publication action failed.'); }
  };

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

  const handleToggleRepost = async () => {
    if (!userAuth) { await loginWithGoogle(); return; }
    setIsReposting(true);
    try {
      const next = await toggleRepost(postId, userAuth.uid, isReposted);
      setIsReposted(next);
      if (post) setPost({ ...post, repostsCount: Math.max(0, (post.repostsCount || 0) + (next ? 1 : -1)) });
    } catch (e: any) { notifyToast('Failed to update repost: ' + (e?.message || 'Permission denied')); }
    finally { setIsReposting(false); }
  };


  const renderTextWithMentions = (text: string) => <RichText text={text} onMentionClick={(username) => onNavigate('community_profile', username)} />;

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: post?.title || 'OFFSCRPT post', text: post?.content?.slice(0, 140) || '', url });
      else { await navigator.clipboard.writeText(url); notifyToast('Link copied.'); }
    } catch (e) { if ((e as any)?.name !== 'AbortError') { try { await navigator.clipboard.writeText(url); notifyToast('Link copied.'); } catch (error) { console.warn('OFFSCRPT recoverable operation failed:', error); } } }
  };

  const openEdit = () => { if (!post) return; setEditTitle(post.title); setEditContent(post.content); setIsEditing(true); };
  const saveEdit = async () => {
    if (!post || !editTitle.trim() || !editContent.trim()) return;
    setIsSavingEdit(true);
    try { await updatePost(post.id, { title: editTitle.trim(), content: editContent.trim() }); setPost({ ...post, title: editTitle.trim(), content: editContent.trim(), editedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); setIsEditing(false); }
    catch (e: any) { notifyToast('Failed to edit post: ' + (e?.message || 'Permission denied')); } finally { setIsSavingEdit(false); }
  };

  const handleQuoteRepost = async () => {
    if (!userAuth) { await loginWithGoogle(); return; }
    if (!profile || !quoteText.trim() || !post) return;
    try {
      const { quoteRepost } = await import('../lib/community');
      const created = await quoteRepost(post.id, profile, quoteText);
      setQuoteText(''); setIsQuoteOpen(false);
      onNavigate('community_post', created.id);
    } catch (e: any) { notifyToast('Failed to quote repost: ' + (e?.message || 'Permission denied')); }
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

  const canDeletePost = !!activeUser && (!!post) && (activeUser.uid === post.authorId || isAdmin || isModerator);

  const handleDeletePost = async () => {
    if (!confirm('Are you sure you want to permanently delete this post from the database?')) return;
    try {
      await deletePost(postId);
      notifyToast('Post successfully deleted from the database and site!');
      onNavigate('community');
    } catch (e: any) {
      console.error(e);
      notifyToast('Failed to delete post: ' + (e?.message || 'Permission denied'));
    }
  };

  const handleDeleteComment = async (commentId: string, commentAuthorId: string) => {
    const activeUser = auth.currentUser || userAuth;
    const currentIsAdmin = checkIsAdmin(activeUser?.email);
    const canDeleteComment = activeUser && (activeUser.uid === commentAuthorId || currentIsAdmin || isModerator);
    if (!canDeleteComment) {
      notifyToast('You do not have permission to delete this comment.');
      return;
    }
    if (!confirm('Are you sure you want to permanently delete this comment?')) return;
    try {
      await deleteComment(postId, commentId);
      setComments(comments.filter(c => c.id !== commentId));
      if (post) setPost({ ...post, commentsCount: Math.max(0, post.commentsCount - 1) });
      notifyToast('Comment successfully deleted from database!');
    } catch (e: any) {
      console.error(e);
      notifyToast('Failed to delete comment: ' + (e?.message || 'Permission denied'));
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

  const handleReport = async () => {
    if (!profile || !post) { notifyToast('Sign in to report this post.'); return; }
    const reason = window.prompt('Reason for report?') || '';
    if (!reason.trim()) return;
    try { await reportContent(profile, 'post', post.id, reason); notifyToast('Report submitted to moderators.'); }
    catch (e:any) { notifyToast(e?.message || 'Failed to submit report.'); }
  };

  const handleToggleFeature = async () => {
    if (!post) return;
    try {
      await updatePost(post.id, { isFeatured: !post.isFeatured });
      setPost({ ...post, isFeatured: !post.isFeatured });
    } catch (e) {
      console.error(e);
      notifyToast('Failed to feature post');
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
    <div className="community-post-page w-full max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-8 sm:py-12 min-w-0 overflow-x-hidden">
      <button 
        onClick={() => onNavigate('community')}
        className="flex items-center space-x-2 font-mono text-xs font-bold uppercase mb-8 hover:text-[var(--color-primary)] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Community</span>
      </button>

      <div className="w-full min-w-0 bg-white border-4 border-black neo-shadow-lg p-4 sm:p-10 overflow-hidden">
        <div className="flex justify-between items-start mb-6 flex-wrap gap-2">
          <div className="inline-block px-3 py-1 bg-[var(--color-secondary)] border-2 border-black font-mono text-xs font-black uppercase">
            {post.type || (post as any).postType || 'discussion'}
          </div>
          {isAdmin && ((post.type || (post as any).postType) === 'blog') && (
            <button type="button" onClick={handlePublishOnMain} className="flex items-center space-x-1.5 px-3 py-1 border-2 border-black font-mono text-xs font-black uppercase bg-[var(--color-primary)]">
              {mainArticleStatus === 'published' ? 'UNPUBLISH FROM MAIN' : 'PUBLISH ON MAIN'}
            </button>
          )}
          {isAdmin && (
            <button 
              onClick={handleToggleFeature}
              className={`flex items-center space-x-1.5 px-3 py-1 border-2 border-black font-mono text-xs font-black uppercase transition-colors ${post.isFeatured ? 'bg-black text-white' : 'bg-white hover:bg-neutral-100 text-black'}`}
            >
              <Star className="w-3.5 h-3.5" />
              <span>{post.isFeatured ? 'Featured' : 'Feature'}</span>
            </button>
          )}
          {profile && !isAdmin && (
            <button onClick={handleReport} className="flex items-center space-x-1.5 px-3 py-1 border-2 border-black font-mono text-xs font-black uppercase bg-white hover:bg-neutral-100">REPORT</button>
          )}
        </div>
        
        <h1 className="font-display font-black text-3xl sm:text-5xl leading-tight mb-8 break-words [overflow-wrap:anywhere]">
          {post.title}
        </h1>

        <div className="flex items-center min-w-0 gap-3 sm:gap-4 mb-10 pb-8 border-b-4 border-black">
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
              <span className="inline-flex items-center gap-1">{post.authorName || `@${post.authorUsername}`} {(post as any).platformRole === 'master_admin' ? <span className="px-1 border border-black bg-[var(--color-primary)] font-mono text-[9px] font-black">MASTER</span> : (post as any).platformRole === 'moderator' ? <span className="px-1 border border-black bg-[var(--color-primary)] font-mono text-[9px] font-black">MOD</span> : null}<VerifiedBadge verified={post.isVerified} color={post.verificationColor} className="w-4 h-4" /></span>
            </button>
            <div className="font-mono text-xs text-neutral-500">
              @{post.authorUsername} &bull; {formatDisplayDate(post.createdAt)}{post.editedAt ? ' • edited' : ''}
            </div>
          </div>
        </div>

        {post.quoteText && (
          <div className="mb-6 border-2 border-black bg-[var(--color-primary)] p-4">
            <div className="font-mono text-[10px] font-black uppercase mb-2">Quote</div>
            <div className="font-sans text-base leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              {renderTextWithMentions(post.quoteText)}
            </div>
            {post.quotedPostId && (
              <button
                type="button"
                onClick={() => onNavigate('community_post', post.quotedPostId)}
                className="mt-3 font-mono text-xs font-bold underline uppercase"
              >
                View original post →
              </button>
            )}
          </div>
        )}
        {(post.coverImage || (post.mediaUrls||[]).length>0) && <figure className="mb-8"><PostMediaPreview post={post} showAll />{post.coverImageCaption && <figcaption className="font-mono text-[10px] text-neutral-500 mt-2">{post.coverImageCaption}</figcaption>}</figure>}
        {post.poll && <PollBlock poll={post.poll} postId={post.id} communityId={(post as any).communityId} userId={userAuth?.uid || undefined} />}
        {Array.isArray(post.contentBlocks) && post.contentBlocks.length ? (
          <div className="space-y-6 mb-12 min-w-0">
            {post.contentBlocks.map((block:any, idx:number) => {
              if (block.type === 'link') return <div key={idx}><a href={block.href || '#'} target={/^https?:/i.test(block.href || '') ? '_blank' : undefined} rel={/^https?:/i.test(block.href || '') ? 'noopener noreferrer' : undefined} className="inline-flex items-center gap-2 font-sans font-black underline decoration-2 underline-offset-4"><RichText text={block.linkText || block.content || block.href || 'OPEN LINK'} onMentionClick={(username) => onNavigate('community_profile', username)} /><span>↗</span></a></div>;
              if (block.type === 'button') return <div key={idx}><a href={block.href || '#'} target={/^https?:/i.test(block.href || '') ? '_blank' : undefined} rel={/^https?:/i.test(block.href || '') ? 'noopener noreferrer' : undefined} className={`inline-flex items-center gap-2 px-5 py-3 border-2 border-black font-display font-black uppercase ${block.buttonStyle === 'dark' ? 'bg-black text-white' : block.buttonStyle === 'secondary' ? 'bg-white text-black' : 'bg-[var(--color-primary)] text-black'}`}><RichText text={block.buttonText || block.content || 'OPEN LINK'} onMentionClick={(username) => onNavigate('community_profile', username)} /><span>↗</span></a></div>;
              if (block.type === 'video') {
                const rawUrl = String(block.videoUrl || '');
                let embedUrl = '';
                try {
                  const parsed = new URL(rawUrl);
                  if (parsed.hostname.includes('youtube.com')) { const id = parsed.searchParams.get('v'); if (id) embedUrl = `https://www.youtube.com/embed/${encodeURIComponent(id)}`; }
                  else if (parsed.hostname === 'youtu.be') { const id = parsed.pathname.replace(/^\//, '').split('/')[0]; if (id) embedUrl = `https://www.youtube.com/embed/${encodeURIComponent(id)}`; }
                  else if (parsed.hostname.includes('vimeo.com')) { const id = parsed.pathname.split('/').filter(Boolean)[0]; if (id) embedUrl = `https://player.vimeo.com/video/${encodeURIComponent(id)}`; }
                } catch (error) { console.warn('OFFSCRPT recoverable operation failed:', error); }
                return <figure key={idx} className="space-y-2">{embedUrl ? <div className="aspect-video w-full border-2 border-black bg-black"><iframe src={embedUrl} title={block.videoTitle || post.title} className="w-full h-full border-0" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div> : <video src={rawUrl} controls preload="metadata" className="w-full max-h-[620px] border-2 border-black" />}{block.videoCaption && <figcaption className="font-mono text-[10px] text-neutral-500"><RichText text={block.videoCaption} onMentionClick={(username) => onNavigate('community_profile', username)} /></figcaption>}</figure>;
              }
              if (block.type === 'image') return <figure key={idx} className="space-y-2">{block.imageHref ? <a href={block.imageHref} target={/^https?:/i.test(block.imageHref) ? '_blank' : undefined} rel={/^https?:/i.test(block.imageHref) ? 'noopener noreferrer' : undefined}><img src={block.imageUrl} alt={block.imageAlt || ''} className="w-full max-h-[620px] object-cover border-2 border-black"/></a> : <img src={block.imageUrl} alt={block.imageAlt || ''} className="w-full max-h-[620px] object-cover border-2 border-black"/>}{block.imageCaption && <figcaption className="font-mono text-[10px] text-neutral-500"><RichText text={block.imageCaption} onMentionClick={(username) => onNavigate('community_profile', username)} /></figcaption>}</figure>;
              if (block.type === 'code') return <pre key={idx} className="border-2 border-black bg-black text-white p-4 overflow-auto font-mono text-xs whitespace-pre"><code>{block.codeBlock?.code || ''}</code></pre>;
              if (block.type === 'quote') return <blockquote key={idx} className="border-l-8 border-black bg-[var(--color-primary)] p-4 font-serif text-lg italic">{renderTextWithMentions(block.content || '')}{block.quoteAuthor && <div className="font-mono text-[10px] not-italic mt-2">— {block.quoteAuthor}</div>}</blockquote>;
              if (block.type === 'callout') return <div key={idx} className="border-2 border-black bg-[var(--color-secondary)]/30 p-4"><div className="font-display font-black uppercase text-sm">{block.calloutTitle || block.calloutType || 'NOTE'}</div><div className="font-sans text-base leading-relaxed mt-2 whitespace-pre-wrap">{renderTextWithMentions(block.content || '')}</div></div>;
              if (block.type === 'list' || block.type === 'takeaways') return <div key={idx} className="border-2 border-black p-4"><div className="font-display font-black uppercase text-sm mb-2">{block.type === 'takeaways' ? 'Key Takeaways' : 'List'}</div><ul className="list-disc pl-6 space-y-1 font-sans text-base">{(block.items || []).filter(Boolean).map((item:string,j:number)=><li key={j}>{renderTextWithMentions(item)}</li>)}</ul></div>;
              if (block.type === 'heading2') return <h2 key={idx} className="font-display font-black text-2xl sm:text-3xl uppercase border-b-2 border-black pb-2"><RichText text={block.content || ''} onMentionClick={(username) => onNavigate('community_profile', username)} /></h2>;
              if (block.type === 'heading3') return <h3 key={idx} className="font-display font-black text-xl sm:text-2xl uppercase"><RichText text={block.content || ''} onMentionClick={(username) => onNavigate('community_profile', username)} /></h3>;
              return <p key={idx} className="font-sans text-lg leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-neutral-800">{renderTextWithMentions(block.content || '')}</p>;
            })}
          </div>
        ) : (
          <div className="font-sans text-lg leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-neutral-800 mb-12 min-w-0">
            {renderTextWithMentions(post.content)}
          </div>
        )}
        <div className="mb-10"><CommunityPostExtras post={post} onHashtag={(tag) => onNavigate('explore', tag)} showMedia={false} showPoll={false} /></div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-6 border-t-2 border-neutral-200 min-w-0">
          <div className="flex items-center space-x-2 shrink-0">
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
          <button onClick={handleToggleRepost} disabled={isReposting} className={`px-2 sm:px-3 py-2 border-2 border-black font-mono text-[10px] sm:text-xs font-black uppercase flex items-center gap-1.5 sm:gap-2 shrink-0 ${isReposted ? 'bg-[var(--color-primary)] shadow-[3px_3px_0_#000]' : 'bg-white hover:bg-[var(--color-primary)]'}`}><Repeat2 className="w-4 h-4" />{isReposted ? 'REPOSTED' : 'REPOST'} ({post.repostsCount || 0})</button>
          <button onClick={() => setDiscussionComposer({mode:'quote'})} className="px-2 sm:px-3 py-2 border-2 border-black font-mono text-[10px] sm:text-xs font-black uppercase flex items-center gap-1.5 shrink-0 hover:bg-neutral-100"><Quote className="w-4 h-4" />QUOTE</button>
          <button onClick={() => setDiscussionComposer({mode:'remix'})} disabled={(post as any).allowRemixes === false} className="px-2 sm:px-3 py-2 border-2 border-black font-mono text-[10px] sm:text-xs font-black uppercase flex items-center gap-1.5 shrink-0 hover:bg-neutral-100 disabled:opacity-40"><Repeat2 className="w-4 h-4" />REMIX</button>
          <ShareMenu target={{type:'post',slug:(post as any)?.slug || postId}} title={(post as any)?.title || 'OFFSCRPT post'} />
          <ReportButton targetType="post" targetId={postId} />

          {activeUser?.uid === post.authorId && <button onClick={openEdit} className="px-2 sm:px-3 py-2 border-2 border-black font-mono text-[10px] sm:text-xs font-black uppercase flex items-center gap-1.5 shrink-0 hover:bg-neutral-100"><Pencil className="w-4 h-4" />EDIT</button>}
          <button 
            onClick={handleToggleSave}
            className={`flex items-center space-x-2 font-mono text-xs sm:text-sm font-bold uppercase px-3 sm:px-4 py-2 border-2 border-black shrink-0 transition-colors ${effectiveIsSaved ? 'bg-[var(--color-secondary)] shadow-[3px_3px_0_#000]' : 'hover:bg-[var(--color-primary)]'}`}
          >
            <Bookmark className={`w-4 h-4 ${effectiveIsSaved ? 'fill-black' : ''}`} />
            <span>{effectiveIsSaved ? 'Saved' : 'Save'}</span>
          </button>
          {canDeletePost && (
            <button 
              onClick={handleDeletePost}
              className="flex items-center space-x-1 font-mono text-xs sm:text-sm font-bold uppercase px-3 sm:px-4 py-2 border-2 border-red-500 shrink-0 text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash className="w-4 h-4" />
              <span>Delete</span>
            </button>
          )}
          <div className="flex items-center space-x-2 font-mono text-xs sm:text-sm font-bold uppercase px-2 sm:px-4 py-2 text-neutral-600 shrink-0">
            <MessageSquare className="w-4 h-4" />
            <span>{Number(post.viewsCount || 0).toLocaleString()} Views</span><span>{post.commentsCount} Comments</span>
          </div>
        </div>
      </div>

      <DiscussionPanel
        post={post}
        user={profile}
        onNavigate={onNavigate}
        onQuote={(target, selectedText) => setDiscussionComposer({ mode: selectedText ? 'quote' : 'quote', selectedText })}
      />

      {isEditing && (
        <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white border-4 border-black neo-shadow-lg p-6">
            <div className="flex justify-between items-center mb-5"><h3 className="font-display font-black text-xl uppercase">Edit Post</h3><button onClick={() => setIsEditing(false)}><X /></button></div>
            <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full border-2 border-black p-3 mb-3 font-bold" maxLength={256}/>
            <textarea value={editContent} onChange={e => setEditContent(e.target.value)} className="w-full border-2 border-black p-3 min-h-[220px]"/>
            <button disabled={isSavingEdit} onClick={saveEdit} className="mt-4 px-5 py-3 bg-[var(--color-primary)] border-2 border-black font-black uppercase">{isSavingEdit ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </div>
      )}
      {discussionComposer && <DiscussionComposer
        user={profile}
        mode={discussionComposer.mode}
        original={post}
        initialSelectedText={discussionComposer.selectedText || ''}
        onClose={() => setDiscussionComposer(null)}
        onCreated={(id) => onNavigate('community_post', id)}
      />}
    </div>
  );
};
