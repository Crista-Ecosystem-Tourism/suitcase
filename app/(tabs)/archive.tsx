import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, StatusBar, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAllTrips, Trip } from '../../services/trips';
import { useLanguage } from '../../hooks/useLanguage';
import { useTheme } from '../../hooks/useTheme';
import { router, useFocusEffect } from 'expo-router';

export default function ArchiveScreen() {
    const { colors, isDark } = useTheme();
    const { t } = useLanguage();
    const [trips, setTrips] = useState<Trip[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const requestIdRef = useRef(0);
    const focusedRef = useRef(false);

    const fetchTrips = useCallback(async (showLoading: boolean) => {
        const requestId = ++requestIdRef.current;
        if (showLoading) setLoading(true);
        setLoadError(false);
        try {
            const data = await getAllTrips();
            if (focusedRef.current && requestIdRef.current === requestId) {
                setTrips(data.filter(t => t.isArchived));
            }
        } catch (error) {
            console.error('Fetch archived trips error:', error);
            if (focusedRef.current && requestIdRef.current === requestId) setLoadError(true);
        } finally {
            if (focusedRef.current && requestIdRef.current === requestId) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            focusedRef.current = true;
            void fetchTrips(true);
            return () => {
                focusedRef.current = false;
                requestIdRef.current += 1;
            };
        }, [fetchTrips])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchTrips(false);
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
            <FlatList
                data={trips}
                keyExtractor={(item) => item.id!}
                contentContainerStyle={styles.list}
                ListHeaderComponent={loadError && trips.length > 0 ? (
                    <View style={[styles.errorNotice, { backgroundColor: colors.card }]}>
                        <Text style={[styles.subtitle, { color: colors.text }]}>{t.archive.loadError}</Text>
                        <TouchableOpacity
                            accessibilityRole="button"
                            onPress={() => void fetchTrips(true)}
                            style={[styles.retryButton, { backgroundColor: colors.primary }]}
                        >
                            <Text style={styles.retryText}>{t.archive.retry}</Text>
                        </TouchableOpacity>
                    </View>
                ) : null}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={[styles.card, { backgroundColor: colors.card }]}
                        onPress={() => router.push(`/trip/${item.id}`)}
                    >
                        <View style={styles.cardContent}>
                            <Text style={[styles.cityText, { color: colors.text }]}>{item.city}</Text>
                            <Text style={[styles.countryText, { color: colors.secondaryText }]}>{item.country}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        {loading ? (
                            <>
                                <ActivityIndicator size="large" color={colors.primary} />
                                <Text style={[styles.subtitle, { color: colors.secondaryText }]}>{t.archive.loading}</Text>
                            </>
                        ) : loadError ? (
                            <>
                                <Text style={[styles.subtitle, { color: colors.text }]}>{t.archive.loadError}</Text>
                                <TouchableOpacity
                                    accessibilityRole="button"
                                    onPress={() => void fetchTrips(true)}
                                    style={[styles.retryButton, { backgroundColor: colors.primary }]}
                                >
                                    <Text style={styles.retryText}>{t.archive.retry}</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                <View style={[styles.iconContainer, { backgroundColor: colors.card }]}>
                                    <Ionicons name="archive-outline" size={48} color={colors.secondaryText} />
                                </View>
                                <Text style={[styles.title, { color: colors.text }]}>{t.tabs.archive}</Text>
                                <Text style={[styles.subtitle, { color: colors.secondaryText }]}>{t.archive.empty}</Text>
                            </>
                        )}
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    list: { padding: 16 },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        justifyContent: 'space-between'
    },
    cardContent: { flex: 1 },
    cityText: { fontSize: 18, fontWeight: '700' },
    countryText: { fontSize: 14, marginTop: 2 },
    empty: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
        paddingHorizontal: 40
    },
    errorNotice: { alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 16 },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 8
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 22
    },
    retryButton: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },
    retryText: { color: '#FFF', fontWeight: '700' }
});
