import { Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../hooks/useLanguage';
import { useTheme } from '../../hooks/useTheme';
import { View, TouchableOpacity } from 'react-native';

export default function TabLayout() {
    const { t } = useLanguage();
    const { colors } = useTheme();

    return (
        <Tabs screenOptions={{
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.secondaryText,
            tabBarStyle: {
                backgroundColor: colors.card,
                borderTopColor: colors.border,
                height: 60,
                paddingBottom: 8,
            },
            tabBarLabelStyle: {
                fontSize: 10,
                fontWeight: '500',
            },
            headerStyle: {
                backgroundColor: colors.card,
                elevation: 0,
                shadowOpacity: 0,
            },
            headerTitleStyle: {
                fontWeight: '700',
            },
            headerTintColor: colors.text,
            headerShown: true,
        }}>
            <Tabs.Screen
                name="map"
                options={{
                    title: t.tabs.map,
                    tabBarIcon: ({ color }) => <Ionicons name="map-outline" size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="index"
                options={{
                    title: t.tabs.trips,
                    tabBarIcon: ({ color }) => <Ionicons name="briefcase-outline" size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="add"
                listeners={{
                    tabPress: (e) => {
                        e.preventDefault();
                        router.push('/trip/create');
                    },
                }}
                options={{
                    title: '',
                    tabBarIcon: () => (
                        <View style={{
                            width: 56,
                            height: 56,
                            borderRadius: 28,
                            backgroundColor: colors.success,
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginBottom: 20,
                            shadowColor: colors.success,
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 8,
                            elevation: 5,
                        }}>
                            <Ionicons name="add" size={32} color={colors.white} />
                        </View>
                    ),
                }}
            />
            <Tabs.Screen
                name="world"
                options={{
                    title: t.tabs.world,
                    tabBarIcon: ({ color }) => <Ionicons name="earth-outline" size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: t.tabs.profile,
                    tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={24} color={color} />,
                }}
            />
            <Tabs.Screen name="archive" options={{ href: null }} />
            <Tabs.Screen name="goals" options={{ href: null }} />
        </Tabs>
    );
}
