/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDvKpkTJgcFVrzc_Rjfj44xmsfKpcA_0hE',
  authDomain: 'apk2doparcialsi2.firebaseapp.com',
  projectId: 'apk2doparcialsi2',
  storageBucket: 'apk2doparcialsi2.firebasestorage.app',
  messagingSenderId: '421279652666',
  appId: '1:421279652666:web:89820427f650caed0ace03'
};

if (FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.messagingSenderId && FIREBASE_CONFIG.appId) {
  firebase.initializeApp(FIREBASE_CONFIG);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = (payload && payload.notification && payload.notification.title) || '🚨 Emergencia';
    const body = (payload && payload.notification && payload.notification.body) || 'Nueva incidencia registrada.';
    const url = (payload && payload.data && payload.data.url) || '/';

    self.registration.showNotification(title, {
      body,
      icon: '/alert-icon.svg',
      badge: '/alert-icon.svg',
      tag: 'emergency',
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 200],
      data: { url }
    });
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/';
  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of allClients) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) {
            try {
              await client.navigate(targetUrl);
            } catch (_) {}
          }
          return;
        }
      }
      await clients.openWindow(targetUrl);
    })()
  );
});
