/**
 * Gerenciador de fila offline resiliente para totens acadêmicos (AILAB-FACIAL)
 * Armazena presenças localmente quando a rede Wi-Fi do campus oscilar ou cair.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface OfflineAttendanceRecord {
  id: string;
  timestamp: string; // ISO string do momento exato do registro
  action: "check_in" | "check_out" | null;
  name?: string;
  attempts: number;
  lastAttempt?: string;
  status: "pending" | "failed";
}

const OFFLINE_QUEUE_KEY = "@ailab_offline_attendance_queue";
const MAX_RETRIES = 5;

/**
 * Salva um evento de presença no buffer offline local
 */
export async function enqueueOfflineAttendance(
  record: Omit<OfflineAttendanceRecord, "id" | "attempts" | "status">
): Promise<OfflineAttendanceRecord> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue: OfflineAttendanceRecord[] = raw ? JSON.parse(raw) : [];

    const newRecord: OfflineAttendanceRecord = {
      ...record,
      id: `offline_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      attempts: 0,
      status: "pending",
    };

    queue.push(newRecord);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    return newRecord;
  } catch (err) {
    console.warn("[OfflineQueue] Falha ao persistir evento offline:", err);
    throw err;
  }
}

/**
 * Retorna todos os registros de presença offline pendentes
 */
export async function getPendingOfflineRecords(): Promise<OfflineAttendanceRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const queue: OfflineAttendanceRecord[] = JSON.parse(raw);
    return queue.filter((item) => item.status === "pending");
  } catch {
    return [];
  }
}

/**
 * Retorna o total de presenças pendentes de sincronização
 */
export async function getOfflineQueueCount(): Promise<number> {
  try {
    const records = await getPendingOfflineRecords();
    return records.length;
  } catch {
    return 0;
  }
}

/**
 * Remove um registro sincronizado da fila offline
 */
export async function removeOfflineRecord(id: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return;
    const queue: OfflineAttendanceRecord[] = JSON.parse(raw);
    const updated = queue.filter((item) => item.id !== id);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("[OfflineQueue] Falha ao remover evento da fila:", err);
  }
}

/**
 * Marca uma tentativa com falha de sincronização (incrementa retry)
 */
export async function markRecordAttemptFailed(id: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return;
    const queue: OfflineAttendanceRecord[] = JSON.parse(raw);
    const updated = queue.map((item) => {
      if (item.id === id) {
        const nextAttempts = item.attempts + 1;
        return {
          ...item,
          attempts: nextAttempts,
          lastAttempt: new Date().toISOString(),
          status: nextAttempts >= MAX_RETRIES ? ("failed" as const) : ("pending" as const),
        };
      }
      return item;
    });
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("[OfflineQueue] Falha ao atualizar status de tentativa:", err);
  }
}

/**
 * Limpa toda a fila offline
 */
export async function clearOfflineQueue(): Promise<void> {
  try {
    await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
  } catch (err) {
    console.warn("[OfflineQueue] Falha ao limpar fila:", err);
  }
}
