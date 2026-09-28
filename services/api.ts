import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiBaseUrl, IdentityApiBaseUrl } from '../constants/Config';
import { resolveApiUrl } from './apiRouting.js';
import {
    readOfflineMutations,
    resolveOfflineConflict,
    readWorkspaceSnapshot,
    replaceOfflineMutations,
    writeWorkspaceSnapshot,
    type WorkspaceSnapshot,
} from './offline';

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

export interface PresenceConsent {
    granted: boolean;
    policy_version: string | null;
    verification_available: false;
    fallback: 'no_reward';
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

async function syncOfflineMutations(): Promise<void> {
    const user = await getStoredUser();
    if (!user) return;
    const queue = await readOfflineMutations(user.id);
    if (!queue.length) return;

    const remaining = [...queue];
    while (remaining.length) {
        const mutation = remaining[0];
        if (mutation.status === 'conflict') break;
        let response: Response;
        try {
            response = await fetch(requestUrl(mutation.path), {
                method: mutation.method,
                headers: await buildHeaders(mutation.body ? { 'Content-Type': 'application/json' } : undefined),
                body: mutation.body ? JSON.stringify(mutation.body) : undefined,
            });
        } catch {
            break;
        }
        if (response.status === 409) {
            remaining[0] = { ...mutation, status: 'conflict', conflictMessage: 'Данные изменились на другом устройстве' };
            await replaceOfflineMutations(user.id, remaining);
            break;
        }
        if (!response.ok && !(mutation.method === 'DELETE' && response.status === 404)) break;
        remaining.shift();
        await replaceOfflineMutations(user.id, remaining);
    }
}

function requestUrl(path: string): string {
    return resolveApiUrl(path, ApiBaseUrl, IdentityApiBaseUrl);
}

export async function apiGet<T>(path: string, tokenOverride?: string): Promise<T> {
    if (path === '/suitcase/workspace' && !tokenOverride) await syncOfflineMutations();
    try {
        const r = await fetch(requestUrl(path), {
            method: 'GET',
            headers: await buildHeaders(undefined, tokenOverride),
        });
        const data = await parse<T>(r);
        if (path === '/suitcase/workspace' && !tokenOverride) {
            const user = await getStoredUser();
            if (user) await writeWorkspaceSnapshot(user.id, data as WorkspaceSnapshot);
        }
        return data;
    } catch (error) {
        if (path !== '/suitcase/workspace' || tokenOverride || !(error instanceof TypeError)) throw error;
        const user = await getStoredUser();
        const snapshot = user ? await readWorkspaceSnapshot(user.id) : null;
        if (!snapshot) throw error;
        return snapshot as T;
    }
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

export async function getPendingOfflineMutationCount(): Promise<number> {
    const user = await getStoredUser();
    if (!user) return 0;
    return (await readOfflineMutations(user.id)).filter(item => item.status !== 'conflict').length;
}

export async function getOfflineConflicts() {
    const user = await getStoredUser();
    if (!user) return [];
    return (await readOfflineMutations(user.id)).filter(item => item.status === 'conflict');
}

export async function resolveOfflineSyncConflict(
    mutationId: string,
    resolution: 'keep-local' | 'keep-server',
): Promise<void> {
    const user = await getStoredUser();
    if (!user) return;
    await resolveOfflineConflict(user.id, mutationId, resolution);
}

export function getAccountPreferences(tokenOverride?: string): Promise<AccountPreferences> {
    return apiGet<AccountPreferences>('/auth/preferences', tokenOverride);
}

export function saveAccountPreferences(preferences: AccountPreferences, tokenOverride?: string): Promise<AccountPreferences> {
    return apiPut<AccountPreferences>('/auth/preferences', preferences, tokenOverride);
}

export function getPresenceConsent(): Promise<PresenceConsent> {
    return apiGet<PresenceConsent>('/vision/presence-consent');
}

export function savePresenceConsent(granted: boolean): Promise<PresenceConsent> {
    return apiPut<PresenceConsent>('/vision/presence-consent', { granted, policy_version: 'presence-v1' });
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
