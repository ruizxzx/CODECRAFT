import { notifyToast } from '../lib/toast';
import { VerifiedBadge } from './VerifiedBadge';
import React, { useState, useEffect } from 'react';
import { CommunityUser, CommunityPost, PageView } from '../types';
import { getProfileByUsername, getCommunityProfile, getUserPosts, updateCommunityProfile, checkIsFollowing, followUser, unfollowUser, deletePost, getUserUpvotedPosts, getUserRepostedPosts, getUserComments, getUserFollowers, getUserFollowing, ProfileListEntry, subscribeCommunityProfile, subscribePublicProfileByUsername } from '../lib/community';
import { auth, checkIsAdmin } from '../lib/firebase';
import { updateProfile } from 'firebase/auth';
import { fetchArticles } from '../lib/cms';
import { formatDisplayDate } from '../lib/dateUtils';
import { getSeriesList } from '../lib/series';
import { CreatorPageBuilder } from './CreatorPageBuilder';
import type { CreatorPageConfig } from '../types';
import { ArrowLeft, User, Sparkles, Settings, UserPlus, UserMinus, Loader2, Trash, ArrowUp, Repeat2, MessageSquare, FileText, Camera, Link as LinkIcon, MapPin, Search as SearchIcon, Shield, Layers } from 'lucide-react';

interface CommunityProfileViewProps {
  username: string;
  onNavigate: (page: PageView, param?: string) => void;
  currentUserProfile?: CommunityUser | null;
  onProfileUpdated?: (profile: CommunityUser) => void;
}

type ProfileTab = 'articles' | 'posts' | 'upvotes' | 'reposts' | 'comments' | 'series';

export const CommunityProfileView: React.FC<CommunityProfileViewProps> = ({ username, onNavigate, currentUserProfile, onProfileUpdated }) => {
  const [profile, setProfile] = useState<CommunityUser | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [upvotedPosts, setUpvotedPosts] = useState<CommunityPost[]>([]);
  const [repostedPosts, setRepostedPosts] = useState<CommunityPost[]>([]);
  const [comments, setComments] = useState<Array<{ id: string; content: string; createdAt: string; postId?: string; articleSlug?: string; authorName: string }>>([]);
  const [series, setSeries] = useState<any[]>([]);
  const [showCreatorBuilder, setShowCreatorBuilder] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [handleInput, setHandleInput] = useState('');
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [coverUrlInput, setCoverUrlInput] = useState('');
  const [websiteInput, setWebsiteInput] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [socialXInput, setSocialXInput] = useState('');
  const [socialGithubInput, setSocialGithubInput] = useState('');
  const [socialTelegramInput, setSocialTelegramInput] = useState('');
  const [socialInstagramInput, setSocialInstagramInput] = useState('');
  const [bioInput, setBioInput] = useState('');
  const [themeInput, setThemeInput] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [userAuth, setUserAuth] = useState(auth.currentUser);
  const [relationModal, setRelationModal] = useState<'followers' | 'following' | null>(null);
  const [relationUsers, setRelationUsers] = useState<ProfileListEntry[]>([]);
  const [relationLoading, setRelationLoading] = useState(false);
  const [relationSearch, setRelationSearch] = useState('');

  useEffect(() => auth.onAuthStateChanged(setUserAuth), []);

  // Keep the public profile live for every viewer. Do not overwrite form inputs while the owner is editing.
  useEffect(() => {
    const apply = (next: CommunityUser | null) => {
      if (!next) return;
      setProfile(next);
      if (!isEditing) {
        setDisplayNameInput(next.displayName || '');
        setHandleInput(next.username || '');
        setBioInput(next.bio || '');
        setThemeInput(next.themeColor || '#D97706');
        setPhotoUrlInput(next.photoURL || '');
        setCoverUrlInput(next.coverImageUrl || '');
        setWebsiteInput(next.websiteUrl || '');
        setLocationInput(next.location || '');
        setSocialXInput(next.socialX || '');
        setSocialGithubInput(next.socialGithub || '');
        setSocialTelegramInput(next.socialTelegram || '');
        setSocialInstagramInput(next.socialInstagram || '');
      }
    };
    if (profile?.uid) return subscribeCommunityProfile(profile.uid, apply);
    return subscribePublicProfileByUsername(username, apply);
  }, [profile?.uid, username, isEditing]);

  useEffect(() => {
    let cancelled = false;
    const loadRelation = async () => {
      if (!relationModal || !profile?.uid) {
        setRelationUsers([]);
        return;
      }
      setRelationLoading(true);
      try {
        const users = relationModal === 'followers'
          ? await getUserFollowers(profile.uid)
          : await getUserFollowing(profile.uid);
        if (!cancelled) setRelationUsers(users);
      } catch (error) {
        console.error(`Failed to load ${relationModal}:`, error);
        if (!cancelled) setRelationUsers([]);
      } finally {
        if (!cancelled) setRelationLoading(false);
      }
    };
    loadRelation();
    return () => { cancelled = true; };
  }, [relationModal, profile?.uid]);

  useEffect(() => { setRelationSearch(''); }, [relationModal]);
  const visibleRelationUsers = relationUsers.filter(user => {
    const q = relationSearch.trim().toLowerCase().replace(/^@/, '');
    return !q || user.username.toLowerCase().includes(q) || user.displayName.toLowerCase().includes(q);
  });
  const activeUser = auth.currentUser || userAuth;
  const isAdmin = checkIsAdmin(activeUser?.email);
  // Profile Settings is strictly account-scoped. Publication author settings
  // are managed separately in Admin Studio and must never overwrite a user's
  // personal account display name.
  const isOwner = !!activeUser && !!profile && !!profile.uid && activeUser.uid === profile.uid;

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const fetched = await getProfileByUsername(username);
        if (cancelled) return;
        const requestedHandle = username.toLowerCase().replace(/^@/, '').trim();
        const currentMatches = !!currentUserProfile?.username && currentUserProfile.username.toLowerCase() === requestedHandle;
        const p = (currentMatches && currentUserProfile)
          ? { ...(fetched || {}), ...currentUserProfile } as CommunityUser
          : fetched;
        setProfile(p);
        if (!p) return;
        if (p.username && p.username.toLowerCase() !== requestedHandle) {
          onNavigate('community_profile', p.username);
          return;
        }
        setDisplayNameInput(p.displayName || '');
        setBioInput(p.bio || '');
        setThemeInput(p.themeColor || '#000000');
        setPhotoUrlInput(p.photoURL || '');
        setCoverUrlInput(p.coverImageUrl || '');
        setWebsiteInput(p.websiteUrl || '');
        setLocationInput(p.location || '');
        setSocialXInput(p.socialX || '');
        setSocialGithubInput(p.socialGithub || '');
        setSocialTelegramInput(p.socialTelegram || '');
        setSocialInstagramInput(p.socialInstagram || '');
        // Load profile activity independently so one optional collection
        // (comments/upvotes/reposts/articles) cannot hide the user's posts.
        const results = await Promise.allSettled([
          fetchArticles(),
          getUserPosts(p.uid || '', p.username),
          p.uid ? getUserUpvotedPosts(p.uid) : Promise.resolve([]),
          p.uid ? getUserRepostedPosts(p.uid) : Promise.resolve([]),
          p.uid ? getUserComments(p.uid) : Promise.resolve([]),
          getSeriesList().catch(() => [])
        ]);
        if (cancelled) return;

        const [articleResult, postsResult, upvotesResult, repostsResult, commentsResult, seriesResult] = results;
        if (articleResult.status === 'fulfilled') {
          const allArticles = articleResult.value;
          const articleList = Array.isArray((allArticles as any)?.articles) ? (allArticles as any).articles : (Array.isArray(allArticles) ? allArticles : []);
          setArticles(articleList.filter((a: any) =>
            a.author?.uid === p.uid ||
            a.author?.id === p.uid ||
            a.author?.username?.toLowerCase() === (p.username || '').toLowerCase() ||
            a.author?.name === p.displayName
          ));
        } else {
          console.warn('Profile articles failed to load:', articleResult.reason);
          setArticles([]);
        }
        if (postsResult.status === 'fulfilled') setPosts(postsResult.value);
        else { console.warn('Profile posts failed to load:', postsResult.reason); setPosts([]); }
        if (upvotesResult.status === 'fulfilled') setUpvotedPosts(upvotesResult.value);
        else { console.warn('Profile upvotes failed to load:', upvotesResult.reason); setUpvotedPosts([]); }
        if (repostsResult.status === 'fulfilled') setRepostedPosts(repostsResult.value);
        else { console.warn('Profile reposts failed to load:', repostsResult.reason); setRepostedPosts([]); }
        if (commentsResult.status === 'fulfilled') setComments(commentsResult.value);
        else { console.warn('Profile comments failed to load:', commentsResult.reason); setComments([]); }
        if (seriesResult.status === 'fulfilled') setSeries((seriesResult.value as any[]).filter((x:any)=>x.ownerId===p.uid || x.ownerUsername===p.username));
        else setSeries([]);
        if (auth.currentUser && p.uid && auth.currentUser.uid !== p.uid) {
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
    if (!profile || !activeUser || !isOwner || isSavingProfile) return;
    setIsSavingProfile(true);
    try {
      const nextPhotoURL = photoUrlInput.trim();
      const nextCoverURL = coverUrlInput.trim();
      if (nextPhotoURL && !/^https?:\/\//i.test(nextPhotoURL)) { notifyToast('Profile picture must be a public http(s) image URL.'); return; }
      if (nextCoverURL && !/^https?:\/\//i.test(nextCoverURL)) { notifyToast('Cover image must be a public http(s) image URL.'); return; }
      const nextWebsite = websiteInput.trim();
      const nextX = socialXInput.trim();
      const nextGithub = socialGithubInput.trim();
      const nextTelegram = socialTelegramInput.trim();
      const nextInstagram = socialInstagramInput.trim();
      for (const [label, value] of [['Website', nextWebsite], ['X', nextX], ['GitHub', nextGithub], ['Telegram', nextTelegram], ['Instagram', nextInstagram]] as const) {
        if (value && !/^https?:\/\//i.test(value)) { notifyToast(`${label} URL must start with http:// or https://`); return; }
      }
      const nextDisplayName = displayNameInput.trim() || profile.displayName || 'User';
      const nextHandle = handleInput.toLowerCase().trim().replace(/[^a-z0-9_]/g, '').slice(0, 30);
      if (nextHandle && nextHandle.length < 3) { notifyToast('Handle must be at least 3 characters or left blank.'); return; }
      if (nextDisplayName.length > 64) { notifyToast('Display name must be 64 characters or less.'); return; }
      if (!/^#[0-9a-f]{6}$/i.test(themeInput.trim())) { notifyToast('Theme color must be a 6-digit hex color such as #FFD600.'); return; }

      // The profile document is the source of truth. Save this first so a secondary
      // identity propagation failure can never make a successful profile edit look like a failure.
      await updateCommunityProfile(profile.uid, {
        username: nextHandle,
        displayName: nextDisplayName, bio: bioInput.trim().slice(0, 500), themeColor: themeInput.trim().toUpperCase(),
        photoURL: nextPhotoURL, coverImageUrl: nextCoverURL, websiteUrl: nextWebsite, location: locationInput.trim().slice(0, 100),
        socialX: nextX, socialGithub: nextGithub, socialTelegram: nextTelegram, socialInstagram: nextInstagram
      });

      try { await updateProfile(activeUser, { displayName: nextDisplayName, photoURL: nextPhotoURL || null }); }
      catch (authError) { console.warn('Firebase Auth profile update skipped; Firestore profile is still saved:', authError); }

      const nextProfile = { ...profile, username: nextHandle, displayName: nextDisplayName, bio: bioInput.trim().slice(0, 500), themeColor: themeInput.trim().toUpperCase(),
        photoURL: nextPhotoURL, coverImageUrl: nextCoverURL, websiteUrl: nextWebsite, location: locationInput.trim().slice(0, 100),
        socialX: nextX, socialGithub: nextGithub, socialTelegram: nextTelegram, socialInstagram: nextInstagram, updatedAt: new Date().toISOString() };
      setProfile(nextProfile);
      onProfileUpdated?.(nextProfile as CommunityUser);
      setIsEditing(false);
      if (nextHandle && nextHandle !== username.toLowerCase()) onNavigate('community_profile', nextHandle);
      else if (!nextHandle) onNavigate('preferences');
      notifyToast('Profile saved and synchronized across your account.');
    } catch (e: any) {
      console.error('Profile update failed:', e);
      const raw = String(e?.message || '');
      let detail = raw;
      try { detail = JSON.parse(raw)?.error || raw; } catch (error) { console.warn('OFFSCRPT recoverable operation failed:', error); }
      notifyToast('Failed to update profile: ' + (detail || 'Permission denied.'));
    } finally { setIsSavingProfile(false); }
  };

  const handleToggleFollow = async () => {
    if (!profile || !profile.uid || profile.uid === activeUser?.uid) return;
    if (!activeUser) {
      notifyToast('Sign in with Google to follow this profile.');
      return;
    }
    setIsFollowLoading(true);
    try {
      let me = currentUserProfile || await getCommunityProfile(activeUser.uid);
      if (!me) {
        notifyToast('Complete your profile before following other accounts.');
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
    } catch (e: any) { notifyToast('Failed to update follow: ' + (e?.message || 'Permission denied')); }
    finally { setIsFollowLoading(false); }
  };

  const handleDeletePost = async (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeUser || (!isAdmin && activeUser.uid !== profile?.uid)) return;
    if (!confirm('Are you sure you want to permanently delete this post?')) return;
    try {
      const target:any = posts.find((p:any)=>p.id===postId);
      if(target?.sourceType==='community' && target.communityId){ const {deleteCommunityPost}=await import('../lib/social'); await deleteCommunityPost(target.communityId,postId,activeUser.uid); } else { await deletePost(postId); }
      setPosts(prev => prev.filter((p:any) => !(p.id === postId && ((p as any).communityId||'') === ((target as any)?.communityId||''))));
    } catch (err: any) { notifyToast('Failed to delete post: ' + (err?.message || 'Permission denied')); }
  };

  const renderPost = (post: CommunityPost, label?: string) => (
    <div key={`${(post as any).sourceType || 'root'}:${(post as any).communityId || ''}:${post.id}`} onClick={() => (post as any).sourceType==='community' ? onNavigate('social') : onNavigate('community_post', post.id)} className="bg-white border-4 border-black p-5 cursor-pointer neo-shadow-sm hover:-translate-y-1 hover:neo-shadow transition-all group">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="inline-block px-2 py-0.5 bg-[var(--color-secondary)] border border-black font-mono text-[10px] font-black uppercase">{label || post.type}</div>
          {label === 'REPOST' && <Repeat2 className="w-4 h-4" />}
        </div>
        {isOwner && (activeTab === 'posts') && (
          <button onClick={(e) => handleDeletePost(post.id, e)} className="p-1.5 bg-red-100 text-red-700 border-2 border-black" title="Delete post"><Trash className="w-3.5 h-3.5" /></button>
        )}
      </div>
      <div className="flex items-center gap-2 mb-1">
        {post.authorAvatar ? <img src={post.authorAvatar} alt="" className="w-6 h-6 rounded-full border-2 border-black object-cover" /> : <div className="w-6 h-6 rounded-full bg-neutral-200 border-2 border-black" />}
        <span className="font-mono text-[10px] font-bold uppercase inline-flex items-center gap-1">@{post.authorUsername}{((post as any).platformRole==='moderator' || (post as any).platformRole==='master_admin') && <span className="px-1 border border-black bg-[var(--color-primary)]"><Shield className="inline w-3 h-3"/>{(post as any).platformRole==='master_admin' ? 'MASTER' : 'MOD'}</span>}<VerifiedBadge verified={post.authorId === profile.uid ? !!profile.isVerified : !!post.isVerified} color={post.authorId === profile.uid ? profile.verificationColor : post.verificationColor} className="w-3.5 h-3.5" /></span>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-1 font-mono text-[9px] font-black uppercase">{(post as any).editedAt && <span className="px-1.5 py-0.5 border border-black bg-neutral-100">EDITED</span>}{(post as any).editReviewStatus==='pending' && <span className="px-1.5 py-0.5 border border-black bg-yellow-200">EDIT PENDING REVIEW</span>}</div>
      <h3 className="font-display font-black text-xl group-hover:text-[var(--color-primary)] transition-colors">{post.title}</h3>
      <p className="mt-2 text-sm text-neutral-600 line-clamp-2">{post.content}</p>
      <div className="mt-4 pt-4 border-t-2 border-neutral-100 flex justify-between font-mono text-xs text-neutral-500">
        <span>{formatDisplayDate(post.createdAt)}{(post as any).communityId ? ` · c/${(post as any).communitySlug || ''}` : ''}</span>
        <div className="flex gap-4"><span>{post.upvotesCount || 0} Upvotes</span><span>{Number(post.viewsCount || 0).toLocaleString()} VIEWS · {post.commentsCount || 0} Comments</span><span>{post.repostsCount || 0} Reposts</span></div>
      </div>
    </div>
  );

  if (loading) return <div className="py-32 flex justify-center"><Sparkles className="w-8 h-8 animate-spin" /></div>;
  if (!profile) return <div className="py-32 text-center"><h2 className="font-display font-black text-2xl uppercase">User not found</h2><button onClick={() => onNavigate('community')} className="mt-4 px-6 py-2 bg-black text-white font-mono text-xs uppercase">Back to Community</button></div>;

  const tabs: Array<{ id: ProfileTab; label: string; count: number; icon: React.ReactNode }> = [
    { id: 'articles', label: 'Articles', count: articles.length, icon: <FileText className="w-4 h-4" /> },
    { id: 'series', label: 'Series', count: series.length, icon: <Layers className="w-4 h-4" /> },
    { id: 'posts', label: 'Posts', count: posts.length, icon: <FileText className="w-4 h-4" /> },
    { id: 'upvotes', label: 'Upvotes', count: upvotedPosts.length, icon: <ArrowUp className="w-4 h-4" /> },
    { id: 'reposts', label: 'Reposts', count: repostedPosts.length, icon: <Repeat2 className="w-4 h-4" /> },
    { id: 'comments', label: 'Comments', count: comments.length, icon: <MessageSquare className="w-4 h-4" /> }
  ];

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <button onClick={() => onNavigate('community')} className="flex items-center space-x-2 font-mono text-xs font-bold uppercase mb-8 hover:text-[var(--color-primary)]"><ArrowLeft className="w-4 h-4" /><span>Community Hub</span></button>
      <div className="bg-white border-4 border-black neo-shadow-lg overflow-hidden mb-8">
        <div className="h-32 sm:h-48 w-full border-b-4 border-black bg-cover bg-center" style={{ backgroundColor: profile.themeColor || '#D97706', backgroundImage: profile.coverImageUrl ? `url(${profile.coverImageUrl})` : undefined }} />
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
          {isEditing ? <form onSubmit={handleSaveProfile} className="space-y-4 max-w-xl"><div className="space-y-1"><label className="font-mono text-[10px] font-bold uppercase">Unique @Handle</label><input value={handleInput} onChange={e => setHandleInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30))} maxLength={30} placeholder="your_handle (optional)" className="w-full px-3 py-2 border-2 border-black font-mono text-sm" /><p className="font-mono text-[9px] text-neutral-500">Leave blank to stay unclaimed. Handles are global and unique.</p></div><div className="space-y-1"><label className="font-mono text-[10px] font-bold uppercase">Display Name</label><input value={displayNameInput} onChange={e => setDisplayNameInput(e.target.value)} maxLength={64} className="w-full px-3 py-2 border-2 border-black font-display font-bold text-sm" /></div><div className="space-y-1"><label className="font-mono text-[10px] font-bold uppercase">Profile Picture URL</label><input type="url" value={photoUrlInput} onChange={e => setPhotoUrlInput(e.target.value)} placeholder="https://example.com/your-profile-picture.jpg" className="w-full px-3 py-2 border-2 border-black font-mono text-xs" /><p className="font-mono text-[9px] text-neutral-500 uppercase">Paste a public image URL. No Firebase Storage is used.</p></div><div className="space-y-1"><label className="font-mono text-[10px] font-bold uppercase">Profile Cover Image URL</label><input type="url" value={coverUrlInput} onChange={e => setCoverUrlInput(e.target.value)} placeholder="https://example.com/cover.jpg" className="w-full px-3 py-2 border-2 border-black font-mono text-xs" /><p className="font-mono text-[9px] text-neutral-500 uppercase">Optional public image URL. Your theme color remains the fallback.</p></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input type="url" value={websiteInput} onChange={e => setWebsiteInput(e.target.value)} placeholder="Website URL" className="px-3 py-2 border-2 border-black font-mono text-xs" />
            <input value={locationInput} onChange={e => setLocationInput(e.target.value)} maxLength={100} placeholder="Location" className="px-3 py-2 border-2 border-black font-mono text-xs" />
            <input type="url" value={socialXInput} onChange={e => setSocialXInput(e.target.value)} placeholder="X profile URL" className="px-3 py-2 border-2 border-black font-mono text-xs" />
            <input type="url" value={socialGithubInput} onChange={e => setSocialGithubInput(e.target.value)} placeholder="GitHub profile URL" className="px-3 py-2 border-2 border-black font-mono text-xs" />
            <input type="url" value={socialTelegramInput} onChange={e => setSocialTelegramInput(e.target.value)} placeholder="Telegram profile URL" className="px-3 py-2 border-2 border-black font-mono text-xs" />
            <input type="url" value={socialInstagramInput} onChange={e => setSocialInstagramInput(e.target.value)} placeholder="Instagram profile URL" className="px-3 py-2 border-2 border-black font-mono text-xs" />
          </div>
          <textarea value={bioInput} onChange={e => setBioInput(e.target.value)} rows={4} maxLength={500} placeholder="Bio" className="w-full px-3 py-2 border-2 border-black" /><div className="flex gap-2"><input type="color" value={themeInput} onChange={e => setThemeInput(e.target.value)} className="w-10 h-10 border-2 border-black" /><input value={themeInput} onChange={e => setThemeInput(e.target.value)} className="px-3 py-2 border-2 border-black font-mono" /></div><div className="flex gap-2"><button type="submit" disabled={isSavingProfile} className="px-6 py-2 bg-[var(--color-primary)] border-2 border-black font-mono text-xs font-bold uppercase disabled:opacity-60 disabled:cursor-not-allowed">{isSavingProfile ? 'Saving…' : 'Save'}</button><button type="button" onClick={() => setIsEditing(false)} className="px-6 py-2 bg-neutral-200 border-2 border-black font-mono text-xs font-bold uppercase">Cancel</button></div></form> : <div><h1 className="font-display font-black text-3xl sm:text-4xl uppercase flex items-center gap-2">{profile.displayName}<VerifiedBadge verified={profile.isVerified} color={profile.verificationColor} className="w-6 h-6 shrink-0" /></h1>{profile.username ? <p className="font-mono text-sm text-neutral-500 mb-2">@{profile.username}</p> : <p className="font-mono text-sm text-neutral-500 mb-2">NO HANDLE CLAIMED</p>}{profile.role && <p className="font-mono text-xs font-bold uppercase mb-4">{profile.role}</p>}{profile.bio && <p className="font-sans text-neutral-800 max-w-2xl text-sm leading-relaxed mb-4 whitespace-pre-wrap">{profile.bio}</p>}
            {(profile.websiteUrl || profile.location || profile.socialX || profile.socialGithub || profile.socialTelegram || profile.socialInstagram) && <div className="flex flex-wrap items-center gap-2 mb-5 font-mono text-[10px] font-bold uppercase">
              {profile.location && <span className="inline-flex items-center gap-1 px-2 py-1 border-2 border-black bg-neutral-100"><MapPin className="w-3 h-3" />{profile.location}</span>}
              {profile.websiteUrl && <a href={profile.websiteUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1 px-2 py-1 border-2 border-black bg-[var(--color-secondary)] hover:bg-[var(--color-primary)]"><LinkIcon className="w-3 h-3" />Website</a>}
              {profile.socialX && <a href={profile.socialX} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="px-2 py-1 border-2 border-black bg-white hover:bg-[var(--color-primary)]">X</a>}
              {profile.socialGithub && <a href={profile.socialGithub} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="px-2 py-1 border-2 border-black bg-white hover:bg-[var(--color-primary)]">GitHub</a>}
              {profile.socialTelegram && <a href={profile.socialTelegram} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="px-2 py-1 border-2 border-black bg-white hover:bg-[var(--color-primary)]">Telegram</a>}
              {profile.socialInstagram && <a href={profile.socialInstagram} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="px-2 py-1 border-2 border-black bg-white hover:bg-[var(--color-primary)]">Instagram</a>}
            </div>}
            <div className="flex flex-wrap gap-2 mb-4">
            {profile.username ? <button type="button" onClick={() => onNavigate('creator', profile.username)} className="border-2 border-black bg-[var(--color-primary)] px-3 py-2 font-mono text-[10px] font-black uppercase">OPEN CREATOR PAGE →</button> : <span className="border-2 border-dashed border-neutral-400 px-3 py-2 font-mono text-[10px] font-black uppercase text-neutral-500">CLAIM A HANDLE TO OPEN CREATOR PAGE</span>}
            {isOwner && <button type="button" onClick={() => setShowCreatorBuilder(v => !v)} className="border-2 border-black bg-white px-3 py-2 font-mono text-[10px] font-black uppercase">{showCreatorBuilder ? 'CLOSE BUILDER' : 'CUSTOMIZE PAGE'}</button>}
          </div>
          {showCreatorBuilder && isOwner && <div className="mb-5"><CreatorPageBuilder profile={profile} articles={articles} series={series} onSaved={(config: CreatorPageConfig) => { setProfile(prev => prev ? ({...prev, creatorPage: config} as any) : prev); setShowCreatorBuilder(false); }} /></div>}
          <div className="flex flex-wrap gap-3 font-mono text-xs">
            <button type="button" onClick={() => setRelationModal('followers')} className="underline underline-offset-4 hover:bg-[var(--color-primary)] px-1 py-0.5 font-bold">{profile.followersCount || 0} Followers</button>
            <button type="button" onClick={() => setRelationModal('following')} className="underline underline-offset-4 hover:bg-[var(--color-primary)] px-1 py-0.5 font-bold">{profile.followingCount || 0} Following</button>
          </div></div>}
        </div>
      </div>

      <div className="flex flex-wrap border-4 border-black bg-white mb-6">
        {tabs.map(tab => <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 min-w-[140px] px-4 py-3 border-r-2 last:border-r-0 border-black font-display font-black text-xs uppercase flex items-center justify-center gap-2 ${activeTab === tab.id ? 'bg-[var(--color-primary)]' : 'hover:bg-neutral-100'}`}>{tab.icon}{tab.label} ({tab.count})</button>)}
      </div>

      {activeTab === 'series' ? <div className="grid md:grid-cols-2 gap-4">{series.length===0 ? <p className="font-mono text-sm text-neutral-500">No series yet.</p> : series.map((item:any) => <button key={item.id} onClick={() => onNavigate('series', item.id)} className="text-left bg-white border-4 border-black p-5 hover:bg-[var(--color-secondary)] neo-shadow-sm"><div className="font-mono text-[10px]">{item.articleCount || 0} PARTS</div><h3 className="font-display font-black text-xl uppercase mt-1">{item.title}</h3><p className="text-sm mt-2">{item.description}</p></button>)}</div> : activeTab === 'comments' ? <div className="space-y-4">{comments.length === 0 ? <p className="font-mono text-sm text-neutral-500">No comments yet.</p> : comments.map(c => <div key={`${c.articleSlug || c.postId}-${c.id}`} onClick={() => c.postId ? onNavigate('community_post', c.postId) : c.articleSlug ? onNavigate('article', c.articleSlug) : undefined} className="bg-white border-4 border-black p-5 cursor-pointer"><div className="font-mono text-[10px] uppercase text-neutral-500 mb-2">{c.articleSlug ? `ARTICLE: ${c.articleSlug}` : 'COMMUNITY POST'}</div><div className="flex items-center gap-2 mb-2 font-mono text-[10px] font-bold uppercase">
              {profile.photoURL ? <img src={profile.photoURL} alt="" className="w-5 h-5 rounded-full border border-black object-cover" /> : null}
              <span>@{profile.username}</span><VerifiedBadge verified={profile.isVerified} color={profile.verificationColor} className="w-3.5 h-3.5" />
            </div><p className="font-sans text-sm">{c.content}</p><div className="mt-3 font-mono text-[10px] text-neutral-500">{formatDisplayDate(c.createdAt)}</div></div>)}</div> : <div className="space-y-6">{activeTab === 'articles' ? (articles.length ? articles.map(article => <div key={article.slug} onClick={() => onNavigate('article', article.slug)} className="bg-white border-4 border-black p-5 cursor-pointer neo-shadow-sm hover:-translate-y-1 transition-all"><div className="font-mono text-[10px] uppercase text-neutral-500 mb-2">MAIN ARTICLE • {article.category}</div><h3 className="font-display font-black text-xl uppercase">{article.title}</h3><p className="mt-2 text-sm text-neutral-600">{article.excerpt}</p></div>) : <p className="font-mono text-sm text-neutral-500">No main articles yet.</p>) : activeTab === 'posts' ? (posts.length ? posts.map(p => renderPost(p)) : <p className="font-mono text-sm text-neutral-500">No community posts yet.</p>) : activeTab === 'upvotes' ? (upvotedPosts.length ? upvotedPosts.map(p => renderPost(p, 'UPVOTED')) : <p className="font-mono text-sm text-neutral-500">No upvoted posts yet.</p>) : (repostedPosts.length ? repostedPosts.map(p => renderPost(p, 'REPOST')) : <p className="font-mono text-sm text-neutral-500">No reposts yet.</p>)}</div>}

      {relationModal && (
        <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={relationModal === 'followers' ? 'Followers' : 'Following'} onClick={() => setRelationModal(null)}>
          <div className="w-full max-w-lg max-h-[80vh] bg-white border-4 border-black neo-shadow-lg flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b-4 border-black bg-[var(--color-primary)]">
              <h2 className="font-display font-black text-xl uppercase">{relationModal === 'followers' ? 'Followers' : 'Following'} ({relationUsers.length})</h2>
              <button type="button" onClick={() => setRelationModal(null)} className="px-3 py-1 bg-white border-2 border-black font-display font-black" aria-label="Close">×</button>
            </div>
            <div className="p-3 border-b-2 border-black bg-neutral-50">
              <div className="flex items-center gap-2 border-2 border-black bg-white px-3 py-2">
                <SearchIcon className="w-4 h-4" />
                <input value={relationSearch} onChange={e => setRelationSearch(e.target.value)} placeholder="Search by @handle or name" className="w-full outline-none font-mono text-xs" />
              </div>
            </div>
            <div className="overflow-y-auto p-3 space-y-2">
              {relationLoading ? (
                <div className="py-10 text-center font-mono text-xs uppercase">Loading...</div>
              ) : relationUsers.length === 0 ? (
                <div className="py-10 text-center font-mono text-xs text-neutral-500 uppercase">No {relationModal} yet.</div>
              ) : visibleRelationUsers.map(user => (
                <button
                  key={user.uid}
                  type="button"
                  onClick={() => { setRelationModal(null); onNavigate('community_profile', user.username); }}
                  className="w-full flex items-center gap-3 p-3 border-2 border-black bg-white hover:bg-[var(--color-secondary)] text-left"
                >
                  {user.photoURL ? <img src={user.photoURL} alt="" className="w-11 h-11 rounded-full border-2 border-black object-cover shrink-0" /> : <div className="w-11 h-11 rounded-full border-2 border-black bg-neutral-200 shrink-0 flex items-center justify-center font-display font-black">{(user.displayName || user.username).charAt(0).toUpperCase()}</div>}
                  <span className="min-w-0 flex-1">
                    <span className="font-display font-black uppercase text-sm flex items-center gap-1 truncate">{user.displayName}<VerifiedBadge verified={user.isVerified} color={user.verificationColor} className="w-4 h-4" /></span>
                    <span className="font-mono text-[10px] text-neutral-500 truncate block">@{user.username}</span>
                  </span>
                </button>
              ))}
              {!relationLoading && relationUsers.length > 0 && visibleRelationUsers.length === 0 && <div className="py-10 text-center font-mono text-xs text-neutral-500 uppercase">No matching profiles.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
