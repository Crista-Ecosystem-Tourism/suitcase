import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator, StatusBar, TouchableOpacity, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { ExpenseForm } from '../../../components/ExpenseForm';
import { getExpenseById, updateExpense, deleteExpense, Expense } from '../../../services/expenses';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../../hooks/useLanguage';

export default function EditExpenseScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { t } = useLanguage();
    const [expense, setExpense] = useState<Expense | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        if (id) void loadExpense(id);
        else setLoading(false);
    }, [id]);

    const loadExpense = async (expenseId: string) => {
        setLoading(true);
        setLoadError(false);
        try {
            const data = await getExpenseById(expenseId);
            setExpense(data);
        } catch (error) {
            console.error('Fetch expense for edit error:', error);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (updatedData: any) => {
        if (!id) return;
        setSaving(true);
        try {
            await updateExpense(id, updatedData);
            Alert.alert(t.alerts.ok, t.alerts.saveSuccess);
            router.back();
        } catch (error) {
            console.error('Update expense error:', error);
            Alert.alert(t.alerts.error, error instanceof Error ? error.message : t.alerts.updateError);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = () => {
        Alert.alert(t.alerts.confirmDelete, t.alerts.deleteSub, [
            { text: t.alerts.cancelBtn, style: "cancel" },
            {
                text: t.alerts.deleteBtn,
                style: "destructive",
                onPress: async () => {
                    if (!id) return;
                    setDeleting(true);
                    try {
                        await deleteExpense(id);
                        router.back();
                    } catch (error) {
                        console.error('Delete expense error:', error);
                        Alert.alert(t.alerts.error, t.alerts.deleteError);
                    } finally {
                        setDeleting(false);
                    }
                }
            }
        ]);
    };

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;
    if (!expense) {
        return (
            <View style={styles.center}>
                <Text>{loadError ? t.expenseForm.loadError : t.expenseForm.notFound}</Text>
                {loadError && <Text accessibilityRole="button" onPress={() => id && void loadExpense(id)}>{t.expenseForm.retry}</Text>}
            </View>
        );
    }

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
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} disabled={deleting}>
                {deleting
                    ? <ActivityIndicator size="small" color="#FF3B30" />
                    : <Ionicons name="trash-outline" size={20} color="#FF3B30" />}
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
