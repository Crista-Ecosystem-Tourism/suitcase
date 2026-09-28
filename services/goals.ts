import { apiDelete, apiGet, apiPatch, apiPost } from './api';
import { getStoredUser } from './api';
import {
    createClientRequestId,
    enqueueOfflineMutation,
    isNetworkError,
    readWorkspaceSnapshot,
    updateWorkspaceSnapshot,
    writeWorkspaceSnapshot,
} from './offline';

export interface SuitcaseGoal {
    id: string;
    title: string;
    current: number;
    total: number;
    color: string;
}

export async function getGoals(): Promise<SuitcaseGoal[]> {
    const workspace = await apiGet<{ goals: SuitcaseGoal[] }>('/suitcase/workspace');
    return workspace.goals;
}

export async function createGoal(goal: Omit<SuitcaseGoal, 'id'>): Promise<SuitcaseGoal> {
    const clientRequestId = createClientRequestId();
    const body = { ...goal, client_request_id: clientRequestId };
    try {
        return await apiPost<SuitcaseGoal>('/suitcase/goals', body);
    } catch (error) {
        if (!isNetworkError(error)) throw error;
        const user = await getStoredUser();
        if (!user) throw error;
        const pendingGoal: SuitcaseGoal = { ...goal, id: clientRequestId };
        await enqueueOfflineMutation(user.id, { id: clientRequestId, method: 'POST', path: '/suitcase/goals', body });
        await updateWorkspaceSnapshot(user.id, snapshot => ({ ...snapshot, goals: [...snapshot.goals, pendingGoal] }));
        return pendingGoal;
    }
}

export async function updateGoal(id: string, goal: Partial<Omit<SuitcaseGoal, 'id'>>): Promise<SuitcaseGoal> {
    const path = `/suitcase/goals/${id}`;
    const user = await getStoredUser();
    const workspace = user ? await readWorkspaceSnapshot(user.id) : null;
    const cached = workspace?.goals.find(item => item.id === id);
    const body: Record<string, unknown> = { ...goal };
    if (typeof cached?.updated_at === 'string') body.base_updated_at = cached.updated_at;
    try {
        const updated = await apiPatch<SuitcaseGoal>(path, body);
        if (user) {
            await updateWorkspaceSnapshot(user.id, snapshot => ({
                ...snapshot,
                goals: snapshot.goals.map(item => item.id === id ? updated : item),
            }));
        }
        return updated;
    } catch (error) {
        if (!isNetworkError(error)) throw error;
        if (!user) throw error;
        const current = workspace?.goals.find(item => item.id === id) as SuitcaseGoal | undefined;
        if (!workspace || !current) throw error;
        await enqueueOfflineMutation(user.id, { id: createClientRequestId(), method: 'PATCH', path, body });
        const updated: SuitcaseGoal = { ...current, ...goal };
        await writeWorkspaceSnapshot(user.id, {
            ...workspace,
            goals: workspace.goals.map(item => item.id === id ? updated : item),
        });
        return updated;
    }
}

export async function deleteGoal(id: string): Promise<void> {
    const user = await getStoredUser();
    const workspace = user ? await readWorkspaceSnapshot(user.id) : null;
    const cached = workspace?.goals.find(goal => goal.id === id);
    const baseUpdatedAt = typeof cached?.updated_at === 'string'
        ? `?base_updated_at=${encodeURIComponent(cached.updated_at)}`
        : '';
    const path = `/suitcase/goals/${id}${baseUpdatedAt}`;
    try {
        await apiDelete(path);
    } catch (error) {
        if (!isNetworkError(error)) throw error;
        if (!user) throw error;
        await enqueueOfflineMutation(user.id, { id: createClientRequestId(), method: 'DELETE', path });
        await updateWorkspaceSnapshot(user.id, snapshot => ({
            ...snapshot,
            goals: snapshot.goals.filter(goal => goal.id !== id),
        }));
    }
}
