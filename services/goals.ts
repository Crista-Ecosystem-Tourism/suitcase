import { apiDelete, apiGet, apiPatch, apiPost } from './api';

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
    return apiPost<SuitcaseGoal>('/suitcase/goals', goal);
}

export async function updateGoal(id: string, goal: Partial<Omit<SuitcaseGoal, 'id'>>): Promise<SuitcaseGoal> {
    return apiPatch<SuitcaseGoal>(`/suitcase/goals/${id}`, goal);
}

export async function deleteGoal(id: string): Promise<void> {
    await apiDelete(`/suitcase/goals/${id}`);
}
