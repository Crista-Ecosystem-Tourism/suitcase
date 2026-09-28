import AsyncStorage from '@react-native-async-storage/async-storage';

export interface WorkspaceSnapshot {
    trips: Record<string, unknown>[];
    expenses: Record<string, unknown>[];
    goals: Record<string, unknown>[];
}

export interface OfflineMutation {
    id: string;
    method: 'POST' | 'PATCH' | 'DELETE';
    path: string;
    body?: Record<string, unknown>;
}

const workspaceKey = (userId: string) => `crista_offline_workspace:${userId}`;
const queueKey = (userId: string) => `crista_offline_queue:${userId}`;

export function createClientRequestId(): string {
    return `offline_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
}

export function isNetworkError(error: unknown): boolean {
    return error instanceof TypeError;
}

export async function readWorkspaceSnapshot(userId: string): Promise<WorkspaceSnapshot | null> {
    try {
        const raw = await AsyncStorage.getItem(workspaceKey(userId));
        if (!raw) return null;
        const snapshot = JSON.parse(raw) as WorkspaceSnapshot;
        if (!Array.isArray(snapshot.trips) || !Array.isArray(snapshot.expenses) || !Array.isArray(snapshot.goals)) {
            return null;
        }
        return snapshot;
    } catch {
        return null;
    }
}

export async function writeWorkspaceSnapshot(userId: string, snapshot: WorkspaceSnapshot): Promise<void> {
    try {
        await AsyncStorage.setItem(workspaceKey(userId), JSON.stringify(snapshot));
    } catch {
        // The server remains the source of truth if the device cannot persist a cache.
    }
}

export async function updateWorkspaceSnapshot(
    userId: string,
    update: (snapshot: WorkspaceSnapshot) => WorkspaceSnapshot,
): Promise<void> {
    const snapshot = await readWorkspaceSnapshot(userId);
    if (snapshot) await writeWorkspaceSnapshot(userId, update(snapshot));
}

export async function enqueueOfflineMutation(userId: string, mutation: OfflineMutation): Promise<void> {
    try {
        const raw = await AsyncStorage.getItem(queueKey(userId));
        const queue = raw ? JSON.parse(raw) as OfflineMutation[] : [];
        if (!queue.some(item => item.id === mutation.id)) {
            queue.push(mutation);
            await AsyncStorage.setItem(queueKey(userId), JSON.stringify(queue));
        }
    } catch {
        throw new Error('Не удалось сохранить действие для синхронизации');
    }
}

export async function readOfflineMutations(userId: string): Promise<OfflineMutation[]> {
    try {
        const raw = await AsyncStorage.getItem(queueKey(userId));
        return raw ? JSON.parse(raw) as OfflineMutation[] : [];
    } catch {
        return [];
    }
}

export async function replaceOfflineMutations(userId: string, queue: OfflineMutation[]): Promise<void> {
    try {
        await AsyncStorage.setItem(queueKey(userId), JSON.stringify(queue));
    } catch {
        // Keep the in-memory flow usable; a later workspace refresh reconciles the server state.
    }
}
