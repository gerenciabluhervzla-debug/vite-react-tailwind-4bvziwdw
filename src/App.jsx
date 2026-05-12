import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  signInAnonymously, 
  signInWithCustomToken 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  updateDoc, 
  doc, 
  getDoc, 
  setDoc, 
  getDocs, 
  deleteDoc,
  query
} from 'firebase/firestore';
import { 
  ShoppingCart, CheckSquare, Truck, Printer, Clock, CheckCircle, XCircle, Search, 
  Sparkles, Package, Plus, Minus, X, Image as ImageIcon, Camera, ClipboardList, 
  AlertTriangle, UploadCloud, Loader2, DollarSign, Archive, Edit3, Save, LogOut, 
  ShieldCheck, Users, FileText, MessageSquare, Eye, FileSpreadsheet, Download, 
  ChevronDown, ChevronUp, MessageCircle, ArrowRightLeft, PlusCircle, Trash2, Moon, Sun, Store, Link, Gift, CheckSquare2
} from 'lucide-react';

// --- CONFIGURACIÓN DE MARCA BLUEHER ---
const BRAND_LOGO = "logobluher.jpg"; // Truco CSS aplicado abajo para eliminar el fondo blanco

// --- CONFIGURACIÓN DE FIREBASE ---
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

const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : {
      apiKey: getEnvVar('VITE_FIREBASE_API_KEY'),
      authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN'),
      projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID'),
      storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET'),
      messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID'),
      appId: getEnvVar('VITE_FIREBASE_APP_ID')
    };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
const appId = typeof __app_id !== 'undefined' ? __app_id : (getEnvVar('VITE_FIREBASE_APP_ID') || 'app-logiweb-prod');

const URL_GOOGLE_SCRIPT = getEnvVar('VITE_GOOGLE_SCRIPT_URL');
const GEMINI_API_KEY = getEnvVar('VITE_GEMINI_API_KEY');

const ROLES = {
  ADMIN: 'Administrador',
  VENTAS: 'Ventas',
  ADMINISTRACION: 'Administración', 
  DESPACHO: 'Despacho',
  AUDITOR_VENTAS: 'Auditor Ventas y Admin',
  AUDITOR_INVENTARIO: 'Auditor Inventario',
  AUDITOR_GENERAL: 'Auditor General'
};

const DEFAULT_CATALOGO = [
  { categoria: "Cirugías Capilares", productos: [ 
      { nombre: "Cirugía Clásica", presentaciones: ["Litro", "1/2 Litro", "Galón"], precios: [25, 15, 80], imagen: "" }, 
      { nombre: "Cirugía Chocolate", presentaciones: ["Litro", "1/2 Litro", "Galón"], precios: [25, 15, 80], imagen: "" } 
    ] 
  },
  { categoria: "Alisados", productos: [ 
      { nombre: "Alisado Clásico", presentaciones: ["1 Litro", "300ml"], precios: [30, 12], imagen: "" }, 
      { nombre: "Alisado Chocolate", presentaciones: ["1 Litro", "300ml"], precios: [30, 12], imagen: "" } 
    ] 
  },
  { categoria: "Shampoos y Cuidado", productos: [ 
      { nombre: "Shampoo Tradicional", presentaciones: ["Litro", "1/2 Litro"], precios: [10, 6], imagen: "" }, 
      { nombre: "Anti-Residuos", presentaciones: ["1 Litro", "1/2 Litro"], precios: [12, 7], imagen: "" } 
    ] 
  },
  { categoria: "Boosters y Terapias", productos: [ 
      { nombre: "Booster de Hidratacion", presentaciones: ["Unidad"], precios: [5], imagen: "" },
      { nombre: "Booster de Reparacion", presentaciones: ["Unidad"], precios: [5], imagen: "" },
      { nombre: "Booster de Nutricion", presentaciones: ["Unidad"], precios: [5], imagen: "" },
      { nombre: "Booster Profesional", presentaciones: ["Unidad"], precios: [8], imagen: "" },
      { nombre: "Terapia Antifrizz", presentaciones: ["500gr"], precios: [20], imagen: "" } 
    ] 
  },
  { categoria: "Complementos Automáticos", productos: [
      { nombre: "Concentrado", presentaciones: ["Unidad"], precios: [0], imagen: "" }
    ]
  }
];

// ==========================================
// SISTEMA DE MODALES GLOBALES
// ==========================================
function GlobalDialog({ config, setConfig }) {
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if(config?.type === 'prompt') setInputValue('');
  }, [config]);

  if (!config) return null;

  const handleConfirm = () => {
    if (config.onConfirm) {
      if (config.type === 'prompt') config.onConfirm(inputValue);
      else config.onConfirm();
    }
    setConfig(null);
  };

  const handleCancel = () => setConfig(null);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
       <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700">
         <div className="flex items-center gap-4 mb-4">
           {config.type === 'alert' && <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-500 rounded-full"><AlertTriangle size={28}/></div>}
           {config.type === 'confirm' && <div className="p-3 bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-500 rounded-full"><AlertTriangle size={28}/></div>}
           {config.type === 'prompt' && <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-500 rounded-full"><MessageSquare size={28}/></div>}
           <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">{config.title}</h3>
         </div>
         <p className="text-slate-600 dark:text-slate-300 mb-8 whitespace-pre-wrap font-medium leading-relaxed">{config.message}</p>
         {config.type === 'prompt' && (
           <input 
             autoFocus 
             type="text" 
             className="w-full p-4 border-2 border-slate-200 dark:border-slate-600 rounded-xl mb-8 outline-none focus:ring-2 focus:ring-sky-500 font-medium text-slate-800 dark:text-slate-100 transition-all bg-[#f0f4f8] dark:bg-slate-700" 
             value={inputValue} 
             onChange={e=>setInputValue(e.target.value)} 
             onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
           />
         )}
         <div className="flex justify-end gap-3">
           {config.type !== 'alert' && <button onClick={handleCancel} className="px-6 py-3 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold transition-colors">Cancelar</button>}
           <button onClick={handleConfirm} className="px-6 py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5">{config.type === 'alert' ? 'Entendido' : 'Confirmar'}</button>
         </div>
       </div>
    </div>
  );
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================
export default function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [pedidos, setPedidos] = useState([]);
  const [catalogo, setCatalogo] = useState(DEFAULT_CATALOGO);
  const [stockInventario, setStockInventario] = useState({});
  const [notasInventario, setNotasInventario] = useState({});
  const [movimientos, setMovimientos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [logs, setLogs] = useState([]);

  const [activeTab, setActiveTab] = useState('ventas');
  
  // States para diseño y portal público
  const [darkMode, setDarkMode] = useState(false);
  const [isPublicRoute, setIsPublicRoute] = useState(window.location.hash === '#tienda');

  // --- CONTROLADOR DE DIÁLOGOS ---
  const [dialogConfig, setDialogConfig] = useState(null);
  const dialogs = useMemo(() => ({
    alert: (msg, title) => setDialogConfig({ type: 'alert', message: msg, title: title || "Aviso del Sistema" }),
    confirm: (msg, onConfirm, title) => setDialogConfig({ type: 'confirm', message: msg, title: title || "Confirmación Requerida", onConfirm }),
    prompt: (msg, onConfirm, title) => setDialogConfig({ type: 'prompt', message: msg, title: title || "Ingresar Información", onConfirm })
  }), []);

  // --- MANEJO DE RUTAS (PORTAL PÚBLICO) ---
  useEffect(() => {
    const handleHashChange = () => setIsPublicRoute(window.location.hash === '#tienda');
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // --- MANEJO DE MODO OSCURO GLOBAL ---
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // --- 1. MANEJO DE AUTENTICACIÓN ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        }
      } catch (error) { console.error("Auth error", error); }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser && !currentUser.isAnonymous) {
        setUser(currentUser);
      } else if (currentUser && currentUser.isAnonymous && typeof __initial_auth_token !== 'undefined') {
        // Ignorar anónimo temporal
      } else {
        setUser(null); setUserProfile(null); setAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // --- 2. PERFIL DE USUARIO ---
  useEffect(() => {
    if (!user) return;
    let isFirstLoad = true;
    
    const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid);
    const unsub = onSnapshot(userRef, async (snap) => {
      if (snap.exists()) {
        const profile = snap.data();
        setUserProfile(profile);

        if (isFirstLoad) {
           isFirstLoad = false;
           if (!profile.isOnline) {
              updateDoc(userRef, { isOnline: true });
              addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'logs'), {
                 accion: 'INICIO_SESION', detalle: 'El usuario inició sesión en el sistema.', usuarioEmail: profile.email, usuarioNombre: profile.nombre, usuarioRol: profile.role, fecha: Date.now()
              }).catch(console.error);
           }
        }

        if (profile.isApproved && activeTab === 'ventas') {
          if (profile.role === ROLES.ADMINISTRACION) setActiveTab('admin');
          if (profile.role === ROLES.DESPACHO) setActiveTab('despacho');
          if (profile.role === ROLES.AUDITOR_INVENTARIO) setActiveTab('inventario');
        }
      } else {
        const newProfile = { uid: user.uid, email: user.email, nombre: user.displayName || 'Usuario', foto: user.photoURL || '', role: 'Pendiente', isApproved: false, isOnline: true, fechaRegistro: Date.now() };
        await setDoc(userRef, newProfile);
        setUserProfile(newProfile);
        registrarLogSistem(newProfile, 'NUEVO_REGISTRO', `El usuario ${user.email} se ha registrado y espera aprobación.`);
      }
      setAuthLoading(false);
    }, (err) => { 
      console.error("Error cargando perfil:", err); 
      setAuthLoading(false); 
    });
    return () => unsub();
  }, [user, activeTab]);

  useEffect(() => {
    const handleUnload = () => {
      if (user) updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), { isOnline: false });
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [user]);

  const registrarLogSistem = async (perfilActivo, accion, detalle) => {
    if (!perfilActivo) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'logs'), {
        accion, detalle, usuarioEmail: perfilActivo.email, usuarioNombre: perfilActivo.nombre, usuarioRol: perfilActivo.role, fecha: Date.now()
      });
    } catch (e) { console.error(e); }
  };
  const loggear = (accion, detalle) => registrarLogSistem(userProfile, accion, detalle);

  // --- 3. CARGA DE DATOS ---
  useEffect(() => {
    const unsubs = [];
    
    // Cargar Catálogo (Visible para todos, incluso anónimos en portal web)
    unsubs.push(onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'catalogo'), (docSnap) => {
      setCatalogo(docSnap.exists() && docSnap.data().categorias ? docSnap.data().categorias : DEFAULT_CATALOGO);
    }));

    // Cargar Stock publicamente necesario para validaciones en ventas y portal
    unsubs.push(onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'stock'), (docSnap) => {
      setStockInventario(docSnap.exists() ? docSnap.data() : {});
    }));

    if (!user || !userProfile || !userProfile.isApproved) return;
    
    unsubs.push(onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'pedidos'), (snapshot) => {
      setPedidos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.fechaCreacion - a.fechaCreacion));
    }));

    unsubs.push(onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'notas'), (docSnap) => setNotasInventario(docSnap.exists() ? docSnap.data() : {})));

    unsubs.push(onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'movimientos'), (snapshot) => {
      setMovimientos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.fechaCreacion - a.fechaCreacion));
    }));

    const esAdminOAuditor = [ROLES.ADMIN, ROLES.AUDITOR_GENERAL].includes(userProfile?.role);
    if (esAdminOAuditor) {
      unsubs.push(onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'users'), (snapshot) => setUsuarios(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))));
      unsubs.push(onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'logs'), (snapshot) => setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.fecha - a.fecha))));
    }

    return () => unsubs.forEach(unsub => unsub());
  }, [user, userProfile]);

  const signInGoogle = async () => {
    try { setAuthLoading(true); await signInWithPopup(auth, googleProvider); } 
    catch (error) { console.error(error); dialogs.alert("Error de conexión al iniciar sesión con Google."); setAuthLoading(false); }
  };
  
  const cerrarSesion = async () => {
    if (userProfile && user) {
       try {
         await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), { isOnline: false });
         await registrarLogSistem(userProfile, 'CIERRE_SESION', `El usuario cerró sesión manualmente.`);
       } catch(e) {}
    }
    signOut(auth);
  };

  const cambiarEstadoPedido = async (id, nuevoEstado) => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', id), { status: nuevoEstado });
      loggear('ESTADO_PEDIDO_ACTUALIZADO', `Se cambió el estado del pedido a ${nuevoEstado}.`);
    } catch (error) {
      console.error(error);
      dialogs.alert("Error de red al intentar cambiar el estado del pedido.", "Fallo de conexión");
    }
  };

  // --- RENDERIZADO DEL CONTENIDO PRINCIPAL ---
  let content;

  if (isPublicRoute) {
    // VISTA PORTAL PÚBLICO
    content = <PublicPortal catalogo={catalogo} stock={stockInventario} db={db} appId={appId} dialogs={dialogs} onBack={() => window.location.hash = ''} darkMode={darkMode} setDarkMode={setDarkMode} />;
  } else if (authLoading || (user && !userProfile)) {
    // VISTA CARGANDO
    content = (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center bg-[#f0f4f8] dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors">
        <img src={BRAND_LOGO} alt="Logo Bluher" className="h-20 mb-8 mix-blend-multiply dark:invert animate-pulse" />
        <Loader2 className="animate-spin text-sky-600 dark:text-sky-400 mb-4" size={48} />
        <div className="font-bold text-xl tracking-tight">Verificando seguridad...</div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Autenticando credenciales de acceso a Bluher.</p>
        {user && <button onClick={cerrarSesion} className="text-sky-600 dark:text-sky-400 text-sm hover:underline font-semibold mt-4">Cancelar y regresar</button>}
      </div>
    );
  } else if (!user) {
    // VISTA LOGIN
    content = (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-[#f0f4f8] to-[#d8e4f0] dark:from-slate-900 dark:to-slate-800 transition-colors text-slate-800 dark:text-slate-100">
        <div className="absolute top-4 right-4"><button onClick={() => setDarkMode(!darkMode)} className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-md text-sky-600 dark:text-sky-400 hover:text-sky-800 transition-colors">{darkMode ? <Sun size={20}/> : <Moon size={20}/>}</button></div>
        
        <div className="bg-white dark:bg-slate-800 p-10 rounded-[2rem] shadow-2xl max-w-sm w-full text-center border-t-[6px] border-sky-600 relative overflow-hidden transition-colors">
          <div className="absolute top-0 left-0 w-full h-32 bg-sky-50/50 dark:bg-slate-700/30 -z-10 rounded-t-[2rem]"></div>
          
          <img src={BRAND_LOGO} alt="Logo Bluher" className="h-24 mx-auto object-contain mb-8 z-10 drop-shadow-sm mix-blend-multiply dark:invert" />

          <h1 className="text-3xl font-black tracking-tight mb-2">Ingreso</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm">Sistema de Gestión Logística Bluher.</p>
          
          <button onClick={signInGoogle} className="w-full bg-[#003366] dark:bg-sky-600 hover:bg-[#002244] dark:hover:bg-sky-500 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-3 transition-all duration-300 shadow-lg hover:-translate-y-0.5 mb-4">
            <svg className="w-5 h-5 bg-white rounded-full p-0.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Acceso Empleados
          </button>

          <button onClick={() => window.location.hash = '#tienda'} className="w-full bg-[#f0f4f8] dark:bg-slate-700 hover:bg-[#e2ebf3] dark:hover:bg-slate-600 text-sky-900 dark:text-slate-200 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-3 transition-all duration-300 border border-sky-100 dark:border-slate-600">
            <Store size={18}/> Comprar Online (Clientes)
          </button>
        </div>
      </div>
    );
  } else if (userProfile && !userProfile.isApproved) {
    // VISTA CUENTA EN ESPERA DE APROBACIÓN
    content = (
      <div className="min-h-screen flex items-center justify-center p-4 text-center bg-[#f0f4f8] dark:bg-slate-900 transition-colors text-slate-800 dark:text-slate-100">
        <div className="bg-white dark:bg-slate-800 p-10 rounded-3xl shadow-xl max-w-md w-full border-t-[6px] border-amber-500 transition-colors">
          <ShieldCheck size={56} className="mx-auto text-amber-500 mb-4" />
          <h2 className="text-2xl font-bold">Cuenta en Revisión</h2>
          <p className="text-slate-600 dark:text-slate-400 mt-2 mb-8 leading-relaxed">Tu correo <b>{user.email}</b> espera aprobación del Administrador de Bluher.</p>
          <button onClick={cerrarSesion} className="text-sky-700 dark:text-sky-400 font-semibold hover:underline transition-colors">Cerrar sesión</button>
        </div>
      </div>
    );
  } else {
    // VISTA PRINCIPAL DEL SISTEMA (DASHBOARD)
    const r = userProfile?.role;
    const showVentas = [ROLES.ADMIN, ROLES.VENTAS, ROLES.AUDITOR_VENTAS, ROLES.AUDITOR_GENERAL].includes(r);
    const showAdmin = [ROLES.ADMIN, ROLES.ADMINISTRACION, ROLES.AUDITOR_VENTAS, ROLES.AUDITOR_GENERAL].includes(r);
    const showDespacho = [ROLES.ADMIN, ROLES.DESPACHO, ROLES.AUDITOR_GENERAL].includes(r);
    const showReportes = [ROLES.ADMIN, ROLES.AUDITOR_VENTAS, ROLES.AUDITOR_GENERAL, ROLES.ADMINISTRACION].includes(r);
    const showInventario = [ROLES.ADMIN, ROLES.AUDITOR_INVENTARIO, ROLES.AUDITOR_GENERAL, ROLES.ADMINISTRACION].includes(r); 
    const showUsuarios = [ROLES.ADMIN].includes(r);
    const showLogs = [ROLES.ADMIN, ROLES.AUDITOR_GENERAL].includes(r);

    content = (
      <div className="flex flex-col md:flex-row min-h-screen bg-[#f0f4f8] dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors selection:bg-sky-200 dark:selection:bg-sky-900">
        {/* SIDEBAR */}
        <aside className="w-full md:w-[280px] bg-[#003366] dark:bg-slate-950 text-slate-200 flex-shrink-0 print:hidden shadow-2xl z-10 flex flex-col h-auto md:h-screen sticky top-0 overflow-y-auto border-r border-sky-800 dark:border-slate-800">
          <div className="p-8 pb-4 flex flex-col items-center border-b border-sky-800/50 dark:border-slate-800/50 relative">
            <button onClick={() => setDarkMode(!darkMode)} className="absolute top-4 right-4 p-1.5 bg-sky-800/50 dark:bg-slate-800 rounded-full text-sky-200 dark:text-slate-400 hover:text-white transition-colors">
              {darkMode ? <Sun size={14}/> : <Moon size={14}/>}
            </button>
            <div className="w-full flex justify-center mb-6">
               <img src={BRAND_LOGO} alt="Logo Bluher" className="h-12 w-auto object-contain drop-shadow-md mix-blend-screen dark:mix-blend-normal invert dark:invert-0 brightness-200 dark:brightness-100" />
            </div>
            
            <div className="w-full bg-sky-900/40 dark:bg-slate-800/50 rounded-xl p-4 border border-sky-700/50 dark:border-slate-700/50 text-center">
               <div className="text-xs font-medium text-sky-300 dark:text-slate-400 mb-1">Usuario Activo</div>
               <div className="text-sm font-bold text-white truncate px-2" title={user.email}>{user.displayName}</div>
               <div className="mt-2 inline-flex items-center justify-center px-3 py-1 rounded-full bg-sky-800/80 dark:bg-sky-900/50 text-sky-100 dark:text-sky-300 text-[10px] font-bold uppercase tracking-widest border border-sky-700/50 dark:border-sky-800/50">
                 {userProfile?.role}
               </div>
            </div>
          </div>
          
          <nav className="mt-6 flex flex-row md:flex-col gap-1.5 px-4 overflow-x-auto flex-1 pb-4">
            <div className="text-[10px] font-bold text-sky-300 dark:text-slate-500 uppercase tracking-widest mb-2 px-2 hidden md:block">Área Operativa</div>
            {showVentas && <TabButton active={activeTab === 'ventas'} onClick={() => setActiveTab('ventas')} icon={<ShoppingCart size={18} />} label="Ventas y Web" badge={pedidos.filter(p=>p.status==='Rechazado' || p.esPublico).length} badgeColor="bg-red-500 dark:bg-sky-500" />}
            {showAdmin && <TabButton active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} icon={<CheckSquare size={18} />} label={`Admin y Pagos`} badge={pedidos.filter(p=>p.status==='Pendiente').length} />}
            {showDespacho && <TabButton active={activeTab === 'despacho'} onClick={() => setActiveTab('despacho')} icon={<Truck size={18} />} label={`Despacho`} badge={pedidos.filter(p=>p.status==='Validado').length} />}
            
            {(showReportes || showInventario || showUsuarios || showLogs) && <div className="hidden md:block my-4 border-t border-sky-800/50 dark:border-slate-800 mx-2"></div>}
            {(showReportes || showInventario || showUsuarios || showLogs) && <div className="text-[10px] font-bold text-sky-300 dark:text-slate-500 uppercase tracking-widest mb-2 px-2 hidden md:block">Gestión y Reportes</div>}

            {showReportes && <TabButton active={activeTab === 'reportes'} onClick={() => setActiveTab('reportes')} icon={<FileSpreadsheet size={18} />} label="Reportes" />}
            {showInventario && <TabButton active={activeTab === 'inventario'} onClick={() => setActiveTab('inventario')} icon={<Archive size={18} />} label="Inventario" badge={movimientos.filter(m=>m.status==='PENDIENTE').length} />}
            {showUsuarios && <TabButton active={activeTab === 'usuarios'} onClick={() => setActiveTab('usuarios')} icon={<Users size={18} />} label="Usuarios" badge={usuarios.filter(u=>!u.isApproved).length} />}
            {showLogs && <TabButton active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={<FileText size={18} />} label="Auditoría" />}
          </nav>

          <div className="p-6 border-t border-sky-800/50 dark:border-slate-800/50">
            <button onClick={cerrarSesion} className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl text-sky-200 dark:text-slate-400 hover:text-white hover:bg-sky-800 dark:hover:bg-slate-800 transition-colors font-medium text-sm">
              <LogOut size={16} /> Cerrar Sesión
            </button>
          </div>
        </aside>

        {/* CONTENIDO PRINCIPAL */}
        <main className="flex-1 p-4 md:p-10 overflow-y-auto print:p-0 print:m-0 print:bg-white print:block relative">
          <div className="max-w-6xl mx-auto print:max-w-none print:mx-0">
            <div className="print:hidden">
              {activeTab === 'ventas' && showVentas && <PanelVentas perfil={userProfile} pedidos={pedidos} catalogo={catalogo} stock={stockInventario} db={db} appId={appId} loggear={loggear} dialogs={dialogs} cambiarEstadoPedido={cambiarEstadoPedido} />}
              {activeTab === 'admin' && showAdmin && <PanelAdmin perfil={userProfile} pedidos={pedidos} stock={stockInventario} loggear={loggear} db={db} appId={appId} dialogs={dialogs} />}
              {activeTab === 'despacho' && showDespacho && <PanelDespacho pedidos={pedidos} catalogo={catalogo} stock={stockInventario} cambiarEstado={cambiarEstadoPedido} db={db} appId={appId} loggear={loggear} dialogs={dialogs} />}
              {activeTab === 'reportes' && showReportes && <PanelReportes pedidos={pedidos} catalogo={catalogo} stock={stockInventario} />}
              {activeTab === 'inventario' && showInventario && <PanelInventario stock={stockInventario} notas={notasInventario} catalogo={catalogo} movimientos={movimientos} db={db} appId={appId} loggear={loggear} perfil={userProfile} dialogs={dialogs} />}
              {activeTab === 'usuarios' && showUsuarios && <PanelUsuarios usuarios={usuarios} db={db} appId={appId} loggear={loggear} dialogs={dialogs} />}
              {activeTab === 'logs' && showLogs && <PanelLogs logs={logs} />}
            </div>
            <VistaImpresion pedidos={pedidos.filter(p => p.status === 'Validado')} />
          </div>
        </main>
      </div>
    );
  }

  // Devolvemos el contenedor Root para toda la aplicación
  return (
    <div className={darkMode ? 'dark' : ''}>
      {content}
      <GlobalDialog config={dialogConfig} setConfig={setDialogConfig} />
    </div>
  );
}

// ==========================================
// 1. PANEL DE VENTAS 
// ==========================================
function PanelVentas({ perfil, pedidos, catalogo, stock, db, appId, loggear, dialogs, cambiarEstadoPedido }) {
  const puedeCrear = [ROLES.ADMIN, ROLES.VENTAS].includes(perfil?.role);
  const [vista, setVista] = useState(puedeCrear ? 'nuevo' : 'historial'); 
  const defaultForm = { clienteNombre: '', clienteCedula: '', clienteTelefono: '', courier: 'ZOOM', direccion: '', productos: '', carritoObj: null, asesora: perfil?.nombre || '', referencia: '', moneda: 'USD', montoPago: '', tasa: '', esMercadoLibre: false, esRegalo: false, descuentoUsd: '' };
  
  const [formData, setFormData] = useState(defaultForm);
  const [editId, setEditId] = useState(null); 
  const [pedidoDevuelto, setPedidoDevuelto] = useState(null); 
  
  const [pagoAdicional, setPagoAdicional] = useState({ monto: '', ref: '' }); 

  const [enviando, setEnviando] = useState(false);
  const [textoCrudo, setTextoCrudo] = useState('');
  const [analizando, setAnalizando] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);

  const pedidosWeb = pedidos.filter(p => p.esPublico && p.status === 'Por Pagar / Cotización');
  const enEspera = pedidos.filter(p => p.status === 'En Espera (Sin Stock)');

  const copiarLinkTienda = () => {
    const linkTienda = `${window.location.origin}${window.location.pathname}#tienda`;
    const copyFallback = (text) => {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        dialogs.alert(`Enlace copiado al portapapeles:\n\n${text}\n\nPuedes enviarlo a tus clientes para que registren sus pedidos directamente.`, "Enlace de Tienda Copiado");
      } catch (err) {
        dialogs.alert("No se pudo copiar automáticamente. Copia este enlace manualmente:\n\n" + text, "Enlace de la Tienda");
      }
      document.body.removeChild(textArea);
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(linkTienda)
        .then(() => dialogs.alert(`Enlace copiado al portapapeles:\n\n${linkTienda}\n\nPuedes enviarlo a tus clientes para que registren sus pedidos directamente.`, "Enlace de Tienda Copiado"))
        .catch(() => copyFallback(linkTienda));
    } else {
      copyFallback(linkTienda);
    }
  };

  const analizarConGemini = async () => {
    if (!textoCrudo.trim()) return dialogs.alert("Por favor, pega el mensaje de WhatsApp del cliente antes de procesar.", "Mensaje Vacío");
    setAnalizando(true);

    try {
      const llavesCatalogo = catalogo.flatMap(c => c.productos.flatMap(p => p.presentaciones.map(pres => `${p.nombre}|${pres}`))).join(', ');
      const prompt = `Analiza el siguiente mensaje de WhatsApp y extrae los datos en JSON. 
      Estructura esperada: Nombre, Teléfono, Cédula, Empresa de envío (ZOOM, MRW, Tealca, Domesa), Dirección, Productos, Cálculo de pago (Si detectas una multiplicación ej: "13 × 500.46 = 6505.98Bs", el monto es 13 y la tasa es 500.46. Extrae ambos números), Tipo de envío (Si dice "MERCADOLIBRE" o "Mercado Libre", marca esMercadoLibre como true), y la Asesora al final.
      Si el precio tiene descuento con una flecha (ej. 18$ ➜ 13$), el precio real a cobrar es el último (13).
      productosCrudos: texto exacto de los productos solicitados.
      carrito: mapea las cantidades a estas llaves exactas: [${llavesCatalogo}].
      Texto: ${textoCrudo}`;
      
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                clienteNombre: { type: "STRING" }, clienteCedula: { type: "STRING" }, clienteTelefono: { type: "STRING" },
                courier: { type: "STRING" }, direccion: { type: "STRING" }, montoPago: { type: "STRING" }, moneda: { type: "STRING" }, referencia: { type: "STRING" }, asesora: { type: "STRING" }, productosCrudos: { type: "STRING" }, tasa: { type: "STRING" }, esMercadoLibre: { type: "BOOLEAN" },
                carrito: { type: "ARRAY", items: { type: "OBJECT", properties: { llave: { type: "STRING" }, cantidad: { type: "INTEGER" } } } }
              }
            }
          }
        })
      });

      const resultData = await res.json();
      if (resultData?.candidates?.[0]?.content?.parts?.[0]?.text) {
         const result = JSON.parse(resultData.candidates[0].content.parts[0].text);
         let nuevoCarritoObj = {}; let txtFormat = result.productosCrudos || '';

         if (result.carrito && result.carrito.length > 0) {
           const lineas = [];
           result.carrito.forEach(item => {
             if (item.llave && item.cantidad) { nuevoCarritoObj[item.llave] = item.cantidad; lineas.push(`- ${item.cantidad}x ${item.llave.replace('|', ' ')}`); }
           });
           if (lineas.length > 0) txtFormat = lineas.join('\n');
         }

         setFormData(prev => ({ 
           ...prev, 
           ...result, 
           tasa: result.tasa || prev.tasa,
           esMercadoLibre: result.esMercadoLibre || false,
           productos: txtFormat || prev.productos, 
           carritoObj: Object.keys(nuevoCarritoObj).length > 0 ? nuevoCarritoObj : prev.carritoObj 
         }));
      }
    } catch(e) { console.error(e); dialogs.alert("Hubo un error al comunicarse con la IA. Ingresa los datos manualmente.", "Error de API"); } finally { setAnalizando(false); }
  };

  const cargarPedidoParaEditar = (pedido) => {
    setFormData({
      clienteNombre: pedido.clienteNombre, clienteCedula: pedido.clienteCedula, clienteTelefono: pedido.clienteTelefono, courier: pedido.courier, direccion: pedido.direccion,
      productos: typeof pedido.productos === 'string' ? pedido.productos : JSON.stringify(pedido.productos), carritoObj: pedido.carritoObj, asesora: pedido.asesora, referencia: pedido.referencia, moneda: pedido.moneda, 
      montoPago: pedido.monto?.toString(), tasa: pedido.tasaAplicada?.toString(), esMercadoLibre: pedido.esMercadoLibre || false, esRegalo: pedido.esRegalo || false, descuentoUsd: pedido.descuentoUsd?.toString() || ''
    });
    setEditId(pedido.id);
    setPedidoDevuelto(pedido);
    setPagoAdicional({ monto: '', ref: '' });
    setVista('nuevo');
  };

  const cancelarEdicion = () => {
    setFormData(defaultForm);
    setEditId(null);
    setPedidoDevuelto(null);
    setPagoAdicional({ monto: '', ref: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.carritoObj || Object.keys(formData.carritoObj).length === 0) return dialogs.alert("Debes seleccionar productos del Catálogo Visual para proceder con la venta.", "Carrito Vacío");
    if (!formData.esRegalo && (!formData.tasa || parseFloat(formData.tasa) <= 0)) return dialogs.alert("Por favor ingresa la tasa de cambio aplicada.", "Datos Faltantes");
    
    // VALIDACIÓN DE STOCK
    let sinStock = false;
    let itemsFaltantes = [];
    Object.entries(formData.carritoObj).forEach(([key, qty]) => {
      let maxDisp = typeof stock[key] === 'object' ? stock[key].envios : (stock[key]||0);
      if (qty > maxDisp) {
        sinStock = true;
        itemsFaltantes.push(key.replace('|', ' '));
      }
    });

    if (sinStock) {
      dialogs.confirm(`Actualmente no hay stock suficiente en el almacén de envíos para:\n\n${itemsFaltantes.join('\n')}\n\n¿Deseas guardar este pedido en la "Lista de Espera" para procesarlo luego?`, () => {
        procesarVenta('En Espera (Sin Stock)');
      }, "Stock Insuficiente");
      return;
    }

    procesarVenta('Pendiente');
  };

  const procesarVenta = async (finalStatus) => {
    setEnviando(true);
    let montoNum = formData.esRegalo ? 0 : (parseFloat(formData.montoPago) || 0);
    const tasa = parseFloat(formData.tasa) || 1;
    let descuento = parseFloat(formData.descuentoUsd) || 0;
    let pagoExtUsd = 0;

    // Si había faltante y se agregó pago extra
    if (editId && pedidoDevuelto?.faltanteUsd > 0 && pagoAdicional.monto) {
      let extra = parseFloat(pagoAdicional.monto) || 0;
      if (formData.moneda === 'VES') {
         pagoExtUsd = extra / tasa; // Convertir a dólares si lo metieron en Bs
      } else {
         pagoExtUsd = extra;
      }
      montoNum += extra; // Sumamos al monto original registrado (para historial visual)
    }

    let calculo = { usd: 0, ves: 0 };
    if (!formData.esRegalo) {
       calculo = formData.moneda === 'USD' ? { usd: montoNum, ves: montoNum * tasa } : { ves: montoNum, usd: tasa > 0 ? montoNum / tasa : 0 };
    }

    // --- LÓGICA AUTOMÁTICA DE CONCENTRADO ---
    let finalCarrito = { ...formData.carritoObj };
    let finalProductosText = formData.productos || '';
    let countBoosters = 0;
    const boosterKeys = [
      "Booster de Hidratacion|Unidad", "Booster de Reparacion|Unidad", "Booster de Nutricion|Unidad", "Booster Profesional|Unidad"
    ];

    Object.entries(finalCarrito).forEach(([key, qty]) => {
      if (boosterKeys.includes(key)) countBoosters += qty;
    });

    if (countBoosters > 0) {
      finalCarrito["Concentrado|Unidad"] = (finalCarrito["Concentrado|Unidad"] || 0) + countBoosters;
      if (!finalProductosText.includes("Concentrado (Unidad)")) {
        finalProductosText += `\n- ${countBoosters}x Concentrado (Unidad) [Agregado Automáticamente]`;
      }
    }
    // ----------------------------------------

    // --- LÓGICA DE HORARIO DE CORTE (12:20 PM) ---
    const targetDate = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Caracas"}));
    const hours = targetDate.getHours();
    const minutes = targetDate.getMinutes();
    
    if (hours > 12 || (hours === 12 && minutes >= 20)) {
       targetDate.setDate(targetDate.getDate() + 1);
    }
    const fechaDespachoStr = targetDate.toLocaleDateString('es-VE');
    // ---------------------------------------------

    try {
      if (editId) {
        let updateData = {
          ...formData, productos: finalProductosText, carritoObj: finalCarrito, monto: montoNum, montoUsd: calculo.usd, montoVes: calculo.ves, tasaAplicada: tasa, status: finalStatus, motivoRechazo: '', faltanteUsd: 0, descuentoUsd: descuento 
        };
        if (pagoAdicional.ref) {
           updateData.referencia = `${formData.referencia} | EXTRA: ${pagoAdicional.ref}`;
           updateData.pagoAdicionalUsd = pagoExtUsd;
        }

        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', editId), updateData);
        loggear('PEDIDO_CORREGIDO', `Se corrigió y actualizó el pedido de ${formData.clienteNombre}. ${pagoExtUsd > 0 ? `(Extra: $${pagoExtUsd})` : ''}`);
        dialogs.alert(`El pedido de ${formData.clienteNombre} fue actualizado exitosamente.`, "Pedido Actualizado");
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'pedidos'), {
          ...formData, productos: finalProductosText, carritoObj: finalCarrito, monto: montoNum, montoUsd: calculo.usd, montoVes: calculo.ves, tasaAplicada: tasa, status: finalStatus, auditado: false, fechaCreacion: Date.now(), fechaDespacho: fechaDespachoStr, esPublico: false, descuentoUsd: descuento
        });
        loggear('PEDIDO_CREADO', `Venta registrada: ${formData.clienteNombre} ($${calculo.usd.toFixed(2)}) ${formData.esRegalo ? '[REGALO]' : ''}`);
        if (finalStatus === 'Pendiente') {
           dialogs.alert(`Venta registrada exitosamente. \n\nEl despacho quedó pautado para el: ${fechaDespachoStr}`, "¡Venta Exitosa!");
        } else {
           dialogs.alert(`El pedido se ha guardado en la Lista de Espera por falta de inventario.`, "Guardado en Espera");
        }
      }
      
      cancelarEdicion();
      setVista('historial');
    } catch (e) { console.error(e); dialogs.alert("Ocurrió un error al intentar guardar el pedido. Revisa tu conexión.", "Error del Sistema"); }
    setEnviando(false);
  };

  const enviarWhatsApp = (pedido) => {
    const mensaje = `Hola ${pedido.clienteNombre}, tu pedido Bluher ha sido enviado por *${pedido.courier}*.%0A%0A*Guía:* ${pedido.guia}%0A%0A${pedido.linkGuia ? `Recibo: ${pedido.linkGuia}%0A` : ''}${pedido.linkFotoProductos ? `Paquete: ${pedido.linkFotoProductos}%0A` : ''}%0A¡Gracias por tu compra!`;
    const cleanPhone = String(pedido.clienteTelefono).replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${mensaje}`, '_blank');
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
      <div className="flex flex-wrap gap-4 mb-8 border-b border-slate-100 dark:border-slate-700 pb-2">
        {puedeCrear && <button onClick={() => { setVista('nuevo'); if(editId) cancelarEdicion(); }} className={`pb-3 font-bold flex items-center gap-2 transition-colors ${vista === 'nuevo' ? 'text-sky-600 border-b-2 border-sky-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}><ShoppingCart size={18} /> {editId ? 'Corrigiendo Pedido' : 'Nueva Venta'}</button>}
        <button onClick={() => setVista('historial')} className={`pb-3 font-bold flex items-center gap-2 transition-colors ${vista === 'historial' ? 'text-sky-600 border-b-2 border-sky-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}><ClipboardList size={18} /> Historial y Estatus</button>
        <button onClick={() => setVista('espera')} className={`pb-3 font-bold flex items-center gap-2 transition-colors ${vista === 'espera' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-400 hover:text-amber-500'}`}><Clock size={18} /> Lista de Espera {enEspera.length > 0 && <span className="bg-amber-100 text-amber-700 px-2 rounded-full text-[10px]">{enEspera.length}</span>}</button>
        <button onClick={() => setVista('web')} className={`pb-3 font-bold flex items-center gap-2 transition-colors ${vista === 'web' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-slate-400 hover:text-emerald-500'}`}><Store size={18} /> Pedidos Web {pedidosWeb.length > 0 && <span className="bg-emerald-100 text-emerald-700 px-2 rounded-full text-[10px]">{pedidosWeb.length}</span>}</button>
        <button onClick={copiarLinkTienda} className="pb-3 font-bold flex items-center gap-2 transition-colors text-slate-400 hover:text-sky-600 ml-auto"><Link size={18} /> Copiar Enlace Público</button>
      </div>

      {vista === 'nuevo' && puedeCrear && (
        <div className="animate-in fade-in duration-300">
          {editId && pedidoDevuelto && (
            <div className="mb-8 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-5 rounded-r-xl shadow-sm">
              <div className="flex gap-4">
                <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-full text-red-600 dark:text-red-400 shrink-0 h-max"><AlertTriangle size={20} /></div>
                <div className="flex-1">
                  <h3 className="text-red-800 dark:text-red-300 font-bold text-lg">Administración Devolvió la Orden</h3>
                  <p className="text-red-700 dark:text-red-200 text-sm mt-1"><strong>Motivo:</strong> {pedidoDevuelto.motivoRechazo}</p>
                  
                  {pedidoDevuelto.faltanteUsd > 0 && (
                    <div className="mt-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-red-200 dark:border-red-800">
                      <div className="text-sm font-bold text-red-600 dark:text-red-400 mb-3">⚠️ Dinero Faltante Detectado: ${pedidoDevuelto.faltanteUsd.toFixed(2)} USD</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Monto adicional pagado" type="number" step="0.01" value={pagoAdicional.monto} onChange={e=>setPagoAdicional({...pagoAdicional, monto: e.target.value})} placeholder="Ej: 5.50" />
                        <Input label="Referencia del pago adicional" type="text" value={pagoAdicional.ref} onChange={e=>setPagoAdicional({...pagoAdicional, ref: e.target.value})} placeholder="Ref: 4321..." />
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 italic">* Este monto se sumará automáticamente al total original registrado.</div>
                    </div>
                  )}

                  <button type="button" onClick={cancelarEdicion} className="text-xs font-bold text-red-600 dark:text-red-400 hover:text-red-800 mt-4 underline transition-colors">Cancelar corrección</button>
                </div>
              </div>
            </div>
          )}

          {!editId && (
            <div className="mb-8 bg-gradient-to-r from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-blue-900/20 p-6 rounded-2xl border border-sky-100 dark:border-sky-800 shadow-sm">
              <h3 className="text-sky-900 dark:text-sky-300 font-bold mb-3 flex items-center gap-2"><Sparkles size={20} className="text-sky-600 dark:text-sky-400" /> Asistente de IA Bluher</h3>
              <div className="flex flex-col md:flex-row gap-4">
                <textarea className="flex-1 p-4 border border-sky-200/60 dark:border-sky-700 rounded-xl text-sm resize-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all shadow-inner bg-white/80 dark:bg-slate-800/80 dark:text-white" rows={2} placeholder="Pega aquí el mensaje del cliente (WhatsApp)..." value={textoCrudo} onChange={(e) => setTextoCrudo(e.target.value)}></textarea>
                <button type="button" onClick={analizarConGemini} disabled={analizando} className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 px-6 rounded-xl shadow-md disabled:opacity-50 transition-all hover:shadow-lg flex items-center justify-center min-w-[140px]">
                  {analizando ? <Loader2 className="animate-spin" size={20}/> : 'Autocompletar'}
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <Input label="Nombre de Asesora" name="asesora" value={formData.asesora} onChange={(e)=>setFormData({...formData, asesora: e.target.value})} required />
             <Input label="Nombre del Cliente" name="clienteNombre" value={formData.clienteNombre} onChange={(e)=>setFormData({...formData, clienteNombre: e.target.value})} required />
             <Input label="Cédula/RIF" name="clienteCedula" value={formData.clienteCedula} onChange={(e)=>setFormData({...formData, clienteCedula: e.target.value})} required />
             <Input label="Teléfono de Contacto" name="clienteTelefono" value={formData.clienteTelefono} onChange={(e)=>setFormData({...formData, clienteTelefono: e.target.value})} required />
             
             <div className="flex flex-col">
               <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Empresa de Envío</label>
               <select name="courier" value={formData.courier} onChange={(e)=>setFormData({...formData, courier: e.target.value})} className="p-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-[#f0f4f8] dark:bg-slate-900 outline-none focus:ring-2 focus:ring-sky-500 transition-all font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                 <option value="ZOOM">ZOOM</option> <option value="MRW">MRW</option> <option value="Tealca">Tealca</option> <option value="Domesa">Domesa</option>
               </select>
             </div>
             
             <div className="flex flex-col justify-center gap-3 mt-6">
               <div className="flex items-center gap-3">
                 <input type="checkbox" id="ml-check" checked={formData.esMercadoLibre} onChange={(e) => setFormData({...formData, esMercadoLibre: e.target.checked})} className="w-5 h-5 accent-sky-600 cursor-pointer rounded" />
                 <label htmlFor="ml-check" className="text-sm font-bold text-slate-700 dark:text-slate-300 cursor-pointer uppercase tracking-wider">Es envío de MercadoLibre</label>
               </div>
               <div className="flex items-center gap-3">
                 <input type="checkbox" id="regalo-check" checked={formData.esRegalo} onChange={(e) => setFormData({...formData, esRegalo: e.target.checked})} className="w-5 h-5 accent-purple-600 cursor-pointer rounded" />
                 <label htmlFor="regalo-check" className="text-sm font-bold text-purple-700 dark:text-purple-400 cursor-pointer uppercase tracking-wider flex items-center gap-1"><Gift size={16}/> Es Regalo / Obsequio VIP</label>
               </div>
             </div>

             <div className="md:col-span-2">
               <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">Dirección de Envío Completa</label>
               <textarea name="direccion" value={formData.direccion} onChange={(e)=>setFormData({...formData, direccion: e.target.value})} required rows={2} className="w-full p-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-[#f0f4f8] dark:bg-slate-900 outline-none focus:ring-2 focus:ring-sky-500 transition-all font-bold text-slate-700 dark:text-slate-200"></textarea>
             </div>
             
             <div className="md:col-span-2 bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700">
               <div className="flex justify-between items-center mb-4">
                 <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2"><Package size={20} className="text-sky-600"/> Inventario a Despachar</label>
                 <button type="button" onClick={() => setIsCatalogOpen(true)} className="text-sm font-bold text-sky-700 dark:text-sky-400 bg-sky-100/50 dark:bg-sky-900/30 hover:bg-sky-100 dark:hover:bg-sky-900 py-2 px-5 rounded-lg transition-colors flex items-center gap-2"><Search size={16} /> Catálogo Visual</button>
               </div>
               {formData.productos ? (
                 <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm font-medium leading-relaxed">{typeof formData.productos === 'string' ? formData.productos : JSON.stringify(formData.productos)}</div>
               ) : (
                 <div className="text-sm text-slate-400 italic font-bold text-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-white/50 dark:bg-slate-900/50">El carrito está vacío. Haz clic en "Catálogo Visual" para agregar productos.</div>
               )}
             </div>

             <div className={`md:col-span-2 p-6 rounded-2xl shadow-inner grid grid-cols-1 md:grid-cols-4 gap-5 transition-colors ${formData.esRegalo ? 'bg-purple-900/20 border-2 border-purple-500 text-purple-300' : 'bg-[#003366] dark:bg-slate-950 text-white'}`}>
               <div className="flex flex-col"><InputDark disabled={formData.esRegalo} type="number" step="0.01" label="Tasa Aplicada (Bs/$)" value={formData.tasa} onChange={(e)=>setFormData({...formData, tasa: e.target.value})} required={!formData.esRegalo} placeholder="Ej: 45.20" /></div>
               <div className="flex flex-col">
                 <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Moneda</label>
                 <select value={formData.moneda} onChange={(e)=>setFormData({...formData, moneda: e.target.value})} className="p-3 border-2 border-slate-600 rounded-xl bg-slate-700 outline-none focus:border-sky-500 transition-all font-bold text-white cursor-pointer disabled:opacity-50">
                   <option value="USD">Dólares (USD)</option> <option value="VES">Bolívares (VES)</option>
                 </select>
               </div>
               <div className="flex flex-col relative"><InputDark disabled={formData.esRegalo} type="number" step="0.01" label="Monto Pagado" value={formData.montoPago} onChange={(e)=>setFormData({...formData, montoPago: e.target.value})} required={!formData.esRegalo} placeholder="Ej: 30.50" />
                 {formData.tasa && formData.montoPago && <span className="text-xs text-emerald-400 font-bold absolute -bottom-5 left-0">{formData.moneda === 'USD' ? `Eq: Bs. ${((parseFloat(formData.montoPago)||0) * parseFloat(formData.tasa)).toFixed(2)}` : `Eq: $${((parseFloat(formData.montoPago)||0) / parseFloat(formData.tasa)).toFixed(2)}`}</span>}
               </div>
               <InputDark label="Referencia / Banco" value={formData.referencia} onChange={(e)=>setFormData({...formData, referencia: e.target.value})} required={!formData.esRegalo} placeholder="Ej. 1234 Banesco" />
             </div>
             
             <div className="md:col-span-2 mt-4">
                <button type="submit" disabled={enviando} className={`w-full text-white font-bold py-4 rounded-xl shadow-lg flex justify-center items-center gap-3 text-lg transition-all duration-300 hover:-translate-y-0.5 ${editId ? 'bg-amber-600 hover:bg-amber-700 hover:shadow-amber-600/30' : 'bg-sky-600 hover:bg-sky-700 hover:shadow-sky-600/30'}`}>
                  {enviando ? <Loader2 className="animate-spin" /> : <><CheckCircle size={22} /> {editId ? 'Actualizar y Reenviar Pedido' : 'Procesar Orden de Venta'}</>}
                </button>
             </div>
          </form>
        </div>
      )}

      {vista === 'historial' && (
        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm animate-in fade-in">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                <th className="p-4 border-b dark:border-slate-700 font-bold tracking-wide">Cliente y Fecha</th>
                <th className="p-4 border-b dark:border-slate-700 font-bold tracking-wide">Pago</th>
                <th className="p-4 border-b dark:border-slate-700 font-bold tracking-wide">Estatus</th>
                <th className="p-4 border-b dark:border-slate-700 font-bold tracking-wide text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.filter(p => !p.esPublico).length === 0 ? <tr><td colSpan="4" className="p-8 text-center text-slate-400 italic font-bold">No hay ventas registradas aún.</td></tr> : 
                pedidos.filter(p => !p.esPublico).map(p => (
                <tr key={p.id} className="border-b border-slate-50 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-slate-800 dark:text-slate-100 text-base flex items-center gap-2">
                       {p.clienteNombre}
                       {p.esMercadoLibre && <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border border-yellow-300">ML</span>}
                    </div>
                    <div className="text-xs font-semibold text-slate-400 mt-1">{new Date(p.fechaCreacion).toLocaleDateString()}</div>
                  </td>
                  <td className="p-4">
                    <div className="font-black text-slate-800 dark:text-slate-100 text-lg">${(p.montoUsd||0).toFixed(2)}</div>
                    <div className="text-[11px] font-semibold text-slate-400 mt-0.5">Tasa: Bs. {p.tasaAplicada || '-'}</div>
                  </td>
                  <td className="p-4">
                    <StatusBadge status={p.status} />
                    {p.status === 'Rechazado' && <div className="text-[10px] text-red-600 mt-1.5 font-bold bg-red-50 dark:bg-red-900/30 p-2 rounded-lg border border-red-100 dark:border-red-800 max-w-[200px] line-clamp-2 leading-relaxed" title={p.motivoRechazo}>Motivo: {p.motivoRechazo}</div>}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex flex-col items-end gap-2">
                      {p.status === 'Rechazado' && (
                        <button onClick={() => cargarPedidoParaEditar(p)} className="bg-amber-100 text-amber-700 hover:bg-amber-200 text-xs font-bold py-1.5 px-3 rounded-lg transition-colors shadow-sm">Corregir Orden</button>
                      )}
                      {(p.status === 'Pendiente' || p.status === 'Rechazado') && (
                        <button onClick={() => cambiarEstadoPedido(p.id, 'En Espera (Sin Stock)')} className="text-xs text-slate-400 hover:text-amber-500 font-semibold underline transition-colors">Mover a Espera</button>
                      )}
                      {p.status === 'Despachado' && (
                        <>
                          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">Guía: {p.guia}</div>
                          <button onClick={() => enviarWhatsApp(p)} className="bg-[#25D366]/10 text-[#128C7E] dark:text-[#25D366] hover:bg-[#25D366]/20 text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-colors"><MessageCircle size={14} /> Notificar</button>
                        </>
                      )}
                      {p.auditado && <span className="text-emerald-600 font-bold text-[10px] flex items-center justify-end gap-1 mt-1 uppercase tracking-widest"><ShieldCheck size={12}/> Auditado</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ModalCatalogo 
        catalogo={catalogo} 
        isOpen={isCatalogOpen} 
        onClose={()=>setIsCatalogOpen(false)} 
        dialogs={dialogs}
        onConfirm={(txt, obj)=>{
          setFormData(prev => ({
            ...prev, 
            productos: prev.productos ? `${prev.productos}\n${txt}` : txt, 
            carritoObj: { ...(prev.carritoObj || {}), ...obj }
          })); 
          setIsCatalogOpen(false);
        }}
      />
    </div>
  );
}

// ==========================================
// 3. PANEL DE ADMINISTRACIÓN
// ==========================================
function PanelAdmin({ perfil, pedidos, stock, loggear, db, appId, dialogs }) {
  const [vistaAdmin, setVistaAdmin] = useState('pendientes');
  const esAuditor = [ROLES.AUDITOR_VENTAS, ROLES.AUDITOR_GENERAL].includes(perfil?.role);
  const esAdmin = [ROLES.ADMIN, ROLES.ADMINISTRACION].includes(perfil?.role);

  const pendientes = pedidos.filter(p => p.status === 'Pendiente');
  const historial = pedidos.filter(p => p.status !== 'Pendiente');

  const validarPago = async (pedido) => {
    try {
      const stockRef = doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'stock');
      let currentStock = { ...stock };
      Object.entries(pedido.carritoObj || {}).forEach(([itemKey, qty]) => {
         let actualEnvios = typeof currentStock[itemKey] === 'object' ? currentStock[itemKey].envios : (currentStock[itemKey] || 0);
         let actualRecep = typeof currentStock[itemKey] === 'object' ? currentStock[itemKey].recepcion : 0;
         currentStock[itemKey] = { envios: Math.max(0, actualEnvios - qty), recepcion: actualRecep };
      });
      await setDoc(stockRef, currentStock);
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', pedido.id), { status: 'Validado' });
      loggear('PAGO_VALIDADO', `Aprobación y descuento de stock: ${pedido.clienteNombre}`);
    } catch(e) { console.error(e); dialogs.alert("Ocurrió un error al validar el pago.", "Error"); }
  };

  const rechazarPago = (pedido) => {
    dialogs.prompt(`Escribe el motivo de devolución a Ventas para el pedido de ${pedido.clienteNombre}:\n(Ej: Faltan dinero en la transferencia, Producto sin stock)`, async (motivo) => {
      if (!motivo) return;
      try {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', pedido.id), { status: 'Rechazado', motivoRechazo: motivo });
        loggear('PAGO_RECHAZADO', `Devolución: ${pedido.clienteNombre} - ${motivo}`);
      } catch(e) { console.error(e); }
    }, "Devolver Pedido");
  };

  const marcarAuditoria = async (id, actual) => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', id), { auditado: !actual });
      loggear('AUDITORIA_VENTA', `${!actual ? 'Aprobó' : 'Removió'} auditoría: ${id}`);
    } catch(e) { console.error(e); }
  };

  const listado = vistaAdmin === 'pendientes' ? pendientes : historial;

  return (
    <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b border-slate-100 dark:border-slate-700 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3"><CheckSquare className="text-sky-600"/> Validación de Pagos</h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Revisión de transferencias y control de inventario.</p>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
          <button onClick={() => setVistaAdmin('pendientes')} className={`px-5 py-2 font-bold rounded-lg text-sm transition-all ${vistaAdmin === 'pendientes' ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Pendientes ({pendientes.length})</button>
          <button onClick={() => setVistaAdmin('historial')} className={`px-5 py-2 font-bold rounded-lg text-sm transition-all ${vistaAdmin === 'historial' ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Historial</button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
        <table className="w-full text-left border-collapse text-sm">
          <thead><tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400"><th className="p-4 border-b dark:border-slate-700 font-bold tracking-wide w-2/5">Datos del Pedido</th><th className="p-4 border-b dark:border-slate-700 font-bold tracking-wide">Información de Pago</th><th className="p-4 border-b dark:border-slate-700 font-bold tracking-wide text-right">Acción Requerida</th></tr></thead>
          <tbody>
            {listado.length === 0 ? <tr><td colSpan="3" className="p-10 text-center text-slate-400 italic font-bold">Lista limpia. Buen trabajo.</td></tr> : listado.map(p => (
              <tr key={p.id} className="border-b border-slate-50 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                 <td className="p-4 align-top">
                   <div className="font-bold text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                     {p.clienteNombre}
                     {p.esMercadoLibre && <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border border-yellow-300">ML</span>}
                   </div>
                   <div className="text-xs font-semibold text-slate-400 mt-1">Asesora: {p.asesora}</div>
                   <div className="text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 mt-3 rounded-xl shadow-sm">
                     <span className="font-bold text-sky-700 dark:text-sky-400 flex items-center gap-1.5 mb-2 uppercase tracking-wider"><Package size={14}/> Productos a descontar:</span>
                     {p.productos ? (
                        <div className="whitespace-pre-wrap leading-relaxed">{typeof p.productos === 'string' ? p.productos : JSON.stringify(p.productos)}</div>
                     ) : (
                        p.carritoObj ? Object.entries(p.carritoObj).map(([key, qty]) => <div key={key} className="flex gap-2 mb-1"><span className="font-bold text-slate-800 dark:text-slate-100">{qty}x</span> <span>{key.replace('|', ' ')}</span></div>) : 'Sin detalle.'
                     )}
                   </div>
                 </td>
                 <td className="p-4 align-top">
                   <div className="font-black text-slate-800 dark:text-slate-100 text-xl">${(p.montoUsd||0).toFixed(2)}</div>
                   <div className="font-bold text-emerald-600 dark:text-emerald-400 text-base mb-1">Bs. {(p.montoVes||0).toFixed(2)}</div>
                   <div className="text-xs text-slate-500 mb-2">Tasa: Bs. {p.tasaAplicada}</div>
                   <div className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded inline-block mb-3 border border-slate-200 dark:border-slate-700">Ref: {p.referencia}</div>
                   <div><StatusBadge status={p.status}/></div>
                 </td>
                 <td className="p-4 align-top text-right">
                   <div className="flex flex-col gap-2 items-end">
                     {esAdmin && p.status === 'Pendiente' && (
                       <>
                         <button onClick={()=>validarPago(p)} className="bg-sky-600 text-white px-4 py-2 rounded-lg font-bold text-xs shadow-md hover:bg-sky-700 transition-colors w-full sm:w-auto">Aprobar y Descontar</button>
                         <button onClick={()=>rechazarPago(p)} className="bg-white dark:bg-slate-800 border-2 border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 px-4 py-2 rounded-lg font-bold text-xs transition-colors w-full sm:w-auto">Devolver</button>
                       </>
                     )}
                     {(esAuditor || esAdmin) && p.status !== 'Pendiente' && (
                       <button onClick={()=>marcarAuditoria(p.id, p.auditado)} className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 border-2 transition-colors w-full sm:w-auto ${p.auditado ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                         {p.auditado ? <><ShieldCheck size={14}/> Validado Auditor</> : <><Eye size={14}/> Marcar Revisión</>}
                       </button>
                     )}
                   </div>
                 </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==========================================
// 4. PANEL DE DESPACHO
// ==========================================
function PanelDespacho({ pedidos, cambiarEstado, db, appId, loggear, dialogs }) {
  const [vistaDespacho, setVistaDespacho] = useState('pendientes');

  const pedidosValidados = pedidos.filter(p => p.status === 'Validado');
  const pedidosDespachados = pedidos.filter(p => p.status === 'Despachado');
  const pedidosPendientes = pedidos.filter(p => p.status === 'Pendiente' || p.status === 'Rechazado').length;

  const [guiasInput, setGuiasInput] = useState({});
  const [subiendo, setSubiendo] = useState({ id: null, field: null });

  const handleGuiaChange = (id, field, value) => setGuiasInput(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  const handleFileUpload = async (e, id, field) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!URL_GOOGLE_SCRIPT) return dialogs.alert("⚠️ Falta configurar el puente de Google Drive. Por ahora, debes tomar la foto, subirla a drive y pegar el enlace manualmente.", "Configuración Faltante");
    
    setSubiendo({ id, field });
    try {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = async () => {
            const base64Data = reader.result.split(',')[1];
            const response = await fetch(URL_GOOGLE_SCRIPT, {
                method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ fileName: `Soporte_${id.substring(0,5)}_${field}.jpg`, mimeType: file.type, data: base64Data })
            });
            const result = await response.json();
            if (result.url) { handleGuiaChange(id, field, result.url); loggear('FOTO_SUBIDA', `Foto ${field} en ${id}`); }
            setSubiendo({ id: null, field: null });
        };
    } catch (error) { console.error(error); dialogs.alert("Error subiendo la foto a Drive. Revisa tu conexión.", "Fallo de Red"); setSubiendo({ id: null, field: null }); }
  };

  const guardarGuia = async (pedido) => {
    const inputData = guiasInput[pedido.id];
    if (!inputData || !inputData.guia || !inputData.link || !inputData.fotoProductos) {
      return dialogs.alert("⚠️ ALERTA: Todos los campos son obligatorios.\n\nDebes ingresar:\n1. Número de Guía\n2. Link/Foto del recibo de Guía\n3. Link/Foto de los productos armados", "Información Incompleta");
    }
    
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', pedido.id), { 
        guia: inputData.guia, linkGuia: inputData.link, linkFotoProductos: inputData.fotoProductos, status: 'Despachado'
      });
      loggear('PEDIDO_DESPACHADO', `Despacho ${pedido.clienteNombre} (Guía: ${inputData.guia})`);
      dialogs.alert("Guía y soportes guardados correctamente. El pedido ahora pasará al historial de Despachos.", "Despacho Confirmado");
    } catch(e) { console.error(e); dialogs.alert("Error al intentar guardar la información.", "Error"); }
  };

  const pedidosAMostrar = vistaDespacho === 'pendientes' ? pedidosValidados : pedidosDespachados;

  return (
    <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b border-slate-100 dark:border-slate-700 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3"><Truck className="text-sky-600"/> Logística de Envíos</h2>
          <div className="flex gap-2 mt-4 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl w-max">
            <button onClick={() => setVistaDespacho('pendientes')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${vistaDespacho === 'pendientes' ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Por Empacar ({pedidosValidados.length})</button>
            <button onClick={() => setVistaDespacho('historial')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${vistaDespacho === 'historial' ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Enviados</button>
          </div>
        </div>
        <button onClick={() => window.print()} className="bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900 font-bold py-2.5 px-5 rounded-xl transition-colors flex items-center gap-2 text-sm shadow-sm">
          <Printer size={16} /> Imprimir Etiquetas
        </button>
      </div>

      {pedidosPendientes > 0 && vistaDespacho === 'pendientes' && (
        <div className="mb-8 bg-sky-50/50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800 p-5 rounded-xl flex items-start gap-4 shadow-sm">
          <div className="p-2 bg-sky-100 dark:bg-sky-900/50 rounded-full text-sky-600 dark:text-sky-400 shrink-0"><Clock size={20} /></div>
          <div>
            <h3 className="text-sky-900 dark:text-sky-300 font-bold">Órdenes en proceso</h3>
            <p className="text-sky-800/80 dark:text-sky-200/80 text-sm mt-1 font-medium">Hay <strong>{pedidosPendientes} pedido(s)</strong> siendo verificados por administración. Te sugerimos esperar a que los validen todos antes de imprimir para que las etiquetas salgan en la misma página.</p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
        <table className="w-full text-left border-collapse min-w-[800px] text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
              <th className="p-4 border-b dark:border-slate-700 font-bold w-1/4">Datos del Paquete</th>
              <th className="p-4 border-b dark:border-slate-700 font-bold">Dirección y Contenido</th>
              <th className="p-4 border-b dark:border-slate-700 font-bold w-1/3">Gestión de Guía y Soportes</th>
            </tr>
          </thead>
          <tbody>
            {pedidosAMostrar.length === 0 ? <tr><td colSpan="3" className="p-10 text-center text-slate-400 italic font-bold">No hay envíos pendientes.</td></tr> : pedidosAMostrar.map(p => (
              <tr key={p.id} className="border-b border-slate-50 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="p-4 align-top">
                  <div className="font-bold text-slate-800 dark:text-slate-100 text-base">{p.clienteNombre}</div>
                  <div className="text-xs font-black tracking-widest uppercase text-sky-600 dark:text-sky-400 mt-1">{p.courier}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">{p.clienteTelefono}</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-2">Sale: {p.fechaDespacho}</div>
                </td>
                <td className="p-4 align-top">
                  <div className="font-medium bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700 mb-3 whitespace-pre-wrap shadow-sm text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">{typeof p.productos === 'string' ? p.productos : JSON.stringify(p.productos)}</div>
                  <div className="text-[13px] text-slate-500 dark:text-slate-400 flex items-start gap-2"><div className="mt-0.5 text-sky-600 dark:text-sky-400"><Package size={14}/></div>{p.direccion}</div>
                </td>
                <td className="p-4 align-top bg-slate-50/50 dark:bg-slate-900/30">
                  {p.status === 'Despachado' ? (
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                      <div className="text-sm mb-3"><span className="font-bold text-slate-400 uppercase text-[10px] tracking-widest block mb-1">Número de Guía</span> <span className="font-black text-slate-800 dark:text-slate-100">{p.guia}</span></div>
                      <div className="flex flex-col gap-2 mb-4">
                        {p.linkGuia && <a href={p.linkGuia} target="_blank" rel="noreferrer" className="text-xs text-sky-600 dark:text-sky-400 hover:text-sky-800 font-semibold flex items-center gap-1.5"><ImageIcon size={14}/> Recibo Digital</a>}
                        {p.linkFotoProductos && <a href={p.linkFotoProductos} target="_blank" rel="noreferrer" className="text-xs text-sky-600 dark:text-sky-400 hover:text-sky-800 font-semibold flex items-center gap-1.5"><Camera size={14}/> Foto del Paquete</a>}
                      </div>
                      <button onClick={() => cambiarEstado(p.id, 'Validado')} className="text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 text-xs font-semibold underline decoration-slate-300 transition-colors">Modificar Envío</button>
                    </div>
                  ) : (
                    <div className="space-y-3 bg-white dark:bg-slate-800 p-4 rounded-xl border border-sky-100 dark:border-slate-700 shadow-sm">
                      <input type="text" placeholder="Número de Guía Tracker" className="w-full text-sm p-2.5 border-2 border-slate-200 dark:border-slate-600 rounded-lg font-bold outline-none focus:border-sky-500 bg-slate-50 dark:bg-slate-900 dark:text-white transition-colors" value={guiasInput[p.id]?.guia || ''} onChange={(e) => handleGuiaChange(p.id, 'guia', e.target.value)} />
                      
                      <div className="flex gap-2 relative">
                        <input type="text" placeholder="URL Recibo Guía" className="w-full text-xs p-2.5 border-2 border-slate-200 dark:border-slate-600 rounded-lg pr-10 outline-none focus:border-sky-500 bg-slate-50 dark:bg-slate-900 dark:text-white transition-colors" value={guiasInput[p.id]?.link || ''} onChange={(e) => handleGuiaChange(p.id, 'link', e.target.value)} />
                        <label className="absolute right-1.5 top-1.5 p-1.5 bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400 hover:bg-sky-600 hover:text-white rounded-md cursor-pointer transition-colors" title="Subir Foto">
                          {subiendo.id === p.id && subiendo.field === 'link' ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileUpload(e, p.id, 'link')} />
                        </label>
                      </div>

                      <div className="flex gap-2 relative">
                        <input type="text" placeholder="URL Foto Empaque" className="w-full text-xs p-2.5 border-2 border-slate-200 dark:border-slate-600 rounded-lg pr-10 outline-none focus:border-sky-500 bg-slate-50 dark:bg-slate-900 dark:text-white transition-colors" value={guiasInput[p.id]?.fotoProductos || ''} onChange={(e) => handleGuiaChange(p.id, 'fotoProductos', e.target.value)} />
                        <label className="absolute right-1.5 top-1.5 p-1.5 bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400 hover:bg-sky-600 hover:text-white rounded-md cursor-pointer transition-colors" title="Subir Foto">
                          {subiendo.id === p.id && subiendo.field === 'fotoProductos' ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileUpload(e, p.id, 'fotoProductos')} />
                        </label>
                      </div>

                      <button onClick={() => guardarGuia(p)} className="w-full bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold py-2.5 rounded-lg mt-2 flex items-center justify-center gap-2 transition-all shadow-md">
                        Confirmar y Archivar
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==========================================
// 5. PANELES ADICIONALES (INVENTARIO, REPORTES, USUARIOS)
// ==========================================
function PanelInventario({ stock, notas, catalogo, movimientos, db, appId, loggear, perfil, dialogs }) {
  const puedeEditar = [ROLES.ADMIN, ROLES.AUDITOR_INVENTARIO, ROLES.AUDITOR_GENERAL, ROLES.ADMINISTRACION].includes(perfil?.role);
  const esRecepcion = [ROLES.ADMIN, ROLES.ADMINISTRACION, ROLES.AUDITOR_GENERAL].includes(perfil?.role);
  
  const [subTab, setSubTab] = useState('stock'); 
  
  const listaStock = [];
  catalogo.forEach(c => c.productos.forEach(p => p.presentaciones.forEach(pres => {
    const key = `${p.nombre}|${pres}`;
    const objStock = typeof stock[key] === 'object' ? stock[key] : { envios: stock[key]||0, recepcion: 0 };
    listaStock.push({ key, cat: c.categoria, nom: p.nombre, pres, envios: objStock.envios, recepcion: objStock.recepcion, nota: notas[key] });
  })));

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-slate-100 dark:border-slate-700 pb-4 gap-4">
        <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3"><Archive className="text-sky-600" /> Sistema de Inventario</h2>
        <div className="flex gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
          <button onClick={()=>setSubTab('stock')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${subTab==='stock'?'bg-white dark:bg-slate-700 shadow text-sky-700 dark:text-sky-400':'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Control Stock</button>
          <button onClick={()=>setSubTab('movimientos')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${subTab==='movimientos'?'bg-white dark:bg-slate-700 shadow text-sky-700 dark:text-sky-400':'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Transferencias</button>
          {puedeEditar && <button onClick={()=>setSubTab('catalogo')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${subTab==='catalogo'?'bg-white dark:bg-slate-700 shadow text-sky-700 dark:text-sky-400':'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Catálogo Web</button>}
        </div>
      </div>

      {subTab === 'stock' && <SubPanelStock lista={listaStock} notas={notas} stock={stock} db={db} appId={appId} puedeEditar={puedeEditar} loggear={loggear} dialogs={dialogs} />}
      {subTab === 'movimientos' && <SubPanelMovimientos movimientos={movimientos} stock={stock} db={db} appId={appId} loggear={loggear} perfil={perfil} catalogo={catalogo} esRecepcion={esRecepcion} dialogs={dialogs} />}
      {subTab === 'catalogo' && <SubPanelCatalogo catalogo={catalogo} db={db} appId={appId} loggear={loggear} dialogs={dialogs} />}
    </div>
  );
}

function SubPanelStock({ lista, notas, stock, db, appId, puedeEditar, loggear, dialogs }) {
  const [localStock, setLocalStock] = useState({});
  const [notaActiva, setNotaActiva] = useState(null); 
  const [textoNota, setTextoNota] = useState('');

  useEffect(() => {
    const format = {};
    lista.forEach(i => { format[i.key] = { envios: i.envios, recepcion: i.recepcion }; });
    setLocalStock(format);
  }, [stock, lista]);

  const handleStockChange = (key, almacen, value) => {
    const num = parseInt(value, 10) || 0;
    setLocalStock(prev => ({ ...prev, [key]: { ...prev[key], [almacen]: num } }));
  };

  const guardarStock = async (key) => {
    const current = typeof stock[key] === 'object' ? stock[key] : { envios: stock[key]||0, recepcion: 0 };
    const next = localStock[key];
    if (!next) return;
    if (current.envios === next.envios && current.recepcion === next.recepcion) return; 
    
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'stock'), { [key]: next }, { merge: true });
    loggear('AJUSTE_INVENTARIO_MANUAL', `Se ajustó stock de [${key}]. Envíos: ${next.envios}, Recepción: ${next.recepcion}`);
  };

  const guardarNota = async (key) => {
    if(!textoNota.trim()) return;
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'notas'), { [key]: textoNota }, { merge: true });
    loggear('NOTA_INVENTARIO', `Nota a [${key}]: "${textoNota}"`);
    setNotaActiva(null); setTextoNota('');
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
      <table className="w-full text-left text-sm border-collapse min-w-[800px]">
         <thead>
           <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
             <th className="p-4 border-b dark:border-slate-700 font-bold tracking-wide">Producto</th>
             <th className="p-4 border-b dark:border-slate-700 text-center border-l border-slate-100 dark:border-slate-700 bg-sky-50/50 dark:bg-sky-900/10 font-bold tracking-wide text-sky-800 dark:text-sky-400">Almacén: ENVÍOS</th>
             <th className="p-4 border-b dark:border-slate-700 text-center border-l border-slate-100 dark:border-slate-700 bg-purple-50/50 dark:bg-purple-900/10 font-bold tracking-wide text-purple-800 dark:text-purple-400">Almacén: RECEPCIÓN</th>
             <th className="p-4 border-b dark:border-slate-700 border-l border-slate-100 dark:border-slate-700 font-bold tracking-wide">Notas del Auditor</th>
           </tr>
         </thead>
         <tbody>
           {lista.map(item => (
             <tr key={item.key} className="border-b border-slate-50 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
               <td className="p-4">
                 <div className="font-bold text-slate-800 dark:text-slate-100 text-base">{item.nom}</div>
                 <div className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold px-2 py-0.5 rounded inline-block mt-1">{item.pres}</div>
               </td>
               <td className="p-4 text-center border-l border-slate-50 dark:border-slate-700 bg-sky-50/20 dark:bg-sky-900/5">
                 {puedeEditar ? (
                   <input type="number" min="0" value={localStock[item.key]?.envios ?? item.envios} onChange={e=>handleStockChange(item.key, 'envios', e.target.value)} onBlur={()=>guardarStock(item.key)} className="w-20 border-2 border-slate-200 dark:border-slate-600 bg-transparent focus:border-sky-500 text-center font-bold rounded-lg p-2 outline-none transition-colors dark:text-white" />
                 ) : <span className="font-black text-xl text-sky-800 dark:text-sky-400">{item.envios}</span>}
               </td>
               <td className="p-4 text-center border-l border-slate-50 dark:border-slate-700 bg-purple-50/20 dark:bg-purple-900/5">
                 {puedeEditar ? (
                   <input type="number" min="0" value={localStock[item.key]?.recepcion ?? item.recepcion} onChange={e=>handleStockChange(item.key, 'recepcion', e.target.value)} onBlur={()=>guardarStock(item.key)} className="w-20 border-2 border-slate-200 dark:border-slate-600 bg-transparent focus:border-purple-500 text-center font-bold rounded-lg p-2 outline-none transition-colors dark:text-white" />
                 ) : <span className="font-black text-xl text-purple-800 dark:text-purple-400">{item.recepcion}</span>}
               </td>
               <td className="p-4 border-l border-slate-50 dark:border-slate-700 w-1/3">
                 {item.nota && <div className="text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400 p-3 rounded-lg border border-amber-200 dark:border-amber-800 mb-3 whitespace-pre-wrap flex items-start gap-2 shadow-sm font-medium"><AlertTriangle size={16} className="shrink-0 text-amber-500"/> {item.nota}</div>}
                 {puedeEditar && notaActiva === item.key ? (
                   <div className="flex flex-col gap-2">
                     <textarea value={textoNota} onChange={e=>setTextoNota(e.target.value)} placeholder="Escribe anomalía u observación..." className="text-sm border-2 border-slate-200 dark:border-slate-600 bg-transparent dark:text-white rounded-lg p-2 w-full outline-none focus:border-sky-500 transition-colors" rows="2" />
                     <div className="flex gap-2">
                       <button onClick={()=>guardarNota(item.key)} className="text-xs bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-lg font-bold shadow-sm transition-colors">Guardar</button>
                       <button onClick={()=>setNotaActiva(null)} className="text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white px-3 py-1.5 rounded-lg font-bold transition-colors">Cancelar</button>
                     </div>
                   </div>
                 ) : puedeEditar && !item.nota && (
                   <button onClick={()=>{setNotaActiva(item.key); setTextoNota('');}} className="text-xs text-slate-400 hover:text-amber-600 flex items-center gap-1 font-semibold transition-colors"><MessageSquare size={14}/> Agregar nota / observación</button>
                 )}
               </td>
             </tr>
           ))}
         </tbody>
      </table>
    </div>
  );
}

function SubPanelMovimientos({ movimientos, stock, db, appId, loggear, perfil, catalogo, esRecepcion, dialogs }) {
  const [modalType, setModalType] = useState(null); 
  
  const aprobarTransferencia = async (mov) => {
    dialogs.confirm("¿Confirmas que recibiste físicamente estas cantidades exactas en el Almacén de Recepción?", async () => {
      try {
        const stockRef = doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'stock');
        let currentStock = { ...stock };
        
        Object.entries(mov.items).forEach(([key, qty]) => {
           let actualEnv = typeof currentStock[key] === 'object' ? currentStock[key].envios : (currentStock[key]||0);
           let actualRec = typeof currentStock[key] === 'object' ? currentStock[key].recepcion : 0;
           currentStock[key] = { envios: actualEnv, recepcion: actualRec + qty };
        });
        await setDoc(stockRef, currentStock);
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'movimientos', mov.id), { status: 'COMPLETADO', fechaAprobacion: Date.now(), aprobadoPor: perfil.nombre });
        loggear('TRANSFERENCIA_APROBADA', `Recepción aprobó entrada de transferencia enviada por ${mov.creadoPor}`);
      } catch(e) { console.error(e); }
    }, "Aprobar Recepción");
  };

  return (
    <div>
      <div className="flex flex-wrap gap-4 mb-8">
        <button onClick={()=>setModalType('INGRESO')} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl shadow-md flex items-center gap-2 transition-all hover:-translate-y-0.5"><PlusCircle size={18}/> Cargar Ingreso (Proveedor)</button>
        <button onClick={()=>setModalType('TRANSFERENCIA')} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-xl shadow-md flex items-center gap-2 transition-all hover:-translate-y-0.5"><ArrowRightLeft size={18}/> Enviar a Recepción</button>
      </div>

      <h3 className="font-black text-slate-800 dark:text-slate-100 mb-4 text-lg">Historial de Operaciones</h3>
      <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
        <table className="w-full text-left text-sm border-collapse">
          <thead><tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400"><th className="p-4 border-b dark:border-slate-700 font-bold">Fecha / Origen</th><th className="p-4 border-b dark:border-slate-700 font-bold">Tipo y Destino</th><th className="p-4 border-b dark:border-slate-700 font-bold">Productos</th><th className="p-4 border-b dark:border-slate-700 font-bold">Soporte Visual</th><th className="p-4 border-b dark:border-slate-700 font-bold text-right">Estatus</th></tr></thead>
          <tbody>
            {movimientos.length === 0 ? <tr><td colSpan="5" className="p-8 text-center text-slate-400 italic">No hay movimientos registrados.</td></tr> : movimientos.map(m => (
              <tr key={m.id} className="border-b border-slate-50 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="p-4">
                  <div className="font-bold text-slate-800 dark:text-slate-100 text-base">{new Date(m.fechaCreacion).toLocaleString()}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Generado por: <span className="font-semibold text-slate-700 dark:text-slate-300">{m.creadoPor}</span></div>
                </td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-md text-[10px] font-black tracking-widest uppercase border ${m.tipo === 'INGRESO' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' : 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800'}`}>{m.tipo}</span>
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1">Hacia: <span className="text-slate-800 dark:text-slate-200">Almacén {m.destino}</span></div>
                </td>
                <td className="p-4 text-sm font-medium text-slate-700 dark:text-slate-300 bg-[#f0f4f8] dark:bg-slate-900 border border-slate-100 dark:border-slate-700 m-2 rounded-lg shadow-sm">
                  {Object.entries(m.items).map(([k,q]) => <div key={k} className="flex gap-2 mb-1"><span className="font-bold text-slate-800 dark:text-slate-100">{q}x</span> <span>{k.replace('|', ' ')}</span></div>)}
                </td>
                <td className="p-4">
                  {m.foto ? <a href={m.foto} target="_blank" rel="noreferrer" className="text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30 px-3 py-1.5 rounded-lg font-bold text-xs flex items-center w-max gap-1.5 hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors"><ImageIcon size={14}/> Ver Evidencia</a> : <span className="text-slate-400 text-xs italic">Sin respaldo</span>}
                </td>
                <td className="p-4 text-right">
                  {m.status === 'COMPLETADO' ? (
                    <div className="text-emerald-600 dark:text-emerald-400 font-bold flex flex-col items-end"><div className="flex items-center gap-1.5"><CheckCircle size={16}/> Aprobado</div>{m.aprobadoPor && <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-medium">Validado por {m.aprobadoPor}</div>}</div>
                  ) : (
                    <div className="flex flex-col items-end gap-2">
                      <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 px-3 py-1 rounded-md text-xs font-bold border border-amber-200 dark:border-amber-800">En Tránsito (Pendiente)</span>
                      {esRecepcion && <button onClick={()=>aprobarTransferencia(m)} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-4 py-2 rounded-lg font-bold shadow-md transition-colors mt-1">Aprobar Llegada</button>}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalType && <ModalCrearMovimiento tipo={modalType} catalogo={catalogo} stock={stock} db={db} appId={appId} loggear={loggear} perfil={perfil} dialogs={dialogs} onClose={()=>setModalType(null)} />}
    </div>
  );
}

function SubPanelCatalogo({ catalogo, db, appId, loggear, dialogs }) {
  const defaultForm = { categoria: '', nuevoCat: '', nombre: '', presentaciones: '', precios: '', imagen: '' };
  const [form, setForm] = useState(defaultForm);
  const [modoEdicion, setModoEdicion] = useState(null); 

  const cargarEdicion = (catNombre, prod) => {
    setForm({ 
      categoria: catNombre, 
      nuevoCat: '', 
      nombre: prod.nombre, 
      presentaciones: prod.presentaciones.join(', '), 
      precios: prod.precios ? prod.precios.join(', ') : '', 
      imagen: prod.imagen || '' 
    });
    setModoEdicion({ catOriginal: catNombre, nomOriginal: prod.nombre });
  };

  const cancelarEdicion = () => {
    setModoEdicion(null); setForm(defaultForm);
  };

  const eliminarProducto = (catNombre, prodNombre) => {
    dialogs.confirm(`¿Seguro que deseas eliminar ${prodNombre} del catálogo?\n\nNota: Esto no altera el stock físico, solo lo oculta del carrito de ventas.`, async () => {
      let newCatalogo = [...catalogo];
      let catIndex = newCatalogo.findIndex(c => c.categoria === catNombre);
      if(catIndex >= 0) {
         newCatalogo[catIndex].productos = newCatalogo[catIndex].productos.filter(p => p.nombre !== prodNombre);
         if(newCatalogo[catIndex].productos.length === 0) newCatalogo.splice(catIndex, 1);
         try {
           await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'catalogo'), { categorias: newCatalogo });
           loggear('CATALOGO_ELIMINADO', `Se eliminó el producto: ${prodNombre}`);
           dialogs.alert("Producto eliminado del catálogo web.", "Operación Exitosa");
         } catch(err) { console.error(err); }
      }
    }, "Eliminar Producto");
  };

  const guardarProducto = async (e) => {
    e.preventDefault();
    const catName = form.categoria === 'OTRA' ? form.nuevoCat : form.categoria;
    const presentacionesArr = form.presentaciones.split(',').map(s=>s.trim()).filter(Boolean);
    const preciosArr = form.precios ? form.precios.split(',').map(s=>parseFloat(s.trim()) || 0) : presentacionesArr.map(()=>0);
    
    if(!catName || !form.nombre || presentacionesArr.length === 0) return dialogs.alert("Por favor completa todos los campos requeridos.", "Información Incompleta");

    let newCatalogo = JSON.parse(JSON.stringify(catalogo)); 
    
    if (modoEdicion) {
      let oldCatIndex = newCatalogo.findIndex(c => c.categoria === modoEdicion.catOriginal);
      if(oldCatIndex >= 0) {
         newCatalogo[oldCatIndex].productos = newCatalogo[oldCatIndex].productos.filter(p => p.nombre !== modoEdicion.nomOriginal);
         if(newCatalogo[oldCatIndex].productos.length === 0) newCatalogo.splice(oldCatIndex, 1);
      }
    }

    let catIndex = newCatalogo.findIndex(c => c.categoria.toLowerCase() === catName.toLowerCase());
    const nuevoProd = { nombre: form.nombre, presentaciones: presentacionesArr, precios: preciosArr, imagen: form.imagen };

    if (catIndex >= 0) {
      newCatalogo[catIndex].productos.push(nuevoProd);
    } else {
      newCatalogo.push({ categoria: catName, productos: [nuevoProd] });
    }

    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'catalogo'), { categorias: newCatalogo });
      loggear('CATALOGO_ACTUALIZADO', `Se ${modoEdicion ? 'editó' : 'añadió'} el producto: ${form.nombre}`);
      dialogs.alert(`El producto ha sido ${modoEdicion ? 'actualizado' : 'añadido'} correctamente en la tienda.`, "Catálogo Actualizado");
      cancelarEdicion();
    } catch(err) { console.error(err); }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-inner">
        <h3 className="font-black text-xl text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2"><Package className="text-sky-600"/> {modoEdicion ? 'Editar Producto Seleccionado' : 'Añadir Nuevo Producto al Catálogo'}</h3>
        <form onSubmit={guardarProducto} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Categoría Principal</label>
            <select value={form.categoria} onChange={e=>setForm({...form, categoria: e.target.value})} className="p-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 outline-none focus:border-sky-500 font-bold text-slate-700 dark:text-slate-200 transition-colors" required>
              <option value="">Selecciona...</option>
              {catalogo.map(c => <option key={c.categoria} value={c.categoria}>{c.categoria}</option>)}
              <option value="OTRA">+ Crear Nueva Categoría</option>
            </select>
          </div>
          {form.categoria === 'OTRA' ? <Input label="Nombre de Nueva Categoría" value={form.nuevoCat} onChange={e=>setForm({...form, nuevoCat: e.target.value})} required/> : <div></div>}
          
          <Input label="Nombre del Producto" value={form.nombre} onChange={e=>setForm({...form, nombre: e.target.value})} placeholder="Ej: Tratamiento KeraBluher" required/>
          <Input label="Presentaciones (Separadas por coma)" value={form.presentaciones} onChange={e=>setForm({...form, presentaciones: e.target.value})} placeholder="Ej: 1 Litro, 500ml, 250ml" required/>
          <Input label="Precios en USD (Separados por coma en mismo orden)" value={form.precios} onChange={e=>setForm({...form, precios: e.target.value})} placeholder="Ej: 25, 15, 8" />
          <Input label="URL de Imagen (Opcional)" value={form.imagen} onChange={e=>setForm({...form, imagen: e.target.value})} placeholder="https://...imagen.jpg" />
          
          <div className="md:col-span-2 flex justify-end gap-3 mt-4">
            {modoEdicion && <button type="button" onClick={cancelarEdicion} className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-3 px-6 rounded-xl transition-colors">Cancelar Edición</button>}
            <button type="submit" className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 px-8 rounded-xl shadow-md transition-all hover:-translate-y-0.5">{modoEdicion ? 'Actualizar Producto' : 'Guardar Producto Nuevo'}</button>
          </div>
        </form>
      </div>

      <div className="bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-700">
        <h3 className="font-black text-xl text-slate-800 dark:text-slate-100 mb-4 px-2">Catálogo Web Actual</h3>
        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
          <table className="w-full text-left text-sm border-collapse">
            <thead><tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400"><th className="p-4 border-b dark:border-slate-700 font-bold tracking-wide">Categoría</th><th className="p-4 border-b dark:border-slate-700 font-bold tracking-wide">Producto, Presentaciones y Precio</th><th className="p-4 border-b dark:border-slate-700 font-bold tracking-wide text-right">Acciones</th></tr></thead>
            <tbody>
              {catalogo.map(c => c.productos.map(p => (
                <tr key={p.nombre} className="border-b border-slate-50 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-4 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-widest">{c.categoria}</td>
                  <td className="p-4">
                    <div className="font-bold text-slate-800 dark:text-slate-100 text-base">{p.nombre}</div>
                    <div className="flex flex-wrap gap-2 mt-2">
                       {p.presentaciones.map((pres, i) => (
                         <span key={pres} className="text-xs font-semibold bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 px-2 py-1 rounded">
                           {pres} {p.precios && p.precios[i] > 0 ? `($${p.precios[i]})` : ''}
                         </span>
                       ))}
                    </div>
                  </td>
                  <td className="p-4 flex justify-end gap-2">
                     <button onClick={()=>cargarEdicion(c.categoria, p)} className="text-sky-600 bg-sky-50 dark:bg-sky-900/30 dark:text-sky-400 p-2.5 rounded-lg hover:bg-sky-100 dark:hover:bg-sky-900 transition-colors" title="Editar Producto"><Edit3 size={18}/></button>
                     <button onClick={()=>eliminarProducto(c.categoria, p.nombre)} className="text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400 p-2.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900 transition-colors" title="Eliminar del Catálogo"><Trash2 size={18}/></button>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ModalCrearMovimiento({ tipo, catalogo, stock, db, appId, loggear, perfil, dialogs, onClose }) {
  const [carrito, setCarrito] = useState({});
  const [fotoUrl, setFotoUrl] = useState('');
  const isTransfer = tipo === 'TRANSFERENCIA';

  const updateQty = (key, delta) => {
    setCarrito(prev => {
      const actual = prev[key] || 0;
      const nuevo = Math.max(0, actual + delta);
      
      if (isTransfer && delta > 0) {
        let maxDisp = typeof stock[key] === 'object' ? stock[key].envios : (stock[key]||0);
        if (nuevo > maxDisp) return prev; 
      }

      if (nuevo === 0) { const copia = { ...prev }; delete copia[key]; return copia; }
      return { ...prev, [key]: nuevo };
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!URL_GOOGLE_SCRIPT) {
        dialogs.alert("⚠️ Falta configurar el puente de Google Drive. Por ahora, debes tomar la foto, subirla a drive y pegar el enlace manualmente.", "Configuración Faltante");
        return;
    }

    try {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = async () => {
            const base64Data = reader.result.split(',')[1];
            
            const response = await fetch(URL_GOOGLE_SCRIPT, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    fileName: `Movimiento_${Date.now()}.jpg`,
                    mimeType: file.type,
                    data: base64Data
                })
            });

            const result = await response.json();
            if (result.url) {
                setFotoUrl(result.url);
            } else {
                throw new Error("No se recibió URL válida");
            }
        };
    } catch (error) {
        console.error(error);
        dialogs.alert("Error subiendo la foto a Drive. Revisa tu conexión.", "Fallo de Red");
    }
  };

  const handleSubmit = async () => {
    if (Object.keys(carrito).length === 0) return dialogs.alert("No has seleccionado ningún producto para el movimiento.", "Carrito Vacío");
    if (isTransfer && !fotoUrl) return dialogs.alert("Debes incluir una foto como soporte físico para enviar a Recepción.", "Soporte Obligatorio");
    
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'movimientos'), {
        tipo, origen: isTransfer ? 'ENVIOS' : 'PROVEEDOR', destino: isTransfer ? 'RECEPCION' : 'ENVIOS',
        items: carrito, foto: fotoUrl, status: isTransfer ? 'PENDIENTE' : 'COMPLETADO',
        fechaCreacion: Date.now(), creadoPor: perfil.nombre
      });

      const stockRef = doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'stock');
      let currentStock = { ...stock };

      Object.entries(carrito).forEach(([key, qty]) => {
         let actualEnv = typeof currentStock[key] === 'object' ? currentStock[key].envios : (currentStock[key]||0);
         let actualRec = typeof currentStock[key] === 'object' ? currentStock[key].recepcion : 0;
         
         if (tipo === 'INGRESO') {
           currentStock[key] = { envios: actualEnv + qty, recepcion: actualRec };
         } else if (tipo === 'TRANSFERENCIA') {
           currentStock[key] = { envios: actualEnv - qty, recepcion: actualRec };
         }
      });
      await setDoc(stockRef, currentStock);

      loggear(`MOVIMIENTO_${tipo}`, `${perfil.nombre} generó un(a) ${tipo} de ${Object.keys(carrito).length} items.`);
      dialogs.alert(`La operación de ${tipo} fue registrada exitosamente en el sistema.`, "Movimiento Procesado"); 
      onClose();
    } catch(e) { console.error(e); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[80] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700">
        <div className="px-8 py-6 border-b dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800">
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">{isTransfer ? <><ArrowRightLeft className="text-purple-600"/> Transferir a Recepción</> : <><PlusCircle className="text-emerald-600"/> Cargar Ingreso Proveedor</>}</h2>
          <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors"><X size={24} className="text-slate-500 dark:text-slate-400"/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-[#f8fafc] dark:bg-slate-900 grid grid-cols-1 md:grid-cols-2 gap-6">
          {catalogo.map(cat => (
            <div key={cat.categoria} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <h3 className="font-bold text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700 pb-2 mb-4">{cat.categoria}</h3>
              {cat.productos.map(prod => (
                <div key={prod.nombre} className="mb-4">
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">{prod.nombre}</div>
                  {prod.presentaciones.map(pres => {
                    const key = `${prod.nombre}|${pres}`; const qty = carrito[key] || 0;
                    let maxDisp = typeof stock[key] === 'object' ? stock[key].envios : (stock[key]||0);
                    return (
                      <div key={pres} className="flex justify-between items-center text-sm py-2 border-b border-slate-50 dark:border-slate-700/50">
                        <span className="font-medium text-slate-600 dark:text-slate-400">{pres} {isTransfer && <span className="text-[10px] font-bold text-sky-600 bg-sky-50 dark:bg-sky-900/30 dark:text-sky-400 px-1.5 py-0.5 rounded ml-1 tracking-widest uppercase">Disp: {maxDisp}</span>}</span>
                        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1 rounded-lg">
                          <button onClick={()=>updateQty(key, -1)} className="bg-white dark:bg-slate-800 px-2 py-1 rounded text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white font-bold shadow-sm">-</button>
                          <span className="w-6 text-center font-black text-slate-800 dark:text-white">{qty}</span>
                          <button onClick={()=>updateQty(key, 1)} className="bg-white dark:bg-slate-800 px-2 py-1 rounded text-sky-600 dark:text-sky-400 hover:text-sky-800 font-bold shadow-sm">+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="p-6 border-t dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col gap-6">
          {isTransfer && (
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 border border-purple-100 dark:border-purple-800 rounded-2xl flex items-center gap-4">
              <div className="flex-1">
                <label className="text-xs font-bold uppercase tracking-widest text-purple-800 dark:text-purple-400 block mb-2">Evidencia Fotográfica Obligatoria</label>
                <div className="flex gap-3 relative">
                  <input type="text" placeholder="URL Foto de los productos empacados" className="w-full border-2 border-purple-200 dark:border-purple-800 p-3 rounded-xl text-sm outline-none focus:border-purple-500 bg-white dark:bg-slate-900 dark:text-white font-medium" value={fotoUrl} onChange={e=>setFotoUrl(e.target.value)} />
                  <label className="bg-purple-600 text-white p-3 rounded-xl cursor-pointer hover:bg-purple-700 flex items-center justify-center w-12 shadow-md transition-colors">
                    <Camera size={20}/> <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-between items-center">
            <div className="font-bold text-slate-500 dark:text-slate-400 text-lg">Total de Items: <span className="text-2xl text-slate-800 dark:text-white ml-2">{Object.values(carrito).reduce((a,b)=>a+b,0)}</span></div>
            <button onClick={handleSubmit} className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg transition-all hover:-translate-y-0.5 text-lg">{isTransfer ? 'Confirmar Transferencia' : 'Aprobar Ingreso Stock'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PanelReportes({ pedidos, catalogo, stock }) {
  const totalVal = useMemo(() => {
    let t = 0;
    Object.entries(stock).forEach(([key, val]) => {
      const c = typeof val === 'object' ? val.envios : val;
      if (c > 0) {
        const [n, pr] = key.split('|');
        catalogo.forEach(cat => cat.productos.forEach(p => { if(p.nombre === n){ const i = p.presentaciones.indexOf(pr); if(i >= 0) t += (c * p.precios[i]); } }));
      }
    });
    return t;
  }, [stock, catalogo]);
  
  const validados = pedidos.filter(p => p.status !== 'Rechazado' && !p.esPublico);
  const sobrantes = validados.reduce((acc, curr) => acc + (curr.sobranteUsd || 0), 0);
  const descuentos = validados.reduce((acc, curr) => acc + (curr.descuentoPorcentaje ? ((curr.montoUsd/(1-curr.descuentoPorcentaje/100)) * (curr.descuentoPorcentaje/100)) : 0), 0);
  const totalUSD = validados.reduce((acc, curr) => acc + (curr.montoUsd || 0), 0) - sobrantes;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
       <div className="bg-emerald-600 text-white p-10 rounded-[2.5rem] shadow-2xl flex items-center justify-between transition-transform hover:scale-105 border-b-8 border-emerald-800">
          <div>
            <div className="text-xs uppercase font-black tracking-widest opacity-60 mb-1">Cierre Neto Ventas</div>
            <div className="text-5xl font-black">${totalUSD.toFixed(2)}</div>
            {(sobrantes > 0 || descuentos > 0) && <div className="text-xs mt-2 opacity-70 font-bold">Restado: ${sobrantes} Sobrante | ${descuentos.toFixed(2)} Desc.</div>}
          </div>
          <DollarSign size={60} className="opacity-20"/>
       </div>
       <div className="bg-purple-600 text-white p-10 rounded-[2.5rem] shadow-2xl flex items-center justify-between transition-transform hover:scale-105 border-b-8 border-purple-800">
          <div>
            <div className="text-xs uppercase font-black tracking-widest opacity-60 mb-1">Valorización de Almacén</div>
            <div className="text-5xl font-black">${totalVal.toFixed(2)}</div>
          </div>
          <Archive size={60} className="opacity-20"/>
       </div>
    </div>
  );
}

// --- UTILS ---
function Input({ label, ...props }) { return (<div className="flex flex-col"><label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 ml-2 dark:text-slate-400 transition-colors">{label}</label><input className="p-3.5 border-2 border-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-2xl focus:border-sky-500 outline-none font-bold transition-all shadow-sm" {...props}/></div>); }
function InputDark({ label, ...props }) { return (<div className="flex flex-col"><label className="text-[10px] font-black uppercase text-slate-300 mb-1.5 ml-2 transition-colors">{label}</label><input className="p-3.5 border-2 border-slate-700 bg-slate-800 text-white rounded-2xl focus:border-sky-400 outline-none font-bold transition-all shadow-inner disabled:opacity-50" {...props}/></div>); }
function StatusBadge({ status }) { const b = { 'Pendiente': 'bg-amber-100 text-amber-700 border-amber-200', 'Validado': 'bg-sky-100 text-sky-700 border-sky-200', 'Despachado': 'bg-emerald-100 text-emerald-700 border-emerald-200', 'En Espera (Sin Stock)': 'bg-orange-100 text-orange-700 border-orange-200', 'Por Pagar / Cotización': 'bg-purple-100 text-purple-700 border-purple-200' }; return <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase border ${b[status] || 'bg-slate-100 text-slate-600'}`}>{status}</span>; }
function TabButton({ active, onClick, icon, label, badge, badgeColor }) { return (<button onClick={onClick} className={`flex items-center justify-between w-full p-4 rounded-2xl font-black transition-all ${active ? 'bg-sky-600 text-white shadow-xl scale-105' : 'text-sky-100/60 dark:text-slate-400 hover:bg-sky-900/40 dark:hover:bg-slate-800/80 hover:text-white'}`}><div className="flex items-center gap-3">{icon} <span className="hidden md:inline text-xs uppercase tracking-widest">{label}</span></div> {badge > 0 && <span className={`${badgeColor || 'bg-red-500'} text-white text-[9px] px-2 py-0.5 rounded-full font-bold shadow-lg`}>{badge}</span>}</button>); }
function VistaImpresion({ pedidos }) { return <div className="hidden"></div>; }