import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { TripForm } from '../../../components/TripForm';
import { getTripById, updateTrip, Trip } from '../../../services/trips';
import { useLanguage } from '../../../hooks/useLanguage';

export default function EditTripScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { t } = useLanguage();
    const [trip, setTrip] = useState<Trip | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (id) void loadTrip(id);
        else setLoading(false);
    }, [id]);

    const loadTrip = async (tripId: string) => {
        setLoading(true);
        setLoadError(false);
        try {
            const data = await getTripById(tripId);
            setTrip(data);
        } catch (error: any) {
            console.error('Fetch trip for edit error:', error);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (updatedData: any) => {
        if (!id) return;
        setSaving(true);
        try {
            await updateTrip(id, updatedData);
            Alert.alert(t.alerts.ok, t.alerts.saveSuccess);
            router.back();
        } catch (error) {
            console.error('Update trip error:', error);
            Alert.alert(t.alerts.error, error instanceof Error ? error.message : t.alerts.updateError);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <View style={styles.center}><ActivityIndicator size="large" /></View>;
    }

    if (!trip) {
        return (
            <View style={styles.center}>
                <Text>{loadError ? t.tripDetails.loadError : t.tripDetails.notFound}</Text>
                {loadError && <Text accessibilityRole="button" onPress={() => id && void loadTrip(id)}>{t.tripDetails.retry}</Text>}
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <TripForm
                initialData={trip}
                onSubmit={handleUpdate}
                loading={saving}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F2F2F7' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});
