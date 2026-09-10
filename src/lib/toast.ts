export type ToastKind = 'success' | 'error' | 'info';

export interface ToastPayload {
  message: string;
  kind?: ToastKind;
  duration?: number;
}

export function inferToastKind(message: string): ToastKind {
  const text = String(message || '').toLowerCase();
  if (/(failed|error|could not|cannot|permission|unauthorized|denied|invalid|unable|not found|must |required|wrong|rejected)/i.test(text)) return 'error';
  if (/(saved|added|removed|deleted|updated|created|published|copied|restored|synced|featured|followed|completed|reset|queued|unblocked|blocked|recovered|approved|unpublished|moved)/i.test(text)) return 'success';
  return 'info';
}

let lastToastKey = '';
let lastToastAt = 0;
export function notifyToast(message: string, kind: ToastKind = inferToastKind(message), duration = 3200) {
  if (typeof window === 'undefined') return;
  const key = `${kind}:${String(message || '').trim()}`;
  const now = Date.now();
  if (key === lastToastKey && now - lastToastAt < 1800) return;
  lastToastKey = key; lastToastAt = now;
  window.dispatchEvent(new CustomEvent('offscrpt:toast', { detail: { message, kind, duration } satisfies ToastPayload }));
}

declare global {
  interface Window {
    __OFFSCRPT_TOAST__?: typeof notifyToast;
  }
}

if (typeof window !== 'undefined') {
  window.__OFFSCRPT_TOAST__ = notifyToast;
}
