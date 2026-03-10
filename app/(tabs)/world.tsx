import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Image,
    SafeAreaView,
    StatusBar,
    ActivityIndicator,
    Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useLanguage } from '../../hooks/useLanguage';
import { getCountrySuggestions } from '../../services/dadata';

const POPULAR_DESTINATIONS = [
    { id: '1', name: 'Париж', country: 'Франция', image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400' },
    { id: '2', name: 'Рим', country: 'Италия', image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400' },
    { id: '3', name: 'Токио', country: 'Япония', image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400' },
    { id: '4', name: 'Нью-Йорк', country: 'США', image: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=400' },
];

const INITIAL_COUNTRIES = [
    { id: '1', name: 'Россия', code: 'RU', flag: '🇷🇺' },
    { id: '2', name: 'Франция', code: 'FR', flag: '🇫🇷' },
    { id: '3', name: 'Италия', code: 'IT', flag: '🇮🇹' },
    { id: '4', name: 'Япония', code: 'JP', flag: '🇯🇵' },
    { id: '5', name: 'США', code: 'US', flag: '🇺🇸' },
    { id: '6', name: 'Германия', code: 'DE', flag: '🇩🇪' },
    { id: '7', name: 'Китай', code: 'CN', flag: '🇨🇳' },
    { id: '8', name: 'Турция', code: 'TR', flag: '🇹🇷' },
];

// Animated card component with staggered entrance
function AnimatedCard({ index, children, style, direction = 'vertical' }: {
    index: number;
    children: React.ReactNode;
    style?: any;
    direction?: 'vertical' | 'horizontal';
}) {
    const animValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.spring(animValue, {
            toValue: 1,
            delay: index * 100,
            useNativeDriver: true,
            tension: 50,
            friction: 8,
        }).start();
    }, []);

    const translateKey = direction === 'vertical' ? 'translateY' : 'translateX';
    const startOffset = direction === 'vertical' ? 30 : -30;

    return (
        <Animated.View style={[
            style,
            {
                opacity: animValue,
                transform: [{
                    [translateKey]: animValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: [startOffset, 0],
                    })
                }],
            }
        ]}>
            {children}
        </Animated.View>
    );
}

export default function WorldScreen() {
    const { colors, isDark } = useTheme();
    const { t } = useLanguage();
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [countries, setCountries] = useState(INITIAL_COUNTRIES);
    const [filter, setFilter] = useState<'all' | 'visited' | 'planned'>('all');

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (search.length > 2) {
                setLoading(true);
                const results = await getCountrySuggestions(search);
                const mappedResults = results.map((s: any, i: number) => ({
                    id: `search-${i}`,
                    name: s.value,
                    code: s.data.country || '',
                    flag: '📍'
                }));
                setCountries(mappedResults);
                setLoading(false);
            } else if (search.length === 0) {
                setCountries(INITIAL_COUNTRIES);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [search]);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>{t.tabs.world}</Text>
                <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
                    <Ionicons name="search" size={20} color={colors.secondaryText} style={styles.searchIcon} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder={(t.world as any).searchPlaceholder}
                        placeholderTextColor={colors.secondaryText}
                        value={search}
                        onChangeText={setSearch}
                    />
                    {loading && <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />}
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>{(t.world as any).popularDestinations}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.popularList}>
                        {POPULAR_DESTINATIONS.map((dest, index) => (
                            <AnimatedCard key={dest.id} index={index} style={styles.popularCard} direction="vertical">
                                <TouchableOpacity activeOpacity={0.8} style={StyleSheet.absoluteFill}>
                                    <Image source={{ uri: dest.image }} style={styles.popularImage} />
                                    <View style={styles.popularOverlay}>
                                        <Text style={styles.popularName}>{dest.name}</Text>
                                        <Text style={styles.popularCountry}>{dest.country}</Text>
                                    </View>
                                </TouchableOpacity>
                            </AnimatedCard>
                        ))}
                    </ScrollView>
                </View>

                <View style={styles.filterBar}>
                    <TouchableOpacity
                        onPress={() => setFilter('all')}
                        style={[styles.filterBtn, filter === 'all' && { backgroundColor: colors.primary }]}
                    >
                        <Text style={[styles.filterText, filter === 'all' ? { color: '#FFF' } : { color: colors.secondaryText }]}>{(t.world as any).filters.all}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setFilter('visited')}
                        style={[styles.filterBtn, filter === 'visited' && { backgroundColor: colors.primary }]}
                    >
                        <Text style={[styles.filterText, filter === 'visited' ? { color: '#FFF' } : { color: colors.secondaryText }]}>{(t.world as any).filters.visited}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setFilter('planned')}
                        style={[styles.filterBtn, filter === 'planned' && { backgroundColor: colors.primary }]}
                    >
                        <Text style={[styles.filterText, filter === 'planned' ? { color: '#FFF' } : { color: colors.secondaryText }]}>{(t.world as any).filters.planned}</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.countriesSection}>
                    {countries.map((country, index) => (
                        <AnimatedCard key={country.id} index={index} style={{ marginBottom: 10 }} direction="horizontal">
                            <TouchableOpacity
                                style={[styles.countryItem, { backgroundColor: colors.card }]}
                                activeOpacity={0.7}
                            >
                                <View style={styles.countryFlagContainer}>
                                    <Text style={styles.countryFlag}>{country.flag}</Text>
                                </View>
                                <View style={styles.countryInfo}>
                                    <Text style={[styles.countryName, { color: colors.text }]}>{country.name}</Text>
                                    <Text style={[styles.countryCode, { color: colors.secondaryText }]}>{country.code}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={colors.border} />
                            </TouchableOpacity>
                        </AnimatedCard>
                    ))}
                </View>

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
        padding: 16,
    },
    title: {
        fontSize: 34,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        height: 48,
        borderRadius: 14,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 17,
        fontWeight: '500',
    },
    section: {
        marginTop: 8,
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginLeft: 16,
        marginBottom: 12,
    },
    popularList: {
        paddingLeft: 16,
        paddingRight: 8,
    },
    popularCard: {
        width: 160,
        height: 220,
        marginRight: 14,
        borderRadius: 24,
        overflow: 'hidden',
    },
    popularImage: {
        width: '100%',
        height: '100%',
    },
    popularOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 16,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    popularName: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    popularCountry: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 13,
        marginTop: 2,
    },
    filterBar: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        marginTop: 28,
        marginBottom: 16,
        gap: 10,
    },
    filterBtn: {
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 22,
    },
    filterText: {
        fontSize: 15,
        fontWeight: '700',
    },
    countriesSection: {
        paddingHorizontal: 16,
    },
    countryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 18,
    },
    countryFlagContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    countryFlag: {
        fontSize: 22,
    },
    countryInfo: {
        flex: 1,
    },
    countryName: {
        fontSize: 17,
        fontWeight: '600',
    },
    countryCode: {
        fontSize: 13,
        marginTop: 2,
    },
});
