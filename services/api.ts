import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiBaseUrl, IdentityApiBaseUrl } from '../constants/Config';
import { resolveApiUrl } from './apiRouting.js';

const TOKEN_KEY = 'crista_token';
const USER_KEY = 'crista_user';

export interface CristaUser {
    id: string;
    email: string;
    name: string | null;
}

export class ApiError extends Error {
    status: number;
    detail: string;
    constructor(status: number, detail: string) {
        super(detail);
        this.name = 'ApiError';
        this.status = status;
        this.detail = detail;
    }
}

export interface AccountPreferences {
    theme: 'light' | 'dark';
    language: 'ru' | 'en';
}

let memoryToken: string | null = null;
let memoryUser: CristaUser | null = null;

export async function getToken(): Promise<string | null> {
    if (memoryToken) return memoryToken;
    try {
        const t = await AsyncStorage.getItem(TOKEN_KEY);
        memoryToken = t;
        return t;
    } catch {
        return null;
    }
}

export async function setToken(token: string | null): Promise<void> {
    memoryToken = token;
    try {
        if (token) {
            await AsyncStorage.setItem(TOKEN_KEY, token);
        } else {
            await AsyncStorage.removeItem(TOKEN_KEY);
        }
    } catch {
        /* ignore */
    }
}

export async function getStoredUser(): Promise<CristaUser | null> {
    if (memoryUser) return memoryUser;
    try {
        const raw = await AsyncStorage.getItem(USER_KEY);
        if (!raw) return null;
        memoryUser = JSON.parse(raw) as CristaUser;
        return memoryUser;
    } catch {
        return null;
    }
}

export async function setStoredUser(user: CristaUser | null): Promise<void> {
    memoryUser = user;
    try {
        if (user) {
            await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
        } else {
            await AsyncStorage.removeItem(USER_KEY);
        }
    } catch {
        /* ignore */
    }
}

async function buildHeaders(extra?: Record<string, string>, tokenOverride?: string): Promise<Record<string, string>> {
    const token = tokenOverride ?? await getToken();
    const headers: Record<string, string> = {
        Accept: 'application/json',
        ...(extra || {}),
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

async function parse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        let detail = `HTTP ${response.status}`;
        try {
            const body = await response.json();
            detail = body?.detail || body?.message || detail;
        } catch {
            /* not json */
        }
        throw new ApiError(response.status, detail);
    }
    if (response.status === 204) return undefined as unknown as T;
    return (await response.json()) as T;
}

function requestUrl(path: string): string {
    return resolveApiUrl(path, ApiBaseUrl, IdentityApiBaseUrl);
}

export async function apiGet<T>(path: string, tokenOverride?: string): Promise<T> {
    const r = await fetch(requestUrl(path), {
        method: 'GET',
        headers: await buildHeaders(undefined, tokenOverride),
    });
    return parse<T>(r);
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
    const r = await fetch(requestUrl(path), {
        method: 'POST',
        headers: await buildHeaders({ 'Content-Type': 'application/json' }),
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return parse<T>(r);
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
    const r = await fetch(requestUrl(path), {
        method: 'PATCH',
        headers: await buildHeaders({ 'Content-Type': 'application/json' }),
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return parse<T>(r);
}

export async function apiDelete<T = { ok: boolean }>(path: string): Promise<T> {
    const r = await fetch(requestUrl(path), {
        method: 'DELETE',
        headers: await buildHeaders(),
    });
    return parse<T>(r);
}

export async function apiPut<T>(path: string, body: unknown, tokenOverride?: string): Promise<T> {
    const r = await fetch(requestUrl(path), {
        method: 'PUT',
        headers: await buildHeaders({ 'Content-Type': 'application/json' }, tokenOverride),
        body: JSON.stringify(body),
    });
    return parse<T>(r);
}

export function getAccountPreferences(tokenOverride?: string): Promise<AccountPreferences> {
    return apiGet<AccountPreferences>('/auth/preferences', tokenOverride);
}

export function saveAccountPreferences(preferences: AccountPreferences, tokenOverride?: string): Promise<AccountPreferences> {
    return apiPut<AccountPreferences>('/auth/preferences', preferences, tokenOverride);
}

// --- Auth API ---

interface AuthResponse {
    access_token: string;
    user: CristaUser;
}

export async function loginWithEmail(email: string, password: string): Promise<CristaUser> {
    const data = await apiPost<AuthResponse>('/auth/login', {
        email: email.trim().toLowerCase(),
        password,
    });
    await setToken(data.access_token);
    await setStoredUser(data.user);
    return data.user;
}

export async function registerWithEmail(email: string, password: string, name: string): Promise<CristaUser> {
    const data = await apiPost<AuthResponse>('/auth/register', {
        email: email.trim().toLowerCase(),
        password,
        name,
    });
    await setToken(data.access_token);
    await setStoredUser(data.user);
    return data.user;
}

export async function fetchMe(): Promise<CristaUser> {
    const me = await apiGet<CristaUser>('/auth/me');
    await setStoredUser(me);
    return me;
}

export async function logout(): Promise<void> {
    await setToken(null);
    await setStoredUser(null);
}
