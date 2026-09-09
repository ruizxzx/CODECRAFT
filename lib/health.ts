import { getStorage, ref } from 'firebase/storage';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

export type HealthStatus = 'healthy' | 'degraded' | 'unavailable';
export interface HealthCheckResult {
  name: string;
  status: HealthStatus;
  latencyMs?: number;
  detail: string;
  checkedAt: number;
}

async function timed<T>(name: string, action: () => Promise<T>, success: (value: T) => string): Promise<HealthCheckResult> {
  const started = performance.now();
  try {
    const value = await action();
    return { name, status: 'healthy', latencyMs: Math.round(performance.now() - started), detail: success(value), checkedAt: Date.now() };
  } catch (error) {
    return { name, status: 'unavailable', latencyMs: Math.round(performance.now() - started), detail: error instanceof Error ? error.message : String(error), checkedAt: Date.now() };
  }
}

export async function runClientHealthChecks(): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = [];
  results.push({
    name: 'Authentication',
    status: auth.currentUser ? 'healthy' : 'degraded',
    detail: auth.currentUser ? `Authenticated as ${auth.currentUser.uid.slice(0, 8)}…` : 'No active session (expected for signed-out visitors).',
    checkedAt: Date.now(),
  });
  results.push(await timed('Firestore', () => getDoc(doc(db, 'siteConfig', 'global')), snap => snap.exists() ? 'Default database reachable; site config exists.' : 'Default database reachable; site config document is absent.'));
  results.push(await timed('Storage', async () => {
    const storage = getStorage();
    // A metadata URL probe is intentionally avoided: public assets are not guaranteed to be readable.
    // Initializing the client is the meaningful browser-side infrastructure check.
    const storageRef = ref(storage);
    return storageRef;
  }, () => 'Firebase Storage client initialized.'));
  results.push({
    name: 'PWA',
    status: 'serviceWorker' in navigator ? 'healthy' : 'degraded',
    detail: 'serviceWorker' in navigator ? 'Service worker API is available.' : 'Service worker API is unavailable in this browser/context.',
    checkedAt: Date.now(),
  });
  results.push({
    name: 'Realtime / Presence',
    status: 'degraded',
    detail: 'No second-by-second presence writer is permitted by the stability release. Presence must be evaluated by its bounded heartbeat implementation when enabled.',
    checkedAt: Date.now(),
  });
  return results;
}

export function buildHealthSummary(results: HealthCheckResult[]): HealthStatus {
  if (results.some(result => result.status === 'unavailable')) return 'unavailable';
  if (results.some(result => result.status === 'degraded')) return 'degraded';
  return 'healthy';
}
