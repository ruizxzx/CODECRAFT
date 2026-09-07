import React, { useState, useEffect, useRef } from 'react';
import { Article, Category, SiteConfig, BentoLink, CarouselSlide } from '../types';
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
  Upload, 
  Database,
  Lock,
  ExternalLink,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { loginWithGoogle, auth, logout, checkIsAdmin, ADMIN_EMAILS } from '../lib/firebase';
import { 
  saveArticle, 
  deleteArticle, 
  saveSiteConfig, 
  saveBentoLinks, 
  uploadImageToStorage,
  setArticleFeaturedStatus,
  syncAuthorToAllCloudArticles
} from '../lib/cms';
import { 
  getCarouselSlides, 
  addCarouselSlide, 
  updateCarouselSlide, 
  deleteCarouselSlide 
} from '../lib/community';

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
  onUpdateBentoLinks
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && checkIsAdmin(user.email)) {
        setIsAuthenticated(true);
        setCurrentUserEmail(user.email || null);
      } else {
        setIsAuthenticated(false);
        setCurrentUserEmail(user?.email || null);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setLoginError(null);
    try {
      setIsLoggingIn(true);
      const user = await loginWithGoogle();
      if (user && checkIsAdmin(user.email)) {
        setIsAuthenticated(true);
        setCurrentUserEmail(user.email || null);
      } else {
        setLoginError(`Access Denied: ${user?.email || 'Your account'} is not an authorized administrator. Authorized accounts: ${ADMIN_EMAILS.join(', ')}`);
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

  const [activeTab, setActiveTab] = useState<'settings' | 'create' | 'manage' | 'links' | 'carousel'>('settings');

  // Carousel State
  const [carouselSlides, setCarouselSlides] = useState<CarouselSlide[]>([]);
  const [isLoadingCarousel, setIsLoadingCarousel] = useState(false);
  const [newSlideTitle, setNewSlideTitle] = useState('');
  const [newSlideImageUrl, setNewSlideImageUrl] = useState('');
  const [newSlideLinkUrl, setNewSlideLinkUrl] = useState('');
  const [isUploadingSlideImage, setIsUploadingSlideImage] = useState(false);

  // Carousel Editing State
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null);
  const [editSlideTitle, setEditSlideTitle] = useState('');
  const [editSlideImageUrl, setEditSlideImageUrl] = useState('');
  const [editSlideLinkUrl, setEditSlideLinkUrl] = useState('');
  const [isUploadingEditSlideImage, setIsUploadingEditSlideImage] = useState(false);
  const [isSavingSlide, setIsSavingSlide] = useState(false);

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
    if (!newSlideImageUrl.trim()) {
      setCarouselErrorMessage("Please provide an image URL or upload an image first.");
      return;
    }
    setCarouselErrorMessage(null);
    try {
      const added = await addCarouselSlide({
        title: newSlideTitle.trim(),
        imageUrl: newSlideImageUrl.trim(),
        linkUrl: newSlideLinkUrl.trim(),
        order: carouselSlides.length
      });
      setCarouselSlides(prev => [...prev, added]);
      setNewSlideTitle('');
      setNewSlideImageUrl('');
      setNewSlideLinkUrl('');
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
    setEditSlideImageUrl(slide.imageUrl || '');
    setEditSlideLinkUrl(slide.linkUrl || '');
    setCarouselActionMessage(null);
    setCarouselErrorMessage(null);
  };

  const handleCancelEditSlide = () => {
    setEditingSlideId(null);
    setEditSlideTitle('');
    setEditSlideImageUrl('');
    setEditSlideLinkUrl('');
  };

  const handleSaveEditSlide = async (id: string) => {
    if (!editSlideImageUrl.trim()) {
      setCarouselErrorMessage("Slide image URL cannot be empty.");
      return;
    }
    setCarouselErrorMessage(null);
    setIsSavingSlide(true);
    try {
      await updateCarouselSlide(id, {
        title: editSlideTitle.trim(),
        imageUrl: editSlideImageUrl.trim(),
        linkUrl: editSlideLinkUrl.trim()
      });
      setCarouselSlides(prev => prev.map(s => s.id === id ? {
        ...s,
        title: editSlideTitle.trim(),
        imageUrl: editSlideImageUrl.trim(),
        linkUrl: editSlideLinkUrl.trim()
      } : s));
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

  const handleEditSlideUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingEditSlideImage(true);
    setCarouselErrorMessage(null);
    try {
      const url = await uploadImageToStorage(file, 'carousel');
      setEditSlideImageUrl(url);
    } catch (err: any) {
      console.error("Slide edit upload failed:", err);
      setCarouselErrorMessage("Failed to upload slide image: " + (err.message || "Upload error"));
    } finally {
      setIsUploadingEditSlideImage(false);
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
  const [logoPart1, setLogoPart1] = useState(siteConfig.logoPart1 || 'KRISH');
  const [logoPart2, setLogoPart2] = useState(siteConfig.logoPart2 || 'FICIENT');
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
  
  const [contactTitle, setContactTitle] = useState(siteConfig.contactTitle || '');
  const [contactSubtitle, setContactSubtitle] = useState(siteConfig.contactSubtitle || '');
  const [contactEmail, setContactEmail] = useState(siteConfig.contactEmail || '');
  const [contactTwitter, setContactTwitter] = useState(siteConfig.contactTwitter || '');
  const [contactGithub, setContactGithub] = useState(siteConfig.contactGithub || '');
  const [contactTelegram, setContactTelegram] = useState(siteConfig.contactTelegram || '');

  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configSuccess, setConfigSuccess] = useState(false);

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
    setContactTitle(siteConfig.contactTitle || '');
    setContactSubtitle(siteConfig.contactSubtitle || '');
    setContactEmail(siteConfig.contactEmail || '');
    setContactTwitter(siteConfig.contactTwitter || '');
    setContactGithub(siteConfig.contactGithub || '');
    setContactTelegram(siteConfig.contactTelegram || '');
  }, [siteConfig]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    try {
      const updated: SiteConfig = {
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
        contactTitle,
        contactSubtitle,
        contactEmail,
        contactTwitter,
        contactGithub,
        contactTelegram
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
            bio: manifestoText || aboutMeBio
          });
        } catch (syncErr) {
          console.warn("Auto-sync author to articles encountered an issue:", syncErr);
        }
      }

      setConfigSuccess(true);
      setTimeout(() => setConfigSuccess(false), 2000);
    } catch (err: any) {
      console.error("Failed to save site config to Firestore:", err);
      alert("Failed to save config: " + (err.message || 'Permission denied'));
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
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  // Author avatar upload & cloud sync state
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSyncingAuthor, setIsSyncingAuthor] = useState(false);
  const [syncAuthorSuccess, setSyncAuthorSuccess] = useState<string | null>(null);
  const [togglingFeaturedSlug, setTogglingFeaturedSlug] = useState<string | null>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAvatar(true);
    try {
      const url = await uploadImageToStorage(file, 'avatars');
      setAuthorAvatarUrl(url);
    } catch (err: any) {
      console.error("Failed to upload avatar image:", err);
      alert("Avatar upload failed: " + (err.message || 'Permission denied'));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSyncAuthorToArticles = async () => {
    if (!confirm(`Do you want to sync the author profile (Name: "${authorName}", Role: "${authorRole}") to ALL articles stored in Firestore cloud database?`)) return;
    setIsSyncingAuthor(true);
    setSyncAuthorSuccess(null);
    try {
      const count = await syncAuthorToAllCloudArticles({
        name: authorName,
        role: authorRole,
        avatar: authorAvatarUrl,
        bio: manifestoText || aboutMeBio
      });
      setSyncAuthorSuccess(`Synced author details to ${count} articles in Firestore!`);
      setTimeout(() => setSyncAuthorSuccess(null), 4000);
    } catch (err: any) {
      console.error("Failed to sync author to articles:", err);
      alert("Sync failed: " + (err.message || 'Permission denied'));
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
      alert("Failed to update featured status: " + (err.message || 'Permission denied'));
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
    } catch (err: any) {
      console.error("Failed to save bento link:", err);
      alert("Failed to save link: " + (err.message || "Permission denied"));
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
      alert("Failed to delete link: " + (err.message || "Permission denied"));
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

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newExcerpt.trim()) return;

    setIsPublishing(true);
    setPublishError(null);

    try {
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
        readingTimeMinutes: Number(newReadingTime) || 5,
        coverImage: newCoverImage.trim() || 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1200&auto=format&fit=crop',
        coverImageAlt: newCoverAlt || newTitle,
        coverImageCaption: newCoverCaption,
        featured: newIsFeatured || newIsPinned,
        pinned: newIsPinned || newIsFeatured,
        trending: true,
        viewsCount: 1,
        clapsCount: 0,
        author: {
          name: authorName || siteConfig.authorName || 'Krish',
          role: authorRole || siteConfig.authorRole || 'Founder & Systems Architect',
          avatar: authorAvatarUrl || siteConfig.authorAvatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop',
          bio: manifestoText || aboutMeBio || siteConfig.manifestoText || 'Writing about distributed systems, modern web runtimes, and engineering craft.'
        },
        content: [
          {
            type: 'paragraph',
            content: newParagraph1 || newExcerpt
          },
          ...(newCodeSnippet ? [{
            type: 'code' as const,
            codeBlock: {
              language: newCodeLanguage,
              filename: `solution.${newCodeLanguage === 'typescript' ? 'ts' : newCodeLanguage === 'python' ? 'py' : 'txt'}`,
              code: newCodeSnippet
            }
          }] : []),
          ...(newTakeaway ? [{
            type: 'takeaways' as const,
            items: [newTakeaway]
          }] : [])
        ]
      };

      await saveArticle(article);
      onArticlePublished(article);
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
    
    const p1 = article.content?.find(c => c.type === 'paragraph');
    const code = article.content?.find(c => c.type === 'code');
    const takeaways = article.content?.find(c => c.type === 'takeaways');

    setNewParagraph1(p1?.content || '');
    setNewCodeSnippet(code?.codeBlock?.code || '');
    setNewCodeLanguage(code?.codeBlock?.language || 'typescript');
    setNewTakeaway(takeaways?.items?.[0] || '');
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
      alert("Failed to delete article from Firestore: " + (err.message || "Permission denied"));
    }
  };

  const resetForm = () => {
    setEditingArticleId(null);
    setEditingArticleSlug(null);
    setEditingPublishedAt(null);
    setNewTitle('');
    setNewCategory('Web Development');
    setNewTags('');
    setNewExcerpt('');
    setNewParagraph1('');
    setNewCodeSnippet('');
    setNewTakeaway('');
    setNewIsFeatured(false);
    setNewIsPinned(false);
    setNewCoverImage('https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1200&auto=format&fit=crop');
    setPublishError(null);
  };

  // Image Upload Handlers
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingCover(true);
    try {
      const url = await uploadImageToStorage(file, 'covers');
      setNewCoverImage(url);
    } catch (err: any) {
      console.error("Cover upload failed:", err);
      alert("Failed to upload image to Firebase Storage: " + (err.message || "Error"));
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleSlideUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingSlideImage(true);
    try {
      const url = await uploadImageToStorage(file, 'carousel');
      setNewSlideImageUrl(url);
    } catch (err: any) {
      console.error("Slide upload failed:", err);
      alert("Failed to upload slide image: " + (err.message || "Error"));
    } finally {
      setIsUploadingSlideImage(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="w-full bg-neutral-100 min-h-[calc(100vh-64px)] py-8 sm:py-12 px-4 sm:px-6 lg:px-8 flex justify-center items-start">
      <div className="w-full max-w-5xl bg-white border-4 border-black neo-shadow-lg overflow-hidden my-4 sm:my-8">
        
        {/* Modal Header */}
        <div className="bg-[var(--color-secondary)] px-4 sm:px-6 py-4 border-b-4 border-black flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Database className="w-6 h-6 text-black stroke-[2.5]" />
            <div>
              <h2 className="font-display font-black text-xl text-black uppercase tracking-tight">
                KRISHFICIENT CMS STUDIO
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
              ADMINISTRATOR VERIFICATION REQUIRED
            </h3>
            <p className="font-sans text-sm text-neutral-600 max-w-md">
              Sign in with an authorized administrator Google account to access the KRISHFICIENT Editorial Studio and persist global content.
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
              <span>{isLoggingIn ? 'AUTHENTICATING...' : 'SIGN IN WITH AUTHORIZED GOOGLE ACCOUNT'}</span>
            </button>
          </div>
        ) : (
          <div className="bg-white min-h-[600px] flex flex-col">

            {/* Tab Selector (5 Clean Modules) */}
            <div className="grid grid-cols-5 border-b-4 border-black font-display font-black text-[10px] sm:text-xs uppercase bg-white overflow-x-auto whitespace-nowrap">
              <button
                onClick={() => setActiveTab('settings')}
                className={`py-3 px-2 flex flex-col items-center justify-center space-y-1 sm:flex-row sm:space-y-0 sm:space-x-1.5 transition-colors ${
                  activeTab === 'settings' ? 'bg-[var(--color-primary)] text-black border-r-2 border-black' : 'hover:bg-neutral-100 border-r-2 border-black'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">SETTINGS</span>
              </button>
              
              <button
                onClick={() => setActiveTab('create')}
                className={`py-3 px-2 flex flex-col items-center justify-center space-y-1 sm:flex-row sm:space-y-0 sm:space-x-1.5 transition-colors ${
                  activeTab === 'create' ? 'bg-[var(--color-primary)] text-black border-r-2 border-black' : 'hover:bg-neutral-100 border-r-2 border-black'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                <span className="hidden sm:inline">{editingArticleSlug ? 'EDIT ARTICLE' : 'WRITE ARTICLE'}</span>
              </button>

              <button
                onClick={() => setActiveTab('manage')}
                className={`py-3 px-2 flex flex-col items-center justify-center space-y-1 sm:flex-row sm:space-y-0 sm:space-x-1.5 transition-colors ${
                  activeTab === 'manage' ? 'bg-[var(--color-primary)] text-black border-r-2 border-black' : 'hover:bg-neutral-100 border-r-2 border-black'
                }`}
              >
                <Edit2 className="w-4 h-4" />
                <span className="hidden sm:inline">MANAGE ({articles.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('links')}
                className={`py-3 px-2 flex flex-col items-center justify-center space-y-1 sm:flex-row sm:space-y-0 sm:space-x-1.5 transition-colors ${
                  activeTab === 'links' ? 'bg-[var(--color-primary)] text-black border-r-2 border-black' : 'hover:bg-neutral-100 border-r-2 border-black'
                }`}
              >
                <LinkIcon className="w-4 h-4" />
                <span className="hidden sm:inline">BENTO LINKS</span>
              </button>
              
              <button
                onClick={() => setActiveTab('carousel')}
                className={`py-3 px-2 flex flex-col items-center justify-center space-y-1 sm:flex-row sm:space-y-0 sm:space-x-1.5 transition-colors ${
                  activeTab === 'carousel' ? 'bg-[var(--color-primary)] text-black' : 'hover:bg-neutral-100'
                }`}
              >
                <Layout className="w-4 h-4" />
                <span className="hidden sm:inline">CAROUSEL</span>
              </button>
            </div>

            {/* TAB: SETTINGS */}
            {activeTab === 'settings' && (
              <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
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
                    <div className="space-y-1">
                      <label className="font-mono text-xs font-bold uppercase text-black">Logo Image URL (Optional)</label>
                      <input 
                        type="text" 
                        value={logoImageUrl} 
                        onChange={(e) => setLogoImageUrl(e.target.value)} 
                        className="w-full px-3 py-2 border-2 border-black font-mono text-xs focus:outline-none" 
                        placeholder="https://..." 
                      />
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

                    {/* Avatar Preview and URL / Upload */}
                    <div className="space-y-2">
                      <label className="font-mono text-xs font-bold uppercase text-black">Author Picture (Avatar)</label>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <img 
                          src={authorAvatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop'} 
                          alt="Author Preview" 
                          className="w-16 h-16 border-2 border-black object-cover bg-white shrink-0 neo-shadow-sm"
                        />
                        <div className="flex-1 w-full space-y-1.5">
                          <input 
                            type="text" 
                            value={authorAvatarUrl} 
                            onChange={(e) => setAuthorAvatarUrl(e.target.value)} 
                            className="w-full px-3 py-2 border-2 border-black font-mono text-xs focus:outline-none bg-white" 
                            placeholder="https://images.unsplash.com/..."
                          />
                          <div className="flex items-center gap-2">
                            <label className="cursor-pointer inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border-2 border-black font-display font-black text-xs uppercase hover:bg-neutral-100 active:translate-x-0.5 active:translate-y-0.5 transition-all">
                              <Upload className="w-3.5 h-3.5" />
                              <span>{isUploadingAvatar ? 'UPLOADING...' : 'UPLOAD PICTURE'}</span>
                              <input 
                                type="file" 
                                accept="image/*" 
                                onChange={handleAvatarUpload} 
                                disabled={isUploadingAvatar}
                                className="hidden" 
                              />
                            </label>
                            <span className="font-mono text-[10px] text-neutral-500">JPG, PNG, WebP</span>
                          </div>
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
              <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
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
                          onChange={(e) => setNewCategory(e.target.value as Category)}
                          className="w-full px-3.5 py-2.5 border-2 border-black font-sans font-bold text-sm bg-white"
                        >
                          <option value="Web Development">Web Development</option>
                          <option value="Artificial Intelligence">Artificial Intelligence</option>
                          <option value="Software Engineering">Software Engineering</option>
                          <option value="Computer Science">Computer Science</option>
                          <option value="Developer Tools">Developer Tools</option>
                          <option value="System Design">System Design</option>
                        </select>
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

                    {/* Cover Image Input with Storage Upload Option */}
                    <div className="space-y-2 border-2 border-black p-3 bg-neutral-50">
                      <label className="font-mono text-xs font-bold uppercase text-black block">
                        Cover Image
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={newCoverImage}
                          onChange={(e) => setNewCoverImage(e.target.value)}
                          placeholder="https://images.unsplash.com/..."
                          className="flex-1 px-3 py-2 border-2 border-black font-mono text-xs bg-white"
                        />
                        <label className="cursor-pointer px-4 py-2 bg-black text-white font-mono text-xs font-bold uppercase hover:bg-[var(--color-primary)] hover:text-black transition-colors flex items-center space-x-1">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{isUploadingCover ? 'UPLOADING...' : 'UPLOAD'}</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleCoverUpload} 
                            className="hidden" 
                            disabled={isUploadingCover}
                          />
                        </label>
                      </div>

                      {newCoverImage && (
                        <div className="mt-2">
                          <img 
                            src={newCoverImage} 
                            alt="Cover preview" 
                            className="w-full h-36 object-cover border-2 border-black" 
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="font-mono text-xs font-bold uppercase text-black">
                        Article Body (Paragraph 1)
                      </label>
                      <textarea
                        rows={6}
                        value={newParagraph1}
                        onChange={(e) => setNewParagraph1(e.target.value)}
                        placeholder="Detailed technical essay content..."
                        className="w-full px-3.5 py-2.5 border-2 border-black font-serif text-sm bg-white"
                      />
                    </div>

                    <div className="space-y-2 border-2 border-black p-3 bg-neutral-50">
                      <div className="flex items-center justify-between">
                        <label className="font-mono text-xs font-bold uppercase text-black">
                          Optional Code Snippet Block
                        </label>
                        <select
                          value={newCodeLanguage}
                          onChange={(e) => setNewCodeLanguage(e.target.value)}
                          className="px-2 py-1 border border-black font-mono text-xs bg-white"
                        >
                          <option value="typescript">TypeScript</option>
                          <option value="javascript">JavaScript</option>
                          <option value="rust">Rust</option>
                          <option value="go">Go</option>
                          <option value="python">Python</option>
                          <option value="json">JSON</option>
                        </select>
                      </div>
                      <textarea
                        rows={4}
                        value={newCodeSnippet}
                        onChange={(e) => setNewCodeSnippet(e.target.value)}
                        placeholder="// Enter code here..."
                        className="w-full px-3 py-2 border-2 border-black font-mono text-xs bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-mono text-xs font-bold uppercase text-black">
                        Key Engineering Takeaway
                      </label>
                      <input
                        type="text"
                        value={newTakeaway}
                        onChange={(e) => setNewTakeaway(e.target.value)}
                        placeholder="e.g. Decouple bundle generation from runtime execution to achieve zero cold starts."
                        className="w-full px-3.5 py-2.5 border-2 border-black font-sans text-sm bg-white"
                      />
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
              <div className="p-6 max-h-[70vh] overflow-y-auto space-y-4">
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
                          <span className="font-mono text-[10px] text-neutral-500">
                            {art.publishedAt}
                          </span>
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
              <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
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
                        <div className="w-4 h-4 rounded-full border border-black flex-shrink-0" style={{ backgroundColor: link.color }} />
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

            {/* TAB: CAROUSEL */}
            {activeTab === 'carousel' && (
              <div className="p-6 max-h-[70vh] overflow-y-auto space-y-8 bg-neutral-50">
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
                          <label className="font-mono text-xs font-bold uppercase block mb-1">Slide Headline / Title</label>
                          <input 
                            type="text" 
                            value={newSlideTitle}
                            onChange={(e) => setNewSlideTitle(e.target.value)}
                            placeholder="e.g. Distributed Systems Masterclass &amp; Architecture Deep-Dive"
                            className="w-full px-3 py-2 border-2 border-neutral-300 focus:border-black font-sans text-sm"
                          />
                        </div>

                        <div>
                          <label className="font-mono text-xs font-bold uppercase block mb-1">Slide Image (Upload or Direct URL)</label>
                          <div className="flex gap-2">
                            <input 
                              type="url" 
                              value={newSlideImageUrl}
                              onChange={(e) => setNewSlideImageUrl(e.target.value)}
                              placeholder="https://images.unsplash.com/... or upload"
                              className="flex-1 px-3 py-2 border-2 border-neutral-300 focus:border-black font-sans text-sm"
                            />
                            <label className="cursor-pointer px-4 py-2 bg-black text-white font-mono text-xs font-bold uppercase hover:bg-[var(--color-primary)] hover:text-black transition-colors flex items-center space-x-1.5 shrink-0">
                              <Upload className="w-3.5 h-3.5" />
                              <span>{isUploadingSlideImage ? 'UPLOADING...' : 'UPLOAD FILE'}</span>
                              <input 
                                type="file" 
                                accept="image/*" 
                                onChange={handleSlideUpload} 
                                className="hidden" 
                                disabled={isUploadingSlideImage}
                              />
                            </label>
                          </div>
                        </div>

                        <div>
                          <label className="font-mono text-xs font-bold uppercase block mb-1">Target Link URL</label>
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
                        {newSlideImageUrl ? (
                          <img 
                            src={newSlideImageUrl} 
                            alt="Slide preview" 
                            className="w-full aspect-[21/9] object-cover border-2 border-black bg-neutral-200" 
                          />
                        ) : (
                          <div className="text-center text-neutral-400 font-mono text-xs">
                            No image selected yet
                          </div>
                        )}
                      </div>
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
                                      <label className="font-mono text-xs font-bold uppercase block mb-1">Headline / Title</label>
                                      <input 
                                        type="text" 
                                        value={editSlideTitle}
                                        onChange={(e) => setEditSlideTitle(e.target.value)}
                                        placeholder="Slide title"
                                        className="w-full px-3 py-2 border-2 border-black font-sans text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                      />
                                    </div>

                                    <div>
                                      <label className="font-mono text-xs font-bold uppercase block mb-1">Image URL / Upload</label>
                                      <div className="flex gap-2">
                                        <input 
                                          type="url" 
                                          value={editSlideImageUrl}
                                          onChange={(e) => setEditSlideImageUrl(e.target.value)}
                                          placeholder="https://..."
                                          className="flex-1 px-3 py-2 border-2 border-black font-sans text-sm"
                                        />
                                        <label className="cursor-pointer px-3 py-2 bg-black text-white font-mono text-xs font-bold uppercase hover:bg-[var(--color-primary)] hover:text-black transition-colors flex items-center space-x-1 shrink-0">
                                          <Upload className="w-3.5 h-3.5" />
                                          <span>{isUploadingEditSlideImage ? 'UPLOADING...' : 'REPLACE FILE'}</span>
                                          <input 
                                            type="file" 
                                            accept="image/*" 
                                            onChange={handleEditSlideUpload} 
                                            className="hidden" 
                                            disabled={isUploadingEditSlideImage}
                                          />
                                        </label>
                                      </div>
                                    </div>

                                    <div>
                                      <label className="font-mono text-xs font-bold uppercase block mb-1">Target Link URL</label>
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
                                    {editSlideImageUrl ? (
                                      <img 
                                        src={editSlideImageUrl} 
                                        alt="Edit preview" 
                                        className="w-full aspect-[21/9] object-cover border-2 border-black bg-white" 
                                      />
                                    ) : (
                                      <div className="text-neutral-400 font-mono text-xs">No image</div>
                                    )}
                                  </div>
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

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-neutral-100 border-t-4 border-black flex items-center justify-between text-xs font-mono text-neutral-600">
          <span>KRISHFICIENT CLOUD CMS &bull; FIRESTORE ENGINE</span>
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
