import { db, auth, checkIsAdmin } from './firebase';
import { 
  collection, collectionGroup, doc, setDoc, getDoc, updateDoc, getDocs, query, where, orderBy, deleteDoc, writeBatch, limit, serverTimestamp, onSnapshot, increment, runTransaction
} from 'firebase/firestore';
import { CommunityUser, CommunityPost, CommunityComment, UserSavedItem, BookmarkCollection, CarouselSlide, Notification } from '../types';
import { isPlatformModerator } from './social';


function mapDocDates(data: any) {
  if (!data) return data;
  const res = { ...data };
  if (res.createdAt?.toDate) res.createdAt = res.createdAt.toDate().toISOString();
  if (res.updatedAt?.toDate) res.updatedAt = res.updatedAt.toDate().toISOString();
  return res;
}
export enum OperationType {
  CREATE = 'create', UPDATE = 'update', DELETE = 'delete', LIST = 'list', GET = 'get', WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}


function extractMentions(text: string): string[] {
  return Array.from(new Set((text.match(/@[a-zA-Z0-9_]{3,30}/g) || []).map(v => v.slice(1).toLowerCase())));
}

export function extractHashtags(text: string): string[] {
  return Array.from(new Set((text.match(/#[a-zA-Z0-9_]{2,40}/g) || []).map(v => v.slice(1).toLowerCase())));
}

async function createNotification(userId: string, data: Omit<Notification, 'id' | 'createdAt' | 'read'>): Promise<void> {
  if (!userId || userId === data.actorId) return;
  const id = generateId();
  await setDoc(doc(db, 'users', userId, 'notifications', id), { ...data, read: false, createdAt: serverTimestamp() });
}

async function createAdminNotification(data: any): Promise<void> {
  if (!auth.currentUser || !data?.actorId) return;
  try { await setDoc(doc(collection(db, 'admin_notifications')), { ...data, read: false, createdAt: serverTimestamp() }); }
  catch (e) { console.warn('Admin notification creation failed:', e); }
}

/** Subscribe to unread notifications for the signed-in user, including admin moderation alerts. */
export function subscribeUnreadNotificationCount(userId: string, callback: (count: number) => void): () => void {
  if (!userId) { callback(0); return () => {}; }
  let userCount = 0; let adminCount = 0; let active = true;
  const emit = () => callback(userCount + adminCount);
  const unsubUser = onSnapshot(query(collection(db, 'users', userId, 'notifications'), where('read', '==', false)), snap => { userCount = snap.size; emit(); }, err => { console.warn('Unread notification subscription failed:', err); userCount = 0; emit(); });
  let unsubAdmin:()=>void = () => {};
  isPlatformModerator(userId).then(mod => {
    if (!active) return;
    if (checkIsAdmin(auth.currentUser?.email) || mod) {
      unsubAdmin = onSnapshot(query(collection(db, 'admin_notifications'), where('read', '==', false)), snap => { adminCount = snap.size; emit(); }, err => { console.warn('Admin notification subscription failed:', err); adminCount = 0; emit(); });
    }
  }).catch(()=>{});
  return () => { active = false; unsubUser(); unsubAdmin(); };
}

async function notifyMentions(text: string, actor: CommunityUser, targetType: 'post' | 'comment', targetId: string): Promise<void> {
  const handles = extractMentions(text);
  if (!handles.length) return;
  await Promise.all(handles.map(async username => {
    try {
      // Primary lookup uses the canonical username reservation. The users fallback
      // also supports older profiles that predate username reservation documents.
      const usernameSnap = await getDoc(doc(db, 'usernames', username));
      let uid = usernameSnap.exists() ? usernameSnap.data()?.uid : null;
      if (!uid) {
        const userSnap = await getDocs(query(collection(db, 'users'), where('username', '==', username), limit(1)));
        uid = userSnap.empty ? null : userSnap.docs[0].id;
      }
      if (uid) {
        await createNotification(uid, {
          type: 'mention', actorId: actor.uid, actorUsername: actor.username,
          actorName: actor.displayName, actorAvatar: actor.photoURL || '',
          message: `mentioned you in a ${targetType}`, targetType, targetId
        });
      }
    } catch (e) { console.warn('Mention notification failed:', e); }
  }));
}

export async function getUserNotifications(userId: string): Promise<Notification[]> {
  const snap = await getDocs(query(collection(db, 'users', userId, 'notifications'), orderBy('createdAt', 'desc'), limit(100)));
  const items = snap.docs.map(d => ({ id: d.id, ...mapDocDates(d.data()) } as Notification));
  if (checkIsAdmin(auth.currentUser?.email) || await isPlatformModerator(userId)) {
    try {
      const adminSnap = await getDocs(query(collection(db, 'admin_notifications'), orderBy('createdAt', 'desc'), limit(100)));
      const adminItems = adminSnap.docs.map(d => ({ id: `admin:${d.id}`, ...mapDocDates(d.data()) } as Notification));
      return [...items, ...adminItems].sort((a,b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0,100);
    } catch (e) { console.warn('Admin notifications load failed:', e); }
  }
  return items;
}

export async function markNotificationsRead(userId: string): Promise<void> {
  const batch = writeBatch(db);
  const snap = await getDocs(query(collection(db, 'users', userId, 'notifications'), where('read', '==', false), limit(100)));
  snap.docs.forEach(d => batch.update(d.ref, { read: true }));
  if (checkIsAdmin(auth.currentUser?.email) || await isPlatformModerator(userId)) {
    try {
      const adminSnap = await getDocs(query(collection(db, 'admin_notifications'), where('read', '==', false), limit(100)));
      adminSnap.docs.forEach(d => batch.update(d.ref, { read: true }));
    } catch (e) { console.warn('Admin notifications mark-read failed:', e); }
  }
  if (snap.size > 0 || checkIsAdmin(auth.currentUser?.email)) await batch.commit();
}

export async function saveCommunityDraft(userId: string, data: { type: 'discussion' | 'blog'; title: string; content: string; mediaUrls?: string[] }): Promise<void> {
  await setDoc(doc(db, 'users', userId, 'drafts', 'community'), { ...data, updatedAt: serverTimestamp() });
}

export async function getCommunityDraft(userId: string): Promise<{ type: 'discussion' | 'blog'; title: string; content: string; mediaUrls?: string[] } | null> {
  const snap = await getDoc(doc(db, 'users', userId, 'drafts', 'community'));
  return snap.exists() ? snap.data() as any : null;
}

export async function clearCommunityDraft(userId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'drafts', 'community'));
}
export async function getCommunityProfile(uid: string): Promise<CommunityUser | null> {
  const p = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      return mapDocDates(snap.data()) as CommunityUser;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, p);
    return null;
  }
}

export async function getProfileByUsername(username: string): Promise<CommunityUser | null> {
  const p = `users`;
  try {
    const q = query(collection(db, 'users'), where('username', '==', username), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return mapDocDates(snap.docs[0].data()) as CommunityUser;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, p);
    return null;
  }
}

function normalizeUsername(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9_]/g, '').slice(0, 30);
}

async function chooseAvailableUsername(base: string): Promise<string> {
  const cleanBase = normalizeUsername(base) || 'user';
  const root = cleanBase.slice(0, 24) || 'user';
  for (let i = 0; i < 1000; i++) {
    const candidate = i === 0 ? root : `${root}${i}`.slice(0, 30);
    const snap = await getDoc(doc(db, 'usernames', candidate));
    if (!snap.exists()) return candidate;
  }
  return `${root.slice(0, 26)}_${Date.now().toString().slice(-3)}`;
}

/**
 * Returns the cloud profile for a signed-in Google account, creating one
 * automatically when this is the account's first visit. A deterministic
 * available handle is selected from the Google display name/email, so users
 * never have to manually claim a handle just to enter the site.
 */
export async function getAllCommunityUsers(): Promise<CommunityUser[]> {
  try {
    const [snap, modSnap] = await Promise.all([getDocs(collection(db, 'users')), getDocs(collection(db, 'siteModerators')).catch(() => ({docs:[]} as any))]);
    const moderators = new Set((modSnap.docs || []).map((d:any)=>d.id));
    return snap.docs.map(d => { const u:any = mapDocDates(d.data()) as CommunityUser; if (moderators.has(u.uid)) { u.platformRole='moderator'; u.role='Moderator'; } return u; })
      .filter(u => !!u?.username)
      .sort((a, b) => a.username.localeCompare(b.username));
  } catch (error) {
    console.warn('Failed to load community users:', error);
    return [];
  }
}

export async function getAllCommentsForSearch(): Promise<Array<{ id: string; content: string; authorId: string; authorUsername: string; authorName: string; postId?: string; articleSlug?: string; createdAt: string }>> {
  try {
    const snap = await getDocs(collectionGroup(db, 'comments'));
    return snap.docs.map(d => {
      const data: any = d.data();
      const path = d.ref.path.split('/');
      return {
        id: d.id, content: data.content || '', authorId: data.authorId || '',
        authorUsername: data.authorUsername || '', authorName: data.authorName || '',
        postId: path[0] === 'posts' ? path[1] : undefined,
        articleSlug: path[0] === 'articles' ? path[1] : undefined,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString())
      };
    });
  } catch (error) {
    console.warn('Failed to load comments for search:', error);
    return [];
  }
}

export async function ensureCommunityProfileForUser(user: import('firebase/auth').User): Promise<CommunityUser> {
  if (!auth.currentUser || auth.currentUser.uid !== user.uid) throw new Error('Must be logged in');

  const existing = await getCommunityProfile(user.uid);
  if (existing) {
    if (checkIsAdmin(user.email) && existing.platformRole !== 'master_admin') {
      try { await updateDoc(doc(db,'users',user.uid), { platformRole:'master_admin', role:'Master Admin', email:user.email || '', updatedAt:serverTimestamp() }); existing.platformRole='master_admin'; existing.role='Master Admin'; } catch {}
    }
    return existing;
  }

  const emailBase = (user.email || '').split('@')[0] || '';
  const displayBase = user.displayName || emailBase || 'user';
  let username = await chooseAvailableUsername(displayBase);
  const candidates = [username];
  if (emailBase) candidates.push(normalizeUsername(emailBase));
  candidates.push('user');

  for (const base of candidates) {
    if (base) {
      const candidate = await chooseAvailableUsername(base);
      if (candidate) { username = candidate; break; }
    }
  }

  const profile: any = {
    uid: user.uid,
    username,
    displayName: user.displayName || username,
    photoURL: user.photoURL || '',
    bio: 'Software builder & writer',
    themeColor: '#000000',
    role: checkIsAdmin(user.email) ? 'Master Admin' : '',
    platformRole: checkIsAdmin(user.email) ? 'master_admin' : 'member',
    email: user.email || '',
    isAuthor: false,
    isVerified: false,
    verificationColor: '#2196F3',
    followersCount: 0,
    followingCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  // Claim the handle and create the profile atomically. If another client
  // races for the same username, retry with another generated suffix.
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const usernameRef = doc(db, 'usernames', username);
      const userRef = doc(db, 'users', user.uid);
      const created = await runTransaction(db, async (tx) => {
        const [userSnap, usernameSnap] = await Promise.all([tx.get(userRef), tx.get(usernameRef)]);
        if (userSnap.exists()) return userSnap.data() as CommunityUser;
        if (usernameSnap.exists() && usernameSnap.data()?.uid !== user.uid) return null;
        tx.set(usernameRef, { uid: user.uid }, { merge: false });
        tx.set(userRef, profile);
        return null;
      });
      const resolved = created || await getCommunityProfile(user.uid);
      if (resolved) {
        try { await ensureFollowingAuthor(user.uid, resolved.username); } catch (err) { console.warn('Auto-follow author failed:', err); }
        return resolved;
      }
    } catch (error) {
      console.warn('Automatic handle claim retry:', error);
    }
    username = await chooseAvailableUsername(`${normalizeUsername(displayBase).slice(0, 24) || 'user'}${attempt + 1}`);
    profile.username = username;
  }

  throw new Error('Unable to automatically create a unique handle.');
}

export async function createCommunityProfile(data: Omit<CommunityUser, 'createdAt' | 'updatedAt' | 'followersCount' | 'followingCount'>) {
  if (!auth.currentUser) throw new Error("Must be logged in");
  const uid = auth.currentUser.uid;
  const username = normalizeUsername(data.username);
  if (username.length < 3) throw new Error('Username must be at least 3 characters.');

  const usernameRef = doc(db, 'usernames', username);
  const userRef = doc(db, 'users', uid);
  try {
    const profile = await runTransaction(db, async (tx) => {
      const [userSnap, usernameSnap] = await Promise.all([tx.get(userRef), tx.get(usernameRef)]);
      if (userSnap.exists()) return userSnap.data() as CommunityUser;
      if (usernameSnap.exists() && usernameSnap.data()?.uid !== uid) throw new Error('Username is already taken. Please choose another.');
      const userData: any = {
        ...data, uid, username,
        role: data.role || '', isAuthor: !!data.isAuthor, isVerified: !!data.isVerified,
        verificationColor: data.verificationColor || '#2196F3', followersCount: 0, followingCount: 0,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      };
      tx.set(usernameRef, { uid });
      tx.set(userRef, userData);
      return userData as CommunityUser;
    });
    const resolved = await getCommunityProfile(uid) || profile;
    if (username !== 'krishsarkar') {
      try { await ensureFollowingAuthor(uid, username); } catch (err) { console.warn('Failed to auto-follow @krishsarkar:', err); }
    }
    return resolved as CommunityUser;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `users/${uid}`);
    throw error;
  }
}

export async function updateCommunityProfile(uid: string, data: Partial<CommunityUser>) {
  const p = `users/${uid}`;
  try {
    const updatePayload: any = { ...data, updatedAt: serverTimestamp() };
    delete updatePayload.uid;
    delete updatePayload.username;
    delete updatePayload.createdAt;
    await updateDoc(doc(db, 'users', uid), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, p);
  }
}

export async function ensureFollowingAuthor(currentUserId: string, currentUsername?: string): Promise<boolean> {
  const author = await getProfileByUsername('krishsarkar');
  if (!author || author.uid === currentUserId) return false;
  const followingRef = doc(db, 'users', currentUserId, 'following', author.uid);
  const existing = await getDoc(followingRef);
  if (existing.exists()) return false;
  await followUser(currentUserId, author.uid, author.username, currentUsername || '');
  return true;
}

export async function followUser(currentUserId: string, targetUserId: string, targetUsername?: string, currentUsername?: string, _old1?: any, _old2?: any) {
  const batch = writeBatch(db);
  
  // 1. Add targetUserId to currentUserId's following subcollection
  if (targetUsername) {
    batch.set(doc(db, 'users', currentUserId, 'following', targetUserId), {
      uid: targetUserId,
      username: targetUsername,
      createdAt: serverTimestamp()
    });
  } else {
    batch.set(doc(db, 'users', currentUserId, 'following', targetUserId), {
      uid: targetUserId,
      createdAt: serverTimestamp()
    });
  }

  // 2. Add currentUserId to targetUserId's followers subcollection
  if (currentUsername) {
    batch.set(doc(db, 'users', targetUserId, 'followers', currentUserId), {
      uid: currentUserId,
      username: currentUsername,
      createdAt: serverTimestamp()
    });
  } else {
    batch.set(doc(db, 'users', targetUserId, 'followers', currentUserId), {
      uid: currentUserId,
      createdAt: serverTimestamp()
    });
  }

  // 3. Update currentUserId's followingCount atomically
  batch.update(doc(db, 'users', currentUserId), {
    followingCount: increment(1),
    updatedAt: serverTimestamp()
  });

  // 4. Update targetUserId's followersCount atomically
  batch.update(doc(db, 'users', targetUserId), {
    followersCount: increment(1),
    updatedAt: serverTimestamp()
  });

  try {
    await batch.commit();
    try {
      const actor = await getCommunityProfile(currentUserId);
      if (actor) await createNotification(targetUserId, { type: 'follow', actorId: actor.uid, actorUsername: actor.username, actorName: actor.displayName, actorAvatar: actor.photoURL || '', message: 'followed you', targetType: 'profile', targetId: actor.username });
    } catch (notificationError) { console.warn('Follow notification failed:', notificationError); }
    return true;
  } catch (error) {
    console.error("Error following user:", error);
    throw error;
  }
}

export async function unfollowUser(currentUserId: string, targetUserId: string, _old1?: any, _old2?: any) {
  const batch = writeBatch(db);
  
  // 1. Remove targetUserId from currentUserId's following subcollection
  batch.delete(doc(db, 'users', currentUserId, 'following', targetUserId));

  // 2. Remove currentUserId from targetUserId's followers subcollection
  batch.delete(doc(db, 'users', targetUserId, 'followers', currentUserId));

  // 3. Update currentUserId's followingCount atomically
  batch.update(doc(db, 'users', currentUserId), {
    followingCount: increment(-1),
    updatedAt: serverTimestamp()
  });

  // 4. Update targetUserId's followersCount atomically
  batch.update(doc(db, 'users', targetUserId), {
    followersCount: increment(-1),
    updatedAt: serverTimestamp()
  });

  try {
    await batch.commit();
    return true;
  } catch (error) {
    console.error("Error unfollowing user:", error);
    throw error;
  }
}

export async function checkIsFollowing(currentUserId: string, targetUserId: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'users', currentUserId, 'following', targetUserId));
    return snap.exists();
  } catch (error) {
    console.error("Error checking following status:", error);
    return false;
  }
}

function postDedupeKey(data: Partial<CommunityPost>) {
  const raw = `${data.authorId || ''}|${data.type || ''}|${String(data.title || '').trim().toLowerCase()}|${String(data.content || '').trim()}|${Math.floor(Date.now()/600000)}`;
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) { h ^= raw.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
function dedupeLegacyPosts(items: CommunityPost[]) {
  const seen = new Set<string>(); const signatures = new Set<string>();
  return items.filter(p => {
    if (seen.has(p.id)) return false; seen.add(p.id);
    const t = new Date(p.createdAt || 0).getTime();
    const sig = `${p.authorId}|${p.type}|${String(p.title || '').trim().toLowerCase()}|${String(p.content || '').trim()}|${Math.floor(t / 60000)}`;
    if (signatures.has(sig)) return false; signatures.add(sig); return true;
  });
}

function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.filter(v => v !== undefined).map(v => stripUndefined(v)) as unknown as T;
  if (value && typeof value === 'object') {
    if ('_methodName' in (value as any) || String((value as any).constructor?.name || '').includes('FieldValue')) return value;
    const out: any = {};
    Object.entries(value as any).forEach(([k, v]) => { if (v !== undefined) out[k] = stripUndefined(v as any); });
    return out as T;
  }
  return value;
}

export async function createPost(data: Omit<CommunityPost, 'id' | 'createdAt' | 'updatedAt' | 'upvotesCount' | 'downvotesCount' | 'commentsCount' | 'isFeatured'>) {
  if (!auth.currentUser || auth.currentUser.uid !== data.authorId) throw new Error('You must be signed in as the post author.');
  const cleanTitle = String(data.title || '').trim().slice(0, 256);
  const cleanContent = String(data.content || '').trim().slice(0, 100000);
  if (!cleanTitle || !cleanContent) throw new Error('Title and content are required.');
  const dedupeKey = postDedupeKey({ ...data, title: cleanTitle, content: cleanContent });
  try {
    const existingSnap = await getDocs(query(collection(db, 'posts'), where('dedupeKey', '==', dedupeKey), limit(5)));
    const existing = existingSnap.docs.find(d => d.data()?.authorId === data.authorId && d.data()?.type === data.type);
    if (existing) return { ...existing.data(), id: existing.id, _publishStatus: 'existing' } as CommunityPost & { _publishStatus?: string };
    const postId = generateId();
    const p = `posts/${postId}`;
    const now = new Date().toISOString();
    const postData = stripUndefined({
      ...data,
      title: cleanTitle,
      content: cleanContent,
      dedupeKey,
      platformRole: data.platformRole || (checkIsAdmin(auth.currentUser.email) ? 'master_admin' : 'member'),
      mentionedUsernames: extractMentions(`${cleanTitle} ${cleanContent}`),
      hashtags: extractHashtags(`${cleanTitle} ${cleanContent}`),
      upvotesCount: 0,
      downvotesCount: 0,
      commentsCount: 0,
      repostsCount: 0,
      isFeatured: false,
      origin: data.origin || 'community_post',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    await setDoc(doc(db, 'posts', postId), postData);
    const confirmed = await getDoc(doc(db, 'posts', postId));
    if (!confirmed.exists()) throw new Error('Post was not confirmed in the cloud. Please refresh before retrying.');
    const actor = await getCommunityProfile(auth.currentUser.uid);
    if (actor) { try { await notifyMentions(cleanTitle + ' ' + cleanContent, actor, 'post', postId); } catch (e) { console.warn('Post mention notifications failed:', e); } }
    return { ...confirmed.data(), id: confirmed.id, _publishStatus: 'created', createdAt: mapDocDates(confirmed.data()).createdAt || now, updatedAt: mapDocDates(confirmed.data()).updatedAt || now } as CommunityPost & { _publishStatus?: string };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, pForCreatePost(data));
    throw error;
  }
}
function pForCreatePost(data: Partial<CommunityPost>) { return `posts/${data.id || 'new'}`; }

export async function getPosts(type?: 'blog' | 'discussion'): Promise<CommunityPost[]> {
  const path = 'posts';
  try {
    const snap = await getDocs(query(collection(db, 'posts'), limit(500)));
    const items = snap.docs.map(d => ({ id: d.id, ...mapDocDates(d.data()) } as CommunityPost));
    const filtered = type ? items.filter(p => p.type === type) : items;
    return dedupeLegacyPosts(filtered).sort((a, b) => {
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  } catch (error) {
    console.warn('Failed to load legacy posts:', error);
    throw error;
  }
}

export function subscribeCommunityPosts(type: 'blog' | 'discussion' | undefined, callback: (posts: CommunityPost[]) => void): () => void {
  let active = true;
  const q = query(collection(db, 'posts'), limit(500));
  const fallback = async () => {
    try {
      const items = await getPosts(type);
      if (active) callback(items);
    } catch (error) {
      console.warn('Legacy post fallback failed:', error);
      if (active) callback([]);
    }
  };
  const unsub = onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...mapDocDates(d.data()) } as CommunityPost));
    const filtered = type ? items.filter(p => p.type === type) : items;
    if (active) callback(dedupeLegacyPosts(filtered).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
  }, (error) => {
    console.warn('Legacy post realtime subscription failed:', error);
    void fallback();
  });
  return () => { active = false; unsub(); };
}



export async function getCarouselSlides(): Promise<CarouselSlide[]> {
  try {
    const snap = await getDocs(query(collection(db, 'carousel_slides'), orderBy('order', 'asc')));
    return snap.docs.map(d => ({ ...mapDocDates(d.data()), id: d.id } as CarouselSlide));
  } catch (error) {
    console.warn('Failed to load carousel slides:', error);
    return [];
  }
}

export function subscribeCarouselSlides(callback: (slides: CarouselSlide[]) => void): () => void {
  const q = query(collection(db, 'carousel_slides'), orderBy('order', 'asc'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ ...mapDocDates(d.data()), id: d.id } as CarouselSlide)));
  }, error => {
    console.warn('Carousel realtime subscription failed:', error);
    callback([]);
  });
}

export async function addCarouselSlide(data: Omit<CarouselSlide, 'id' | 'createdAt' | 'updatedAt'>): Promise<CarouselSlide> {
  const id = generateId();
  const now = new Date().toISOString();
  await setDoc(doc(db, 'carousel_slides', id), stripUndefined({ ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  const confirmed = await getDoc(doc(db, 'carousel_slides', id));
  if (!confirmed.exists()) throw new Error('Carousel slide was not confirmed in the cloud.');
  return { ...mapDocDates(confirmed.data()), id: confirmed.id, createdAt: now, updatedAt: now } as CarouselSlide;
}

export async function updateCarouselSlide(id: string, data: Partial<CarouselSlide>): Promise<void> {
  await updateDoc(doc(db, 'carousel_slides', id), stripUndefined({ ...data, updatedAt: serverTimestamp() }));
}

export async function deleteCarouselSlide(id: string): Promise<void> {
  await deleteDoc(doc(db, 'carousel_slides', id));
}


export async function getUserPosts(userId: string, username?: string): Promise<CommunityPost[]> {
  const cleanUsername = username?.toLowerCase().trim();
  const byId = new Map<string, CommunityPost & { sourceType?: string; communityId?: string; communitySlug?: string }>();
  try {
    const authorSnap = await getDocs(query(collection(db, 'posts'), where('authorId', '==', userId)));
    authorSnap.docs.forEach(d => byId.set(`root:${d.id}`, { ...mapDocDates(d.data()), id: d.id, sourceType: 'root' } as any));
    if (cleanUsername) {
      const allSnap = await getDocs(query(collection(db, 'posts'), limit(500)));
      allSnap.docs.forEach(d => {
        const post = { ...mapDocDates(d.data()), id: d.id } as CommunityPost;
        if (post.authorUsername?.toLowerCase() === cleanUsername) byId.set(`root:${d.id}`, { ...post, sourceType: 'root' } as any);
      });
    }
  } catch (error) {
    console.warn('Root profile post query failed:', error);
  }
  try {
    const communitiesSnap = await getDocs(query(collection(db, 'communities'), limit(200)));
    const results = await Promise.allSettled(communitiesSnap.docs.map(async cDoc => {
      const postsSnap = await getDocs(query(collection(db, 'communities', cDoc.id, 'posts'), limit(200)));
      return { cDoc, postsSnap };
    }));
    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const { cDoc, postsSnap } = result.value;
      const cData: any = cDoc.data();
      for (const d of postsSnap.docs) {
        const data: any = d.data();
        if (data.authorId !== userId && !(cleanUsername && String(data.authorUsername || '').toLowerCase() === cleanUsername)) continue;
        byId.set(`community:${cDoc.id}:${d.id}`, {
          ...mapDocDates(data), id: d.id, sourceType: 'community', communityId: cDoc.id,
          communitySlug: cData.slug || cDoc.id
        } as any);
      }
    }
  } catch (error) {
    console.warn('Community profile post scan failed:', error);
  }
  return Array.from(byId.values()).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()) as CommunityPost[];
}

export async function getPost(postId: string): Promise<CommunityPost | null> {
  const p = `posts/${postId}`;
  try {
    const snap = await getDoc(doc(db, 'posts', postId));
    if (snap.exists()) {
      return { ...snap.data(), id: snap.id } as CommunityPost;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, p);
    return null;
  }
}

export async function markPostAsMainArticleSource(postId: string, articleSlug: string): Promise<void> {
  await updateDoc(doc(db, 'posts', postId), { promotedToArticleSlug: articleSlug, promotedAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function updatePost(postId: string, data: Partial<CommunityPost>) {
  const p = `posts/${postId}`;
  try {
    // Firestore rejects `undefined` field values. PublicBlogComposer intentionally
    // leaves optional fields unset (for example seriesOrder), so sanitize the
    // complete update payload before calling updateDoc.
    const patch: any = stripUndefined({ ...data, updatedAt: serverTimestamp() });
    const isContentEdit = typeof data.title === 'string' || typeof data.content === 'string';
    if (isContentEdit) patch.editedAt = serverTimestamp();
    if (isContentEdit) {
      const current = await getPost(postId);
      const title = typeof data.title === 'string' ? data.title : (current?.title || '');
      const content = typeof data.content === 'string' ? data.content : (current?.content || '');
      patch.mentionedUsernames = extractMentions(`${title} ${content}`);
      patch.hashtags = extractHashtags(`${title} ${content}`);
    }
    await updateDoc(doc(db, 'posts', postId), patch);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, p);
    throw error;
  }
}

export function subscribeCommunityComments(postId: string, callback: (comments: CommunityComment[]) => void): () => void {
  const q = query(collection(db, 'posts', postId, 'comments'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as CommunityComment)));
  }, (error) => {
    console.error('Community comment realtime subscription failed:', error);
    callback([]);
  });
}

export async function getComments(postId: string): Promise<CommunityComment[]> {
  const p = `posts/${postId}/comments`;
  try {
    const q = query(collection(db, 'posts', postId, 'comments'), orderBy('createdAt', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as CommunityComment));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, p);
    return [];
  }
}

export async function addComment(postId: string, currentCommentsCount: number | any, data: Omit<CommunityComment, 'id' | 'postId' | 'createdAt' | 'updatedAt'>) {
  const commentId = generateId();
  const p = `posts/${postId}/comments/${commentId}`;
  try {
    const now = new Date().toISOString();
    const commentData = {
      ...data,
      postId,
      mentionedUsernames: extractMentions(data.content),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const batch = writeBatch(db);
    batch.set(doc(db, 'posts', postId, 'comments', commentId), commentData);
    
    // Increment commentsCount atomically
    batch.update(doc(db, 'posts', postId), {
      commentsCount: increment(1),
      updatedAt: serverTimestamp()
    });
    
    await batch.commit();
    const actor = await getCommunityProfile(auth.currentUser?.uid || commentData.authorId);
    if (actor) {
      try {
        const target = await getPost(postId);
        if (target?.authorId) await createNotification(target.authorId, { type: commentData.parentId ? 'reply' : 'comment', actorId: actor.uid, actorUsername: actor.username, actorName: actor.displayName, actorAvatar: actor.photoURL || '', message: commentData.parentId ? 'replied to your comment' : 'commented on your post', targetType: 'post', targetId: postId });
        if (commentData.parentId) {
          try { const parent = await getDoc(doc(db, 'posts', postId, 'comments', commentData.parentId)); if (parent.exists()) await createNotification(parent.data().authorId, { type:'reply', actorId:actor.uid, actorUsername:actor.username, actorName:actor.displayName, actorAvatar:actor.photoURL || '', message:'replied to your comment', targetType:'comment', targetId:commentData.parentId }); } catch {}
        }
        await notifyMentions(commentData.content, actor, 'comment', commentId);
      } catch (e) { console.warn('Comment notifications failed:', e); }
    }
    return { ...commentData, id: commentId, createdAt: now, updatedAt: now } as CommunityComment;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, p);
    throw error;
  }
}

export async function toggleClap(postId: string, userId: string, currentClapsCount: number | any, isClapped: boolean) {
  const p = `posts/${postId}/claps/${userId}`;
  try {
    const batch = writeBatch(db);
    
    if (isClapped) {
      // Remove clap atomically
      batch.delete(doc(db, 'posts', postId, 'claps', userId));
      batch.update(doc(db, 'posts', postId), {
        clapsCount: increment(-1),
        updatedAt: serverTimestamp()
      });
    } else {
      // Add clap atomically
      batch.set(doc(db, 'posts', postId, 'claps', userId), {
        postId,
        userId,
        createdAt: serverTimestamp()
      });
      batch.update(doc(db, 'posts', postId), {
        clapsCount: increment(1),
        updatedAt: serverTimestamp()
      });
    }
    
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, p);
    throw error;
  }
}

export async function hasClapped(postId: string, userId: string): Promise<boolean> {
  const p = `posts/${postId}/claps/${userId}`;
  try {
    const snap = await getDoc(doc(db, 'posts', postId, 'claps', userId));
    return snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, p);
    return false;
  }
}

export async function deletePost(postId: string) {
  try {
    const postRef = doc(db, 'posts', postId);
    const commentsSnap = await getDocs(collection(db, 'posts', postId, 'comments'));
    const votesSnap = await getDocs(collection(db, 'posts', postId, 'votes'));
    const clapsSnap = await getDocs(collection(db, 'posts', postId, 'claps'));
    const repostsSnap = await getDocs(collection(db, 'posts', postId, 'reposts'));

    const batch = writeBatch(db);
    commentsSnap.docs.forEach(d => batch.delete(d.ref));
    votesSnap.docs.forEach(d => batch.delete(d.ref));
    clapsSnap.docs.forEach(d => batch.delete(d.ref));
    repostsSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(postRef);

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `posts/${postId}`);
    throw error;
  }
}

export async function deleteComment(postId: string, commentId: string) {
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'posts', postId, 'comments', commentId));
    batch.update(doc(db, 'posts', postId), {
      commentsCount: increment(-1),
      updatedAt: serverTimestamp()
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `posts/${postId}/comments/${commentId}`);
    throw error;
  }
}

export async function setUserVerificationByUsername(usernameInput: string, isVerified: boolean, verificationColor: string): Promise<CommunityUser> {
  const admin = auth.currentUser;
  if (!admin || !admin.email) throw new Error('You must be signed in as an admin.');
  const cleanUsername = usernameInput.replace(/^@/, '').trim().toLowerCase();
  if (!cleanUsername) throw new Error('Enter a valid @handle.');
  const profile = await getProfileByUsername(cleanUsername);
  if (!profile) throw new Error(`No user found for @${cleanUsername}.`);
  const color = /^#[0-9a-fA-F]{6}$/.test(verificationColor) ? verificationColor : '#2196F3';

  // Update the canonical profile first, then denormalized author fields used by
  // feeds/comments/articles so the badge is visible without per-card reads.
  await updateDoc(doc(db, 'users', profile.uid), {
    isVerified,
    verificationColor: color,
    updatedAt: serverTimestamp()
  });

  const writes: Array<{ref: any; data: any}> = [];
  const postsSnap = await getDocs(query(collection(db, 'posts'), where('authorId', '==', profile.uid)));
  postsSnap.docs.forEach(d => writes.push({ref: d.ref, data: {isVerified, verificationColor: color, updatedAt: serverTimestamp()}}));

  // Main articles also denormalize author verification so the badge is shown
  // immediately in article cards, article pages, and search results.
  const articlesSnap = await getDocs(collection(db, 'articles'));
  articlesSnap.docs.forEach(d => {
    const data = d.data();
    const articleAuthor = data.author || {};
    if (articleAuthor.uid === profile.uid || articleAuthor.username?.toLowerCase() === cleanUsername) {
      writes.push({ ref: d.ref, data: {
        author: { ...articleAuthor, isVerified, verificationColor: color },
        updatedAt: serverTimestamp()
      }});
    }
  });
  let commentsSnap;
  try {
    commentsSnap = await getDocs(query(collectionGroup(db, 'comments'), where('authorId', '==', profile.uid)));
  } catch (indexError) {
    console.warn('Comments author index unavailable during verification; using fallback scan:', indexError);
    const allComments = await getDocs(collectionGroup(db, 'comments'));
    commentsSnap = { docs: allComments.docs.filter(d => d.data()?.authorId === profile.uid) } as any;
  }
  commentsSnap.docs.forEach(d => writes.push({ref: d.ref, data: {isVerified, verificationColor: color, updatedAt: serverTimestamp()}}));
  for (let i = 0; i < writes.length; i += 450) {
    const batch = writeBatch(db);
    writes.slice(i, i + 450).forEach(w => batch.update(w.ref, w.data));
    await batch.commit();
  }

  return {...profile, isVerified, verificationColor: color, updatedAt: new Date().toISOString()};
}

export async function getUserVerificationByUsername(usernameInput: string): Promise<Pick<CommunityUser, 'isVerified'|'verificationColor'> | null> {
  const profile = await getProfileByUsername(usernameInput.replace(/^@/, '').trim().toLowerCase());
  if (!profile) return null;
  return { isVerified: !!profile.isVerified, verificationColor: profile.verificationColor || '#2196F3' };
}

export async function blockUser(uid: string, isBlocked: boolean) {
  try {
    await updateDoc(doc(db, 'users', uid), { isBlocked });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    throw error;
  }
}

export async function toggleVote(postId: string, userId: string, currentUpvotes: number, currentDownvotes: number, voteType: 'up' | 'down', currentVote: 'up' | 'down' | null) {
  const p = `posts/${postId}/votes/${userId}`;
  try {
    const batch = writeBatch(db);
    const voteRef = doc(db, 'posts', postId, 'votes', userId);
    const upvoteRef = doc(db, 'users', userId, 'upvotes', postId);
    if (currentVote === voteType) {
      batch.delete(voteRef);
      if (voteType === 'up') batch.update(doc(db, 'posts', postId), { upvotesCount: increment(-1), updatedAt: serverTimestamp() });
      else batch.update(doc(db, 'posts', postId), { downvotesCount: increment(-1), updatedAt: serverTimestamp() });
      if (voteType === 'up') batch.delete(upvoteRef);
    } else {
      batch.set(voteRef, { postId, userId, type: voteType, createdAt: serverTimestamp() });
      if (voteType === 'up') {
        batch.set(upvoteRef, { postId, createdAt: serverTimestamp() });
        batch.update(doc(db, 'posts', postId), { upvotesCount: increment(1), ...(currentVote === 'down' ? { downvotesCount: increment(-1) } : {}), updatedAt: serverTimestamp() });
      } else {
        if (currentVote === 'up') batch.delete(upvoteRef);
        batch.update(doc(db, 'posts', postId), { downvotesCount: increment(1), ...(currentVote === 'up' ? { upvotesCount: increment(-1) } : {}), updatedAt: serverTimestamp() });
      }
    }
    await batch.commit();
    if (voteType === 'up' && currentVote !== 'up') {
      try {
        const post = await getPost(postId);
        const actor = await getCommunityProfile(userId);
        if (post && actor) await createNotification(post.authorId, { type: 'upvote', actorId: actor.uid, actorUsername: actor.username, actorName: actor.displayName, actorAvatar: actor.photoURL || '', message: 'upvoted your post', targetType: 'post', targetId: postId });
      } catch (notificationError) { console.warn('Upvote notification failed:', notificationError); }
    }
    return {
      upvotesCount: Math.max(0, currentUpvotes + (currentVote === 'up' ? -1 : voteType === 'up' ? 1 : 0)),
      downvotesCount: Math.max(0, currentDownvotes + (currentVote === 'down' ? -1 : voteType === 'down' ? 1 : 0)),
      vote: currentVote === voteType ? null : voteType
    };
  } catch (error) { handleFirestoreError(error, OperationType.WRITE, p); throw error; }
}

export async function getUserVote(postId: string, userId: string): Promise<'up' | 'down' | null> {
  const p = `posts/${postId}/votes/${userId}`;
  try {
    const snap = await getDoc(doc(db, 'posts', postId, 'votes', userId));
    if (snap.exists()) {
      return snap.data().type as 'up' | 'down';
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, p);
    return null;
  }
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const clean = username.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');
  if (!clean || clean.length < 3 || clean.length > 32) return false;
  try {
    const snap = await getDoc(doc(db, 'usernames', clean));
    return !snap.exists();
  } catch (error) {
    console.error("Error checking username availability:", error);
    return false;
  }
}

export interface ProfileListEntry {
  uid: string;
  username: string;
  displayName: string;
  photoURL: string;
  isVerified?: boolean;
  verificationColor?: string;
}

async function getProfileList(userId: string, relation: 'followers' | 'following'): Promise<ProfileListEntry[]> {
  const snap = await getDocs(collection(db, 'users', userId, relation));
  const entries = await Promise.all(snap.docs.map(async (d) => {
    const data = d.data() as any;
    const targetUid = data.uid || d.id;
    const profile = await getCommunityProfile(targetUid);
    if (profile) {
      return {
        uid: profile.uid,
        username: profile.username,
        displayName: profile.displayName,
        photoURL: profile.photoURL || '',
        isVerified: !!profile.isVerified,
        verificationColor: profile.verificationColor || '#2196F3'
      };
    }
    return {
      uid: targetUid,
      username: data.username || targetUid,
      displayName: data.displayName || data.username || targetUid,
      photoURL: data.photoURL || '',
      isVerified: !!data.isVerified,
      verificationColor: data.verificationColor || '#2196F3'
    };
  }));
  return entries.sort((a, b) => a.username.localeCompare(b.username));
}

export async function getUserFollowers(userId: string): Promise<ProfileListEntry[]> {
  return getProfileList(userId, 'followers');
}

export async function getUserFollowing(userId: string): Promise<ProfileListEntry[]> {
  return getProfileList(userId, 'following');
}

export async function getUserUpvotedPosts(userId: string): Promise<CommunityPost[]> {
  const snap = await getDocs(query(collection(db, 'users', userId, 'upvotes'), orderBy('createdAt', 'desc')));
  const posts = await Promise.all(snap.docs.map(d => getPost(d.id)));
  return posts.filter(Boolean) as CommunityPost[];
}

export async function getUserRepostedPosts(userId: string): Promise<CommunityPost[]> {
  const snap = await getDocs(query(collection(db, 'users', userId, 'reposts'), orderBy('createdAt', 'desc')));
  const posts = await Promise.all(snap.docs.map(d => getPost(d.id)));
  return posts.filter(Boolean) as CommunityPost[];
}

export async function syncUserIdentityAcrossContent(userId: string, profile: Pick<CommunityUser, 'displayName' | 'photoURL' | 'username' | 'isVerified' | 'verificationColor'>): Promise<void> {
  const writes: Array<{ ref: any; data: any }> = [];
  const postsSnap = await getDocs(query(collection(db, 'posts'), where('authorId', '==', userId)));
  postsSnap.docs.forEach(d => writes.push({ ref: d.ref, data: { authorName: profile.displayName, authorAvatar: profile.photoURL || '', authorUsername: profile.username, isVerified: !!profile.isVerified, verificationColor: profile.verificationColor || '#2196F3', updatedAt: serverTimestamp() } }));
  let commentsSnap;
  try {
    commentsSnap = await getDocs(query(collectionGroup(db, 'comments'), where('authorId', '==', userId)));
  } catch (indexError) {
    console.warn('Comments author index unavailable during identity sync; using fallback scan:', indexError);
    const allComments = await getDocs(collectionGroup(db, 'comments'));
    commentsSnap = { docs: allComments.docs.filter(d => d.data()?.authorId === userId) } as any;
  }
  commentsSnap.docs.forEach(d => writes.push({ ref: d.ref, data: { authorName: profile.displayName, authorAvatar: profile.photoURL || '', authorUsername: profile.username, isVerified: !!profile.isVerified, verificationColor: profile.verificationColor || '#2196F3', updatedAt: serverTimestamp() } }));
  for (let i = 0; i < writes.length; i += 450) {
    const batch = writeBatch(db);
    writes.slice(i, i + 450).forEach(w => batch.update(w.ref, w.data));
    await batch.commit();
  }
}

export async function getUserComments(userId: string): Promise<Array<{ id: string; content: string; createdAt: string; postId?: string; articleSlug?: string; authorName: string }>> {
  let snap;
  try {
    snap = await getDocs(query(collectionGroup(db, 'comments'), where('authorId', '==', userId)));
  } catch (indexError) {
    console.warn('Comments author index unavailable for profile; using fallback scan:', indexError);
    const allComments = await getDocs(collectionGroup(db, 'comments'));
    snap = { docs: allComments.docs.filter(d => d.data()?.authorId === userId) } as any;
  }
  return snap.docs.map(d => {
    const data = d.data();
    const path = d.ref.path.split('/');
    const postId = path[0] === 'posts' ? path[1] : undefined;
    const articleSlug = path[0] === 'articles' ? path[1] : undefined;
    return { id: d.id, content: data.content || '', createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString()), postId, articleSlug, authorName: data.authorName || 'Architect' };
  }).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function toggleRepost(postId: string, userId: string, isReposted: boolean): Promise<boolean> {
  const batch = writeBatch(db);
  const repostRef = doc(db, 'users', userId, 'reposts', postId);
  const reverseRef = doc(db, 'posts', postId, 'reposts', userId);
  if (isReposted) {
    batch.delete(repostRef); batch.delete(reverseRef);
    batch.update(doc(db, 'posts', postId), { repostsCount: increment(-1), updatedAt: serverTimestamp() });
  } else {
    const post = await getPost(postId);
    if (!post) throw new Error('Post no longer exists.');
    batch.set(repostRef, { postId, title: post.title, authorId: post.authorId, authorUsername: post.authorUsername, createdAt: serverTimestamp() });
    batch.set(reverseRef, { userId, createdAt: serverTimestamp() });
    batch.update(doc(db, 'posts', postId), { repostsCount: increment(1), updatedAt: serverTimestamp() });
  }
  await batch.commit();
  if (!isReposted) {
    try {
      const actor = await getCommunityProfile(userId);
      const target = await getPost(postId);
      if (actor && target) await createNotification(target.authorId, { type: 'repost', actorId: actor.uid, actorUsername: actor.username, actorName: actor.displayName, actorAvatar: actor.photoURL || '', message: 'reposted your post', targetType: 'post', targetId: postId });
    } catch (e) { console.warn('Repost notification failed:', e); }
  }
  return !isReposted;
}

export async function quoteRepost(postId: string, user: CommunityUser, quoteText: string): Promise<CommunityPost> {
  const original = await getPost(postId);
  if (!original) throw new Error('Original post no longer exists.');
  const text = quoteText.trim();
  if (!text) throw new Error('Add a comment before publishing the quote.');

  // Publishing the quote is the primary operation. Repost bookkeeping is
  // intentionally best-effort so a stale/older Firestore rule cannot prevent
  // the quote itself from being published.
  const created = await createPost({
    type: original.type, title: original.title, content: original.content,
    authorId: user.uid, authorUsername: user.username, authorName: user.displayName,
    authorAvatar: user.photoURL || '', isVerified: !!user.isVerified,
    verificationColor: user.verificationColor || '#2196F3',
    mediaUrls: original.mediaUrls || [], hashtags: original.hashtags || [],
    quoteText: text, quotedPostId: postId
  });

  try {
    await toggleRepost(postId, user.uid, false);
  } catch (e) {
    console.warn('Quote published but repost bookkeeping failed:', e);
  }
  return created;
}

export async function getUserRepostStatus(postId: string, userId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'users', userId, 'reposts', postId));
  return snap.exists();
}

export async function getUserSaves(userId: string): Promise<UserSavedItem[]> {
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'saves'));
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        itemId: data.itemId,
        itemType: data.itemType,
        title: data.title,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString()),
        collectionId: data.collectionId || undefined,
        collectionName: data.collectionName || undefined
      };
    });
  } catch (error) {
    console.warn("Could not fetch user saves from Firestore:", error);
    return [];
  }
}

export interface ReadingProgress {
  articleSlug: string;
  articleTitle: string;
}

/** Stores one private, per-account resume point. */
export async function saveReadingProgress(userId: string, article: { slug: string; title: string }): Promise<void> {
  await setDoc(doc(db, 'reading_progress', userId), {
    articleSlug: article.slug,
    articleTitle: article.title,
    updatedAt: serverTimestamp(),
  });
}

export async function getReadingProgress(userId: string): Promise<ReadingProgress | null> {
  const snapshot = await getDoc(doc(db, 'reading_progress', userId));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return typeof data.articleSlug === 'string' && typeof data.articleTitle === 'string'
    ? { articleSlug: data.articleSlug, articleTitle: data.articleTitle }
    : null;
}

export async function toggleUserSaveInCloud(
  userId: string,
  itemId: string,
  itemType: 'article' | 'post',
  isCurrentlySaved: boolean,
  title?: string,
  collectionId?: string,
  collectionName?: string
): Promise<boolean> {
  const saveId = `${itemType}_${itemId}`;
  const saveRef = doc(db, 'users', userId, 'saves', saveId);
  try {
    if (isCurrentlySaved) {
      await deleteDoc(saveRef);
      return false;
    } else {
      await setDoc(saveRef, {
        itemId,
        itemType,
        title: title || '',
        collectionId: collectionId || 'general',
        collectionName: collectionName || 'General',
        createdAt: serverTimestamp()
      });
      return true;
    }
  } catch (error) {
    console.error("Error toggling save in cloud:", error);
    throw error;
  }
}

export async function getBookmarkCollections(userId: string): Promise<BookmarkCollection[]> {
  const snap = await getDocs(collection(db, 'users', userId, 'collections'));
  return snap.docs.map(d => ({ id: d.id, ...mapDocDates(d.data()) } as BookmarkCollection))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export async function createBookmarkCollection(userId: string, name: string, description = ''): Promise<BookmarkCollection> {
  const clean = name.trim().slice(0, 50);
  if (!clean) throw new Error('Collection name is required.');
  const id = generateId();
  const now = new Date().toISOString();
  await setDoc(doc(db, 'users', userId, 'collections', id), {
    name: clean, description: description.trim().slice(0, 160), createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
  return { id, name: clean, description: description.trim().slice(0, 160), createdAt: now, updatedAt: now };
}

export async function updateSavedItemCollection(userId: string, itemId: string, itemType: 'article' | 'post', collectionId: string, collectionName: string): Promise<void> {
  const saveId = `${itemType}_${itemId}`;
  await updateDoc(doc(db, 'users', userId, 'saves', saveId), { collectionId, collectionName });
}

export async function deleteBookmarkCollection(userId: string, collectionId: string): Promise<void> {
  if (collectionId === 'general') return;
  const saves = await getDocs(query(collection(db, 'users', userId, 'saves'), where('collectionId', '==', collectionId)));
  const batch = writeBatch(db);
  saves.docs.forEach(d => batch.update(d.ref, { collectionId: 'general', collectionName: 'General' }));
  batch.delete(doc(db, 'users', userId, 'collections', collectionId));
  await batch.commit();
}

export async function getArticleLikeStatus(slug: string, userId: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'articleLikes', slug, 'likes', userId));
    return snap.exists();
  } catch (error) {
    console.warn("Error checking article like status:", error);
    return false;
  }
}

export async function toggleArticleLike(slug: string, userId: string, isCurrentlyLiked: boolean): Promise<boolean> {
  const likeRef = doc(db, 'articleLikes', slug, 'likes', userId);
  try {
    if (isCurrentlyLiked) {
      await deleteDoc(likeRef);
      return false;
    } else {
      await setDoc(likeRef, {
        slug,
        userId,
        createdAt: serverTimestamp()
      });
      return true;
    }
  } catch (error) {
    console.error("Error toggling article like:", error);
    throw error;
  }
}
