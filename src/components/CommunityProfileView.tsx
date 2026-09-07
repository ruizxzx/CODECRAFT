import React, { useState, useEffect } from 'react';
import { CommunityUser, CommunityPost, PageView } from '../types';
import { getProfileByUsername, getPosts, updateCommunityProfile, checkIsFollowing, followUser, unfollowUser, getCommunityProfile, deletePost } from '../lib/community';
import { auth, checkIsAdmin } from '../lib/firebase';
import { ArrowLeft, User, Sparkles, MapPin, Link as LinkIcon, Settings, UserPlus, UserMinus, Loader2, Trash } from 'lucide-react';

interface CommunityProfileViewProps {
  username: string;
  onNavigate: (page: PageView, param?: string) => void;
  currentUserProfile?: CommunityUser | null;
}

export const CommunityProfileView: React.FC<CommunityProfileViewProps> = ({ username, onNavigate, currentUserProfile }) => {
  const [profile, setProfile] = useState<CommunityUser | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isEditing, setIsEditing] = useState(false);
  const [bioInput, setBioInput] = useState('');
  const [themeInput, setThemeInput] = useState('');
  
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  
  const [userAuth, setUserAuth] = useState(auth.currentUser);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      setUserAuth(user);
    });
    return () => unsub();
  }, []);

  const activeUser = auth.currentUser || userAuth;
  const isOwner = activeUser && profile && activeUser.uid === profile.uid;
  const isAdmin = checkIsAdmin(activeUser?.email);

  const handleDeletePost = async (postId: string, authorId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentUser = auth.currentUser || userAuth;
    const currentIsAdmin = checkIsAdmin(currentUser?.email);
    if (!currentUser || (!currentIsAdmin && currentUser.uid !== authorId)) {
      alert('You do not have permission to delete this post.');
      return;
    }
    if (!confirm('Are you sure you want to permanently delete this post?')) return;
    try {
      await deletePost(postId);
      setPosts(posts.filter(p => p.id !== postId));
      alert('Post successfully deleted from database and site!');
    } catch (err: any) {
      console.error(err);
      alert('Failed to delete post: ' + (err?.message || 'Permission denied'));
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const p = await getProfileByUsername(username);
      setProfile(p);
      if (p) {
        setBioInput(p.bio || '');
        setThemeInput(p.themeColor || '#000000');
        const userPosts = await getPosts(undefined, username);
        setPosts(userPosts);
        
        if (auth.currentUser) {
          const following = await checkIsFollowing(auth.currentUser.uid, p.uid);
          setIsFollowing(following);
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [username]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    try {
      await updateCommunityProfile(profile.uid, {
        bio: bioInput,
        themeColor: themeInput
      });
      setProfile({ ...profile, bio: bioInput, themeColor: themeInput });
      setIsEditing(false);
    } catch (e) {
      alert("Failed to update profile.");
    }
  };

  const handleToggleFollow = async () => {
    if (!auth.currentUser || !profile || !currentUserProfile) return;
    setIsFollowLoading(true);
    try {
      if (isFollowing) {
        await unfollowUser(auth.currentUser.uid, profile.uid, profile.followersCount || 0, currentUserProfile.followingCount || 0);
        setIsFollowing(false);
        setProfile({ ...profile, followersCount: Math.max(0, (profile.followersCount || 0) - 1) });
      } else {
        await followUser(
          auth.currentUser.uid, 
          profile.uid, 
          profile.username, 
          currentUserProfile.username, 
          profile.followersCount || 0, 
          currentUserProfile.followingCount || 0
        );
        setIsFollowing(true);
        setProfile({ ...profile, followersCount: (profile.followersCount || 0) + 1 });
      }
    } catch (e) {
      console.error("Follow error:", e);
    } finally {
      setIsFollowLoading(false);
    }
  };

  if (loading) {
    return <div className="py-32 flex justify-center"><Sparkles className="w-8 h-8 animate-spin" /></div>;
  }

  if (!profile) {
    return (
      <div className="py-32 text-center">
        <h2 className="font-display font-black text-2xl uppercase">User not found</h2>
        <button onClick={() => onNavigate('community')} className="mt-4 px-6 py-2 bg-black text-white font-mono text-xs uppercase">Back to Community</button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <button 
        onClick={() => onNavigate('community')}
        className="flex items-center space-x-2 font-mono text-xs font-bold uppercase mb-8 hover:text-[var(--color-primary)] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Community Hub</span>
      </button>

      <div className="bg-white border-4 border-black neo-shadow-lg overflow-hidden mb-12">
        <div className="h-32 sm:h-48 w-full border-b-4 border-black" style={{ backgroundColor: profile.themeColor || '#000' }} />
        
        <div className="px-6 sm:px-10 pb-8 relative">
          <div className="flex justify-between items-end -mt-16 mb-6">
            <div className="relative">
              {profile.photoURL ? (
                <img src={profile.photoURL} alt={profile.displayName} className="w-32 h-32 rounded-full border-4 border-black bg-white object-cover" />
              ) : (
                <div className="w-32 h-32 rounded-full bg-neutral-200 border-4 border-black flex items-center justify-center">
                  <User className="w-12 h-12" />
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-3">
              {isOwner && !isEditing && (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-neutral-100 border-2 border-black font-mono text-xs font-bold uppercase hover:bg-neutral-200 flex items-center space-x-2"
                >
                  <Settings className="w-4 h-4" />
                  <span>Edit Profile</span>
                </button>
              )}
              
              {!isOwner && currentUserProfile && (
                <button
                  onClick={handleToggleFollow}
                  disabled={isFollowLoading}
                  className={`px-6 py-2 border-2 border-black font-mono text-xs font-bold uppercase flex items-center space-x-2 transition-colors ${
                    isFollowing 
                      ? 'bg-neutral-200 hover:bg-red-100 hover:text-red-600 hover:border-red-600' 
                      : 'bg-[var(--color-primary)] hover:bg-black hover:text-[var(--color-primary)]'
                  }`}
                >
                  {isFollowLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isFollowing ? (
                    <>
                      <UserMinus className="w-4 h-4" />
                      <span>Unfollow</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Follow</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {isEditing ? (
            <form onSubmit={handleSaveProfile} className="space-y-4 max-w-xl">
              <div className="space-y-2">
                <label className="font-mono text-xs font-bold uppercase">Bio</label>
                <textarea 
                  value={bioInput}
                  onChange={(e) => setBioInput(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-black font-sans text-sm focus:outline-none"
                  rows={4}
                  maxLength={500}
                />
              </div>
              <div className="space-y-2">
                <label className="font-mono text-xs font-bold uppercase">Theme Color</label>
                <div className="flex items-center space-x-2">
                  <input 
                    type="color" 
                    value={themeInput}
                    onChange={(e) => setThemeInput(e.target.value)}
                    className="w-10 h-10 p-0 border-2 border-black cursor-pointer"
                  />
                  <input 
                    type="text"
                    value={themeInput}
                    onChange={(e) => setThemeInput(e.target.value)}
                    className="px-3 py-2 border-2 border-black font-mono text-sm uppercase focus:outline-none"
                    pattern="^#[0-9a-fA-F]{6}$"
                  />
                </div>
              </div>
              <div className="flex space-x-2">
                <button type="submit" className="px-6 py-2 bg-[var(--color-primary)] border-2 border-black font-mono text-xs font-bold uppercase">Save</button>
                <button type="button" onClick={() => setIsEditing(false)} className="px-6 py-2 bg-neutral-200 border-2 border-black font-mono text-xs font-bold uppercase">Cancel</button>
              </div>
            </form>
          ) : (
            <div>
              <h1 className="font-display font-black text-3xl sm:text-4xl uppercase">{profile.displayName}</h1>
              <p className="font-mono text-sm text-neutral-500 mb-4">@{profile.username}</p>
              
              {profile.bio && (
                <p className="font-sans text-neutral-800 max-w-2xl text-sm leading-relaxed mb-6 whitespace-pre-wrap">
                  {profile.bio}
                </p>
              )}
              
              <div className="flex flex-wrap gap-4 font-mono text-xs text-neutral-500">
                <div className="flex items-center space-x-1">
                  <User className="w-4 h-4" />
                  <span>Joined {new Date(profile.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center space-x-1 font-bold text-black">
                  <span>{profile.followersCount || 0} Followers</span>
                </div>
                <div className="flex items-center space-x-1 font-bold text-black">
                  <span>{profile.followingCount || 0} Following</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <h3 className="font-display font-black text-2xl uppercase mb-6 border-b-4 border-black pb-2 inline-block">
        Activity &amp; Posts
      </h3>

      <div className="space-y-6">
        {posts.length === 0 ? (
          <p className="font-mono text-sm text-neutral-500">No posts yet.</p>
        ) : (
          posts.map(post => (
            <div 
              key={post.id} 
              onClick={() => onNavigate('community_post', post.id)}
              className="bg-white border-4 border-black p-5 cursor-pointer neo-shadow-sm hover:-translate-y-1 hover:neo-shadow transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="inline-block px-2 py-0.5 bg-[var(--color-secondary)] border border-black font-mono text-[10px] font-black uppercase">
                  {post.type}
                </div>
                {activeUser && (activeUser.uid === post.authorId || checkIsAdmin(activeUser?.email)) && (
                  <button
                    onClick={(e) => handleDeletePost(post.id, post.authorId, e)}
                    className="p-1.5 bg-red-100 hover:bg-red-200 text-red-700 border-2 border-black transition-colors"
                    title="Delete post"
                  >
                    <Trash className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <h3 className="font-display font-black text-xl group-hover:text-[var(--color-primary)] transition-colors">
                {post.title}
              </h3>
              <div className="mt-4 pt-4 border-t-2 border-neutral-100 flex justify-between font-mono text-xs text-neutral-500">
                <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                <div className="flex space-x-4">
                  <span>{post.upvotesCount} Upvotes</span>
                  <span>{post.commentsCount} Comments</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
