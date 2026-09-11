import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

export interface CanonicalIdentity {
  uid: string;
  username: string;
  displayName: string;
  photoURL: string;
  bio: string;
  isVerified: boolean;
  verificationColor?: string;
  creatorStatus?: boolean;
  roles: string[];
  accountStatus: 'active' | 'blocked' | 'suspended' | 'deleted';
}

const safeString = (value: unknown) => String(value ?? '').trim();

export async function resolveCanonicalIdentity(uid: string, fallback: Partial<CanonicalIdentity> = {}): Promise<CanonicalIdentity | null> {
  const id = safeString(uid);
  if (!id) return null;
  try {
    const snap = await getDoc(doc(db, 'users', id));
    if (!snap.exists()) return fallback.username || fallback.displayName ? {
      uid: id, username: safeString(fallback.username), displayName: safeString(fallback.displayName || fallback.username || 'User'), photoURL: safeString(fallback.photoURL), bio: safeString(fallback.bio), isVerified: !!fallback.isVerified, verificationColor: safeString(fallback.verificationColor) || undefined, creatorStatus: !!fallback.creatorStatus, roles: Array.isArray(fallback.roles) ? fallback.roles.map(String) : [], accountStatus: 'deleted',
    } : null;
    const d = snap.data() as any;
    return {
      uid: id,
      username: safeString(d.username || fallback.username),
      displayName: safeString(d.displayName || fallback.displayName || d.username || 'User'),
      photoURL: safeString(d.photoURL || fallback.photoURL),
      bio: safeString(d.bio || fallback.bio),
      isVerified: Boolean(d.isVerified ?? fallback.isVerified),
      verificationColor: safeString(d.verificationColor || fallback.verificationColor) || undefined,
      creatorStatus: Boolean(d.isAuthor || d.creatorStatus || fallback.creatorStatus),
      roles: Array.from(new Set([...(Array.isArray(fallback.roles) ? fallback.roles.map(String) : []), safeString(d.platformRole), safeString(d.role)].filter(Boolean))),
      accountStatus: d.isBlocked ? 'blocked' : d.isSuspended ? 'suspended' : 'active',
    };
  } catch (error) {
    console.warn('Canonical identity resolution failed:', error);
    return fallback.username || fallback.displayName ? {
      uid: id, username: safeString(fallback.username), displayName: safeString(fallback.displayName || fallback.username || 'User'), photoURL: safeString(fallback.photoURL), bio: safeString(fallback.bio), isVerified: !!fallback.isVerified, verificationColor: safeString(fallback.verificationColor) || undefined, creatorStatus: !!fallback.creatorStatus, roles: Array.isArray(fallback.roles) ? fallback.roles.map(String) : [], accountStatus: 'active',
    } : null;
  }
}

export async function resolveCurrentIdentity(fallback: Partial<CanonicalIdentity> = {}) {
  return auth.currentUser ? resolveCanonicalIdentity(auth.currentUser.uid, fallback) : null;
}
