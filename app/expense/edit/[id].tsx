import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator, StatusBar, TouchableOpacity, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { ExpenseForm } from '../../../components/ExpenseForm';
import { getExpenseById, updateExpense, deleteExpense, Expense } from '../../../services/expenses';
import { Ionicons } from '@expo/vector-icons';

export default function EditExpenseScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const [expense, setExpense] = useState<Expense | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (id) loadExpense(id);
    }, [id]);

    const loadExpense = async (expenseId: string) => {
        try {
            const data = await getExpenseById(expenseId);
            setExpense(data);
        } catch (error) {
            Alert.alert('Error', 'Failed to load expense');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (updatedData: any) => {
        if (!id) return;
        setSaving(true);
        try {
            await updateExpense(id, updatedData);
            Alert.alert('Success', 'Expense updated!');
            router.back();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = () => {
        Alert.alert("Delete Expense", "Are you sure?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    if (id) {
                        await deleteExpense(id);
                        router.back();
                    }
                }
            }
        ]);
    };

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;
    if (!expense) return null;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <ExpenseForm
                initialData={expense}
                onSubmit={handleUpdate}
                loading={saving}
                tripId={expense.trip_id}
            />
            {/* Кнопка удаления в футере или через навигацию? Добавим кнопку в форму или здесь */}
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                <StatusBar barStyle="dark-content" />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F2F2F7' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    deleteBtn: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? -50 : 10, // Placeholder, usually handled via Header
        right: 20,
        backgroundColor: '#FFF',
        padding: 10,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        elevation: 2
    }
});
