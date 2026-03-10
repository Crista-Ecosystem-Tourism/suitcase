import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { router, Stack } from 'expo-router';
import { TripForm } from '../../components/TripForm';
import { addTrip } from '../../services/trips';
import { useTheme } from '../../hooks/useTheme';

export default function AddTripScreen() {
    const { colors } = useTheme();
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (tripData: any) => {
        setLoading(true);
        try {
            await addTrip(tripData);
            Alert.alert('Success', 'Trip created successfully!');
            router.back();
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to create trip');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen options={{ title: 'New Trip', headerShown: true }} />
            <TripForm onSubmit={handleSubmit} loading={loading} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    }
});
