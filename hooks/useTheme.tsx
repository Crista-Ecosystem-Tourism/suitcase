import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/Colors';

const THEME_KEY = '@app_theme';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
    mode: ThemeMode;
    setMode: (mode: ThemeMode) => Promise<void>;
    colors: typeof Colors.light;
    isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }): JSX.Element => {
    const systemScheme = useColorScheme();
    const [mode, setModeState] = useState<ThemeMode>('system');

    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        try {
            const saved = await AsyncStorage.getItem(THEME_KEY);
            if (saved === 'light' || saved === 'dark' || saved === 'system') {
                setModeState(saved);
            }
        } catch (e) {
            console.error('Failed to load theme', e);
        }
    };

    const setMode = async (newMode: ThemeMode) => {
        try {
            await AsyncStorage.setItem(THEME_KEY, newMode);
            setModeState(newMode);
        } catch (e) {
            console.error('Failed to save theme', e);
        }
    };

    const currentMode = mode === 'system' ? (systemScheme || 'light') : mode;
    const colors = Colors[currentMode as 'light' | 'dark'];
    const isDark = currentMode === 'dark';

    return (
        <ThemeContext.Provider value= {{ mode, setMode, colors, isDark }
}>
    { children }
    </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme must be used within a ThemeProvider');
    return context;
};
