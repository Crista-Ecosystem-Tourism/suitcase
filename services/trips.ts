import { apiDelete, apiGet, apiPatch, apiPost } from './api';

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
    const created = await apiPost<ServerTrip>('/suitcase/trips', toServerCreate(tripData));
    return created.id;
};

export const getTrips = async (): Promise<Trip[]> => {
    const ws = await apiGet<{ trips: ServerTrip[] }>('/suitcase/workspace');
    return ws.trips.map(fromServer);
};

export const getAllTrips = getTrips;

export const getTripById = async (id: string): Promise<Trip | null> => {
    try {
        const ws = await apiGet<{ trips: ServerTrip[] }>('/suitcase/workspace');
        const found = ws.trips.find((t) => t.id === id);
        return found ? fromServer(found) : null;
    } catch {
        return null;
    }
};

export const updateTrip = async (id: string, data: Partial<Trip>): Promise<void> => {
    await apiPatch<ServerTrip>(`/suitcase/trips/${id}`, toServerPatch(data));
};

export const deleteTrip = async (id: string): Promise<void> => {
    await apiDelete(`/suitcase/trips/${id}`);
};
