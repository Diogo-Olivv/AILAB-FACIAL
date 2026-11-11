/**
 * Regressão AF-17: sw.js fallback de navegação offline.
 *
 * Antes: `caches.match(a) || caches.match(b)` comparava uma Promise (sempre truthy),
 * então sem index.html em cache o respondWith recebia undefined.
 * Carregamos o sw.js real com self/caches/fetch falsos, sem navegador.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";

const SW_PATH = fileURLToPath(new URL("../../public/sw.js", import.meta.url));
const SW_SOURCE = readFileSync(SW_PATH, "utf8");
const ORIGIN = "https://app.example";

type Handler = (event: FakeEvent) => void;
interface FakeEvent {
  request: { method: string; url: string; mode: string };
  respondWith: (value: Promise<Response | undefined>) => void;
  response?: Promise<Response | undefined>;
}

function loadServiceWorker(cached: Record<string, string>, network: () => Promise<Response>): Handler {
  const listeners: Record<string, Handler> = {};
  const self = {
    addEventListener: (type: string, fn: Handler) => {
      listeners[type] = fn;
    },
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve() },
  };
  const store = new Map(Object.entries(cached));
  const caches = {
    match: async (input: string | { url: string }) => {
      const key = typeof input === "string" ? input : input.url;
      const body = store.get(key);
      return body === undefined ? undefined : new Response(body, { status: 200 });
    },
    open: async () => ({ put: async () => undefined, addAll: async () => undefined }),
  };
  const fetchImpl = () => network();
  const location = new URL(`${ORIGIN}/`);

  new Function("self", "caches", "fetch", "location", "URL", "Response", "console", SW_SOURCE)(
    self,
    caches,
    fetchImpl,
    location,
    URL,
    Response,
    console,
  );
  const fetchHandler = listeners["fetch"];
  assert.ok(fetchHandler, "sw.js deve registrar um listener de fetch");
  return fetchHandler;
}

function navigate(handler: Handler): Promise<Response | undefined> {
  const event: FakeEvent = {
    request: { method: "GET", url: `${ORIGIN}/recognize`, mode: "navigate" },
    respondWith(value) {
      this.response = value;
    },
  };
  handler(event);
  assert.ok(event.response, "navegação deve chamar respondWith");
  return event.response;
}

const offline = () => Promise.reject(new TypeError("Failed to fetch"));

test("navegação offline sem nenhum shell em cache responde 503, nunca undefined", async () => {
  const handler = loadServiceWorker({}, offline);
  const response = await navigate(handler);
  assert.ok(response instanceof Response, "respondWith deve receber um Response");
  assert.equal(response.status, 503);
});

test("navegação offline com index.html em cache devolve o shell", async () => {
  const handler = loadServiceWorker({ "./index.html": "<html>shell</html>" }, offline);
  const response = await navigate(handler);
  assert.ok(response instanceof Response);
  assert.equal(await response.text(), "<html>shell</html>");
});

test("navegação offline sem index.html mas com './' em cache usa o fallback '/'", async () => {
  const handler = loadServiceWorker({ "./": "<html>raiz</html>" }, offline);
  const response = await navigate(handler);
  assert.ok(response instanceof Response);
  assert.equal(await response.text(), "<html>raiz</html>");
});
