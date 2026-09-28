import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { apiPut, getStoredUser } from './api';

const TOKEN_KEY_PREFIX = 'crista_push_token_';
const ENABLED_KEY_PREFIX = 'crista_push_enabled_';

type NativePlatform = 'ios' | 'android';

if (Platform.OS !== 'web') {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
        }),
    });
}

interface PushDeviceRegistration {
    expo_push_token: string;
    platform: NativePlatform;
    enabled: boolean;
}

function platform(): NativePlatform | null {
    return Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : null;
}

async function storageKeys(): Promise<{ token: string; enabled: string } | null> {
    const user = await getStoredUser();
    if (!user) return null;
    return {
        token: `${TOKEN_KEY_PREFIX}${user.id}`,
        enabled: `${ENABLED_KEY_PREFIX}${user.id}`,
    };
}

export async function isPushEnabled(): Promise<boolean> {
    const keys = await storageKeys();
    if (!keys) return false;
    return (await AsyncStorage.getItem(keys.enabled)) === 'true';
}

export async function enablePushNotifications(): Promise<boolean> {
    const nativePlatform = platform();
    if (!nativePlatform || !Device.isDevice) {
        throw new Error('Push-уведомления доступны только на физическом iOS или Android устройстве.');
    }

    if (nativePlatform === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'Поездки',
            importance: Notifications.AndroidImportance.DEFAULT,
        });
    }

    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) {
        throw new Error('Разрешите уведомления в настройках устройства.');
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) throw new Error('Не настроен Expo project ID для push-уведомлений.');

    const keys = await storageKeys();
    if (!keys) throw new Error('Войдите в аккаунт, чтобы включить уведомления.');
    const expoPushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const registration = await apiPut<PushDeviceRegistration>('/suitcase/push-devices', {
        expo_push_token: expoPushToken,
        platform: nativePlatform,
        enabled: true,
    });
    await AsyncStorage.multiSet([[keys.token, registration.expo_push_token], [keys.enabled, 'true']]);
    return registration.enabled;
}

export async function disablePushNotifications(): Promise<boolean> {
    const keys = await storageKeys();
    const nativePlatform = platform();
    if (!keys || !nativePlatform) return false;
    const expoPushToken = await AsyncStorage.getItem(keys.token);
    if (expoPushToken) {
        await apiPut<PushDeviceRegistration>('/suitcase/push-devices', {
            expo_push_token: expoPushToken,
            platform: nativePlatform,
            enabled: false,
        });
    }
    await AsyncStorage.setItem(keys.enabled, 'false');
    return false;
}
