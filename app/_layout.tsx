import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../services/firebase';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { LanguageProvider } from '../hooks/useLanguage';
import { ThemeProvider, useTheme } from '../hooks/useTheme';

function useProtectedRoute(user: User | null, isInitializing: boolean) {
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        if (isInitializing) return;

        const inAuthGroup = segments[0] === 'login';

        if (
            // If the user is not signed in and the initial segment is not the login group
            !user &&
            !inAuthGroup
        ) {
            router.replace('/login');
        } else if (user && inAuthGroup) {
            router.replace('/(tabs)');
        }
    }, [user, segments, isInitializing]);
}

function NavigationContent() {
    const { colors } = useTheme();
    const [user, setUser] = useState<User | null>(null);
    const [isInitializing, setIsInitializing] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (usr) => {
            setUser(usr);
            if (isInitializing) setIsInitializing(false);
        });

        return unsubscribe;
    }, []);

    useProtectedRoute(user, isInitializing);

    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: colors.card },
                headerTintColor: colors.text,
                headerTitleStyle: { fontWeight: 'bold' },
                headerBackTitle: '',
                // Fix for white flash during transitions
                animation: 'fade',
            }}
        >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="trip/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="trip/create" options={{ title: 'New Trip' }} />
            <Stack.Screen name="trip/edit/[id]" options={{ title: 'Edit Trip' }} />
            <Stack.Screen name="expense/add" options={{ title: 'Add Expense' }} />
            <Stack.Screen name="expense/edit/[id]" options={{ title: 'Edit Expense' }} />
        </Stack>
    );
}

export default function RootLayout() {
    return (
        <LanguageProvider>
            <ThemeProvider>
                <NavigationContent />
            </ThemeProvider>
        </LanguageProvider>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    }
});
