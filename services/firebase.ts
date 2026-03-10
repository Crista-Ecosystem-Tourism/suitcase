import { initializeApp } from 'firebase/app';
import {
    initializeAuth,
    getReactNativePersistence,
    getAuth
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseConfig } from '../constants/Config';

// Initialize Firebase
const app = initializeApp(FirebaseConfig);

// Initialize Auth with Persistence
export const auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
});

// Initialize Firestore
export const db = getFirestore(app);

export default app;
