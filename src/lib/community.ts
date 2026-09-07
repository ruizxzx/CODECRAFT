import { db, auth } from './firebase';
import { 
  collection, collectionGroup, doc, setDoc, getDoc, updateDoc, getDocs, query, where, orderBy, deleteDoc, writeBatch, limit, serverTimestamp, onSnapshot, increment, runTransaction
} from 'firebase/firestore';
import { CommunityUser, CommunityPost, CommunityComment, UserSavedItem, BookmarkCollection, CarouselSlide, Notification } from '../types';


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

/** Subscribe to the number of unread notifications for the signed-in user. */
export function subscribeUnreadNotificationCount(userId: string, callback: (count: number) => void): () => void {
  if (!userId) {
    callback(0);
    return () => {};
  }
  const notificationsRef = collection(db, 'users', userId, 'notifications');
  const q = query(notificationsRef, where('read', '==', false));
  return onSnapshot(
    q,
    (snap) => callback(snap.size),
    (error) => {
      console.warn('Unread notification subscription failed:', error);
      callback(0);
    }
  );
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
  return snap.docs.map(d => ({ id: d.id, ...mapDocDates(d.data()) } as Notification));
}

export async function markNotificationsRead(userId: string): Promise<void> {
  const snap = await getDocs(query(collection(db, 'users', userId, 'notifications'), where('read', '==', false), limit(100)));
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { read: true }));
  await batch.commit();
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
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map(d => mapDocDates(d.data()) as CommunityUser)
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
  if (existing) return existing;

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
    role: '',
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

function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export async function createPost(data: Omit<CommunityPost, 'id' | 'createdAt' | 'updatedAt' | 'upvotesCount' | 'downvotesCount' | 'commentsCount' | 'isFeatured'>) {
  const postId = generateId();
  const p = `posts/${postId}`;
  try {
    const now = new Date().toISOString();
    const postData = {
      ...data,
      mentionedUsernames: extractMentions(`${data.title} ${data.content}`),
      hashtags: extractHashtags(`${data.title} ${data.content}`),
      upvotesCount: 0,
      downvotesCount: 0,
      commentsCount: 0,
      repostsCount: 0,
      isFeatured: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(doc(db, 'posts', postId), postData);
    const actor = await getCommunityProfile(auth.currentUser?.uid || data.authorId);
    if (actor) { try { await notifyMentions(data.title + ' ' + data.content, actor, 'post', postId); } catch (e) { console.warn('Post mention notifications failed:', e); } }
    return { ...postData, id: postId, createdAt: now, updatedAt: now } as CommunityPost;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, p);
    throw error;
  }
}

export async function getCarouselSlides(): Promise<CarouselSlide[]> {
  try {
    const q = query(collection(db, 'carousel_slides'), orderBy('order', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as CarouselSlide));
  } catch (error) {
    console.error("Error fetching carousel slides:", error);
    return [];
  }
}

export function subscribeCarouselSlides(callback: (slides: CarouselSlide[]) => void): () => void {
  const q = query(collection(db, 'carousel_slides'), orderBy('order', 'asc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as CarouselSlide)));
  }, (err) => {
    console.warn("Real-time carousel subscription failed:", err);
    callback([]);
  });
}

export async function addCarouselSlide(data: Omit<CarouselSlide, 'id' | 'createdAt' | 'updatedAt'>): Promise<CarouselSlide> {
  const slideId = generateId();
  try {
    const now = new Date().toISOString();
    const slideData = {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(doc(db, 'carousel_slides', slideId), slideData);
    return { ...slideData, id: slideId, createdAt: now, updatedAt: now } as CarouselSlide;
  } catch (error) {
    console.error("Error adding carousel slide:", error);
    throw error;
  }
}

export async function updateCarouselSlide(id: string, data: Partial<CarouselSlide>) {
  try {
    await updateDoc(doc(db, 'carousel_slides', id), { ...data, updatedAt: serverTimestamp() });
  } catch (error) {
    console.error("Error updating carousel slide:", error);
    throw error;
  }
}

export async function deleteCarouselSlide(id: string) {
  try {
    await deleteDoc(doc(db, 'carousel_slides', id));
  } catch (error) {
    console.error("Error deleting carousel slide:", error);
    throw error;
  }
}

export function subscribeCommunityPosts(type: 'discussion' | 'blog' | undefined, callback: (posts: CommunityPost[]) => void): () => void {
  const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    let results = snap.docs.map(d => ({ ...d.data(), id: d.id } as CommunityPost));
    if (type) results = results.filter(r => r.type === type);
    callback(results);
  }, (error) => {
    console.error('Community post realtime subscription failed:', error);
    callback([]);
  });
}

export async function getPosts(type?: 'discussion' | 'blog', username?: string): Promise<CommunityPost[]> {
  const p = `posts`;
  try {
    // Deliberately avoid the type+createdAt composite query here. Community blog
    // posts must work immediately in a fresh Firebase project without requiring
    // a manually-created composite index. Sort/filter the cloud result client-side.
    const snap = await getDocs(query(collection(db, 'posts'), orderBy('createdAt', 'desc')));
    let results = snap.docs.map(d => ({ ...d.data(), id: d.id } as CommunityPost));
    if (type) results = results.filter(r => r.type === type);
    if (username) results = results.filter(r => r.authorUsername === username);
    return results;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, p);
    return [];
  }
}

export async function getUserPosts(userId: string, username?: string): Promise<CommunityPost[]> {
  const cleanUsername = username?.toLowerCase().trim();
  try {
    // Query by authorId first. This is a simple single-field Firestore query
    // and does not require a composite index. If older posts have a stale or
    // missing authorId, also scan the public posts collection and reconcile by
    // the canonical handle so historical content remains visible on profiles.
    const authorSnap = await getDocs(query(collection(db, 'posts'), where('authorId', '==', userId)));
    const byId = new Map<string, CommunityPost>();
    authorSnap.docs.forEach(d => byId.set(d.id, { ...d.data(), id: d.id } as CommunityPost));

    if (cleanUsername) {
      const allSnap = await getDocs(collection(db, 'posts'));
      allSnap.docs.forEach(d => {
        const post = { ...d.data(), id: d.id } as CommunityPost;
        if (post.authorUsername?.toLowerCase() === cleanUsername) byId.set(d.id, post);
      });
    }

    return Array.from(byId.values()).sort((a, b) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  } catch (error) {
    // Last-resort public scan for legacy records. Profile rendering should not
    // silently fail just because an index or query shape is unavailable.
    try {
      const allSnap = await getDocs(collection(db, 'posts'));
      return allSnap.docs
        .map(d => ({ ...d.data(), id: d.id } as CommunityPost))
        .filter(post => post.authorId === userId || (!!cleanUsername && post.authorUsername?.toLowerCase() === cleanUsername))
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    } catch (fallbackError) {
      handleFirestoreError(fallbackError, OperationType.LIST, 'posts');
      return [];
    }
  }
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

export async function updatePost(postId: string, data: Partial<CommunityPost>) {
  const p = `posts/${postId}`;
  try {
    const patch: any = { ...data, editedAt: serverTimestamp(), updatedAt: serverTimestamp() };
    if (typeof data.title === 'string' || typeof data.content === 'string') {
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
        if (target?.authorId) await createNotification(target.authorId, { type: 'comment', actorId: actor.uid, actorUsername: actor.username, actorName: actor.displayName, actorAvatar: actor.photoURL || '', message: 'commented on your post', targetType: 'post', targetId: postId });
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
