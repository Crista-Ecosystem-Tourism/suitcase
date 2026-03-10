import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useLanguage } from '../../hooks/useLanguage';

const { width } = Dimensions.get('window');

interface Goal {
    id: string;
    title: string;
    current: number;
    total: number;
    icon: string;
    color: string;
}

const INITIAL_GOALS: Goal[] = [
    { id: '1', title: 'Countries Visited', current: 12, total: 30, icon: 'earth', color: '#007AFF' },
    { id: '2', title: 'World Wonders', current: 3, total: 7, icon: 'medal', color: '#FF9500' },
    { id: '3', title: 'Photo Collection', current: 450, total: 1000, icon: 'images', color: '#AF52DE' },
    { id: '4', title: 'Flight Hours', current: 86, total: 200, icon: 'airplane', color: '#34C759' },
];

export default function GoalsScreen() {
    const { colors, isDark } = useTheme();
    const { t } = useLanguage();
    const [goals, setGoals] = useState<Goal[]>(INITIAL_GOALS);

    const renderGoal = (goal: Goal) => {
        const progress = Math.min(goal.current / goal.total, 1);

        return (
            <TouchableOpacity
                key={goal.id}
                style={[styles.goalCard, { backgroundColor: colors.card }]}
                activeOpacity={0.7}
            >
                <View style={[styles.iconContainer, { backgroundColor: goal.color + '15' }]}>
                    <Ionicons name={goal.icon as any} size={24} color={goal.color} />
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
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>{t.tabs.goals || 'Goals'}</Text>
                <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]}>
                    <Ionicons name="add" size={24} color="#FFF" />
                </TouchableOpacity>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                <View style={styles.statsOverview}>
                    <View style={[styles.statBox, { backgroundColor: colors.card }]}>
                        <Text style={[styles.statValue, { color: colors.primary }]}>4</Text>
                        <Text style={[styles.statLabel, { color: colors.secondaryText }]}>Active</Text>
                    </View>
                    <View style={[styles.statBox, { backgroundColor: colors.card }]}>
                        <Text style={[styles.statValue, { color: colors.success }]}>12</Text>
                        <Text style={[styles.statLabel, { color: colors.secondaryText }]}>Completed</Text>
                    </View>
                </View>

                <Text style={[styles.sectionTitle, { color: colors.text }]}>Active Goals</Text>
                {goals.map(renderGoal)}

                <TouchableOpacity
                    style={[styles.suggestCard, { borderColor: colors.border }]}
                    activeOpacity={0.8}
                >
                    <Ionicons name="bulb-outline" size={24} color={colors.primary} />
                    <Text style={[styles.suggestText, { color: colors.text }]}>Need more goals? Tap here for ideas!</Text>
                </TouchableOpacity>

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
    addBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
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
    suggestCard: {
        marginTop: 12,
        padding: 20,
        borderRadius: 24,
        borderWidth: 1,
        borderStyle: 'dashed',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    suggestText: {
        fontSize: 15,
        fontWeight: '500',
        flex: 1,
    },
});
