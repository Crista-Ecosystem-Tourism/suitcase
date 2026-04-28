import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { LanguageProvider } from '../hooks/useLanguage';
import { ThemeProvider, useTheme } from '../hooks/useTheme';
import { AuthProvider, useAuth } from '../hooks/useAuth';

function useProtectedRoute(isAuthenticated: boolean, isInitializing: boolean) {
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        if (isInitializing) return;

        const inAuthGroup = segments[0] === 'login';

        if (!isAuthenticated && !inAuthGroup) {
            router.replace('/login');
        } else if (isAuthenticated && inAuthGroup) {
            router.replace('/(tabs)');
        }
    }, [isAuthenticated, segments, isInitializing]);
}

function NavigationContent() {
    const { colors } = useTheme();
    const { user, initializing } = useAuth();

    useProtectedRoute(!!user, initializing);

    if (initializing) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: colors.card },
                headerTintColor: colors.text,
                headerTitleStyle: { fontWeight: 'bold' },
                headerBackTitle: '',
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
                <AuthProvider>
                    <NavigationContent />
                </AuthProvider>
            </ThemeProvider>
        </LanguageProvider>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
