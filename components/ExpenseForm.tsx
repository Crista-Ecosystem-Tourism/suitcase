import React, { useState } from 'react';
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
import { Expense } from '../services/expenses';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useLanguage } from '../hooks/useLanguage';
import { POPULAR_CURRENCIES, getCurrencySymbol } from '../services/currencies';
import { Modal, FlatList } from 'react-native';

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

export const ExpenseForm: React.FC<ExpenseFormProps> = ({ initialData, onSubmit, loading, tripId }) => {
    const { colors, isDark } = useTheme();
    const { t } = useLanguage();

    const [title, setTitle] = useState(initialData?.title || '');
    const [amount, setAmount] = useState(initialData?.amount?.toString() || '');
    const [currency, setCurrency] = useState(initialData?.currency || 'RUB');
    const [category, setCategory] = useState(initialData?.category || 'Other');
    const [date, setDate] = useState(new Date(initialData?.date || Date.now()));
    const [showCurrencyModal, setShowCurrencyModal] = useState(false);

    const handleSubmit = () => {
        const numAmount = parseFloat(amount.replace(',', '.'));
        if (!title || isNaN(numAmount)) return;

        onSubmit({
            trip_id: tripId,
            title,
            amount: numAmount,
            currency,
            category,
            date: date.toISOString(),
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
