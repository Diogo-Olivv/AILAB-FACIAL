// Service Worker para AILAB PWA — cache offline-first.
const CACHE = "ailab-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/storage.js",
  "./js/app.js",
  "./js/sheets-sync.js",
  "./vendor/face-api.min.js",
  "./models/tiny_face_detector_model-weights_manifest.json",
  "./models/tiny_face_detector_model-shard1",
  "./models/face_landmark_68_model-weights_manifest.json",
  "./models/face_landmark_68_model-shard1",
  "./models/face_recognition_model-weights_manifest.json",
  "./models/face_recognition_model-shard1",
  "./models/face_recognition_model-shard2",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).catch(() => hit))
  );
});
