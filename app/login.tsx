import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Dimensions,
    StatusBar,
    SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../services/api';

const { height } = Dimensions.get('window');

export default function LoginScreen() {
    const { colors, isDark } = useTheme();
    const { t } = useLanguage();
    const { login, register } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleAuth = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter email and password');
            return;
        }
        if (!isLogin && password.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        try {
            if (isLogin) {
                await login(email, password);
            } else {
                await register(email, password, name || email.split('@')[0]);
            }
        } catch (error: unknown) {
            const message =
                error instanceof ApiError
                    ? error.detail
                    : error instanceof Error
                        ? error.message
                        : 'Authentication failed';
            Alert.alert('Authentication Error', message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <View style={styles.inner}>
                    <View style={styles.header}>
                        <View style={[styles.logoContainer, { backgroundColor: colors.card }]}>
                            <Ionicons name="airplane" size={50} color={colors.primary} />
                        </View>
                        <Text style={[styles.title, { color: colors.text }]}>Suitcase</Text>
                        <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
                            {isLogin ? t.login.welcome + ' ' + t.login.subtitle : t.login.welcome}
                        </Text>
                    </View>

                    <View style={styles.form}>
                        {!isLogin && (
                            <View style={[styles.inputContainer, { backgroundColor: colors.card }]}>
                                <Ionicons name="person-outline" size={20} color={colors.secondaryText} style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, { color: colors.text }]}
                                    placeholder="Name"
                                    value={name}
                                    onChangeText={setName}
                                    autoCapitalize="words"
                                    placeholderTextColor={colors.border}
                                />
                            </View>
                        )}

                        <View style={[styles.inputContainer, { backgroundColor: colors.card }]}>
                            <Ionicons name="mail-outline" size={20} color={colors.secondaryText} style={styles.inputIcon} />
                            <TextInput
                                style={[styles.input, { color: colors.text }]}
                                placeholder={t.login.email}
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                placeholderTextColor={colors.border}
                            />
                        </View>

                        <View style={[styles.inputContainer, { backgroundColor: colors.card }]}>
                            <Ionicons name="lock-closed-outline" size={20} color={colors.secondaryText} style={styles.inputIcon} />
                            <TextInput
                                style={[styles.input, { color: colors.text }]}
                                placeholder={t.login.password}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                                placeholderTextColor={colors.border}
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                <Ionicons
                                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                    size={20}
                                    color={colors.secondaryText}
                                />
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: colors.text }, loading && styles.buttonDisabled]}
                            onPress={handleAuth}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            {loading ? (
                                <ActivityIndicator color={colors.background} />
                            ) : (
                                <Text style={[styles.buttonText, { color: colors.background }]}>
                                    {isLogin ? t.login.signIn : t.login.signUp}
                                </Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.switchBtn}>
                            <Text style={[styles.switchText, { color: colors.secondaryText }]}>
                                {isLogin
                                    ? t.login.switchLogin.split('?')[0] + '? '
                                    : t.login.switchSignUp.split('?')[0] + '? '}
                                <Text style={[styles.switchTextBold, { color: colors.primary }]}>
                                    {isLogin ? t.login.signUp : t.login.signIn}
                                </Text>
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={{ height: 40 }} />
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F2F2F7' },
    inner: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 28,
        paddingTop: height * 0.05,
    },
    header: {
        marginBottom: 40,
        alignItems: 'center',
    },
    logoContainer: {
        width: 100,
        height: 100,
        borderRadius: 30,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    title: {
        fontSize: 42,
        fontWeight: '900',
        textAlign: 'center',
        color: '#1C1C1E',
        lineHeight: 44,
        letterSpacing: -1,
    },
    subtitle: {
        fontSize: 16,
        color: '#8E8E93',
        textAlign: 'center',
        marginTop: 12,
        lineHeight: 22,
        maxWidth: '80%',
    },
    form: { width: '100%' },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 60,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 2,
    },
    inputIcon: { marginRight: 12 },
    input: { flex: 1, fontSize: 16, color: '#1C1C1E' },
    button: {
        backgroundColor: '#1C1C1E',
        height: 60,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 5,
    },
    buttonDisabled: { opacity: 0.7 },
    buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    switchBtn: { marginTop: 24, alignItems: 'center' },
    switchText: { color: '#8E8E93', fontSize: 15 },
    switchTextBold: { color: '#007AFF', fontWeight: '700' },
});
