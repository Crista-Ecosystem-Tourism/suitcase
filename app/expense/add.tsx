import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, StatusBar } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { ExpenseForm } from '../../components/ExpenseForm';
import { addExpense } from '../../services/expenses';
import { useLanguage } from '../../hooks/useLanguage';

export default function AddExpenseScreen() {
    const { trip_id } = useLocalSearchParams<{ trip_id: string }>();
    const { t } = useLanguage();
    const tripId = Array.isArray(trip_id) ? trip_id[0] : trip_id;
    const [loading, setLoading] = useState(false);

    const handleCreate = async (expenseData: any) => {
        if (!tripId) {
            Alert.alert(t.alerts.error, t.expenseForm.tripRequired);
            return;
        }
        setLoading(true);
        try {
            await addExpense(expenseData);
            Alert.alert(t.alerts.saveSuccess, t.expenseForm.createSuccess);
            router.back();
        } catch (error) {
            console.error('Create expense error:', error);
            Alert.alert(t.alerts.error, t.expenseForm.createError);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            {tripId ? (
                <ExpenseForm onSubmit={handleCreate} loading={loading} tripId={tripId} />
            ) : (
                <View style={styles.missingTrip}>
                    <Text>{t.expenseForm.tripRequired}</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F2F2F7' },
    missingTrip: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
