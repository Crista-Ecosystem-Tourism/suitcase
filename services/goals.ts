import { apiGet, apiPost } from './api';

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
