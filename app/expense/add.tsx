import React, { useState } from 'react';
import { View, StyleSheet, Alert, StatusBar } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { ExpenseForm } from '../../components/ExpenseForm';
import { addExpense } from '../../services/expenses';

export default function AddExpenseScreen() {
    const { trip_id } = useLocalSearchParams<{ trip_id: string }>();
    const [loading, setLoading] = useState(false);

    const handleCreate = async (expenseData: any) => {
        if (!trip_id) return;
        setLoading(true);
        try {
            await addExpense(expenseData);
            Alert.alert('Success', 'Expense logged!');
            router.back();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <ExpenseForm onSubmit={handleCreate} loading={loading} tripId={trip_id!} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F2F2F7' }
});
