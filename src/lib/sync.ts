export type SyncState = 'idle' | 'loading' | 'saving' | 'synced' | 'offline' | 'failed';

export const SYNC_STATE_LABELS: Record<SyncState, string> = {
  idle: 'IDLE',
  loading: 'LOADING…',
  saving: 'SAVING…',
  synced: 'CLOUD SYNCED',
  offline: 'OFFLINE · SAVED LOCALLY',
  failed: 'SYNC FAILED · RETRY',
};

export const isOnline = (): boolean => typeof navigator === 'undefined' || navigator.onLine;

export async function runSyncedOperation<T>(
  operation: () => Promise<T>,
  setState?: (state: SyncState) => void,
): Promise<T> {
  if (!isOnline()) {
    setState?.('offline');
    throw new Error('OFFSCRPT is offline. Your local draft was preserved; retry when connected.');
  }
  setState?.('saving');
  try {
    const result = await operation();
    setState?.('synced');
    return result;
  } catch (error) {
    setState?.('failed');
    throw error;
  }
}
