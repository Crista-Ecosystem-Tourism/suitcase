import { apiDelete, apiGet, apiPatch, apiPost } from './api';
import { createClientRequestId, enqueueOfflineMutation, isNetworkError, readWorkspaceSnapshot, updateWorkspaceSnapshot } from './offline';
import { getStoredUser } from './api';

export interface Trip {
    id?: string;
    country: string;
    city: string;
    startDate: string;
    endDate: string;
    image?: string;
    mood?: string;
    route_json?: string;
    impressions?: string;
    photos?: string[];
    isArchived?: boolean;
    createdAt?: string;
    membershipRole?: 'owner' | 'member';
}

interface ServerTrip {
    id: string;
    country: string;
    city: string;
    start_date: string;
    end_date: string;
    image: string | null;
    mood: string | null;
    route_json: string | null;
    impressions: string | null;
    photos: string[] | null;
    is_archived: boolean;
    created_at: string | null;
    updated_at: string | null;
    membership_role: 'owner' | 'member' | null;
}

function fromServer(t: ServerTrip): Trip {
    return {
        id: t.id,
        country: t.country,
        city: t.city,
        startDate: t.start_date,
        endDate: t.end_date,
        image: t.image || undefined,
        mood: t.mood || undefined,
        route_json: t.route_json || undefined,
        impressions: t.impressions || undefined,
        photos: t.photos || undefined,
        isArchived: t.is_archived,
        createdAt: t.created_at || undefined,
        membershipRole: t.membership_role || undefined,
    };
}

function toServerCreate(t: Omit<Trip, 'id' | 'createdAt'>): Record<string, unknown> {
    return {
        country: t.country,
        city: t.city,
        start_date: t.startDate,
        end_date: t.endDate,
        image: t.image ?? null,
        mood: t.mood ?? null,
        route_json: t.route_json ?? null,
        impressions: t.impressions ?? null,
        photos: t.photos ?? null,
        is_archived: t.isArchived ?? false,
    };
}

function toServerPatch(t: Partial<Trip>): Record<string, unknown> {
    const body: Record<string, unknown> = {};
    if (t.country !== undefined) body.country = t.country;
    if (t.city !== undefined) body.city = t.city;
    if (t.startDate !== undefined) body.start_date = t.startDate;
    if (t.endDate !== undefined) body.end_date = t.endDate;
    if (t.image !== undefined) body.image = t.image || null;
    if (t.mood !== undefined) body.mood = t.mood || null;
    if (t.route_json !== undefined) body.route_json = t.route_json || null;
    if (t.impressions !== undefined) body.impressions = t.impressions || null;
    if (t.photos !== undefined) body.photos = t.photos;
    if (t.isArchived !== undefined) body.is_archived = t.isArchived;
    return body;
}

export const addTrip = async (tripData: Omit<Trip, 'id' | 'createdAt'>): Promise<string> => {
    const clientRequestId = createClientRequestId();
    const body = { ...toServerCreate(tripData), client_request_id: clientRequestId };
    try {
        const created = await apiPost<ServerTrip>('/suitcase/trips', body);
        return created.id;
    } catch (error) {
        if (!isNetworkError(error)) throw error;
        const user = await getStoredUser();
        if (!user) throw error;
        await enqueueOfflineMutation(user.id, { id: clientRequestId, method: 'POST', path: '/suitcase/trips', body });
        await updateWorkspaceSnapshot(user.id, snapshot => ({
            ...snapshot,
            trips: [{
                id: clientRequestId,
                country: tripData.country,
                city: tripData.city,
                start_date: tripData.startDate,
                end_date: tripData.endDate,
                image: tripData.image ?? null,
                mood: tripData.mood ?? null,
                route_json: tripData.route_json ?? null,
                impressions: tripData.impressions ?? null,
                photos: tripData.photos ?? null,
                is_archived: tripData.isArchived ?? false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }, ...snapshot.trips],
        }));
        return clientRequestId;
    }
};

export const getTrips = async (): Promise<Trip[]> => {
    const ws = await apiGet<{ trips: ServerTrip[] }>('/suitcase/workspace');
    return ws.trips.map(fromServer);
};

export const getAllTrips = getTrips;

export const getTripById = async (id: string): Promise<Trip | null> => {
    const ws = await apiGet<{ trips: ServerTrip[] }>('/suitcase/workspace');
    const found = ws.trips.find((t) => t.id === id);
    return found ? fromServer(found) : null;
};

export const updateTrip = async (id: string, data: Partial<Trip>): Promise<void> => {
    const body = toServerPatch(data);
    const path = `/suitcase/trips/${id}`;
    const user = await getStoredUser();
    const workspace = user ? await readWorkspaceSnapshot(user.id) : null;
    const cached = workspace?.trips.find(trip => trip.id === id);
    if (typeof cached?.updated_at === 'string') body.base_updated_at = cached.updated_at;
    try {
        const updated = await apiPatch<ServerTrip>(path, body);
        if (user) {
            await updateWorkspaceSnapshot(user.id, snapshot => ({
                ...snapshot,
                trips: snapshot.trips.map(trip => trip.id === id ? updated : trip),
            }));
        }
    } catch (error) {
        if (!isNetworkError(error)) throw error;
        if (!user) throw error;
        await enqueueOfflineMutation(user.id, { id: createClientRequestId(), method: 'PATCH', path, body });
        const { base_updated_at: _baseUpdatedAt, ...changes } = body;
        await updateWorkspaceSnapshot(user.id, snapshot => ({
            ...snapshot,
            trips: snapshot.trips.map(trip => trip.id === id ? { ...trip, ...changes, updated_at: new Date().toISOString() } : trip),
        }));
    }
};

export const deleteTrip = async (id: string): Promise<void> => {
    const user = await getStoredUser();
    const workspace = user ? await readWorkspaceSnapshot(user.id) : null;
    const cached = workspace?.trips.find(trip => trip.id === id);
    const baseUpdatedAt = typeof cached?.updated_at === 'string'
        ? `?base_updated_at=${encodeURIComponent(cached.updated_at)}`
        : '';
    const path = `/suitcase/trips/${id}${baseUpdatedAt}`;
    try {
        await apiDelete(path);
    } catch (error) {
        if (!isNetworkError(error)) throw error;
        if (!user) throw error;
        await enqueueOfflineMutation(user.id, { id: createClientRequestId(), method: 'DELETE', path });
        await updateWorkspaceSnapshot(user.id, snapshot => ({
            trips: snapshot.trips.filter(trip => trip.id !== id),
            expenses: snapshot.expenses.filter(expense => expense.trip_id !== id),
            goals: snapshot.goals,
        }));
    }
};
