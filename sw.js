/* YAPSTech service worker - install + full offline browsing */
var V = 'yapstech-v2', RT = 'yapstech-rt-v2', MAX_RT = 500;
var CORE = ['./', 'index.html', 'shop.html', 'checkout.html', 'account.html', 'contact.html', 'projects.html', 'software-development.html', 'YAPS_About_Us.html', 'privacy.html', 'terms.html', '404.html', 'yaps-app.js', 'yaps-config.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon.ico', 'logo.webp', 'og-image.png'];
var REMOTE = /(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com|images\.unsplash\.com|picsum\.photos|fastly\.picsum\.photos|cdn\.jsdelivr\.net)$/;

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(V).then(function (c) {
    return Promise.all(CORE.map(function (u) { return c.add(new Request(u, { cache: 'reload' })).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== V && k !== RT; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function trim(c) {
  c.keys().then(function (ks) { if (ks.length > MAX_RT) ks.slice(0, ks.length - MAX_RT).forEach(function (k) { c.delete(k); }); });
}

self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET') return;
  var u = new URL(r.url);

  /* pages: network first, fall back to saved copy (works with ?query strings), then home */
  if (r.mode === 'navigate' && u.origin === location.origin) {
    e.respondWith(fetch(r).then(function (res) {
      if (res && res.ok) { var cp = res.clone(); caches.open(V).then(function (c) { c.put(r, cp); }); }
      return res;
    }).catch(function () {
      return caches.match(r, { ignoreSearch: true }).then(function (m) { return m || caches.match('index.html') || caches.match('./'); });
    }));
    return;
  }

  /* same-site files: saved copy first, refresh in background */
  if (u.origin === location.origin) {
    e.respondWith(caches.match(r, { ignoreSearch: true }).then(function (m) {
      var net = fetch(r).then(function (res) {
        if (res && res.ok) { var cp = res.clone(); caches.open(V).then(function (c) { c.put(r, cp); }); }
        return res;
      }).catch(function () { return m; });
      return m || net;
    }));
    return;
  }

  /* product photos, fonts, supabase library: cache as they are viewed so they show offline */
  if (REMOTE.test(u.hostname)) {
    e.respondWith(caches.open(RT).then(function (c) {
      return c.match(r).then(function (m) {
        if (m) return m;
        return fetch(r).then(function (res) {
          if (res && (res.ok || res.type === 'opaque')) { c.put(r, res.clone()); trim(c); }
          return res;
        }).catch(function () { return m || Response.error(); });
      });
    }));
  }
});
