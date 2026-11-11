/**
 * Regressão AF-04: o totem não pode se considerar ativado por causa de uma chave
 * embutida na build, nem existir credencial de reserva para chamar a API.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { isKioskSession, resolveBearerToken } from "./kioskAuth.ts";

const KEY_NAME = "EXPO_PUBLIC_KIOSK_KEY";
let original: string | undefined;

beforeEach(() => {
  original = process.env[KEY_NAME];
});

afterEach(() => {
  if (original === undefined) delete process.env[KEY_NAME];
  else process.env[KEY_NAME] = original;
});

describe("isKioskSession", () => {
  test("aceita sessão de conta com papel kiosk em app_metadata", () => {
    assert.equal(isKioskSession({ user: { app_metadata: { role: "kiosk" } } }), true);
  });

  test("recusa tutor, papel vazio, sessão vazia e ausência de sessão", () => {
    assert.equal(isKioskSession({ user: { app_metadata: { role: "tutor" } } }), false);
    assert.equal(isKioskSession({ user: { app_metadata: {} } }), false);
    assert.equal(isKioskSession({ user: {} }), false);
    assert.equal(isKioskSession({}), false);
    assert.equal(isKioskSession(null), false);
    assert.equal(isKioskSession(undefined), false);
  });

  test("não aceita o papel vindo de user_metadata (editável pelo cliente)", () => {
    const forged = { user: { user_metadata: { role: "kiosk" } } } as unknown as Parameters<typeof isKioskSession>[0];
    assert.equal(isKioskSession(forged), false);
  });

  test("chave embutida na build NÃO torna o dispositivo um totem ativado", () => {
    process.env[KEY_NAME] = "qualquer-valor-nao-vazio";
    assert.equal(isKioskSession(null), false);
    assert.equal(isKioskSession({ user: { app_metadata: { role: "tutor" } } }), false);
  });
});

describe("resolveBearerToken", () => {
  test("usa o token do tutor quando há sessão de tutor", () => {
    assert.equal(resolveBearerToken("tutor-jwt", "kiosk-jwt"), "tutor-jwt");
  });

  test("usa o token do totem quando não há sessão de tutor", () => {
    assert.equal(resolveBearerToken(undefined, "kiosk-jwt"), "kiosk-jwt");
    assert.equal(resolveBearerToken(null, "kiosk-jwt"), "kiosk-jwt");
    assert.equal(resolveBearerToken("", "kiosk-jwt"), "kiosk-jwt");
  });

  test("sem nenhuma sessão não existe credencial: devolve null", () => {
    assert.equal(resolveBearerToken(undefined, undefined), null);
    assert.equal(resolveBearerToken(null, null), null);
    assert.equal(resolveBearerToken("", ""), null);
  });

  test("chave embutida na build NÃO é usada como credencial de reserva", () => {
    process.env[KEY_NAME] = "qualquer-valor-nao-vazio";
    assert.equal(resolveBearerToken(undefined, undefined), null);
  });
});
