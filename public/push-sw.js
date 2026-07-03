function getDebugServerUrl() {
  try {
    const raw = new URL(self.location.href).searchParams.get('debugServerUrl')?.trim();
    if (!raw) return null;
    return /^https?:\/\//i.test(raw) ? raw : null;
  } catch {
    return null;
  }
}

function reportDebug(hypothesisId, location, msg, data) {
  const debugServerUrl = getDebugServerUrl();
  if (!debugServerUrl) return Promise.resolve();
  return fetch(debugServerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'web-push-missing',
      runId: 'pre-fix',
      hypothesisId,
      location,
      msg: `[DEBUG] ${msg}`,
      data,
      ts: Date.now()
    })
  }).catch(() => undefined);
}

self.addEventListener('push', (event) => {
  const payload = (() => {
    try {
      return event.data ? event.data.json() : null;
    } catch {
      return null;
    }
  })();

  const title = payload?.title || 'Nueva notificación';
  const body = payload?.body || '';
  const data = payload?.data || {};
  const url = typeof data.url === 'string' ? data.url : '/';
  const targetUrl = url.startsWith('http') ? url : `${self.location.origin}${url}`;

  event.waitUntil(
    Promise.all([
      /* #region debug-point E:sw-push-received */
      reportDebug('E', 'frontend/public/push-sw.js:push', 'service worker push event received', {
        title,
        hasBody: Boolean(body),
        targetUrl,
      }),
      /* #endregion */
      self.registration.showNotification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        data: { ...data, targetUrl },
        actions: [
          { action: 'open', title: 'Abrir' },
          { action: 'close', title: 'Cerrar' }
        ]
      })
    ]).then(() => undefined)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.targetUrl || self.location.origin;
  if (event.action === 'close') {
    return;
  }
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
