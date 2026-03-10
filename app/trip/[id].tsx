import React, { useEffect, useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    Alert,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    StatusBar,
    Platform,
    Image
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { getTripById, deleteTrip, Trip, updateTrip } from '../../services/trips';
import { fetchExchangeRates, convertCurrency, getCurrencySymbol } from '../../services/currencies';
import * as ImagePicker from 'expo-image-picker';
import { getExpensesByTrip, Expense } from '../../services/expenses';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useTheme } from '../../hooks/useTheme';
import { useLanguage } from '../../hooks/useLanguage';
const { width } = Dimensions.get('window');

export default function TripDetailScreen() {
    const { colors, isDark } = useTheme();
    const { t, language } = useLanguage();

    const { id } = useLocalSearchParams<{ id: string }>();
    const [trip, setTrip] = useState<Trip | null>(null);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [addingPhoto, setAddingPhoto] = useState(false);
    const [coordinates, setCoordinates] = useState<{ latitude: number, longitude: number } | null>(null);
    const [routePoints, setRoutePoints] = useState<{ latitude: number, longitude: number, name?: string }[]>([]);
    const [geocoding, setGeocoding] = useState(false);

    const [rates, setRates] = useState<Record<string, number>>({ RUB: 1 });

    const loadData = async () => {
        if (!id) return;
        try {
            const tripData = await getTripById(id);
            if (tripData) {
                setTrip(tripData);
                const expensesData = await getExpensesByTrip(id);
                setExpenses(expensesData);

                // Fetch exchange rates
                const latestRates = await fetchExchangeRates('RUB');
                setRates(latestRates);

                // Parse route_json if exists
                if (tripData.route_json) {
                    try {
                        const parsed = JSON.parse(tripData.route_json);
                        if (Array.isArray(parsed)) {
                            setRoutePoints(parsed);
                        }
                    } catch (e) {
                        console.log('Error parsing route_json:', e);
                    }
                }

                // Geocode city and country to get coordinates for the map
                geocodeDestination(tripData.city, tripData.country);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to load details');
        } finally {
            setLoading(false);
        }
    };

    const geocodeDestination = async (city: string, country: string) => {
        setGeocoding(true);
        try {
            const address = `${city}, ${country}`;
            const result = await Location.geocodeAsync(address);
            if (result.length > 0) {
                setCoordinates({
                    latitude: result[0].latitude,
                    longitude: result[0].longitude
                });
            }
        } catch (error) {
            console.log('Geocoding error:', error);
        } finally {
            setGeocoding(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [id]);

    const addPhoto = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.7,
        });

        if (!result.canceled && trip) {
            setAddingPhoto(true);
            try {
                const newPhotos = [...(trip.photos || []), result.assets[0].uri];
                await updateTrip(trip.id!, { photos: newPhotos });
                setTrip({ ...trip, photos: newPhotos });
            } catch (error) {
                console.error(error);
            } finally {
                setAddingPhoto(false);
            }
        }
    };

    const handleDelete = () => {
        Alert.alert(
            t.alerts.confirmDelete,
            t.alerts.deleteSub,
            [
                { text: t.alerts.cancelBtn, style: "cancel" },
                {
                    text: t.alerts.deleteBtn,
                    style: "destructive",
                    onPress: async () => {
                        if (id) {
                            setDeleting(true);
                            try {
                                await deleteTrip(id);
                                router.replace('/');
                            } catch (error) {
                                console.error("Failed to delete trip:", error);
                                Alert.alert("Error", "Failed to delete trip.");
                            } finally {
                                setDeleting(false);
                            }
                        }
                    }
                }
            ]
        );
    };

    const handleArchive = async () => {
        if (!trip || !id) return;
        try {
            const newArchivedState = !trip.isArchived;
            await updateTrip(id, { isArchived: newArchivedState });
            setTrip({ ...trip, isArchived: newArchivedState });
            Alert.alert(t.alerts.ok, newArchivedState ? t.tripDetails.archiveTrip : t.tripDetails.unarchiveTrip);
        } catch (error) {
            console.error(error);
        }
    };

    const totalSpent = useMemo(() => {
        return expenses.reduce((sum, exp) => {
            const amountInRub = convertCurrency(exp.amount, exp.currency || 'RUB', 'RUB', rates);
            return sum + amountInRub;
        }, 0);
    }, [expenses, rates]);

    if (loading) {
        return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
    }

    if (!trip) {
        return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={[styles.errorText, { color: colors.secondaryText }]}>Trip not found</Text></View>;
    }

    const locale = language === 'ru' ? 'ru-RU' : 'en-US';
    const startDate = new Date(trip.startDate).toLocaleDateString(locale, { month: 'long', day: 'numeric' });
    const endDate = new Date(trip.endDate).toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric' });

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Map/Image Header Section */}
                <View style={[styles.mapContainer, { backgroundColor: colors.gray }]}>
                    {trip.image ? (
                        <Image source={{ uri: trip.image }} style={styles.headerImage} />
                    ) : coordinates ? (
                        <MapView
                            provider={PROVIDER_GOOGLE}
                            style={styles.map}
                            initialRegion={{
                                ...(routePoints.length > 0 ? routePoints[0] : coordinates!),
                                latitudeDelta: 0.1,
                                longitudeDelta: 0.1,
                            }}
                        >
                            {coordinates && <Marker coordinate={coordinates} title={trip.city} />}
                            {routePoints.length > 1 && (
                                <Polyline
                                    coordinates={routePoints}
                                    strokeColor={colors.primary}
                                    strokeWidth={4}
                                />
                            )}
                            {routePoints.map((p, i) => (
                                <Marker key={i} coordinate={p} pinColor={colors.success} />
                            ))}
                        </MapView>
                    ) : (
                        <View style={styles.mapPlaceholder}>
                            {geocoding ? (
                                <ActivityIndicator color={colors.primary} />
                            ) : (
                                <Ionicons name="map-outline" size={48} color={colors.border} />
                            )}
                        </View>
                    )}

                    <TouchableOpacity
                        style={[styles.backBtn, { backgroundColor: colors.card }]}
                        onPress={() => router.back()}
                    >
                        <Ionicons name="chevron-back" size={24} color={colors.text} />
                    </TouchableOpacity>

                    <View style={styles.headerActions}>
                        <TouchableOpacity onPress={handleArchive} style={[styles.headerBtn, { backgroundColor: colors.card }]}>
                            <Ionicons name={trip.isArchived ? "archive" : "archive-outline"} size={20} color={colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => router.push(`/trip/edit/${id}`)} style={[styles.headerBtn, { backgroundColor: colors.card }]}>
                            <Ionicons name="pencil" size={20} color={colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleDelete} style={[styles.headerBtn, { backgroundColor: colors.card }]} disabled={deleting}>
                            {deleting ? <ActivityIndicator size="small" color={colors.error} /> : <Ionicons name="trash" size={20} color={colors.error} />}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Info Section */}
                <View style={[styles.content, { backgroundColor: colors.background }]}>
                    <View style={styles.titleRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.cityText, { color: colors.text }]}>{trip.city}</Text>
                            <Text style={[styles.countryText, { color: colors.secondaryText }]}>{trip.country}</Text>
                        </View>
                        <View style={[styles.moodBadge, { backgroundColor: colors.card }]}>
                            <Text style={[styles.moodText, { color: colors.primary }]}>{trip.mood}</Text>
                        </View>
                    </View>

                    <View style={[styles.datesRow, { backgroundColor: colors.card }]}>
                        <Ionicons name="calendar-outline" size={20} color={colors.secondaryText} />
                        <Text style={[styles.dateText, { color: colors.text }]}>{startDate} — {endDate}</Text>
                    </View>

                    <View style={styles.statsRow}>
                        <View style={[styles.statBox, { backgroundColor: colors.card }]}>
                            <Text style={[styles.statLabel, { color: colors.secondaryText }]}>{t.tripDetails.totalSpent}</Text>
                            <Text style={[styles.statValue, { color: colors.text }]}>{totalSpent.toFixed(2)} {getCurrencySymbol('RUB')}</Text>
                        </View>
                        <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Text style={[styles.statLabel, { color: colors.secondaryText }]}>{t.tripDetails.expenses}</Text>
                            <Text style={[styles.statValue, { color: colors.text }]}>{expenses.length}</Text>
                        </View>
                    </View>

                    {/* Route Section */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <View style={[styles.sectionIcon, { backgroundColor: colors.primary + '10' }]}>
                                <Ionicons name="map-outline" size={20} color={colors.primary} />
                            </View>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t.tripDetails.route}</Text>
                        </View>
                        <View style={[styles.card, { backgroundColor: colors.card, padding: 16 }]}>
                            {routePoints.length > 0 ? (
                                routePoints.map((point, index) => (
                                    <View key={index} style={styles.routeItem}>
                                        <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
                                        {index < routePoints.length - 1 && (
                                            <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
                                        )}
                                        <Text style={[styles.pointName, { color: colors.text }]}>{point.name}</Text>
                                    </View>
                                ))
                            ) : (
                                <Text style={[styles.emptyText, { color: colors.secondaryText }]}>{t.tripDetails.noPoints || 'No points added yet'}</Text>
                            )}
                        </View>
                    </View>

                    {/* Photos Section */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <View style={[styles.sectionIcon, { backgroundColor: colors.success + '10' }]}>
                                <Ionicons name="images-outline" size={20} color={colors.success} />
                            </View>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Photos</Text>
                            <TouchableOpacity
                                onPress={addPhoto}
                                disabled={addingPhoto}
                                style={[styles.addBtnSmall, { backgroundColor: colors.primary + '15' }]}
                            >
                                {addingPhoto ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="add" size={18} color={colors.primary} />}
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.photoList}
                        >
                            {trip.photos && trip.photos.length > 0 ? (
                                trip.photos.map((p, i) => (
                                    <View key={i} style={styles.photoItem}>
                                        <Image source={{ uri: p }} style={styles.photo} />
                                    </View>
                                ))
                            ) : (
                                <TouchableOpacity onPress={addPhoto} style={[styles.photoPlaceholderCard, { borderColor: colors.border }]}>
                                    <Ionicons name="camera-outline" size={24} color={colors.secondaryText} />
                                    <Text style={{ color: colors.secondaryText, fontSize: 12 }}>Add first photo</Text>
                                </TouchableOpacity>
                            )}
                        </ScrollView>
                    </View>

                    {/* Expenses Section */}
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t.tripDetails.expenses}</Text>
                        <TouchableOpacity
                            onPress={() => router.push(`/expense/add?trip_id=${id}`)}
                            style={[styles.addExpenseBtn, { backgroundColor: isDark ? colors.gray : '#E5F1FF' }]}
                        >
                            <Ionicons name="add" size={20} color={colors.primary} />
                            <Text style={[styles.addExpenseText, { color: colors.primary }]}>{t.tripDetails.addExpense}</Text>
                        </TouchableOpacity>
                    </View>

                    {expenses.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Text style={[styles.emptyText, { color: colors.border }]}>{t.tripDetails.noExpenses}</Text>
                        </View>
                    ) : (
                        <View style={[styles.expensesList, { backgroundColor: colors.card }]}>
                            {expenses.map((exp, index) => (
                                <TouchableOpacity
                                    key={exp.id}
                                    style={[
                                        styles.expenseItem,
                                        { borderBottomColor: colors.background },
                                        index === expenses.length - 1 && { borderBottomWidth: 0 }
                                    ]}
                                    onPress={() => router.push(`/expense/edit/${exp.id}`)}
                                >
                                    <View style={[styles.expenseIcon, { backgroundColor: colors.background }]}>
                                        <Ionicons name="receipt-outline" size={20} color={colors.primary} />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={[styles.expenseTitle, { color: colors.text }]}>{exp.title}</Text>
                                        <Text style={[styles.expenseCategory, { color: colors.secondaryText }]}>{exp.category}</Text>
                                    </View>
                                    <Text style={[styles.expenseAmount, { color: colors.success }]}>
                                        {exp.amount.toFixed(2)} {getCurrencySymbol(exp.currency || 'RUB')}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>
                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F2F2F7' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    errorText: { fontSize: 16, color: '#8E8E93' },
    section: {
        marginTop: 24,
        paddingHorizontal: 0,
    },
    sectionIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    card: {
        borderRadius: 20,
        overflow: 'hidden',
    },

    mapContainer: {
        height: 300,
        backgroundColor: '#E5E5EA',
        position: 'relative',
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    mapPlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backBtn: {
        position: 'absolute',
        top: 50,
        left: 20,
        backgroundColor: '#FFFFFF',
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    headerActions: {
        position: 'absolute',
        top: 50,
        right: 20,
        flexDirection: 'row',
        gap: 12,
    },
    headerBtn: {
        backgroundColor: '#FFFFFF',
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },

    content: {
        marginTop: -30,
        backgroundColor: '#F2F2F7',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingHorizontal: 20,
        paddingTop: 30,
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    cityText: {
        fontSize: 34,
        fontWeight: '800',
        color: '#1C1C1E',
        letterSpacing: -1,
    },
    countryText: {
        fontSize: 18,
        fontWeight: '500',
        color: '#8E8E93',
        marginTop: 2,
    },
    moodBadge: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    moodText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#007AFF',
        textTransform: 'uppercase',
    },

    datesRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 16,
        marginBottom: 20,
    },
    dateText: {
        fontSize: 16,
        color: '#1C1C1E',
        fontWeight: '600',
        marginLeft: 10,
    },

    statsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 30,
    },
    statBox: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    statLabel: {
        fontSize: 13,
        color: '#8E8E93',
        fontWeight: '600',
        marginBottom: 4,
    },
    statValue: {
        fontSize: 22,
        fontWeight: '800',
        color: '#1C1C1E',
    },

    // Original sectionHeader and sectionTitle
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#1C1C1E',
    },
    addExpenseBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E5F1FF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
    },
    addExpenseText: {
        color: '#007AFF',
        fontWeight: '700',
        marginLeft: 4,
    },

    expensesList: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        overflow: 'hidden',
    },
    expenseItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F2F2F7',
    },
    expenseIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#F2F2F7',
        justifyContent: 'center',
        alignItems: 'center',
    },
    expenseTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1C1C1E',
    },
    expenseCategory: {
        fontSize: 13,
        color: '#8E8E93',
        marginTop: 2,
    },
    expenseAmount: {
        fontSize: 17,
        fontWeight: '700',
        color: '#34C759',
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: '#C7C7CC',
        fontSize: 15,
        textAlign: 'center',
    },
    headerImage: {
        width: '100%',
        height: '100%',
    },
    routeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 40,
        paddingLeft: 20,
    },
    routeDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 15,
        zIndex: 1,
    },
    routeLine: {
        position: 'absolute',
        top: 25,
        left: 24,
        width: 2,
        height: 30,
    },
    pointName: {
        fontSize: 16,
        fontWeight: '500',
    },
    addBtnSmall: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 'auto',
    },
    photoList: {
        paddingHorizontal: 4,
        gap: 12,
    },
    photoItem: {
        width: 120,
        height: 120,
        borderRadius: 16,
        overflow: 'hidden',
    },
    photo: {
        width: '100%',
        height: '100%',
    },
    photoPlaceholderCard: {
        width: 120,
        height: 120,
        borderRadius: 16,
        borderWidth: 1,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 4,
    }
});
