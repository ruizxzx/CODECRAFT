import { db, auth } from './firebase';
import { 
  collection, doc, setDoc, getDoc, updateDoc, getDocs, query, where, orderBy, deleteDoc, writeBatch, limit, serverTimestamp, onSnapshot, increment
} from 'firebase/firestore';
import { CommunityUser, CommunityPost, CommunityComment, UserSavedItem, CarouselSlide } from '../types';


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

export async function createCommunityProfile(data: Omit<CommunityUser, 'createdAt' | 'updatedAt' | 'followersCount' | 'followingCount'>) {
  if (!auth.currentUser) throw new Error("Must be logged in");
  const uid = auth.currentUser.uid;
  const username = data.username.toLowerCase().trim();
  const now = new Date().toISOString(); 
  
  const usernameRef = doc(db, 'usernames', username);
  const usernameSnap = await getDoc(usernameRef);
  if (usernameSnap.exists()) {
    throw new Error("Username is already taken. Please choose another.");
  }

  const batch = writeBatch(db);
  batch.set(usernameRef, { uid });

  const userRef = doc(db, 'users', uid);
  const userData = { ...data, username, followersCount: 0, followingCount: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  batch.set(userRef, userData);

  try {
    await batch.commit();
    
    // Auto-follow krishsarkar logic for new accounts
    if (username !== 'krishsarkar') {
      try {
        const krishProfile = await getProfileByUsername('krishsarkar');
        if (krishProfile) {
           await followUser(
             uid, 
             krishProfile.uid, 
             krishProfile.username, 
             username
           );
        }
      } catch (err) {
        console.warn("Failed to auto-follow krishsarkar:", err);
      }
    }

    return { ...data, username, followersCount: 0, followingCount: 0, createdAt: now, updatedAt: now } as CommunityUser;
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
      upvotesCount: 0,
      downvotesCount: 0,
      commentsCount: 0,
      isFeatured: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(doc(db, 'posts', postId), postData);
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

export async function getPosts(type?: 'discussion' | 'blog', username?: string): Promise<CommunityPost[]> {
  const p = `posts`;
  try {
    let q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    if (type) {
      q = query(collection(db, 'posts'), where('type', '==', type), orderBy('createdAt', 'desc'));
    }
    const snap = await getDocs(q);
    let results = snap.docs.map(d => ({ ...d.data(), id: d.id } as CommunityPost));
    if (username) {
      results = results.filter(r => r.authorUsername === username);
    }
    return results;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, p);
    return [];
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
    await updateDoc(doc(db, 'posts', postId), { ...data, updatedAt: serverTimestamp() });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, p);
    throw error;
  }
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

    const batch = writeBatch(db);
    commentsSnap.docs.forEach(d => batch.delete(d.ref));
    votesSnap.docs.forEach(d => batch.delete(d.ref));
    clapsSnap.docs.forEach(d => batch.delete(d.ref));
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
    
    let newUp = currentUpvotes;
    let newDown = currentDownvotes;

    if (currentVote === voteType) {
      // Remove vote
      batch.delete(doc(db, 'posts', postId, 'votes', userId));
      if (voteType === 'up') newUp = Math.max(0, currentUpvotes - 1);
      if (voteType === 'down') newDown = Math.max(0, currentDownvotes - 1);
    } else {
      // Add or change vote
      batch.set(doc(db, 'posts', postId, 'votes', userId), {
        postId,
        userId,
        type: voteType,
        createdAt: serverTimestamp()
      });
      if (voteType === 'up') {
        newUp = currentUpvotes + 1;
        if (currentVote === 'down') newDown = Math.max(0, currentDownvotes - 1);
      } else {
        newDown = currentDownvotes + 1;
        if (currentVote === 'up') newUp = Math.max(0, currentUpvotes - 1);
      }
    }
    
    batch.update(doc(db, 'posts', postId), {
      upvotesCount: newUp,
      downvotesCount: newDown,
      updatedAt: serverTimestamp()
    });
    
    await batch.commit();
    return { upvotesCount: newUp, downvotesCount: newDown, vote: currentVote === voteType ? null : voteType };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, p);
    throw error;
  }
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
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString())
      };
    });
  } catch (error) {
    console.warn("Could not fetch user saves from Firestore:", error);
    return [];
  }
}

export async function toggleUserSaveInCloud(
  userId: string,
  itemId: string,
  itemType: 'article' | 'post',
  isCurrentlySaved: boolean,
  title?: string
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
        createdAt: serverTimestamp()
      });
      return true;
    }
  } catch (error) {
    console.error("Error toggling save in cloud:", error);
    throw error;
  }
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

