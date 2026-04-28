import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
    CristaUser,
    fetchMe,
    getStoredUser,
    getToken,
    loginWithEmail,
    logout as apiLogout,
    registerWithEmail,
} from '../services/api';

interface AuthContextValue {
    user: CristaUser | null;
    initializing: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, name: string) => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<CristaUser | null>(null);
    const [initializing, setInitializing] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const token = await getToken();
            if (!token) {
                if (!cancelled) {
                    setUser(null);
                    setInitializing(false);
                }
                return;
            }
            const cached = await getStoredUser();
            if (!cancelled && cached) setUser(cached);
            try {
                const fresh = await fetchMe();
                if (!cancelled) setUser(fresh);
            } catch {
                if (!cancelled) {
                    await apiLogout();
                    setUser(null);
                }
            } finally {
                if (!cancelled) setInitializing(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        const u = await loginWithEmail(email, password);
        setUser(u);
    }, []);

    const register = useCallback(async (email: string, password: string, name: string) => {
        const u = await registerWithEmail(email, password, name);
        setUser(u);
    }, []);

    const signOut = useCallback(async () => {
        await apiLogout();
        setUser(null);
    }, []);

    const value = useMemo<AuthContextValue>(
        () => ({ user, initializing, login, register, signOut }),
        [user, initializing, login, register, signOut]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
}
