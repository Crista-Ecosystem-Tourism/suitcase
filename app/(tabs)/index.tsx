import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    TouchableOpacity,
    FlatList,
    RefreshControl,
    Alert,
    Dimensions
} from 'react-native';
import MapView from 'react-native-maps';
import { getAllTrips, Trip } from '../../services/trips';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../services/firebase';
import { useLanguage } from '../../hooks/useLanguage';
import { useTheme } from '../../hooks/useTheme';

const getMoodColor = (mood?: string) => {
    switch (mood) {
        case 'excited': return '#FF9500';
        case 'relaxed': return '#34C759';
        case 'peaceful': return '#007AFF';
        case 'tired': return '#8E8E93';
        default: return '#007AFF';
    }
};

export default function HomeScreen() {
    const { colors, isDark } = useTheme();
    const { t } = useLanguage();
    const [trips, setTrips] = useState<Trip[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const fetchTrips = async () => {
        if (!auth.currentUser) return;
        try {
            const data = await getAllTrips();
            setTrips(data);
        } catch (error) {
            console.error('Fetch trips error:', error);
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

            <View style={[styles.appHeader, { backgroundColor: colors.background }]}>
                <View style={[styles.logoContainer, { backgroundColor: colors.card }]}>
                    <View style={[styles.iconCircle, { backgroundColor: colors.success + '20' }]}>
                        <Ionicons name="briefcase" size={20} color={colors.success} />
                    </View>
                    <Text style={[styles.appTitle, { color: colors.text }]}>{t.home.appTitle}</Text>
                </View>
                <TouchableOpacity style={[styles.notifBtn, { backgroundColor: colors.card }]}>
                    <Ionicons name="notifications-outline" size={22} color={colors.text} />
                </TouchableOpacity>
            </View>

            <FlatList
                data={trips.filter(t => !t.isArchived)}
                keyExtractor={(item) => item.id!}
                contentContainerStyle={styles.list}
                refreshing={refreshing}
                onRefresh={onRefresh}
                renderItem={({ item }) => (
                    <TripCard trip={item} onPress={() => router.push(`/trip/${item.id}`)} colors={colors} t={t} />
                )}
                ListHeaderComponent={
                    <View>
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.title, { color: colors.text }]}>{t.home.tripsCount}</Text>
                            <View style={[styles.badge, { backgroundColor: colors.gray }]}>
                                <Text style={[styles.badgeText, { color: colors.secondaryText }]}>{trips.filter(t => !t.isArchived).length}</Text>
                            </View>
                        </View>

                        {trips.length > 0 ? (
                            <View style={styles.statsContainer}>
                                <View style={[styles.mainStats, { backgroundColor: colors.success }]}>
                                    <View style={styles.statItem}>
                                        <Text style={styles.statNumber}>{new Set(trips.map(t => t.country)).size}</Text>
                                        <Text style={styles.statLabel}>{t.tripDetails.country}</Text>
                                    </View>
                                    <View style={styles.statDivider} />
                                    <View style={styles.statItem}>
                                        <Text style={styles.statNumber}>{trips.length}</Text>
                                        <Text style={styles.statLabel}>{t.tripDetails.city}</Text>
                                    </View>
                                    <View style={styles.statDivider} />
                                    <View style={styles.statItem}>
                                        <Text style={styles.statNumber}>0 ₽</Text>
                                        <Text style={styles.statLabel}>{t.expenseForm.amount}</Text>
                                    </View>
                                </View>

                                <View style={styles.secondaryStatsRow}>
                                    <View style={[styles.secondaryStatBox, { backgroundColor: colors.card }]}>
                                        <View style={[styles.miniIcon, { backgroundColor: colors.primary + '20' }]}>
                                            <Ionicons name="earth" size={16} color={colors.primary} />
                                        </View>
                                        <Text style={[styles.secStatNumber, { color: colors.text }]}>0</Text>
                                        <Text style={[styles.secStatLabel, { color: colors.secondaryText }]}>Дней в дороге</Text>
                                    </View>
                                    <View style={[styles.secondaryStatBox, { backgroundColor: colors.card }]}>
                                        <View style={[styles.miniIcon, { backgroundColor: colors.warning + '20' }]}>
                                            <Ionicons name="trophy" size={16} color={colors.warning} />
                                        </View>
                                        <Text style={[styles.secStatNumber, { color: colors.text }]}>Нет данных</Text>
                                        <Text style={[styles.secStatLabel, { color: colors.secondaryText }]}>Топ страна</Text>
                                    </View>
                                </View>
                            </View>
                        ) : (
                            <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
                                <View style={[styles.emptyIconCircle, { backgroundColor: colors.success + '10' }]}>
                                    <Ionicons name="airplane" size={32} color={colors.success} />
                                </View>
                                <Text style={[styles.emptyTitle, { color: colors.text }]}>{t.home.noTrips}</Text>
                                <Text style={[styles.emptySubtitle, { color: colors.secondaryText }]}>{t.home.addFirstDescription}</Text>
                                <TouchableOpacity
                                    style={[styles.emptyAddBtn, { backgroundColor: colors.success }]}
                                    onPress={() => router.push('/trip/add')}
                                >
                                    <Text style={styles.emptyAddBtnText}>+ {t.home.addFirstBtn}</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t.home.journeyMap}</Text>
                        <View style={[styles.mapContainer, { backgroundColor: colors.card }]}>
                            <MapView
                                style={styles.miniMap}
                                scrollEnabled={false}
                                zoomEnabled={false}
                                customMapStyle={isDark ? darkMapStyle : []}
                                initialRegion={{
                                    latitude: 50,
                                    longitude: 20,
                                    latitudeDelta: 60,
                                    longitudeDelta: 60,
                                }}
                            />
                        </View>
                    </View>
                }
            />
        </View>
    );
}

const darkMapStyle = [
    { "elementType": "geometry", "stylers": [{ "color": "#212121" }] },
    { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
    { "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
    { "elementType": "labels.text.stroke", "stylers": [{ "color": "#212121" }] },
    { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#757575" }] },
    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] }
];


function TripCard({ trip, onPress, colors, t }: { trip: Trip, onPress: () => void, colors: any, t: any }) {
    const moodColor = getMoodColor(trip.mood);
    const startDate = new Date(trip.startDate).toLocaleDateString();

    return (
        <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.card }]}
            activeOpacity={0.7}
            onPress={onPress}
        >
            <View style={[styles.moodIndicator, { backgroundColor: moodColor }]} />
            <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.cityText, { color: colors.text }]}>{trip.city}</Text>
                        <Text style={[styles.countryText, { color: colors.secondaryText }]}>{trip.country}</Text>
                    </View>
                    <View style={styles.dateBadge}>
                        <Ionicons name="calendar-outline" size={12} color={colors.secondaryText} />
                        <Text style={[styles.dateText, { color: colors.secondaryText }]}>{startDate}</Text>
                    </View>
                </View>

                <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                    <Text style={[styles.detailsText, { color: colors.primary }]}>{t.home.viewDetails}</Text>
                    <Ionicons name="arrow-forward" size={18} color={colors.primary} />
                </View>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    appHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 60,
        paddingBottom: 10,
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        paddingRight: 16,
        borderRadius: 20,
    },
    iconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    appTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    notifBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    list: {
        paddingHorizontal: 16,
        paddingBottom: 100,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginRight: 12,
    },
    badge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    badgeText: {
        fontSize: 14,
        fontWeight: '600',
    },
    statsContainer: {
        marginBottom: 25,
    },
    mainStats: {
        flexDirection: 'row',
        borderRadius: 24,
        padding: 20,
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statNumber: {
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: 'bold',
    },
    statLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        marginTop: 4,
    },
    statDivider: {
        width: 1,
        height: 30,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    secondaryStatsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    secondaryStatBox: {
        flex: 1,
        borderRadius: 24,
        padding: 16,
    },
    miniIcon: {
        width: 32,
        height: 32,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    secStatNumber: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    secStatLabel: {
        fontSize: 12,
        marginTop: 2,
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 15,
        marginTop: 10,
    },
    mapContainer: {
        height: 200,
        borderRadius: 24,
        overflow: 'hidden',
        marginBottom: 25,
    },
    miniMap: {
        ...StyleSheet.absoluteFillObject,
    },
    emptyCard: {
        padding: 30,
        borderRadius: 30,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
        borderStyle: 'dashed',
        marginBottom: 25,
    },
    emptyIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 10,
    },
    emptySubtitle: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 25,
    },
    emptyAddBtn: {
        paddingVertical: 14,
        paddingHorizontal: 30,
        borderRadius: 20,
    },
    emptyAddBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    card: {
        flexDirection: 'row',
        borderRadius: 20,
        marginBottom: 15,
        padding: 16,
    },
    moodIndicator: {
        width: 6,
        borderRadius: 3,
        marginRight: 12,
    },
    cardContent: {
        flex: 1,
    },
    cityText: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    countryText: {
        fontSize: 14,
        marginTop: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    dateBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        opacity: 0.8
    },
    dateText: {
        fontSize: 12,
        marginLeft: 4,
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 15,
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    detailsText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
