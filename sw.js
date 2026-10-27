// يعمل فقط عند الاستضافة على رابط آمن (https). يخزّن ملفات البرنامج ليفتح بدون إنترنت.
const V = 'mayor-v6';
const FILES = ['./','index.html','manifest.webmanifest','css/style.css','css/fonts.css',
  'js/db.js','js/core.js','js/docx.js','js/map.js','js/requests.js','js/reports.js','js/district.js','js/home.js','js/install.js','js/config.js','js/backup.js','js/cloud.js','js/settings.js','js/main.js',
  'lib/leaflet/leaflet.js','lib/leaflet/leaflet.css','lib/jszip.min.js',
  'lib/leaflet/images/layers.png','lib/leaflet/images/layers-2x.png','lib/leaflet/images/marker-icon.png','lib/leaflet/images/marker-shadow.png',
  'fonts/tajawal-arabic-400-normal.woff2','fonts/tajawal-arabic-500-normal.woff2','fonts/tajawal-arabic-700-normal.woff2',
  'fonts/amiri-arabic-400-normal.woff2','fonts/amiri-arabic-700-normal.woff2','icons/icon-192.png','icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (u.origin !== location.origin) return; // بلاطات الخرائط تُحمَّل من الشبكة مباشرة
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(V).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request)));
});
