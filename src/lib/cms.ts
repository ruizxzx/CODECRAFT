import { 
  collection, 
  collectionGroup,
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc,
  deleteDoc, 
  onSnapshot, 
  query, 
  where,
  orderBy, 
  serverTimestamp,
  Timestamp,
  writeBatch,
  limit,
  increment,
  runTransaction
} from 'firebase/firestore';
import { db, auth, checkIsAdmin } from './firebase';
import { writeAdminAudit } from './audit';
import { deletePost, getCommunityProfile, getPost } from './community';
import { Article, SiteConfig, BentoLink, ArticleComment, CommunityPost, NavigationItemConfig } from '../types';
import { INITIAL_ARTICLES } from '../data/articles';

export const DEFAULT_TOP_NAVIGATION: NavigationItemConfig[] = [
  { id: 'home', label: 'Home', page: 'home', visible: true },
  { id: 'blog', label: 'Blog', page: 'blog', visible: true },
  { id: 'social', label: 'Community', page: 'social', visible: true },
  { id: 'saved', label: 'Saved', page: 'saved', visible: true },
  { id: 'notifications', label: 'Notifications', page: 'notifications', visible: true },
  { id: 'explore', label: 'Explore', page: 'explore', visible: true },
  { id: 'series', label: 'Series', page: 'series', visible: true },
];

export const DEFAULT_MENU_NAVIGATION: NavigationItemConfig[] = [
  { id: 'about', label: 'About', page: 'about', visible: true },
  { id: 'links', label: 'Links', page: 'links', visible: true },
  { id: 'contact', label: 'Contact', page: 'contact', visible: true },
];

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  logoImageUrl: "",
  logoPart1: "OFF",
  logoPart2: "SCRPT",
  tagline: "ARCHITECTURAL TECH PRESS // DISTRIBUTED SYSTEMS & LOCAL AI",
  heroHeadline: "BUILDING THE FUTURE OF THE WEB.",
  heroSubheadline: "Deep architectural breakdowns, systems design essays, and uncensored engineering dispatches from the front lines of distributed software.",
  heroBgColor: "#FFFFFF",
  manifestoText: "Software engineering is not about accumulating abstractions; it is about mastering control over complexity, performance, and user agency.",
  manifestoAuthor: "Krish Sarkar",
  authorName: "Krish",
  authorRole: "Founder & Systems Architect",
  authorAvatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop",
  aboutMeTitle: "SYSTEMS ARCHITECT // SOFTWARE CRAFTSMAN",
  topNavigation: DEFAULT_TOP_NAVIGATION,
  menuNavigation: DEFAULT_MENU_NAVIGATION,
  aboutMeBio: "I am a software engineer and systems architect specializing in high-performance web applications and distributed systems.\n\nOver the past decade, I have built infrastructure that scales to millions of users, designed resilient microservices, and obsessed over web performance metrics.",
  themePrimaryColor: "#FFD600",
  themeSecondaryColor: "#00E0FF",
  themeAccentColor: "#FF60B5",
  themeSuccessColor: "#00FF41",
  readingProgressPageColor: "#2563EB",
  readingProgressPersistentColor: "#FFD600",
  marqueeItems: [
    { id: 'marquee-1', text: 'BUILDING ON THE OPEN INTERNET' },
    { id: 'marquee-2', text: 'OFFSCRPT TECH PRESS' },
    { id: 'marquee-3', text: 'BUILD. LEARN. CREATE.' },
    { id: 'marquee-4', text: 'NEW DISPATCHES EVERY TUESDAY' },
    { id: 'marquee-5', text: 'NO FLUFF • REAL PRODUCTION CODE' },
    { id: 'marquee-6', text: 'DISTRIBUTED SYSTEMS & LOCAL AI' },
  ],
  marqueeSpeedSeconds: 25,
  marqueePauseOnHover: true,
  blogHeader: {
    eyebrow: 'THE DISPATCHES ARCHIVE',
    title: 'ENGINEERING & ARCHITECTURE',
    description: 'Rigorous, hands-on writing dissecting modern web technologies, AI agent architectures, distributed database internals, and developer productivity systems.',
    backgroundColor: '#D97706',
    textColor: '#000000',
    showEssayCount: true,
    essayCountLabel: 'ESSAYS PUBLISHED'
  },
  footerNavigationTitle: 'NAVIGATION',
  footerTopicsTitle: 'CURATED TOPICS',
  footerHubTitle: 'PUBLICATION HUB',
  footerNavigationLinks: [
    { id: 'footer-nav-home', label: 'Home', type: 'internal', target: 'home', visible: true },
    { id: 'footer-nav-blog', label: 'The Dispatches', type: 'internal', target: 'blog', visible: true },
    { id: 'footer-nav-explore', label: 'Explore', type: 'internal', target: 'explore', visible: true },
    { id: 'footer-nav-series', label: 'Series', type: 'internal', target: 'series', visible: true },
    { id: 'footer-nav-about', label: 'About Krish', type: 'internal', target: 'about', visible: true },
    { id: 'footer-nav-contact', label: 'Contact Desk', type: 'internal', target: 'contact', visible: true },
  ],
  footerHubLinks: [
    { id: 'footer-hub-rss', label: 'RSS / XML Feed', type: 'rss', target: 'rss', visible: true },
    { id: 'footer-hub-github', label: 'GitHub', type: 'external', target: 'https://github.com/krishficient', visible: true },
    { id: 'footer-hub-telegram', label: 'Telegram', type: 'external', target: 'https://t.me/krishficient', visible: true },
    { id: 'footer-hub-instagram', label: 'Instagram', type: 'external', target: 'https://instagram.com/krishficient', visible: true },
  ],
  footerTopicCategories: [],
  footerBottomRightText: 'HIGH DENSITY SPECIFICATION',
  footerNewsletterTitle: "RECEIVE DEEP TECHNICAL ESSAYS IN YOUR INBOX",
  footerNewsletterSubtitle: "Zero spam. Zero generic marketing. Only in-depth software architectural breakdowns, local AI research, and production post-mortems.",
  footerBrandStatement: "An independent technology publication engineered by Krish. Fusing Neo-Brutalism, Gumroad minimalism, and Medium-grade editorial craft for software builders worldwide.",
  contactTitle: "SECURE COMM CHANNEL",
  contactSubtitle: "For architectural consulting, secure protocol design, or technical inquiries.",
  contactEmail: "hello@krishficient.dev",
  contactTwitter: "@krishficient",
  contactGithub: "krishficient",
  contactTelegram: "@krishficient",
  contactInstagram: "@krishficient",
  contactWebsite: "https://offscrpt.vercel.app",
  contactX: "@krishficient",
  maintenanceMode: false,
  maintenanceMessage: "OFFSCRPT is temporarily under maintenance.",
  communityEnabled: true,
  allowCommunityCreation: true,
  allowCommunityPosts: true,
  allowQuestions: true,
  allowTopics: true,
  allowDirectMessages: true,
  allowPublicBlogs: true,
  allowCommunityBlogs: true,
  allowCommunityDiscussions: true,
  showSocialAnnouncement: false,
  socialAnnouncement: "",
  socialAnnouncementLink: "",
  socialDefaultSort: 'new',
  customCategories: [],
  authorProfileUid: '',
  authorProfileUsername: 'krishsarkar'
};


function stripUndefinedDeep<T>(value:T):T {
  if (value === undefined) return value;
  if (Array.isArray(value)) return value.map(v => stripUndefinedDeep(v)).filter(v => v !== undefined) as T;
  if (value && typeof value === 'object') {
    const obj:any = value as any;
    if (obj && typeof obj === 'object' && ('_methodName' in obj || obj?.constructor?.name?.includes('FieldValue'))) return value;
    const out:any = {};
    Object.entries(obj).forEach(([k,v]) => { if (v !== undefined) out[k] = stripUndefinedDeep(v as any); });
    return out as T;
  }
  return value;
}

export const DEFAULT_BENTO_LINKS: BentoLink[] = [
  {
    id: "bento-github",
    title: "GitHub Architecture Repos",
    url: "https://github.com",
    icon: "github",
    isFeatured: true,
    color: "#00E0FF",
    order: 1
  },
  {
    id: "bento-twitter",
    title: "Daily Engineering Dispatches on X",
    url: "https://x.com",
    icon: "twitter",
    isFeatured: true,
    color: "#FFD600",
    order: 2
  },
  {
    id: "bento-youtube",
    title: "System Architecture Deep-Dives",
    url: "https://youtube.com",
    icon: "youtube",
    isFeatured: false,
    color: "#FF60B5",
    order: 3
  },
  {
    id: "bento-podcast",
    title: "Local AI & Systems Engineering Podcast",
    url: "https://spotify.com",
    icon: "podcast",
    isFeatured: false,
    color: "#00FF41",
    order: 4
  },
  {
    id: "bento-newsletter",
    title: "Weekly High-Density Substack Dispatch",
    url: "https://substack.com",
    icon: "mail",
    isFeatured: true,
    color: "#FFD600",
    order: 5
  }
];

// ==========================================
// 1. SITE CONFIGURATION (CLOUD PERSISTENCE)
// ==========================================

export function subscribeSiteConfig(callback: (config: SiteConfig) => void): () => void {
  const configDocRef = doc(db, 'siteConfig', 'global');
  return onSnapshot(configDocRef, (snap) => {
    if (snap.exists()) {
      callback({ ...DEFAULT_SITE_CONFIG, ...(snap.data() as Partial<SiteConfig>) });
    } else {
      callback(DEFAULT_SITE_CONFIG);
    }
  }, (err) => {
    console.warn("Real-time site config listener failed, using defaults:", err);
    callback(DEFAULT_SITE_CONFIG);
  });
}

export async function getSiteConfig(): Promise<SiteConfig> {
  try {
    const snap = await getDoc(doc(db, 'siteConfig', 'global'));
    if (snap.exists()) {
      return { ...DEFAULT_SITE_CONFIG, ...(snap.data() as Partial<SiteConfig>) };
    }
  } catch (error) {
    console.warn("Failed to fetch site config from Firestore:", error);
  }
  return DEFAULT_SITE_CONFIG;
}

export async function saveSiteConfig(config: SiteConfig): Promise<void> {
  const configDocRef = doc(db, 'siteConfig', 'global');
  const beforeSnap = await getDoc(configDocRef).catch(()=>null);
  await setDoc(configDocRef, {
    ...config,
    updatedAt: serverTimestamp()
  }, { merge: true });
  if (checkIsAdmin(auth.currentUser?.email)) { try { await writeAdminAudit('changed site config','siteConfig/global',beforeSnap?.exists?beforeSnap.data():null,config); } catch (error) { console.warn('OFFSCRPT recoverable operation failed:', error); } }
}


export async function createSiteConfigBackup(config: SiteConfig, label='Manual backup') {
  const admin=auth.currentUser; if(!admin || !checkIsAdmin(admin.email)) throw new Error('Admin access required.');
  const id=`backup_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  await setDoc(doc(db,'siteConfigBackups',id),{label:label.trim().slice(0,120)||'Manual backup',snapshot:config,createdBy:admin.uid,createdByEmail:admin.email||'',createdAt:serverTimestamp()});
}

export async function getSiteConfigBackups():Promise<any[]> {
  const admin=auth.currentUser; if(!admin || !checkIsAdmin(admin.email)) throw new Error('Admin access required.');
  const snap=await getDocs(query(collection(db,'siteConfigBackups'),limit(100)));
  return snap.docs.map(d=>({id:d.id,...d.data(),createdAt:(d.data() as any).createdAt?.toDate?.()?.toISOString?.() || String((d.data() as any).createdAt||'')})).sort((a:any,b:any)=>new Date(b.createdAt||0).getTime()-new Date(a.createdAt||0).getTime());
}

export async function restoreSiteConfigBackup(backupId:string):Promise<SiteConfig> {
  const admin=auth.currentUser; if(!admin || !checkIsAdmin(admin.email)) throw new Error('Admin access required.');
  const snap=await getDoc(doc(db,'siteConfigBackups',backupId)); if(!snap.exists()) throw new Error('Backup not found.');
  const config=snap.data().snapshot as SiteConfig; await saveSiteConfig(config); return config;
}


export async function syncAdminAuthorProfile(author: {
  name: string;
  role: string;
  avatar: string;
  bio: string;
}): Promise<{ uid: string; username: string }> {
  const admin = auth.currentUser;
  if (!admin || !checkIsAdmin(admin.email)) throw new Error('Unauthorized: admin account required.');

  const username = 'krishsarkar';
  const usernameRef = doc(db, 'usernames', username);
  const usernameSnap = await getDoc(usernameRef);
  // The canonical author belongs to the existing @krishsarkar reservation.
  // Multiple trusted admin Google accounts may manage the same author profile.
  const uid = usernameSnap.exists() && usernameSnap.data()?.uid ? usernameSnap.data().uid : admin.uid;
  const userRef = doc(db, 'users', uid);
  const existingUser = await getDoc(userRef);
  const profileData: any = {
    uid, username,
    displayName: author.name || 'Krish Sarkar',
    photoURL: author.avatar || admin.photoURL || '',
    bio: author.bio || '',
    themeColor: '#FFD600',
    role: author.role || 'Founder & Systems Architect',
    isAuthor: true,
    isVerified: existingUser.exists() ? !!existingUser.data()?.isVerified : true,
    verificationColor: existingUser.exists() ? (existingUser.data()?.verificationColor || '#2196F3') : '#2196F3',
    followersCount: existingUser.exists() ? (existingUser.data()?.followersCount || 0) : 0,
    followingCount: existingUser.exists() ? (existingUser.data()?.followingCount || 0) : 0,
    createdAt: existingUser.exists() ? existingUser.data()?.createdAt : serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const batch = writeBatch(db);
  if (usernameSnap.exists()) {
    if (usernameSnap.data()?.uid !== uid) throw new Error('@krishsarkar reservation is inconsistent.');
    batch.update(usernameRef, { uid });
  } else {
    batch.set(usernameRef, { uid });
  }
  if (existingUser.exists()) batch.update(userRef, profileData);
  else batch.set(userRef, profileData);
  await batch.commit();

  const contentWrites: Array<{ ref: any; data: any }> = [];
  const postsSnap = await getDocs(query(collection(db, 'posts'), where('authorId', '==', uid)));
  postsSnap.docs.forEach(d => contentWrites.push({ ref: d.ref, data: {
    authorName: profileData.displayName, authorAvatar: profileData.photoURL,
    authorUsername: username, isVerified: !!profileData.isVerified,
    verificationColor: profileData.verificationColor || '#2196F3', updatedAt: serverTimestamp()
  }}));
  // Avoid making critical admin saves depend on a collection-group index. The
  // filtered query is preferred, but older deployments may not have the index yet.
  let commentsSnap;
  try {
    commentsSnap = await getDocs(query(collectionGroup(db, 'comments'), where('authorId', '==', uid)));
  } catch (indexError) {
    console.warn('Comments author index unavailable; falling back to a cloud scan:', indexError);
    const allComments = await getDocs(collectionGroup(db, 'comments'));
    commentsSnap = { docs: allComments.docs.filter(d => d.data()?.authorId === uid) } as any;
  }
  commentsSnap.docs.forEach(d => contentWrites.push({ ref: d.ref, data: {
    authorName: profileData.displayName, authorAvatar: profileData.photoURL,
    authorUsername: username, isVerified: !!profileData.isVerified,
    verificationColor: profileData.verificationColor || '#2196F3', updatedAt: serverTimestamp()
  }}));
  for (let i = 0; i < contentWrites.length; i += 450) {
    const contentBatch = writeBatch(db);
    contentWrites.slice(i, i + 450).forEach(w => contentBatch.update(w.ref, w.data));
    await contentBatch.commit();
  }

  return { uid, username };
}

// ==========================================
// 2. BENTO LINKS (CLOUD PERSISTENCE)
// ==========================================

export function subscribeBentoLinks(callback: (links: BentoLink[]) => void): () => void {
  const bentoDocRef = doc(db, 'bento', 'global');
  return onSnapshot(bentoDocRef, (snap) => {
    if (snap.exists() && Array.isArray(snap.data().links)) {
      callback(snap.data().links as BentoLink[]);
    } else {
      callback(DEFAULT_BENTO_LINKS);
    }
  }, (err) => {
    console.warn("Real-time bento links listener failed, using defaults:", err);
    callback(DEFAULT_BENTO_LINKS);
  });
}

export async function getBentoLinks(): Promise<BentoLink[]> {
  try {
    const snap = await getDoc(doc(db, 'bento', 'global'));
    if (snap.exists() && Array.isArray(snap.data().links)) {
      return snap.data().links as BentoLink[];
    }
  } catch (error) {
    console.warn("Failed to fetch bento links from Firestore:", error);
  }
  return DEFAULT_BENTO_LINKS;
}

export async function saveBentoLinks(links: BentoLink[]): Promise<void> {
  const bentoDocRef = doc(db, 'bento', 'global');
  await setDoc(bentoDocRef, {
    links,
    updatedAt: serverTimestamp()
  });
}

// ==========================================
// 3. ARTICLES / EDITORIAL CMS CONTENT
// ==========================================

async function getDeletedSlugs(): Promise<Set<string>> {
  const deletedSet = new Set<string>();
  try {
    const snap = await getDocs(collection(db, 'deleted_articles'));
    snap.docs.forEach(d => deletedSet.add(d.id));
  } catch (e) {
    console.warn('Deleted article index could not be loaded; continuing with cloud articles:', e);
  }
  return deletedSet;
}


function normalizeArticleRecord(raw: any, fallbackId = ''): Article {
  const data = raw && typeof raw === 'object' ? raw : {};
  const fallbackAuthor = data.author && typeof data.author === 'object' ? data.author : {};
  const id = String(data.id || fallbackId || data.slug || '');
  const slug = String(data.slug || fallbackId || id);
  const rawContent = Array.isArray(data.content) ? data.content : (Array.isArray(data.contentBlocks) ? data.contentBlocks : []);
  const content = rawContent
    .filter((block: any) => block && typeof block === 'object')
    .map((block: any) => ({
      ...block,
      type: String(block.type || 'paragraph'),
      content: String(block.content ?? ''),
      items: Array.isArray(block.items) ? block.items.map((item: any) => String(item ?? '')).filter(Boolean) : [],
      codeBlock: block.codeBlock && typeof block.codeBlock === 'object' ? {
        ...block.codeBlock,
        code: String(block.codeBlock.code ?? ''),
        language: String(block.codeBlock.language ?? 'text'),
        filename: String(block.codeBlock.filename ?? ''),
      } : undefined,
      href: block.href != null ? String(block.href) : undefined,
      linkText: block.linkText != null ? String(block.linkText) : undefined,
      buttonText: block.buttonText != null ? String(block.buttonText) : undefined,
      imageUrl: block.imageUrl != null ? String(block.imageUrl) : undefined,
      imageAlt: block.imageAlt != null ? String(block.imageAlt) : undefined,
      imageCaption: block.imageCaption != null ? String(block.imageCaption) : undefined,
      imageHref: block.imageHref != null ? String(block.imageHref) : undefined,
      videoUrl: block.videoUrl != null ? String(block.videoUrl) : undefined,
      videoTitle: block.videoTitle != null ? String(block.videoTitle) : undefined,
      videoCaption: block.videoCaption != null ? String(block.videoCaption) : undefined,
      calloutTitle: block.calloutTitle != null ? String(block.calloutTitle) : undefined,
      quoteAuthor: block.quoteAuthor != null ? String(block.quoteAuthor) : undefined,
    }));
  const tags = Array.isArray(data.tags)
    ? data.tags.map((tag: any) => String(tag || '').trim()).filter(Boolean)
    : [];
  const author = {
    name: String(fallbackAuthor.name || data.authorName || 'OFFSCRPT'),
    role: String(fallbackAuthor.role || data.authorRole || 'Author'),
    avatar: String(fallbackAuthor.avatar || data.authorAvatar || ''),
    bio: String(fallbackAuthor.bio || ''),
    uid: fallbackAuthor.uid || data.authorId || undefined,
    username: fallbackAuthor.username || data.authorUsername || undefined,
    isVerified: Boolean(fallbackAuthor.isVerified ?? data.isVerified ?? false),
    verificationColor: fallbackAuthor.verificationColor || data.verificationColor || undefined,
  };
  return {
    ...data,
    id,
    slug,
    title: String(data.title || 'Untitled Dispatch'),
    excerpt: String(data.excerpt || ''),
    coverImage: String(data.coverImage || ''),
    coverImageAlt: String(data.coverImageAlt || data.title || ''),
    category: String(data.category || 'Technology'),
    tags,
    publishedAt: String(data.publishedAt || data.createdAt || ''),
    readingTimeMinutes: Math.max(1, Number(data.readingTimeMinutes || 1)),
    author,
    content,
  } as Article;
}

function mergeArticlesWithInitial(cloudArticles: Article[], deletedSlugs: Set<string>): Article[] {
  const cloudSlugs = new Set(cloudArticles.map(a => a.slug));
  const fallbackOnly = INITIAL_ARTICLES.filter(a => !cloudSlugs.has(a.slug) && !deletedSlugs.has(a.slug));
  return [...cloudArticles, ...fallbackOnly];
}

async function hydrateArticleOriginalAuthor(article: Article): Promise<Article> {
  if (!article.sourcePostId || article.origin !== 'community_blog') return article;
  const fallback:any = article.originalAuthor || article.author;
  try {
    let post:any = null;
    if ((article as any).sourceCommunityId) {
      post = await getDoc(doc(db, 'communities', (article as any).sourceCommunityId, 'posts', article.sourcePostId));
      post = post.exists() ? { ...post.data(), id: post.id } : null;
    } else {
      post = await getPost(article.sourcePostId);
    }
    if (!post?.authorId) return article;
    let profile:any = null;
    try { profile = await getCommunityProfile(post.authorId); } catch (error) { console.warn('OFFSCRPT recoverable operation failed:', error); }
    const originalAuthor = {
      ...fallback,
      uid: post.authorId,
      username: profile?.username || post.authorUsername || fallback?.username,
      name: profile?.displayName || post.authorName || fallback?.name,
      avatar: profile?.photoUrl || post.authorAvatar || fallback?.avatar,
      bio: profile?.bio || fallback?.bio || '',
      role: profile?.isVerified ? 'Verified Creator' : (fallback?.role || 'Creator'),
      isVerified: !!(profile?.isVerified ?? post.isVerified ?? fallback?.isVerified),
      verificationColor: profile?.verificationColor || post.verificationColor || fallback?.verificationColor
    };
    return { ...article, author: originalAuthor as any, originalAuthor };
  } catch (e) {
    console.warn('Could not hydrate original article creator:', e);
    return article;
  }
}

async function hydrateArticleAuthors(articles: Article[]): Promise<Article[]> {
  const candidates = articles.filter(a => !!a.sourcePostId && a.origin === 'community_blog');
  if (!candidates.length) return articles;
  const hydrated = await Promise.all(candidates.map(hydrateArticleOriginalAuthor));
  const bySlug = new Map(hydrated.map(a => [a.slug, a]));
  return articles.map(a => bySlug.get(a.slug) || a);
}

async function hydratePublishedSourcePosts(articles: Article[]): Promise<Article[]> {
  const candidates = articles.filter(a => !!a.sourcePostId && a.origin === 'community_blog' && a.mainPublicationStatus !== 'unpublished');
  if (!candidates.length) return articles;
  const hydrated = await Promise.all(candidates.map(async article => {
    try {
      let post:any = null;
      if ((article as any).sourceCommunityId) {
        const snap = await getDoc(doc(db,'communities',(article as any).sourceCommunityId,'posts',article.sourcePostId!));
        post = snap.exists() ? { ...snap.data(), id: snap.id } : null;
      } else {
        post = await getPost(article.sourcePostId!);
      }
      if (!post || post.mainPublicationStatus === 'unpublished') return article;
      const contentBlocks = Array.isArray(post.contentBlocks) && post.contentBlocks.length ? post.contentBlocks : article.content;
      return {
        ...article,
        title: post.title || article.title,
        excerpt: post.excerpt || article.excerpt,
        coverImage: post.coverImage || article.coverImage,
        coverImageAlt: post.coverImageAlt || article.coverImageAlt,
        coverImageCaption: post.coverImageCaption || article.coverImageCaption,
        category: post.category || article.category,
        tags: Array.isArray(post.tags) ? post.tags : article.tags,
        readingTimeMinutes: post.readingTimeMinutes || article.readingTimeMinutes,
        seriesId: post.seriesId || article.seriesId,
        seriesName: post.seriesName || article.seriesName,
        seriesOrder: post.seriesOrder || article.seriesOrder,
        content: contentBlocks,
        editedAt: post.editedAt || article.editedAt,
        editReviewStatus: post.editReviewStatus || article.editReviewStatus,
        editReviewRequestedAt: post.editReviewRequestedAt || article.editReviewRequestedAt,
        editReviewedAt: post.editReviewedAt || article.editReviewedAt,
        editReviewedBy: post.editReviewedBy || article.editReviewedBy,
        originalAuthor: article.originalAuthor,
        author: article.author,
      } as Article;
    } catch { return article; }
  }));
  const bySlug = new Map(hydrated.map(a => [a.slug, a]));
  return articles.map(a => bySlug.get(a.slug) || a);
}

export function subscribeArticles(callback: (articles: Article[]) => void): () => void {
  const articlesRef = collection(db, 'articles');
  let sourceUnsubs: Array<()=>void> = [];
  let disposed = false;
  let latestCloudArticles: Article[] = [];
  const emit = async () => {
    if(disposed) return;
    const deletedSlugs = await getDeletedSlugs();
    const visible = latestCloudArticles.filter(a => !deletedSlugs.has(a.slug) && a.isPublished !== false);
    const hydrated = await hydrateArticleAuthors(visible).then(hydratePublishedSourcePosts);
    if(!disposed) callback(mergeArticlesWithInitial(hydrated, deletedSlugs).map(a => normalizeArticleRecord(a, a.id || a.slug)));
  };
  const resetSourceListeners = (articles:Article[]) => {
    sourceUnsubs.forEach(u=>u()); sourceUnsubs=[];
    articles.filter(a=>!!a.sourcePostId && a.origin==='community_blog' && a.mainPublicationStatus!=='unpublished').forEach(article=>{
      const ref = (article as any).sourceCommunityId
        ? doc(db,'communities',(article as any).sourceCommunityId,'posts',article.sourcePostId!)
        : doc(db,'posts',article.sourcePostId!);
      const unsub=onSnapshot(ref,()=>{ void emit(); },()=>{});
      sourceUnsubs.push(unsub);
    });
  };
  const unsubArticles=onSnapshot(articlesRef, async snap=>{
    if(disposed) return;
    latestCloudArticles=snap.docs.map(d=>normalizeArticleRecord(d.data(), d.id));
    latestCloudArticles.sort((a,b)=>new Date(b.publishedAt||0).getTime()-new Date(a.publishedAt||0).getTime());
    resetSourceListeners(latestCloudArticles);
    await emit();
  }, err=>{
    console.warn('Real-time articles subscription failed, using local archive:',err);
    if(!disposed) callback(INITIAL_ARTICLES);
  });
  return ()=>{ disposed=true; unsubArticles(); sourceUnsubs.forEach(u=>u()); sourceUnsubs=[]; };
}

export async function fetchAllArticlesForAdmin(): Promise<Article[]> {
  if (!checkIsAdmin(auth.currentUser?.email)) throw new Error('Master admin access required.');
  const snap = await getDocs(collection(db, 'articles'));
  const articles = snap.docs.map(d => normalizeArticleRecord(d.data(), d.id));
  const hydrated = await hydrateArticleAuthors(articles);
  return hydrated.sort((a,b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime());
}

export async function fetchArticles(): Promise<{ articles: Article[]; source: 'firestore' | 'fallback' }> {
  try {
    const deletedSlugs = await getDeletedSlugs();
    const snap = await getDocs(collection(db, 'articles'));
    if (!snap.empty) {
      const cloudArticles = snap.docs.map(d => {
        const data = d.data();
        return normalizeArticleRecord(data, d.id);
      }).filter(a => !deletedSlugs.has(a.slug) && a.isPublished !== false);
      cloudArticles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
      const hydrated = await hydratePublishedSourcePosts(await hydrateArticleAuthors(cloudArticles));
      return {
        articles: mergeArticlesWithInitial(hydrated, deletedSlugs),
        source: 'firestore'
      };
    }
  } catch (error) {
    console.warn("Could not fetch articles from Firestore, using initial dataset:", error);
  }
  return {
    articles: INITIAL_ARTICLES,
    source: 'fallback'
  };
}



function getStableVisitorId(): string {
  if (typeof window === 'undefined') return 'server';
  const KEY = 'offscrpt:visitor-id:v1';
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const value = `${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    localStorage.setItem(KEY, value);
    return value;
  } catch {
    return `ephemeral-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  }
}
export async function recordArticleView(slug:string, viewerId?:string):Promise<void>{
  if(!slug) return;
  const authenticated = Boolean(viewerId);
  const identity = viewerId || getStableVisitorId();
  const day = new Date().toISOString().slice(0,10);
  const safeSlug = encodeURIComponent(slug).slice(0,180);
  const safeIdentity = encodeURIComponent(identity).slice(0,220);
  const receiptId = `${safeSlug}_${safeIdentity}_${day}`;
  const receiptRef = doc(db, 'articleViews', receiptId);
  const articleRef = doc(db, 'articles', slug);

  // Anonymous reads are deduplicated by a stable browser identifier + UTC day.
  // The local marker prevents unnecessary writes; authenticated readers are additionally
  // protected by the cloud receipt transaction below.
  const localKey = `offscrpt:view:${slug}:${day}`;
  if (!authenticated) {
    try { if (localStorage.getItem(localKey) === '1') return; } catch (error) { console.warn('OFFSCRPT recoverable operation failed:', error); }
    try {
      await setDoc(receiptRef, { slug, visitorId: identity, day, createdAt: serverTimestamp() }, { merge: false });
      await runTransaction(db, async (tx) => {
        const articleSnap = await tx.get(articleRef);
        if (!articleSnap.exists()) return;
        const current = Number(articleSnap.data()?.viewsCount || 0);
        tx.update(articleRef, { viewsCount: current + 1, updatedAt: serverTimestamp() });
      });
      try { localStorage.setItem(localKey, '1'); } catch (error) { console.warn('OFFSCRPT recoverable operation failed:', error); }
    } catch(e){ console.warn('Anonymous article view tracking failed:', e); }
    return;
  }

  try {
    await runTransaction(db, async (tx) => {
      const receiptSnap = await tx.get(receiptRef);
      const articleSnap = await tx.get(articleRef);
      if (receiptSnap.exists() || !articleSnap.exists()) return;
      const current = Number(articleSnap.data()?.viewsCount || 0);
      tx.set(receiptRef, { slug, userId: viewerId, day, createdAt: serverTimestamp() });
      tx.update(articleRef, { viewsCount: current + 1, updatedAt: serverTimestamp() });
    });
  } catch(e){ console.warn('Article view tracking failed:', e); }
}

export async function getArticleViewCount(slug:string):Promise<number>{
  if(!slug) return 0;
  try { const snap = await getDoc(doc(db, 'articles', slug)); return Number(snap.data()?.viewsCount || 0); }
  catch { return 0; }
}

export const ARTICLE_REACTIONS = ['like','useful','insightful','interesting'] as const;
export type ArticleReaction = typeof ARTICLE_REACTIONS[number];
export async function setArticleReaction(slug:string,userId:string,reaction:ArticleReaction|null):Promise<void>{
  if(!userId) throw new Error('Sign in required.');
  const ref=doc(db,'articles',slug,'reactions',userId);
  if(reaction) await setDoc(ref,{userId,reaction,updatedAt:serverTimestamp()},{merge:true});
  else { const old=await getDoc(ref); if(old.exists()) await deleteDoc(ref); }
}
export async function getArticleReaction(slug:string,userId:string):Promise<ArticleReaction|null>{
  if(!userId) return null; const s=await getDoc(doc(db,'articles',slug,'reactions',userId)); return s.exists()?(s.data()?.reaction||null):null;
}
export async function getSeriesArticles(seriesId:string):Promise<Article[]>{
  if(!seriesId) return [];
  const snap=await getDocs(query(collection(db,'articles'),where('seriesId','==',seriesId),limit(100)));
  return snap.docs.map(d=>normalizeArticleRecord(d.data(), d.id)).sort((a:any,b:any)=>(a.seriesOrder||0)-(b.seriesOrder||0));
}
export type ArticleRevisionAction = 'initial' | 'auto-save' | 'manual' | 'before-restore' | 'restored';

export interface ArticleRevision {
  id: string;
  slug: string;
  article: Article;
  action: ArticleRevisionAction;
  createdBy: string;
  createdByEmail?: string;
  createdByName?: string;
  createdAt?: any;
}

export async function createArticleRevision(article:Article, action:ArticleRevisionAction='manual'):Promise<string|undefined>{
  const admin=auth.currentUser;
  if(!admin || !checkIsAdmin(admin.email) || !article?.slug) return;
  const id=`${article.slug}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  await setDoc(doc(db,'articleRevisions',id),{
    article: stripUndefinedDeep(article),
    slug: article.slug,
    title: article.title || '',
    action,
    createdBy: admin.uid,
    createdByEmail: admin.email || '',
    createdByName: admin.displayName || '',
    createdAt: serverTimestamp()
  });
  return id;
}

export async function getArticleRevisions(slug:string):Promise<ArticleRevision[]>{
  const admin=auth.currentUser; if(!admin || !checkIsAdmin(admin.email)) throw new Error('Admin access required.');
  const snap=await getDocs(query(collection(db,'articleRevisions'), where('slug','==',slug), limit(100)));
  return snap.docs.map(d=>({id:d.id,...d.data()} as ArticleRevision)).sort((a:any,b:any)=>{
    const at=a.createdAt?.toDate?.()?.getTime?.() || 0; const bt=b.createdAt?.toDate?.()?.getTime?.() || 0; return bt-at;
  });
}

export async function restoreArticleRevision(revisionId:string):Promise<Article>{
  const admin=auth.currentUser; if(!admin || !checkIsAdmin(admin.email)) throw new Error('Admin access required.');
  const snap=await getDoc(doc(db,'articleRevisions',revisionId)); if(!snap.exists()) throw new Error('Revision not found.');
  const source=snap.data()?.article as Article;
  if(!source?.slug) throw new Error('This revision is invalid.');
  const currentSnap=await getDoc(doc(db,'articles',source.slug));
  if(currentSnap.exists()) await createArticleRevision(normalizeArticleRecord(currentSnap.data(), currentSnap.id), 'before-restore');
  const article={...source};
  await saveArticle(article, {createRevision:false, revisionAction:'restored'});
  await createArticleRevision(article, 'restored');
  return article;
}

export async function duplicateArticleFromRevision(revisionId:string):Promise<Article>{
  const admin=auth.currentUser; if(!admin || !checkIsAdmin(admin.email)) throw new Error('Admin access required.');
  const snap=await getDoc(doc(db,'articleRevisions',revisionId)); if(!snap.exists()) throw new Error('Revision not found.');
  const source={...(snap.data()?.article as Article)};
  if(!source?.slug) throw new Error('This revision is invalid.');
  const base=source.slug.replace(/-copy(?:-\d+)?$/,'');
  let slug=`${base}-copy`; let n=2;
  while((await getDoc(doc(db,'articles',slug))).exists()){ slug=`${base}-copy-${n++}`; }
  const duplicate:Article={...source,id:`article-${Date.now()}`,slug,title:`${source.title} (Copy)`,viewsCount:0,clapsCount:0,reactionCounts:{},isPublished:false,mainPublicationStatus:'unpublished',featured:false,pinned:false,trending:false,promotedToArticleSlug:undefined,sourcePostId:undefined,origin:'admin'};
  await saveArticle(duplicate,{createRevision:false,revisionAction:'manual'});
  await createArticleRevision(duplicate,'initial');
  return duplicate;
}

export async function saveArticle(article: Article, options:{createRevision?:boolean;revisionAction?:ArticleRevisionAction} = {}): Promise<Article> {
  if (!article.title || !article.slug) {
    throw new Error("Article must have a title and a valid slug.");
  }
  const articleDocRef = doc(db, 'articles', article.slug);
  const existingSnap = await getDoc(articleDocRef);
  if(existingSnap.exists() && checkIsAdmin(auth.currentUser?.email) && options.createRevision !== false) { try { await createArticleRevision(normalizeArticleRecord(existingSnap.data(), existingSnap.id), options.revisionAction || 'auto-save'); } catch(e){ console.warn('Revision snapshot failed:',e); } }
  const isNewArticle = !existingSnap.exists();
  const dataToSave = stripUndefinedDeep({
    ...article,
    updatedAt: serverTimestamp(),
    createdAt: (article as any).createdAt || serverTimestamp()
  });
  await setDoc(articleDocRef, dataToSave, { merge: true });
  if (checkIsAdmin(auth.currentUser?.email)) {
    try { await writeAdminAudit(isNewArticle?'created article':'updated article',`articles/${article.slug}`,existingSnap.exists()?existingSnap.data():null,article); } catch (error) { console.warn('OFFSCRPT recoverable operation failed:', error); }
    if (isNewArticle) { try { await createArticleRevision({...article, ...dataToSave} as Article, 'initial'); } catch(e){ console.warn('Initial revision snapshot failed:', e); } }
  }

  // Every registered OFFSCRPT user receives an in-app notification when the admin
  // publishes a genuinely new article. Edits do not generate duplicate alerts.
  if (isNewArticle && checkIsAdmin(auth.currentUser?.email)) {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const recipients = usersSnap.docs.map(d => d.id);
      const actor = article.author;
      for (let i = 0; i < recipients.length; i += 450) {
        const batch = writeBatch(db);
        recipients.slice(i, i + 450).forEach(userId => {
          const notificationRef = doc(collection(db, 'users', userId, 'notifications'));
          batch.set(notificationRef, {
            type: 'article_published',
            actorId: auth.currentUser!.uid,
            actorUsername: actor.username || 'krishsarkar',
            actorName: actor.name || 'Krish Sarkar',
            actorAvatar: actor.avatar || '',
            message: `published a new article: ${article.title}`.slice(0, 200),
            targetType: 'article',
            targetId: article.slug,
            read: false,
            createdAt: serverTimestamp()
          });
        });
        await batch.commit();
      }
    } catch (notificationError) {
      // Publishing must remain successful even if notification fan-out is unavailable.
      console.warn('Article notification fan-out failed:', notificationError);
    }
  }
  return article;
}

async function resolveOriginalCreatorForPromotion(post: CommunityPost) {
  let profile:any = null;
  try { profile = post.authorId ? await getCommunityProfile(post.authorId) : null; } catch (error) { console.warn('OFFSCRPT recoverable operation failed:', error); }
  const username = profile?.username || post.authorUsername || 'creator';
  const name = profile?.displayName || post.authorName || username;
  const avatar = profile?.photoUrl || post.authorAvatar || '';
  return {
    uid: post.authorId,
    username,
    name,
    avatar,
    bio: profile?.bio || '',
    role: profile?.isVerified ? 'Verified Creator' : 'Creator',
    isVerified: !!(profile?.isVerified ?? post.isVerified),
    verificationColor: profile?.verificationColor || post.verificationColor
  };
}

export async function promoteCommunityBlogToMain(post: CommunityPost, collaborateAsEditor = true): Promise<Article> {
  if (!checkIsAdmin(auth.currentUser?.email)) throw new Error('Master admin access required.');
  if (post.type !== 'blog') throw new Error('Only a community blog can be promoted to the main publication.');
  const originalAuthor = await resolveOriginalCreatorForPromotion(post);
  const baseSlug = String(post.title || 'community-blog').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70) || 'community-blog';
  let slug = `community-${baseSlug}`;
  let n = 2;
  const blocks = Array.isArray(post.contentBlocks) && post.contentBlocks.length
    ? post.contentBlocks.map((b:any)=>({...b}))
    : [{type:'paragraph' as const, content:post.content}];
  // Re-publishing an existing source restores the same main article instead of creating duplicates.
  const existingSource = (await getDocs(query(collection(db,'articles'), where('sourcePostId','==',post.id), limit(10)))).docs.find(d => (d.data() as any).sourcePostId === post.id);
  if (existingSource) {
    slug = existingSource.id;
    const existingArticle = existingSource.data() as any;
    const restored = { ...existingArticle, id: existingSource.id, slug: existingSource.id, title: post.title, excerpt: post.excerpt || post.content.slice(0,240), coverImage: post.coverImage || '', coverImageAlt: post.coverImageAlt || post.title, category: post.category || 'Community', tags: Array.isArray(post.tags) ? post.tags : [], content: blocks, author: originalAuthor, originalAuthor, sourcePostId: post.id, sourceCommunityId: (post as any).communityId || undefined, isPublished: true, mainPublicationStatus: 'published', updatedAt: serverTimestamp() };
    await setDoc(existingSource.ref, stripUndefinedDeep(restored), { merge: true });
    try { const sourceRef = (post as any).communityId ? doc(db,'communities',(post as any).communityId,'posts',post.id) : doc(db,'posts',post.id); await updateDoc(sourceRef, { promotedToArticleSlug: slug, mainPublicationStatus: 'published', updatedAt: serverTimestamp() }); } catch (error) { console.warn('OFFSCRPT recoverable operation failed:', error); }
    return { ...existingArticle, id: slug, slug, isPublished: true, mainPublicationStatus: 'published' } as Article;
  }
  while ((await getDoc(doc(db,'articles',slug))).exists()) slug = `community-${baseSlug}-${n++}`;
  const article: Article = {
    id: slug,
    slug,
    title: post.title,
    excerpt: post.excerpt || post.content.slice(0,240),
    coverImage: post.coverImage || '',
    coverImageAlt: post.coverImageAlt || post.title,
    coverImageCaption: post.coverImageCaption,
    category: post.category || 'Community',
    tags: Array.isArray(post.tags) ? post.tags : [],
    publishedAt: new Date().toISOString(),
    readingTimeMinutes: post.readingTimeMinutes || Math.max(1, Math.ceil(post.content.split(/\s+/).filter(Boolean).length/220)),
    featured: true,
    pinned: false,
    origin: 'community_blog',
    isPublished: true,
    mainPublicationStatus: 'published',
    sourcePostId: post.id,
    sourceCommunityId: (post as any).communityId || undefined,
    collaborators: collaborateAsEditor ? [{uid:originalAuthor.uid,username:originalAuthor.username,name:originalAuthor.name,role:'Original Creator'}] : [],
    originalAuthor,
    republishedBy: {uid: auth.currentUser?.uid || '', username: 'krishsarkar', name: 'Krish', avatar: auth.currentUser?.photoURL || DEFAULT_SITE_CONFIG.authorAvatarUrl},
    seriesId: (post as any).seriesId || undefined,
    seriesName: (post as any).seriesName || undefined,
    seriesOrder: (post as any).seriesOrder || undefined,
    editedAt: (post as any).editedAt || undefined,
    author: originalAuthor,
    content: blocks
  } as Article;
  const saved = await saveArticle(article);
  { const sourceRef = (post as any).communityId ? doc(db,'communities',(post as any).communityId,'posts',post.id) : doc(db,'posts',post.id); await updateDoc(sourceRef, { promotedToArticleSlug: saved.slug, promotedAt: serverTimestamp(), promotedBy: auth.currentUser?.uid || '', updatedAt: serverTimestamp() }); }
  return saved;
}

export async function approvePublicBlogEdit(sourcePostId:string, sourceCommunityId?:string, articleSlug?:string): Promise<void> {
  if (!checkIsAdmin(auth.currentUser?.email)) throw new Error('Master admin access required.');
  if(!sourcePostId) throw new Error('Source post is required.');
  let sourceRef = sourceCommunityId ? doc(db,'communities',sourceCommunityId,'posts',sourcePostId) : doc(db,'posts',sourcePostId);
  const sourceSnap = await getDoc(sourceRef);
  if(!sourceSnap.exists()) throw new Error('Original creator post was not found.');
  const source:any = sourceSnap.data();
  const slug = articleSlug || source.promotedToArticleSlug;
  if(!slug) throw new Error('No main publication is linked to this creator blog.');
  const articleRef=doc(db,'articles',slug);
  const articleSnap=await getDoc(articleRef);
  if(!articleSnap.exists()) throw new Error('Main article was not found.');
  const article:any=articleSnap.data();
  const patch:any={
    title:source.title||article.title, excerpt:source.excerpt||article.excerpt, coverImage:source.coverImage||article.coverImage, coverImageAlt:source.coverImageAlt||article.coverImageAlt, coverImageCaption:source.coverImageCaption||article.coverImageCaption, category:source.category||article.category, tags:Array.isArray(source.tags)?source.tags:article.tags, readingTimeMinutes:source.readingTimeMinutes||article.readingTimeMinutes, content:Array.isArray(source.contentBlocks)&&source.contentBlocks.length?source.contentBlocks:article.content, editedAt:source.editedAt||article.editedAt, editReviewStatus:'approved', editReviewedAt:serverTimestamp(), editReviewedBy:auth.currentUser?.uid||'', updatedAt:serverTimestamp()
  };
  await updateDoc(articleRef, stripUndefinedDeep(patch));
  await updateDoc(sourceRef,{editReviewStatus:'approved',editReviewedAt:serverTimestamp(),editReviewedBy:auth.currentUser?.uid||'',updatedAt:serverTimestamp()});
  try {
    if(source.authorId && source.authorId!==auth.currentUser?.uid) {
      await setDoc(doc(db,'users',source.authorId,'notifications',`edit-approval-${slug}-${Date.now()}`),{type:'blog_edit_approved',actorId:auth.currentUser?.uid||'',actorUsername:'krishsarkar',actorName:'Krish',message:`approved your edited blog: ${source.title||article.title}`.slice(0,200),targetType:'article',targetId:slug,read:false,createdAt:serverTimestamp()});
    }
  } catch (error) { console.warn('OFFSCRPT recoverable operation failed:', error); }
}

export async function unpublishMainArticle(article: Article): Promise<void> {
  if (!checkIsAdmin(auth.currentUser?.email)) throw new Error('Master admin access required.');
  if (!article?.slug) throw new Error('Article slug is required.');
  const articleRef = doc(db, 'articles', article.slug);
  const existing = await getDoc(articleRef);
  if (!existing.exists()) throw new Error('Main article was not found in Firebase.');
  await updateDoc(articleRef, {
    isPublished: false,
    mainPublicationStatus: 'unpublished',
    updatedAt: serverTimestamp(),
    unpublishedAt: serverTimestamp(),
    unpublishedBy: auth.currentUser?.uid || ''
  });
  const data = existing.data() as any;
  if (data.sourcePostId) {
    try {
      const sourceRef = data.sourceCommunityId
        ? doc(db, 'communities', data.sourceCommunityId, 'posts', data.sourcePostId)
        : doc(db, 'posts', data.sourcePostId);
      await updateDoc(sourceRef, { mainPublicationStatus: 'unpublished', updatedAt: serverTimestamp() });
    } catch (error) { console.warn('OFFSCRPT recoverable operation failed:', error); }
  }
}

export async function setArticleFeaturedStatus(
  article: Article, 
  isFeatured: boolean, 
  isPinned?: boolean
): Promise<void> {
  if (!article.slug) return;
  const articleDocRef = doc(db, 'articles', article.slug);
  const dataToSave = {
    ...article,
    featured: isFeatured,
    pinned: isPinned !== undefined ? isPinned : isFeatured,
    updatedAt: serverTimestamp(),
  };
  await setDoc(articleDocRef, dataToSave, { merge: true });
}

export async function syncAuthorToAllCloudArticles(author: {
  name: string;
  role: string;
  avatar: string;
  bio?: string;
  uid?: string;
  username?: string;
}): Promise<number> {
  const articlesRef = collection(db, 'articles');
  const snap = await getDocs(articlesRef);
  let updatedCount = 0;
  
  // Update all cloud articles in Firestore
  for (const docSnap of snap.docs) {
    const existing = docSnap.data();
    await setDoc(docSnap.ref, {
      ...existing,
      author: {
        uid: author.uid,
        username: author.username,
        name: author.name || 'Krish',
        role: author.role || 'Founder & Systems Architect',
        avatar: author.avatar || '',
        isVerified: true,
        verificationColor: '#2196F3',
        bio: author.bio || existing.author?.bio || ''
      },
      updatedAt: serverTimestamp()
    }, { merge: true });
    updatedCount++;
  }

  // Also, if Firestore had fewer articles than INITIAL_ARTICLES, seed any missing with the new author info
  for (const initArt of INITIAL_ARTICLES) {
    const docRef = doc(db, 'articles', initArt.slug);
    const existingDoc = await getDoc(docRef);
    if (!existingDoc.exists()) {
      await setDoc(docRef, {
        ...initArt,
        author: {
          uid: author.uid,
          username: author.username,
          name: author.name || 'Krish',
          role: author.role || 'Founder & Systems Architect',
          avatar: author.avatar || '',
          bio: author.bio || initArt.author?.bio || ''
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      updatedCount++;
    }
  }

  return updatedCount;
}

export async function deleteArticle(slug: string): Promise<void> {
  if (!slug) return;
  const before=await getDoc(doc(db,'articles',slug)).catch(()=>null);
  await deleteDoc(doc(db, 'articles', slug));
  if(checkIsAdmin(auth.currentUser?.email)){ try { await writeAdminAudit('deleted article',`articles/${slug}`,before?.exists?before.data():null,null); } catch (error) { console.warn('OFFSCRPT recoverable operation failed:', error); } }
  await setDoc(doc(db, 'deleted_articles', slug), {
    slug,
    deletedAt: serverTimestamp()
  });
}

// ==========================================
// 4. ARTICLE COMMENTS (REAL FIRESTORE)
// ==========================================

export function subscribeArticleComments(
  articleSlug: string, 
  callback: (comments: ArticleComment[]) => void
): () => void {
  const commentsRef = collection(db, 'articles', articleSlug, 'comments');
  const q = query(commentsRef, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const comments = snap.docs.map(d => {
      const data = d.data();
      let createdStr = new Date().toISOString();
      if (data.createdAt instanceof Timestamp) {
        createdStr = data.createdAt.toDate().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      } else if (typeof data.createdAt === 'string') {
        createdStr = data.createdAt;
      }
      return {
        id: d.id,
        articleSlug,
        authorId: data.authorId || '',
        authorName: data.authorName || 'Architect',
        authorAvatar: data.authorAvatar || '',
        authorUsername: data.authorUsername || '',
        content: data.content || '',
        createdAt: createdStr
      } as ArticleComment;
    });
    callback(comments);
  }, (error) => {
    console.warn(`Real-time comments subscription failed for article ${articleSlug}:`, error);
    callback([]);
  });
}

export async function addArticleComment(
  articleSlug: string,
  commentData: {
    authorId: string;
    authorName: string;
    authorAvatar?: string;
    authorUsername?: string;
    isVerified?: boolean;
    verificationColor?: string;
    content: string;
  }
): Promise<ArticleComment> {
  const commentId = `comment-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const commentDocRef = doc(db, 'articles', articleSlug, 'comments', commentId);
  
  await setDoc(commentDocRef, {
    ...commentData,
    articleSlug,
    createdAt: serverTimestamp()
  });

  return {
    id: commentId,
    articleSlug,
    ...commentData,
    createdAt: new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  };
}

export async function deleteArticleComment(articleSlug: string, commentId: string): Promise<void> {
  await deleteDoc(doc(db, 'articles', articleSlug, 'comments', commentId));
}

// ==========================================
// 5. NEWSLETTER SUBSCRIBERS (CLOUD PERSISTENCE)
// ==========================================

export interface NewsletterSubscriber {
  id: string;
  email: string;
  subscribedAt: string;
}

export async function subscribeNewsletter(email: string): Promise<{ status: 'success' | 'already_subscribed'; message: string }> {
  const cleanEmail = email.toLowerCase().trim();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!cleanEmail || !emailRegex.test(cleanEmail)) {
    throw new Error("Please enter a valid email address (e.g., name@domain.com).");
  }

  // Safe document key for email
  const docId = cleanEmail.replace(/[^a-z0-9@._-]/g, '_');
  const subDocRef = doc(db, 'newsletter_subscribers', docId);

  try {
    await setDoc(subDocRef, {
      email: cleanEmail,
      subscribedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      active: true,
      source: 'web_portal'
    });

    return {
      status: 'success',
      message: 'You are successfully subscribed to the architectural dispatches.'
    };
  } catch (error: any) {
    // Subscriber documents are intentionally not publicly readable. A write to
    // an existing deterministic document is denied, which safely indicates an
    // existing subscription without exposing the address or subscriber list.
    if (error?.code === 'permission-denied') {
      return {
        status: 'already_subscribed',
        message: 'This email address is already subscribed to the dispatches.'
      };
    }
    console.error("Failed to persist newsletter subscriber:", error);
    throw new Error(error.message || "Failed to register subscription. Please try again.");
  }
}

export async function adminDeleteCommunityPost(postId: string): Promise<void> {
  if (!auth.currentUser || !checkIsAdmin(auth.currentUser.email)) {
    throw new Error("Unauthorized: Admin privileges required.");
  }
  await deletePost(postId);
}

export async function adminDeleteArticle(slug: string): Promise<void> {
  if (!auth.currentUser || !checkIsAdmin(auth.currentUser.email)) {
    throw new Error("Unauthorized: Admin privileges required.");
  }
  await deleteArticle(slug);
}

export async function getNewsletterSubscribers(): Promise<NewsletterSubscriber[]> {
  try {
    const snap = await getDocs(collection(db, 'newsletter_subscribers'));
    return snap.docs.map((d) => {
      const data = d.data();
      let dateStr = 'Recently';
      if (data.subscribedAt?.toDate) {
        dateStr = data.subscribedAt.toDate().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }
      return {
        id: d.id,
        email: data.email || d.id,
        subscribedAt: dateStr
      };
    });
  } catch (error) {
    console.warn("Could not load newsletter subscribers (admin privileges required):", error);
    return [];
  }
}

