import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { acceptTripInvite } from '../services/tripGroup';
import { useTheme } from '../hooks/useTheme';

export default function InviteScreen() {
    const { colors } = useTheme();
    const [code, setCode] = useState('');
    const [saving, setSaving] = useState(false);
    const accept = async () => {
        setSaving(true);
        try {
            const result = await acceptTripInvite(code);
            Alert.alert('Поездка добавлена', result.created ? 'Вы присоединились к группе.' : 'Вы уже участник этой поездки.');
            router.replace(`/trip/${result.trip_id}`);
        } catch (error) {
            Alert.alert('Не удалось принять приглашение', error instanceof Error ? error.message : 'Повторите попытку.');
        } finally { setSaving(false); }
    };
    return <View style={[styles.page, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>Присоединиться к поездке</Text>
        <Text style={[styles.note, { color: colors.secondaryText }]}>Введите код, который прислал владелец поездки.</Text>
        <TextInput value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} style={[styles.input, { borderColor: colors.border, color: colors.text }]} placeholder="Код приглашения" placeholderTextColor={colors.secondaryText} />
        <TouchableOpacity disabled={saving || code.length < 32} onPress={() => void accept()} style={[styles.button, { backgroundColor: colors.primary, opacity: saving || code.length < 32 ? .5 : 1 }]}><Text style={styles.buttonText}>{saving ? 'Добавляем…' : 'Присоединиться'}</Text></TouchableOpacity>
    </View>;
}
const styles = StyleSheet.create({ page:{flex:1,padding:24},title:{fontSize:26,fontWeight:'800',marginTop:28},note:{fontSize:16,lineHeight:22,marginTop:12},input:{borderWidth:1,borderRadius:14,padding:16,fontSize:16,marginTop:28},button:{borderRadius:14,padding:16,alignItems:'center',marginTop:16},buttonText:{color:'#fff',fontSize:16,fontWeight:'700'} });
