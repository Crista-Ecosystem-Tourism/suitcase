import {
    collection,
    addDoc,
    getDocs,
    getDoc,
    doc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy
} from 'firebase/firestore';
import { db, auth } from './firebase';

export interface Trip {
    id?: string;
    country: string;
    city: string;
    startDate: string;
    endDate: string;
    image?: string;
    mood?: string;
    route_json?: string;
    impressions?: string;
    photos?: string[];
    isArchived?: boolean;
    createdAt: any;
}

const getTripsCollection = () => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    return collection(db, 'users', user.uid, 'trips');
};

export const addTrip = async (trip: Omit<Trip, 'id' | 'createdAt'>) => {
    const coll = getTripsCollection();
    return await addDoc(coll, {
        ...trip,
        createdAt: new Date().toISOString()
    });
};

export const getAllTrips = async () => {
    const coll = getTripsCollection();
    const q = query(coll, orderBy('startDate', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    })) as Trip[];
};

export const getTripById = async (id: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    const docRef = doc(db, 'users', user.uid, 'trips', id);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
        return { id: snapshot.id, ...snapshot.data() } as Trip;
    }
    return null;
};

export const updateTrip = async (id: string, trip: Partial<Trip>) => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    const docRef = doc(db, 'users', user.uid, 'trips', id);
    await updateDoc(docRef, trip);
};

export const deleteTrip = async (id: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    const docRef = doc(db, 'users', user.uid, 'trips', id);
    await deleteDoc(docRef);
};
