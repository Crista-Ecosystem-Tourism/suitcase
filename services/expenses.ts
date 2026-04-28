import { apiDelete, apiGet, apiPatch, apiPost } from './api';

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
    const created = await apiPost<ServerExpense>(
        `/suitcase/trips/${expenseData.trip_id}/expenses`,
        toServerCreate(expenseData)
    );
    return created.id;
};

export const getExpensesByTrip = async (tripId: string): Promise<Expense[]> => {
    const ws = await apiGet<{ expenses: ServerExpense[] }>('/suitcase/workspace');
    return ws.expenses.filter((e) => e.trip_id === tripId).map(fromServer);
};

export const getExpenseById = async (id: string): Promise<Expense | null> => {
    try {
        const ws = await apiGet<{ expenses: ServerExpense[] }>('/suitcase/workspace');
        const found = ws.expenses.find((e) => e.id === id);
        return found ? fromServer(found) : null;
    } catch {
        return null;
    }
};

export const updateExpense = async (id: string, data: Partial<Expense>): Promise<void> => {
    await apiPatch<ServerExpense>(`/suitcase/expenses/${id}`, toServerPatch(data));
};

export const deleteExpense = async (id: string): Promise<void> => {
    await apiDelete(`/suitcase/expenses/${id}`);
};
