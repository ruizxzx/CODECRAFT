import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

const LOCAL_KEY = 'offscrpt:runtime-errors:v1';
const MAX_LOCAL = 20;

export interface RuntimeErrorRecord {
  message: string;
  stack?: string;
  source?: string;
  path: string;
  version: string;
  buildTime: string;
  uid?: string;
  userAgent?: string;
  createdAt?: unknown;
}

function readLocal(): RuntimeErrorRecord[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function queueLocal(record: RuntimeErrorRecord): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify([...readLocal(), record].slice(-MAX_LOCAL)));
  } catch (storageError) {
    console.warn('OFFSCRPT runtime error could not be queued locally:', storageError);
  }
}

export async function reportRuntimeError(error: unknown, source = 'unknown'): Promise<void> {
  const normalized = error instanceof Error ? error : new Error(String(error ?? 'Unknown runtime error'));
  const record: RuntimeErrorRecord = {
    message: normalized.message.slice(0, 2000),
    stack: normalized.stack?.slice(0, 10000),
    source: source.slice(0, 200),
    path: typeof window !== 'undefined' ? window.location.href.slice(0, 2000) : 'server',
    version: typeof __OFFSCRPT_VERSION__ === 'string' ? __OFFSCRPT_VERSION__ : 'unknown',
    buildTime: typeof __OFFSCRPT_BUILD_TIME__ === 'string' ? __OFFSCRPT_BUILD_TIME__ : 'unknown',
    uid: auth.currentUser?.uid,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 1000) : undefined,
  };

  if (!auth.currentUser) {
    queueLocal(record);
    return;
  }

  try {
    await addDoc(collection(db, 'runtimeErrors'), { ...record, createdAt: serverTimestamp() });
  } catch (reportError) {
    console.warn('OFFSCRPT runtime error could not be reported to Firestore:', reportError);
    queueLocal(record);
  }
}

export async function flushQueuedRuntimeErrors(): Promise<void> {
  if (!auth.currentUser) return;
  const queued = readLocal();
  if (!queued.length) return;
  const remaining: RuntimeErrorRecord[] = [];
  for (const record of queued) {
    try {
      await addDoc(collection(db, 'runtimeErrors'), {
        ...record,
        uid: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        recoveredFromLocalQueue: true,
      });
    } catch (error) {
      remaining.push(record);
      console.warn('OFFSCRPT queued runtime error upload failed:', error);
      break;
    }
  }
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(remaining)); } catch (error) { console.warn('OFFSCRPT recoverable operation failed:', error); }
}

export function installRuntimeErrorReporting(): () => void {
  const onError = (event: ErrorEvent) => {
    void reportRuntimeError(event.error || event.message, 'window.error');
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    void reportRuntimeError(event.reason, 'unhandledrejection');
  };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}
