import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, StatusBar, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAllTrips, Trip } from '../../services/trips';
import { useLanguage } from '../../hooks/useLanguage';
import { useTheme } from '../../hooks/useTheme';
import { router, useFocusEffect } from 'expo-router';

export default function ArchiveScreen() {
    const { colors, isDark } = useTheme();
    const { t } = useLanguage();
    const [trips, setTrips] = useState<Trip[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const fetchTrips = async () => {
        try {
            const data = await getAllTrips();
            setTrips(data.filter(t => t.isArchived));
        } catch (error) {
            console.error(error);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchTrips();
        }, [])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchTrips();
        setRefreshing(false);
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
            <FlatList
                data={trips}
                keyExtractor={(item) => item.id!}
                contentContainerStyle={styles.list}
                refreshing={refreshing}
                onRefresh={onRefresh}
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
                        <View style={[styles.iconContainer, { backgroundColor: colors.card }]}>
                            <Ionicons name="archive-outline" size={48} color={colors.secondaryText} />
                        </View>
                        <Text style={[styles.title, { color: colors.text }]}>{t.tabs.archive}</Text>
                        <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
                            Your archived adventures will appear here.
                        </Text>
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
    }
});
