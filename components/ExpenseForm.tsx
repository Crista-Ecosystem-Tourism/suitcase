import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Dimensions
} from 'react-native';
import { Expense, ExpenseShare } from '../services/expenses';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useLanguage } from '../hooks/useLanguage';
import { POPULAR_CURRENCIES, getCurrencySymbol } from '../services/currencies';
import { Modal, FlatList } from 'react-native';
import { getTripMembers, TripMember } from '../services/tripGroup';
import { useAuth } from '../hooks/useAuth';

const { width } = Dimensions.get('window');

interface ExpenseFormProps {
    initialData?: Partial<Expense>;
    onSubmit: (expense: Omit<Expense, 'id'>) => void;
    loading?: boolean;
    tripId: string;
}

const CATEGORIES = [
    { id: 'Food', icon: 'restaurant-outline', color: '#FF9500' },
    { id: 'Transport', icon: 'car-outline', color: '#007AFF' },
    { id: 'Hotel', icon: 'bed-outline', color: '#5856D6' },
    { id: 'Sightseeing', icon: 'camera-outline', color: '#AF52DE' },
    { id: 'Shopping', icon: 'cart-outline', color: '#FF2D55' },
    { id: 'Other', icon: 'ellipsis-horizontal-outline', color: '#8E8E93' },
];

function parseAmountUnits(value: string): number | null {
    const match = value.trim().match(/^(\d+)(?:[.,](\d{0,4}))?$/);
    if (!match) return null;
    const whole = Number(match[1]);
    const fractional = Number(`${match[2] || ''}0000`.slice(0, 4));
    const units = whole * 10000 + fractional;
    return Number.isSafeInteger(units) ? units : null;
}

function formatAmountUnits(units: number): string {
    const whole = Math.floor(units / 10000);
    const fractional = String(units % 10000).padStart(4, '0');
    return `${whole}.${fractional}`;
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({ initialData, onSubmit, loading, tripId }) => {
    const { colors, isDark } = useTheme();
    const { t } = useLanguage();
    const { user } = useAuth();

    const [title, setTitle] = useState(initialData?.title || '');
    const [amount, setAmount] = useState(initialData?.amount?.toString() || '');
    const [currency, setCurrency] = useState(initialData?.currency || 'RUB');
    const [category, setCategory] = useState(initialData?.category || 'Other');
    const [date, setDate] = useState(new Date(initialData?.date || Date.now()));
    const [showCurrencyModal, setShowCurrencyModal] = useState(false);
    const [members, setMembers] = useState<TripMember[]>([]);
    const [splitMemberIds, setSplitMemberIds] = useState<string[]>([]);
    const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal');
    const [customShares, setCustomShares] = useState<Record<string, string>>({});
    const [splitError, setSplitError] = useState<string | null>(null);
    const [paidByUserId, setPaidByUserId] = useState<string | undefined>(user?.id);

    useEffect(() => {
        let active = true;
        void getTripMembers(tripId).then(rows => {
            if (!active) return;
            setMembers(rows);
            setSplitMemberIds(rows.length > 1 ? rows.map(row => row.user_id) : []);
            setPaidByUserId(current => current && rows.some(row => row.user_id === current) ? current : user?.id);
        }).catch(() => {
            if (active) setMembers([]);
        });
        return () => { active = false; };
    }, [tripId]);

    const toggleMember = (memberId: string) => {
        setSplitMemberIds(current => {
            if (current.includes(memberId)) return current.length === 1 ? current : current.filter(id => id !== memberId);
            return [...current, memberId];
        });
    };

    const beginCustomSplit = () => {
        const amountUnits = parseAmountUnits(amount);
        const participants = splitMemberIds.length ? splitMemberIds : members.map(member => member.user_id);
        if (amountUnits === null || amountUnits <= 0 || participants.length === 0) {
            setSplitError('Сначала укажите сумму и хотя бы одного участника.');
            return;
        }
        const base = Math.floor(amountUnits / participants.length);
        const remainder = amountUnits - base * participants.length;
        setCustomShares(Object.fromEntries(participants.map((memberId, index) => [
            memberId,
            formatAmountUnits(base + (index === 0 ? remainder : 0)),
        ])));
        setSplitError(null);
        setSplitMode('custom');
    };

    const updateCustomShare = (memberId: string, value: string) => {
        setCustomShares(current => ({ ...current, [memberId]: value }));
        setSplitError(null);
    };

    const handleSubmit = () => {
        const numAmount = parseFloat(amount.replace(',', '.'));
        if (!title || isNaN(numAmount)) return;

        let shares: ExpenseShare[] | undefined;
        if (splitMode === 'custom') {
            const amountUnits = parseAmountUnits(amount);
            const parsedShares = members.map(member => ({
                userId: member.user_id,
                amount: parseAmountUnits(customShares[member.user_id] || ''),
            })).filter((share): share is { userId: string; amount: number } => share.amount !== null && share.amount > 0);
            if (amountUnits === null || parsedShares.length === 0 || parsedShares.reduce((total, share) => total + share.amount, 0) !== amountUnits) {
                setSplitError('Сумма долей должна точно совпадать с расходом.');
                return;
            }
            shares = parsedShares.map(share => ({ userId: share.userId, amount: formatAmountUnits(share.amount) }));
        }

        onSubmit({
            trip_id: tripId,
            title,
            amount: numAmount,
            currency,
            category,
            date: date.toISOString(),
            splitMemberIds: splitMode === 'equal' && splitMemberIds.length ? splitMemberIds : undefined,
            paidByUserId,
            shares,
        });
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
        >
            <ScrollView
                style={[styles.container, { backgroundColor: colors.background }]}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Amount Input Large */}
                <View style={styles.amountHeader}>
                    <TouchableOpacity
                        onPress={() => setShowCurrencyModal(true)}
                        style={[styles.currencyPickerTrigger, { backgroundColor: colors.card }]}
                    >
                        <Text style={[styles.amountCurrency, { color: colors.primary }]}>{getCurrencySymbol(currency)}</Text>
                        <Ionicons name="chevron-down" size={20} color={colors.primary} />
                    </TouchableOpacity>
                    <TextInput
                        style={[styles.amountInput, { color: colors.text }]}
                        value={amount}
                        onChangeText={setAmount}
                        placeholder="0"
                        placeholderTextColor={colors.border}
                        keyboardType="decimal-pad"
                        autoFocus={!initialData}
                    />
                </View>

                {/* Main Fields Card */}
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                    <View style={styles.inputRow}>
                        <View style={[styles.iconBox, { backgroundColor: colors.primary + '15' }]}>
                            <Ionicons name="pencil-outline" size={20} color={colors.primary} />
                        </View>
                        <TextInput
                            style={[styles.input, { color: colors.text }]}
                            value={title}
                            onChangeText={setTitle}
                            placeholder={t.expenseForm.titlePlaceholder}
                            placeholderTextColor={colors.border}
                        />
                    </View>

                    <View style={[styles.divider, { backgroundColor: colors.background }]} />

                    <View style={styles.inputRow}>
                        <View style={[styles.iconBox, { backgroundColor: colors.success + '15' }]}>
                            <Ionicons name="calendar-outline" size={20} color={colors.success} />
                        </View>
                        <Text style={[styles.dateLabel, { color: colors.text }]}>{t.expenseForm.date}</Text>
                        <DateTimePicker
                            value={date}
                            mode="date"
                            display="compact"
                            accentColor={colors.primary}
                            onChange={(event, d) => {
                                if (d) setDate(d);
                            }}
                            style={{ width: 100 }}
                        />
                    </View>
                </View>

                {/* Categories Scrollable Chips */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{t.expenseForm.category}</Text>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipContainer}
                >
                    {CATEGORIES.map(cat => {
                        const isActive = category === cat.id;
                        // Map internal ID to translation key (handling minor differences like Hotel/Lodging)
                        const catKey = cat.id.toLowerCase() === 'hotel' ? 'lodging' : cat.id.toLowerCase();
                        const catLabel = (t.expenseForm.categories as any)[catKey] || cat.id;

                        return (
                            <TouchableOpacity
                                key={cat.id}
                                activeOpacity={0.7}
                                onPress={() => setCategory(cat.id)}
                                style={[
                                    styles.chip,
                                    { backgroundColor: colors.card },
                                    isActive && { backgroundColor: cat.color, borderColor: cat.color }
                                ]}
                            >
                                <Ionicons
                                    name={cat.icon as any}
                                    size={18}
                                    color={isActive ? '#FFF' : colors.secondaryText}
                                />
                                <Text style={[
                                    styles.chipText,
                                    { color: colors.secondaryText },
                                    isActive && { color: '#FFF', fontWeight: '700' }
                                ]}>
                                    {catLabel}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {members.length > 1 && (
                    <View style={styles.splitSection}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Оплатил</Text>
                        <Text style={[styles.splitHint, { color: colors.secondaryText }]}>Укажите, кто оплатил этот расход.</Text>
                        {members.map((member, index) => {
                            const selected = paidByUserId === member.user_id;
                            const label = member.user_id === user?.id ? 'Вы' : `Участник ${index + 1}`;
                            return <TouchableOpacity key={`payer-${member.user_id}`} onPress={() => setPaidByUserId(member.user_id)} style={[styles.memberRow, { borderColor: colors.border }]}>
                                <Text style={[styles.memberLabel, { color: colors.text }]}>{label}</Text>
                                <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={24} color={selected ? colors.primary : colors.secondaryText} />
                            </TouchableOpacity>;
                        })}
                        <View style={styles.splitModeRow}>
                            <TouchableOpacity onPress={() => { setSplitMode('equal'); setSplitError(null); }} style={[styles.splitModeButton, { borderColor: colors.border }, splitMode === 'equal' && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                                <Text style={[styles.splitModeText, { color: splitMode === 'equal' ? '#FFF' : colors.text }]}>Поровну</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={beginCustomSplit} style={[styles.splitModeButton, { borderColor: colors.border }, splitMode === 'custom' && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                                <Text style={[styles.splitModeText, { color: splitMode === 'custom' ? '#FFF' : colors.text }]}>Точные доли</Text>
                            </TouchableOpacity>
                        </View>
                        {splitMode === 'equal' ? <>
                            <Text style={[styles.splitHint, { color: colors.secondaryText }]}>Сумма делится между отмеченными участниками.</Text>
                            {members.map((member, index) => {
                                const selected = splitMemberIds.includes(member.user_id);
                                const label = member.user_id === user?.id ? 'Вы' : `Участник ${index + 1}`;
                                return <TouchableOpacity key={member.user_id} onPress={() => toggleMember(member.user_id)} style={[styles.memberRow, { borderColor: colors.border }]}>
                                    <Text style={[styles.memberLabel, { color: colors.text }]}>{label}</Text>
                                    <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={selected ? colors.primary : colors.secondaryText} />
                                </TouchableOpacity>;
                            })}
                        </> : <>
                            <Text style={[styles.splitHint, { color: colors.secondaryText }]}>Укажите сумму каждого участника. Пустая доля не участвует в расходе.</Text>
                            {members.map((member, index) => {
                                const label = member.user_id === user?.id ? 'Вы' : `Участник ${index + 1}`;
                                return <View key={member.user_id} style={[styles.memberRow, { borderColor: colors.border }]}>
                                    <Text style={[styles.memberLabel, { color: colors.text }]}>{label}</Text>
                                    <TextInput value={customShares[member.user_id] || ''} onChangeText={(value) => updateCustomShare(member.user_id, value)} placeholder="0" placeholderTextColor={colors.border} keyboardType="decimal-pad" style={[styles.shareInput, { color: colors.text, borderColor: colors.border }]} />
                                </View>;
                            })}
                        </>}
                        {splitError && <Text style={[styles.splitError, { color: colors.error }]}>{splitError}</Text>}
                    </View>
                )}

                {/* Submit Button */}
                <TouchableOpacity
                    style={[
                        styles.submitBtn,
                        { backgroundColor: colors.primary },
                        (!title || !amount) && { opacity: 0.5 }
                    ]}
                    onPress={handleSubmit}
                    disabled={loading || !title || !amount}
                    activeOpacity={0.8}
                >
                    <Text style={[styles.submitBtnText, { color: '#FFF' }]}>
                        {loading ? t.expenseForm.saving : (initialData ? t.expenseForm.save : t.expenseForm.addTitle)}
                    </Text>
                </TouchableOpacity>

                <View style={{ height: 100 }} />
            </ScrollView>

            <Modal
                visible={showCurrencyModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowCurrencyModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>{t.currencies.title}</Text>
                            <TouchableOpacity onPress={() => setShowCurrencyModal(false)}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={POPULAR_CURRENCIES}
                            keyExtractor={item => item.code}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[styles.currencyItem, { borderBottomColor: colors.background }]}
                                    onPress={() => {
                                        setCurrency(item.code);
                                        setShowCurrencyModal(false);
                                    }}
                                >
                                    <Text style={[styles.currencyCode, { color: colors.text }]}>{item.code}</Text>
                                    <Text style={[styles.currencyName, { color: colors.secondaryText }]}>{item.name}</Text>
                                    <Text style={[styles.currencySymbol, { color: colors.primary }]}>{item.symbol}</Text>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { padding: 20 },
    amountHeader: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: 40,
    },
    amountCurrency: {
        fontSize: 34,
        fontWeight: 'bold',
        marginRight: 8,
    },
    amountInput: {
        fontSize: 56,
        fontWeight: '800',
        minWidth: 100,
        textAlign: 'center',
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 16,
        marginTop: 32,
    },
    splitSection: { marginTop: 8 },
    splitHint: { fontSize: 13, marginTop: -8, marginBottom: 10 },
    splitModeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    splitModeButton: { flex: 1, minHeight: 38, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    splitModeText: { fontSize: 14, fontWeight: '700' },
    memberRow: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    memberLabel: { fontSize: 15, fontWeight: '600' },
    shareInput: { width: 104, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, textAlign: 'right', fontSize: 15, fontWeight: '600' },
    splitError: { fontSize: 13, marginTop: 2, marginBottom: 4 },
    card: {
        borderRadius: 24,
        overflow: 'hidden',
        padding: 8,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        height: 60
    },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 17,
        fontWeight: '500',
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        marginHorizontal: 16,
    },
    dateLabel: {
        fontSize: 17,
        flex: 1,
        fontWeight: '500',
    },
    chipContainer: {
        gap: 8,
        paddingRight: 20,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'transparent',
        gap: 8,
    },
    chipText: {
        fontSize: 15,
        fontWeight: '500',
    },
    submitBtn: {
        padding: 18,
        borderRadius: 18,
        marginTop: 40,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    submitBtnText: {
        fontSize: 17,
        fontWeight: 'bold',
    },
    currencyPickerTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        marginRight: 12,
        gap: 4,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        height: '70%',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    currencyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    currencyCode: {
        fontSize: 17,
        fontWeight: 'bold',
        width: 60,
    },
    currencyName: {
        fontSize: 15,
        flex: 1,
    },
    currencySymbol: {
        fontSize: 18,
        fontWeight: '600',
    }
});
