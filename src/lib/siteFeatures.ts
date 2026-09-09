import { collection, addDoc, doc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { auth, checkIsAdmin } from './firebase';
import { db } from './firebase';

export type ProblemStatus = 'NOTED' | 'IN_REVIEW' | 'FIXED' | 'CLOSED';

export interface ProblemReport {
  id: string;
  reporterId: string;
  reporterHandle?: string;
  targetPage?: string;
  title: string;
  description: string;
  status: ProblemStatus;
  adminComment?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  changes: string[];
  kind?: 'feature' | 'fix' | 'security' | 'maintenance';
}

export const RECENT_CHANGELOG: ChangelogEntry[] = [
  { version: 'V75.2', date: '09 Sep 2026', title: 'Comment & Cloud Identity Sync', kind: 'fix', changes: ['Comment identity uses current public profile data.', 'Article comments remain realtime Firestore data.', 'Public identity and UID ownership are separated.'] },
  { version: 'V75.1', date: '09 Sep 2026', title: 'Message People Identity Fix', kind: 'fix', changes: ['Legacy message participants no longer overwrite valid public identities.', 'Current handles and names are preferred over stale message metadata.'] },
  { version: 'V75.0', date: '09 Sep 2026', title: 'Public Profiles & Messages Repair', kind: 'fix', changes: ['Public profile resolution hardened for signed-in and signed-out users.', 'Messages retain participant identity even when the public directory is unavailable.'] },
  { version: 'V74.5', date: '09 Sep 2026', title: 'Recommendation Engine Completion', kind: 'feature', changes: ['Weighted personalization signals.', 'Cold-start topic preferences.', 'Realtime recommendation signal subscriptions.'] },
  { version: 'V74.4', date: '09 Sep 2026', title: 'Creator Analytics Completion', kind: 'feature', changes: ['6M and 1Y periods.', 'Article comparison.', 'Reading funnel and series drop-off analytics.'] },
  { version: 'V73', date: '09 Sep 2026', title: 'Master Control', kind: 'security', changes: ['Master admin controls.', 'Granular moderator permissions.', 'Realtime system and audit tooling.'] },
];

const normalize = (v: unknown) => String(v || '').trim();

const toProblem = (snap: any): ProblemReport => {
  const d = snap.data() || {};
  return {
    id: snap.id,
    reporterId: String(d.reporterId || ''),
    reporterHandle: d.reporterHandle ? String(d.reporterHandle) : undefined,
    targetPage: d.targetPage ? String(d.targetPage) : undefined,
    title: String(d.title || ''),
    description: String(d.description || ''),
    status: (['NOTED','IN_REVIEW','FIXED','CLOSED'].includes(d.status) ? d.status : 'NOTED') as ProblemStatus,
    adminComment: d.adminComment ? String(d.adminComment) : undefined,
    createdAt: d.createdAt?.toDate?.()?.toISOString?.() || String(d.createdAt || ''),
    updatedAt: d.updatedAt?.toDate?.()?.toISOString?.() || String(d.updatedAt || ''),
  };
};

export async function submitProblemReport(input: { title: string; description: string; targetPage?: string; reporterHandle?: string }) {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in to report a problem.');
  const title = normalize(input.title).slice(0, 140);
  const description = normalize(input.description).slice(0, 4000);
  if (!title || !description) throw new Error('Title and description are required.');
  const ref = await addDoc(collection(db, 'siteProblemReports'), {
    reporterId: user.uid,
    reporterHandle: normalize(input.reporterHandle).slice(0, 60),
    targetPage: normalize(input.targetPage).slice(0, 80),
    title,
    description,
    status: 'NOTED',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getProblemReportsForAdmin() {
  const user = auth.currentUser;
  if (!user || !checkIsAdmin(user.email)) throw new Error('Master admin access required.');
  const snap = await getDocs(query(collection(db, 'siteProblemReports'), orderBy('createdAt', 'desc'), limit(200)));
  return snap.docs.map(toProblem);
}

export async function updateProblemReport(id: string, patch: Pick<ProblemReport, 'status' | 'adminComment'>) {
  const user = auth.currentUser;
  if (!user || !checkIsAdmin(user.email)) throw new Error('Master admin access required.');
  await updateDoc(doc(db, 'siteProblemReports', id), {
    status: patch.status,
    adminComment: normalize(patch.adminComment).slice(0, 4000),
    updatedAt: serverTimestamp(),
    resolvedBy: user.uid,
  });
}

export function subscribeProblemReportsForReporter(callback: (items: ProblemReport[]) => void) {
  const user = auth.currentUser;
  if (!user) { callback([]); return () => {}; }
  const q = query(collection(db, 'siteProblemReports'), where('reporterId', '==', user.uid), limit(25));
  return onSnapshot(q, snap => callback(snap.docs.map(toProblem).sort((a,b)=>new Date(b.createdAt||0).getTime()-new Date(a.createdAt||0).getTime())), err => { console.warn('Problem report subscription failed:', err); callback([]); });
}
