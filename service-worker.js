/* DNP3 SCADA UAE Field Engineer Guide - service worker */
var CACHE = 'dnp3-scada-uae-v1.0.0';
var ASSETS = [
  './', './index.html', './style.css', './script.js', './manifest.json', './offline.html',
  './icon.svg', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './favicon.ico',
  './assets/og-image.png', './assets/screenshots/wide.png', './assets/screenshots/narrow.png', './config/scada-dnp3-presets.json', './browserconfig.xml'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return Promise.all(ASSETS.map(function (url) {
        return cache.add(url).catch(function (err) { console.warn('Precache skipped:', url, err); });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Pages: network first so updates arrive, then cache, then offline page
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) { return hit || caches.match('./index.html') || caches.match('./offline.html'); })
          .then(function (res) { return res || caches.match('./offline.html'); });
      })
    );
    return;
  }

  // Static assets: cache first, refresh in the background
  event.respondWith(
    caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit || caches.match('./offline.html'); });
      return hit || net;
    })
  );
});
