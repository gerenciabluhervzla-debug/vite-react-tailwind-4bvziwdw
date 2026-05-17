import { initializeApp } from 'firebase/app';
// 🔥 1. CAMBIO CLAVE: Importamos explícitamente los motores de memoria persistente
import { initializeAuth, browserLocalPersistence, indexedDBLocalPersistence, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const getEnvVar = (key) => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return import.meta.env[key] || '';
    }
  } catch (error) {
    return '';
  }
  return '';
};

let firebaseConfig = { apiKey: "" };
try {
  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    firebaseConfig = JSON.parse(__firebase_config);
  } else {
    firebaseConfig = {
      apiKey: getEnvVar('VITE_FIREBASE_API_KEY'),
      authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN'),
      projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID'),
      storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET'),
      messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID'),
      appId: getEnvVar('VITE_FIREBASE_APP_ID')
    };
  }
} catch (e) {
  console.warn("No se pudo cargar la configuración de Firebase");
}

export const app = initializeApp(firebaseConfig);

// 🔥 2. CAMBIO CLAVE: Obligamos a Vite y Firebase a blindar la sesión contra F5
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence]
});

export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
export const appId = typeof __app_id !== 'undefined' ? __app_id : (getEnvVar('VITE_FIREBASE_APP_ID') || 'app-bluher-official');

export const URL_GOOGLE_SCRIPT = getEnvVar('VITE_GOOGLE_SCRIPT_URL');
export const WORKER_GEMINI_URL = getEnvVar('VITE_GEMINI_WORKER_URL');
