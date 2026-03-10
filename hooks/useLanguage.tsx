import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, Language } from '../constants/Translations';

const LANG_KEY = '@app_language';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => Promise<void>;
    t: typeof translations.en;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }): JSX.Element => {
    const [language, setLanguageState] = useState<Language>('ru');

    useEffect(() => {
        loadLanguage();
    }, []);

    const loadLanguage = async () => {
        try {
            const saved = await AsyncStorage.getItem(LANG_KEY);
            if (saved === 'ru' || saved === 'en') {
                setLanguageState(saved);
            }
        } catch (e) {
            console.error('Failed to load language', e);
        }
    };

    const setLanguage = async (newLang: Language) => {
        try {
            await AsyncStorage.setItem(LANG_KEY, newLang);
            setLanguageState(newLang);
        } catch (e) {
            console.error('Failed to save language', e);
        }
    };

    const t = translations[language];

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }
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
