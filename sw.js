/* Aqua Map – Service Worker
   Hält die App offline verfügbar und speichert angesehene Kartenkacheln. */
const VERSION = "aqua-map-v7";
const SHELL_CACHE = `${VERSION}-shell`;
const TILE_CACHE = "aqua-map-tiles-v2";
const FONT_CACHE = "aqua-map-fonts-v1";
const MAX_TILES = 3000;
const SHELL = [
  "./",
  "./index.html",
  "./css/vendor.css",
  "./css/app.css",
  "./js/vendor/leaflet.js",
  "./js/vendor/leaflet.markercluster.js",
  "./js/vendor/maplibre-gl.js",
  "./js/vendor/leaflet-maplibre-gl.js",
  "./js/vendor/jsqr.min.js",
  "./js/vendor/qrcode.min.js",
  "./js/i18n-dict.js",
  "./js/i18n.js",
  "./js/lu-border.js",
  "./js/core.js",
  "./js/route.js",
  "./js/features.js",
  "./manifest.webmanifest",
  "./icons/favicon-32.png",
  "./icons/favicon-48.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];
const TILE_HOSTS = /^server\.arcgisonline\.com$/;
const OFM_HOST = "tiles.openfreemap.org";
const FONT_HOSTS = /^fonts\.(googleapis|gstatic)\.com$/;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, TILE_CACHE, FONT_CACHE]);
    for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

let putsSinceTrim = 0;
async function trimTiles() {
  const cache = await caches.open(TILE_CACHE);
  const keys = await cache.keys();
  const extra = keys.length - MAX_TILES;
  for (let i = 0; i < extra; i++) await cache.delete(keys[i]);
}

async function cacheFirst(request, cacheName, isTile) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  // Nur vollständige CORS-Antworten speichern (undurchsichtige würden das Speicherkontingent sprengen)
  if (res.ok && res.type !== "opaque") {
    cache.put(request, res.clone());
    if (isTile && ++putsSinceTrim >= 100) { putsSinceTrim = 0; trimTiles(); }
  }
  return res;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok && res.type !== "opaque") cache.put(request, res.clone());
    return res;
  } catch (e) {
    return (await cache.match(request)) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // Overpass-Abfragen (POST) gehen direkt ins Netz
  const url = new URL(req.url);

  // App-Seite: zuerst Netz (für Updates), offline aus dem Speicher
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(SHELL_CACHE)).put("./index.html", res.clone());
        return res;
      } catch (e) {
        return (await caches.match("./index.html")) || Response.error();
      }
    })());
    return;
  }
  if (url.origin === self.location.origin) {
    // App-Dateien: zuerst Netz, damit Updates sofort ankommen; offline aus dem Speicher
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      try {
        const res = await fetch(req, { cache: "no-cache" });
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch (e) {
        return (await cache.match(req, { ignoreSearch: true })) || Response.error();
      }
    })());
    return;
  }
  if (url.hostname === OFM_HOST) {
    // Versionierte Kacheln, Schriften und Symbole ändern sich nie: aus dem Speicher.
    // Stil und Kachel-Verzeichnis können sich ändern: zuerst Netz, offline aus dem Speicher.
    const immutable = /\/(fonts|sprites|natural_earth)\//.test(url.pathname) || /\/planet\/\d{8}_/.test(url.pathname);
    event.respondWith(immutable ? cacheFirst(req, TILE_CACHE, true).catch(() => Response.error()) : networkFirst(req, TILE_CACHE));
    return;
  }
  if (TILE_HOSTS.test(url.hostname)) {
    event.respondWith(cacheFirst(req, TILE_CACHE, true).catch(() => Response.error()));
    return;
  }
  if (FONT_HOSTS.test(url.hostname)) {
    event.respondWith(cacheFirst(req, FONT_CACHE, false).catch(() => Response.error()));
  }
  // Alles andere (Ortssuche, Meldungen, Fotos) normal übers Netz
});

/* Tippen auf eine Trink-Erinnerung öffnet Aqua Map */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) if ("focus" in c) return c.focus();
    return self.clients.openWindow("./");
  }));
});
