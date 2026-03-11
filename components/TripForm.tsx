import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Dimensions,
    Image,
    Modal,
} from 'react-native';
import { Trip } from '../services/trips';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useLanguage } from '../hooks/useLanguage';
import { getCitySuggestions, getCountrySuggestions, Suggestion } from '../services/dadata';
import * as ImagePicker from 'expo-image-picker';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';

interface RoutePoint {
    latitude: number;
    longitude: number;
    name: string;
    note?: string;
    photos?: string[];
}

interface TripFormProps {
    initialData?: Trip;
    onSubmit: (trip: Omit<Trip, 'id' | 'createdAt'>) => void;
    loading?: boolean;
}

const MOODS = [
    { id: 'happy', icon: 'happy-outline', color: '#248A3D', bg: '#EAF7ED' },
    { id: 'excited', icon: 'flame-outline', color: '#FF3B30', bg: '#FFF0ED' },
    { id: 'relaxed', icon: 'cafe-outline', color: '#007AFF', bg: '#E5F1FF' },
    { id: 'adventure', icon: 'compass-outline', color: '#FF9500', bg: '#FFF4E5' },
    { id: 'peaceful', icon: 'leaf-outline', color: '#8E8E93', bg: '#F2F2F7' },
    { id: 'busy', icon: 'briefcase-outline', color: '#5856D6', bg: '#EFEFFB' },
];

export const TripForm: React.FC<TripFormProps> = ({ initialData, onSubmit, loading }) => {
    const { colors, isDark } = useTheme();
    const { t } = useLanguage();

    const [country, setCountry] = useState(initialData?.country || '');
    const [city, setCity] = useState(initialData?.city || '');
    const [startDate, setStartDate] = useState(new Date(initialData?.startDate || Date.now()));
    const [endDate, setEndDate] = useState(new Date(initialData?.endDate || Date.now()));
    const [mood, setMood] = useState(initialData?.mood || 'peaceful');
    const [impressions, setImpressions] = useState(initialData?.impressions || '');
    const [image, setImage] = useState(initialData?.image || '');

    // Route Points State
    const [routePoints, setRoutePoints] = useState<RoutePoint[]>(() => {
        if (initialData?.route_json) {
            try {
                return JSON.parse(initialData.route_json);
            } catch (e) {
                return [];
            }
        }
        return [];
    });

    // Suggestions State
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [countrySuggestions, setCountrySuggestions] = useState<Suggestion[]>([]);
    const [showCountrySuggestions, setShowCountrySuggestions] = useState(false);

    const [pointSuggestions, setPointSuggestions] = useState<{ [key: number]: Suggestion[] }>({});
    const [showPointSuggestions, setShowPointSuggestions] = useState<{ [key: number]: boolean }>({});

    // Map Modal State
    const [showMapModal, setShowMapModal] = useState(false);
    const [activePointIndex, setActivePointIndex] = useState<number | null>(null);
    const [mapMode, setMapMode] = useState<'point' | 'city'>('point');
    const [pendingMapCoords, setPendingMapCoords] = useState<{ latitude: number; longitude: number } | null>(null);
    const [pendingCityName, setPendingCityName] = useState('');
    const [pendingCountryName, setPendingCountryName] = useState('');
    const [mapRegion, setMapRegion] = useState({
        latitude: 55.751244,
        longitude: 37.618423,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
    });

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.8,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    const handleCityChange = async (text: string) => {
        setCity(text);
        if (text.length > 2) {
            const results = await getCitySuggestions(text);
            setSuggestions(results);
            setShowSuggestions(results.length > 0);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const selectSuggestion = (s: Suggestion) => {
        setCity(s.data.city || s.value);
        if (s.data.country) setCountry(s.data.country);
        setShowSuggestions(false);
    };

    const handleCountryChange = async (text: string) => {
        setCountry(text);
        if (text.length > 1) {
            const results = await getCountrySuggestions(text);
            setCountrySuggestions(results);
            setShowCountrySuggestions(results.length > 0);
        } else {
            setCountrySuggestions([]);
            setShowCountrySuggestions(false);
        }
    };

    const selectCountrySuggestion = (s: Suggestion) => {
        setCountry(s.value);
        setShowCountrySuggestions(false);
    };

    const addRoutePoint = () => {
        setRoutePoints([...routePoints, { name: '', latitude: 0, longitude: 0 }]);
    };

    const updateRoutePoint = async (index: number, text: string) => {
        const newPoints = [...routePoints];
        newPoints[index].name = text;
        setRoutePoints(newPoints);

        if (text.length > 2) {
            const results = await getCitySuggestions(text);
            setPointSuggestions(prev => ({ ...prev, [index]: results }));
            setShowPointSuggestions(prev => ({ ...prev, [index]: results.length > 0 }));
        } else {
            setPointSuggestions(prev => ({ ...prev, [index]: [] }));
            setShowPointSuggestions(prev => ({ ...prev, [index]: false }));
        }
    };

    const selectPointSuggestion = (index: number, s: Suggestion) => {
        const newPoints = [...routePoints];
        newPoints[index].name = s.data.city || s.value;
        if (s.data.geo_lat && s.data.geo_lon) {
            newPoints[index].latitude = parseFloat(s.data.geo_lat);
            newPoints[index].longitude = parseFloat(s.data.geo_lon);
        }
        setRoutePoints(newPoints);
        setShowPointSuggestions(prev => ({ ...prev, [index]: false }));
    };

    const removeRoutePoint = (index: number) => {
        const newPoints = routePoints.filter((_, i) => i !== index);
        setRoutePoints(newPoints);

        const newPointSuggs = { ...pointSuggestions };
        delete newPointSuggs[index];
        setPointSuggestions(newPointSuggs);

        const newShowPointSuggs = { ...showPointSuggestions };
        delete newShowPointSuggs[index];
        setShowPointSuggestions(newShowPointSuggs);
    };

    const updateRoutePointNote = (index: number, note: string) => {
        const newPoints = [...routePoints];
        newPoints[index] = { ...newPoints[index], note };
        setRoutePoints(newPoints);
    };

    const addPhotoToPoint = async (index: number) => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
        });
        if (!result.canceled) {
            const newPoints = [...routePoints];
            const existing = newPoints[index].photos || [];
            newPoints[index] = { ...newPoints[index], photos: [...existing, result.assets[0].uri] };
            setRoutePoints(newPoints);
        }
    };

    const removePhotoFromPoint = (pointIndex: number, photoIndex: number) => {
        const newPoints = [...routePoints];
        const photos = [...(newPoints[pointIndex].photos || [])];
        photos.splice(photoIndex, 1);
        newPoints[pointIndex] = { ...newPoints[pointIndex], photos };
        setRoutePoints(newPoints);
    };

    const openMapForCity = async () => {
        setMapMode('city');
        setPendingMapCoords(null);
        setPendingCityName('');
        setPendingCountryName('');

        if (city) {
            try {
                const results = await Location.geocodeAsync(city);
                if (results.length > 0) {
                    setMapRegion({
                        latitude: results[0].latitude,
                        longitude: results[0].longitude,
                        latitudeDelta: 0.5,
                        longitudeDelta: 0.5,
                    });
                }
            } catch (e) {}
        }
        setShowMapModal(true);
    };

    const openMapForPoint = async (index: number) => {
        setMapMode('point');
        setActivePointIndex(index);
        const point = routePoints[index];

        let targetLat = point.latitude;
        let targetLng = point.longitude;

        if (targetLat === 0 && targetLng === 0 && point.name) {
            try {
                const results = await Location.geocodeAsync(point.name);
                if (results.length > 0) {
                    targetLat = results[0].latitude;
                    targetLng = results[0].longitude;
                }
            } catch (e) {
                console.log('Geocoding error:', e);
            }
        }

        if (targetLat !== 0) {
            setMapRegion({
                ...mapRegion,
                latitude: targetLat,
                longitude: targetLng,
            });
        }
        setShowMapModal(true);
    };

    const handleMapPress = async (e: any) => {
        const coords = e.nativeEvent.coordinate;

        if (mapMode === 'city') {
            setPendingMapCoords(coords);
            try {
                const results = await Location.reverseGeocodeAsync(coords);
                if (results.length > 0) {
                    const place = results[0];
                    setPendingCityName(place.city || place.subregion || place.name || '');
                    setPendingCountryName(place.country || '');
                }
            } catch (e) {}
            return;
        }

        if (activePointIndex === null) return;
        const newPoints = [...routePoints];
        newPoints[activePointIndex] = {
            ...newPoints[activePointIndex],
            latitude: coords.latitude,
            longitude: coords.longitude,
        };

        if (!newPoints[activePointIndex].name) {
            try {
                const results = await Location.reverseGeocodeAsync(coords);
                if (results.length > 0) {
                    const place = results[0];
                    newPoints[activePointIndex].name = place.city || place.name || '';
                }
            } catch (e) { }
        }

        setRoutePoints(newPoints);
    };

    const handleMapConfirm = () => {
        if (mapMode === 'city') {
            if (pendingCityName) setCity(pendingCityName);
            if (pendingCountryName) setCountry(pendingCountryName);
        }
        setShowMapModal(false);
        setPendingMapCoords(null);
    };

    const handleSubmit = () => {
        onSubmit({
            country,
            city,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            mood,
            image,
            route_json: JSON.stringify(routePoints),
            impressions
        });
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
        >
            <ScrollView
                style={[styles.container, { backgroundColor: colors.background }]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 100 }}
            >
                {/* Photo Picker */}
                <TouchableOpacity
                    onPress={pickImage}
                    style={[styles.photoCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                    {image ? (
                        <Image source={{ uri: image }} style={styles.selectedImage} />
                    ) : (
                        <View style={styles.photoPlaceholder}>
                            <Ionicons name="camera-outline" size={32} color={colors.primary} />
                            <Text style={[styles.photoText, { color: colors.secondaryText }]}>{t.tripDetails.addPhoto}</Text>
                        </View>
                    )}
                    {image && (
                        <TouchableOpacity
                            onPress={() => setImage('')}
                            style={[styles.removePhotoBtn, { backgroundColor: colors.error }]}
                        >
                            <Ionicons name="trash-outline" size={16} color="#FFF" />
                        </TouchableOpacity>
                    )}
                </TouchableOpacity>

                {/* Main Destination */}
                <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>
                    {t.tripDetails.city.toUpperCase()} & {t.tripDetails.country.toUpperCase()}
                </Text>
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                    <View style={styles.inputRow}>
                        <View style={[styles.iconBox, { backgroundColor: colors.primary + '15' }]}>
                            <Ionicons name="location-outline" size={20} color={colors.primary} />
                        </View>
                        <TextInput
                            style={[styles.input, { color: colors.text }]}
                            value={city}
                            onChangeText={handleCityChange}
                            placeholder={t.tripDetails.city}
                            placeholderTextColor={colors.border}
                        />
                        <TouchableOpacity
                            onPress={openMapForCity}
                            style={[styles.mapIconBtn, { backgroundColor: colors.primary + '10' }]}
                        >
                            <Ionicons name="map-outline" size={20} color={colors.primary} />
                        </TouchableOpacity>
                    </View>

                    {showSuggestions && (
                        <View style={[styles.suggestionsBox, { borderTopColor: colors.border }]}>
                            {suggestions.map((s, i) => (
                                <TouchableOpacity
                                    key={i}
                                    style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
                                    onPress={() => selectSuggestion(s)}
                                >
                                    <Text style={[styles.suggestionText, { color: colors.text }]}>{s.value}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    <View style={[styles.divider, { backgroundColor: colors.border }]} />

                    <View style={styles.inputRow}>
                        <View style={[styles.iconBox, { backgroundColor: colors.success + '15' }]}>
                            <Ionicons name="earth-outline" size={20} color={colors.success} />
                        </View>
                        <TextInput
                            style={[styles.input, { color: colors.text }]}
                            value={country}
                            onChangeText={handleCountryChange}
                            placeholder={t.tripDetails.country}
                            placeholderTextColor={colors.border}
                        />
                    </View>

                    {showCountrySuggestions && (
                        <View style={[styles.suggestionsBox, { borderTopColor: colors.border }]}>
                            {countrySuggestions.map((s, i) => (
                                <TouchableOpacity
                                    key={i}
                                    style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
                                    onPress={() => selectCountrySuggestion(s)}
                                >
                                    <Text style={[styles.suggestionText, { color: colors.text }]}>{s.value}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>

                {/* Dates */}
                <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>
                    {t.tripDetails.starts.toUpperCase()} & {t.tripDetails.ends.toUpperCase()}
                </Text>
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                    <View style={styles.datePickerRowContainer}>
                        <View style={styles.dateLabelRow}>
                            <View style={[styles.iconBox, { backgroundColor: colors.success + '15' }]}>
                                <Ionicons name="log-in-outline" size={20} color={colors.success} />
                            </View>
                            <Text style={[styles.dateLabelText, { color: colors.text }]}>{t.tripDetails.starts}</Text>
                        </View>
                        <DateTimePicker
                            value={startDate}
                            themeVariant={isDark ? 'dark' : 'light'}
                            mode="date"
                            display="compact"
                            onChange={(event, date) => {
                                if (date) setStartDate(date);
                            }}
                            style={{ width: 110 }}
                        />
                    </View>
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    <View style={styles.datePickerRowContainer}>
                        <View style={styles.dateLabelRow}>
                            <View style={[styles.iconBox, { backgroundColor: colors.error + '15' }]}>
                                <Ionicons name="log-out-outline" size={20} color={colors.error} />
                            </View>
                            <Text style={[styles.dateLabelText, { color: colors.text }]}>{t.tripDetails.ends}</Text>
                        </View>
                        <DateTimePicker
                            value={endDate}
                            themeVariant={isDark ? 'dark' : 'light'}
                            mode="date"
                            display="compact"
                            onChange={(event, date) => {
                                if (date) setEndDate(date);
                            }}
                            style={{ width: 110 }}
                        />
                    </View>
                </View>

                {/* Impressions */}
                <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>
                    {t.tripDetails.generalImpressions.toUpperCase()}
                </Text>
                <View style={[styles.card, { backgroundColor: colors.card, padding: 12 }]}>
                    <TextInput
                        style={[styles.textArea, { color: colors.text }]}
                        value={impressions}
                        onChangeText={setImpressions}
                        placeholder={t.tripDetails.generalImpressions}
                        placeholderTextColor={colors.border}
                        multiline
                        numberOfLines={4}
                    />
                </View>

                {/* Route Points */}
                <View style={styles.sectionHeaderRow}>
                    <Text style={[styles.sectionTitle, { color: colors.secondaryText, marginTop: 0 }]}>
                        {t.tripDetails.routeAndPoints.toUpperCase()}
                    </Text>
                    <TouchableOpacity
                        onPress={addRoutePoint}
                        style={[styles.addInlineBtn, { backgroundColor: colors.primary + '15' }]}
                    >
                        <Ionicons name="add" size={18} color={colors.primary} />
                        <Text style={[styles.addInlineText, { color: colors.primary }]}>{t.tripDetails.addPoint}</Text>
                    </TouchableOpacity>
                </View>

                {routePoints.map((point, index) => (
                    <View key={index} style={[styles.pointWrapper, { backgroundColor: colors.card, borderRadius: 20, marginBottom: 12 }]}>
                        {/* Point header row */}
                        <View style={styles.pointHeaderRow}>
                            <View style={styles.pointCard}>
                                <View style={[styles.pointNumber, { backgroundColor: colors.primary }]}>
                                    <Text style={styles.pointNumberText}>{index + 1}</Text>
                                </View>
                                <TextInput
                                    style={[styles.pointInput, { color: colors.text }]}
                                    value={point.name}
                                    onChangeText={(text) => updateRoutePoint(index, text)}
                                    placeholder={t.tripDetails.city}
                                    placeholderTextColor={colors.border}
                                />
                                <TouchableOpacity
                                    onPress={() => openMapForPoint(index)}
                                    style={[styles.mapIconBtn, { backgroundColor: colors.primary + '10' }]}
                                >
                                    <Ionicons
                                        name={point.latitude !== 0 ? 'location' : 'location-outline'}
                                        size={20}
                                        color={colors.primary}
                                    />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => removeRoutePoint(index)}
                                    style={styles.removeBtn}
                                >
                                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {showPointSuggestions[index] && pointSuggestions[index] && (
                            <View style={[styles.suggestionsBox, { borderTopColor: colors.border, backgroundColor: colors.card, marginHorizontal: 0, borderRadius: 0 }]}>
                                {pointSuggestions[index].map((s, i) => (
                                    <TouchableOpacity
                                        key={i}
                                        style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
                                        onPress={() => selectPointSuggestion(index, s)}
                                    >
                                        <Text style={[styles.suggestionText, { color: colors.text }]}>{s.value}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        {/* Note */}
                        <View style={[styles.pointNoteRow, { borderTopColor: colors.border }]}>
                            <TextInput
                                style={[styles.pointNote, { color: colors.text }]}
                                value={point.note || ''}
                                onChangeText={(text) => updateRoutePointNote(index, text)}
                                placeholder="Заметка..."
                                placeholderTextColor={colors.border}
                                multiline
                            />
                        </View>

                        {/* Photos */}
                        <View style={styles.pointPhotosRow}>
                            {(point.photos || []).map((uri, pi) => (
                                <View key={pi} style={styles.pointPhotoThumb}>
                                    <Image source={{ uri }} style={styles.pointPhotoImg} />
                                    <TouchableOpacity
                                        style={styles.removePhotoCircle}
                                        onPress={() => removePhotoFromPoint(index, pi)}
                                    >
                                        <Ionicons name="close-circle" size={18} color={colors.error} />
                                    </TouchableOpacity>
                                </View>
                            ))}
                            <TouchableOpacity
                                style={[styles.addPhotoBtn, { backgroundColor: colors.primary + '15' }]}
                                onPress={() => addPhotoToPoint(index)}
                            >
                                <Ionicons name="camera-outline" size={22} color={colors.primary} />
                            </TouchableOpacity>
                        </View>
                    </View>
                ))}

                {/* Mood Selection */}
                <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>{t.tripDetails.mood.toUpperCase()}</Text>
                <View style={styles.moodGrid}>
                    {MOODS.map(m => {
                        const isActive = mood === m.id;
                        const moodLabel = (t.tripDetails.moods as any)[m.id] || m.id;
                        return (
                            <TouchableOpacity
                                key={m.id}
                                activeOpacity={0.7}
                                onPress={() => setMood(m.id)}
                                style={[
                                    styles.moodBtn,
                                    { backgroundColor: colors.card },
                                    isActive ? { backgroundColor: m.bg, borderColor: m.color, borderWidth: 1 } : null
                                ]}
                            >
                                <Ionicons
                                    name={m.icon as any}
                                    size={22}
                                    color={isActive ? m.color : colors.secondaryText}
                                    style={{ marginBottom: 4 }}
                                />
                                <Text style={[
                                    styles.moodText,
                                    { color: colors.secondaryText },
                                    isActive ? { color: m.color, fontWeight: '700' } : null
                                ]}>
                                    {moodLabel}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                    style={[styles.submitBtn, { backgroundColor: colors.primary }, loading && { opacity: 0.7 }]}
                    onPress={handleSubmit}
                    disabled={loading || !city || !country}
                    activeOpacity={0.8}
                >
                    <Text style={[styles.submitBtnText, { color: '#FFF' }]}>
                        {loading ? '...' : (initialData ? t.tripDetails.editTrip : t.expenseForm.save)}
                    </Text>
                </TouchableOpacity>
            </ScrollView>

            {/* Map Picker Modal */}
            <Modal
                visible={showMapModal}
                animationType="slide"
                onRequestClose={() => setShowMapModal(false)}
            >
                <View style={{ flex: 1 }}>
                    <MapView
                        provider={PROVIDER_GOOGLE}
                        style={StyleSheet.absoluteFillObject}
                        initialRegion={mapRegion}
                        onPress={handleMapPress}
                    >
                        {mapMode === 'city' && pendingMapCoords && (
                            <Marker
                                coordinate={pendingMapCoords}
                                title={pendingCityName}
                            />
                        )}
                        {mapMode === 'point' && activePointIndex !== null && routePoints[activePointIndex].latitude !== 0 && (
                            <Marker
                                coordinate={{
                                    latitude: routePoints[activePointIndex].latitude,
                                    longitude: routePoints[activePointIndex].longitude
                                }}
                                title={routePoints[activePointIndex].name}
                            />
                        )}
                    </MapView>
                    <View style={styles.mapModalHeader}>
                        <TouchableOpacity
                            style={[styles.closeMapBtn, { backgroundColor: colors.card }]}
                            onPress={() => setShowMapModal(false)}
                        >
                            <Ionicons name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={[styles.mapModalTitle, { color: colors.text }]}>
                            {mapMode === 'city'
                                ? (pendingCityName || t.tripDetails.setPoint)
                                : (activePointIndex !== null ? (routePoints[activePointIndex].name || t.tripDetails.setPoint) : t.tripDetails.setPoint)
                            }
                        </Text>
                    </View>
                    <View style={styles.mapModalFooter}>
                        <Text style={[styles.mapHint, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                            {t.tripDetails.tapToSet}
                        </Text>
                        <TouchableOpacity
                            style={[styles.doneBtn, { backgroundColor: colors.primary }]}
                            onPress={handleMapConfirm}
                        >
                            <Text style={styles.doneBtnText}>{t.tripDetails.confirmPoint}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#8E8E93',
        marginBottom: 8,
        marginTop: 24,
        marginLeft: 16,
        textTransform: 'uppercase',
        letterSpacing: 1
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 32,
        marginBottom: 8,
        paddingRight: 8,
    },
    card: {
        borderRadius: 20,
        overflow: 'hidden',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        height: 56,
    },
    iconBox: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 17,
        fontWeight: '500',
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        marginLeft: 60,
    },
    datePickerRowContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
        minHeight: 56,
    },
    dateLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dateLabelText: {
        fontSize: 17,
        fontWeight: '500',
    },
    textArea: {
        fontSize: 16,
        minHeight: 100,
        textAlignVertical: 'top',
        paddingTop: 8,
    },
    addInlineBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 4,
    },
    addInlineText: {
        fontSize: 14,
        fontWeight: '700',
    },
    pointWrapper: {
        marginBottom: 8,
    },
    pointCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        padding: 12,
    },
    pointNumber: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    pointNumberText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: 'bold',
    },
    pointInput: {
        flex: 1,
        fontSize: 16,
        fontWeight: '500',
    },
    removeBtn: {
        padding: 4,
    },
    moodGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 4,
    },
    moodBtn: {
        width: '31%',
        flexGrow: 1,
        paddingVertical: 14,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderColor: 'transparent',
    },
    moodText: {
        fontSize: 12,
        fontWeight: '500',
        textTransform: 'capitalize'
    },
    submitBtn: {
        padding: 18,
        borderRadius: 18,
        marginTop: 40,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    submitBtnText: {
        fontSize: 17,
        fontWeight: 'bold'
    },
    suggestionsBox: {
        backgroundColor: 'transparent',
        borderTopWidth: 1,
    },
    pointSuggestions: {
        marginHorizontal: 16,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        marginTop: -4,
        zIndex: 10,
        elevation: 5,
    },
    suggestionItem: {
        padding: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    suggestionText: {
        fontSize: 16,
    },
    photoCard: {
        height: 180,
        borderRadius: 24,
        marginBottom: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
    },
    selectedImage: {
        width: '100%',
        height: '100%',
    },
    photoPlaceholder: {
        alignItems: 'center',
        gap: 8,
    },
    photoText: {
        fontSize: 15,
        fontWeight: '500',
    },
    removePhotoBtn: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mapIconBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 8,
    },
    pointHeaderRow: {
        padding: 12,
    },
    pointNoteRow: {
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    pointNote: {
        fontSize: 15,
        minHeight: 36,
    },
    pointPhotosRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        paddingHorizontal: 14,
        paddingBottom: 14,
    },
    pointPhotoThumb: {
        width: 64,
        height: 64,
        borderRadius: 10,
        overflow: 'visible',
    },
    pointPhotoImg: {
        width: 64,
        height: 64,
        borderRadius: 10,
    },
    removePhotoCircle: {
        position: 'absolute',
        top: -6,
        right: -6,
    },
    addPhotoBtn: {
        width: 64,
        height: 64,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mapModalHeader: {
        position: 'absolute',
        top: 60,
        left: 20,
        right: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    closeMapBtn: {
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
    mapModalTitle: {
        fontSize: 18,
        fontWeight: '700',
        backgroundColor: 'rgba(255,255,255,0.8)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        overflow: 'hidden',
    },
    mapModalFooter: {
        position: 'absolute',
        bottom: 40,
        left: 20,
        right: 20,
        alignItems: 'center',
        gap: 20,
    },
    mapHint: {
        color: '#FFF',
        fontSize: 14,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        overflow: 'hidden',
    },
    doneBtn: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    doneBtnText: {
        color: '#FFF',
        fontSize: 17,
        fontWeight: 'bold',
    },
});
