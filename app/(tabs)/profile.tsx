import React from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, ScrollView, Alert, Modal, TextInput, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useLanguage } from '../../hooks/useLanguage';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';

export default function ProfileScreen() {
    const { user, signOut } = useAuth();
    const { t, language, setLanguage } = useLanguage();
    const { colors, mode, setMode, isDark } = useTheme();
    const [isLangModalVisible, setIsLangModalVisible] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');

    const handleSignOut = async () => {
        try {
            await signOut();
            router.replace('/login');
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const toggleTheme = () => {
        const next: any = mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light';
        setMode(next);
    };

    const languages = [
        { id: 'en', label: 'English', native: 'English' },
        { id: 'ru', label: 'Russian', native: 'Русский' },
    ];

    const filteredLanguages = languages.filter(lang =>
        lang.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lang.native.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <View style={styles.profileHeader}>
                    <View style={styles.avatarContainer}>
                        <View style={[styles.avatarPlaceholder, { backgroundColor: colors.gray }]}>
                            <Text style={[styles.avatarText, { color: colors.secondaryText }]}>
                                {user?.email?.charAt(0).toUpperCase() || 'U'}
                            </Text>
                        </View>
                        <TouchableOpacity style={[styles.editBadge, { backgroundColor: colors.text, borderColor: colors.background }]}>
                            <Ionicons name="camera" size={16} color={colors.background} />
                        </TouchableOpacity>
                    </View>
                    <Text style={[styles.userName, { color: colors.text }]}>{user?.name || 'Traveler'}</Text>
                    <Text style={[styles.userEmail, { color: colors.secondaryText }]}>{user?.email}</Text>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>{t.profile.account}</Text>
                    <View style={[styles.card, { backgroundColor: colors.card }]}>
                        <TouchableOpacity style={styles.menuItem}>
                            <Ionicons name="person-outline" size={22} color={colors.primary} />
                            <Text style={[styles.menuText, { color: colors.text }]}>Edit Profile</Text>
                            <Ionicons name="chevron-forward" size={18} color={colors.border} />
                        </TouchableOpacity>
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <TouchableOpacity style={styles.menuItem}>
                            <Ionicons name="notifications-outline" size={22} color={colors.warning} />
                            <Text style={[styles.menuText, { color: colors.text }]}>Notifications</Text>
                            <Ionicons name="chevron-forward" size={18} color={colors.border} />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>{t.profile.settings}</Text>
                    <View style={[styles.card, { backgroundColor: colors.card }]}>
                        <TouchableOpacity style={styles.menuItem} onPress={() => setIsLangModalVisible(true)}>
                            <Ionicons name="globe-outline" size={22} color={colors.primary} />
                            <Text style={[styles.menuText, { color: colors.text }]}>{t.profile.language}</Text>
                            <Text style={[styles.menuValue, { color: colors.secondaryText }]}>{language === 'en' ? 'English' : 'Русский'}</Text>
                        </TouchableOpacity>
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <TouchableOpacity style={styles.menuItem} onPress={toggleTheme}>
                            <Ionicons name={mode === 'dark' ? "moon-outline" : "sunny-outline"} size={22} color={colors.warning} />
                            <Text style={[styles.menuText, { color: colors.text }]}>{t.profile.theme}</Text>
                            <Text style={[styles.menuValue, { color: colors.secondaryText }]}>
                                {mode === 'system' ? t.profile.system : mode === 'dark' ? t.profile.dark : t.profile.light}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <TouchableOpacity style={[styles.signOutBtn, { backgroundColor: colors.card }]} onPress={handleSignOut}>
                    <Text style={[styles.signOutText, { color: colors.error }]}>{t.profile.logout}</Text>
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>

            <Modal
                visible={isLangModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setIsLangModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>{t.profile.language}</Text>
                            <TouchableOpacity onPress={() => setIsLangModalVisible(false)} style={styles.closeBtn}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <View style={[styles.searchBar, { backgroundColor: colors.gray }]}>
                            <Ionicons name="search" size={20} color={colors.secondaryText} />
                            <TextInput
                                style={[styles.searchInput, { color: colors.text }]}
                                placeholder="Search language..."
                                placeholderTextColor={colors.secondaryText}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>

                        <FlatList
                            data={filteredLanguages}
                            keyExtractor={item => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[styles.langItem, { borderBottomColor: colors.border }]}
                                    onPress={() => {
                                        setLanguage(item.id as any);
                                        setIsLangModalVisible(false);
                                    }}
                                >
                                    <Text style={[styles.langText, { color: colors.text }]}>{item.native}</Text>
                                    {language === item.id && (
                                        <Ionicons name="checkmark" size={24} color={colors.primary} />
                                    )}
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F2F2F7' },
    scroll: { padding: 16 },
    profileHeader: {
        alignItems: 'center',
        paddingVertical: 30,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 16,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
    },
    avatarPlaceholder: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#E5E5EA',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: 40,
        fontWeight: 'bold',
        color: '#8E8E93',
    },
    editBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#1C1C1E',
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#F2F2F7',
    },
    userName: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1C1C1E',
        letterSpacing: -0.5
    },
    userEmail: {
        fontSize: 16,
        color: '#8E8E93',
        marginTop: 4
    },
    section: {
        marginTop: 24,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#8E8E93',
        marginBottom: 8,
        marginLeft: 16,
        letterSpacing: 0.3
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        overflow: 'hidden',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        minHeight: 56,
    },
    menuText: {
        flex: 1,
        fontSize: 17,
        color: '#1C1C1E',
        marginLeft: 12,
    },
    menuValue: {
        fontSize: 17,
        color: '#8E8E93',
        marginRight: 4,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#C7C7CC',
        marginLeft: 50,
    },
    signOutBtn: {
        marginTop: 32,
        backgroundColor: '#FFFFFF',
        padding: 18,
        borderRadius: 16,
        alignItems: 'center',
    },
    signOutText: {
        fontSize: 17,
        fontWeight: '600',
        color: '#FF3B30',
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
        padding: 24,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    closeBtn: {
        padding: 4,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        height: 48,
        borderRadius: 12,
        marginBottom: 20,
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 16,
    },
    langItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    langText: {
        fontSize: 18,
    },
});
