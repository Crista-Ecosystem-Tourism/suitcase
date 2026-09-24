import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, Language } from '../constants/Translations';
import { getAccountPreferences, getToken, saveAccountPreferences } from '../services/api';

const LANG_KEY = '@app_language';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => Promise<void>;
    syncLanguageFromAccount: () => Promise<void>;
    t: typeof translations.en;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }): JSX.Element => {
    const [language, setLanguageState] = useState<Language>('ru');
    const writeQueue = useRef<Promise<void>>(Promise.resolve());
    const languageRevision = useRef(0);
    const mounted = useRef(false);

    const syncLanguageFromAccount = useCallback(async () => {
        const token = await getToken();
        if (!token) return;
        const revision = languageRevision.current;
        try {
            const preferences = await getAccountPreferences(token);
            if ((preferences.language !== 'ru' && preferences.language !== 'en') || revision !== languageRevision.current || (await getToken()) !== token) return;
            if (mounted.current) setLanguageState(preferences.language);
            await AsyncStorage.setItem(LANG_KEY, preferences.language);
        } catch {
            // Keep the device preference when the account API is unavailable.
        }
    }, []);

    useEffect(() => {
        mounted.current = true;
        let active = true;
        void (async () => {
            try {
                const saved = await AsyncStorage.getItem(LANG_KEY);
                if (active && (saved === 'ru' || saved === 'en')) setLanguageState(saved);
            } catch (e) {
                console.error('Failed to load language', e);
            }
            await syncLanguageFromAccount();
        })();
        return () => {
            active = false;
            mounted.current = false;
        };
    }, [syncLanguageFromAccount]);

    const setLanguage = useCallback(async (newLang: Language) => {
        languageRevision.current += 1;
        setLanguageState(newLang);
        writeQueue.current = writeQueue.current
            .catch(() => undefined)
            .then(async () => {
                try {
                    await AsyncStorage.setItem(LANG_KEY, newLang);
                } catch (e) {
                    console.error('Failed to save language locally', e);
                }
                const token = await getToken();
                if (!token) return;
                const preferences = await getAccountPreferences(token);
                await saveAccountPreferences({ ...preferences, language: newLang }, token);
            })
            .catch((e) => console.error('Failed to save language preference', e));
        await writeQueue.current;
    }, []);

    const t = translations[language];

    return (
        <LanguageContext.Provider value={{ language, setLanguage, syncLanguageFromAccount, t }
        }>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
    return context;
};
