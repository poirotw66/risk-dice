import { initializeApp, FirebaseApp } from 'firebase/app';
import { getDatabase, ref, onValue, runTransaction, Database, get } from 'firebase/database';

// Firebase 配置 - 從環境變數載入
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// 初始化 Firebase
let app: FirebaseApp | null = null;
let database: Database | null = null;

// 檢查 Firebase 是否已配置
const isFirebaseConfigured = (): boolean => {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.databaseURL &&
    firebaseConfig.projectId
  );
};

// 初始化函數
const initializeFirebase = () => {
  if (!app && isFirebaseConfigured()) {
    try {
      app = initializeApp(firebaseConfig);
      database = getDatabase(app);
      if (import.meta.env.DEV) console.log('Firebase initialized successfully');
    } catch (error) {
      console.error('Error initializing Firebase:', error);
    }
  }
};

// 確保 Firebase 已初始化
const ensureInitialized = () => {
  if (!database) {
    initializeFirebase();
  }
  return database;
};

// 監聽全域 streak 值的變化
export const listenToGlobalStreak = (callback: (streak: number) => void): (() => void) | null => {
  const db = ensureInitialized();
  if (!db) {
    console.warn('Firebase not configured. Using local state.');
    return null;
  }

  try {
    const streakRef = ref(db, 'globalStreak');
    
    // 監聽值變化
    const unsubscribe = onValue(streakRef, (snapshot) => {
      const value = snapshot.val();
      callback(value ?? 0);
    }, (error) => {
      console.error('Error listening to global streak:', error);
    });

    return unsubscribe;
  } catch (error) {
    console.error('Error setting up listener:', error);
    return null;
  }
};

// 獲取當前全域 streak 值
export const getGlobalStreak = async (): Promise<number> => {
  const db = ensureInitialized();
  if (!db) {
    console.warn('Firebase not configured. Returning 0.');
    return 0;
  }

  try {
    const streakRef = ref(db, 'globalStreak');
    const snapshot = await get(streakRef);
    return snapshot.val() ?? 0;
  } catch (error) {
    console.error('Error getting global streak:', error);
    return 0;
  }
};

// 獲取當前全域 maxStreak 值
export const getGlobalMaxStreak = async (): Promise<number> => {
  const db = ensureInitialized();
  if (!db) {
    console.warn('Firebase not configured. Returning 0.');
    return 0;
  }

  try {
    const maxStreakRef = ref(db, 'globalMaxStreak');
    const snapshot = await get(maxStreakRef);
    return snapshot.val() ?? 0;
  } catch (error) {
    console.error('Error getting global max streak:', error);
    return 0;
  }
};

// 增加全域 streak（使用原子操作避免競態條件）
export const incrementGlobalStreak = async (): Promise<number | null> => {
  const db = ensureInitialized();
  if (!db) {
    console.warn('Firebase not configured. Cannot increment.');
    return null;
  }

  try {
    const streakRef = ref(db, 'globalStreak');
    const maxStreakRef = ref(db, 'globalMaxStreak');
    
    let newValue: number | null = null;
    await runTransaction(streakRef, (currentValue) => {
      newValue = (currentValue || 0) + 1;
      return newValue;
    });

    // 同時更新 maxStreak 如果當前值更大
    if (newValue !== null) {
      await runTransaction(maxStreakRef, (currentMax) => {
        const maxVal = currentMax || 0;
        return Math.max(maxVal, newValue!);
      });
    }

    return newValue;
  } catch (error) {
    console.error('Error incrementing global streak:', error);
    return null;
  }
};

// 重置全域 streak
export const resetGlobalStreak = async (): Promise<boolean> => {
  const db = ensureInitialized();
  if (!db) {
    console.warn('Firebase not configured. Cannot reset.');
    return false;
  }

  try {
    const streakRef = ref(db, 'globalStreak');
    await runTransaction(streakRef, () => 0);
    return true;
  } catch (error) {
    console.error('Error resetting global streak:', error);
    return false;
  }
};

// 監聽全域 maxStreak 值的變化
export const listenToGlobalMaxStreak = (callback: (maxStreak: number) => void): (() => void) | null => {
  const db = ensureInitialized();
  if (!db) {
    console.warn('Firebase not configured. Using local state.');
    return null;
  }

  try {
    const maxStreakRef = ref(db, 'globalMaxStreak');
    
    // 監聽值變化
    const unsubscribe = onValue(maxStreakRef, (snapshot) => {
      const value = snapshot.val();
      callback(value ?? 0);
    }, (error) => {
      console.error('Error listening to global max streak:', error);
    });

    return unsubscribe;
  } catch (error) {
    console.error('Error setting up max streak listener:', error);
    return null;
  }
};

// 檢查 Firebase 是否可用
export const isFirebaseAvailable = (): boolean => {
  return isFirebaseConfigured() && database !== null;
};

// 導出以便測試或手動初始化
export { initializeFirebase };
