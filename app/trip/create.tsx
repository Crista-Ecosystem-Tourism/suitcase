import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { router, Stack } from 'expo-router';
import { TripForm } from '../../components/TripForm';
import { addTrip } from '../../services/trips';
import { useTheme } from '../../hooks/useTheme';
import { useLanguage } from '../../hooks/useLanguage';

export default function AddTripScreen() {
    const { colors } = useTheme();
    const { t } = useLanguage();
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (tripData: any) => {
        setLoading(true);
        try {
            await addTrip(tripData);
            Alert.alert(t.alerts.saveSuccess, t.tripDetails.createSuccess);
            router.back();
        } catch (error) {
            console.error(error);
            Alert.alert(t.alerts.error, t.tripDetails.createError);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen options={{ title: t.tripDetails.newTrip, headerShown: true }} />
            <TripForm onSubmit={handleSubmit} loading={loading} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    }
});
