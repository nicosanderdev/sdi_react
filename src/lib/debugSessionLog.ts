export const RELOAD_DEBUG_VERSION = '977cd8-v3';

const DEBUG_SESSION_ID = '977cd8';
const STORAGE_KEY = `debug-${DEBUG_SESSION_ID}-events`;
const LOCAL_STORAGE_KEY = `reload-debug-${DEBUG_SESSION_ID}-events`;
const INGEST_URL = 'http://127.0.0.1:7756/ingest/8cfc8ae1-a75f-4ac9-842a-c9e78ca77428';

type DebugEntry = {
  sessionId: string;
  location: string;
  message: string;
  data: Record<string, unknown>;
  timestamp: number;
  hypothesisId: string;
  runId?: string;
};

declare global {
  interface Window {
    __RELOAD_DEBUG__?: string;
    __RELOAD_DEBUG_EVENTS__?: DebugEntry[];
  }
}

function persistEntry(entry: DebugEntry) {
  try {
    const prev: DebugEntry[] = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
    prev.push(entry);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(prev.slice(-80)));
  } catch {
    // ignore storage errors
  }

  try {
    const prevLocal: DebugEntry[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    prevLocal.push(entry);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(prevLocal.slice(-80)));
    window.__RELOAD_DEBUG_EVENTS__ = prevLocal.slice(-80);
  } catch {
    // ignore storage errors
  }
}

function ensureDebugBadge() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('reload-debug-badge-977cd8')) return;

  const badge = document.createElement('div');
  badge.id = 'reload-debug-badge-977cd8';
  badge.textContent = `RELOAD DEBUG ${RELOAD_DEBUG_VERSION}`;
  badge.setAttribute(
    'style',
    [
      'position:fixed',
      'bottom:8px',
      'right:8px',
      'z-index:99999',
      'padding:4px 8px',
      'background:#b45309',
      'color:#fff',
      'font:12px/1.2 monospace',
      'border-radius:4px',
      'pointer-events:none',
      'opacity:0.85',
    ].join(';')
  );
  document.body?.appendChild(badge);
}

export function debugSessionLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
  runId = 'pre-fix'
) {
  const entry: DebugEntry = {
    sessionId: DEBUG_SESSION_ID,
    location,
    message,
    data,
    timestamp: Date.now(),
    hypothesisId,
    runId,
  };

  persistEntry(entry);
  console.warn(`[DEBUG-${DEBUG_SESSION_ID}] ${message}`, data);

  // #region agent log
  fetch(INGEST_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': DEBUG_SESSION_ID,
    },
    body: JSON.stringify(entry),
  }).catch(() => {});
  // #endregion
}

export function debugSessionLogBoot() {
  window.__RELOAD_DEBUG__ = RELOAD_DEBUG_VERSION;

  let navType = 'unknown';
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    navType = nav?.type ?? 'unknown';
  } catch {
    // ignore
  }

  let priorEvents: DebugEntry[] = [];
  try {
    priorEvents = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    priorEvents = [];
  }

  debugSessionLog('debugSessionLog.ts:boot', 'app boot', { navType, priorEventCount: priorEvents.length, version: RELOAD_DEBUG_VERSION }, 'F');

  if (priorEvents.length > 0) {
    debugSessionLog(
      'debugSessionLog.ts:boot',
      'events before last reload',
      { events: priorEvents.slice(-15) },
      'F'
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureDebugBadge, { once: true });
  } else {
    ensureDebugBadge();
  }
}

export function debugSessionLogLifecycle() {
  window.addEventListener('beforeunload', () => {
    debugSessionLog('window:beforeunload', 'full page unload imminent', {}, 'F');
  });

  window.addEventListener('pageshow', (event) => {
    debugSessionLog('window:pageshow', 'page shown', { persisted: event.persisted }, 'F');
  });

  document.addEventListener('visibilitychange', () => {
    debugSessionLog(
      'document:visibilitychange',
      'visibility changed',
      { hidden: document.hidden, visibilityState: document.visibilityState },
      'D'
    );
  });
}
