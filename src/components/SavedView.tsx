import React, { useEffect, useState } from 'react';
import { Article, PageView, CommunityPost, CommunityUser, SiteConfig } from '../types';
import { ArticleCard } from './ArticleCard';
import { Bookmark, ArrowRight, Trash2, CheckCircle2, Cloud, Sparkles, MessageSquare, ThumbsUp, LogIn } from 'lucide-react';
import { getPost } from '../lib/community';
import { loginWithGoogle } from '../lib/firebase';
import { User as FirebaseUser } from 'firebase/auth';

interface SavedViewProps {
  savedSlugs: string[];
  savedCommunityPostIds: string[];
  articles: Article[];
  onNavigate: (page: PageView, param?: string) => void;
  onToggleSaveArticle: (slug: string) => void;
  onToggleSaveCommunityPost: (postId: string) => void;
  userAuth?: FirebaseUser | null;
  userProfile?: CommunityUser | null;
  siteConfig?: SiteConfig;
}

export const SavedView: React.FC<SavedViewProps> = ({ 
  savedSlugs, 
  savedCommunityPostIds,
  articles, 
  onNavigate, 
  onToggleSaveArticle,
  onToggleSaveCommunityPost,
  userAuth,
  userProfile,
  siteConfig
}) => {
  const [savedPosts, setSavedPosts] = useState<CommunityPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'dispatches' | 'community'>('all');

  // Filter site articles
  const savedArticles = articles.filter(a => savedSlugs.includes(a.slug));

  useEffect(() => {
    let isMounted = true;
    const loadSavedCommunityPosts = async () => {
      if (savedCommunityPostIds.length === 0) {
        setSavedPosts([]);
        return;
      }
      setLoadingPosts(true);
      try {
        const results = await Promise.all(
          savedCommunityPostIds.map(id => getPost(id))
        );
        if (isMounted) {
          setSavedPosts(results.filter((p): p is CommunityPost => p !== null));
        }
      } catch (err) {
        console.error("Failed to load saved community posts", err);
      } finally {
        if (isMounted) setLoadingPosts(false);
      }
    };

    loadSavedCommunityPosts();
    return () => { isMounted = false; };
  }, [savedCommunityPostIds]);

  const totalSaved = savedArticles.length + savedPosts.length;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
      {/* Header Banner */}
      <div className="bg-white border-4 border-black p-6 sm:p-8 neo-shadow mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-[var(--color-primary)] border-2 border-black neo-shadow-sm">
              <Bookmark className="w-8 h-8 text-black stroke-[3]" />
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="font-display font-black text-3xl sm:text-4xl uppercase tracking-tight text-black">
                  Saved Library
                </h1>
                <span className="px-2.5 py-0.5 bg-black text-[var(--color-primary)] font-mono text-sm font-black border-2 border-black">
                  {totalSaved} ITEMS
                </span>
              </div>
              <p className="font-sans text-sm text-neutral-600 mt-1">
                Universal archive for official dispatches and community engineering posts.
              </p>
            </div>
          </div>

          {/* Sync Status Pill */}
          <div className="flex items-center self-start md:self-auto">
            {userAuth ? (
              <div className="px-3.5 py-2 bg-neutral-100 border-2 border-black font-mono text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 stroke-[3]" />
                <span className="font-bold">
                  Synced with Google {userProfile ? `(@${userProfile.username})` : `(${userAuth.email})`}
                </span>
              </div>
            ) : (
              <button
                onClick={() => loginWithGoogle()}
                className="px-3.5 py-2 bg-[var(--color-secondary)] hover:bg-[var(--color-primary)] border-2 border-black font-mono text-xs font-bold flex items-center space-x-2 neo-shadow-sm transition-all active:translate-x-0.5 active:translate-y-0.5"
                title="Sign in with Google to sync across devices"
              >
                <LogIn className="w-4 h-4 stroke-[2.5]" />
                <span>SIGN IN TO SYNC SAVED POSTS</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex flex-wrap gap-2 pt-6 mt-6 border-t-2 border-black">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-4 py-2 font-display font-black text-xs uppercase border-2 border-black transition-all ${
              activeFilter === 'all'
                ? 'bg-black text-white neo-shadow-sm'
                : 'bg-white text-black hover:bg-neutral-100'
            }`}
          >
            All Saved ({totalSaved})
          </button>
          <button
            onClick={() => setActiveFilter('dispatches')}
            className={`px-4 py-2 font-display font-black text-xs uppercase border-2 border-black transition-all ${
              activeFilter === 'dispatches'
                ? 'bg-[var(--color-primary)] text-black neo-shadow-sm'
                : 'bg-white text-black hover:bg-neutral-100'
            }`}
          >
            Dispatches ({savedArticles.length})
          </button>
          <button
            onClick={() => setActiveFilter('community')}
            className={`px-4 py-2 font-display font-black text-xs uppercase border-2 border-black transition-all ${
              activeFilter === 'community'
                ? 'bg-[var(--color-accent)] text-black neo-shadow-sm'
                : 'bg-white text-black hover:bg-neutral-100'
            }`}
          >
            Community Posts ({savedPosts.length})
          </button>
        </div>
      </div>

      {/* Main Content Sections */}
      {totalSaved === 0 ? (
        <div className="bg-neutral-50 border-4 border-dashed border-black p-12 text-center my-12">
          <Bookmark className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
          <h2 className="font-display font-black text-2xl uppercase mb-2">No Saved Items Found</h2>
          <p className="font-sans text-neutral-600 max-w-md mx-auto mb-6 text-sm">
            Save articles from the main blog or discussions from the community to read them later in this unified offline-ready vault.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => onNavigate('blog')}
              className="px-5 py-2.5 bg-[var(--color-primary)] font-display font-black text-xs uppercase border-2 border-black neo-shadow-sm hover:translate-x-0.5 hover:translate-y-0.5 transition-transform flex items-center space-x-2"
            >
              <span>Explore Dispatches</span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </button>
            <button
              onClick={() => onNavigate('community')}
              className="px-5 py-2.5 bg-[var(--color-accent)] font-display font-black text-xs uppercase border-2 border-black neo-shadow-sm hover:translate-x-0.5 hover:translate-y-0.5 transition-transform flex items-center space-x-2"
            >
              <span>Explore Community</span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Site Articles Section */}
          {(activeFilter === 'all' || activeFilter === 'dispatches') && (
            <section>
              <div className="flex items-center justify-between border-b-4 border-black pb-3 mb-6">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 bg-[var(--color-primary)] border-2 border-black" />
                  <h2 className="font-display font-black text-2xl uppercase tracking-tight">
                    Main Dispatches & Articles
                  </h2>
                </div>
                <span className="font-mono text-xs font-bold text-neutral-600">
                  {savedArticles.length} {savedArticles.length === 1 ? 'Article' : 'Articles'}
                </span>
              </div>

              {savedArticles.length === 0 ? (
                <p className="font-mono text-sm text-neutral-500 italic py-4">
                  No main site dispatches saved. Click the bookmark icon on any blog article to add it here.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {savedArticles.map(article => (
                    <ArticleCard
                      key={article.id}
                      article={article}
                      onSelect={(slug) => onNavigate('article', slug)}
                      isSaved={true}
                      onToggleSave={onToggleSaveArticle}
                      siteConfig={siteConfig}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Community Posts Section */}
          {(activeFilter === 'all' || activeFilter === 'community') && (
            <section>
              <div className="flex items-center justify-between border-b-4 border-black pb-3 mb-6">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 bg-[var(--color-accent)] border-2 border-black" />
                  <h2 className="font-display font-black text-2xl uppercase tracking-tight">
                    Community Posts & Blogs
                  </h2>
                </div>
                <span className="font-mono text-xs font-bold text-neutral-600">
                  {savedPosts.length} {savedPosts.length === 1 ? 'Post' : 'Posts'}
                </span>
              </div>

              {savedPosts.length === 0 ? (
                <p className="font-mono text-sm text-neutral-500 italic py-4">
                  No community posts saved. Click the bookmark icon on any community blog or discussion to add it here.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {savedPosts.map(post => (
                    <div 
                      key={post.id}
                      className="bg-white border-4 border-black p-5 neo-shadow-sm hover:-translate-y-1 hover:neo-shadow transition-all group flex flex-col h-full justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className={`px-2.5 py-0.5 border-2 border-black font-mono text-[11px] font-black uppercase ${
                            post.type === 'blog' ? 'bg-[var(--color-accent)] text-black' : 'bg-[var(--color-secondary)] text-black'
                          }`}>
                            {post.type === 'blog' ? 'Community Blog' : 'Discussion'}
                          </span>
                          
                          <button
                            onClick={() => onToggleSaveCommunityPost(post.id)}
                            className="p-1.5 bg-neutral-100 hover:bg-red-100 border-2 border-black text-black hover:text-red-700 transition-colors"
                            title="Remove from saved"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <h3 
                          onClick={() => onNavigate('community_post', post.id)}
                          className="font-display font-black text-xl group-hover:text-[var(--color-primary)] transition-colors line-clamp-2 mb-3 cursor-pointer"
                        >
                          {post.title}
                        </h3>

                        <p className="font-sans text-sm text-neutral-600 line-clamp-3 mb-4">
                          {post.content}
                        </p>
                      </div>

                      <div className="pt-4 border-t-2 border-black flex items-center justify-between font-mono text-xs font-bold">
                        <div className="flex items-center space-x-2 truncate">
                          {post.authorAvatar ? (
                            <img src={post.authorAvatar} alt="" className="w-5 h-5 rounded-full border border-black object-cover" />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-neutral-200 border border-black flex items-center justify-center text-[10px]">
                              @
                            </div>
                          )}
                          <span className="truncate">@{post.authorUsername}</span>
                        </div>

                        <div className="flex items-center space-x-3 text-neutral-600">
                          <span className="flex items-center space-x-1">
                            <ThumbsUp className="w-3.5 h-3.5" />
                            <span>{post.upvotesCount || 0}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>{post.commentsCount || 0}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
};
