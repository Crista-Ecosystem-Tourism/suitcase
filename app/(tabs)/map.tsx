import React, { useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    StatusBar,
    Animated,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { getAllTrips, Trip } from '../../services/trips';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../hooks/useLanguage';
import { useTheme } from '../../hooks/useTheme';
import * as Location from 'expo-location';

interface TripWithCoords extends Trip {
    lat?: number;
    lng?: number;
}

export default function MapScreen() {
    const { colors, isDark } = useTheme();
    const { t } = useLanguage();
    const { user } = useAuth();
    const [trips, setTrips] = useState<TripWithCoords[]>([]);
    const [selectedTrip, setSelectedTrip] = useState<TripWithCoords | null>(null);
    const popupAnim = useRef(new Animated.Value(0)).current;

    const geocodeTrips = async (tripList: Trip[]) => {
        const results: TripWithCoords[] = [];
        for (const trip of tripList.filter(t => !t.isArchived)) {
            try {
                const geo = await Location.geocodeAsync(`${trip.city}, ${trip.country}`);
                if (geo.length > 0) {
                    results.push({ ...trip, lat: geo[0].latitude, lng: geo[0].longitude });
                } else {
                    results.push(trip);
                }
            } catch {
                results.push(trip);
            }
        }
        setTrips(results);
    };

    useFocusEffect(
        useCallback(() => {
            if (!user) return;
            getAllTrips().then(geocodeTrips).catch(console.error);
        }, [user])
    );

    const showPopup = (trip: TripWithCoords) => {
        setSelectedTrip(trip);
        Animated.spring(popupAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 60,
            friction: 8,
        }).start();
    };

    const hidePopup = () => {
        Animated.timing(popupAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
        }).start(() => setSelectedTrip(null));
    };

    const validTrips = trips.filter(t => t.lat && t.lng);

    return (
        <View style={styles.container}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

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
                onPress={hidePopup}
            >
                {validTrips.map((trip) => (
                    <Marker
                        key={trip.id}
                        coordinate={{ latitude: trip.lat!, longitude: trip.lng! }}
                        onPress={() => showPopup(trip)}
                    >
                        <View style={[styles.markerContainer, { backgroundColor: colors.success }]}>
                            <Ionicons name="airplane" size={16} color="#FFF" />
                        </View>
                    </Marker>
                ))}
            </MapView>

            {selectedTrip && (
                <Animated.View
                    style={[
                        styles.popup,
                        { backgroundColor: colors.card },
                        {
                            transform: [{
                                translateY: popupAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [120, 0],
                                })
                            }],
                            opacity: popupAnim,
                        }
                    ]}
                >
                    <TouchableOpacity
                        style={styles.popupContent}
                        activeOpacity={0.8}
                        onPress={() => router.push(`/trip/${selectedTrip.id}`)}
                    >
                        <View style={[styles.popupIcon, { backgroundColor: colors.success + '20' }]}>
                            <Ionicons name="briefcase-outline" size={28} color={colors.success} />
                        </View>
                        <View style={styles.popupInfo}>
                            <Text style={[styles.popupCountry, { color: colors.text }]}>{selectedTrip.country}</Text>
                            <Text style={[styles.popupCity, { color: colors.secondaryText }]}>{selectedTrip.city}</Text>
                            <Text style={[styles.popupDate, { color: colors.secondaryText }]}>{selectedTrip.startDate}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
                    </TouchableOpacity>
                </Animated.View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    markerContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    popup: {
        position: 'absolute',
        bottom: 30,
        left: 16,
        right: 16,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 8,
    },
    popupContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
    },
    popupIcon: {
        width: 52,
        height: 52,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    popupInfo: {
        flex: 1,
    },
    popupCountry: {
        fontSize: 16,
        fontWeight: '700',
    },
    popupCity: {
        fontSize: 13,
        marginTop: 2,
    },
    popupDate: {
        fontSize: 12,
        marginTop: 2,
    },
});
