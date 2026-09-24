import React, { useCallback, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    SafeAreaView,
    StatusBar,
    ActivityIndicator,
    Modal,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { useLanguage } from '../../hooks/useLanguage';
import { createGoal, deleteGoal, getGoals, updateGoal, type SuitcaseGoal } from '../../services/goals';

export default function GoalsScreen() {
    const { colors, isDark } = useTheme();
    const { t } = useLanguage();
    const [goals, setGoals] = useState<SuitcaseGoal[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [draftTitle, setDraftTitle] = useState('');
    const [draftTotal, setDraftTotal] = useState('');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState(false);
    const [updatingGoalId, setUpdatingGoalId] = useState<string | null>(null);
    const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);
    const requestIdRef = useRef(0);

    const loadGoals = useCallback(async () => {
        const requestId = ++requestIdRef.current;
        setLoading(true);
        setLoadError(false);
        try {
            const result = await getGoals();
            if (requestIdRef.current === requestId) setGoals(result);
        } catch (error) {
            console.error('Fetch goals error:', error);
            if (requestIdRef.current === requestId) setLoadError(true);
        } finally {
            if (requestIdRef.current === requestId) setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            void loadGoals();
            return () => {
                requestIdRef.current += 1;
            };
        }, [loadGoals])
    );

    const renderGoal = (goal: SuitcaseGoal) => {
        const progress = goal.total > 0 ? Math.min(goal.current / goal.total, 1) : 0;

        return (
            <View key={goal.id} style={[styles.goalCard, { backgroundColor: colors.card }]}>
                <View style={[styles.iconContainer, { backgroundColor: goal.color + '15' }]}>
                    <Ionicons name="flag-outline" size={24} color={goal.color} />
                </View>

                <View style={styles.goalInfo}>
                    <View style={styles.goalHeader}>
                        <Text style={[styles.goalTitle, { color: colors.text }]}>{goal.title}</Text>
                        <Text style={[styles.goalProgressText, { color: colors.secondaryText }]}>
                            {goal.current} / {goal.total}
                        </Text>
                    </View>

                    <View style={[styles.progressBarBg, { backgroundColor: colors.gray }]}>
                        <View
                            style={[
                                styles.progressBarFill,
                                { width: `${progress * 100}%`, backgroundColor: goal.color }
                            ]}
                        />
                    </View>
                </View>
                <View style={styles.goalActions}>
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={t.goals.advance}
                        disabled={goal.current >= goal.total || updatingGoalId !== null || deletingGoalId !== null}
                        onPress={() => void handleAdvanceGoal(goal)}
                        style={[styles.advanceButton, { backgroundColor: colors.background }]}
                    >
                        {updatingGoalId === goal.id ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            <Ionicons
                                name={goal.current >= goal.total ? 'checkmark' : 'add'}
                                size={22}
                                color={goal.current >= goal.total ? colors.success : colors.primary}
                            />
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={t.goals.deleteTitle}
                        disabled={updatingGoalId !== null || deletingGoalId !== null}
                        onPress={() => Alert.alert(t.goals.deleteTitle, t.goals.deleteMessage, [
                            { text: t.alerts.cancelBtn, style: 'cancel' },
                            { text: t.alerts.deleteBtn, style: 'destructive', onPress: () => void handleDeleteGoal(goal) },
                        ])}
                        style={[styles.advanceButton, { backgroundColor: colors.background }]}
                    >
                        {deletingGoalId === goal.id ? (
                            <ActivityIndicator size="small" color={colors.error} />
                        ) : (
                            <Ionicons name="trash-outline" size={19} color={colors.error} />
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const activeGoals = goals.filter(goal => goal.current < goal.total).length;
    const completedGoals = goals.length - activeGoals;

    const handleAdvanceGoal = async (goal: SuitcaseGoal) => {
        if (updatingGoalId !== null || deletingGoalId !== null || goal.current >= goal.total) return;
        setUpdatingGoalId(goal.id);
        try {
            const updated = await updateGoal(goal.id, { current: Math.min(goal.current + 1, goal.total) });
            setGoals(current => current.map(item => item.id === updated.id ? updated : item));
        } catch (error) {
            console.error('Update goal progress error:', error);
            Alert.alert(t.alerts.error, t.goals.updateError);
        } finally {
            setUpdatingGoalId(null);
        }
    };

    const handleDeleteGoal = async (goal: SuitcaseGoal) => {
        if (updatingGoalId !== null || deletingGoalId !== null) return;
        setDeletingGoalId(goal.id);
        try {
            await deleteGoal(goal.id);
            setGoals(current => current.filter(item => item.id !== goal.id));
        } catch (error) {
            console.error('Delete goal error:', error);
            Alert.alert(t.alerts.error, t.goals.deleteError);
        } finally {
            setDeletingGoalId(null);
        }
    };

    const handleCreateGoal = async () => {
        const title = draftTitle.trim();
        const total = Number(draftTotal);
        if (!title || !Number.isInteger(total) || total < 1) {
            setCreateError(true);
            return;
        }

        setCreating(true);
        setCreateError(false);
        try {
            const goal = await createGoal({ title, current: 0, total, color: colors.primary });
            setGoals(current => [...current, goal]);
            setDraftTitle('');
            setDraftTotal('');
            setCreateOpen(false);
        } catch (error) {
            console.error('Create goal error:', error);
            setCreateError(true);
        } finally {
            setCreating(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>{t.tabs.goals || 'Goals'}</Text>
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t.goals.addGoalBtn}
                    style={[styles.addBtn, { backgroundColor: colors.primary }]}
                    onPress={() => {
                        setCreateError(false);
                        setCreateOpen(true);
                    }}
                >
                    <Ionicons name="add" size={24} color="#FFF" />
                </TouchableOpacity>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                <View style={styles.statsOverview}>
                    <View style={[styles.statBox, { backgroundColor: colors.card }]}>
                        <Text style={[styles.statValue, { color: colors.primary }]}>{activeGoals}</Text>
                        <Text style={[styles.statLabel, { color: colors.secondaryText }]}>{t.goals.active}</Text>
                    </View>
                    <View style={[styles.statBox, { backgroundColor: colors.card }]}>
                        <Text style={[styles.statValue, { color: colors.success }]}>{completedGoals}</Text>
                        <Text style={[styles.statLabel, { color: colors.secondaryText }]}>{t.goals.completed}</Text>
                    </View>
                </View>

                <Text style={[styles.sectionTitle, { color: colors.text }]}>{t.goals.activeTitle}</Text>
                {loading && goals.length === 0 && (
                    <View style={styles.statusBox}>
                        <ActivityIndicator color={colors.primary} size="large" />
                        <Text style={[styles.statusText, { color: colors.secondaryText }]}>{t.goals.loading}</Text>
                    </View>
                )}
                {loadError && (
                    <View style={styles.statusBox}>
                        <Text style={[styles.statusText, { color: colors.secondaryText }]}>{t.goals.loadError}</Text>
                        <Text
                            accessibilityRole="button"
                            onPress={() => void loadGoals()}
                            style={[styles.retryText, { color: colors.primary }]}
                        >
                            {t.goals.retry}
                        </Text>
                    </View>
                )}
                {!loading && !loadError && goals.length === 0 && (
                    <Text style={[styles.statusText, { color: colors.secondaryText }]}>{t.goals.empty}</Text>
                )}
                {goals.map(renderGoal)}

                <View style={{ height: 100 }} />
            </ScrollView>

            <Modal
                visible={createOpen}
                transparent
                animationType="slide"
                onRequestClose={() => setCreateOpen(false)}
            >
                <KeyboardAvoidingView
                    style={styles.modalOverlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>{t.goals.newGoal}</Text>
                        <TextInput
                            value={draftTitle}
                            onChangeText={setDraftTitle}
                            placeholder={t.goals.namePlaceholder}
                            placeholderTextColor={colors.secondaryText}
                            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                            maxLength={80}
                            editable={!creating}
                        />
                        <TextInput
                            value={draftTotal}
                            onChangeText={setDraftTotal}
                            placeholder={t.goals.targetPlaceholder}
                            placeholderTextColor={colors.secondaryText}
                            keyboardType="number-pad"
                            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                            editable={!creating}
                        />
                        {createError && (
                            <Text style={[styles.formError, { color: colors.error }]}>
                                {!draftTitle.trim() || !Number.isInteger(Number(draftTotal)) || Number(draftTotal) < 1
                                    ? t.goals.validationError
                                    : t.goals.createError}
                            </Text>
                        )}
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                accessibilityRole="button"
                                onPress={() => setCreateOpen(false)}
                                disabled={creating}
                                style={styles.modalAction}
                            >
                                <Text style={{ color: colors.secondaryText }}>{t.alerts.cancelBtn}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                accessibilityRole="button"
                                onPress={() => void handleCreateGoal()}
                                disabled={creating}
                                style={[styles.modalAction, styles.primaryAction, { backgroundColor: colors.primary }]}
                            >
                                {creating
                                    ? <ActivityIndicator color="#FFF" />
                                    : <Text style={styles.primaryActionText}>{t.goals.create}</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
    },
    title: {
        fontSize: 34,
        fontWeight: 'bold',
    },
    addBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        padding: 16,
    },
    statsOverview: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    statBox: {
        flex: 1,
        padding: 16,
        borderRadius: 20,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    statLabel: {
        fontSize: 13,
        marginTop: 4,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    statusBox: {
        alignItems: 'center',
        padding: 24,
        marginBottom: 12,
    },
    statusText: {
        textAlign: 'center',
        marginVertical: 8,
    },
    retryText: {
        padding: 8,
        fontWeight: '700',
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    modalCard: {
        padding: 20,
        paddingBottom: 32,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        gap: 12,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 4,
    },
    input: {
        minHeight: 48,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        fontSize: 16,
    },
    formError: {
        fontSize: 13,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 4,
    },
    modalAction: {
        minWidth: 96,
        minHeight: 44,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 14,
        borderRadius: 12,
    },
    primaryAction: {
        minWidth: 120,
    },
    primaryActionText: {
        color: '#FFF',
        fontWeight: '700',
    },
    goalCard: {
        flexDirection: 'row',
        padding: 16,
        borderRadius: 24,
        marginBottom: 12,
        alignItems: 'center',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    goalInfo: {
        flex: 1,
    },
    goalActions: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
    advanceButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 12,
    },
    goalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    goalTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
    goalProgressText: {
        fontSize: 13,
    },
    progressBarBg: {
        height: 6,
        borderRadius: 3,
        width: '100%',
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 3,
    },
});
