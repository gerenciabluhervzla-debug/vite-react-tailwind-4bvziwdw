import { initializeApp } from 'firebase/app';
// 🔥 Importamos explícitamente setPersistence y browserLocalPersistence
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

let firebaseConfig = { apiKey: "" };

try {
  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    firebaseConfig = JSON.parse(__firebase_config);
  } else {
    firebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
      appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
    };
  }
} catch (e) {
  console.warn("No se pudo cargar la configuración de Firebase");
}

// 🕵️‍♂️ DETECTOR: Nos dirá si Cloudflare borró tus credenciales al compilar
console.log("Firebase API Key detectada:", firebaseConfig.apiKey ? "✅ SÍ" : "❌ NO (¡Variables de entorno faltantes!)");

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// 🔥 TRUCO MAESTRO: Forzamos la persistencia estricta en LocalStorage desde el segundo cero,
// antes de que cualquier componente de React (como App.jsx) intente preguntar por la sesión.
setPersistence(auth, browserLocalPersistence)
  .then(() => console.log("🔒 Persistencia de sesión anclada correctamente"))
  .catch((error) => console.error("Error al anclar la persistencia:", error));

export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export const appId = typeof __app_id !== 'undefined' ? __app_id : (import.meta.env.VITE_FIREBASE_APP_ID || 'app-bluher-official');
export const URL_GOOGLE_SCRIPT = import.meta.env.VITE_GOOGLE_SCRIPT_URL || '';
export const WORKER_GEMINI_URL = import.meta.env.VITE_GEMINI_WORKER_URL || '';
