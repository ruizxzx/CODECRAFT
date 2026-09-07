import { VerifiedBadge } from './VerifiedBadge';
import React, { useState, useEffect } from 'react';
import { CommunityUser, CommunityPost, PageView } from '../types';
import { getProfileByUsername, getCommunityProfile, getUserPosts, updateCommunityProfile, checkIsFollowing, followUser, unfollowUser, deletePost, getUserUpvotedPosts, getUserRepostedPosts, getUserComments } from '../lib/community';
import { auth, checkIsAdmin } from '../lib/firebase';
import { updateProfile } from 'firebase/auth';
import { fetchArticles } from '../lib/cms';
import { syncUserIdentityAcrossContent } from '../lib/community';
import { ArrowLeft, User, Sparkles, Settings, UserPlus, UserMinus, Loader2, Trash, ArrowUp, Repeat2, MessageSquare, FileText, Camera } from 'lucide-react';

interface CommunityProfileViewProps {
  username: string;
  onNavigate: (page: PageView, param?: string) => void;
  currentUserProfile?: CommunityUser | null;
}

type ProfileTab = 'articles' | 'posts' | 'upvotes' | 'reposts' | 'comments';

export const CommunityProfileView: React.FC<CommunityProfileViewProps> = ({ username, onNavigate, currentUserProfile }) => {
  const [profile, setProfile] = useState<CommunityUser | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [upvotedPosts, setUpvotedPosts] = useState<CommunityPost[]>([]);
  const [repostedPosts, setRepostedPosts] = useState<CommunityPost[]>([]);
  const [comments, setComments] = useState<Array<{ id: string; content: string; createdAt: string; postId?: string; articleSlug?: string; authorName: string }>>([]);
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [bioInput, setBioInput] = useState('');
  const [themeInput, setThemeInput] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [userAuth, setUserAuth] = useState(auth.currentUser);

  useEffect(() => auth.onAuthStateChanged(setUserAuth), []);
  const activeUser = auth.currentUser || userAuth;
  const isOwner = !!activeUser && !!profile && activeUser.uid === profile.uid;
  const isAdmin = checkIsAdmin(activeUser?.email);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const p = await getProfileByUsername(username);
        if (cancelled) return;
        setProfile(p);
        if (!p) return;
        setBioInput(p.bio || '');
        setThemeInput(p.themeColor || '#000000');
        setPhotoUrlInput(p.photoURL || '');
        const [allArticles, userPosts, ups, reps, userComments] = await Promise.all([
          fetchArticles(),
          getUserPosts(p.uid, p.username),
          getUserUpvotedPosts(p.uid),
          getUserRepostedPosts(p.uid),
          getUserComments(p.uid)
        ]);
        if (cancelled) return;
        setArticles(allArticles.articles.filter((a: any) => a.author?.uid === p.uid || a.author?.username === p.username));
        setPosts(userPosts);
        setUpvotedPosts(ups);
        setRepostedPosts(reps);
        setComments(userComments);
        if (auth.currentUser && auth.currentUser.uid !== p.uid) {
          setIsFollowing(await checkIsFollowing(auth.currentUser.uid, p.uid));
        } else setIsFollowing(false);
      } catch (error) {
        console.error('Failed to load profile activity:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [username]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !activeUser || activeUser.uid !== profile.uid) return;
    try {
      const nextPhotoURL = photoUrlInput.trim();
      if (nextPhotoURL && !/^https?:\/\//i.test(nextPhotoURL)) {
        alert('Profile picture must be a public http(s) image URL.');
        return;
      }
      await updateCommunityProfile(profile.uid, { bio: bioInput, themeColor: themeInput, photoURL: nextPhotoURL });
      try { await updateProfile(activeUser, { photoURL: nextPhotoURL || null }); } catch (authError) { console.warn('Firebase Auth avatar update skipped:', authError); }
      const nextProfile = { ...profile, bio: bioInput, themeColor: themeInput, photoURL: nextPhotoURL, updatedAt: new Date().toISOString() };
      setProfile(nextProfile);
      await syncUserIdentityAcrossContent(activeUser.uid, { displayName: nextProfile.displayName, photoURL: nextPhotoURL, username: nextProfile.username });
      setIsEditing(false);
      alert('Profile saved and synchronized across your posts and comments.');
    } catch (e: any) { alert('Failed to update profile: ' + (e?.message || 'Permission denied.')); }
  };

  const handleToggleFollow = async () => {
    if (!profile || profile.uid === activeUser?.uid) return;
    if (!activeUser) {
      alert('Sign in with Google to follow this profile.');
      return;
    }
    setIsFollowLoading(true);
    try {
      let me = currentUserProfile || await getCommunityProfile(activeUser.uid);
      if (!me) {
        alert('Complete your profile before following other accounts.');
        return;
      }
      if (isFollowing) {
        await unfollowUser(activeUser.uid, profile.uid, profile.username, me.username);
        setIsFollowing(false);
        setProfile(prev => prev ? { ...prev, followersCount: Math.max(0, (prev.followersCount || 0) - 1) } : prev);
      } else {
        await followUser(activeUser.uid, profile.uid, profile.username, me.username);
        setIsFollowing(true);
        setProfile(prev => prev ? { ...prev, followersCount: (prev.followersCount || 0) + 1 } : prev);
      }
    } catch (e: any) { alert('Failed to update follow: ' + (e?.message || 'Permission denied')); }
    finally { setIsFollowLoading(false); }
  };

  const handleDeletePost = async (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeUser || (!isAdmin && activeUser.uid !== profile?.uid)) return;
    if (!confirm('Are you sure you want to permanently delete this post?')) return;
    try {
      await deletePost(postId);
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch (err: any) { alert('Failed to delete post: ' + (err?.message || 'Permission denied')); }
  };

  const renderPost = (post: CommunityPost, label?: string) => (
    <div key={post.id} onClick={() => onNavigate('community_post', post.id)} className="bg-white border-4 border-black p-5 cursor-pointer neo-shadow-sm hover:-translate-y-1 hover:neo-shadow transition-all group">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="inline-block px-2 py-0.5 bg-[var(--color-secondary)] border border-black font-mono text-[10px] font-black uppercase">{label || post.type}</div>
          {label === 'REPOST' && <Repeat2 className="w-4 h-4" />}
        </div>
        {isOwner && (activeTab === 'posts') && (
          <button onClick={(e) => handleDeletePost(post.id, e)} className="p-1.5 bg-red-100 text-red-700 border-2 border-black" title="Delete post"><Trash className="w-3.5 h-3.5" /></button>
        )}
      </div>
      <h3 className="font-display font-black text-xl group-hover:text-[var(--color-primary)] transition-colors">{post.title}</h3>
      <p className="mt-2 text-sm text-neutral-600 line-clamp-2">{post.content}</p>
      <div className="mt-4 pt-4 border-t-2 border-neutral-100 flex justify-between font-mono text-xs text-neutral-500">
        <span>{new Date(post.createdAt).toLocaleDateString()}</span>
        <div className="flex gap-4"><span>{post.upvotesCount || 0} Upvotes</span><span>{post.commentsCount || 0} Comments</span><span>{post.repostsCount || 0} Reposts</span></div>
      </div>
    </div>
  );

  if (loading) return <div className="py-32 flex justify-center"><Sparkles className="w-8 h-8 animate-spin" /></div>;
  if (!profile) return <div className="py-32 text-center"><h2 className="font-display font-black text-2xl uppercase">User not found</h2><button onClick={() => onNavigate('community')} className="mt-4 px-6 py-2 bg-black text-white font-mono text-xs uppercase">Back to Community</button></div>;

  const tabs: Array<{ id: ProfileTab; label: string; count: number; icon: React.ReactNode }> = [
    { id: 'articles', label: 'Articles', count: articles.length, icon: <FileText className="w-4 h-4" /> },
    { id: 'posts', label: 'Posts', count: posts.length, icon: <FileText className="w-4 h-4" /> },
    { id: 'upvotes', label: 'Upvotes', count: upvotedPosts.length, icon: <ArrowUp className="w-4 h-4" /> },
    { id: 'reposts', label: 'Reposts', count: repostedPosts.length, icon: <Repeat2 className="w-4 h-4" /> },
    { id: 'comments', label: 'Comments', count: comments.length, icon: <MessageSquare className="w-4 h-4" /> }
  ];

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <button onClick={() => onNavigate('community')} className="flex items-center space-x-2 font-mono text-xs font-bold uppercase mb-8 hover:text-[var(--color-primary)]"><ArrowLeft className="w-4 h-4" /><span>Community Hub</span></button>
      <div className="bg-white border-4 border-black neo-shadow-lg overflow-hidden mb-8">
        <div className="h-32 sm:h-48 w-full border-b-4 border-black" style={{ backgroundColor: profile.themeColor || '#000' }} />
        <div className="px-6 sm:px-10 pb-8 relative">
          <div className="flex justify-between items-end -mt-16 mb-6">
            <div className="relative group">
              {profile.photoURL ? <img src={profile.photoURL} alt={profile.displayName} className="w-32 h-32 rounded-full border-4 border-black bg-white object-cover" /> : <div className="w-32 h-32 rounded-full bg-neutral-200 border-4 border-black flex items-center justify-center"><User className="w-12 h-12" /></div>}
              {isOwner && (
                <button type="button" onClick={() => { setPhotoUrlInput(profile.photoURL || ''); setIsEditing(true); }} className="absolute bottom-0 right-0 px-2.5 py-2 bg-[var(--color-primary)] border-2 border-black cursor-pointer font-mono text-[10px] font-black uppercase flex items-center gap-1 hover:bg-[var(--color-secondary)]">
                  <Camera className="w-3.5 h-3.5" /> Change DP
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {isOwner && !isEditing && <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-neutral-100 border-2 border-black font-mono text-xs font-bold uppercase flex items-center gap-2"><Settings className="w-4 h-4" />Edit Profile</button>}
              {!isOwner && <button onClick={handleToggleFollow} disabled={isFollowLoading} className={`px-6 py-2 border-2 border-black font-mono text-xs font-bold uppercase flex items-center gap-2 ${isFollowing ? 'bg-neutral-200' : 'bg-[var(--color-primary)]'}`}>{isFollowLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : isFollowing ? <><UserMinus className="w-4 h-4" />Unfollow</> : <><UserPlus className="w-4 h-4" />Follow</>}</button>}
            </div>
          </div>
          {isEditing ? <form onSubmit={handleSaveProfile} className="space-y-4 max-w-xl"><div className="space-y-1"><label className="font-mono text-[10px] font-bold uppercase">Profile Picture URL</label><input type="url" value={photoUrlInput} onChange={e => setPhotoUrlInput(e.target.value)} placeholder="https://example.com/your-profile-picture.jpg" className="w-full px-3 py-2 border-2 border-black font-mono text-xs" /><p className="font-mono text-[9px] text-neutral-500 uppercase">Paste a public image URL. No Firebase Storage is used.</p></div><textarea value={bioInput} onChange={e => setBioInput(e.target.value)} rows={4} maxLength={500} className="w-full px-3 py-2 border-2 border-black" /><div className="flex gap-2"><input type="color" value={themeInput} onChange={e => setThemeInput(e.target.value)} className="w-10 h-10 border-2 border-black" /><input value={themeInput} onChange={e => setThemeInput(e.target.value)} className="px-3 py-2 border-2 border-black font-mono" /></div><div className="flex gap-2"><button className="px-6 py-2 bg-[var(--color-primary)] border-2 border-black font-mono text-xs font-bold uppercase">Save</button><button type="button" onClick={() => setIsEditing(false)} className="px-6 py-2 bg-neutral-200 border-2 border-black font-mono text-xs font-bold uppercase">Cancel</button></div></form> : <div><h1 className="font-display font-black text-3xl sm:text-4xl uppercase flex items-center gap-2">{profile.displayName}<VerifiedBadge verified={profile.isVerified} color={profile.verificationColor} className="w-6 h-6 shrink-0" /></h1><p className="font-mono text-sm text-neutral-500 mb-2">@{profile.username}</p>{profile.role && <p className="font-mono text-xs font-bold uppercase mb-4">{profile.role}</p>}{profile.bio && <p className="font-sans text-neutral-800 max-w-2xl text-sm leading-relaxed mb-6 whitespace-pre-wrap">{profile.bio}</p>}<div className="flex flex-wrap gap-4 font-mono text-xs"><span>{profile.followersCount || 0} Followers</span><span>{profile.followingCount || 0} Following</span></div></div>}
        </div>
      </div>

      <div className="flex flex-wrap border-4 border-black bg-white mb-6">
        {tabs.map(tab => <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 min-w-[140px] px-4 py-3 border-r-2 last:border-r-0 border-black font-display font-black text-xs uppercase flex items-center justify-center gap-2 ${activeTab === tab.id ? 'bg-[var(--color-primary)]' : 'hover:bg-neutral-100'}`}>{tab.icon}{tab.label} ({tab.count})</button>)}
      </div>

      {activeTab === 'comments' ? <div className="space-y-4">{comments.length === 0 ? <p className="font-mono text-sm text-neutral-500">No comments yet.</p> : comments.map(c => <div key={`${c.articleSlug || c.postId}-${c.id}`} onClick={() => c.postId ? onNavigate('community_post', c.postId) : c.articleSlug ? onNavigate('article', c.articleSlug) : undefined} className="bg-white border-4 border-black p-5 cursor-pointer"><div className="font-mono text-[10px] uppercase text-neutral-500 mb-2">{c.articleSlug ? `ARTICLE: ${c.articleSlug}` : 'COMMUNITY POST'}</div><p className="font-sans text-sm">{c.content}</p><div className="mt-3 font-mono text-[10px] text-neutral-500">{new Date(c.createdAt).toLocaleString()}</div></div>)}</div> : <div className="space-y-6">{activeTab === 'articles' ? (articles.length ? articles.map(article => <div key={article.slug} onClick={() => onNavigate('article', article.slug)} className="bg-white border-4 border-black p-5 cursor-pointer neo-shadow-sm hover:-translate-y-1 transition-all"><div className="font-mono text-[10px] uppercase text-neutral-500 mb-2">MAIN ARTICLE • {article.category}</div><h3 className="font-display font-black text-xl uppercase">{article.title}</h3><p className="mt-2 text-sm text-neutral-600">{article.excerpt}</p></div>) : <p className="font-mono text-sm text-neutral-500">No main articles yet.</p>) : activeTab === 'posts' ? (posts.length ? posts.map(p => renderPost(p)) : <p className="font-mono text-sm text-neutral-500">No community posts yet.</p>) : activeTab === 'upvotes' ? (upvotedPosts.length ? upvotedPosts.map(p => renderPost(p, 'UPVOTED')) : <p className="font-mono text-sm text-neutral-500">No upvoted posts yet.</p>) : (repostedPosts.length ? repostedPosts.map(p => renderPost(p, 'REPOST')) : <p className="font-mono text-sm text-neutral-500">No reposts yet.</p>)}</div>}
    </div>
  );
};
