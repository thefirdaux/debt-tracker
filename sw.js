// Lets the installed app open without a connection. Pages are fetched
// network-first so updates show up immediately when online; the last copy
// is used when offline. Debt data itself is cached by Firestore.
const CACHE = "debt-tracker-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./apple-touch-icon.png"];
const FIREBASE_SDK = "https://www.gstatic.com/firebasejs/";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  // Firebase SDK files are versioned in the URL, so they never change.
  const sdk = request.url.startsWith(FIREBASE_SDK);
  if (!sameOrigin && !sdk) return; // leave Firestore/Auth traffic alone

  if (sdk) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
            return res;
          }),
      ),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(request, { ignoreSearch: true }).then(
          (hit) => hit || (request.mode === "navigate" ? caches.match("./index.html") : undefined),
        ),
      ),
  );
});
