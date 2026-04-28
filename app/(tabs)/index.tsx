import React, { useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    TouchableOpacity,
    FlatList,
    RefreshControl,
    ImageBackground,
    Animated,
    Dimensions,
    Image,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { getAllTrips, Trip } from '../../services/trips';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../hooks/useLanguage';
import { useTheme } from '../../hooks/useTheme';
import * as Location from 'expo-location';

const { width } = Dimensions.get('window');

interface TripWithCoords extends Trip {
    lat?: number;
    lng?: number;
}

export default function HomeScreen() {
    const { colors, isDark } = useTheme();
    const { t } = useLanguage();
    const { user } = useAuth();
    const [trips, setTrips] = useState<TripWithCoords[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedMapTrip, setSelectedMapTrip] = useState<TripWithCoords | null>(null);
    const popupAnim = useRef(new Animated.Value(0)).current;

    const geocodeAndSet = async (tripList: Trip[]) => {
        const active = tripList.filter(t => !t.isArchived);
        const results: TripWithCoords[] = [];
        for (const trip of active) {
            try {
                const geo = await Location.geocodeAsync(`${trip.city}, ${trip.country}`);
                if (geo.length > 0) {
                    results.push({ ...trip, lat: geo[0].latitude, lng: geo[0].longitude });
                    continue;
                }
            } catch { /* skip geocoding error */ }
            results.push(trip);
        }
        setTrips(results);
    };

    const fetchTrips = async () => {
        if (!user) return;
        try {
            const data = await getAllTrips();
            await geocodeAndSet(data);
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

    const showMapPopup = (trip: TripWithCoords) => {
        setSelectedMapTrip(trip);
        Animated.spring(popupAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }).start();
    };

    const hideMapPopup = () => {
        Animated.timing(popupAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
            setSelectedMapTrip(null);
        });
    };

    const activeTrips = trips.filter(t => !t.isArchived);
    const lastTrip = activeTrips[0] ?? null;
    const validMapTrips = activeTrips.filter(t => t.lat && t.lng);

    const renderListHeader = () => (
        <View>
            {/* Last Trip Featured Card */}
            {lastTrip && (
                <View>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>{t.home.lastTrip}</Text>
                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => router.push(`/trip/${lastTrip.id}`)}
                        style={styles.featuredCard}
                    >
                        {lastTrip.image ? (
                            <ImageBackground
                                source={{ uri: lastTrip.image }}
                                style={styles.featuredBg}
                                imageStyle={{ borderRadius: 20 }}
                            >
                                <View style={styles.featuredOverlay} />
                                <FeaturedContent trip={lastTrip} colors={colors} t={t} />
                            </ImageBackground>
                        ) : (
                            <View style={[styles.featuredBg, styles.featuredNoBg, { backgroundColor: colors.card }]}>
                                <FeaturedContent trip={lastTrip} colors={colors} t={t} />
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            )}

            {/* Trips section header */}
            <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 0, marginBottom: 0 }]}>
                    {t.home.tripsCount}
                </Text>
                <View style={[styles.badge, { backgroundColor: colors.success }]}>
                    <Text style={styles.badgeText}>{activeTrips.length}</Text>
                </View>
            </View>

            {/* Empty state */}
            {activeTrips.length === 0 && (
                <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
                    <View style={[styles.emptyIconCircle, { backgroundColor: colors.success + '15' }]}>
                        <Ionicons name="airplane" size={36} color={colors.success} />
                    </View>
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>{t.home.noTrips}</Text>
                    <Text style={[styles.emptySubtitle, { color: colors.secondaryText }]}>{t.home.addFirstDescription}</Text>
                    <TouchableOpacity
                        style={[styles.emptyAddBtn, { backgroundColor: colors.success }]}
                        onPress={() => router.push('/trip/create')}
                    >
                        <Text style={styles.emptyAddBtnText}>{t.home.addFirstBtn}</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );

    const renderListFooter = () => (
        <View>
            {/* Journey Map */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t.home.journeyMap}</Text>
            <View style={[styles.mapContainer, { backgroundColor: colors.card }]}>
                <MapView
                    provider={PROVIDER_GOOGLE}
                    style={StyleSheet.absoluteFillObject}
                    mapType="satellite"
                    initialRegion={{
                        latitude: 55,
                        longitude: 37,
                        latitudeDelta: 40,
                        longitudeDelta: 40,
                    }}
                    onPress={hideMapPopup}
                >
                    {validMapTrips.map((trip) => (
                        <Marker
                            key={trip.id}
                            coordinate={{ latitude: trip.lat!, longitude: trip.lng! }}
                            onPress={() => showMapPopup(trip)}
                        >
                            <View style={[styles.markerDot, { backgroundColor: colors.success }]}>
                                <Ionicons name="airplane" size={14} color="#FFF" />
                            </View>
                        </Marker>
                    ))}
                </MapView>

                {selectedMapTrip && (
                    <Animated.View
                        style={[
                            styles.mapPopup,
                            { backgroundColor: colors.background },
                            {
                                transform: [{
                                    translateY: popupAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [80, 0],
                                    })
                                }],
                                opacity: popupAnim,
                            }
                        ]}
                    >
                        <TouchableOpacity
                            style={styles.mapPopupContent}
                            activeOpacity={0.8}
                            onPress={() => router.push(`/trip/${selectedMapTrip.id}`)}
                        >
                            <View style={[styles.mapPopupIcon, { backgroundColor: colors.card }]}>
                                <Ionicons name="briefcase-outline" size={22} color={colors.secondaryText} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.mapPopupCountry, { color: colors.text }]}>{selectedMapTrip.country}</Text>
                                <Text style={[styles.mapPopupCity, { color: colors.secondaryText }]} numberOfLines={1}>
                                    {selectedMapTrip.city}
                                </Text>
                                <Text style={[styles.mapPopupDate, { color: colors.secondaryText }]}>{selectedMapTrip.startDate}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={colors.secondaryText} />
                        </TouchableOpacity>
                    </Animated.View>
                )}
            </View>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

            {/* App Header */}
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
                data={activeTrips}
                keyExtractor={(item) => item.id!}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.success} />}
                renderItem={({ item }) => (
                    <TripCard trip={item} onPress={() => router.push(`/trip/${item.id}`)} colors={colors} />
                )}
                ListHeaderComponent={renderListHeader}
                ListFooterComponent={renderListFooter}
            />
        </View>
    );
}

function FeaturedContent({ trip, colors, t }: { trip: Trip; colors: any; t: any }) {
    return (
        <View style={styles.featuredContent}>
            <View style={[styles.lastBadge, { backgroundColor: colors.success }]}>
                <Text style={styles.lastBadgeText}>✈ {t.home.lastBadge}</Text>
            </View>
            <View style={styles.featuredTextBlock}>
                <Text style={styles.featuredCity}>{trip.city}</Text>
                <Text style={styles.featuredCountry}>{trip.country}</Text>
            </View>
        </View>
    );
}

function TripCard({ trip, onPress, colors }: { trip: TripWithCoords; onPress: () => void; colors: any }) {
    return (
        <TouchableOpacity
            style={[styles.tripCard, { backgroundColor: colors.card }]}
            activeOpacity={0.75}
            onPress={onPress}
        >
            <View style={styles.tripCardMain}>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.tripCountry, { color: colors.text }]}>{trip.country}</Text>
                    <View style={styles.tripCityRow}>
                        <Ionicons name="location" size={12} color={colors.success} />
                        <Text style={[styles.tripCityDate, { color: colors.secondaryText }]} numberOfLines={1}>
                            {trip.city} • {trip.startDate}
                        </Text>
                    </View>
                    {trip.mood ? (
                        <Text style={[styles.tripMood, { color: colors.secondaryText }]}>{trip.mood}</Text>
                    ) : null}
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
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
        paddingBottom: 120,
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 12,
        marginTop: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 28,
        marginBottom: 12,
        gap: 10,
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 10,
    },
    badgeText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '700',
    },
    featuredCard: {
        borderRadius: 20,
        overflow: 'hidden',
        height: 200,
        marginBottom: 4,
    },
    featuredBg: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    featuredNoBg: {
        borderRadius: 20,
    },
    featuredOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.35)',
        borderRadius: 20,
    },
    featuredContent: {
        padding: 16,
        gap: 8,
    },
    lastBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    lastBadgeText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '700',
    },
    featuredTextBlock: {
        gap: 2,
    },
    featuredCity: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: 'bold',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    featuredCountry: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 15,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    emptyCard: {
        padding: 30,
        borderRadius: 24,
        alignItems: 'center',
        marginBottom: 8,
    },
    emptyIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 20,
    },
    emptyAddBtn: {
        paddingVertical: 14,
        paddingHorizontal: 28,
        borderRadius: 16,
    },
    emptyAddBtnText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: 'bold',
    },
    tripCard: {
        borderRadius: 16,
        marginBottom: 10,
        padding: 14,
    },
    tripCardMain: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    tripCountry: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 3,
    },
    tripCityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        marginBottom: 2,
    },
    tripCityDate: {
        fontSize: 12,
        flex: 1,
    },
    tripMood: {
        fontSize: 12,
        fontStyle: 'italic',
    },
    mapContainer: {
        height: 220,
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: 8,
    },
    markerDot: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 3,
    },
    mapPopup: {
        position: 'absolute',
        bottom: 12,
        left: 12,
        right: 12,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 6,
    },
    mapPopupContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        gap: 10,
    },
    mapPopupIcon: {
        width: 46,
        height: 46,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mapPopupCountry: {
        fontSize: 15,
        fontWeight: '700',
    },
    mapPopupCity: {
        fontSize: 12,
        marginTop: 1,
    },
    mapPopupDate: {
        fontSize: 11,
        marginTop: 1,
    },
});
