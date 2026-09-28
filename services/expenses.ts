import { apiDelete, apiGet, apiPatch, apiPost } from './api';
import { getStoredUser } from './api';
import { createClientRequestId, enqueueOfflineMutation, isNetworkError, readWorkspaceSnapshot, updateWorkspaceSnapshot } from './offline';

export interface Expense {
    id?: string;
    trip_id: string;
    amount: number;
    category: string;
    title: string;
    date: string;
    currency?: string;
}

interface ServerExpense {
    id: string;
    trip_id: string;
    amount: number;
    category: string;
    title: string;
    date: string;
    currency: string | null;
}

function fromServer(e: ServerExpense): Expense {
    return {
        id: e.id,
        trip_id: e.trip_id,
        amount: Number(e.amount),
        category: e.category,
        title: e.title,
        date: e.date,
        currency: e.currency || undefined,
    };
}

function toServerCreate(e: Omit<Expense, 'id'>): Record<string, unknown> {
    return {
        amount: e.amount,
        category: e.category,
        title: e.title,
        date: e.date,
        currency: e.currency ?? null,
    };
}

function toServerPatch(e: Partial<Expense>): Record<string, unknown> {
    const body: Record<string, unknown> = {};
    if (e.amount !== undefined) body.amount = e.amount;
    if (e.category !== undefined) body.category = e.category;
    if (e.title !== undefined) body.title = e.title;
    if (e.date !== undefined) body.date = e.date;
    if (e.currency !== undefined) body.currency = e.currency || null;
    return body;
}

export const addExpense = async (expenseData: Omit<Expense, 'id'>): Promise<string> => {
    const clientRequestId = createClientRequestId();
    const body = { ...toServerCreate(expenseData), client_request_id: clientRequestId };
    const path = `/suitcase/trips/${expenseData.trip_id}/expenses`;
    try {
        const created = await apiPost<ServerExpense>(path, body);
        return created.id;
    } catch (error) {
        if (!isNetworkError(error)) throw error;
        const user = await getStoredUser();
        if (!user) throw error;
        await enqueueOfflineMutation(user.id, { id: clientRequestId, method: 'POST', path, body });
        await updateWorkspaceSnapshot(user.id, snapshot => ({
            ...snapshot,
            expenses: [...snapshot.expenses, {
                id: clientRequestId,
                trip_id: expenseData.trip_id,
                ...toServerCreate(expenseData),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }],
        }));
        return clientRequestId;
    }
};

export const getExpensesByTrip = async (tripId: string): Promise<Expense[]> => {
    const ws = await apiGet<{ expenses: ServerExpense[] }>('/suitcase/workspace');
    return ws.expenses.filter((e) => e.trip_id === tripId).map(fromServer);
};

export const getExpenseById = async (id: string): Promise<Expense | null> => {
    const ws = await apiGet<{ expenses: ServerExpense[] }>('/suitcase/workspace');
    const found = ws.expenses.find((e) => e.id === id);
    return found ? fromServer(found) : null;
};

export const updateExpense = async (id: string, data: Partial<Expense>): Promise<void> => {
    const body = toServerPatch(data);
    const path = `/suitcase/expenses/${id}`;
    const user = await getStoredUser();
    const workspace = user ? await readWorkspaceSnapshot(user.id) : null;
    const cached = workspace?.expenses.find(expense => expense.id === id);
    if (typeof cached?.updated_at === 'string') body.base_updated_at = cached.updated_at;
    try {
        const updated = await apiPatch<ServerExpense>(path, body);
        if (user) {
            await updateWorkspaceSnapshot(user.id, snapshot => ({
                ...snapshot,
                expenses: snapshot.expenses.map(expense => expense.id === id ? updated : expense),
            }));
        }
    } catch (error) {
        if (!isNetworkError(error)) throw error;
        if (!user) throw error;
        await enqueueOfflineMutation(user.id, { id: createClientRequestId(), method: 'PATCH', path, body });
        const { base_updated_at: _baseUpdatedAt, ...changes } = body;
        await updateWorkspaceSnapshot(user.id, snapshot => ({
            ...snapshot,
            expenses: snapshot.expenses.map(expense => expense.id === id ? { ...expense, ...changes, updated_at: new Date().toISOString() } : expense),
        }));
    }
};

export const deleteExpense = async (id: string): Promise<void> => {
    const path = `/suitcase/expenses/${id}`;
    try {
        await apiDelete(path);
    } catch (error) {
        if (!isNetworkError(error)) throw error;
        const user = await getStoredUser();
        if (!user) throw error;
        await enqueueOfflineMutation(user.id, { id: createClientRequestId(), method: 'DELETE', path });
        await updateWorkspaceSnapshot(user.id, snapshot => ({
            ...snapshot,
            expenses: snapshot.expenses.filter(expense => expense.id !== id),
        }));
    }
};
