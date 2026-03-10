import {
    collection,
    getDocs,
    getDoc,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where
} from 'firebase/firestore';
import { db, auth } from './firebase';

export interface Expense {
    id: string;
    trip_id: string;
    amount: number;
    category: string;
    title: string;
    date: string;
    currency?: string;
}

const getExpensesCollection = () => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    return collection(db, 'users', user.uid, 'expenses');
};

export const getAllExpenses = async () => {
    const coll = getExpensesCollection();
    const snapshot = await getDocs(coll);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    })) as Expense[];
};

export const getExpensesByTrip = async (tripId: string) => {
    const coll = getExpensesCollection();
    const q = query(coll, where('trip_id', '==', tripId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    })) as Expense[];
};

export const getExpenseById = async (id: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    const docRef = doc(db, 'users', user.uid, 'expenses', id);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
        return { id: snapshot.id, ...snapshot.data() } as Expense;
    }
    return null;
};

export const addExpense = async (expense: Omit<Expense, 'id'>) => {
    const coll = getExpensesCollection();
    return await addDoc(coll, {
        ...expense,
        createdAt: new Date().toISOString()
    });
};

export const updateExpense = async (id: string, expense: Partial<Expense>) => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    const docRef = doc(db, 'users', user.uid, 'expenses', id);
    await updateDoc(docRef, expense);
};

export const deleteExpense = async (id: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    const docRef = doc(db, 'users', user.uid, 'expenses', id);
    await deleteDoc(docRef);
};
