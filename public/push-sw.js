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

  /* #region debug-point E:sw-push-received */
  fetch('http://127.0.0.1:7777/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'web-push-missing',
      runId: 'pre-fix',
      hypothesisId: 'E',
      location: 'frontend/public/push-sw.js:push',
      msg: '[DEBUG] service worker push event received',
      data: {
        title,
        hasBody: Boolean(body),
        targetUrl,
      },
      ts: Date.now()
    })
  }).catch(() => undefined);
  /* #endregion */

  event.waitUntil(
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
