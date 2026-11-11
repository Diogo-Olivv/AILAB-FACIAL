import test from "node:test";
import assert from "node:assert/strict";
import {
  LEGACY_AUTH_STORAGE_KEYS,
  isTutorSession,
  normalizeCredentials,
  purgeLegacyAuthStorage,
  safeAvatarUrl,
} from "./authDecision.ts";

test("papel de tutor só vale em app_metadata", () => {
  assert.equal(isTutorSession({ user: { app_metadata: { role: "tutor" } } }), true);
  assert.equal(isTutorSession({ user: { app_metadata: { role: "kiosk" } } }), false);
  assert.equal(isTutorSession({ user: { app_metadata: {} } }), false);
  assert.equal(isTutorSession({ user: null }), false);
  assert.equal(isTutorSession(null), false);
  // user_metadata forjado não concede nada
  const forged = { user: { app_metadata: {}, user_metadata: { role: "tutor" } } };
  assert.equal(isTutorSession(forged), false);
});

test("normalizeCredentials aceita as duas ordens e o e-mail padrão", () => {
  assert.deepEqual(normalizeCredentials(" A@B.com ", "Senha ", "d@x.com"), {
    email: "a@b.com",
    password: "Senha ",
  });
  assert.deepEqual(normalizeCredentials("segredo", "A@B.com", "d@x.com"), {
    email: "a@b.com",
    password: "segredo",
  });
  assert.deepEqual(normalizeCredentials("segredo", undefined, "D@X.com"), {
    email: "d@x.com",
    password: "segredo",
  });
});

test("purgeLegacyAuthStorage remove as chaves antigas e tolera falhas", () => {
  const removed: string[] = [];
  purgeLegacyAuthStorage({ removeItem: (k) => void removed.push(k) });
  assert.deepEqual(removed, [...LEGACY_AUTH_STORAGE_KEYS]);

  assert.doesNotThrow(() =>
    purgeLegacyAuthStorage({
      removeItem: () => {
        throw new Error("blocked");
      },
    })
  );
  assert.doesNotThrow(() => purgeLegacyAuthStorage(null));
});

test("safeAvatarUrl aceita só imagem em data URL ou https", () => {
  assert.equal(safeAvatarUrl("data:image/png;base64,iVBORw0KGgo="), "data:image/png;base64,iVBORw0KGgo=");
  assert.equal(safeAvatarUrl("data:image/jpeg;base64,/9j/4AAQ"), "data:image/jpeg;base64,/9j/4AAQ");
  assert.equal(safeAvatarUrl("https://exemplo.com/a.png"), "https://exemplo.com/a.png");
  assert.equal(safeAvatarUrl("javascript:alert(1)"), null);
  assert.equal(safeAvatarUrl("data:text/html;base64,PHNjcmlwdD4="), null);
  assert.equal(safeAvatarUrl("data:image/svg+xml;base64,PHN2Zz4="), null);
  assert.equal(safeAvatarUrl("http://exemplo.com/a.png"), null);
  assert.equal(safeAvatarUrl("//exemplo.com/a.png"), null);
  assert.equal(safeAvatarUrl(""), null);
  assert.equal(safeAvatarUrl(null), null);
  assert.equal(safeAvatarUrl(42), null);
});
