import React, { useCallback, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    SafeAreaView,
    StatusBar,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { useLanguage } from '../../hooks/useLanguage';
import { getGoals, type SuitcaseGoal } from '../../services/goals';

export default function GoalsScreen() {
    const { colors, isDark } = useTheme();
    const { t } = useLanguage();
    const [goals, setGoals] = useState<SuitcaseGoal[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
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
            </View>
        );
    };

    const activeGoals = goals.filter(goal => goal.current < goal.total).length;
    const completedGoals = goals.length - activeGoals;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>{t.tabs.goals || 'Goals'}</Text>
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
