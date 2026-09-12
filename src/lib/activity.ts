import { addDoc, collection, onSnapshot, serverTimestamp, doc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { DEFAULT_INTELLIGENCE_FLAGS } from './featureFlags';

let activityEngineEnabled = DEFAULT_INTELLIGENCE_FLAGS.activityEngine;
onSnapshot(doc(db, 'intelligenceConfig', 'global'), snap => { activityEngineEnabled = snap.exists() ? (snap.data()?.activityEngine !== false) : DEFAULT_INTELLIGENCE_FLAGS.activityEngine; }, () => { activityEngineEnabled = DEFAULT_INTELLIGENCE_FLAGS.activityEngine; });

export type ActivityEventType =
  | 'content_view' | 'content_open' | 'content_start' | 'content_progress' | 'content_complete' | 'content_exit'
  | 'like' | 'unlike' | 'save' | 'unsave' | 'share' | 'copy' | 'follow' | 'unfollow'
  | 'discussion_open' | 'discussion_create' | 'discussion_reply' | 'discussion_quote' | 'discussion_remix' | 'discussion_reaction'
  | 'question_open' | 'question_create' | 'answer_create' | 'answer_accept' | 'answer_reaction'
  | 'search' | 'search_result_click' | 'recommendation_impression' | 'recommendation_click'
  | 'community_view' | 'community_join' | 'community_leave' | 'community_post'
  | 'marketplace_view' | 'marketplace_search' | 'marketplace_filter' | 'product_impression' | 'product_open' | 'product_gallery_open' | 'product_gallery_next' | 'product_save' | 'product_unsave' | 'creator_store_open' | 'category_open' | 'related_product_open';

export interface ActivityEventInput {
  type: ActivityEventType;
  targetId?: string;
  targetType?: string;
  sessionId?: string;
  source?: string;
  metadata?: Record<string, unknown>;
  timestamp?: unknown;
}

const clean = (value: unknown, max = 500) => String(value ?? '').slice(0, max);

export async function emitActivityEvent(input: ActivityEventInput): Promise<string | undefined> {
  const user = auth.currentUser;
  if (!user || !activityEngineEnabled) return undefined;
  let metadata: Record<string, unknown> = {};
  if (input.metadata) { try { const serialized = JSON.stringify(input.metadata); metadata = serialized.length <= 6000 ? JSON.parse(serialized) : { summary: serialized.slice(0, 5900) }; } catch { metadata = {}; } }
  const ref = await addDoc(collection(db, 'users', user.uid, 'activityEvents'), {
    userId: user.uid,
    type: input.type,
    targetId: clean(input.targetId, 256),
    targetType: clean(input.targetType, 64),
    sessionId: clean(input.sessionId, 128),
    source: clean(input.source, 80),
    metadata,
    timestamp: input.timestamp || serverTimestamp(),
    createdAt: serverTimestamp(),
    schemaVersion: 1,
  });
  return ref.id;
}

export function activitySessionId(scope: string): string {
  const key = `offscrpt:activity-session:${scope}`;
  if (typeof window === 'undefined') return `server-${scope}`;
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const value = crypto.randomUUID();
  try { sessionStorage.setItem(key, value); } catch { /* optional */ }
  return value;
}
