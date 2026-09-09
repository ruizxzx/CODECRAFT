import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
} from 'firebase/firestore';
import { auth, db, checkIsAdmin } from './firebase';

export type EmergencyKey =
  | 'maintenanceMode' | 'readOnlyMode' | 'registrationsEnabled' | 'commentsEnabled'
  | 'postingEnabled' | 'reactionsEnabled' | 'followingEnabled' | 'communityCreationEnabled'
  | 'communityPostsEnabled' | 'questionsEnabled' | 'topicsEnabled' | 'directMessagesEnabled'
  | 'publicBlogsEnabled' | 'communityBlogsEnabled' | 'communityDiscussionsEnabled' | 'uploadsEnabled';

export interface EmergencyControls {
  maintenanceMode: boolean;
  emergencyAdminLock: boolean;
  readOnlyMode: boolean;
  registrationsEnabled: boolean;
  commentsEnabled: boolean;
  postingEnabled: boolean;
  reactionsEnabled: boolean;
  followingEnabled: boolean;
  communityCreationEnabled: boolean;
  communityPostsEnabled: boolean;
  questionsEnabled: boolean;
  topicsEnabled: boolean;
  directMessagesEnabled: boolean;
  publicBlogsEnabled: boolean;
  communityBlogsEnabled: boolean;
  communityDiscussionsEnabled: boolean;
  uploadsEnabled: boolean;
  maintenanceMessage: string;
  updatedAt?: unknown;
}

export const DEFAULT_EMERGENCY_CONTROLS: EmergencyControls = {
  maintenanceMode: false,
  emergencyAdminLock: false,
  readOnlyMode: false,
  registrationsEnabled: true,
  commentsEnabled: true,
  postingEnabled: true,
  reactionsEnabled: true,
  followingEnabled: true,
  communityCreationEnabled: true,
  communityPostsEnabled: true,
  questionsEnabled: true,
  topicsEnabled: true,
  directMessagesEnabled: true,
  publicBlogsEnabled: true,
  communityBlogsEnabled: true,
  communityDiscussionsEnabled: true,
  uploadsEnabled: true,
  maintenanceMessage: 'OFFSCRPT is temporarily under maintenance.',
};

export interface MasterAdminEntry {
  uid: string;
  email?: string;
  displayName?: string;
  enabled: boolean;
  source: 'uid' | 'email';
  createdAt?: string;
  updatedAt?: string;
}

export interface PlatformAnalytics {
  users: { total: number; new7d: number; new30d: number };
  content: { articles: number; posts: number; communities: number; comments: number; series: number };
  engagement: { reactions: number; shares: number; bookmarks: number; analyticsEvents: number; reportsOpen: number; uniqueReaders: number; completedSessions: number; totalReadingTimeMs: number; averageScrollDepth: number; periods: Record<'7D'|'30D'|'90D'|'ALL', { sessions: number; uniqueReaders: number; completedSessions: number; shares: number; readingTimeMs: number; averageScrollDepth: number; }> };
  measuredAt: number;
}

export interface MasterCommentRecord {
  id: string;
  path: string;
  sourceType: 'article' | 'post' | 'community_post';
  articleSlug?: string;
  communityId?: string;
  postId?: string;
  authorId?: string;
  authorName?: string;
  authorUsername?: string;
  content: string;
  isHidden: boolean;
  isDeleted: boolean;
  createdAt?: string;
}

export interface RecommendationHealth {
  sourceCounts: { articles: number; topics: number; series: number };
  topCloudArticles: Array<{ slug: string; title: string; views: number }>;
  generatedFromCloud: boolean;
  note: string;
}

const iso = (v: any) => v?.toDate?.().toISOString?.() || (typeof v === 'string' ? v : undefined);
const normalizedEmail = (email: string) => email.trim().toLowerCase();
const toBool = (v: unknown) => v === true;

async function audit(action: string, target: string, before?: unknown, after?: unknown): Promise<void> {
  const actor = auth.currentUser;
  if (!actor) return;
  try {
    await addDoc(collection(db, 'adminAuditLog'), {
      actorId: actor.uid,
      actorEmail: actor.email || '',
      actorName: actor.displayName || '',
      action: String(action).slice(0, 120),
      target: String(target).slice(0, 240),
      before: before ?? null,
      after: after ?? null,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn('Master audit write failed:', error);
  }
}

export async function resolveMasterAccess(user = auth.currentUser): Promise<boolean> {
  if (!user) return false;
  if (checkIsAdmin(user.email)) return true;
  try {
    const config = await getDoc(doc(db, 'siteConfig', 'global'));
    if (config.exists() && config.data().emergencyAdminLock === true) return false;
    const byUid = await getDoc(doc(db, 'masterAdmins', user.uid));
    if (byUid.exists() && byUid.data().enabled !== false) return true;
    const email = normalizedEmail(user.email || '');
    if (!email || user.emailVerified !== true) return false;
    const byEmail = await getDoc(doc(db, 'masterAdminEmails', email));
    return byEmail.exists() && byEmail.data().enabled !== false;
  } catch {
    return false;
  }
}

async function requireMaster(): Promise<void> {
  if (!(await resolveMasterAccess())) throw new Error('Master admin access required.');
}

export function subscribeEmergencyControls(callback: (controls: EmergencyControls) => void): () => void {
  const ref = doc(db, 'siteConfig', 'global');
  return onSnapshot(ref, snap => {
    callback({ ...DEFAULT_EMERGENCY_CONTROLS, ...(snap.exists() ? snap.data() : {}) } as EmergencyControls);
  }, () => callback(DEFAULT_EMERGENCY_CONTROLS));
}

export async function updateEmergencyControls(patch: Partial<EmergencyControls>): Promise<void> {
  await requireMaster();
  const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  const beforeSnap = await getDoc(doc(db, 'siteConfig', 'global'));
  await setDoc(doc(db, 'siteConfig', 'global'), { ...clean, updatedAt: serverTimestamp() }, { merge: true });
  await audit('emergency_controls_update', 'siteConfig/global', beforeSnap.exists() ? beforeSnap.data() : null, clean);
}

export async function listMasterAdmins(): Promise<MasterAdminEntry[]> {
  await requireMaster();
  const [uidSnap, emailSnap] = await Promise.all([
    getDocs(collection(db, 'masterAdmins')),
    getDocs(collection(db, 'masterAdminEmails')),
  ]);
  const uidEntries = uidSnap.docs.map(d => ({ uid: d.id, ...d.data(), source: 'uid' as const })) as MasterAdminEntry[];
  const emailEntries = emailSnap.docs.map(d => ({ uid: '', email: d.id, ...d.data(), source: 'email' as const })) as MasterAdminEntry[];
  return [...uidEntries, ...emailEntries].sort((a, b) => String(a.email || a.uid).localeCompare(String(b.email || b.uid)));
}

export async function grantMasterAdminByUid(uid: string): Promise<void> {
  await requireMaster();
  const cleanUid = uid.trim();
  if (!cleanUid) throw new Error('UID is required.');
  const target = await getDoc(doc(db, 'users', cleanUid));
  const data: any = target.exists() ? target.data() : {};
  await setDoc(doc(db, 'masterAdmins', cleanUid), {
    uid: cleanUid,
    email: data.email || '',
    displayName: data.displayName || '',
    enabled: true,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  if (target.exists()) {
    await updateDoc(doc(db, 'users', cleanUid), { platformRole: 'master_admin', role: 'Master Admin', updatedAt: serverTimestamp() });
  }
  await audit('grant_master_admin_uid', `masterAdmins/${cleanUid}`);
}

export async function grantMasterAdminByEmail(email: string): Promise<void> {
  await requireMaster();
  const normalized = normalizedEmail(email);
  if (!normalized || !normalized.includes('@')) throw new Error('Enter a valid email address.');
  await setDoc(doc(db, 'masterAdminEmails', normalized), {
    email: normalized,
    enabled: true,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  await audit('grant_master_admin_email', `masterAdminEmails/${normalized}`);
}

export async function revokeMasterAdmin(entry: MasterAdminEntry): Promise<void> {
  await requireMaster();
  const current = auth.currentUser;
  if (!current) throw new Error('Authentication required.');
  if (entry.source === 'uid' && entry.uid === current.uid) throw new Error('You cannot revoke your own master access from this panel.');
  if (entry.source === 'email' && checkIsAdmin(entry.email)) throw new Error('Bootstrap master emails are protected.');
  if (entry.source === 'uid') {
    await deleteDoc(doc(db, 'masterAdmins', entry.uid));
    try {
      await updateDoc(doc(db, 'users', entry.uid), { platformRole: 'member', role: 'Member', updatedAt: serverTimestamp() });
    } catch (error) { console.warn('Master role cleanup failed:', error); }
    await audit('revoke_master_admin_uid', `masterAdmins/${entry.uid}`);
  } else if (entry.email) {
    await deleteDoc(doc(db, 'masterAdminEmails', normalizedEmail(entry.email)));
    await audit('revoke_master_admin_email', `masterAdminEmails/${normalizedEmail(entry.email)}`);
  }
}

export async function promoteModeratorByUid(uid: string, permissions?: Record<string, boolean>): Promise<void> {
  await requireMaster();
  const target = await getDoc(doc(db, 'users', uid));
  if (!target.exists()) throw new Error('User profile not found.');
  const p: any = target.data();
  const defaultPermissions = {
    manageReports: false,
    moderatePosts: true,
    moderateComments: true,
    manageUsers: false,
    editArticles: false,
    deleteArticles: false,
    viewAnalytics: true,
  };
  await setDoc(doc(db, 'siteModerators', uid), {
    uid,
    username: p.username || '',
    displayName: p.displayName || '',
    role: 'moderator',
    enabled: true,
    permissions: { ...defaultPermissions, ...(permissions || {}) },
    updatedAt: serverTimestamp(),
  }, { merge: true });
  await updateDoc(doc(db, 'users', uid), { platformRole: 'moderator', role: 'Moderator', updatedAt: serverTimestamp() });
  await audit('promote_moderator', `users/${uid}`, null, { permissions: { ...defaultPermissions, ...(permissions || {}) } });
}

export async function revokeModeratorByUid(uid: string): Promise<void> {
  await requireMaster();
  await deleteDoc(doc(db, 'siteModerators', uid));
  try { await updateDoc(doc(db, 'users', uid), { platformRole: 'member', role: 'Member', updatedAt: serverTimestamp() }); } catch (error) { console.warn('Master role cleanup failed:', error); }
  await audit('revoke_moderator', `siteModerators/${uid}`);
}

export async function getModeratorPermissionSet(uid: string): Promise<Record<string, boolean>> {
  await requireMaster();
  const snap = await getDoc(doc(db, 'siteModerators', uid));
  return { ...(snap.exists() ? (snap.data().permissions || {}) : {}) };
}

export async function setModeratorPermissionSet(uid: string, permissions: Record<string, boolean>): Promise<void> {
  await requireMaster();
  const clean = Object.fromEntries(Object.entries(permissions).map(([key, value]) => [key, !!value]));
  const before = await getDoc(doc(db, 'siteModerators', uid));
  if (!before.exists()) throw new Error('Moderator record not found.');
  await updateDoc(before.ref, { permissions: clean, updatedAt: serverTimestamp() });
  await audit('moderator_permissions_update', `siteModerators/${uid}`, before.data()?.permissions || {}, clean);
}

export interface UserControlPatch {
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
}

export async function updateUserControls(uid: string, patch: UserControlPatch): Promise<void> {
  await requireMaster();
  const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  const before = await getDoc(doc(db, 'users', uid));
  if (!before.exists()) throw new Error('User profile not found.');
  await updateDoc(before.ref, { ...clean, updatedAt: serverTimestamp() });
  await audit('user_controls_update', `users/${uid}`, before.data(), clean);
}

export async function forceProfileCleanup(uid: string): Promise<void> {
  await requireMaster();
  const before = await getDoc(doc(db, 'users', uid));
  if (!before.exists()) throw new Error('User profile not found.');
  await updateDoc(before.ref, {
    bio: '', websiteUrl: '', location: '', socialX: '', socialGithub: '', socialTelegram: '', socialInstagram: '',
    coverImageUrl: '', updatedAt: serverTimestamp(),
  });
  await audit('force_profile_cleanup', `users/${uid}`);
}

export async function resetUserPreferences(uid: string): Promise<void> {
  await requireMaster();
  const prefs = doc(db, 'users', uid, 'preferences', 'settings');
  const before = await getDoc(prefs);
  await setDoc(prefs, {}, { merge: false });
  await audit('reset_user_preferences', `users/${uid}/preferences/settings`, before.exists() ? before.data() : null, {});
}

export async function hideOrRestoreArticleComment(slug: string, commentId: string, hidden: boolean, reason = 'Master moderation'): Promise<void> {
  await requireMaster();
  const ref = doc(db, 'articles', slug, 'comments', commentId);
  await updateDoc(ref, { isHidden: hidden, moderationReason: hidden ? reason.slice(0, 500) : '', updatedAt: serverTimestamp() });
  await audit(hidden ? 'hide_article_comment' : 'restore_article_comment', ref.path);
}

export async function deleteArticleCommentAsMaster(slug: string, commentId: string): Promise<void> {
  await requireMaster();
  const ref = doc(db, 'articles', slug, 'comments', commentId);
  const before = await getDoc(ref);
  await updateDoc(ref, { isDeleted: true, content: '', updatedAt: serverTimestamp() });
  await audit('delete_article_comment', ref.path, before.exists() ? before.data() : null, { isDeleted: true });
}

export async function setArticleCommentsLocked(slug: string, locked: boolean): Promise<void> {
  await requireMaster();
  const ref = doc(db, 'articles', slug);
  await updateDoc(ref, { commentsLocked: locked, updatedAt: serverTimestamp() });
  await audit('article_comments_lock', ref.path, undefined, { commentsLocked: locked });
}

export async function setPostCommentsLocked(postId: string, locked: boolean): Promise<void> {
  await requireMaster();
  const ref = doc(db, 'posts', postId);
  await updateDoc(ref, { commentsLocked: locked, updatedAt: serverTimestamp() });
  await audit('post_comments_lock', ref.path, undefined, { commentsLocked: locked });
}

export async function hideOrRestorePostComment(postId: string, commentId: string, hidden: boolean): Promise<void> {
  await requireMaster();
  const ref = doc(db, 'posts', postId, 'comments', commentId);
  await updateDoc(ref, { isHidden: hidden, moderationReason: hidden ? 'Master moderation' : '', updatedAt: serverTimestamp() });
  await audit(hidden ? 'hide_post_comment' : 'restore_post_comment', ref.path);
}

export async function deletePostCommentAsMaster(postId: string, commentId: string): Promise<void> {
  await requireMaster();
  const ref = doc(db, 'posts', postId, 'comments', commentId);
  const before = await getDoc(ref);
  await updateDoc(ref, { isDeleted: true, content: '', updatedAt: serverTimestamp() });
  await audit('delete_post_comment', ref.path, before.exists() ? before.data() : null, { isDeleted: true });
}

export async function hideOrRestoreCommunityPostComment(communityId: string, postId: string, commentId: string, hidden: boolean): Promise<void> {
  await requireMaster();
  const ref = doc(db, 'communities', communityId, 'posts', postId, 'comments', commentId);
  await updateDoc(ref, { isHidden: hidden, moderationReason: hidden ? 'Master moderation' : '', updatedAt: serverTimestamp() });
  await audit(hidden ? 'hide_community_post_comment' : 'restore_community_post_comment', ref.path);
}

export async function deleteCommunityPostCommentAsMaster(communityId: string, postId: string, commentId: string): Promise<void> {
  await requireMaster();
  const ref = doc(db, 'communities', communityId, 'posts', postId, 'comments', commentId);
  const before = await getDoc(ref);
  await updateDoc(ref, { isDeleted: true, content: '', updatedAt: serverTimestamp() });
  await audit('delete_community_post_comment', ref.path, before.exists() ? before.data() : null, { isDeleted: true });
}

export async function removeArticleCommentReplies(slug: string, parentId: string): Promise<number> {
  await requireMaster();
  const snap = await getDocs(query(collection(db, 'articles', slug, 'comments'), where('parentId', '==', parentId), limit(200)));
  let changed = 0;
  for (const d of snap.docs) {
    await updateDoc(d.ref, { isDeleted: true, isHidden: true, content: '', updatedAt: serverTimestamp() });
    changed++;
  }
  await audit('remove_article_comment_replies', `articles/${slug}/comments/${parentId}`, undefined, { changed });
  return changed;
}

function parseCommentDoc(refPath: string, id: string, data: any): MasterCommentRecord {
  const parts = refPath.split('/');
  const timestamp = iso(data.createdAt);
  const base = {
    id,
    path: refPath,
    authorId: data.authorId || '',
    authorName: data.authorName || '',
    authorUsername: data.authorUsername || '',
    content: data.isDeleted ? '[deleted]' : String(data.content || ''),
    isHidden: toBool(data.isHidden),
    isDeleted: toBool(data.isDeleted),
    createdAt: timestamp,
  };
  if (parts[0] === 'articles' && parts[2] === 'comments') return { ...base, sourceType: 'article', articleSlug: parts[1] };
  if (parts[0] === 'posts' && parts[2] === 'comments') return { ...base, sourceType: 'post', postId: parts[1] };
  if (parts[0] === 'communities' && parts[2] === 'posts' && parts[4] === 'comments') {
    return { ...base, sourceType: 'community_post', communityId: parts[1], postId: parts[3] };
  }
  return { ...base, sourceType: 'post' };
}

export async function getRecentCommentsForMaster(): Promise<MasterCommentRecord[]> {
  await requireMaster();
  const snap = await getDocs(query(collectionGroup(db, 'comments'), limit(300)));
  return snap.docs
    .map(d => parseCommentDoc(d.ref.path, d.id, d.data()))
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 200);
}

export async function getReportsForMaster(): Promise<any[]> {
  await requireMaster();
  const snap = await getDocs(query(collection(db, 'reports'), limit(500)));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data(), createdAt: iso(d.data().createdAt) }))
    .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

export async function setReportStatus(reportId: string, status: 'open'|'under_review'|'action_taken'|'dismissed'|'resolved', response = ''): Promise<void> {
  await requireMaster();
  const ref = doc(db, 'reports', reportId);
  const before = await getDoc(ref);
  if (!before.exists()) throw new Error('Report not found.');
  const actor = auth.currentUser;
  await updateDoc(ref, {
    status,
    response: response.trim().slice(0, 1000),
    resolvedBy: actor?.uid || '',
    resolvedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await audit('report_status_update', ref.path, before.data(), { status });
}

export async function getAuditLog(): Promise<any[]> {
  await requireMaster();
  try {
    const snap = await getDocs(query(collection(db, 'adminAuditLog'), limit(300)));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data(), createdAt: iso(d.data().createdAt) }))
      .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  } catch {
    return [];
  }
}

export async function getPlatformAnalytics(): Promise<PlatformAnalytics> {
  await requireMaster();
  const now = Date.now();
  const d7 = new Date(now - 7 * 86400000);
  const d30 = new Date(now - 30 * 86400000);
  const [users, articles, posts, communities, comments, series, reportsOpenCount, analyticsSnap] = await Promise.all([
    getCountFromServer(collection(db, 'users')),
    getCountFromServer(collection(db, 'articles')),
    getCountFromServer(collection(db, 'posts')),
    getCountFromServer(collection(db, 'communities')),
    getCountFromServer(collectionGroup(db, 'comments')),
    getCountFromServer(collection(db, 'series')),
    getCountFromServer(query(collection(db, 'reports'), where('status', 'in', ['open', 'under_review', 'action_taken']))),
    getDocs(collectionGroup(db, 'analytics')),
  ]);

  const rows = analyticsSnap.docs.map(d => ({
    id: d.id,
    path: d.ref.path,
    articleSlug: d.ref.parent.parent?.id || '',
    ...(d.data() as Record<string, unknown>),
  }));
  const dateValue = (value: unknown): number => value && typeof (value as any).toDate === 'function' ? (value as any).toDate().getTime() : typeof value === 'string' ? Date.parse(value) || 0 : typeof value === 'number' ? value : 0;
  const isWithin = (row: Record<string, unknown>, cutoff: number) => dateValue(row.createdAt || row.lastSeenAt || row.openedAt) >= cutoff;
  const eventRows = rows.filter(r => r.type !== 'session');
  const sessions = rows.filter(r => r.type === 'session');
  const uniqueReaders = new Set<string>();
  let totalDuration = 0;
  let totalScroll = 0;
  let completed = 0;
  const latestState = new Map<string, Record<string, unknown>>();
  for (const s of sessions) {
    const identity = String(s.userId || s.visitorId || s.id || '');
    if (identity) uniqueReaders.add(identity);
    totalDuration += Math.max(0, Math.min(86400000, Number(s.durationMs || 0)));
    totalScroll += Math.max(0, Math.min(100, Number(s.maxScrollPercent || 0)));
    if (s.completed === true || Number(s.maxScrollPercent || 0) >= 100) completed++;
  }
  for (const e of eventRows.filter(r => r.type === 'bookmark' || r.type === 'reaction')) {
    const identity = String(e.userId || e.visitorId || e.id || '');
    if (!identity) continue;
    const key = `${e.articleSlug}:${e.type}:${identity}`;
    const current = latestState.get(key);
    if (!current || dateValue(current.createdAt) <= dateValue(e.createdAt)) latestState.set(key, e);
  }
  const bookmarks = [...latestState.values()].filter(e => e.type === 'bookmark' && e.active !== false).length;
  const reactions = [...latestState.values()].filter(e => e.type === 'reaction' && e.active !== false).length;
  const shares = eventRows.filter(e => e.type === 'share').length;
  const periodMetrics = (days: number | null) => {
    const cutoff = days === null ? 0 : now - days * 86400000;
    const ps = sessions.filter(s => dateValue(s.createdAt || s.openedAt || s.lastSeenAt) >= cutoff);
    const pe = eventRows.filter(e => dateValue(e.createdAt) >= cutoff);
    const ids = new Set<string>(); let duration = 0; let scroll = 0; let done = 0;
    for (const s of ps) { const identity = String(s.userId || s.visitorId || s.id || ''); if (identity) ids.add(identity); duration += Math.max(0, Math.min(86400000, Number(s.durationMs || 0))); scroll += Math.max(0, Math.min(100, Number(s.maxScrollPercent || 0))); if (s.completed === true || Number(s.maxScrollPercent || 0) >= 100) done++; }
    return { sessions: ps.length, uniqueReaders: ids.size, completedSessions: done, shares: pe.filter(e => e.type === 'share').length, readingTimeMs: duration, averageScrollDepth: ps.length ? Math.round((scroll / ps.length) * 10) / 10 : 0 };
  };
  const periods = { '7D': periodMetrics(7), '30D': periodMetrics(30), '90D': periodMetrics(90), 'ALL': periodMetrics(null) };

  return {
    users: { total: users.data().count, new7d: (await getCountFromServer(query(collection(db, 'users'), where('createdAt', '>=', d7)))).data().count, new30d: (await getCountFromServer(query(collection(db, 'users'), where('createdAt', '>=', d30)))).data().count },
    content: {
      articles: articles.data().count,
      posts: posts.data().count,
      communities: communities.data().count,
      comments: comments.data().count,
      series: series.data().count,
    },
    engagement: {
      reactions,
      shares,
      bookmarks,
      analyticsEvents: rows.length,
      reportsOpen: reportsOpenCount.data().count,
      uniqueReaders: uniqueReaders.size,
      completedSessions: completed,
      totalReadingTimeMs: totalDuration,
      averageScrollDepth: sessions.length ? Math.round((totalScroll / sessions.length) * 10) / 10 : 0,
      periods,
    },
    measuredAt: now,
  };
}

export async function getRecommendationHealth(): Promise<RecommendationHealth> {
  await requireMaster();
  const [articles, topics, series] = await Promise.all([
    getCountFromServer(collection(db, 'articles')),
    getCountFromServer(collection(db, 'topics')),
    getCountFromServer(collection(db, 'series')),
  ]);
  const topSnap = await getDocs(query(collection(db, 'articles'), limit(200)));
  const topCloudArticles = topSnap.docs
    .map(d => ({ slug: d.id, title: String(d.data().title || d.id), views: Number(d.data().viewsCount || 0) }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);
  const generatedFromCloud = articles.data().count > 0;
  return {
    sourceCounts: { articles: articles.data().count, topics: topics.data().count, series: series.data().count },
    topCloudArticles,
    generatedFromCloud,
    note: generatedFromCloud
      ? 'Source inventory is read from Firestore. No static recommendation records are generated here.'
      : 'Recommendation sources are empty in Firestore.',
  };
}

export async function getActivePresenceCount(): Promise<{ activeUsers: number; measuredAt: number }> {
  await requireMaster();
  const snap = await getDocs(query(collectionGroup(db, 'members'), limit(3000)));
  const now = Date.now();
  const active = new Set<string>();
  for (const d of snap.docs) {
    const data: any = d.data();
    const expiresAt = data.expiresAt?.toDate?.()?.getTime?.() || 0;
    if (data.uid && expiresAt > now) active.add(String(data.uid));
  }
  return { activeUsers: active.size, measuredAt: now };
}
