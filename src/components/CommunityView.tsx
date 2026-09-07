import React, { useState, useEffect } from 'react';
import { CommunityUser, CommunityPost, PageView } from '../types';
import { getCommunityProfile, getPosts, deletePost } from '../lib/community';
import { auth, loginWithGoogle, checkIsAdmin } from '../lib/firebase';
import { 
  MessageSquare, 
  BookOpen, 
  PenTool, 
  Hash, 
  User, 
  Loader2, 
  Sparkles, 
  ArrowUp, 
  TrendingUp, 
  LogIn, 
  Bookmark, 
  AtSign,
  Plus,
  Trash
} from 'lucide-react';
import { CommunityEditor } from './CommunityEditor';
import { formatDisplayDate } from '../lib/dateUtils';
import { UniqueHandleModal } from './UniqueHandleModal';

interface CommunityViewProps {
  onNavigate: (page: PageView, param?: string) => void;
  userProfile?: CommunityUser | null;
  onOpenHandleModal?: () => void;
  savedCommunityPostIds?: string[];
  onToggleSaveCommunityPost?: (postId: string, title?: string) => void;
  onProfileUpdated?: (profile: CommunityUser) => void;
}

export const CommunityView: React.FC<CommunityViewProps> = ({ 
  onNavigate,
  userProfile: initialUserProfile,
  onOpenHandleModal,
  savedCommunityPostIds = [],
  onToggleSaveCommunityPost,
  onProfileUpdated
}) => {
  const [activeTab, setActiveTab] = useState<'discussions' | 'blogs'>('discussions');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isHandleModalOpen, setIsHandleModalOpen] = useState(false);
  
  const [userAuth, setUserAuth] = useState(auth.currentUser);
  const [profile, setProfile] = useState<CommunityUser | null>(initialUserProfile || null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(!initialUserProfile && !!auth.currentUser);

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  // Sync profile when initialUserProfile changes
  useEffect(() => {
    if (initialUserProfile) {
      setProfile(initialUserProfile);
    }
  }, [initialUserProfile]);
  
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      setUserAuth(user);
      if (user) {
        if (!initialUserProfile) {
          setLoadingProfile(true);
          const p = await getCommunityProfile(user.uid);
          setProfile(p);
          setLoadingProfile(false);
        }
      } else {
        setProfile(null);
        setLoadingProfile(false);
      }
    });
    return () => unsub();
  }, [initialUserProfile]);

  const loadPosts = async () => {
    setLoadingPosts(true);
    try {
      const p = await getPosts(activeTab === 'discussions' ? 'discussion' : 'blog');
      setPosts(p);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPosts(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, [activeTab]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const loggedUser = await loginWithGoogle();
      if (loggedUser) {
        const p = await getCommunityProfile(loggedUser.uid);
        if (p) {
          setProfile(p);
          onProfileUpdated?.(p);
        } else {
          // Open unique handle modal
          setIsHandleModalOpen(true);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleStartPost = () => {
    if (!userAuth) {
      handleLogin();
      return;
    }
    if (!profile) {
      if (onOpenHandleModal) {
        onOpenHandleModal();
      } else {
        setIsHandleModalOpen(true);
      }
      return;
    }
    setIsEditorOpen(true);
  };

  const handleProfileCreated = (newProfile: CommunityUser) => {
    setProfile(newProfile);
    onProfileUpdated?.(newProfile);
    setIsHandleModalOpen(false);
    setIsEditorOpen(true);
  };

  const activeUser = auth.currentUser || userAuth;
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

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-12 flex flex-col lg:flex-row gap-8">
      {/* Left Sidebar - Profile & Navigation */}
      <div className="lg:w-1/4 space-y-6">
        <div className="bg-white border-4 border-black neo-shadow p-6 space-y-4">
          <div className="flex items-center justify-between border-b-2 border-black pb-2">
            <h2 className="font-display font-black text-xl uppercase tracking-tight">Community</h2>
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-success)] border border-black animate-pulse" />
          </div>
          
          {loadingProfile ? (
            <div className="flex items-center space-x-2 text-neutral-500 font-mono text-xs py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Checking profile...</span>
            </div>
          ) : !userAuth ? (
            <div className="space-y-4">
              <p className="font-sans text-xs text-neutral-600 leading-relaxed">
                Sign in with your Google account and claim a unique <strong>@handle</strong> to publish blogs, join discussions, and save your favorites.
              </p>
              <button 
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="w-full py-3 bg-[var(--color-primary)] font-display font-black text-xs uppercase border-2 border-black neo-shadow-sm hover:translate-x-0.5 hover:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center space-x-2"
              >
                {isLoggingIn ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogIn className="w-4 h-4 stroke-[2.5]" />
                )}
                <span>Sign In With Google</span>
              </button>
            </div>
          ) : !profile ? (
            <div className="space-y-4">
              <div className="bg-[var(--color-accent)]/20 border-2 border-black p-3 font-mono text-xs">
                <div className="font-bold uppercase text-black mb-1">Authenticated via Google</div>
                <div className="text-neutral-700 truncate">{userAuth.email}</div>
              </div>
              <p className="font-sans text-xs text-neutral-600">
                You need a unique @handle before publishing or joining discussions in the community.
              </p>
              <button 
                onClick={() => setIsHandleModalOpen(true)}
                className="w-full py-2.5 bg-[var(--color-primary)] font-display font-black text-xs uppercase border-2 border-black neo-shadow-sm hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center space-x-2"
              >
                <AtSign className="w-4 h-4 stroke-[2.5]" />
                <span>Claim Unique @Handle</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                {profile.photoURL ? (
                  <img src={profile.photoURL} alt={profile.displayName} className="w-12 h-12 rounded-full border-2 border-black object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[var(--color-secondary)] border-2 border-black flex items-center justify-center font-bold">
                    {profile.displayName.charAt(0)}
                  </div>
                )}
                <div className="overflow-hidden">
                  <div className="font-bold font-display leading-tight truncate">{profile.displayName}</div>
                  <button 
                    onClick={() => onNavigate('community_profile', profile.username)}
                    className="font-mono text-xs font-bold text-neutral-600 hover:text-[var(--color-primary)] hover:underline block truncate"
                  >
                    @{profile.username}
                  </button>
                </div>
              </div>

              <button 
                onClick={handleStartPost}
                className="w-full py-3 bg-[var(--color-primary)] font-display font-black text-sm uppercase border-2 border-black neo-shadow-sm hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all flex items-center justify-center space-x-2"
              >
                <PenTool className="w-4 h-4 stroke-[2.5]" />
                <span>Write a Post</span>
              </button>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white border-4 border-black neo-shadow p-2 font-mono text-xs font-bold uppercase flex flex-col space-y-1">
          <button 
            onClick={() => setActiveTab('discussions')}
            className={`flex items-center justify-between p-3 transition-colors border border-transparent ${
              activeTab === 'discussions' ? 'bg-black text-white' : 'hover:bg-neutral-100 text-black'
            }`}
          >
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-4 h-4" />
              <span>Discussions</span>
            </div>
            {activeTab === 'discussions' && <span className="text-[var(--color-primary)] font-black">●</span>}
          </button>
          <button 
            onClick={() => setActiveTab('blogs')}
            className={`flex items-center justify-between p-3 transition-colors border border-transparent ${
              activeTab === 'blogs' ? 'bg-black text-white' : 'hover:bg-neutral-100 text-black'
            }`}
          >
            <div className="flex items-center space-x-2">
              <BookOpen className="w-4 h-4" />
              <span>Community Blogs</span>
            </div>
            {activeTab === 'blogs' && <span className="text-[var(--color-primary)] font-black">●</span>}
          </button>
        </div>

        {/* Community Guidelines Card */}
        <div className="bg-neutral-50 border-2 border-black p-4 font-mono text-xs space-y-2">
          <div className="font-bold uppercase text-neutral-800">Community Rules</div>
          <p className="text-neutral-600 leading-relaxed">
            • Constructive tech discussions only.
            <br />• Official dispatches belong to the main blog; user writeups belong in Community Blogs.
            <br />• Unique @handles represent your public identity.
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="lg:w-3/4 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b-4 border-black gap-4">
          <div className="flex items-center space-x-3">
            {activeTab === 'discussions' ? (
              <Hash className="w-8 h-8 text-[var(--color-secondary)] stroke-[3]" />
            ) : (
              <Sparkles className="w-8 h-8 text-[var(--color-accent)] stroke-[3]" />
            )}
            <div>
              <h1 className="font-display font-black text-3xl sm:text-4xl uppercase tracking-tighter">
                {activeTab === 'discussions' ? 'Community Discussions' : 'Community Engineering Blogs'}
              </h1>
              <p className="font-sans text-xs text-neutral-500 mt-0.5">
                {activeTab === 'discussions' 
                  ? 'Ask technical questions, share insights, and discuss architectural paradigms.' 
                  : 'Long-form engineering deep-dives authored by verified community builders.'}
              </p>
            </div>
          </div>

          <button
            onClick={handleStartPost}
            className="self-start sm:self-auto px-4 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-secondary)] text-black border-2 border-black font-display font-black text-xs uppercase neo-shadow-sm flex items-center space-x-1.5 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>{activeTab === 'discussions' ? 'Start Discussion' : 'Publish Blog'}</span>
          </button>
        </div>

        {loadingPosts ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-black" />
            <span className="font-mono text-xs uppercase font-bold text-neutral-500">Loading {activeTab}...</span>
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white border-4 border-dashed border-black p-12 text-center space-y-4">
            <h3 className="font-display font-black text-2xl uppercase">No {activeTab} yet</h3>
            <p className="font-sans text-neutral-600 max-w-md mx-auto text-sm">
              Be the first community member to contribute a {activeTab === 'discussions' ? 'topic' : 'blog post'} to the network!
            </p>
            <button 
              onClick={handleStartPost}
              className="px-6 py-3 bg-[var(--color-primary)] font-display font-black text-sm uppercase border-2 border-black neo-shadow-sm hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
            >
              Create First {activeTab === 'discussions' ? 'Discussion' : 'Blog'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map(post => {
              const isPostSaved = savedCommunityPostIds.includes(post.id);
              return (
                <div 
                  key={post.id}
                  onClick={() => onNavigate('community_post', post.id)}
                  className="bg-white border-4 border-black p-5 sm:p-6 cursor-pointer neo-shadow-sm hover:-translate-y-1 hover:neo-shadow transition-all group"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2.5 py-0.5 border border-black font-mono text-[10px] font-black uppercase ${
                        post.type === 'blog' ? 'bg-[var(--color-accent)] text-black' : 'bg-[var(--color-secondary)] text-black'
                      }`}>
                        {post.type === 'blog' ? 'Community Blog' : 'Discussion'}
                      </span>
                      {post.isFeatured && (
                        <div className="inline-flex items-center space-x-1 bg-[var(--color-primary)] text-black px-2 py-0.5 text-[10px] font-mono font-black uppercase border border-black">
                          <TrendingUp className="w-3 h-3" />
                          <span>Featured</span>
                        </div>
                      )}
                    </div>

                    {/* Actions: Delete & Bookmark */}
                    <div className="flex items-center space-x-2">
                      {((auth.currentUser || userAuth)?.uid === post.authorId || checkIsAdmin((auth.currentUser || userAuth)?.email)) && (
                        <button
                          onClick={(e) => handleDeletePost(post.id, post.authorId, e)}
                          className="p-1.5 bg-red-100 hover:bg-red-200 text-red-700 border-2 border-black transition-colors"
                          title="Delete post"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onToggleSaveCommunityPost && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleSaveCommunityPost(post.id, post.title);
                          }}
                          className={`p-1.5 border-2 border-black transition-colors ${
                            isPostSaved ? 'bg-[var(--color-primary)] text-black' : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
                          }`}
                          title={isPostSaved ? 'Remove from saved' : 'Save post'}
                        >
                          <Bookmark className={`w-3.5 h-3.5 ${isPostSaved ? 'fill-black stroke-black' : ''}`} />
                        </button>
                      )}
                    </div>
                  </div>

                  <h3 className="font-display font-black text-xl sm:text-2xl group-hover:text-[var(--color-primary)] transition-colors line-clamp-2">
                    {post.title}
                  </h3>
                  
                  {/* Content Excerpt */}
                  <p className="font-sans text-neutral-600 mt-2 line-clamp-2 text-sm leading-relaxed">
                    {post.content}
                  </p>

                  <div className="mt-4 pt-4 border-t-2 border-neutral-100 flex items-center justify-between font-mono text-xs">
                    <div className="flex items-center space-x-2.5">
                      <button 
                        onClick={(e) => { e.stopPropagation(); onNavigate('community_profile', post.authorUsername); }}
                        className="flex items-center space-x-2 hover:underline"
                      >
                        {post.authorAvatar ? (
                          <img src={post.authorAvatar} alt="" className="w-6 h-6 rounded-full border border-black object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-neutral-200 border border-black flex items-center justify-center text-[10px] font-bold">
                            @
                          </div>
                        )}
                        <span className="font-bold text-black">@{post.authorUsername}</span>
                      </button>
                      <span className="text-neutral-400">&bull;</span>
                      <span className="text-neutral-500">{formatDisplayDate(post.createdAt)}</span>
                    </div>

                    <div className="flex items-center space-x-4 text-neutral-700">
                      <div className="flex items-center space-x-1 font-bold">
                        <ArrowUp className="w-3.5 h-3.5" />
                        <span>{post.upvotesCount || 0}</span>
                      </div>
                      <div className="flex items-center space-x-1 font-bold">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>{post.commentsCount || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Write Post / Blog Editor Modal */}
      {isEditorOpen && profile && (
        <CommunityEditor 
          profile={profile} 
          defaultType={activeTab === 'discussions' ? 'discussion' : 'blog'}
          onClose={() => setIsEditorOpen(false)}
          onPublished={(post) => {
            setIsEditorOpen(false);
            setPosts([post, ...posts]);
            onNavigate('community_post', post.id);
          }}
        />
      )}

      {/* Unique Handle Onboarding Modal */}
      <UniqueHandleModal
        isOpen={isHandleModalOpen}
        onClose={() => setIsHandleModalOpen(false)}
        currentUser={userAuth}
        onProfileCreated={handleProfileCreated}
      />
    </div>
  );
};
