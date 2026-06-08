export const environment = {
  production: true,
  apiUrl: 'https://emergency-backend-ea41.onrender.com',
  wsBaseUrl: 'https://emergency-backend-ea41.onrender.com',
  firebase: {
    apiKey: 'AIzaSyDvKpkTJgcFVrzc_Rjfj44xmsfKpcA_0hE',
    authDomain: 'apk2doparcialsi2.firebaseapp.com',
    projectId: 'apk2doparcialsi2',
    storageBucket: 'apk2doparcialsi2.firebasestorage.app',
    messagingSenderId: '421279652666',
    appId: '1:421279652666:web:89820427f650caed0ace03',
    measurementId: 'G-3T2WZ8TBDQ'
  },
  // Clave VAPID (Web Push certificate "Par de claves") del proyecto
  // apk2doparcialsi2 — la usa getToken() para registrar el token FCM web.
  firebaseVapidKey: 'BLcorWjihIScKolC-ofhRCjox8E6AkHYs0lNGOF-f0G5pL6XaFfoo_3ztOP-iXar9RNk03sReFjRkHNXMscUYVs'
};
