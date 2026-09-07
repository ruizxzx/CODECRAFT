import { 
  collection, 
  collectionGroup,
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where,
  orderBy, 
  serverTimestamp,
  Timestamp,
  writeBatch 
} from 'firebase/firestore';
import { db, auth, checkIsAdmin } from './firebase';
import { deletePost } from './community';
import { Article, SiteConfig, BentoLink, ArticleComment } from '../types';
import { INITIAL_ARTICLES } from '../data/articles';

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
  aboutMeBio: "I am a software engineer and systems architect specializing in high-performance web applications and distributed systems.\n\nOver the past decade, I have built infrastructure that scales to millions of users, designed resilient microservices, and obsessed over web performance metrics.",
  themePrimaryColor: "#FFD600",
  themeSecondaryColor: "#00E0FF",
  themeAccentColor: "#FF60B5",
  themeSuccessColor: "#00FF41",
  footerNewsletterTitle: "RECEIVE DEEP TECHNICAL ESSAYS IN YOUR INBOX",
  footerNewsletterSubtitle: "Zero spam. Zero generic marketing. Only in-depth software architectural breakdowns, local AI research, and production post-mortems.",
  footerBrandStatement: "An independent technology publication engineered by Krish. Fusing Neo-Brutalism, Gumroad minimalism, and Medium-grade editorial craft for software builders worldwide.",
  contactTitle: "SECURE COMM CHANNEL",
  contactSubtitle: "For architectural consulting, secure protocol design, or technical inquiries.",
  contactEmail: "hello@krishficient.dev",
  contactTwitter: "@krishficient",
  contactGithub: "krishficient",
  contactTelegram: "@krishficient",
  customCategories: [],
  authorProfileUid: '',
  authorProfileUsername: 'krishsarkar'
};

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
  await setDoc(configDocRef, {
    ...config,
    updatedAt: serverTimestamp()
  }, { merge: true });
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
    // ignore if rules or network issues
  }
  return deletedSet;
}

function mergeArticlesWithInitial(cloudArticles: Article[], deletedSlugs: Set<string>): Article[] {
  const cloudSlugs = new Set(cloudArticles.map(a => a.slug));
  const fallbackOnly = INITIAL_ARTICLES.filter(a => !cloudSlugs.has(a.slug) && !deletedSlugs.has(a.slug));
  return [...cloudArticles, ...fallbackOnly];
}

export function subscribeArticles(callback: (articles: Article[]) => void): () => void {
  const articlesRef = collection(db, 'articles');
  return onSnapshot(articlesRef, async (snap) => {
    const deletedSlugs = await getDeletedSlugs();
    if (!snap.empty) {
      const cloudArticles = snap.docs.map(d => {
        const data = d.data();
        return {
          ...data,
          id: data.id || d.id,
          slug: data.slug || d.id
        } as Article;
      }).filter(a => !deletedSlugs.has(a.slug));
      // Sort by publishedAt desc
      cloudArticles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
      callback(mergeArticlesWithInitial(cloudArticles, deletedSlugs));
    } else {
      const fallback = INITIAL_ARTICLES.filter(a => !deletedSlugs.has(a.slug));
      callback(fallback);
    }
  }, (err) => {
    console.warn("Real-time articles subscription failed, using local archive:", err);
    callback(INITIAL_ARTICLES);
  });
}

export async function fetchArticles(): Promise<{ articles: Article[]; source: 'firestore' | 'fallback' }> {
  try {
    const deletedSlugs = await getDeletedSlugs();
    const snap = await getDocs(collection(db, 'articles'));
    if (!snap.empty) {
      const cloudArticles = snap.docs.map(d => {
        const data = d.data();
        return {
          ...data,
          id: data.id || d.id,
          slug: data.slug || d.id
        } as Article;
      }).filter(a => !deletedSlugs.has(a.slug));
      cloudArticles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
      return {
        articles: mergeArticlesWithInitial(cloudArticles, deletedSlugs),
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

export async function saveArticle(article: Article): Promise<Article> {
  if (!article.title || !article.slug) {
    throw new Error("Article must have a title and a valid slug.");
  }
  const articleDocRef = doc(db, 'articles', article.slug);
  const dataToSave = {
    ...article,
    updatedAt: serverTimestamp(),
    createdAt: (article as any).createdAt || serverTimestamp()
  };
  await setDoc(articleDocRef, dataToSave, { merge: true });
  return article;
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
  await deleteDoc(doc(db, 'articles', slug));
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

