import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const apiUrl = (process.env.RENDER_EXTERNAL_API_URL || 'https://emergency-backend.onrender.com').trim();
const wsBaseUrl = (process.env.RENDER_EXTERNAL_WS_URL || apiUrl).trim();

const target = resolve(process.cwd(), 'src/environments/environment.render.ts');
const content = `export const environment = {
  production: true,
  apiUrl: '${apiUrl}',
  wsBaseUrl: '${wsBaseUrl}',
  firebase: {
    apiKey: 'AIzaSyDvKpkTJgcFVrzc_Rjfj44xmsfKpcA_0hE',
    authDomain: 'apk2doparcialsi2.firebaseapp.com',
    projectId: 'apk2doparcialsi2',
    storageBucket: 'apk2doparcialsi2.firebasestorage.app',
    messagingSenderId: '421279652666',
    appId: '1:421279652666:web:89820427f650caed0ace03',
    measurementId: 'G-3T2WZ8TBDQ'
  },
  firebaseVapidKey: 'BLcorWjihIScKolC-ofhRCjox8E6AkHYs0lNGOF-f0G5pL6XaFfoo_3ztOP-iXar9RNk03sReFjRkHNXMscUYVs'
};
`;

writeFileSync(target, content, 'utf8');
console.log(`environment.render.ts generado con apiUrl=${apiUrl} y wsBaseUrl=${wsBaseUrl}`);
