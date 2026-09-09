export type Category = string;

export interface CodeSnippet {
  language: string;
  code: string;
  filename?: string;
}

export interface ArticleContentBlock {
  type: 'paragraph' | 'heading2' | 'heading3' | 'callout' | 'quote' | 'code' | 'image' | 'video' | 'list' | 'takeaways' | 'link' | 'button';
  content?: string;
  items?: string[];
  calloutType?: 'info' | 'warning' | 'tip' | 'insight';
  calloutTitle?: string;
  codeBlock?: CodeSnippet;
  imageUrl?: string;
  imageAlt?: string;
  imageCaption?: string;
  imageHref?: string;
  videoUrl?: string;
  videoTitle?: string;
  videoCaption?: string;
  linkText?: string;
  href?: string;
  buttonText?: string;
  buttonStyle?: 'primary' | 'secondary' | 'dark';
  quoteAuthor?: string;
}


export interface Series {
  id: string;
  slug: string;
  title: string;
  description: string;
  coverImage?: string;
  ownerId: string;
  ownerUsername?: string;
  ownerName?: string;
  tags?: string[];
  articleCount: number;
  estimatedMinutes?: number;
  status?: 'draft' | 'published' | 'archived';
  visibility?: 'public' | 'unlisted' | 'private';
  accentColor?: string;
  coverImageAlt?: string;
  viewsCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatorPageConfig {
  tagline?: string;
  heroTitle?: string;
  heroText?: string;
  layout?: 'grid' | 'list' | 'magazine';
  themeColor?: string;
  coverImageUrl?: string;
  aboutTitle?: string;
  featuredArticleSlugs?: string[];
  featuredSeriesIds?: string[];
  featuredPostIds?: string[];
  customLinks?: Array<{ id: string; label: string; url: string }>;
  showStats?: boolean;
  showSocialLinks?: boolean;
  showAbout?: boolean;
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string;
  coverImageAlt: string;
  coverImageCaption?: string;
  category: Category;
  tags: string[];
  publishedAt: string;
  readingTimeMinutes: number;
  featured?: boolean;
  pinned?: boolean;
  trending?: boolean;
  collaborators?: Array<{ uid?: string; username?: string; name?: string; role?: string }>;
  seriesId?: string;
  seriesName?: string;
  seriesOrder?: number;
  reactionCounts?: Record<string, number>;
  viewsCount?: number;
  republishedBy?: { uid?: string; username?: string; name?: string; avatar?: string };
  originalAuthor?: { uid?: string; username?: string; name?: string; avatar?: string; bio?: string; role?: string; isVerified?: boolean; verificationColor?: string };
  sourcePostId?: string;
  origin?: 'admin' | 'community_blog' | 'community_post';
  promotedToArticleSlug?: string;
  isPublished?: boolean;
  mainPublicationStatus?: 'published' | 'unpublished';
  promotedAt?: string;
  editedAt?: string;
  editReviewStatus?: 'pending' | 'approved';
  editReviewRequestedAt?: string;
  editReviewedAt?: string;
  editReviewedBy?: string;
  promotedBy?: string;
  author: {
    name: string;
    role: string;
    avatar: string;
    bio: string;
    uid?: string;
    username?: string;
    isVerified?: boolean;
    verificationColor?: string;
  };
  content: ArticleContentBlock[];
  clapsCount?: number;
}

export interface NavigationItemConfig {
  id: string;
  label: string;
  page: PageView;
  visible?: boolean;
}

export interface MarqueeItem {
  id: string;
  text: string;
  url?: string;
}

export interface FooterLink {
  id: string;
  label: string;
  type: 'internal' | 'external' | 'rss' | 'topic';
  target: string;
  visible?: boolean;
}

export interface BlogHeaderConfig {
  eyebrow: string;
  title: string;
  description: string;
  backgroundColor: string;
  textColor: string;
  showEssayCount: boolean;
  essayCountLabel: string;
}

export interface SiteConfig {
  logoImageUrl: string;
  logoPart1: string;
  logoPart2: string;
  tagline: string;
  heroHeadline: string;
  heroSubheadline: string;
  heroBgColor: string;
  manifestoText: string;
  manifestoAuthor: string;
  authorName: string;
  authorRole: string;
  authorAvatarUrl: string;
  aboutMeTitle: string;
  aboutMeBio: string;
  topNavigation?: NavigationItemConfig[];
  menuNavigation?: NavigationItemConfig[];
  
  // Advanced Global Settings
  themePrimaryColor?: string;
  themeSecondaryColor?: string;
  themeAccentColor?: string;
  themeSuccessColor?: string;
  readingProgressPageColor?: string;
  readingProgressPersistentColor?: string;

  // Global site presentation controls
  marqueeItems?: MarqueeItem[];
  marqueeSpeedSeconds?: number;
  marqueePauseOnHover?: boolean;
  blogHeader?: BlogHeaderConfig;
  footerNavigationTitle?: string;
  footerTopicsTitle?: string;
  footerHubTitle?: string;
  footerNavigationLinks?: FooterLink[];
  footerHubLinks?: FooterLink[];
  footerTopicCategories?: string[];
  footerBottomRightText?: string;
  
  // Footer
  footerNewsletterTitle?: string;
  footerNewsletterSubtitle?: string;
  footerBrandStatement?: string;
  footerLegalText?: string;
  
  // Contact Page
  contactTitle?: string;
  contactSubtitle?: string;
  contactEmail?: string;
  contactTwitter?: string;
  contactGithub?: string;
  contactTelegram?: string;
  contactInstagram?: string;
  contactWebsite?: string;
  contactX?: string;
  
  // Extra Info
  aboutMeImageUrl?: string;
  metaDescription?: string;
  maintenanceMode?: boolean;
  emergencyAdminLock?: boolean;
  readOnlyMode?: boolean;
  registrationsEnabled?: boolean;
  commentsEnabled?: boolean;
  postingEnabled?: boolean;
  reactionsEnabled?: boolean;
  followingEnabled?: boolean;
  uploadsEnabled?: boolean;
  maintenanceMessage?: string;
  communityEnabled?: boolean;
  allowCommunityCreation?: boolean;
  allowCommunityPosts?: boolean;
  allowQuestions?: boolean;
  allowTopics?: boolean;
  allowDirectMessages?: boolean;
  allowPublicBlogs?: boolean;
  allowCommunityBlogs?: boolean;
  allowCommunityDiscussions?: boolean;
  showSocialAnnouncement?: boolean;
  socialAnnouncement?: string;
  socialAnnouncementLink?: string;
  socialDefaultSort?: 'new' | 'hot' | 'top' | 'rising';
  customCategories?: string[];
  authorProfileUid?: string;
  authorProfileUsername?: string;
  creatorPage?: CreatorPageConfig;
  popupAnnouncement?: {
    id?: string;
    enabled: boolean;
    title: string;
    message: string;
    type?: 'info' | 'update' | 'warning' | 'urgent' | 'maintenance' | 'feature' | 'bugfix' | 'event';
    priority?: 'low' | 'normal' | 'high' | 'critical';
    displayMode?: 'modal' | 'popup' | 'banner';
    frequency?: 'once' | 'session' | 'daily' | 'every_visit' | 'until_dismissed';
    audience?: 'everyone' | 'signed_in' | 'guests' | 'creators' | 'moderators' | 'master_admin';
    startAt?: string;
    endAt?: string;
    targetPage?: 'all' | 'home' | 'blog' | 'article' | 'social' | 'explore' | 'series' | 'creator' | 'changelog';
    targetRoute?: string;
    linkLabel?: string;
    linkTarget?: string;
    dismissible?: boolean;
    actionLabel?: string;
    actionTarget?: string;
  };
}

export interface BentoLink {
  id: string;
  title: string;
  url: string;
  icon: string;
  imageUrl?: string;
  isFeatured: boolean;
  color: string;
  order: number;
}

export type PageView = 'home' | 'blog' | 'article' | 'about' | 'contact' | 'cms' | 'links' | 'community' | 'community_post' | 'community_profile' | 'saved' | 'history' | 'notifications' | 'explore' | 'social' | 'series' | 'creator' | 'topic' | 'dashboard' | 'activity' | 'creator_studio' | 'creators' | 'preferences' | 'health' | 'changelog';

export interface CommunityUser {
  uid: string;
  username: string;
  displayName: string;
  photoURL: string;
  coverImageUrl?: string;
  websiteUrl?: string;
  location?: string;
  socialX?: string;
  socialGithub?: string;
  socialTelegram?: string;
  socialInstagram?: string;
  platformRole?: 'member' | 'moderator' | 'master_admin';
  email?: string;
  bio: string;
  themeColor: string;
  isBlocked?: boolean;
  isSuspended?: boolean;
  suspensionUntil?: string | null;
  restrictCommenting?: boolean;
  restrictPosting?: boolean;
  restrictCommunities?: boolean;
  restrictReactions?: boolean;
  restrictFollowing?: boolean;
  moderatorNote?: string;
  warningCount?: number;
  followersCount?: number;
  followingCount?: number;
  role?: string;
  isAuthor?: boolean;
  isVerified?: boolean;
  verificationColor?: string;
  createdAt: string;
  updatedAt: string;
  creatorPage?: CreatorPageConfig;
}

export interface CommunityPost {
  id: string; // Document ID
  type: 'discussion' | 'blog';
  title: string;
  content: string;
  authorId: string;
  authorUsername: string;
  authorName: string;
  authorAvatar: string;
  isVerified?: boolean;
  verificationColor?: string;
  platformRole?: 'member' | 'moderator' | 'master_admin';
  excerpt?: string;
  coverImage?: string;
  coverImageAlt?: string;
  coverImageCaption?: string;
  category?: string;
  tags?: string[];
  readingTimeMinutes?: number;
  contentBlocks?: ArticleContentBlock[];
  collaborators?: Array<{ uid?: string; username?: string; name?: string; role?: string }>;
  seriesId?: string;
  seriesName?: string;
  seriesOrder?: number;
  sourcePostId?: string;
  origin?: 'admin' | 'community_blog' | 'community_post';
  promotedToArticleSlug?: string;
  isPublished?: boolean;
  mainPublicationStatus?: 'published' | 'unpublished';
  promotedAt?: string;
  editedAt?: string;
  editReviewStatus?: 'pending' | 'approved';
  editReviewRequestedAt?: string;
  editReviewedAt?: string;
  editReviewedBy?: string;
  promotedBy?: string;
  clapsCount?: number; // legacy
  upvotesCount: number;
  downvotesCount: number;
  commentsCount: number;
  repostsCount?: number;
  isFeatured: boolean;
  viewsCount?: number;
  createdAt: string;
  updatedAt: string;
  quoteText?: string;
  quotedPostId?: string;
  mentionedUsernames?: string[];
  hashtags?: string[];
  mediaUrls?: string[];
}

export interface CommunityComment {
  id: string; // Document ID
  postId: string;
  authorId: string;
  authorUsername: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
}

export type CarouselElementType = 'text' | 'badge' | 'button' | 'link';

export interface CarouselElement {
  id: string;
  type: CarouselElementType;
  text: string;
  x: number;
  y: number;
  color: string;
  backgroundColor?: string;
  fontSize?: number;
  href?: string;
}

export interface CarouselSlide {
  id: string;
  title: string;
  imageUrl?: string;
  linkUrl: string;
  mode?: 'image' | 'scratch';
  backgroundColor?: string;
  order: number;
  imagePositionX?: number;
  imagePositionY?: number;
  imageZoom?: number;
  showDots?: boolean;
  elements?: CarouselElement[];
  createdAt: string;
  updatedAt: string;
}

export interface UserSavedItem {
  id: string;
  itemId: string;
  itemType: 'article' | 'post';
  title?: string;
  createdAt: string;
  collectionId?: string;
  collectionName?: string;
}

export interface BookmarkCollection {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  type: 'follow' | 'upvote' | 'comment' | 'reply' | 'mention' | 'repost' | 'verification' | 'article_published' | 'message';
  actorId: string;
  actorUsername: string;
  actorName: string;
  actorAvatar?: string;
  message: string;
  targetType?: 'post' | 'comment' | 'profile' | 'article' | 'question' | 'report';
  targetId?: string;
  read: boolean;
  createdAt: string;
}

export interface ArticleComment {
  id: string;
  articleSlug: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  authorUsername?: string;
  isVerified?: boolean;
  verificationColor?: string;
  content: string;
  createdAt: string;
}

