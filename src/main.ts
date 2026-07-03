import { bootstrapApplication } from '@angular/platform-browser';

import { App } from './app/app';
import { appConfig } from './app/app.config';

// #region debug-point B:runtime-bootstrap
const DEBUG_SESSION_ID = 'solicitudes-runtime-errors';

function getDebugServerUrl(): string | null {
  const raw = new URLSearchParams(window.location.search).get('debugServerUrl')?.trim();
  if (!raw) return null;
  return /^https?:\/\//i.test(raw) ? raw : null;
}

function reportDebug(hypothesisId: string, location: string, msg: string, data: Record<string, unknown>) {
  const debugServerUrl = getDebugServerUrl();
  if (!debugServerUrl) return;
  const body = JSON.stringify({
    sessionId: DEBUG_SESSION_ID,
    runId: 'pre-fix',
    hypothesisId,
    location,
    msg: `[DEBUG] ${msg}`,
    data,
    ts: Date.now()
  });
  fetch(debugServerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body
  }).catch(() => undefined);
}

window.addEventListener('error', (event) => {
  const error = event.error as
    | (Error & { cause?: unknown })
    | undefined;
  const cause = error?.cause as
    | { message?: unknown; stack?: unknown; name?: unknown }
    | undefined;
  reportDebug('B', 'main.ts:window.error', 'window error captured', {
    message: error?.message ?? String(event.message ?? ''),
    name: error?.name ?? null,
    stack: error?.stack ?? null,
    causeMessage: cause?.message ?? null,
    causeName: cause?.name ?? null,
    causeStack: cause?.stack ?? null,
    filename: event.filename ?? null,
    lineno: event.lineno ?? null,
    colno: event.colno ?? null
  });
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason as
    | { message?: unknown; stack?: unknown; name?: unknown; cause?: unknown }
    | undefined;
  reportDebug('B', 'main.ts:unhandledrejection', 'unhandled rejection captured', {
    reasonMessage: reason?.message ?? String(event.reason ?? ''),
    reasonName: reason?.name ?? null,
    reasonStack: reason?.stack ?? null,
    reasonCause: reason?.cause ?? null
  });
});
// #endregion

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
