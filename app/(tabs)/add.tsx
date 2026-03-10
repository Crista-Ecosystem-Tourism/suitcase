import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { TripForm } from '../../components/TripForm';
import { addTrip } from '../../services/trips';
import { router } from 'expo-router';

export default function AddTripScreen() {
    const [loading, setLoading] = useState(false);

    const handleCreate = async (tripData: any) => {
        setLoading(true);
        try {
            await addTrip(tripData);
            Alert.alert('Success', 'Trip added successfully!');
            router.back();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <TripForm onSubmit={handleCreate} loading={loading} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F2F2F7' }
});
