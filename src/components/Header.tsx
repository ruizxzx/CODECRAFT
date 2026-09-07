import React, { useState } from 'react';
import { PageView, SiteConfig, CommunityUser } from '../types';
import { auth, loginWithGoogle, logout, ADMIN_EMAILS } from '../lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { 
  Menu, 
  X, 
  Search, 
  BookOpen, 
  Sparkles, 
  ArrowRight, 
  LogIn, 
  LogOut, 
  User, 
  AtSign, 
  Bookmark, 
  Home, 
  Users, 
  ShieldAlert,
  Settings
} from 'lucide-react';

interface HeaderProps {
  currentPage: PageView;
  onNavigate: (page: PageView, slug?: string) => void;
  onOpenSearch: () => void;
  onOpenCms?: () => void;
  savedCount: number;
  siteConfig: SiteConfig;
  userProfile?: CommunityUser | null;
  onOpenHandleModal?: () => void;
}

interface NavLinkItem {
  label: string;
  page: PageView;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentPage,
  onNavigate,
  onOpenSearch,
  onOpenCms,
  savedCount,
  siteConfig,
  userProfile,
  onOpenHandleModal,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, loading] = useAuthState(auth);

  const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());

  const mainNavLinks: NavLinkItem[] = [
    { label: 'Home', page: 'home', icon: Home },
    { label: 'Blog', page: 'blog', icon: BookOpen },
    { label: 'Community', page: 'community', icon: Users },
    { label: 'Saved', page: 'saved', count: savedCount, icon: Bookmark },
  ];

  const secondaryNavLinks = [
    { label: 'About', page: 'about' },
    { label: 'Links', page: 'links' },
    { label: 'Contact', page: 'contact' },
  ] as const;

  const handleNavClick = (page: PageView, param?: string) => {
    onNavigate(page, param);
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoogleSignIn = async () => {
    try {
      await loginWithGoogle();
    } catch (e) {
      console.error('Sign in error:', e);
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
    } catch (e) {
      console.error('Sign out error:', e);
    }
  };

  return (
    <>
      {/* Sticky Top Header - Rock solid, never glitches, never overlaps bottom content */}
      <header className="sticky top-0 z-50 w-full bg-white border-b-4 border-black neo-shadow-sm select-none">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-1.5 sm:gap-4">
          
          {/* Brand / Logo */}
          <div className="flex items-center space-x-2 shrink-0 min-w-0">
            <button
              onClick={() => handleNavClick('home')}
              className="flex items-center space-x-2 group text-left focus:outline-none p-1 border-2 border-black neo-shadow-sm hover:bg-[var(--color-primary)] transition-all active:translate-x-0.5 active:translate-y-0.5 max-w-[190px] xs:max-w-none truncate"
              title="Return to Homepage"
            >
              {siteConfig.logoImageUrl ? (
                <img 
                  src={siteConfig.logoImageUrl} 
                  alt={siteConfig.logoPart1 || 'Logo'} 
                  className="w-7 h-7 sm:w-9 sm:h-9 object-cover border border-black bg-neutral-100 shrink-0" 
                />
              ) : (
                <div className="w-7 h-7 sm:w-9 sm:h-9 bg-black text-[var(--color-primary)] flex items-center justify-center font-display font-black text-base sm:text-lg border border-black group-hover:bg-white group-hover:text-black transition-colors shrink-0">
                  {(siteConfig.logoPart1 || 'K').charAt(0)}
                </div>
              )}
              <div className="flex flex-col pr-1 min-w-0">
                <span className="font-display font-black text-base sm:text-2xl tracking-tighter leading-none text-black truncate">
                  {siteConfig.logoPart1 || 'KRISH'}<span className="text-[var(--color-accent)]">{siteConfig.logoPart2 || 'FICIENT'}</span>
                </span>
                <span className="font-mono text-[9px] sm:text-[10px] uppercase font-bold text-neutral-500 tracking-wider hidden xs:block">
                  DISPATCHES
                </span>
              </div>
            </button>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            {mainNavLinks.map((link) => {
              const isActive = currentPage === link.page;
              const Icon = link.icon;
              return (
                <button
                  key={link.page}
                  onClick={() => handleNavClick(link.page as PageView)}
                  className={`px-3 py-2 lg:px-4 lg:py-2.5 flex items-center space-x-1.5 font-display font-black text-xs uppercase transition-all box-border ${
                    isActive 
                      ? 'bg-[var(--color-primary)] text-black border-2 border-black neo-shadow-sm' 
                      : 'border-2 border-transparent text-neutral-800 hover:text-black hover:border-black hover:bg-neutral-100'
                  }`}
                >
                  <Icon className="w-4 h-4 stroke-[2.5]" />
                  <span>{link.label}</span>
                  {link.page === 'saved' && link.count !== undefined && link.count > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 bg-black text-[var(--color-primary)] text-[10px] font-mono font-bold border border-black">
                      {link.count}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Extra desktop links */}
            <button
              onClick={() => handleNavClick('about')}
              className={`px-3 py-2 font-display font-black text-xs uppercase transition-all ${
                currentPage === 'about'
                  ? 'bg-[var(--color-primary)] text-black border-2 border-black neo-shadow-sm'
                  : 'border-2 border-transparent text-neutral-800 hover:text-black hover:border-black hover:bg-neutral-100'
              }`}
            >
              About
            </button>
          </nav>

          {/* Right Action Controls */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            
            {/* Search Button */}
            <button
              onClick={onOpenSearch}
              className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-white border-2 border-black neo-shadow-sm hover:bg-[var(--color-primary)] active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center space-x-1.5 text-black font-display text-xs font-black uppercase"
              title="Search Articles (Ctrl+K)"
            >
              <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
              <span className="hidden sm:inline">SEARCH</span>
              <kbd className="hidden lg:inline-block px-1 bg-neutral-200 border border-black font-mono text-[9px] text-neutral-700">
                ⌘K
              </kbd>
            </button>

            {/* Admin Studio Trigger (Available for admins or anyone with handler) */}
            {onOpenCms && (
              <button
                onClick={onOpenCms}
                className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-black text-[var(--color-primary)] border-2 border-black neo-shadow-sm hover:bg-[var(--color-primary)] hover:text-black active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center space-x-1.5 font-mono text-xs font-bold uppercase"
                title="Open Admin Studio CMS"
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">ADMIN</span>
              </button>
            )}

            {/* User Profile / Auth Button (Desktop) */}
            <div className="hidden sm:flex items-center">
              {!loading && (
                <>
                  {!user ? (
                    <button
                      onClick={handleGoogleSignIn}
                      className="px-3 py-2 bg-[var(--color-accent)] text-black font-display font-black text-xs uppercase border-2 border-black neo-shadow-sm flex items-center space-x-1.5 hover:bg-[var(--color-primary)] active:translate-x-0.5 active:translate-y-0.5 transition-all"
                    >
                      <LogIn className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>SIGN IN</span>
                    </button>
                  ) : (
                    <div className="flex items-center space-x-2">
                      {userProfile ? (
                        <button
                          onClick={() => handleNavClick('community_profile', userProfile.username)}
                          className="px-2.5 py-1.5 bg-neutral-100 hover:bg-[var(--color-secondary)] border-2 border-black font-mono text-xs font-bold flex items-center space-x-2 neo-shadow-sm active:translate-x-0.5 active:translate-y-0.5 transition-all"
                          title="View your community profile"
                        >
                          {userProfile.photoURL ? (
                            <img src={userProfile.photoURL} alt="" className="w-5 h-5 border border-black object-cover shrink-0" />
                          ) : (
                            <User className="w-4 h-4 text-black" />
                          )}
                          <span className="max-w-[100px] truncate">@{userProfile.username}</span>
                        </button>
                      ) : (
                        <button
                          onClick={onOpenHandleModal}
                          className="px-2.5 py-1.5 bg-[var(--color-accent)] text-black border-2 border-black font-display text-xs font-black uppercase flex items-center space-x-1 animate-pulse neo-shadow-sm"
                        >
                          <AtSign className="w-3.5 h-3.5" />
                          <span>CLAIM @HANDLE</span>
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Saved Count Shortcut (Mobile only) */}
            <button
              onClick={() => handleNavClick('saved')}
              className="md:hidden relative p-2 bg-white border-2 border-black neo-shadow-sm hover:bg-neutral-100 transition-colors"
              title="Saved Articles"
            >
              <Bookmark className="w-4 h-4 stroke-[2.5]" />
              {savedCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-black text-[var(--color-primary)] px-1 py-0.2 text-[9px] font-mono font-bold border border-black">
                  {savedCount}
                </span>
              )}
            </button>

            {/* Mobile / Full Menu Hamburger Button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 sm:px-3 sm:py-2 bg-white border-2 border-black neo-shadow-sm hover:bg-[var(--color-primary)] active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center space-x-1.5 font-display font-black text-xs uppercase"
              aria-label="Toggle navigation drawer"
            >
              <Menu className="w-5 h-5 sm:w-4 sm:h-4 stroke-[2.5]" />
              <span className="hidden sm:inline">MENU</span>
            </button>
          </div>

        </div>
      </header>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-xs transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Panel */}
      <div className={`fixed top-0 right-0 h-full w-full sm:w-88 max-w-sm bg-white border-l-4 border-black z-[70] transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col shadow-2xl`}>
        
        {/* Drawer Header */}
        <div className="p-4 border-b-4 border-black flex items-center justify-between bg-[var(--color-primary)]">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 fill-black text-black" />
            <span className="font-display font-black text-xl uppercase tracking-tight text-black">
              NAVIGATION
            </span>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)} 
            className="p-2 bg-white border-2 border-black neo-shadow-sm hover:bg-neutral-100 active:translate-x-0.5 active:translate-y-0.5 transition-all"
            aria-label="Close menu"
          >
            <X className="w-5 h-5 stroke-[3]" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          
          {/* Search Trigger */}
          <div>
            <h3 className="font-mono text-xs font-bold uppercase text-neutral-500 mb-2">Search Dispatches</h3>
            <button
              onClick={() => { onOpenSearch(); setSidebarOpen(false); }}
              className="w-full py-3 px-4 bg-white border-2 border-black neo-shadow-sm hover:bg-[var(--color-primary)] active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center justify-between text-black font-display text-sm font-black uppercase"
            >
              <div className="flex items-center space-x-2">
                <Search className="w-4 h-4 stroke-[3]" />
                <span>Search Articles</span>
              </div>
              <span className="font-mono text-[10px] text-neutral-500">CTRL+K</span>
            </button>
          </div>
          
          {/* Main Links */}
          <div>
            <h3 className="font-mono text-xs font-bold uppercase text-neutral-500 mb-2">Main Sections</h3>
            <div className="flex flex-col gap-2">
              {mainNavLinks.map((link) => {
                const Icon = link.icon;
                const isActive = currentPage === link.page;
                return (
                  <button
                    key={link.page}
                    onClick={() => handleNavClick(link.page as PageView)}
                    className={`w-full text-left py-3 px-4 font-display font-black text-sm uppercase border-2 border-black transition-all flex items-center justify-between ${
                      isActive
                        ? 'bg-[var(--color-primary)] text-black neo-shadow-sm'
                        : 'bg-white text-black hover:bg-neutral-100 neo-shadow-sm active:translate-x-0.5 active:translate-y-0.5'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <Icon className="w-4 h-4 stroke-[2.5]" />
                      <span>{link.label}</span>
                    </div>
                    {link.count !== undefined && link.count > 0 && (
                      <span className="px-2 py-0.5 bg-black text-[var(--color-primary)] text-xs font-mono font-bold border border-black">
                        {link.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Editorial Pages */}
          <div>
            <h3 className="font-mono text-xs font-bold uppercase text-neutral-500 mb-2">Editorial</h3>
            <div className="flex flex-col gap-2">
              {secondaryNavLinks.map((link) => (
                <button
                  key={link.page}
                  onClick={() => handleNavClick(link.page as PageView)}
                  className={`w-full text-left py-3 px-4 font-display font-black text-sm uppercase border-2 border-black transition-all flex items-center justify-between ${
                    currentPage === link.page
                      ? 'bg-black text-white neo-shadow-sm'
                      : 'bg-white text-black hover:bg-neutral-100 neo-shadow-sm active:translate-x-0.5 active:translate-y-0.5'
                  }`}
                >
                  <span>{link.label}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>

          {/* Admin Studio Trigger in Drawer */}
          {onOpenCms && (
            <div>
              <h3 className="font-mono text-xs font-bold uppercase text-neutral-500 mb-2">Management</h3>
              <button
                onClick={() => { onOpenCms(); setSidebarOpen(false); }}
                className="w-full py-3 px-4 bg-black text-[var(--color-primary)] font-display font-black text-sm uppercase border-2 border-black neo-shadow-sm flex items-center justify-between hover:bg-[var(--color-primary)] hover:text-black active:translate-x-0.5 active:translate-y-0.5 transition-all"
              >
                <div className="flex items-center space-x-2">
                  <Settings className="w-4 h-4" />
                  <span>OPEN ADMIN STUDIO</span>
                </div>
                <span className="font-mono text-[10px] bg-neutral-800 text-white px-2 py-0.5 border border-black">CMS</span>
              </button>
            </div>
          )}

          {/* User Auth Section */}
          <div className="mt-auto pt-6 border-t-4 border-black">
            <h3 className="font-mono text-xs font-bold uppercase text-neutral-500 mb-3">Reader Account</h3>
            {!loading && (
              <>
                {!user ? (
                  <button
                    onClick={() => { handleGoogleSignIn(); setSidebarOpen(false); }}
                    className="w-full py-3 bg-[var(--color-accent)] text-black font-display font-black text-sm uppercase border-2 border-black neo-shadow-sm flex items-center justify-center space-x-2 active:translate-x-0.5 active:translate-y-0.5 transition-all"
                  >
                    <LogIn className="w-4 h-4 stroke-[3]" />
                    <span>SIGN IN WITH GOOGLE</span>
                  </button>
                ) : (
                  <div className="space-y-3">
                    {userProfile ? (
                      <button
                        onClick={() => handleNavClick('community_profile', userProfile.username)}
                        className="w-full py-3 px-4 bg-neutral-100 hover:bg-[var(--color-secondary)] border-2 border-black font-mono text-sm font-bold flex items-center justify-between transition-colors neo-shadow-sm active:translate-x-0.5 active:translate-y-0.5"
                      >
                        <div className="flex items-center space-x-2">
                          {userProfile.photoURL ? (
                            <img src={userProfile.photoURL} alt="" className="w-6 h-6 border border-black object-cover" />
                          ) : (
                            <User className="w-4 h-4 text-black" />
                          )}
                          <span>@{userProfile.username}</span>
                        </div>
                        <span className="text-[10px] uppercase underline">Profile</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => { onOpenHandleModal?.(); setSidebarOpen(false); }}
                        className="w-full py-3 px-4 bg-[var(--color-accent)] hover:bg-[var(--color-primary)] text-black border-2 border-black font-display text-sm font-black uppercase flex items-center justify-center space-x-2 animate-pulse neo-shadow-sm"
                      >
                        <AtSign className="w-4 h-4 stroke-[3]" />
                        <span>CLAIM YOUR @HANDLE</span>
                      </button>
                    )}
                    <button
                      onClick={() => { handleSignOut(); setSidebarOpen(false); }}
                      className="w-full py-2.5 bg-white hover:bg-red-100 text-black hover:text-red-700 border-2 border-black font-mono text-xs font-bold uppercase transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

        </div>
      </div>
    </>
  );
};
