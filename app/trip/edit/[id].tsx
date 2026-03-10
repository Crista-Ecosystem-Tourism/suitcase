import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { TripForm } from '../../../components/TripForm';
import { getTripById, updateTrip, Trip } from '../../../services/trips';

export default function EditTripScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const [trip, setTrip] = useState<Trip | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (id) {
            loadTrip(id);
        }
    }, [id]);

    const loadTrip = async (tripId: string) => {
        try {
            const data = await getTripById(tripId);
            setTrip(data);
        } catch (error: any) {
            Alert.alert('Error', 'Failed to load trip');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (updatedData: any) => {
        if (!id) return;
        setSaving(true);
        try {
            await updateTrip(id, updatedData);
            Alert.alert('Success', 'Trip updated!');
            router.back();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <View style={styles.center}><ActivityIndicator size="large" /></View>;
    }

    if (!trip) return null;

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
