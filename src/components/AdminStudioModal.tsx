import { notifyToast } from '../lib/toast';
import { MediaUploadButton } from './MediaUploadButton';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getDraftSnapshot, saveDraftSnapshot, deleteDraftSnapshot } from '../lib/account';
import { calculateArticleReadingTime } from '../lib/reading';
import { Article, Category, SiteConfig, BentoLink, CarouselSlide, CarouselElement, MarqueeItem, FooterLink, BlogHeaderConfig, PageView } from '../types';
import { 
  X, 
  PlusCircle, 
  Check, 
  Settings, 
  Trash2, 
  Smartphone, 
  Link as LinkIcon, 
  ArrowUp, 
  ArrowDown, 
  Edit2, 
  Shield, 
  Layout, 
  RefreshCw, 
  Database,
  Lock,
  ExternalLink,
  Sparkles,
  AlertTriangle,
  Image as ImageIcon,
  Video,
  Type,
  Quote,
  List,
  Move,
  Minus,
  Plus,
  Trash,
  BadgeCheck,
  MousePointer2,
  Layers,
  History,
  Copy,
  Eye,
  GitCompare,
  Clock3,
  CheckCircle2,
  UploadCloud
} from 'lucide-react';
import { loginWithGoogle, auth, logout, checkIsAdmin, ADMIN_EMAILS } from '../lib/firebase';
import { resolveMasterAccess } from '../lib/masterControl';
import { isPlatformModerator } from '../lib/social';
import { 
  saveArticle, 
  getArticleRevisions,
  restoreArticleRevision,
  duplicateArticleFromRevision,
  deleteArticle, 
  saveSiteConfig,
  getSiteConfig,
  saveBentoLinks, 
  setArticleFeaturedStatus,
  syncAuthorToAllCloudArticles,
  syncAdminAuthorProfile
} from '../lib/cms';
import { 
  getCarouselSlides, 
  addCarouselSlide, 
  updateCarouselSlide, 
  deleteCarouselSlide,
  setUserVerificationByUsername,
  getUserVerificationByUsername
} from '../lib/community';
import { SocialAdminPanel } from './SocialAdminPanel';
import { CarouselBuilder } from './CarouselBuilder';
import { AdminControlPanel } from './AdminControlPanel';
import { createSeries, deleteSeries, getSeriesList, updateSeries } from '../lib/series';
import type { Series } from '../types';

interface AdminStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onArticlePublished: (article: Article) => void;
  articles: Article[];
  onDeleteArticle: (slug: string) => void;
  siteConfig: SiteConfig;
  onUpdateSiteConfig: (config: SiteConfig) => void;
  bentoLinks: BentoLink[];
  onUpdateBentoLinks: (links: BentoLink[]) => void;
  initialArticleRequest?: { mode: 'new' | 'edit'; article?: Article; token: number } | null;
  pageMode?: boolean;
}



export const AdminStudioModal: React.FC<AdminStudioModalProps> = ({
  isOpen,
  onClose,
  onArticlePublished,
  articles,
  onDeleteArticle,
  siteConfig,
  onUpdateSiteConfig,
  bentoLinks,
  onUpdateBentoLinks,
  initialArticleRequest,
  pageMode = false
}) => {
  const brandName = `${siteConfig.logoPart1 || ''}${siteConfig.logoPart2 || ''}`.trim() || 'OFFSCRPT';
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      const master = !!user && await resolveMasterAccess(user);
      const moderator = !!user && !master && await isPlatformModerator(user.uid);
      setIsAuthenticated(master || moderator);
      setIsModerator(moderator);
      setCurrentUserEmail(user?.email || null);
      if (moderator) setActiveTab('social');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isOpen || !isAuthenticated || isModerator || !initialArticleRequest) return;
    if (initialArticleRequest.mode === 'edit' && initialArticleRequest.article) handleEditArticle(initialArticleRequest.article);
    else { resetForm(); setActiveTab('create'); }
  }, [initialArticleRequest?.token, isOpen, isAuthenticated, isModerator]);

  const handleLogin = async () => {
    setLoginError(null);
    try {
      setIsLoggingIn(true);
      const user = await loginWithGoogle();
      if (user && await resolveMasterAccess(user)) {
        setIsAuthenticated(true);
        setIsModerator(false);
        setCurrentUserEmail(user.email || null);
      } else if (user && await isPlatformModerator(user.uid)) {
        setIsAuthenticated(true);
        setIsModerator(true);
        setCurrentUserEmail(user.email || null);
        setActiveTab('social');
      } else {
        setLoginError(`Access Denied: ${user?.email || 'Your account'} is not an authorized administrator or moderator. Master accounts: ${ADMIN_EMAILS.join(', ')}`);
        await logout();
      }
    } catch (error: any) {
      console.error("Login failed", error);
      setLoginError(error.message || "Google Sign-In failed.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setIsAuthenticated(false);
    setCurrentUserEmail(null);
  };

  const panelScrollClass = pageMode ? 'overflow-y-auto' : 'max-h-[70vh] overflow-y-auto';

  const [activeTab, setActiveTab] = useState<'settings' | 'create' | 'manage' | 'links' | 'carousel' | 'social' | 'control' | 'series' | 'media'>('settings');

  // Carousel State
  const [carouselSlides, setCarouselSlides] = useState<CarouselSlide[]>([]);
  const [isLoadingCarousel, setIsLoadingCarousel] = useState(false);
  const [newSlideTitle, setNewSlideTitle] = useState('');
  const [newSlideMode, setNewSlideMode] = useState<'image' | 'scratch'>('image');
  const [newSlideImageUrl, setNewSlideImageUrl] = useState('');
  const [newSlideBackgroundColor, setNewSlideBackgroundColor] = useState('#FF00A8');
  const [newSlideLinkUrl, setNewSlideLinkUrl] = useState('');
  const [newSlidePositionX, setNewSlidePositionX] = useState(50);
  const [newSlidePositionY, setNewSlidePositionY] = useState(50);
  const [newSlideZoom, setNewSlideZoom] = useState(100);
  const [newSlideShowDots, setNewSlideShowDots] = useState(true);
  const [newSlideElements, setNewSlideElements] = useState<CarouselElement[]>([]);

  // Carousel Editing State
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null);
  const [editSlideTitle, setEditSlideTitle] = useState('');
  const [editSlideMode, setEditSlideMode] = useState<'image' | 'scratch'>('image');
  const [editSlideImageUrl, setEditSlideImageUrl] = useState('');
  const [editSlideBackgroundColor, setEditSlideBackgroundColor] = useState('#FF00A8');
  const [editSlideLinkUrl, setEditSlideLinkUrl] = useState('');
  const [editSlidePositionX, setEditSlidePositionX] = useState(50);
  const [editSlidePositionY, setEditSlidePositionY] = useState(50);
  const [editSlideZoom, setEditSlideZoom] = useState(100);
  const [editSlideShowDots, setEditSlideShowDots] = useState(true);
  const [editSlideElements, setEditSlideElements] = useState<CarouselElement[]>([]);
  const [isSavingSlide, setIsSavingSlide] = useState(false);

  // Site-wide media center
  const [mediaFolder, setMediaFolder] = useState<'site' | 'articles' | 'carousel' | 'videos' | 'attachments'>('site');
  const [recentMedia, setRecentMedia] = useState<Array<{url:string;kind:'image'|'video'|'file';size:number;objectKey:string;uploadedAt:number}>>([]);

  // Deletion & Message States (No window.alert or window.confirm which fail in iframes)
  const [deletingSlideId, setDeletingSlideId] = useState<string | null>(null);
  const [isDeletingSlide, setIsDeletingSlide] = useState(false);
  const [carouselActionMessage, setCarouselActionMessage] = useState<string | null>(null);
  const [carouselErrorMessage, setCarouselErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      loadCarousel();
    }
  }, [isOpen, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) { getSeriesList(100).then(setSeriesList).catch(() => setSeriesList([])); }
  }, [isAuthenticated]);

  useEffect(() => {
    if (activeTab === 'carousel' && isAuthenticated) {
      loadCarousel();
    }
  }, [activeTab, isAuthenticated]);

  const loadCarousel = async () => {
    setIsLoadingCarousel(true);
    setCarouselErrorMessage(null);
    try {
      const slides = await getCarouselSlides();
      setCarouselSlides(slides);
    } catch (e: any) {
      console.error("Error loading carousel slides:", e);
      setCarouselErrorMessage("Failed to load slides from Firestore: " + (e.message || "Network error"));
    } finally {
      setIsLoadingCarousel(false);
    }
  };

  const handleAddSlide = async () => {
    if (newSlideMode === 'image' && !newSlideImageUrl.trim()) {
      setCarouselErrorMessage("Please provide an image URL for image mode, or switch to Build From Scratch.");
      return;
    }
    setCarouselErrorMessage(null);
    try {
      const added = await addCarouselSlide({
        title: newSlideTitle.trim(),
        mode: newSlideMode,
        imageUrl: newSlideMode === 'image' ? newSlideImageUrl.trim() : '',
        backgroundColor: newSlideBackgroundColor,
        linkUrl: newSlideLinkUrl.trim(),
        order: carouselSlides.length,
        imagePositionX: newSlidePositionX,
        imagePositionY: newSlidePositionY,
        imageZoom: newSlideZoom,
        showDots: newSlideShowDots,
        elements: newSlideElements
      });
      setCarouselSlides(prev => [...prev, added]);
      setNewSlideTitle('');
      setNewSlideMode('image');
      setNewSlideImageUrl('');
      setNewSlideBackgroundColor('#FF00A8');
      setNewSlideLinkUrl('');
      setNewSlidePositionX(50);
      setNewSlidePositionY(50);
      setNewSlideZoom(100);
      setNewSlideShowDots(true);
      setNewSlideElements([]);
      setCarouselActionMessage("New slide added and synced to cloud Firestore!");
      setTimeout(() => setCarouselActionMessage(null), 4000);
    } catch (e: any) {
      console.error("Error adding carousel slide:", e);
      setCarouselErrorMessage('Failed to add slide to Firestore: ' + (e.message || 'Permission denied'));
    }
  };

  const handleSeedDefaultSlides = async () => {
    setIsLoadingCarousel(true);
    setCarouselErrorMessage(null);
    try {
      const s1 = await addCarouselSlide({
        title: "Distributed Systems Masterclass & Architecture Deep-Dive",
        imageUrl: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1600&q=80",
        linkUrl: "/#blog",
        order: 0
      });
      const s2 = await addCarouselSlide({
        title: "Building High-Throughput TypeScript Services in 2026",
        imageUrl: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1600&q=80",
        linkUrl: "/#community",
        order: 1
      });
      setCarouselSlides([s1, s2]);
      setCarouselActionMessage("Default showcase slides created and synced to Firestore!");
      setTimeout(() => setCarouselActionMessage(null), 4000);
    } catch (e: any) {
      console.error("Error seeding default slides:", e);
      setCarouselErrorMessage("Failed to seed slides to Firestore: " + (e.message || "Permission denied"));
    } finally {
      setIsLoadingCarousel(false);
    }
  };

  const handleStartEditSlide = (slide: CarouselSlide) => {
    setEditingSlideId(slide.id);
    setEditSlideTitle(slide.title || '');
    setEditSlideMode(slide.mode || (slide.imageUrl ? 'image' : 'scratch'));
    setEditSlideImageUrl(slide.imageUrl || '');
    setEditSlideBackgroundColor(slide.backgroundColor || '#FF00A8');
    setEditSlideLinkUrl(slide.linkUrl || '');
    setEditSlidePositionX(slide.imagePositionX ?? 50);
    setEditSlidePositionY(slide.imagePositionY ?? 50);
    setEditSlideZoom(slide.imageZoom ?? 100);
    setEditSlideShowDots(slide.showDots ?? true);
    setEditSlideElements(slide.elements || []);
    setCarouselActionMessage(null);
    setCarouselErrorMessage(null);
  };

  const handleCancelEditSlide = () => {
    setEditingSlideId(null);
    setEditSlideTitle('');
    setEditSlideMode('image');
    setEditSlideImageUrl('');
    setEditSlideBackgroundColor('#FF00A8');
    setEditSlideLinkUrl('');
    setEditSlidePositionX(50);
    setEditSlidePositionY(50);
    setEditSlideZoom(100);
    setEditSlideShowDots(true);
    setEditSlideElements([]);
  };

  const handleSaveEditSlide = async (id: string) => {
    if (editSlideMode === 'image' && !editSlideImageUrl.trim()) {
      setCarouselErrorMessage("Slide image URL cannot be empty in image mode.");
      return;
    }
    setCarouselErrorMessage(null);
    setIsSavingSlide(true);
    try {
      const patch = {
        title: editSlideTitle.trim(),
        mode: editSlideMode,
        imageUrl: editSlideMode === 'image' ? editSlideImageUrl.trim() : '',
        backgroundColor: editSlideBackgroundColor,
        linkUrl: editSlideLinkUrl.trim(),
        imagePositionX: editSlidePositionX,
        imagePositionY: editSlidePositionY,
        imageZoom: editSlideZoom,
        showDots: editSlideShowDots,
        elements: editSlideElements
      };
      await updateCarouselSlide(id, patch);
      setCarouselSlides(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
      setEditingSlideId(null);
      setCarouselActionMessage("Carousel slide successfully updated in cloud Firestore!");
      setTimeout(() => setCarouselActionMessage(null), 4000);
    } catch (e: any) {
      console.error("Error saving slide:", e);
      setCarouselErrorMessage('Failed to update slide in Firestore: ' + (e.message || 'Permission denied'));
    } finally {
      setIsSavingSlide(false);
    }
  };


  const executeDeleteSlide = async (id: string) => {
    setIsDeletingSlide(true);
    setCarouselErrorMessage(null);
    try {
      await deleteCarouselSlide(id);
      setCarouselSlides(prev => prev.filter(s => s.id !== id));
      if (editingSlideId === id) {
        setEditingSlideId(null);
      }
      setDeletingSlideId(null);
      setCarouselActionMessage("Slide successfully deleted from cloud Firestore backend!");
      setTimeout(() => setCarouselActionMessage(null), 4000);
    } catch (e: any) {
      console.error("Error deleting slide from Firestore:", e);
      setCarouselErrorMessage('Failed to delete slide from Firestore: ' + (e.message || 'Permission denied or network error'));
    } finally {
      setIsDeletingSlide(false);
    }
  };

  const handleMoveSlide = async (index: number, direction: -1 | 1) => {
    if (index + direction < 0 || index + direction >= carouselSlides.length) return;
    
    const newSlides = [...carouselSlides];
    const temp = newSlides[index];
    newSlides[index] = newSlides[index + direction];
    newSlides[index + direction] = temp;
    
    newSlides.forEach((s, i) => s.order = i);
    setCarouselSlides(newSlides);
    
    try {
      await updateCarouselSlide(newSlides[index].id, { order: newSlides[index].order });
      await updateCarouselSlide(newSlides[index + direction].id, { order: newSlides[index + direction].order });
    } catch (e) {
      console.error("Error updating slide orders:", e);
    }
  };

  // Site Config Form state
  const [logoImageUrl, setLogoImageUrl] = useState(siteConfig.logoImageUrl || '');
  const [logoPart1, setLogoPart1] = useState(siteConfig.logoPart1 || 'OFF');
  const [logoPart2, setLogoPart2] = useState(siteConfig.logoPart2 || 'SCRPT');
  const [tagline, setTagline] = useState(siteConfig.tagline || '');
  const [heroHeadline, setHeroHeadline] = useState(siteConfig.heroHeadline || '');
  const [heroSubheadline, setHeroSubheadline] = useState(siteConfig.heroSubheadline || '');
  const [heroBgColor, setHeroBgColor] = useState(siteConfig.heroBgColor || '#FFFFFF');
  const [manifestoText, setManifestoText] = useState(siteConfig.manifestoText || '');
  const [manifestoAuthor, setManifestoAuthor] = useState(siteConfig.manifestoAuthor || '');
  const [authorName, setAuthorName] = useState(siteConfig.authorName || 'Krish');
  const [authorRole, setAuthorRole] = useState(siteConfig.authorRole || 'Founder & Systems Architect');
  const [authorAvatarUrl, setAuthorAvatarUrl] = useState(siteConfig.authorAvatarUrl || '');
  const [aboutMeTitle, setAboutMeTitle] = useState(siteConfig.aboutMeTitle || '');
  const [aboutMeBio, setAboutMeBio] = useState(siteConfig.aboutMeBio || '');
  
  const [themePrimaryColor, setThemePrimaryColor] = useState(siteConfig.themePrimaryColor || '#FFD600');
  const [themeSecondaryColor, setThemeSecondaryColor] = useState(siteConfig.themeSecondaryColor || '#00E0FF');
  const [themeAccentColor, setThemeAccentColor] = useState(siteConfig.themeAccentColor || '#FF60B5');
  const [themeSuccessColor, setThemeSuccessColor] = useState(siteConfig.themeSuccessColor || '#00FF41');
  
  const [footerNewsletterTitle, setFooterNewsletterTitle] = useState(siteConfig.footerNewsletterTitle || '');
  const [footerNewsletterSubtitle, setFooterNewsletterSubtitle] = useState(siteConfig.footerNewsletterSubtitle || '');
  const [footerBrandStatement, setFooterBrandStatement] = useState(siteConfig.footerBrandStatement || '');

  const defaultBlogHeader: BlogHeaderConfig = {
    eyebrow: 'THE DISPATCHES ARCHIVE',
    title: 'ENGINEERING & ARCHITECTURE',
    description: 'Rigorous, hands-on writing dissecting modern web technologies, AI agent architectures, distributed database internals, and developer productivity systems.',
    backgroundColor: themePrimaryColor || '#FFD600',
    textColor: '#000000',
    showEssayCount: true,
    essayCountLabel: 'ESSAYS PUBLISHED'
  };
  const [marqueeItems, setMarqueeItems] = useState<MarqueeItem[]>(siteConfig.marqueeItems || []);
  const [marqueeSpeedSeconds, setMarqueeSpeedSeconds] = useState(siteConfig.marqueeSpeedSeconds || 25);
  const [marqueePauseOnHover, setMarqueePauseOnHover] = useState(siteConfig.marqueePauseOnHover !== false);
  const [blogHeader, setBlogHeader] = useState<BlogHeaderConfig>(siteConfig.blogHeader || defaultBlogHeader);
  const [footerNavigationTitle, setFooterNavigationTitle] = useState(siteConfig.footerNavigationTitle || 'NAVIGATION');
  const [footerTopicsTitle, setFooterTopicsTitle] = useState(siteConfig.footerTopicsTitle || 'CURATED TOPICS');
  const [footerHubTitle, setFooterHubTitle] = useState(siteConfig.footerHubTitle || 'PUBLICATION HUB');
  const [footerNavigationLinks, setFooterNavigationLinks] = useState<FooterLink[]>(siteConfig.footerNavigationLinks || []);
  const [footerHubLinks, setFooterHubLinks] = useState<FooterLink[]>(siteConfig.footerHubLinks || []);
  const [footerTopicCategories, setFooterTopicCategories] = useState<string[]>(siteConfig.footerTopicCategories || []);
  const [footerBottomRightText, setFooterBottomRightText] = useState(siteConfig.footerBottomRightText || 'HIGH DENSITY SPECIFICATION');

  const [contactTitle, setContactTitle] = useState(siteConfig.contactTitle || '');
  const [contactSubtitle, setContactSubtitle] = useState(siteConfig.contactSubtitle || '');
  const [contactEmail, setContactEmail] = useState(siteConfig.contactEmail || '');
  const [contactTwitter, setContactTwitter] = useState(siteConfig.contactTwitter || '');
  const [contactGithub, setContactGithub] = useState(siteConfig.contactGithub || '');
  const [contactTelegram, setContactTelegram] = useState(siteConfig.contactTelegram || '');
  const [contactInstagram, setContactInstagram] = useState(siteConfig.contactInstagram || '');

  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configSuccess, setConfigSuccess] = useState(false);

  // User verification controls
  const [verificationHandle, setVerificationHandle] = useState('');
  const [verificationColor, setVerificationColor] = useState('#2196F3');
  const [verificationState, setVerificationState] = useState<'verified' | 'unverified' | null>(null);
  const [isSavingVerification, setIsSavingVerification] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);

  // Sync siteConfig prop with local state when siteConfig updates externally
  useEffect(() => {
    setLogoImageUrl(siteConfig.logoImageUrl || '');
    setLogoPart1(siteConfig.logoPart1 || 'KRISH');
    setLogoPart2(siteConfig.logoPart2 || 'FICIENT');
    setTagline(siteConfig.tagline || '');
    setHeroHeadline(siteConfig.heroHeadline || '');
    setHeroSubheadline(siteConfig.heroSubheadline || '');
    setHeroBgColor(siteConfig.heroBgColor || '#FFFFFF');
    setManifestoText(siteConfig.manifestoText || '');
    setManifestoAuthor(siteConfig.manifestoAuthor || '');
    setAuthorName(siteConfig.authorName || 'Krish');
    setAuthorRole(siteConfig.authorRole || 'Founder & Systems Architect');
    setAuthorAvatarUrl(siteConfig.authorAvatarUrl || '');
    setAboutMeTitle(siteConfig.aboutMeTitle || '');
    setAboutMeBio(siteConfig.aboutMeBio || '');
    setThemePrimaryColor(siteConfig.themePrimaryColor || '#FFD600');
    setThemeSecondaryColor(siteConfig.themeSecondaryColor || '#00E0FF');
    setThemeAccentColor(siteConfig.themeAccentColor || '#FF60B5');
    setThemeSuccessColor(siteConfig.themeSuccessColor || '#00FF41');
    setFooterNewsletterTitle(siteConfig.footerNewsletterTitle || '');
    setFooterNewsletterSubtitle(siteConfig.footerNewsletterSubtitle || '');
    setFooterBrandStatement(siteConfig.footerBrandStatement || '');
    setMarqueeItems(siteConfig.marqueeItems || []);
    setMarqueeSpeedSeconds(siteConfig.marqueeSpeedSeconds || 25);
    setMarqueePauseOnHover(siteConfig.marqueePauseOnHover !== false);
    setBlogHeader(siteConfig.blogHeader || defaultBlogHeader);
    setFooterNavigationTitle(siteConfig.footerNavigationTitle || 'NAVIGATION');
    setFooterTopicsTitle(siteConfig.footerTopicsTitle || 'CURATED TOPICS');
    setFooterHubTitle(siteConfig.footerHubTitle || 'PUBLICATION HUB');
    setFooterNavigationLinks(siteConfig.footerNavigationLinks || []);
    setFooterHubLinks(siteConfig.footerHubLinks || []);
    setFooterTopicCategories(siteConfig.footerTopicCategories || []);
    setFooterBottomRightText(siteConfig.footerBottomRightText || 'HIGH DENSITY SPECIFICATION');
    setContactTitle(siteConfig.contactTitle || '');
    setContactSubtitle(siteConfig.contactSubtitle || '');
    setContactEmail(siteConfig.contactEmail || '');
    setContactTwitter(siteConfig.contactTwitter || '');
    setContactGithub(siteConfig.contactGithub || '');
    setContactTelegram(siteConfig.contactTelegram || '');
    setContactInstagram(siteConfig.contactInstagram || '');
    setCustomCategories(siteConfig.customCategories || []);
  }, [siteConfig]);

  const handleSetVerification = async (verified: boolean) => {
    if (!verificationHandle.trim()) { notifyToast('Enter a user @handle.'); return; }
    setIsSavingVerification(true);
    setVerificationMessage(null);
    try {
      const updated = await setUserVerificationByUsername(verificationHandle, verified, verificationColor);
      setVerificationHandle(updated.username);
      setVerificationColor(updated.verificationColor || '#2196F3');
      setVerificationState(verified ? 'verified' : 'unverified');
      setVerificationMessage(verified ? `@${updated.username} is now verified.` : `Verification removed from @${updated.username}.`);
    } catch (err: any) {
      notifyToast('Verification update failed: ' + (err?.message || 'Permission denied'));
    } finally { setIsSavingVerification(false); }
  };

  const handleLookupVerification = async () => {
    if (!verificationHandle.trim()) return;
    try {
      const result = await getUserVerificationByUsername(verificationHandle);
      if (!result) { setVerificationMessage('User not found.'); return; }
      setVerificationColor(result.verificationColor || '#2196F3');
      setVerificationState(result.isVerified ? 'verified' : 'unverified');
      setVerificationMessage(result.isVerified ? 'User is currently verified.' : 'User is currently unverified.');
    } catch (err: any) { notifyToast(err?.message || 'Lookup failed'); }
  };

  const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const updateFooterLink = (group: 'nav' | 'hub', id: string, patch: Partial<FooterLink>) => {
    const setter = group === 'nav' ? setFooterNavigationLinks : setFooterHubLinks;
    setter(prev => prev.map(link => link.id === id ? { ...link, ...patch } : link));
  };
  const removeFooterLink = (group: 'nav' | 'hub', id: string) => {
    const setter = group === 'nav' ? setFooterNavigationLinks : setFooterHubLinks;
    setter(prev => prev.filter(link => link.id !== id));
  };
  const addFooterLink = (group: 'nav' | 'hub') => {
    const newLink: FooterLink = group === 'nav'
      ? { id: makeId('footer-nav'), label: 'New Link', type: 'internal', target: 'home', visible: true }
      : { id: makeId('footer-hub'), label: 'New Channel', type: 'external', target: 'https://', visible: true };
    const setter = group === 'nav' ? setFooterNavigationLinks : setFooterHubLinks;
    setter(prev => [...prev, newLink]);
  };
  const handleAddMarquee = () => setMarqueeItems(prev => [...prev, { id: makeId('marquee'), text: 'NEW MARQUEE MESSAGE' }]);
  const moveMarquee = (index: number, direction: -1 | 1) => setMarqueeItems(prev => {
    const next = [...prev]; const target = index + direction;
    if (target < 0 || target >= next.length) return prev;
    [next[index], next[target]] = [next[target], next[index]]; return next;
  });

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    try {
      // Resolve the author identity, but never let a secondary denormalized
      // content-sync failure prevent the core site configuration from saving.
      let authorProfile = { uid: siteConfig.authorProfileUid || '', username: siteConfig.authorProfileUsername || 'krishsarkar' };
      try {
        authorProfile = await syncAdminAuthorProfile({
          name: authorName,
          role: authorRole,
          avatar: authorAvatarUrl,
          bio: aboutMeBio || manifestoText
        });
      } catch (authorSyncError) {
        console.warn('Author profile/content sync deferred; saving site config anyway:', authorSyncError);
      }
      const updated: SiteConfig = {
        ...siteConfig,
        logoImageUrl,
        logoPart1,
        logoPart2,
        tagline,
        heroHeadline,
        heroSubheadline,
        heroBgColor,
        manifestoText,
        manifestoAuthor,
        authorName,
        authorRole,
        authorAvatarUrl,
        aboutMeTitle,
        aboutMeBio,
        themePrimaryColor,
        themeSecondaryColor,
        themeAccentColor,
        themeSuccessColor,
        footerNewsletterTitle,
        footerNewsletterSubtitle,
        footerBrandStatement,
        marqueeItems: marqueeItems.map(item => ({ ...item, text: item.text.trim() })).filter(item => item.text),
        marqueeSpeedSeconds: Math.max(8, Number(marqueeSpeedSeconds) || 25),
        marqueePauseOnHover,
        blogHeader: {
          ...blogHeader,
          eyebrow: blogHeader.eyebrow.trim(),
          title: blogHeader.title.trim(),
          description: blogHeader.description.trim(),
          backgroundColor: blogHeader.backgroundColor || themePrimaryColor || '#FFD600',
          textColor: blogHeader.textColor || '#000000',
          essayCountLabel: blogHeader.essayCountLabel.trim() || 'ESSAYS PUBLISHED'
        },
        footerNavigationTitle: footerNavigationTitle.trim() || 'NAVIGATION',
        footerTopicsTitle: footerTopicsTitle.trim() || 'CURATED TOPICS',
        footerHubTitle: footerHubTitle.trim() || 'PUBLICATION HUB',
        footerNavigationLinks: footerNavigationLinks.map(link => ({ ...link, label: link.label.trim(), target: link.target.trim() })).filter(link => link.label && link.target),
        footerHubLinks: footerHubLinks.map(link => ({ ...link, label: link.label.trim(), target: link.target.trim() })).filter(link => link.label && link.target),
        footerTopicCategories: footerTopicCategories.map(x => x.trim()).filter(Boolean),
        footerBottomRightText: footerBottomRightText.trim(),
        contactTitle,
        contactSubtitle,
        contactEmail,
        contactTwitter,
        contactGithub,
        contactTelegram,
        contactInstagram,
        customCategories,
        authorProfileUid: authorProfile.uid,
        authorProfileUsername: authorProfile.username
      };
      await saveSiteConfig(updated);
      onUpdateSiteConfig(updated);

      // Also automatically sync author details across all cloud articles if author profile changed
      if (authorName !== siteConfig.authorName || authorRole !== siteConfig.authorRole || authorAvatarUrl !== siteConfig.authorAvatarUrl) {
        try {
          await syncAuthorToAllCloudArticles({
            name: authorName,
            role: authorRole,
            avatar: authorAvatarUrl,
            bio: manifestoText || aboutMeBio,
            uid: authorProfile.uid,
            username: authorProfile.username
          });
        } catch (syncErr) {
          console.warn("Auto-sync author to articles encountered an issue:", syncErr);
        }
      }

      setConfigSuccess(true);
      setTimeout(() => setConfigSuccess(false), 2000);
    } catch (err: any) {
      console.error("Failed to save site config to Firestore:", err);
      notifyToast("Failed to save config: " + (err.message || 'Permission denied'));
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Article Form state
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [editingArticleSlug, setEditingArticleSlug] = useState<string | null>(null);
  const [editingPublishedAt, setEditingPublishedAt] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<Category>('Web Development');
  const [customCategories, setCustomCategories] = useState<string[]>(siteConfig.customCategories || []);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [newTags, setNewTags] = useState('React, Architecture, Frontend');
  const [newExcerpt, setNewExcerpt] = useState('');
  const [newCoverImage, setNewCoverImage] = useState('https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1200&auto=format&fit=crop');
  const [newCoverAlt, setNewCoverAlt] = useState('Code and architecture display');
  const [newCoverCaption, setNewCoverCaption] = useState('Fig 1 — Production systems blueprint.');
  const [newReadingTime, setNewReadingTime] = useState(6);
  const [newParagraph1, setNewParagraph1] = useState('');
  const [newCodeLanguage, setNewCodeLanguage] = useState('typescript');
  const [newCodeSnippet, setNewCodeSnippet] = useState('');
  const [newTakeaway, setNewTakeaway] = useState('');
  const [newIsFeatured, setNewIsFeatured] = useState(false);
  const [newIsPinned, setNewIsPinned] = useState(false);
  const [newSeriesId, setNewSeriesId] = useState('');
  const [newSeriesName, setNewSeriesName] = useState('');
  const [newSeriesOrder, setNewSeriesOrder] = useState<number | ''>('');
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [seriesTitleInput, setSeriesTitleInput] = useState('');
  const [seriesSlugInput, setSeriesSlugInput] = useState('');
  const [seriesDescInput, setSeriesDescInput] = useState('');
  const [seriesCoverInput, setSeriesCoverInput] = useState('');
  const [seriesBusy, setSeriesBusy] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [contentBlocks, setContentBlocks] = useState<Article['content']>([
    { type: 'paragraph', content: '' }
  ]);
  const [draggedBlockIndex, setDraggedBlockIndex] = useState<number | null>(null);
  const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false);
  const cropFileInputRef = useRef<HTMLInputElement | null>(null);
  const [draftRecoveryAvailable, setDraftRecoveryAvailable] = useState(false);
  const [draftSaveState, setDraftSaveState] = useState<'idle'|'saving'|'saved'|'offline'>('idle');
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [revisionArticle, setRevisionArticle] = useState<Article | null>(null);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [revisionBusy, setRevisionBusy] = useState(false);
  const [selectedRevisionIds, setSelectedRevisionIds] = useState<string[]>([]);
  const [revisionActionMessage, setRevisionActionMessage] = useState('');
  const adminDraftKey = `offscrpt:draft:admin:${auth.currentUser?.uid || 'session'}`;
  const adminDraftRestoredRef = useRef(false);

  useEffect(() => {
    if (adminDraftRestoredRef.current || !auth.currentUser || editingArticleId) return;
    adminDraftRestoredRef.current = true;
    const restore = async () => {
      try {
        const raw = localStorage.getItem(adminDraftKey);
        const local = raw ? JSON.parse(raw) : null;
        const cloud = await getDraftSnapshot<any>('admin-article');
        const draft = cloud || local;
        if (draft?.title || draft?.excerpt || draft?.contentBlocks?.length) {
          if (draft.title) setNewTitle(draft.title);
          if (draft.category) setNewCategory(draft.category);
          if (typeof draft.tags === 'string') setNewTags(draft.tags);
          if (draft.excerpt) setNewExcerpt(draft.excerpt);
          if (typeof draft.coverImage === 'string') setNewCoverImage(draft.coverImage);
          if (typeof draft.coverAlt === 'string') setNewCoverAlt(draft.coverAlt);
          if (typeof draft.coverCaption === 'string') setNewCoverCaption(draft.coverCaption);
          if (typeof draft.seriesId === 'string') setNewSeriesId(draft.seriesId);
          if (typeof draft.seriesName === 'string') setNewSeriesName(draft.seriesName);
          if (draft.seriesOrder !== undefined && draft.seriesOrder !== '') setNewSeriesOrder(draft.seriesOrder);
          if (Array.isArray(draft.contentBlocks) && draft.contentBlocks.length) setContentBlocks(draft.contentBlocks);
          setDraftRecoveryAvailable(true);
        }
      } catch (error) { console.warn('OFFSCRPT recoverable operation failed:', error); }
    };
    void restore();
  }, [adminDraftKey, editingArticleId]);

  useEffect(() => {
    const on=()=>setOnline(true); const off=()=>setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return ()=>{ window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => {
    if (!auth.currentUser || editingArticleId) return;
    const hasContent = !!(newTitle.trim() || newExcerpt.trim() || contentBlocks.some((b) => (b.content || b.imageUrl || b.videoUrl || b.linkText || b.buttonText)));
    if (!hasContent) return;
    const payload = { title: newTitle, category: newCategory, tags: newTags, excerpt: newExcerpt, coverImage: newCoverImage, coverAlt: newCoverAlt, coverCaption: newCoverCaption, seriesId: newSeriesId, seriesName: newSeriesName, seriesOrder: newSeriesOrder, contentBlocks };
    try { localStorage.setItem(adminDraftKey, JSON.stringify(payload)); } catch (error) { console.warn('OFFSCRPT recoverable operation failed:', error); }
    setDraftSaveState(online ? 'saving' : 'offline');
    const timer = window.setTimeout(() => { void saveDraftSnapshot('admin-article', payload).then(() => setDraftSaveState('saved')).catch(() => setDraftSaveState('offline')); }, 900);
    return () => window.clearTimeout(timer);
  }, [adminDraftKey, editingArticleId, newTitle, newCategory, newTags, newExcerpt, newCoverImage, newCoverAlt, newCoverCaption, newSeriesId, newSeriesName, newSeriesOrder, contentBlocks]);


  // Author avatar upload & cloud sync state
  const [isSyncingAuthor, setIsSyncingAuthor] = useState(false);
  const [syncAuthorSuccess, setSyncAuthorSuccess] = useState<string | null>(null);
  const [togglingFeaturedSlug, setTogglingFeaturedSlug] = useState<string | null>(null);

  const handleSyncAuthorToArticles = async () => {
    if (!confirm(`Do you want to sync the author profile (Name: "${authorName}", Role: "${authorRole}") to ALL articles stored in Firestore cloud database?`)) return;
    setIsSyncingAuthor(true);
    setSyncAuthorSuccess(null);
    try {
      const count = await syncAuthorToAllCloudArticles({
        name: authorName,
        role: authorRole,
        avatar: authorAvatarUrl,
        bio: manifestoText || aboutMeBio,
        uid: auth.currentUser?.uid,
        username: 'krishsarkar'
      });
      setSyncAuthorSuccess(`Synced author details to ${count} articles in Firestore!`);
      setTimeout(() => setSyncAuthorSuccess(null), 4000);
    } catch (err: any) {
      console.error("Failed to sync author to articles:", err);
      notifyToast("Sync failed: " + (err.message || 'Permission denied'));
    } finally {
      setIsSyncingAuthor(false);
    }
  };

  const handleToggleFeatured = async (art: Article) => {
    const isCurrentlyFeatured = !!art.featured || !!art.pinned;
    const newFeaturedState = !isCurrentlyFeatured;
    setTogglingFeaturedSlug(art.slug);
    try {
      await setArticleFeaturedStatus(art, newFeaturedState, newFeaturedState);
    } catch (err: any) {
      console.error("Failed to update article featured status in Firestore:", err);
      notifyToast("Failed to update featured status: " + (err.message || 'Permission denied'));
    } finally {
      setTogglingFeaturedSlug(null);
    }
  };

  // Bento Links state
  const [bentoTitle, setBentoTitle] = useState('');
  const [bentoUrl, setBentoUrl] = useState('');
  const [bentoIcon, setBentoIcon] = useState('link');
  const [bentoColor, setBentoColor] = useState('#ffffff');
  const [bentoIsFeatured, setBentoIsFeatured] = useState(false);
  const [bentoImageUrl, setBentoImageUrl] = useState('');
  const [isSavingBento, setIsSavingBento] = useState(false);

  const handleAddBentoLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bentoTitle.trim() || !bentoUrl.trim()) return;
    
    setIsSavingBento(true);
    const newLink: BentoLink = {
      id: `bento-${Date.now()}`,
      title: bentoTitle.trim(),
      url: bentoUrl.trim(),
      icon: bentoIcon,
      color: bentoColor,
      isFeatured: bentoIsFeatured,
      imageUrl: bentoImageUrl.trim() || undefined,
      order: bentoLinks.length > 0 ? Math.max(...bentoLinks.map(l => l.order)) + 1 : 1
    };
    
    const updatedLinks = [...bentoLinks, newLink];
    try {
      await saveBentoLinks(updatedLinks);
      onUpdateBentoLinks(updatedLinks);
      setBentoTitle('');
      setBentoUrl('');
      setBentoIcon('link');
      setBentoColor('#ffffff');
      setBentoIsFeatured(false);
      setBentoImageUrl('');
    } catch (err: any) {
      console.error("Failed to save bento link:", err);
      notifyToast("Failed to save link: " + (err.message || "Permission denied"));
    } finally {
      setIsSavingBento(false);
    }
  };
  
  const handleDeleteBentoLink = async (id: string) => {
    const updatedLinks = bentoLinks.filter(link => link.id !== id);
    try {
      await saveBentoLinks(updatedLinks);
      onUpdateBentoLinks(updatedLinks);
    } catch (err: any) {
      console.error("Failed to delete bento link:", err);
      notifyToast("Failed to delete link: " + (err.message || "Permission denied"));
    }
  };
  
  const handleMoveBentoLink = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index > 0) {
      const newLinks = [...bentoLinks];
      const temp = newLinks[index].order;
      newLinks[index].order = newLinks[index - 1].order;
      newLinks[index - 1].order = temp;
      const sorted = newLinks.sort((a, b) => a.order - b.order);
      try {
        await saveBentoLinks(sorted);
        onUpdateBentoLinks(sorted);
      } catch (e) {
        console.error("Failed to update bento link order:", e);
      }
    } else if (direction === 'down' && index < bentoLinks.length - 1) {
      const newLinks = [...bentoLinks];
      const temp = newLinks[index].order;
      newLinks[index].order = newLinks[index + 1].order;
      newLinks[index + 1].order = temp;
      const sorted = newLinks.sort((a, b) => a.order - b.order);
      try {
        await saveBentoLinks(sorted);
        onUpdateBentoLinks(sorted);
      } catch (e) {
        console.error("Failed to update bento link order:", e);
      }
    }
  };

  const openRevisionHistory = async (article: Article) => {
    setRevisionArticle(article); setRevisionBusy(true); setSelectedRevisionIds([]); setRevisionActionMessage('');
    try { setRevisions(await getArticleRevisions(article.slug)); } catch (e:any) { console.warn('Revision history load failed', e); setRevisions([]); notifyToast(e?.message || 'Revision history could not be loaded.'); }
    finally { setRevisionBusy(false); }
  };

  const toggleRevisionSelection = (id:string) => {
    setSelectedRevisionIds(prev => prev.includes(id) ? prev.filter(x=>x!==id) : prev.length >= 2 ? [prev[1], id] : [...prev,id]);
  };

  const restoreRevision = async (revisionId: string) => {
    if (!revisionId || !window.confirm('Restore this revision? The current article will be snapshotted before restore.')) return;
    setRevisionBusy(true); setRevisionActionMessage('');
    try { const restored = await restoreArticleRevision(revisionId); onArticlePublished(restored); setRevisions(await getArticleRevisions(restored.slug)); setSelectedRevisionIds([]); setRevisionActionMessage('Revision restored to Firestore. Current state was preserved as a revision.'); } catch (e:any) { notifyToast(e.message || 'Revision restore failed.'); }
    finally { setRevisionBusy(false); }
  };

  const duplicateRevision = async (revisionId:string) => {
    setRevisionBusy(true); setRevisionActionMessage('');
    try { const duplicate = await duplicateArticleFromRevision(revisionId); onArticlePublished(duplicate); setRevisionActionMessage(`Duplicated as /${duplicate.slug} and saved to Firestore as an unpublished article.`); } catch(e:any) { notifyToast(e?.message || 'Could not duplicate revision.'); }
    finally { setRevisionBusy(false); }
  };

  const revisionTimestamp = (r:any) => r.createdAt?.toDate?.()?.toLocaleString?.([], {year:'numeric',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'}) || 'PENDING CLOUD TIMESTAMP';
  const revisionActionLabel = (action:string) => ({initial:'INITIAL', 'auto-save':'AUTO-SNAPSHOT', manual:'MANUAL SNAPSHOT', 'before-restore':'BEFORE RESTORE', restored:'RESTORE RESULT'} as Record<string,string>)[action] || 'REVISION';
  const compareRevisionRows = useMemo(() => {
    if (selectedRevisionIds.length !== 2) return [];
    const a:any = revisions.find(r=>r.id===selectedRevisionIds[0]); const b:any = revisions.find(r=>r.id===selectedRevisionIds[1]);
    if(!a||!b) return [];
    const av=a.article||{}, bv=b.article||{};
    const fields=[['TITLE','title'],['EXCERPT','excerpt'],['CATEGORY','category'],['TAGS','tags'],['SERIES','seriesId'],['SERIES PART','seriesOrder'],['READ TIME','readingTimeMinutes'],['COVER IMAGE','coverImage']];
    return fields.map(([label,key])=>({label,a:JSON.stringify(av[key]??''),b:JSON.stringify(bv[key]??''),changed:JSON.stringify(av[key]??'')!==JSON.stringify(bv[key]??'')})).filter(x=>x.changed);
  },[selectedRevisionIds,revisions]);


  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newExcerpt.trim()) return;

    setIsPublishing(true);
    setPublishError(null);

    try {
      // Author synchronization is secondary to publishing. If a legacy
      // collection-group index or denormalized-content sync is unavailable,
      // the article must still be writable to Firestore.
      let authorProfile = {
        uid: siteConfig.authorProfileUid || auth.currentUser?.uid || '',
        username: siteConfig.authorProfileUsername || 'krishsarkar'
      };
      try {
        authorProfile = await syncAdminAuthorProfile({
          name: authorName || siteConfig.authorName || 'Krish Sarkar',
          role: authorRole || siteConfig.authorRole || 'Founder & Systems Architect',
          avatar: authorAvatarUrl || siteConfig.authorAvatarUrl || '',
          bio: manifestoText || aboutMeBio || siteConfig.aboutMeBio || ''
        });
      } catch (authorSyncError) {
        console.warn('Author sync deferred while publishing article:', authorSyncError);
      }
      const slug = editingArticleSlug || newTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      const tagsArray = newTags.split(',').map((t) => t.trim()).filter(Boolean);

      const article: Article = {
        id: editingArticleId || `article-${Date.now()}`,
        slug,
        title: newTitle.trim(),
        excerpt: newExcerpt.trim(),
        category: newCategory,
        tags: tagsArray.length ? tagsArray : ['Engineering'],
        publishedAt: editingPublishedAt || new Date().toISOString().split('T')[0],
        readingTimeMinutes: calculateArticleReadingTime(contentBlocks),
        coverImage: newCoverImage.trim() || 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1200&auto=format&fit=crop',
        coverImageAlt: newCoverAlt || newTitle,
        coverImageCaption: newCoverCaption,
        featured: newIsFeatured || newIsPinned,
        pinned: newIsPinned || newIsFeatured,
        trending: true,
        seriesId: newSeriesId.trim() || undefined,
        seriesName: newSeriesName.trim() || undefined,
        seriesOrder: newSeriesOrder === '' ? undefined : Number(newSeriesOrder),
        ...(editingArticleSlug ? {} : { viewsCount: 0 }),
        clapsCount: 0,
        author: {
          uid: authorProfile.uid,
          username: authorProfile.username,
          name: authorName || siteConfig.authorName || 'Krish',
          role: authorRole || siteConfig.authorRole || 'Founder & Systems Architect',
          avatar: authorAvatarUrl || siteConfig.authorAvatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop',
          isVerified: true,
          verificationColor: '#2196F3',
          bio: manifestoText || aboutMeBio || siteConfig.manifestoText || 'Writing about distributed systems, modern web runtimes, and engineering craft.'
        },
        content: (contentBlocks.length ? contentBlocks : [{ type: 'paragraph' as const, content: newExcerpt }]).map(block => ({ ...block }))
      };

      await saveArticle(article);
      onArticlePublished(article);
      await deleteDraftSnapshot('admin-article').catch((error) => console.warn('OFFSCRPT recoverable operation failed:', error));
      try { localStorage.removeItem(adminDraftKey); } catch (error) { console.warn('OFFSCRPT recoverable operation failed:', error); }
      setDraftRecoveryAvailable(false);
      setPublishSuccess(true);
      setTimeout(() => {
        setPublishSuccess(false);
        resetForm();
      }, 1500);
    } catch (err: any) {
      console.error("Failed to save article to Firestore:", err);
      setPublishError(err.message || "Failed to persist article to Firestore.");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleEditArticle = (article: Article) => {
    setActiveTab('create');
    setEditingArticleId(article.id);
    setEditingArticleSlug(article.slug);
    setEditingPublishedAt(article.publishedAt);
    setNewTitle(article.title);
    setNewCategory(article.category);
    setNewTags(article.tags?.join(', ') || '');
    setNewExcerpt(article.excerpt);
    setNewCoverImage(article.coverImage || '');
    setNewCoverAlt(article.coverImageAlt || '');
    setNewCoverCaption(article.coverImageCaption || '');
    setNewReadingTime(article.readingTimeMinutes);
    setNewSeriesId(article.seriesId || '');
    setNewSeriesName(article.seriesName || '');
    setNewSeriesOrder(article.seriesOrder || '');
    
    setContentBlocks(article.content?.length ? article.content.map(block => ({ ...block })) : [{ type: 'paragraph', content: article.excerpt }]);
    setShowCustomCategoryInput(!['Web Development','Artificial Intelligence','Software Engineering','Computer Science','Developer Tools','System Design'].includes(article.category));
    setNewIsFeatured(!!article.featured || !!article.pinned);
    setNewIsPinned(!!article.pinned || !!article.featured);
  };

  const handleDeleteArticleClick = async (slug: string) => {
    if (!confirm(`Are you sure you want to permanently delete the article "${slug}" from Firestore?`)) return;
    try {
      await deleteArticle(slug);
      onDeleteArticle(slug);
    } catch (err: any) {
      console.error("Failed to delete article:", err);
      notifyToast("Failed to delete article from Firestore: " + (err.message || "Permission denied"));
    }
  };

  const resetForm = () => {
    void deleteDraftSnapshot('admin-article').catch((error) => console.warn('OFFSCRPT recoverable operation failed:', error));
    try { localStorage.removeItem(adminDraftKey); } catch (error) { console.warn('OFFSCRPT recoverable operation failed:', error); }
    setDraftRecoveryAvailable(false);
    setEditingArticleId(null);
    setEditingArticleSlug(null);
    setEditingPublishedAt(null);
    setNewTitle('');
    setNewCategory('Web Development');
    setCustomCategoryInput('');
    setNewTags('');
    setNewExcerpt('');
    setNewParagraph1('');
    setNewCodeSnippet('');
    setNewTakeaway('');
    setContentBlocks([{ type: 'paragraph', content: '' }]);
    setShowCustomCategoryInput(false);
    setNewIsFeatured(false);
    setNewIsPinned(false);
    setNewSeriesId('');
    setNewSeriesName('');
    setNewSeriesOrder('');
    setNewCoverImage('https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1200&auto=format&fit=crop');
    setPublishError(null);
  };

  const addContentBlock = (type: Article['content'][number]['type']) => {
    const block: Article['content'][number] = type === 'code'
      ? { type, codeBlock: { language: 'typescript', code: '' } }
      : type === 'image'
        ? { type, imageUrl: '', imageAlt: 'Article image', imageCaption: '', imageHref: '' }
        : type === 'video'
          ? { type, videoUrl: '', videoTitle: '', videoCaption: '' }
        : type === 'link'
          ? { type, linkText: 'OPEN LINK', href: '' }
          : type === 'button'
            ? { type, buttonText: 'OPEN LINK', href: '', buttonStyle: 'primary' }
          : type === 'list' || type === 'takeaways'
          ? { type, items: [''] }
          : type === 'quote'
            ? { type, content: '', quoteAuthor: '' }
            : type === 'callout'
              ? { type, content: '', calloutType: 'info', calloutTitle: 'KEY INSIGHT' }
              : { type, content: '' };
    setContentBlocks(prev => [...prev, block]);
  };

  const updateContentBlock = (index: number, patch: Partial<Article['content'][number]>) => {
    setContentBlocks(prev => prev.map((block, i) => i === index ? { ...block, ...patch } : block));
  };

  const moveContentBlock = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= contentBlocks.length) return;
    setContentBlocks(prev => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removeContentBlock = (index: number) => {
    setContentBlocks(prev => prev.length === 1 ? [{ type: 'paragraph', content: '' }] : prev.filter((_, i) => i !== index));
  };

  const insertInlineLink = (blockIndex: number, currentText: string) => {
    const el = document.activeElement as HTMLTextAreaElement | null;
    const start = el && typeof el.selectionStart === 'number' ? el.selectionStart : currentText.length;
    const end = el && typeof el.selectionEnd === 'number' ? el.selectionEnd : currentText.length;
    const selected = currentText.slice(start, end).trim();
    const label = selected || 'linked text';
    const url = window.prompt('URL (https://..., /internal-path, mailto:...):', 'https://');
    if (!url || url.trim() === 'https://') return;
    const nextValue = `${currentText.slice(0, start)}[${label}](${url.trim()})${currentText.slice(end)}`;
    updateContentBlock(blockIndex, { content: nextValue });
  };

  const handleBlockDrop = (targetIndex: number) => {
    if (draggedBlockIndex === null || draggedBlockIndex === targetIndex) return;
    setContentBlocks(prev => {
      const next = [...prev];
      const [moved] = next.splice(draggedBlockIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setDraggedBlockIndex(null);
  };

  if (!isOpen) return null;

  return (
    <div className={pageMode ? "w-full bg-neutral-100 min-h-[calc(100vh-64px)] py-6 sm:py-8 px-3 sm:px-5 lg:px-8" : "w-full bg-neutral-100 min-h-[calc(100vh-64px)] py-8 sm:py-12 px-4 sm:px-6 lg:px-8 flex justify-center items-start"}>
      <div className={pageMode ? "w-full bg-white border-4 border-black neo-shadow-lg overflow-hidden" : "w-full max-w-5xl bg-white border-4 border-black neo-shadow-lg overflow-hidden my-4 sm:my-8"}>
        
        {/* Modal Header */}
        <div className="bg-[var(--color-secondary)] px-4 sm:px-6 py-4 border-b-4 border-black flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Database className="w-6 h-6 text-black stroke-[2.5]" />
            <div>
              <h2 className="font-display font-black text-xl text-black uppercase tracking-tight">
                {brandName} CMS STUDIO
              </h2>
              <div className="font-mono text-[11px] text-black/90 font-bold">
                PERSISTENT FIRESTORE CMS &bull; GLOBAL CLOUD SYNCHRONIZATION
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {isAuthenticated && (
              <button
                onClick={handleLogout}
                className="px-3 py-1 bg-white border-2 border-black font-mono text-xs font-bold uppercase hover:bg-neutral-100"
              >
                Sign Out ({currentUserEmail?.split('@')[0]})
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close admin studio"
              className="w-10 h-10 bg-white border-2 border-black flex items-center justify-center hover:bg-black hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Auth Guard */}
        {!isAuthenticated ? (
          <div className="p-12 text-center flex flex-col items-center justify-center space-y-4 bg-white min-h-[400px]">
            <div className="w-16 h-16 bg-[var(--color-primary)] neo-border-2 flex items-center justify-center neo-shadow-sm mb-2">
              <Lock className="w-8 h-8 text-black stroke-[2.5]" />
            </div>
            <h3 className="font-display font-black text-2xl uppercase text-black">
              STAFF VERIFICATION REQUIRED
            </h3>
            <p className="font-sans text-sm text-neutral-600 max-w-md">
              Sign in with an authorized administrator account, or a moderator account explicitly added by a master administrator. Moderator accounts receive only the moderation tools assigned to them.
            </p>
            
            {loginError && (
              <div className="p-3 bg-red-100 border-2 border-red-500 font-mono text-xs text-red-800 max-w-md">
                {loginError}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="mt-4 px-8 py-4 bg-[var(--color-primary)] border-4 border-black font-display font-black text-sm uppercase neo-shadow-sm hover:bg-[var(--color-secondary)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50 flex items-center space-x-2"
            >
              <Shield className="w-5 h-5" />
              <span>{isLoggingIn ? 'AUTHENTICATING...' : 'SIGN IN WITH AUTHORIZED STAFF GOOGLE ACCOUNT'}</span>
            </button>
          </div>
        ) : (
          <div className="bg-white min-h-[600px] flex flex-col">

            {/* Tab Selector (5 Clean Modules) */}
            <div className="grid grid-cols-7 border-b-4 border-black font-display font-black text-[10px] sm:text-xs uppercase bg-white overflow-x-auto whitespace-nowrap">
              {!isModerator && <button
                onClick={() => setActiveTab('settings')}
                className={`py-3 px-2 flex flex-col items-center justify-center space-y-1 sm:flex-row sm:space-y-0 sm:space-x-1.5 transition-colors ${
                  activeTab === 'settings' ? 'bg-[var(--color-primary)] text-black border-r-2 border-black' : 'hover:bg-neutral-100 border-r-2 border-black'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">SETTINGS</span>
              </button>}
              
              {!isModerator && <button
                onClick={() => setActiveTab('create')}
                className={`py-3 px-2 flex flex-col items-center justify-center space-y-1 sm:flex-row sm:space-y-0 sm:space-x-1.5 transition-colors ${
                  activeTab === 'create' ? 'bg-[var(--color-primary)] text-black border-r-2 border-black' : 'hover:bg-neutral-100 border-r-2 border-black'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                <span className="hidden sm:inline">{editingArticleSlug ? 'EDIT ARTICLE' : 'WRITE ARTICLE'}</span>
              </button>}

              {!isModerator && <button
                onClick={() => setActiveTab('manage')}
                className={`py-3 px-2 flex flex-col items-center justify-center space-y-1 sm:flex-row sm:space-y-0 sm:space-x-1.5 transition-colors ${
                  activeTab === 'manage' ? 'bg-[var(--color-primary)] text-black border-r-2 border-black' : 'hover:bg-neutral-100 border-r-2 border-black'
                }`}
              >
                <Edit2 className="w-4 h-4" />
                <span className="hidden sm:inline">MANAGE ({articles.length})</span>
              </button>}

              {!isModerator && <button
                onClick={() => setActiveTab('links')}
                className={`py-3 px-2 flex flex-col items-center justify-center space-y-1 sm:flex-row sm:space-y-0 sm:space-x-1.5 transition-colors ${
                  activeTab === 'links' ? 'bg-[var(--color-primary)] text-black border-r-2 border-black' : 'hover:bg-neutral-100 border-r-2 border-black'
                }`}
              >
                <LinkIcon className="w-4 h-4" />
                <span className="hidden sm:inline">BENTO LINKS</span>
              </button>}
              
              {!isModerator && <button
                onClick={() => setActiveTab('series')}
                className={`py-3 px-2 flex flex-col items-center justify-center space-y-1 sm:flex-row sm:space-y-0 sm:space-x-1.5 transition-colors ${activeTab === 'series' ? 'bg-[var(--color-primary)] text-black border-r-2 border-black' : 'hover:bg-neutral-100 border-r-2 border-black'}`}
              >
                <Layers className="w-4 h-4" />
                <span className="hidden sm:inline">SERIES</span>
              </button>}

              {!isModerator && <button
                onClick={() => setActiveTab('carousel')}
                className={`py-3 px-2 flex flex-col items-center justify-center space-y-1 sm:flex-row sm:space-y-0 sm:space-x-1.5 transition-colors ${
                  activeTab === 'carousel' ? 'bg-[var(--color-primary)] text-black' : 'hover:bg-neutral-100'
                }`}
              >
                <Layout className="w-4 h-4" />
                <span className="hidden sm:inline">CAROUSEL</span>
              </button>}

              {!isModerator && <button
                onClick={() => setActiveTab('media')}
                className={`py-3 px-2 flex flex-col items-center justify-center space-y-1 sm:flex-row sm:space-y-0 sm:space-x-1.5 transition-colors ${
                  activeTab === 'media' ? 'bg-[var(--color-primary)] text-black' : 'hover:bg-neutral-100'
                }`}
              >
                <UploadCloud className="w-4 h-4" />
                <span className="hidden sm:inline">MEDIA</span>
              </button>}

              <button
                onClick={() => setActiveTab('social')}
                className={`py-3 px-2 flex flex-col items-center justify-center space-y-1 sm:flex-row sm:space-y-0 sm:space-x-1.5 transition-colors ${
                  activeTab === 'social' ? 'bg-[var(--color-primary)] text-black' : 'hover:bg-neutral-100'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">SOCIAL MOD</span>
              </button>

              {!isModerator && <button
                onClick={() => setActiveTab('control')}
                className={`py-3 px-2 flex flex-col items-center justify-center space-y-1 sm:flex-row sm:space-y-0 sm:space-x-1.5 transition-colors ${
                  activeTab === 'control' ? 'bg-[var(--color-primary)] text-black' : 'hover:bg-neutral-100'
                }`}
              >
                <Database className="w-4 h-4" />
                <span className="hidden sm:inline">MASTER CONTROL</span>
              </button>}
            </div>

            {/* TAB: SETTINGS */}
            {activeTab === 'settings' && (
              <div className={`p-6 ${panelScrollClass} space-y-6`}>
                <div className="bg-[var(--color-secondary)]/30 p-3.5 neo-border-2 font-sans text-xs text-black space-y-1">
                  <div className="font-display font-black text-sm uppercase flex items-center space-x-1.5">
                    <Settings className="w-4 h-4 text-black" />
                    <span>GLOBAL CLOUD SITE CONFIGURATION</span>
                  </div>
                  <p>All settings are persistently synced to Firestore and reflected immediately across devices.</p>
                </div>

                {configSuccess && (
                  <div className="p-3 bg-[var(--color-success)] border-2 border-black font-mono text-xs font-bold flex items-center space-x-2 neo-shadow-sm">
                    <Check className="w-4 h-4" />
                    <span>Global settings saved to Firestore!</span>
                  </div>
                )}

                <form onSubmit={handleSaveConfig} className="space-y-6">
                  {/* BRANDING SECTION */}
                  <div className="space-y-4">
                    <h4 className="font-display font-black text-lg uppercase border-b-2 border-black pb-1">Branding</h4>
                    <div className="space-y-2">
                      <label className="font-mono text-xs font-bold uppercase text-black">Logo Image (Optional)</label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input type="text" value={logoImageUrl} onChange={(e) => setLogoImageUrl(e.target.value)} className="flex-1 px-3 py-2 border-2 border-black font-mono text-xs focus:outline-none" placeholder="https://... or upload" />
                        <MediaUploadButton folder="profile" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" label="UPLOAD LOGO" compact cropAspect="1:1" cropShape="rect" outputWidth={1000} outputHeight={1000} onUploaded={(url) => setLogoImageUrl(url)} />
                      </div>
                      {logoImageUrl && /^https?:\/\//i.test(logoImageUrl) && <img src={logoImageUrl} alt="Logo preview" className="h-16 max-w-[280px] object-contain border-2 border-black bg-white p-2" />}
                    </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="font-mono text-xs font-bold uppercase text-black">Logo Part 1</label>
                        <input type="text" value={logoPart1} onChange={(e) => setLogoPart1(e.target.value)} className="w-full px-3 py-2 border-2 border-black font-bold focus:outline-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="font-mono text-xs font-bold uppercase text-black">Logo Part 2 (Accent)</label>
                        <input type="text" value={logoPart2} onChange={(e) => setLogoPart2(e.target.value)} className="w-full px-3 py-2 border-2 border-black font-bold focus:outline-none text-[var(--color-accent)]" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="font-mono text-xs font-bold uppercase text-black">Tagline</label>
                      <input type="text" value={tagline} onChange={(e) => setTagline(e.target.value)} className="w-full px-3 py-2 border-2 border-black font-mono text-xs focus:outline-none" />
                    </div>
                  </div>

                  {/* HERO SECTION */}
                  <div className="space-y-4">
                    <h4 className="font-display font-black text-lg uppercase border-b-2 border-black pb-1">Hero Section</h4>
                    <div className="space-y-1">
                      <label className="font-mono text-xs font-bold uppercase text-black">Hero Headline</label>
                      <textarea rows={2} value={heroHeadline} onChange={(e) => setHeroHeadline(e.target.value)} className="w-full px-3 py-2 border-2 border-black font-display font-bold text-lg focus:outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="font-mono text-xs font-bold uppercase text-black">Hero Subheadline</label>
                      <textarea rows={3} value={heroSubheadline} onChange={(e) => setHeroSubheadline(e.target.value)} className="w-full px-3 py-2 border-2 border-black font-sans text-sm focus:outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="font-mono text-xs font-bold uppercase text-black">Hero Background Color</label>
                      <div className="flex items-center space-x-2">
                        <input type="color" value={heroBgColor} onChange={(e) => setHeroBgColor(e.target.value)} className="w-10 h-10 border-2 border-black p-0.5 cursor-pointer" />
                        <input type="text" value={heroBgColor} onChange={(e) => setHeroBgColor(e.target.value)} className="flex-1 px-3 py-2 border-2 border-black font-mono focus:outline-none uppercase text-xs" />
                      </div>
                    </div>
                  </div>

                  {/* TERMINAL MANIFESTO */}
                  <div className="space-y-4">
                    <h4 className="font-display font-black text-lg uppercase border-b-2 border-black pb-1">Terminal Manifesto</h4>
                    <div className="space-y-1">
                      <label className="font-mono text-xs font-bold uppercase text-black">Manifesto Text</label>
                      <textarea rows={3} value={manifestoText} onChange={(e) => setManifestoText(e.target.value)} className="w-full px-3 py-2 border-2 border-black font-serif text-sm focus:outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="font-mono text-xs font-bold uppercase text-black">Manifesto Author</label>
                      <input type="text" value={manifestoAuthor} onChange={(e) => setManifestoAuthor(e.target.value)} className="w-full px-3 py-2 border-2 border-black font-mono text-xs focus:outline-none" />
                    </div>
                  </div>

                  {/* AUTHOR / ABOUT */}
                  <div className="space-y-4 p-4 bg-gray-50 border-2 border-black">
                    <div className="border-2 border-black bg-neutral-50 p-4 flex flex-wrap items-center justify-between gap-3"><div><div className="font-mono text-[9px] uppercase text-neutral-500">CREATOR STUDIO</div><div className="font-display font-black text-xl uppercase">DRAFT MANAGEMENT</div><div className="font-mono text-[9px] mt-1">STATUS: {draftSaveState === 'saved' ? 'CLOUD SAVED' : draftSaveState === 'saving' ? 'SAVING…' : !online ? 'OFFLINE — LOCAL BACKUP ACTIVE' : draftRecoveryAvailable ? 'RECOVERABLE DRAFT' : 'NO ACTIVE DRAFT'}</div></div><div className="flex gap-2">{draftRecoveryAvailable && <button onClick={()=>setActiveTab('create')} className="border-2 border-black bg-[var(--color-primary)] px-3 py-2 font-mono text-[9px] font-black">RESUME DRAFT</button>}{draftRecoveryAvailable && <button onClick={resetForm} className="border-2 border-black bg-white px-3 py-2 font-mono text-[9px] font-black">DISCARD DRAFT</button>}</div></div>
                <div className="flex items-center justify-between border-b-2 border-black pb-2">
                      <div>
                        <h4 className="font-display font-black text-lg uppercase text-black">Author &amp; About Profile</h4>
                        <p className="font-mono text-xs text-neutral-600">
                          These author details reflect on all personal essays, article pages, and bio cards across the site.
                        </p>
                      </div>
                      <span className="px-2 py-0.5 bg-[var(--color-primary)] text-black font-mono text-[10px] font-bold border border-black uppercase">
                        GLOBAL AUTHOR
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="font-mono text-xs font-bold uppercase text-black">Author Name</label>
                        <input 
                          type="text" 
                          value={authorName} 
                          onChange={(e) => setAuthorName(e.target.value)} 
                          className="w-full px-3 py-2 border-2 border-black font-bold focus:outline-none bg-white" 
                          placeholder="Krish"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-mono text-xs font-bold uppercase text-black">Author Role</label>
                        <input 
                          type="text" 
                          value={authorRole} 
                          onChange={(e) => setAuthorRole(e.target.value)} 
                          className="w-full px-3 py-2 border-2 border-black font-bold focus:outline-none bg-white" 
                          placeholder="Founder & Systems Architect"
                        />
                      </div>
                    </div>

                    {/* Avatar Preview and URL */}
                    <div className="space-y-2">
                      <label className="font-mono text-xs font-bold uppercase text-black">Author Picture (Avatar)</label>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <img 
                          src={authorAvatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop'} 
                          alt="Author Preview" 
                          className="w-16 h-16 border-2 border-black object-cover bg-white shrink-0 neo-shadow-sm"
                        />
                        <div className="flex-1 w-full space-y-1.5">
                          <div className="flex flex-col sm:flex-row gap-2"><input 
                            type="text" 
                            value={authorAvatarUrl} 
                            onChange={(e) => setAuthorAvatarUrl(e.target.value)} 
                            className="flex-1 px-3 py-2 border-2 border-black font-mono text-xs focus:outline-none bg-white" 
                            placeholder="https://images.unsplash.com/..."
                          /><MediaUploadButton folder="profile" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" label="UPLOAD AVATAR" compact cropAspect="1:1" cropShape="circle" outputWidth={800} outputHeight={800} onUploaded={(url) => setAuthorAvatarUrl(url)} /></div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="font-mono text-xs font-bold uppercase text-black">About Section Title</label>
                      <input 
                        type="text" 
                        value={aboutMeTitle} 
                        onChange={(e) => setAboutMeTitle(e.target.value)} 
                        className="w-full px-3 py-2 border-2 border-black font-bold focus:outline-none bg-white" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-mono text-xs font-bold uppercase text-black">About Bio</label>
                      <textarea 
                        rows={3} 
                        value={aboutMeBio} 
                        onChange={(e) => setAboutMeBio(e.target.value)} 
                        className="w-full px-3 py-2 border-2 border-black font-sans text-sm focus:outline-none bg-white" 
                      />
                    </div>

                    {/* Sync to all Cloud Articles Button */}
                    <div className="pt-2 border-t-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={handleSyncAuthorToArticles}
                        disabled={isSyncingAuthor}
                        className="px-4 py-2 bg-black text-white font-display font-black text-xs uppercase border-2 border-black hover:bg-[var(--color-primary)] hover:text-black transition-all flex items-center space-x-1.5 active:translate-x-0.5 active:translate-y-0.5"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAuthor ? 'animate-spin' : ''}`} />
                        <span>{isSyncingAuthor ? 'SYNCING TO CLOUD ARTICLES...' : 'SYNC AUTHOR TO ALL CLOUD ARTICLES'}</span>
                      </button>

                      {syncAuthorSuccess && (
                        <div className="px-3 py-1.5 bg-green-100 border border-green-800 text-green-900 font-mono text-xs font-bold flex items-center space-x-1.5">
                          <Check className="w-3.5 h-3.5 text-green-800" />
                          <span>{syncAuthorSuccess}</span>
                        </div>
                      )}
                    </div>
                  </div>


                  {/* USER VERIFICATION */}
                  <div className="space-y-4 p-4 bg-white border-2 border-black">
                    <div className="flex items-center justify-between border-b-2 border-black pb-2">
                      <div>
                        <h4 className="font-display font-black text-lg uppercase">Issue Verification Badge</h4>
                        <p className="font-mono text-xs text-neutral-600">Verify any registered account by @handle. The badge and selected color sync through Firestore to the profile, posts and comments.</p>
                      </div>
                      <BadgeCheck className="w-7 h-7" style={{ color: verificationColor, fill: verificationColor }} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                      <div className="space-y-1">
                        <label className="font-mono text-xs font-bold uppercase">User Handle (without @)</label>
                        <input value={verificationHandle} onChange={e => setVerificationHandle(e.target.value.replace(/^@/, ''))} onBlur={handleLookupVerification} placeholder="krishsarkar" className="w-full px-3 py-2 border-2 border-black font-mono" />
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="color" value={verificationColor} onChange={e => setVerificationColor(e.target.value)} className="w-12 h-10 border-2 border-black" />
                        <input value={verificationColor} onChange={e => setVerificationColor(e.target.value)} className="w-28 px-3 py-2 border-2 border-black font-mono uppercase text-xs" />
                      </div>
                    </div>
                    {verificationState && <div className="font-mono text-[10px] uppercase">Current status: <b>{verificationState}</b></div>}
                    {verificationMessage && <div className="px-3 py-2 border-2 border-black bg-neutral-50 font-mono text-xs">{verificationMessage}</div>}
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={isSavingVerification} onClick={() => handleSetVerification(true)} className="px-5 py-2 bg-[var(--color-primary)] border-2 border-black font-mono text-xs font-black uppercase flex items-center gap-2"><BadgeCheck className="w-4 h-4" /> Verify User</button>
                      <button type="button" disabled={isSavingVerification} onClick={() => handleSetVerification(false)} className="px-5 py-2 bg-white border-2 border-black text-red-600 font-mono text-xs font-black uppercase">Remove Verification</button>
                    </div>
                  </div>

                  {/* LOOPING TOP BAR / MARQUEE */}
                  <div className="space-y-4 p-4 border-2 border-black bg-[#0A0A0A] text-white">
                    <div className="flex items-center justify-between gap-3 border-b-2 border-white/30 pb-2">
                      <div>
                        <h4 className="font-display font-black text-lg uppercase">Looping Top Bar</h4>
                        <p className="font-mono text-[10px] text-neutral-300">Control every message shown in the moving black ticker. Add, remove, reorder, and optionally make any item clickable.</p>
                      </div>
                      <button type="button" onClick={handleAddMarquee} className="border-2 border-white bg-[var(--color-primary)] text-black px-3 py-2 font-mono text-[10px] font-black uppercase">+ ADD MESSAGE</button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="border border-white/30 p-2 font-mono text-[10px] uppercase">
                        Speed (seconds / loop)
                        <input type="number" min={8} max={120} value={marqueeSpeedSeconds} onChange={e => setMarqueeSpeedSeconds(Number(e.target.value))} className="w-full mt-1 px-2 py-2 bg-white text-black border-2 border-black font-mono text-xs" />
                      </label>
                      <label className="border border-white/30 p-2 font-mono text-[10px] uppercase flex items-center gap-2">
                        <input type="checkbox" checked={marqueePauseOnHover} onChange={e => setMarqueePauseOnHover(e.target.checked)} /> PAUSE WHEN HOVERED
                      </label>
                    </div>
                    <div className="space-y-2">
                      {marqueeItems.length === 0 && <div className="border border-dashed border-white/40 p-4 font-mono text-xs text-neutral-300">No messages configured. Add your first ticker message.</div>}
                      {marqueeItems.map((item, index) => (
                        <div key={item.id} className="grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_1fr_auto] gap-2 items-center border border-white/20 p-2">
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => moveMarquee(index, -1)} disabled={index === 0} className="border border-white/40 px-2 py-1 disabled:opacity-30">↑</button>
                            <button type="button" onClick={() => moveMarquee(index, 1)} disabled={index === marqueeItems.length - 1} className="border border-white/40 px-2 py-1 disabled:opacity-30">↓</button>
                          </div>
                          <input value={item.text} onChange={e => setMarqueeItems(prev => prev.map(x => x.id === item.id ? { ...x, text: e.target.value } : x))} placeholder="BUILDING ON THE OPEN INTERNET" className="w-full px-2 py-2 bg-white text-black border-2 border-black font-mono text-xs uppercase" />
                          <input value={item.url || ''} onChange={e => setMarqueeItems(prev => prev.map(x => x.id === item.id ? { ...x, url: e.target.value } : x))} placeholder="Optional URL (https://...)" className="w-full px-2 py-2 bg-white text-black border-2 border-black font-mono text-xs" />
                          <button type="button" onClick={() => setMarqueeItems(prev => prev.filter(x => x.id !== item.id))} className="border-2 border-red-500 bg-red-600 text-white px-3 py-2 font-mono text-[10px] font-black uppercase">DELETE</button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* BLOG ARCHIVE HEADER */}
                  <div className="space-y-4 p-4 border-2 border-black bg-[var(--color-primary)]/20">
                    <div className="flex items-center justify-between gap-3 border-b-2 border-black pb-2">
                      <div>
                        <h4 className="font-display font-black text-lg uppercase">Blog Archive / Orange Header</h4>
                        <p className="font-mono text-[10px] text-neutral-600">The archive header is fully CMS-controlled. The essay number remains live and is calculated from published articles.</p>
                      </div>
                      <div className="px-2 py-1 border-2 border-black bg-white font-mono text-[9px] font-black uppercase">
                        LIVE COUNT: {articles.filter(a => a.isPublished !== false && a.mainPublicationStatus !== 'unpublished').length}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <label className="font-mono text-[10px] font-black uppercase">Eyebrow
                        <input value={blogHeader.eyebrow} onChange={e => setBlogHeader(prev => ({ ...prev, eyebrow: e.target.value }))} className="w-full mt-1 px-3 py-2 border-2 border-black font-mono text-xs" />
                      </label>
                      <label className="font-mono text-[10px] font-black uppercase">Essay Count Label
                        <input value={blogHeader.essayCountLabel} onChange={e => setBlogHeader(prev => ({ ...prev, essayCountLabel: e.target.value }))} className="w-full mt-1 px-3 py-2 border-2 border-black font-mono text-xs" placeholder="ESSAYS PUBLISHED" />
                      </label>
                    </div>
                    <label className="font-mono text-[10px] font-black uppercase">Headline
                      <input value={blogHeader.title} onChange={e => setBlogHeader(prev => ({ ...prev, title: e.target.value }))} className="w-full mt-1 px-3 py-2 border-2 border-black font-display font-black text-lg" placeholder="ENGINEERING & ARCHITECTURE" />
                    </label>
                    <label className="font-mono text-[10px] font-black uppercase">Description
                      <textarea rows={3} value={blogHeader.description} onChange={e => setBlogHeader(prev => ({ ...prev, description: e.target.value }))} className="w-full mt-1 px-3 py-2 border-2 border-black font-sans text-sm" />
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                      <label className="font-mono text-[10px] font-black uppercase">Background
                        <div className="flex gap-2 mt-1"><input type="color" value={blogHeader.backgroundColor} onChange={e => setBlogHeader(prev => ({ ...prev, backgroundColor: e.target.value }))} className="w-10 h-10 border-2 border-black" /><input value={blogHeader.backgroundColor} onChange={e => setBlogHeader(prev => ({ ...prev, backgroundColor: e.target.value }))} className="flex-1 px-2 py-2 border-2 border-black font-mono text-xs uppercase" /></div>
                      </label>
                      <label className="font-mono text-[10px] font-black uppercase">Text Color
                        <div className="flex gap-2 mt-1"><input type="color" value={blogHeader.textColor} onChange={e => setBlogHeader(prev => ({ ...prev, textColor: e.target.value }))} className="w-10 h-10 border-2 border-black" /><input value={blogHeader.textColor} onChange={e => setBlogHeader(prev => ({ ...prev, textColor: e.target.value }))} className="flex-1 px-2 py-2 border-2 border-black font-mono text-xs uppercase" /></div>
                      </label>
                      <label className="border-2 border-black p-3 font-mono text-[10px] font-black uppercase flex items-center gap-2 bg-white"><input type="checkbox" checked={blogHeader.showEssayCount} onChange={e => setBlogHeader(prev => ({ ...prev, showEssayCount: e.target.checked }))} /> SHOW LIVE ESSAY COUNT</label>
                    </div>
                  </div>

                  {/* FOOTER BUILDER */}
                  <div className="space-y-5 p-4 border-2 border-black bg-neutral-50">
                    <div>
                      <h4 className="font-display font-black text-lg uppercase border-b-2 border-black pb-1">Footer Builder</h4>
                      <p className="font-mono text-[10px] text-neutral-600 mt-1">Footer navigation and publication links are stored in Firestore. Internal links route inside OFFSCRPT; external links open their real destination; RSS opens the live feed UI; topic links open the real topic page.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <label className="font-mono text-[10px] font-black uppercase">Navigation Title
                        <input value={footerNavigationTitle} onChange={e => setFooterNavigationTitle(e.target.value)} className="w-full mt-1 px-2 py-2 border-2 border-black bg-white" />
                      </label>
                      <label className="font-mono text-[10px] font-black uppercase">Topics Title
                        <input value={footerTopicsTitle} onChange={e => setFooterTopicsTitle(e.target.value)} className="w-full mt-1 px-2 py-2 border-2 border-black bg-white" />
                      </label>
                      <label className="font-mono text-[10px] font-black uppercase">Hub Title
                        <input value={footerHubTitle} onChange={e => setFooterHubTitle(e.target.value)} className="w-full mt-1 px-2 py-2 border-2 border-black bg-white" />
                      </label>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between"><div className="font-display font-black uppercase text-sm">Navigation Links</div><button type="button" onClick={() => addFooterLink('nav')} className="border-2 border-black bg-white px-3 py-1.5 font-mono text-[10px] font-black">+ ADD</button></div>
                      {footerNavigationLinks.map(link => (
                        <div key={link.id} className="border-2 border-black p-3 bg-white space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-[1.2fr_auto_1.5fr_auto] gap-2 items-center">
                            <input value={link.label} onChange={e => updateFooterLink('nav', link.id, { label: e.target.value })} placeholder="Label" className="border-2 border-black px-2 py-2 font-mono text-xs" />
                            <select value={link.type} onChange={e => updateFooterLink('nav', link.id, { type: e.target.value as FooterLink['type'], target: e.target.value === 'rss' ? 'rss' : link.target })} className="border-2 border-black px-2 py-2 font-mono text-xs uppercase">
                              <option value="internal">INTERNAL</option><option value="external">EXTERNAL</option><option value="topic">TOPIC</option><option value="rss">RSS</option>
                            </select>
                            {link.type === 'internal' ? (
                              <select value={link.target} onChange={e => updateFooterLink('nav', link.id, { target: e.target.value })} className="border-2 border-black px-2 py-2 font-mono text-xs uppercase">
                                {(['home','blog','explore','series','saved','history','notifications','social','about','links','contact'] as PageView[]).map(page => <option key={page} value={page}>{page}</option>)}
                              </select>
                            ) : link.type === 'rss' ? (
                              <input disabled value="rss" className="border-2 border-black px-2 py-2 font-mono text-xs bg-neutral-100" />
                            ) : (
                              <input value={link.target} onChange={e => updateFooterLink('nav', link.id, { target: e.target.value })} placeholder={link.type === 'topic' ? 'topic slug e.g. react' : 'https://...'} className="border-2 border-black px-2 py-2 font-mono text-xs" />
                            )}
                            <button type="button" onClick={() => removeFooterLink('nav', link.id)} className="border-2 border-red-600 text-red-600 px-3 py-2 font-mono text-[10px] font-black">DELETE</button>
                          </div>
                          <label className="font-mono text-[9px] uppercase flex items-center gap-2"><input type="checkbox" checked={link.visible !== false} onChange={e => updateFooterLink('nav', link.id, { visible: e.target.checked })} /> VISIBLE</label>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between"><div className="font-display font-black uppercase text-sm">Publication Hub Links</div><button type="button" onClick={() => addFooterLink('hub')} className="border-2 border-black bg-white px-3 py-1.5 font-mono text-[10px] font-black">+ ADD</button></div>
                      {footerHubLinks.map(link => (
                        <div key={link.id} className="border-2 border-black p-3 bg-white space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-[1.2fr_auto_1.5fr_auto] gap-2 items-center">
                            <input value={link.label} onChange={e => updateFooterLink('hub', link.id, { label: e.target.value })} placeholder="Label" className="border-2 border-black px-2 py-2 font-mono text-xs" />
                            <select value={link.type} onChange={e => updateFooterLink('hub', link.id, { type: e.target.value as FooterLink['type'], target: e.target.value === 'rss' ? 'rss' : link.target })} className="border-2 border-black px-2 py-2 font-mono text-xs uppercase">
                              <option value="external">EXTERNAL</option><option value="internal">INTERNAL</option><option value="topic">TOPIC</option><option value="rss">RSS</option>
                            </select>
                            {link.type === 'internal' ? (
                              <select value={link.target} onChange={e => updateFooterLink('hub', link.id, { target: e.target.value })} className="border-2 border-black px-2 py-2 font-mono text-xs uppercase">
                                {(['home','blog','explore','series','saved','history','notifications','social','about','links','contact'] as PageView[]).map(page => <option key={page} value={page}>{page}</option>)}
                              </select>
                            ) : link.type === 'rss' ? (
                              <input disabled value="rss" className="border-2 border-black px-2 py-2 font-mono text-xs bg-neutral-100" />
                            ) : (
                              <input value={link.target} onChange={e => updateFooterLink('hub', link.id, { target: e.target.value })} placeholder={link.type === 'topic' ? 'topic slug' : 'https://...'} className="border-2 border-black px-2 py-2 font-mono text-xs" />
                            )}
                            <button type="button" onClick={() => removeFooterLink('hub', link.id)} className="border-2 border-red-600 text-red-600 px-3 py-2 font-mono text-[10px] font-black">DELETE</button>
                          </div>
                          <label className="font-mono text-[9px] uppercase flex items-center gap-2"><input type="checkbox" checked={link.visible !== false} onChange={e => updateFooterLink('hub', link.id, { visible: e.target.checked })} /> VISIBLE</label>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <label className="font-mono text-[10px] font-black uppercase">Footer Topic Override
                        <textarea rows={4} value={footerTopicCategories.join('\n')} onChange={e => setFooterTopicCategories(e.target.value.split(/[\n,]/).map(x => x.trim()).filter(Boolean))} placeholder="react\narchitecture\nlocal ai" className="w-full mt-1 px-3 py-2 border-2 border-black bg-white font-mono text-xs" />
                        <span className="block text-[9px] text-neutral-500 mt-1">Leave empty to automatically show the most-used tags from published articles.</span>
                      </label>
                      <label className="font-mono text-[10px] font-black uppercase">Bottom-right Footer Text
                        <input value={footerBottomRightText} onChange={e => setFooterBottomRightText(e.target.value)} className="w-full mt-1 px-3 py-2 border-2 border-black bg-white font-mono text-xs" placeholder="HIGH DENSITY SPECIFICATION" />
                      </label>
                    </div>
                  </div>

                  {/* GLOBAL THEME ACCENT PALETTE */}
                  <div className="space-y-4">
                    <h4 className="font-display font-black text-lg uppercase border-b-2 border-black pb-1">Neo-Brutalist Theme Palette</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="font-mono text-[10px] font-bold uppercase block mb-1">Primary Color</label>
                        <div className="flex items-center space-x-1">
                          <input type="color" value={themePrimaryColor} onChange={e => setThemePrimaryColor(e.target.value)} className="w-8 h-8 border border-black cursor-pointer" />
                          <input type="text" value={themePrimaryColor} onChange={e => setThemePrimaryColor(e.target.value)} className="w-full px-2 py-1 border border-black font-mono text-xs uppercase" />
                        </div>
                      </div>
                      <div>
                        <label className="font-mono text-[10px] font-bold uppercase block mb-1">Secondary Color</label>
                        <div className="flex items-center space-x-1">
                          <input type="color" value={themeSecondaryColor} onChange={e => setThemeSecondaryColor(e.target.value)} className="w-8 h-8 border border-black cursor-pointer" />
                          <input type="text" value={themeSecondaryColor} onChange={e => setThemeSecondaryColor(e.target.value)} className="w-full px-2 py-1 border border-black font-mono text-xs uppercase" />
                        </div>
                      </div>
                      <div>
                        <label className="font-mono text-[10px] font-bold uppercase block mb-1">Accent Pink</label>
                        <div className="flex items-center space-x-1">
                          <input type="color" value={themeAccentColor} onChange={e => setThemeAccentColor(e.target.value)} className="w-8 h-8 border border-black cursor-pointer" />
                          <input type="text" value={themeAccentColor} onChange={e => setThemeAccentColor(e.target.value)} className="w-full px-2 py-1 border border-black font-mono text-xs uppercase" />
                        </div>
                      </div>
                      <div>
                        <label className="font-mono text-[10px] font-bold uppercase block mb-1">Success Green</label>
                        <div className="flex items-center space-x-1">
                          <input type="color" value={themeSuccessColor} onChange={e => setThemeSuccessColor(e.target.value)} className="w-8 h-8 border border-black cursor-pointer" />
                          <input type="text" value={themeSuccessColor} onChange={e => setThemeSuccessColor(e.target.value)} className="w-full px-2 py-1 border border-black font-mono text-xs uppercase" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CONTACT INFO */}
                  <div className="space-y-4">
                    <h4 className="font-display font-black text-lg uppercase border-b-2 border-black pb-1">Contact Channels</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="font-mono text-xs font-bold uppercase text-black">Contact Email</label>
                        <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="w-full px-3 py-2 border-2 border-black font-mono text-xs focus:outline-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="font-mono text-xs font-bold uppercase text-black">Twitter / X Handle</label>
                        <input type="text" value={contactTwitter} onChange={(e) => setContactTwitter(e.target.value)} className="w-full px-3 py-2 border-2 border-black font-mono text-xs focus:outline-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="font-mono text-xs font-bold uppercase text-black">GitHub Profile</label>
                        <input type="text" value={contactGithub} onChange={(e) => setContactGithub(e.target.value)} className="w-full px-3 py-2 border-2 border-black font-mono text-xs focus:outline-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="font-mono text-xs font-bold uppercase text-black">Telegram Handle</label>
                        <input type="text" value={contactTelegram} onChange={(e) => setContactTelegram(e.target.value)} className="w-full px-3 py-2 border-2 border-black font-mono text-xs focus:outline-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="font-mono text-xs font-bold uppercase text-black">Instagram Handle / URL</label>
                        <input type="text" value={contactInstagram} onChange={(e) => setContactInstagram(e.target.value)} placeholder="https://instagram.com/..." className="w-full px-3 py-2 border-2 border-black font-mono text-xs focus:outline-none" />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingConfig}
                    className="w-full py-4 bg-[var(--color-primary)] text-black font-display font-black text-base uppercase neo-border neo-shadow-sm hover:bg-[var(--color-secondary)] active:translate-x-1 active:translate-y-1 transition-all disabled:opacity-50"
                  >
                    {isSavingConfig ? 'SAVING TO FIRESTORE...' : 'SAVE ALL SETTINGS GLOBALLY'}
                  </button>
                </form>
              </div>
            )}

            {/* TAB: CREATE / EDIT ARTICLE */}
            {activeTab === 'create' && (
              <div className={`p-6 ${panelScrollClass} space-y-6`}>
                {draftRecoveryAvailable && !editingArticleSlug && (
                  <div className="border-2 border-black bg-[var(--color-success)] p-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-display font-black uppercase text-sm">RECOVERED UNSENT DRAFT</div>
                      <div className="font-mono text-[9px] uppercase mt-1">Restored from your cloud/local backup.</div>
                    </div>
                    <button type="button" onClick={resetForm} className="border-2 border-black bg-white px-3 py-2 font-mono text-[9px] font-black uppercase">DISCARD DRAFT</button>
                  </div>
                )}
                <div className="bg-[var(--color-primary)]/30 p-3.5 neo-border-2 font-sans text-xs text-black space-y-1">
                  <div className="font-display font-black text-sm uppercase flex items-center space-x-1.5">
                    <Smartphone className="w-4 h-4 text-black" />
                    <span>{editingArticleSlug ? `EDITING: ${editingArticleSlug}` : 'NEW ARTICLE PUBLISHER'}</span>
                  </div>
                  <p>
                    Published articles are immediately stored in the Firestore database and will appear dynamically on the live site across devices.
                  </p>
                </div>

                {publishSuccess ? (
                  <div className="py-12 text-center bg-white neo-border p-8 space-y-3">
                    <div className="w-12 h-12 bg-[var(--color-success)] neo-border-2 flex items-center justify-center mx-auto neo-shadow-sm">
                      <Check className="w-6 h-6 text-black stroke-[3]" />
                    </div>
                    <h3 className="font-display font-black text-2xl uppercase text-black">ARTICLE PERSISTED TO CLOUD!</h3>
                    <p className="font-sans text-sm text-neutral-600">
                      Your article is now stored in Firestore and visible on the website.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handlePublish} className="space-y-4">
                    {publishError && (
                      <div className="p-3 bg-red-100 border-2 border-red-500 font-mono text-xs text-red-800 font-bold">
                        {publishError}
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="font-mono text-xs font-bold uppercase text-black">
                        Article Title *
                      </label>
                      <input
                        type="text"
                        required
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="e.g. Distributed Consensus in Modern Microservices"
                        className="w-full px-3.5 py-2.5 border-2 border-black font-sans font-bold text-base bg-white"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="font-mono text-xs font-bold uppercase text-black">
                          Category *
                        </label>
                        <select
                          value={newCategory}
                          onChange={(e) => { const value = e.target.value; if (value === '__custom__') { setShowCustomCategoryInput(true); } else { setShowCustomCategoryInput(false); setNewCategory(value as Category); } }}
                          className="w-full px-3.5 py-2.5 border-2 border-black font-sans font-bold text-sm bg-white"
                        >
                          <option value="Web Development">Web Development</option>
                          <option value="Artificial Intelligence">Artificial Intelligence</option>
                          <option value="Software Engineering">Software Engineering</option>
                          <option value="Computer Science">Computer Science</option>
                          <option value="Developer Tools">Developer Tools</option>
                          <option value="System Design">System Design</option>
                          {customCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                          <option value="__custom__">+ ADD CUSTOM CATEGORY...</option>
                        </select>
                        {showCustomCategoryInput && <div className="mt-2 flex gap-2">
                          <input
                            value={customCategoryInput}
                            onChange={(e) => setCustomCategoryInput(e.target.value)}
                            placeholder="ADD CUSTOM CATEGORY"
                            className="min-w-0 flex-1 px-3 py-2 border-2 border-black font-mono text-xs uppercase bg-white"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              const value = customCategoryInput.trim().replace(/\s+/g, ' ');
                              if (!value) return;
                              if (customCategories.some(c => c.toLowerCase() === value.toLowerCase())) { setNewCategory(value); setCustomCategoryInput(''); return; }
                              const next = [...customCategories, value];
                              setCustomCategories(next);
                              setNewCategory(value);
                              setCustomCategoryInput('');
                              try {
                                const nextConfig = { ...siteConfig, customCategories: next };
                                await saveSiteConfig(nextConfig);
                                onUpdateSiteConfig(nextConfig);
                              } catch (err: any) { notifyToast('Failed to save custom category: ' + (err.message || 'Permission denied')); }
                            }}
                            className="px-3 py-2 bg-[var(--color-primary)] border-2 border-black font-display font-black text-xs uppercase"
                          >ADD</button>
                        </div>}
                        {customCategories.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {customCategories.map(category => (
                              <button key={category} type="button" onClick={() => setNewCategory(category)} className="px-2 py-1 border border-black bg-neutral-100 font-mono text-[10px] uppercase hover:bg-[var(--color-secondary)]">{category}</button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="font-mono text-xs font-bold uppercase text-black">
                          Reading Time (Minutes)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="60"
                          value={newReadingTime}
                          onChange={(e) => setNewReadingTime(Number(e.target.value))}
                          className="w-full px-3.5 py-2.5 border-2 border-black font-mono text-sm bg-white"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="font-mono text-xs font-bold uppercase text-black">
                        Tags (Comma Separated)
                      </label>
                      <input
                        type="text"
                        value={newTags}
                        onChange={(e) => setNewTags(e.target.value)}
                        placeholder="e.g. Distributed Systems, Rust, High Performance"
                        className="w-full px-3.5 py-2.5 border-2 border-black font-mono text-xs bg-white"
                      />
                    </div>

                    <div className="border-2 border-black bg-neutral-50 p-3 space-y-3">
                      <div className="font-display font-black text-sm uppercase">SERIES</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <select value={newSeriesId} onChange={e=>{ const id=e.target.value; setNewSeriesId(id); const found=seriesList.find(x=>x.id===id); if(found){setNewSeriesName(found.title);}}} className="border-2 border-black p-2 font-mono text-xs bg-white">
                          <option value="">No series</option>
                          {seriesList.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}
                        </select>
                        <input value={newSeriesName} onChange={e=>setNewSeriesName(e.target.value)} placeholder="Series name" className="border-2 border-black p-2 font-mono text-xs" />
                        <input type="number" min="1" value={newSeriesOrder} onChange={e=>setNewSeriesOrder(e.target.value===''?'':Math.max(1,Number(e.target.value)))} placeholder="Part #" className="border-2 border-black p-2 font-mono text-xs" />
                      </div>
                      <p className="font-mono text-[9px] text-neutral-500 uppercase">Create a series from the SERIES tab, then assign each article to it and give it a part number.</p>
                    </div>

                    <div className="space-y-1">
                      <label className="font-mono text-xs font-bold uppercase text-black">
                        Excerpt / Executive Abstract *
                      </label>
                      <textarea
                        required
                        rows={3}
                        value={newExcerpt}
                        onChange={(e) => setNewExcerpt(e.target.value)}
                        placeholder="Write a punchy, high-density summary of this architectural dispatch..."
                        className="w-full px-3.5 py-2.5 border-2 border-black font-sans text-sm bg-white"
                      />
                    </div>

                    {/* Cover Image */}
                    <div className="space-y-2 border-2 border-black p-3 bg-neutral-50">
                      <div className="flex items-center justify-between gap-3">
                        <label className="font-mono text-xs font-bold uppercase text-black block">Cover Image</label>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2"><input
                        type="url"
                        value={newCoverImage}
                        onChange={(e) => setNewCoverImage(e.target.value)}
                        placeholder="Or paste a public image URL..."
                        className="flex-1 px-3 py-2 border-2 border-black font-mono text-xs bg-white"
                      /><MediaUploadButton folder="articles" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" label="UPLOAD COVER" compact cropAspect="16:9" cropShape="rect" outputWidth={1600} outputHeight={900} onUploaded={(url) => setNewCoverImage(url)} /></div>
                      {newCoverImage && <img src={newCoverImage} alt="Cover preview" className="w-full h-40 object-cover border-2 border-black" />}
                      <p className="font-mono text-[10px] text-neutral-500 uppercase">Upload to OFFSCRPT media storage or paste a public image URL.</p>
                    </div>

                    {/* Advanced Block Editor */}
                    <div className="border-4 border-black bg-neutral-50 p-4 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-black pb-3">
                        <div>
                          <h4 className="font-display font-black text-lg uppercase">Article Block Editor</h4>
                          <p className="font-mono text-[10px] uppercase text-neutral-500">Drag blocks to reorder. Uploaded media is stored in OFFSCRPT media storage; Firestore stores the media URL and metadata.</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {([
                            ['paragraph','TEXT'],['heading2','H2'],['heading3','H3'],['image','IMAGE'],['video','VIDEO'],['link','LINK'],['button','BUTTON'],['code','CODE'],['quote','QUOTE'],['callout','CALLOUT'],['list','LIST'],['takeaways','TAKEAWAYS']
                          ] as const).map(([type,label]) => (
                            <button key={type} type="button" onClick={() => addContentBlock(type)} className="px-2.5 py-1.5 border-2 border-black bg-white font-mono text-[10px] font-bold uppercase hover:bg-[var(--color-primary)]">+ {label}</button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        {contentBlocks.map((block, index) => (
                          <div
                            key={index}
                            draggable
                            onDragStart={() => setDraggedBlockIndex(index)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => handleBlockDrop(index)}
                            className="border-2 border-black bg-white p-3 neo-shadow-sm"
                          >
                            <div className="flex items-center justify-between gap-2 mb-3 border-b border-black pb-2">
                              <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase"><Move className="w-3.5 h-3.5" /> {index + 1}. {block.type}</div>
                              <div className="flex items-center gap-1">
                                <button type="button" onClick={() => moveContentBlock(index,-1)} disabled={index===0} className="p-1.5 border border-black disabled:opacity-30"><ArrowUp className="w-3 h-3" /></button>
                                <button type="button" onClick={() => moveContentBlock(index,1)} disabled={index===contentBlocks.length-1} className="p-1.5 border border-black disabled:opacity-30"><ArrowDown className="w-3 h-3" /></button>
                                <button type="button" onClick={() => removeContentBlock(index)} className="p-1.5 border border-black hover:bg-red-500 hover:text-white"><Trash2 className="w-3 h-3" /></button>
                              </div>
                            </div>

                            {block.type === 'image' ? (
                              <div className="space-y-2">
                                {block.imageUrl ? <img src={block.imageUrl} alt={block.imageAlt || ''} className="w-full max-h-64 object-cover border-2 border-black" /> : <div className="h-32 border-2 border-dashed border-black flex items-center justify-center font-mono text-xs">NO IMAGE SELECTED</div>}
                                <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                                  <input type="url" value={block.imageUrl || ''} onChange={(e) => updateContentBlock(index,{imageUrl:e.target.value})} placeholder="Or paste image URL" className="flex-1 min-w-[220px] px-3 py-2 border-2 border-black font-mono text-xs" />
                                  <MediaUploadButton folder="articles" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" label="UPLOAD IMAGE" compact cropAspect="free" cropShape="rect" outputWidth={1600} onUploaded={(url) => updateContentBlock(index,{imageUrl:url})} />
                                </div>
                                <input value={block.imageAlt || ''} onChange={(e)=>updateContentBlock(index,{imageAlt:e.target.value})} placeholder="Alt text" className="w-full px-3 py-2 border-2 border-black font-mono text-xs" />
                                <input value={block.imageCaption || ''} onChange={(e)=>updateContentBlock(index,{imageCaption:e.target.value})} placeholder="Caption (optional)" className="w-full px-3 py-2 border-2 border-black font-mono text-xs" />
                                <input value={block.imageHref || ''} onChange={(e)=>updateContentBlock(index,{imageHref:e.target.value})} placeholder="Optional image click-through URL" className="w-full px-3 py-2 border-2 border-black font-mono text-xs" />
                              </div>
                            ) : block.type === 'video' ? (
                              <div className="space-y-2">
                                <div className="flex flex-col gap-2"><input type="url" value={block.videoUrl || ''} onChange={(e)=>updateContentBlock(index,{videoUrl:e.target.value})} placeholder="YouTube / Vimeo / direct .mp4 / .webm URL" className="w-full px-3 py-2 border-2 border-black font-mono text-xs" /><MediaUploadButton folder="videos" accept="video/mp4,video/webm,video/quicktime" label="UPLOAD VIDEO" compact onUploaded={(url) => updateContentBlock(index,{videoUrl:url})} /></div>
                                <input value={block.videoTitle || ''} onChange={(e)=>updateContentBlock(index,{videoTitle:e.target.value})} placeholder="Accessible video title" className="w-full px-3 py-2 border-2 border-black font-mono text-xs" />
                                <input value={block.videoCaption || ''} onChange={(e)=>updateContentBlock(index,{videoCaption:e.target.value})} placeholder="Caption (optional)" className="w-full px-3 py-2 border-2 border-black font-mono text-xs" />
                              </div>
                            ) : block.type === 'link' ? (
                              <div className="grid gap-2"><input value={block.linkText || ''} onChange={(e)=>updateContentBlock(index,{linkText:e.target.value})} placeholder="Visible linked text" className="w-full px-3 py-2 border-2 border-black font-sans text-sm" /><input value={block.href || ''} onChange={(e)=>updateContentBlock(index,{href:e.target.value})} placeholder="https://example.com or /blog" className="w-full px-3 py-2 border-2 border-black font-mono text-xs" /></div>
                            ) : block.type === 'button' ? (
                              <div className="grid gap-2"><input value={block.buttonText || ''} onChange={(e)=>updateContentBlock(index,{buttonText:e.target.value})} placeholder="Button label" className="w-full px-3 py-2 border-2 border-black font-display font-bold" /><div className="grid grid-cols-[1fr_auto] gap-2"><input value={block.href || ''} onChange={(e)=>updateContentBlock(index,{href:e.target.value})} placeholder="https://example.com or /blog" className="w-full px-3 py-2 border-2 border-black font-mono text-xs" /><select value={block.buttonStyle || 'primary'} onChange={(e)=>updateContentBlock(index,{buttonStyle:e.target.value as any})} className="px-2 py-2 border-2 border-black font-mono text-xs"><option value="primary">Primary</option><option value="secondary">Secondary</option><option value="dark">Dark</option></select></div></div>
                            ) : block.type === 'code' ? (
                              <div className="space-y-2"><div className="flex gap-2"><select value={block.codeBlock?.language || 'typescript'} onChange={(e)=>updateContentBlock(index,{codeBlock:{...(block.codeBlock || {code:''}),language:e.target.value}})} className="px-2 py-2 border-2 border-black font-mono text-xs"><option>typescript</option><option>javascript</option><option>python</option><option>rust</option><option>go</option><option>json</option><option>bash</option></select><input value={block.codeBlock?.filename || ''} onChange={(e)=>updateContentBlock(index,{codeBlock:{...(block.codeBlock || {language:'typescript',code:''}),filename:e.target.value}})} placeholder="Filename" className="flex-1 px-3 py-2 border-2 border-black font-mono text-xs" /></div><textarea rows={7} value={block.codeBlock?.code || ''} onChange={(e)=>updateContentBlock(index,{codeBlock:{...(block.codeBlock || {language:'typescript',filename:''}),code:e.target.value}})} placeholder="Paste code..." className="w-full px-3 py-2 border-2 border-black font-mono text-xs" /></div>
                            ) : block.type === 'quote' ? (
                              <div className="space-y-2"><textarea rows={3} value={block.content || ''} onChange={(e)=>updateContentBlock(index,{content:e.target.value})} placeholder="Quote..." className="w-full px-3 py-2 border-2 border-black font-serif text-sm" /><input value={block.quoteAuthor || ''} onChange={(e)=>updateContentBlock(index,{quoteAuthor:e.target.value})} placeholder="Quote author" className="w-full px-3 py-2 border-2 border-black font-mono text-xs" /></div>
                            ) : block.type === 'callout' ? (
                              <div className="space-y-2"><div className="flex gap-2"><select value={block.calloutType || 'info'} onChange={(e)=>updateContentBlock(index,{calloutType:e.target.value as any})} className="px-2 py-2 border-2 border-black font-mono text-xs"><option value="info">Info</option><option value="tip">Tip</option><option value="warning">Warning</option><option value="insight">Insight</option></select><input value={block.calloutTitle || ''} onChange={(e)=>updateContentBlock(index,{calloutTitle:e.target.value})} placeholder="Callout title" className="flex-1 px-3 py-2 border-2 border-black font-mono text-xs" /></div><textarea rows={4} value={block.content || ''} onChange={(e)=>updateContentBlock(index,{content:e.target.value})} placeholder="Callout content..." className="w-full px-3 py-2 border-2 border-black text-sm" /></div>
                            ) : block.type === 'list' || block.type === 'takeaways' ? (
                              <div className="space-y-2">{(block.items || ['']).map((item,itemIndex)=><div key={itemIndex} className="flex gap-2"><input value={item} onChange={(e)=>{const items=[...(block.items||[])];items[itemIndex]=e.target.value;updateContentBlock(index,{items})}} placeholder={`${block.type === 'list' ? 'List' : 'Takeaway'} item ${itemIndex+1}`} className="flex-1 px-3 py-2 border-2 border-black text-sm" /><button type="button" onClick={()=>updateContentBlock(index,{items:(block.items||[]).filter((_,i)=>i!==itemIndex)})} className="px-2 border-2 border-black"><Minus className="w-3 h-3" /></button></div>)}<button type="button" onClick={()=>updateContentBlock(index,{items:[...(block.items||[]),'']})} className="px-3 py-1.5 border-2 border-black font-mono text-[10px] font-bold uppercase">+ ITEM</button></div>
                            ) : (
                              <div className="space-y-2">
                                <div className="flex flex-wrap gap-1.5 items-center">
                                  <button type="button" onMouseDown={(e)=>e.preventDefault()} onClick={()=>insertInlineLink(index, block.content || '')} className="px-2 py-1 border-2 border-black bg-white font-mono text-[10px] font-black uppercase hover:bg-[var(--color-secondary)]">LINK SELECTED TEXT</button>
                                  <span className="px-2 py-1 border-2 border-dashed border-neutral-400 font-mono text-[10px] text-neutral-500">Raw URLs auto-link on the published article.</span>
                                </div>
                                <textarea rows={block.type === 'paragraph' ? 7 : 3} value={block.content || ''} onChange={(e)=>updateContentBlock(index,{content:e.target.value})} placeholder={block.type === 'heading2' ? 'Section heading...' : block.type === 'heading3' ? 'Subheading...' : 'Write this block...'} className={`w-full px-3 py-2 border-2 border-black bg-white ${block.type === 'paragraph' ? 'font-serif text-sm' : 'font-display font-bold'}`} /></div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2 border-2 border-black p-3 bg-neutral-50">
                      <label className="font-mono text-xs font-bold uppercase text-black">Cover Metadata</label>
                      <input type="text" value={newCoverAlt} onChange={(e)=>setNewCoverAlt(e.target.value)} placeholder="Cover alt text" className="w-full px-3 py-2 border-2 border-black font-mono text-xs bg-white" />
                      <input type="text" value={newCoverCaption} onChange={(e)=>setNewCoverCaption(e.target.value)} placeholder="Cover caption (optional)" className="w-full px-3 py-2 border-2 border-black font-mono text-xs bg-white" />
                    </div>

                    {/* Homepage Feature / Pin Controls */}
                    <div className="p-4 bg-[var(--color-primary)]/20 border-2 border-black space-y-2">
                      <div className="flex items-center space-x-2">
                        <Sparkles className="w-4 h-4 fill-black text-black" />
                        <h5 className="font-display font-black text-sm uppercase text-black">
                          HOMEPAGE FEATURE &amp; PIN CONTROL
                        </h5>
                      </div>
                      <p className="font-mono text-xs text-neutral-700">
                        Marking this article as Featured / Pinned will elevate it to the main featured headline on the homepage and the top editorial spotlight.
                      </p>
                      <label className="flex items-center space-x-3 cursor-pointer select-none bg-white p-3 border-2 border-black hover:bg-neutral-50 transition-colors">
                        <input
                          type="checkbox"
                          checked={newIsFeatured || newIsPinned}
                          onChange={(e) => {
                            setNewIsFeatured(e.target.checked);
                            setNewIsPinned(e.target.checked);
                          }}
                          className="w-5 h-5 accent-black border-2 border-black cursor-pointer"
                        />
                        <span className="font-display font-black text-xs uppercase text-black">
                          PIN AS MAIN FEATURED ARTICLE ON HOMEPAGE
                        </span>
                      </label>
                    </div>

                    <div className="flex items-center space-x-3 pt-2">
                      <button
                        type="submit"
                        disabled={isPublishing}
                        className="flex-1 py-3.5 bg-[var(--color-primary)] text-black font-display font-black text-sm uppercase neo-border neo-shadow-sm hover:bg-[var(--color-secondary)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
                      >
                        {isPublishing ? 'PERSISTING TO FIRESTORE...' : (editingArticleSlug ? 'UPDATE ARTICLE IN FIRESTORE' : 'PUBLISH ARTICLE TO FIRESTORE')}
                      </button>
                      
                      {editingArticleSlug && (
                        <button
                          type="button"
                          onClick={resetForm}
                          className="px-6 py-3.5 bg-neutral-200 text-black font-display font-black text-sm uppercase neo-border hover:bg-neutral-300"
                        >
                          CANCEL
                        </button>
                      )}
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* TAB: MANAGE ARTICLES */}
            {activeTab === 'manage' && (
              <div className={`p-6 ${panelScrollClass} space-y-4`}>
                <div className="flex items-center justify-between border-b-2 border-black pb-2">
                  <h3 className="font-display font-black text-lg uppercase">
                    All Published Dispatches ({articles.length})
                  </h3>
                  <button
                    onClick={() => {
                      resetForm();
                      setActiveTab('create');
                    }}
                    className="px-3 py-1 bg-[var(--color-primary)] border-2 border-black font-mono text-xs font-bold uppercase hover:bg-neutral-200"
                  >
                    + Write New
                  </button>
                </div>

                <div className="space-y-3">
                  {articles.map((art) => (
                    <div 
                      key={art.slug} 
                      className="p-4 border-2 border-black bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 neo-shadow-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1 flex-wrap gap-y-1">
                          <span className="bg-black text-white font-mono text-[9px] font-bold px-1.5 py-0.5 uppercase">
                            {art.category}
                          </span>
                          <span className="font-mono text-[10px] text-neutral-500">{art.publishedAt}</span><span className="font-mono text-[10px] font-black text-neutral-500">{Number(art.viewsCount||0).toLocaleString()} VIEWS</span>
                          {(art.featured || art.pinned) && (
                            <span className="bg-[var(--color-primary)] text-black font-mono text-[9px] font-bold px-1.5 py-0.5 border border-black uppercase flex items-center space-x-1">
                              <Sparkles className="w-2.5 h-2.5 fill-black text-black" />
                              <span>FEATURED ON HOMEPAGE</span>
                            </span>
                          )}
                        </div>
                        <h4 className="font-display font-black text-base truncate text-black">
                          {art.title}
                        </h4>
                        <p className="font-sans text-xs text-neutral-600 line-clamp-1">
                          {art.excerpt}
                        </p>
                      </div>

                      <div className="flex items-center space-x-2 flex-wrap sm:flex-nowrap gap-y-1">
                        <button
                          onClick={() => handleToggleFeatured(art)}
                          disabled={togglingFeaturedSlug === art.slug}
                          className={`px-3 py-1.5 border-2 border-black font-mono text-xs font-bold uppercase transition-colors flex items-center space-x-1 ${
                            art.featured || art.pinned
                              ? 'bg-[var(--color-primary)] text-black hover:bg-neutral-200'
                              : 'bg-white text-neutral-800 hover:bg-[var(--color-primary)] hover:text-black'
                          }`}
                          title={art.featured || art.pinned ? "Click to unpin from homepage" : "Click to pin as featured article on homepage"}
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>
                            {togglingFeaturedSlug === art.slug
                              ? 'SAVING...'
                              : (art.featured || art.pinned ? 'UNPIN' : 'PIN TO HOME')}
                          </span>
                        </button>
                        <button
                          onClick={() => handleEditArticle(art)}
                          className="px-3 py-1.5 bg-white border-2 border-black font-mono text-xs font-bold uppercase hover:bg-[var(--color-primary)] transition-colors flex items-center space-x-1"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>EDIT</span>
                        </button>
                        <button onClick={() => openRevisionHistory(art)} className="px-3 py-1.5 bg-white border-2 border-black font-mono text-xs font-bold uppercase hover:bg-[var(--color-secondary)] transition-colors"><History className="w-3.5 h-3.5 inline mr-1"/>HISTORY</button>
                        <button
                          onClick={() => handleDeleteArticleClick(art.slug)}
                          className="px-3 py-1.5 bg-[var(--color-accent)] border-2 border-black font-mono text-xs font-bold uppercase text-black hover:bg-black hover:text-white transition-colors flex items-center space-x-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>DELETE</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB: BENTO LINKS */}
            {activeTab === 'links' && (
              <div className={`p-6 ${panelScrollClass} space-y-6`}>
                <div className="bg-[var(--color-primary)]/20 p-3.5 neo-border-2 font-sans text-xs text-black space-y-1">
                  <div className="font-display font-black text-sm uppercase flex items-center space-x-1.5">
                    <LinkIcon className="w-4 h-4 text-black" />
                    <span>BENTO SOCIAL &amp; RESOURCE GRID</span>
                  </div>
                  <p>Manage the high-impact social links on the `/links` page. Synced globally to Firestore.</p>
                </div>

                <form onSubmit={handleAddBentoLink} className="space-y-4 p-4 border-2 border-black bg-neutral-50">
                  <h4 className="font-display font-black text-sm uppercase">Add New Bento Link</h4>
                  
                  <div className="space-y-1">
                    <label className="font-mono text-xs font-bold uppercase">Title *</label>
                    <input 
                      type="text" 
                      required 
                      value={bentoTitle} 
                      onChange={e => setBentoTitle(e.target.value)} 
                      placeholder="e.g. GitHub Architecture Repos" 
                      className="w-full px-3 py-2 border-2 border-black font-bold focus:outline-none bg-white text-sm" 
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-mono text-xs font-bold uppercase">Target URL *</label>
                    <input 
                      type="url" 
                      required 
                      value={bentoUrl} 
                      onChange={e => setBentoUrl(e.target.value)} 
                      placeholder="https://github.com/..." 
                      className="w-full px-3 py-2 border-2 border-black font-mono focus:outline-none bg-white text-xs" 
                    />
                  </div>

                  <div className="border-2 border-black p-3 bg-white space-y-2">
                    <label className="font-mono text-xs font-bold uppercase">Logo / Image</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input type="url" value={bentoImageUrl} onChange={e=>setBentoImageUrl(e.target.value)} placeholder="https://... or upload" className="flex-1 px-3 py-2 border-2 border-black font-mono focus:outline-none text-xs" />
                      <MediaUploadButton folder="site" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" label="UPLOAD LOGO" compact cropAspect="1:1" cropShape="rect" outputWidth={1000} outputHeight={1000} onUploaded={url=>setBentoImageUrl(url)} />
                    </div>
                    {bentoImageUrl && <img src={bentoImageUrl} alt="Link logo preview" className="w-20 h-20 object-contain border-2 border-black bg-white" />}
                    <p className="font-mono text-[9px] text-neutral-500 uppercase">Leave empty to keep the card as a solid color block.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="font-mono text-xs font-bold uppercase">Icon</label>
                      <select value={bentoIcon} onChange={e => setBentoIcon(e.target.value)} className="w-full px-3 py-2 border-2 border-black font-bold focus:outline-none bg-white text-sm">
                        <option value="link">Link (Default)</option>
                        <option value="github">GitHub</option>
                        <option value="twitter">Twitter / X</option>
                        <option value="youtube">YouTube</option>
                        <option value="podcast">Podcast</option>
                        <option value="mail">Newsletter / Mail</option>
                        <option value="globe">Website</option>
                        <option value="linkedin">LinkedIn</option>
                        <option value="instagram">Instagram</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="font-mono text-xs font-bold uppercase">Color (Hex)</label>
                      <div className="flex items-center space-x-2">
                        <input type="color" value={bentoColor} onChange={e => setBentoColor(e.target.value)} className="w-10 h-10 border-2 border-black p-0.5 cursor-pointer" />
                        <input type="text" value={bentoColor} onChange={e => setBentoColor(e.target.value)} className="flex-1 px-3 py-2 border-2 border-black font-mono uppercase focus:outline-none text-xs" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 pt-1">
                    <input type="checkbox" id="isFeatured" checked={bentoIsFeatured} onChange={e => setBentoIsFeatured(e.target.checked)} className="w-4 h-4 border-2 border-black accent-[var(--color-primary)]" />
                    <label htmlFor="isFeatured" className="font-mono text-xs font-bold uppercase cursor-pointer">Featured Link (Span Full Width)</label>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isSavingBento}
                    className="w-full py-2.5 bg-[var(--color-success)] border-2 border-black font-display font-black text-sm uppercase hover:bg-black hover:text-[var(--color-success)] transition-colors disabled:opacity-50"
                  >
                    {isSavingBento ? 'SAVING...' : 'ADD LINK TO CLOUD'}
                  </button>
                </form>

                <div className="space-y-3 pt-2 border-t-2 border-black">
                  <h4 className="font-display font-black text-sm uppercase mb-2">Current Bento Links</h4>
                  {[...bentoLinks].sort((a, b) => a.order - b.order).map((link, index, arr) => (
                    <div key={link.id} className="flex items-center justify-between p-3 border-2 border-black bg-white neo-shadow-sm">
                      <div className="flex items-center space-x-3 overflow-hidden">
                        <div className="w-12 h-12 border-2 border-black bg-white flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ backgroundColor: link.imageUrl ? '#ffffff' : link.color }}>
                          {link.imageUrl ? <img src={link.imageUrl} alt="" className="w-full h-full object-contain" /> : null}
                        </div>
                        <div className="flex-1 truncate">
                          <div className="font-bold text-sm truncate flex items-center space-x-2">
                            <span>{link.title}</span>
                            {link.isFeatured && <span className="bg-[var(--color-primary)] px-1.5 py-0.5 text-[9px] font-mono border border-black uppercase">Featured</span>}
                          </div>
                          <div className="font-mono text-[10px] text-neutral-500 truncate">{link.url}</div>
                        </div>
                      </div>
                      <div className="flex space-x-1.5 ml-2">
                        <button
                          onClick={() => handleMoveBentoLink(index, 'up')}
                          disabled={index === 0}
                          className="p-1.5 border-2 border-black hover:bg-neutral-200 disabled:opacity-30"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveBentoLink(index, 'down')}
                          disabled={index === arr.length - 1}
                          className="p-1.5 border-2 border-black hover:bg-neutral-200 disabled:opacity-30"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteBentoLink(link.id)}
                          className="p-1.5 bg-[var(--color-accent)] border-2 border-black hover:bg-black hover:text-white transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {bentoLinks.length === 0 && (
                    <p className="font-mono text-xs text-neutral-500">No links stored in database.</p>
                  )}
                </div>
              </div>
            )}

            {/* TAB: SOCIAL MODERATION */}
            {activeTab === 'media' && !isModerator && (
              <div className={`p-6 ${panelScrollClass} space-y-5`}>
                <div className="border-4 border-black bg-black text-white p-5">
                  <div className="font-display font-black text-2xl uppercase">OFFSCRPT MEDIA CENTER</div>
                  <p className="font-mono text-[10px] text-neutral-300 mt-1">Upload site-wide images, videos and PDFs directly to Cloudflare R2. Only the final public URL is stored with your Firestore content.</p>
                </div>
                <div className="border-2 border-black p-4 space-y-4 bg-white">
                  <div className="grid md:grid-cols-[1fr_auto] gap-3 items-end">
                    <label className="font-mono text-[10px] font-black uppercase">Upload destination
                      <select value={mediaFolder} onChange={e=>setMediaFolder(e.target.value as typeof mediaFolder)} className="w-full mt-1 border-2 border-black p-3 bg-white font-mono text-xs">
                        <option value="site">SITE ASSETS</option>
                        <option value="articles">ARTICLE MEDIA</option>
                        <option value="carousel">CAROUSEL MEDIA</option>
                        <option value="videos">VIDEOS</option>
                        <option value="attachments">PDF ATTACHMENTS</option>
                      </select>
                    </label>
                    <div className="font-mono text-[9px] text-neutral-500 uppercase">Production R2 storage · authenticated upload</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <MediaUploadButton folder={mediaFolder} accept="image/jpeg,image/png,image/webp,image/gif,image/avif" label="UPLOAD IMAGES" multiple onUploaded={(url,meta)=>setRecentMedia(items=>[{url,kind:meta.kind,size:meta.size,objectKey:meta.objectKey,uploadedAt:Date.now()},...items].slice(0,50))} />
                    <MediaUploadButton folder={mediaFolder} accept="video/mp4,video/webm,video/quicktime" label="UPLOAD VIDEOS" multiple onUploaded={(url,meta)=>setRecentMedia(items=>[{url,kind:meta.kind,size:meta.size,objectKey:meta.objectKey,uploadedAt:Date.now()},...items].slice(0,50))} />
                    <MediaUploadButton folder="attachments" accept="application/pdf" label="UPLOAD PDF" multiple onUploaded={(url,meta)=>setRecentMedia(items=>[{url,kind:meta.kind,size:meta.size,objectKey:meta.objectKey,uploadedAt:Date.now()},...items].slice(0,50))} />
                  </div>
                  <div className="border-t-2 border-black pt-3">
                    <div className="font-mono text-[9px] font-black uppercase mb-2">Recent uploads · this session</div>
                    <div className="space-y-2">
                      {recentMedia.map((item,i)=><div key={`${item.objectKey}-${i}`} className="border-2 border-black p-2 flex flex-col sm:flex-row gap-2 sm:items-center">
                        <div className="w-24 h-16 border border-black bg-neutral-100 shrink-0 overflow-hidden">{item.kind==='video'?<video src={item.url} className="w-full h-full object-cover" muted preload="metadata"/>:item.kind==='image'?<img src={item.url} alt="Uploaded media" className="w-full h-full object-cover" loading="lazy"/>:<div className="w-full h-full grid place-items-center font-mono text-[10px]">PDF</div>}</div>
                        <div className="flex-1 min-w-0"><div className="font-mono text-[9px] uppercase">{item.kind} · {(item.size/1024/1024).toFixed(2)} MB</div><div className="font-mono text-[9px] break-all mt-1">{item.url}</div></div>
                        <button type="button" onClick={()=>void navigator.clipboard?.writeText(item.url)} className="border-2 border-black bg-white px-3 py-2 font-mono text-[9px] font-black">COPY URL</button>
                      </div>)}
                      {!recentMedia.length && <div className="border-2 border-dashed border-black p-8 text-center font-mono text-xs">NO UPLOADS IN THIS SESSION.</div>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'social' && (isModerator ? <div className="p-6"><div className="border-4 border-black bg-black text-white p-5 font-mono text-xs">SITE MODERATOR MODE — USE MASTER CONTROL FOR MODERATION. MASTER-ONLY SETTINGS ARE HIDDEN.</div><AdminControlPanel isModerator /></div> : <SocialAdminPanel />)}

            {/* TAB: MASTER CONTROL */}
            {activeTab === 'control' && !isModerator && <AdminControlPanel onSiteConfigRestored={async () => { onUpdateSiteConfig(await getSiteConfig()); }} />}

            {/* TAB: CAROUSEL */}
            {activeTab === 'series' && (
              <div className={`p-6 ${panelScrollClass} space-y-6`}>
                <div className="border-4 border-black bg-[var(--color-primary)] p-5 neo-shadow"><div className="font-mono text-[10px]">PHASE 2 / STRUCTURED PUBLISHING</div><h2 className="font-display font-black text-3xl uppercase">SERIES MANAGER</h2><p className="text-sm mt-1">Create reusable reading paths, then assign articles to numbered parts from the article publisher.</p></div>
                <form onSubmit={async e=>{e.preventDefault(); if(!seriesTitleInput.trim()) return; setSeriesBusy(true); try { const slug=(seriesSlugInput.trim()||seriesTitleInput.trim()).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60); const created=await createSeries({id:slug,slug,title:seriesTitleInput.trim(),description:seriesDescInput.trim(),coverImage:seriesCoverInput.trim()||undefined,ownerId:auth.currentUser!.uid,ownerUsername:'krishsarkar',ownerName:authorName}); setSeriesList(p=>[created,...p]); setSeriesTitleInput('');setSeriesSlugInput('');setSeriesDescInput('');setSeriesCoverInput(''); } catch(err:any){notifyToast(err?.message||'Failed to create series.')} finally{setSeriesBusy(false)}}} className="border-4 border-black p-4 bg-white space-y-3">
                  <h3 className="font-display font-black uppercase">CREATE SERIES</h3>
                  <div className="grid md:grid-cols-2 gap-2"><input required value={seriesTitleInput} onChange={e=>setSeriesTitleInput(e.target.value)} placeholder="Series title" className="border-2 border-black p-3"/><input value={seriesSlugInput} onChange={e=>setSeriesSlugInput(e.target.value)} placeholder="Slug (optional)" className="border-2 border-black p-3 font-mono text-xs"/></div>
                  <textarea value={seriesDescInput} onChange={e=>setSeriesDescInput(e.target.value)} placeholder="What is this series about?" rows={3} className="w-full border-2 border-black p-3"/>
                  <div className="flex flex-col sm:flex-row gap-2"><input value={seriesCoverInput} onChange={e=>setSeriesCoverInput(e.target.value)} placeholder="Cover image URL or upload" className="flex-1 border-2 border-black p-3 font-mono text-xs"/><MediaUploadButton folder="articles" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" label="UPLOAD COVER" compact cropAspect="16:9" cropShape="rect" outputWidth={1600} outputHeight={900} onUploaded={(url)=>setSeriesCoverInput(url)} /></div>
                  <button disabled={seriesBusy} className="border-2 border-black bg-black text-white px-4 py-2 font-mono text-xs font-black uppercase">{seriesBusy?'CREATING…':'CREATE SERIES'}</button>
                </form>
                <div className="space-y-3">{seriesList.map(item=><div key={item.id} className="border-4 border-black bg-white p-4 flex flex-wrap items-center gap-3"><div className="flex-1 min-w-[220px]"><div className="font-mono text-[10px]">{articles.filter(a=>a.seriesId===item.id || a.seriesId===item.slug).length || item.articleCount || 0} PARTS · /series/{item.id}</div><h3 className="font-display font-black text-xl uppercase">{item.title}</h3><p className="text-sm">{item.description}</p></div><button onClick={async()=>{try{await deleteSeries(item.id);setSeriesList(x=>x.filter(y=>y.id!==item.id))}catch(e:any){notifyToast(e?.message||'Could not delete series.')}}} className="border-2 border-black bg-red-100 px-3 py-2 font-mono text-[10px]">DELETE</button></div>)}</div>
              </div>
            )}

            {activeTab === 'carousel' && (
              <div className={`p-6 ${panelScrollClass} space-y-8 bg-neutral-50`}>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="font-display font-black text-2xl uppercase tracking-tight">Featured Carousel Slides</h2>
                    <button
                      onClick={loadCarousel}
                      className="px-3 py-1.5 bg-white border-2 border-black neo-shadow-sm hover:bg-neutral-100 font-mono text-xs font-bold flex items-center space-x-1"
                      title="Reload from Firestore"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCarousel ? 'animate-spin' : ''}`} />
                      <span>SYNC</span>
                    </button>
                  </div>
                  <p className="font-sans text-sm text-neutral-600 mb-4">
                    Manage the auto-sliding promotional banners displayed on the home page. Any edits or deletions reflect directly to the cloud backend and update in real-time.
                  </p>

                  {carouselActionMessage && (
                    <div className="mb-6 p-3 bg-[var(--color-primary)] border-2 border-black neo-shadow-sm font-mono text-xs font-bold flex items-center justify-between animate-fadeIn">
                      <div className="flex items-center space-x-2">
                        <Check className="w-4 h-4 text-black stroke-[3]" />
                        <span>{carouselActionMessage}</span>
                      </div>
                      <button 
                        onClick={() => setCarouselActionMessage(null)}
                        className="p-1 hover:bg-black/10 rounded"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {carouselErrorMessage && (
                    <div className="mb-6 p-3 bg-red-100 border-2 border-red-600 neo-shadow-sm font-mono text-xs font-bold flex items-center justify-between text-red-900 animate-fadeIn">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                        <span>{carouselErrorMessage}</span>
                      </div>
                      <button 
                        onClick={() => setCarouselErrorMessage(null)}
                        className="p-1 hover:bg-red-200 rounded"
                      >
                        <X className="w-3.5 h-3.5 text-red-900" />
                      </button>
                    </div>
                  )}

                  {/* Add New Slide Card */}
                  <div className="bg-white border-2 border-black p-5 shadow-[4px_4px_0_0_#000] mb-8 space-y-4">
                    <div className="flex items-center space-x-2 border-b-2 border-black pb-2">
                      <PlusCircle className="w-4 h-4 text-black" />
                      <h3 className="font-display font-black text-base uppercase">Add New Promotional Slide</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2 space-y-4">
                        <div>
                          <label className="font-mono text-xs font-bold uppercase block mb-1">Canvas Type</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => setNewSlideMode('image')} className={`border-2 border-black px-3 py-2 font-mono text-[10px] font-black uppercase ${newSlideMode === 'image' ? 'bg-[var(--color-primary)]' : 'bg-white'}`}>IMAGE + DESIGN</button>
                            <button type="button" onClick={() => setNewSlideMode('scratch')} className={`border-2 border-black px-3 py-2 font-mono text-[10px] font-black uppercase ${newSlideMode === 'scratch' ? 'bg-[var(--color-primary)]' : 'bg-white'}`}>BUILD FROM SCRATCH</button>
                          </div>
                          <p className="font-mono text-[10px] text-neutral-500 mt-1 uppercase">Use image mode for promos; scratch mode is a blank branded canvas for custom homepage announcements.</p>
                        </div>

                        <div>
                          <label className="font-mono text-xs font-bold uppercase block mb-1">Slide Headline / Title</label>
                          <input 
                            type="text" 
                            value={newSlideTitle}
                            onChange={(e) => setNewSlideTitle(e.target.value)}
                            placeholder="e.g. Distributed Systems Masterclass &amp; Architecture Deep-Dive"
                            className="w-full px-3 py-2 border-2 border-neutral-300 focus:border-black font-sans text-sm"
                          />
                        </div>

                        {newSlideMode === 'image' && <div>
                          <label className="font-mono text-xs font-bold uppercase block mb-1">Slide Image URL</label>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input type="url" value={newSlideImageUrl} onChange={(e) => setNewSlideImageUrl(e.target.value)} placeholder="https://... or upload" className="flex-1 px-3 py-2 border-2 border-neutral-300 focus:border-black font-sans text-sm" /><MediaUploadButton folder="carousel" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" label="UPLOAD IMAGE" compact onUploaded={(url)=>setNewSlideImageUrl(url)} />
                            <MediaUploadButton folder="carousel" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" label="UPLOAD IMAGE" compact cropAspect="16:9" cropShape="rect" outputWidth={1600} outputHeight={900} onUploaded={(url) => setNewSlideImageUrl(url)} />
                          </div>
                        </div>}

                        <div>
                          <label className="font-mono text-xs font-bold uppercase block mb-1">Canvas Background</label>
                          <div className="flex gap-2 items-center">
                            <input type="color" value={newSlideBackgroundColor} onChange={(e) => setNewSlideBackgroundColor(e.target.value)} className="w-12 h-10 border-2 border-black" />
                            <input value={newSlideBackgroundColor} onChange={(e) => setNewSlideBackgroundColor(e.target.value)} className="flex-1 px-3 py-2 border-2 border-black font-mono text-xs uppercase" />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="font-mono text-xs font-bold uppercase">Target Link URL</label>
                            <label className="font-mono text-[10px] font-bold uppercase flex items-center gap-1"><input type="checkbox" checked={newSlideShowDots} onChange={e=>setNewSlideShowDots(e.target.checked)} /> SHOW DOTS</label>
                          </div>
                          <input 
                            type="text" 
                            value={newSlideLinkUrl}
                            onChange={(e) => setNewSlideLinkUrl(e.target.value)}
                            placeholder="https://example.com or internal link"
                            className="w-full px-3 py-2 border-2 border-neutral-300 focus:border-black font-sans text-sm"
                          />
                        </div>
                      </div>

                      {/* Live Thumbnail Preview */}
                      <div className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-300 p-3 bg-neutral-50 min-h-[140px]">
                        <span className="font-mono text-[10px] uppercase font-bold text-neutral-500 mb-2">Live Slide Preview</span>
                        <div className="w-full aspect-[21/9] border-2 border-black overflow-hidden" style={{ backgroundColor: newSlideBackgroundColor }}>
                          {newSlideMode === 'image' && newSlideImageUrl ? <img src={newSlideImageUrl} alt="Slide preview" className="w-full h-full object-cover" /> : <div className="h-full grid place-items-center text-center text-neutral-700/70 font-mono text-xs uppercase px-4">Scratch canvas — use the visual builder below</div>}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t-4 border-black">
                      <CarouselBuilder
                        mode={newSlideMode}
                        imageUrl={newSlideImageUrl}
                        backgroundColor={newSlideBackgroundColor}
                        positionX={newSlidePositionX}
                        positionY={newSlidePositionY}
                        zoom={newSlideZoom}
                        elements={newSlideElements}
                        setPositionX={setNewSlidePositionX}
                        setPositionY={setNewSlidePositionY}
                        setZoom={setNewSlideZoom}
                        setElements={setNewSlideElements}
                      />
                    </div>

                    <button
                      onClick={handleAddSlide}
                      className="px-6 py-2.5 bg-black text-[var(--color-primary)] font-mono text-xs font-bold uppercase border-2 border-black neo-shadow-sm hover:bg-[var(--color-primary)] hover:text-black active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center space-x-2"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Save &amp; Add Slide to Firestore</span>
                    </button>
                  </div>

                  {/* Existing Slides List */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-neutral-500">
                        Active Carousel Slides ({carouselSlides.length})
                      </h3>
                      <span className="font-mono text-[10px] text-neutral-400">
                        Drag or use arrows to reorder
                      </span>
                    </div>

                    {isLoadingCarousel ? (
                      <div className="py-12 flex flex-col items-center justify-center space-y-2">
                        <RefreshCw className="w-8 h-8 animate-spin text-black" />
                        <span className="font-mono text-xs text-neutral-500">Syncing with Firestore...</span>
                      </div>
                    ) : carouselSlides.length === 0 ? (
                      <div className="p-8 border-2 border-dashed border-neutral-300 text-center font-mono text-sm text-neutral-600 bg-white space-y-4">
                        <p>No carousel slides found in Firestore backend.</p>
                        <p className="text-xs text-neutral-400 max-w-md mx-auto">
                          Add a custom slide using the form above, or click below to seed default high-resolution showcase slides into Firestore.
                        </p>
                        <button
                          onClick={handleSeedDefaultSlides}
                          disabled={isLoadingCarousel}
                          className="px-4 py-2 bg-black text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-black border-2 border-black font-mono text-xs font-bold uppercase neo-shadow-sm inline-flex items-center space-x-2 transition-colors cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4" />
                          <span>SEED DEFAULT SHOWCASE SLIDES</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {carouselSlides.map((slide, index) => {
                          const isEditing = editingSlideId === slide.id;

                          if (isEditing) {
                            return (
                              <div 
                                key={slide.id} 
                                className="bg-white border-3 border-black p-5 shadow-[6px_6px_0_0_#000] space-y-4 animate-fadeIn"
                              >
                                <div className="flex items-center justify-between border-b-2 border-black pb-2 bg-neutral-100 -m-5 mb-3 p-3">
                                  <div className="flex items-center space-x-2">
                                    <Edit2 className="w-4 h-4 text-black" />
                                    <span className="font-display font-black text-sm uppercase">Editing Slide #{index + 1}</span>
                                  </div>
                                  <button
                                    onClick={handleCancelEditSlide}
                                    className="p-1 hover:bg-neutral-200 border border-black text-black"
                                    title="Cancel editing"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div className="md:col-span-2 space-y-3">
                                    <div>
                                      <label className="font-mono text-xs font-bold uppercase block mb-1">Canvas Type</label>
                                      <div className="grid grid-cols-2 gap-2">
                                        <button type="button" onClick={() => setEditSlideMode('image')} className={`border-2 border-black px-3 py-2 font-mono text-[10px] font-black uppercase ${editSlideMode === 'image' ? 'bg-[var(--color-primary)]' : 'bg-white'}`}>IMAGE + DESIGN</button>
                                        <button type="button" onClick={() => setEditSlideMode('scratch')} className={`border-2 border-black px-3 py-2 font-mono text-[10px] font-black uppercase ${editSlideMode === 'scratch' ? 'bg-[var(--color-primary)]' : 'bg-white'}`}>BUILD FROM SCRATCH</button>
                                      </div>
                                    </div>
                                    <div>
                                      <label className="font-mono text-xs font-bold uppercase block mb-1">Headline / Title</label>
                                      <input 
                                        type="text" 
                                        value={editSlideTitle}
                                        onChange={(e) => setEditSlideTitle(e.target.value)}
                                        placeholder="Slide title"
                                        className="w-full px-3 py-2 border-2 border-black font-sans text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                      />
                                    </div>

                                    {editSlideMode === 'image' && <div>
                                      <label className="font-mono text-xs font-bold uppercase block mb-1">Image URL</label>
                                      <div className="flex gap-2">
                                        <input type="url" value={editSlideImageUrl} onChange={(e) => setEditSlideImageUrl(e.target.value)} placeholder="https://... or upload" className="flex-1 px-3 py-2 border-2 border-black font-sans text-sm" /><MediaUploadButton folder="carousel" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" label="UPLOAD IMAGE" compact cropAspect="16:9" cropShape="rect" outputWidth={1600} outputHeight={900} onUploaded={(url)=>setEditSlideImageUrl(url)} />
                                      </div>
                                    </div>}
                                    <div>
                                      <label className="font-mono text-xs font-bold uppercase block mb-1">Canvas Background</label>
                                      <div className="flex gap-2 items-center">
                                        <input type="color" value={editSlideBackgroundColor} onChange={(e) => setEditSlideBackgroundColor(e.target.value)} className="w-12 h-10 border-2 border-black" />
                                        <input value={editSlideBackgroundColor} onChange={(e) => setEditSlideBackgroundColor(e.target.value)} className="flex-1 px-3 py-2 border-2 border-black font-mono text-xs uppercase" />
                                      </div>
                                    </div>

                                    <div>
                                            <div className="flex items-center justify-between mb-1">
                                  <label className="font-mono text-xs font-bold uppercase">Target Link URL</label>
                                  <label className="font-mono text-[10px] font-bold uppercase flex items-center gap-1"><input type="checkbox" checked={editSlideShowDots} onChange={e=>setEditSlideShowDots(e.target.checked)} /> SHOW DOTS</label>
                                </div>
                                      <input 
                                        type="text" 
                                        value={editSlideLinkUrl}
                                        onChange={(e) => setEditSlideLinkUrl(e.target.value)}
                                        placeholder="https://..."
                                        className="w-full px-3 py-2 border-2 border-black font-sans text-sm"
                                      />
                                    </div>
                                  </div>

                                  {/* Preview */}
                                  <div className="flex flex-col items-center justify-center border-2 border-black p-2 bg-neutral-100">
                                    <span className="font-mono text-[10px] uppercase font-bold text-neutral-600 mb-2">Updated Preview</span>
                                    <div className="w-full aspect-[21/9] border-2 border-black overflow-hidden" style={{ backgroundColor: editSlideBackgroundColor }}>
                                      {editSlideMode === 'image' && editSlideImageUrl ? <img src={editSlideImageUrl} alt="Edit preview" className="w-full h-full object-cover" style={{ objectPosition: `${editSlidePositionX}% ${editSlidePositionY}%`, transform: `scale(${editSlideZoom / 100})` }} /> : <div className="h-full grid place-items-center text-neutral-600 font-mono text-xs uppercase">Scratch canvas</div>}
                                    </div>
                                  </div>
                                </div>

                                <div className="pt-3 border-t-4 border-black mt-4">
                                  <CarouselBuilder
                                    mode={editSlideMode}
                                    imageUrl={editSlideImageUrl}
                                    backgroundColor={editSlideBackgroundColor}
                                    positionX={editSlidePositionX}
                                    positionY={editSlidePositionY}
                                    zoom={editSlideZoom}
                                    elements={editSlideElements}
                                    setPositionX={setEditSlidePositionX}
                                    setPositionY={setEditSlidePositionY}
                                    setZoom={setEditSlideZoom}
                                    setElements={setEditSlideElements}
                                  />
                                </div>

                                <div className="flex items-center space-x-3 pt-2 border-t-2 border-neutral-200">
                                  <button
                                    onClick={() => handleSaveEditSlide(slide.id)}
                                    disabled={isSavingSlide}
                                    className="px-5 py-2 bg-black text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-black font-mono text-xs font-bold uppercase border-2 border-black neo-shadow-sm active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center space-x-1.5"
                                  >
                                    <Check className="w-4 h-4" />
                                    <span>{isSavingSlide ? 'SAVING TO FIRESTORE...' : 'SAVE CHANGES'}</span>
                                  </button>
                                  <button
                                    onClick={handleCancelEditSlide}
                                    className="px-4 py-2 bg-white text-black hover:bg-neutral-100 font-mono text-xs font-bold uppercase border-2 border-black transition-colors"
                                  >
                                    CANCEL
                                  </button>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div 
                              key={slide.id} 
                              className="flex flex-col sm:flex-row sm:items-center gap-4 bg-white border-2 border-black p-3.5 neo-shadow-sm hover:border-black transition-all"
                            >
                              {/* Order Reordering Controls */}
                              <div className="flex sm:flex-col gap-1 shrink-0">
                                <button 
                                  onClick={() => handleMoveSlide(index, -1)} 
                                  disabled={index === 0} 
                                  className="p-1.5 border border-black hover:bg-neutral-100 disabled:opacity-20 transition-colors"
                                  title="Move Up"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => handleMoveSlide(index, 1)} 
                                  disabled={index === carouselSlides.length - 1} 
                                  className="p-1.5 border border-black hover:bg-neutral-100 disabled:opacity-20 transition-colors"
                                  title="Move Down"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {/* Index Badge & Slide Thumbnail */}
                              <div className="relative shrink-0">
                                <span className="absolute top-1 left-1 bg-black text-white px-1.5 py-0.2 font-mono text-[9px] font-bold border border-black z-10">
                                  #{index + 1}
                                </span>
                                <img 
                                  src={slide.imageUrl} 
                                  alt={slide.title || 'Slide'} 
                                  className="w-32 sm:w-36 h-20 sm:h-20 object-cover border-2 border-black bg-neutral-100" 
                                />
                              </div>

                              {/* Slide Details */}
                              <div className="flex-1 min-w-0">
                                <h4 className="font-display font-black text-base text-black truncate mb-1">
                                  {slide.title || <span className="text-neutral-400 italic">Untitled Slide</span>}
                                </h4>
                                {slide.linkUrl ? (
                                  <a 
                                    href={slide.linkUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="font-mono text-xs text-neutral-600 hover:text-black flex items-center space-x-1 truncate underline"
                                  >
                                    <span className="truncate">{slide.linkUrl}</span>
                                    <ExternalLink className="w-3 h-3 shrink-0" />
                                  </a>
                                ) : (
                                  <span className="font-mono text-xs text-neutral-400">No destination link</span>
                                )}
                              </div>

                              {/* Action Buttons: EDIT & DELETE */}
                              <div className="flex items-center space-x-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0">
                                <button 
                                  onClick={() => handleStartEditSlide(slide)} 
                                  className="px-3 py-1.5 bg-white hover:bg-[var(--color-primary)] text-black border-2 border-black neo-shadow-sm font-mono text-xs font-bold uppercase flex items-center space-x-1.5 active:translate-x-0.5 active:translate-y-0.5 transition-all"
                                  title="Edit slide contents"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                  <span>EDIT</span>
                                </button>

                                {deletingSlideId === slide.id ? (
                                  <div className="flex items-center space-x-1.5 bg-red-100 border-2 border-red-600 p-1.5 animate-fadeIn">
                                    <span className="font-mono text-[10px] font-bold text-red-900 hidden lg:inline">Confirm?</span>
                                    <button 
                                      onClick={() => executeDeleteSlide(slide.id)} 
                                      disabled={isDeletingSlide}
                                      className="px-2.5 py-1 bg-red-600 hover:bg-black text-white border border-black font-mono text-xs font-bold uppercase flex items-center space-x-1 transition-colors cursor-pointer"
                                      title="Permanently remove from Firestore backend"
                                    >
                                      <Trash2 className={`w-3 h-3 ${isDeletingSlide ? 'animate-spin' : ''}`} />
                                      <span>{isDeletingSlide ? 'DELETING...' : 'YES, DELETE'}</span>
                                    </button>
                                    <button 
                                      onClick={() => setDeletingSlideId(null)} 
                                      disabled={isDeletingSlide}
                                      className="px-2 py-1 bg-white hover:bg-neutral-100 text-black border border-black font-mono text-xs font-bold uppercase transition-colors cursor-pointer"
                                    >
                                      CANCEL
                                    </button>
                                  </div>
                                ) : (
                                  <button 
                                    onClick={() => {
                                      setDeletingSlideId(slide.id);
                                      setCarouselErrorMessage(null);
                                    }} 
                                    className="px-3 py-1.5 bg-white hover:bg-red-600 text-black hover:text-white border-2 border-black neo-shadow-sm font-mono text-xs font-bold uppercase flex items-center space-x-1.5 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                                    title="Delete slide from Firestore"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>DELETE</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {revisionArticle && (
          <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true">
            <div className="w-full max-w-5xl max-h-[92vh] bg-white border-4 border-black neo-shadow-lg flex flex-col">
              <div className="bg-[var(--color-primary)] border-b-4 border-black p-4 sm:p-5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-mono text-[9px] font-black uppercase">CLOUD VERSION HISTORY</div>
                  <h2 className="font-display font-black text-2xl sm:text-3xl uppercase truncate">{revisionArticle.title}</h2>
                  <div className="font-mono text-[9px] uppercase mt-1">/{revisionArticle.slug} · {revisions.length} stored revisions</div>
                </div>
                <button onClick={()=>{setRevisionArticle(null);setRevisions([]);setSelectedRevisionIds([]);}} className="shrink-0 border-2 border-black bg-white p-2 hover:bg-black hover:text-white" aria-label="Close history"><X className="w-5 h-5"/></button>
              </div>
              {revisionActionMessage && <div className="mx-4 mt-4 border-2 border-black bg-[var(--color-success)] p-3 font-mono text-[9px] font-black uppercase flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/>{revisionActionMessage}</div>}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
                {revisionBusy ? <div className="py-20 text-center font-mono text-xs uppercase"><RefreshCw className="w-7 h-7 mx-auto animate-spin mb-3"/>Loading revisions from Firestore...</div> : !revisions.length ? <div className="border-4 border-dashed border-black p-12 text-center"><Clock3 className="w-10 h-10 mx-auto mb-3"/><div className="font-display font-black text-2xl uppercase">NO VERSION HISTORY</div><p className="font-mono text-[9px] text-neutral-500 mt-2 uppercase">Every future article edit will create a cloud snapshot automatically.</p></div> : <>
                  <div className="border-2 border-black bg-neutral-50 p-3 font-mono text-[9px] uppercase">Select up to two revisions to compare. RESTORE creates a safety snapshot before replacing the live article.</div>
                  <div className="space-y-2">
                    {revisions.map((r:any)=><div key={r.id} className={`border-2 border-black p-3 ${selectedRevisionIds.includes(r.id)?'bg-[var(--color-secondary)]':''}`}>
                      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                        <button type="button" onClick={()=>toggleRevisionSelection(r.id)} className={`w-5 h-5 border-2 border-black shrink-0 ${selectedRevisionIds.includes(r.id)?'bg-black':'bg-white'}`} aria-label="Select revision"/>
                        <div className="flex-1 min-w-0"><div className="font-mono text-[10px] font-black uppercase flex flex-wrap items-center gap-2"><span>{revisionTimestamp(r)}</span><span className="bg-black text-white px-1.5 py-0.5">{revisionActionLabel(r.action)}</span></div><div className="font-mono text-[9px] text-neutral-500 mt-1 uppercase">{r.createdByName || r.createdByEmail || r.createdBy || 'STAFF'} · {r.id}</div><div className="font-display font-black text-sm uppercase mt-1 truncate">{r.title || r.article?.title || revisionArticle.title}</div></div>
                        <div className="flex flex-wrap gap-2 shrink-0">
                          <button type="button" onClick={()=>toggleRevisionSelection(r.id)} className="border-2 border-black bg-white px-2.5 py-1.5 font-mono text-[9px] font-black uppercase"><GitCompare className="w-3 h-3 inline mr-1"/>{selectedRevisionIds.includes(r.id)?'SELECTED':'COMPARE'}</button>
                          <button type="button" disabled={revisionBusy} onClick={()=>void restoreRevision(r.id)} className="border-2 border-black bg-[var(--color-primary)] px-2.5 py-1.5 font-mono text-[9px] font-black uppercase disabled:opacity-40"><History className="w-3 h-3 inline mr-1"/>RESTORE</button>
                          <button type="button" disabled={revisionBusy} onClick={()=>void duplicateRevision(r.id)} className="border-2 border-black bg-white px-2.5 py-1.5 font-mono text-[9px] font-black uppercase disabled:opacity-40"><Copy className="w-3 h-3 inline mr-1"/>DUPLICATE</button>
                        </div>
                      </div>
                    </div>)}
                  </div>
                  {selectedRevisionIds.length===2 && <div className="border-4 border-black bg-white p-4 space-y-4"><div className="flex items-center justify-between gap-2"><div><div className="font-mono text-[9px] uppercase">COMPARE</div><h3 className="font-display font-black text-xl uppercase">Field Changes</h3></div><button onClick={()=>setSelectedRevisionIds([])} className="border-2 border-black bg-white px-2 py-1 font-mono text-[9px] font-black uppercase">CLEAR</button></div>{compareRevisionRows.length ? <div className="space-y-2">{compareRevisionRows.map((row:any)=><div key={row.label} className="grid lg:grid-cols-[130px_1fr_1fr] border-2 border-black"><div className="bg-black text-white p-2 font-mono text-[9px] font-black">{row.label}</div><pre className="p-2 text-[9px] whitespace-pre-wrap break-words overflow-x-auto border-t lg:border-t-0 lg:border-l-2 border-black">{row.a}</pre><pre className="p-2 text-[9px] whitespace-pre-wrap break-words overflow-x-auto border-t-2 lg:border-t-0 lg:border-l-2 border-black">{row.b}</pre></div>)}</div> : <div className="font-mono text-xs">NO FIELD CHANGES DETECTED.</div>}</div>}
                </>}
              </div>
              <div className="border-t-4 border-black bg-neutral-100 p-3 flex justify-between items-center"><span className="font-mono text-[9px] uppercase">Firestore-backed • Admin-only</span><button onClick={()=>{setRevisionArticle(null);setRevisions([]);setSelectedRevisionIds([]);}} className="border-2 border-black bg-white px-3 py-2 font-mono text-[9px] font-black uppercase">CLOSE</button></div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-neutral-100 border-t-4 border-black flex items-center justify-between text-xs font-mono text-neutral-600">
          <span>{brandName} CLOUD CMS &bull; FIRESTORE ENGINE</span>
          <button
            onClick={onClose}
            className="font-bold text-black hover:underline uppercase"
          >
            CLOSE
          </button>
        </div>

      </div>
    </div>
  );
};
