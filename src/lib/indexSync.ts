import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { ContentType } from './intelligence/types';

export type IndexSyncOperation = 'create' | 'update' | 'delete' | 'publish' | 'unpublish' | 'visibility_change';

export async function enqueueIndexSync(input: { operation: IndexSyncOperation; contentId: string; contentType: ContentType; path?: string; revision?: string; reason?: string }) {
  const uid = auth.currentUser?.uid;
  if (!uid || !input.contentId) return undefined;
  return addDoc(collection(db, 'users', uid, 'indexSyncQueue'), {
    ...input,
    contentId: String(input.contentId).slice(0, 256),
    path: String(input.path || '').slice(0, 500),
    revision: String(input.revision || '').slice(0, 128),
    reason: String(input.reason || '').slice(0, 200),
    status: 'pending', attempts: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), schemaVersion: 1,
  });
}
