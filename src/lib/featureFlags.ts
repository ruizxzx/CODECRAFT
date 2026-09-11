import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { resolveMasterAccess } from './masterControl';

export interface IntelligenceFeatureFlags {
  unifiedSearch: boolean;
  semanticSearch: boolean;
  aiRetrieval: boolean;
  recommendations: boolean;
  personalizedFeed: boolean;
  activityEngine: boolean;
  contentGraph: boolean;
  updatedAt?: unknown;
}

export const DEFAULT_INTELLIGENCE_FLAGS: IntelligenceFeatureFlags = {
  unifiedSearch: true, semanticSearch: false, aiRetrieval: true, recommendations: true, personalizedFeed: true, activityEngine: true, contentGraph: true,
};

export function subscribeIntelligenceFlags(callback: (flags: IntelligenceFeatureFlags) => void) {
  return onSnapshot(doc(db, 'intelligenceConfig', 'global'), snap => callback({ ...DEFAULT_INTELLIGENCE_FLAGS, ...(snap.exists() ? snap.data() as any : {}) }), () => callback(DEFAULT_INTELLIGENCE_FLAGS));
}

export async function setIntelligenceFlags(patch: Partial<IntelligenceFeatureFlags>) {
  const user = auth.currentUser;
  if (!user || !(await resolveMasterAccess(user))) throw new Error('Master admin access required.');
  await setDoc(doc(db, 'intelligenceConfig', 'global'), { ...patch, updatedAt: serverTimestamp(), updatedBy: user.uid }, { merge: true });
}
