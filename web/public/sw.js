/**
 * Service Worker para AILAB Makers PWA
 * - Estratégia de cache resiliente para suporte offline e instalabilidade
 * - Cache-first para assets estáticos e fontes
 * - Network-first para navegação de páginas com fallback seguro
 */

const CACHE_NAME = "ailab-makers-v1";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./favicon.ico",
  "./icons/favicon.png",
  "./icons/icon-192x192.png",
  "./icons/icon-512x512.png",
  "./icons/icon-maskable-512x512.png",
  "./icons/apple-touch-icon.png"
];

// Instalação do Service Worker e pré-cache de ativos essenciais
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS).catch((err) => {
        console.warn("[PWA SW] Aviso ao pré-armazenar assets:", err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Ativação e limpeza de caches obsoletos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptação de requisições
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignora requisições não-GET e chamadas à API/Supabase (devem ser sempre live)
  if (request.method !== "GET" || url.origin !== location.origin && !url.hostname.includes("fonts.g")) {
    return;
  }

  // Requisições de navegação (HTML): Network-first com fallback para cache
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match("./index.html") || caches.match("./");
      })
    );
    return;
  }

  // Ativos estáticos e fontes: Cache-first com revalidação em segundo plano
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Revalida em background
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });
        return networkResponse;
      });
    })
  );
});
