import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || "https://jbahfjfvyomayrmytpdk.supabase.co";
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiYWhmamZ2eW9tYXlybXl0cGRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NzgzMDgsImV4cCI6MjEwMjU1NDMwOH0.W81hTTZ2fPPicnnOFiqNPR_V5x8S0tqNeFy9q_kOnDc";

/**
 * Armazenamento protegido (Keystore/Keychain) para a sessão do kiosk.
 *
 * A sessão serializada pode ultrapassar o tamanho recomendado por item do
 * SecureStore, então o valor é fatiado em blocos com um contador.
 * Nada relacionado a credenciais é gravado em AsyncStorage.
 */
const CHUNK_SIZE = 1800;

function chunkKey(key: string, index: number): string {
  return `${key}.${index}`;
}

function safeKey(key: string): string {
  // SecureStore aceita apenas [A-Za-z0-9._-]
  return key.replace(/[^A-Za-z0-9._-]/g, "_");
}

const secureChunkedStorage = {
  async getItem(rawKey: string): Promise<string | null> {
    const key = safeKey(rawKey);
    const countRaw = await SecureStore.getItemAsync(`${key}.n`);
    if (!countRaw) return null;
    const count = Number.parseInt(countRaw, 10);
    if (!Number.isInteger(count) || count <= 0) return null;
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(chunkKey(key, i));
      if (part == null) return null;
      parts.push(part);
    }
    return parts.join("");
  },
  async setItem(rawKey: string, value: string): Promise<void> {
    const key = safeKey(rawKey);
    const previousRaw = await SecureStore.getItemAsync(`${key}.n`);
    const previous = previousRaw ? Number.parseInt(previousRaw, 10) : 0;
    const count = Math.max(1, Math.ceil(value.length / CHUNK_SIZE));
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(
        chunkKey(key, i),
        value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
      );
    }
    await SecureStore.setItemAsync(`${key}.n`, String(count));
    for (let i = count; i < previous; i++) {
      await SecureStore.deleteItemAsync(chunkKey(key, i));
    }
  },
  async removeItem(rawKey: string): Promise<void> {
    const key = safeKey(rawKey);
    const countRaw = await SecureStore.getItemAsync(`${key}.n`);
    const count = countRaw ? Number.parseInt(countRaw, 10) : 0;
    for (let i = 0; i < count; i++) {
      await SecureStore.deleteItemAsync(chunkKey(key, i));
    }
    await SecureStore.deleteItemAsync(`${key}.n`);
  },
};

/** Armazenamento volátil: some quando o processo do app termina. */
function createMemoryStorage() {
  const data = new Map<string, string>();
  return {
    async getItem(key: string): Promise<string | null> {
      return data.has(key) ? (data.get(key) as string) : null;
    },
    async setItem(key: string, value: string): Promise<void> {
      data.set(key, value);
    },
    async removeItem(key: string): Promise<void> {
      data.delete(key);
    },
  };
}

// No preview web (desenvolvimento) não existe Keystore: a sessão do kiosk fica
// só em memória e o dispositivo precisa ser provisionado de novo a cada recarga.
const kioskStorage = Platform.OS === "web" ? createMemoryStorage() : secureChunkedStorage;

/**
 * Cliente do KIOSK: identidade persistente do dispositivo (papel `kiosk`).
 * Usado para chamar o backend de reconhecimento e ler a lista mínima de presença.
 */
export const kioskClient: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: kioskStorage,
    storageKey: "ailab-kiosk-auth",
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: { params: { eventsPerSecond: 10 } },
});

/**
 * Cliente do TUTOR: sessão temporária, só em memória, sem refresh automático.
 * Isolado do cliente do kiosk — entrar ou sair como tutor nunca altera a
 * identidade persistente do dispositivo.
 */
export const tutorClient: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: createMemoryStorage(),
    storageKey: "ailab-tutor-auth",
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

/** Compatibilidade com imports existentes: o cliente padrão é o do kiosk. */
export const supabase = kioskClient;

/** Access token atual do kiosk, ou null se o dispositivo não está provisionado. */
export async function getKioskAccessToken(): Promise<string | null> {
  const { data } = await kioskClient.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Encerra a sessão temporária do tutor sem tocar na sessão do kiosk. */
export async function endTutorSession(): Promise<void> {
  try {
    await tutorClient.auth.signOut({ scope: "local" });
  } catch {
    // Sessão já inexistente: nada a fazer.
  }
}
