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
  ChevronDown, ChevronUp, MessageCircle, ArrowRightLeft, PlusCircle, Trash2, Moon, Sun, Store, Link, Gift, CheckSquare2, Percent
} from 'lucide-react';

// --- CONFIGURACIÓN DE MARCA BLUEHER ---
const BRAND_LOGO = "logobluher.jpg"; 

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
const appId = typeof __app_id !== 'undefined' ? __app_id : 'app-bluher-official';

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
  { categoria: "Cirugías Capilares", productos: [ { nombre: "Cirugía Clásica", presentaciones: ["Litro", "1/2 Litro", "Galón"], precios: [25, 15, 80] }, { nombre: "Cirugía Chocolate", presentaciones: ["Litro", "1/2 Litro", "Galón"], precios: [25, 15, 80] } ] },
  { categoria: "Alisados", productos: [ { nombre: "Alisado Clásico", presentaciones: ["1 Litro", "300ml"], precios: [30, 12] }, { nombre: "Alisado Chocolate", presentaciones: ["1 Litro", "300ml"], precios: [30, 12] } ] },
  { categoria: "Boosters y Terapias", productos: [ { nombre: "Booster de Hidratacion", presentaciones: ["Unidad"], precios: [5] }, { nombre: "Booster de Reparacion", presentaciones: ["Unidad"], precios: [5] }, { nombre: "Terapia Antifrizz", presentaciones: ["500gr"], precios: [20] } ] },
  { categoria: "Complementos Automáticos", productos: [ { nombre: "Concentrado", presentaciones: ["Unidad"], precios: [0] } ] }
];

// ==========================================
// SISTEMA DE MODALES GLOBALES
// ==========================================
function GlobalDialog({ config, setConfig }) {
  const [inputValue, setInputValue] = useState('');
  useEffect(() => { if(config?.type === 'prompt') setInputValue(''); }, [config]);
  if (!config) return null;
  const handleConfirm = () => { if (config.onConfirm) { if (config.type === 'prompt') config.onConfirm(inputValue); else config.onConfirm(); } setConfig(null); };
  const handleCancel = () => setConfig(null);
  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
       <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-8 border border-slate-200 dark:border-slate-700 transition-colors animate-in zoom-in-95">
         <div className="flex items-center gap-4 mb-4">
           {config.type === 'alert' ? <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-full"><AlertTriangle size={28}/></div> : <div className="p-3 bg-sky-100 dark:bg-sky-900/30 text-sky-600 rounded-full"><CheckCircle size={28}/></div>}
           <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">{config.title}</h3>
         </div>
         <p className="text-slate-600 dark:text-slate-300 mb-8 whitespace-pre-wrap font-medium">{config.message}</p>
         {config.type === 'prompt' && (
           <input autoFocus type="text" className="w-full p-4 border-2 border-slate-200 dark:border-slate-600 rounded-xl mb-8 outline-none focus:ring-2 focus:ring-sky-500 font-medium text-slate-800 dark:text-white bg-[#f0f4f8] dark:bg-slate-700" value={inputValue} onChange={e=>setInputValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleConfirm()} />
         )}
         <div className="flex justify-end gap-3">
           {config.type !== 'alert' && <button onClick={handleCancel} className="px-6 py-3 rounded-xl text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-700">Cancelar</button>}
           <button onClick={handleConfirm} className="px-6 py-3 rounded-xl bg-sky-600 text-white font-bold shadow-lg hover:bg-sky-700">Confirmar</button>
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
  const [configGral, setConfigGral] = useState({ tasaDia: 1 });
  const [logs, setLogs] = useState([]);

  const [activeTab, setActiveTab] = useState('ventas');
  const [darkMode, setDarkMode] = useState(false);
  const [isPublicRoute, setIsPublicRoute] = useState(window.location.hash === '#tienda');

  const [dialogConfig, setDialogConfig] = useState(null);
  const dialogs = useMemo(() => ({
    alert: (msg, title) => setDialogConfig({ type: 'alert', message: msg, title: title || "Bluher" }),
    confirm: (msg, onConfirm, title) => setDialogConfig({ type: 'confirm', message: msg, title: title || "Confirmación", onConfirm }),
    prompt: (msg, onConfirm, title) => setDialogConfig({ type: 'prompt', message: msg, title: title || "Entrada de Datos", onConfirm })
  }), []);

  // --- MODO OSCURO GLOBAL ---
  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  useEffect(() => {
    const handleHashChange = () => setIsPublicRoute(window.location.hash === '#tienda');
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // --- AUTH (RULE 3) ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) { console.error("Auth error", error); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) { setUserProfile(null); setAuthLoading(false); }
    });
    return () => unsubscribe();
  }, []);

  // Perfil y Listeners
  useEffect(() => {
    if (!user) return;
    const unsubs = [];
    const onError = (e) => console.error("Firestore Error:", e);

    // Profile listener
    const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid);
    unsubs.push(onSnapshot(userRef, (snap) => {
      if (snap.exists()) setUserProfile(snap.data());
      else if (!user.isAnonymous) {
        const p = { uid: user.uid, email: user.email, nombre: user.displayName || 'Personal', role: 'Pendiente', isApproved: false, isOnline: true, fechaRegistro: Date.now() };
        setDoc(userRef, p);
        setUserProfile(p);
      }
      setAuthLoading(false);
    }));

    // Data General (Gated by Auth)
    unsubs.push(onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'general'), (s) => s.exists() && setConfigGral(s.data()), onError));
    unsubs.push(onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'catalogo'), (s) => s.exists() && setCatalogo(s.data().categorias || DEFAULT_CATALOGO), onError));
    unsubs.push(onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'stock'), (s) => s.exists() && setStockInventario(s.data()), onError));

    if (userProfile?.isApproved) {
      unsubs.push(onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'pedidos'), (snap) => setPedidos(snap.docs.map(d => ({ id: d.id, ...d.data() }))), onError));
      unsubs.push(onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'notas'), (s) => s.exists() && setNotasInventario(s.data()), onError));
      unsubs.push(onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'movimientos'), (snap) => setMovimientos(snap.docs.map(d => ({ id: d.id, ...d.data() }))), onError));

      if ([ROLES.ADMIN, ROLES.AUDITOR_GENERAL].includes(userProfile?.role)) {
        unsubs.push(onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'users'), (snap) => setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() }))), onError));
        unsubs.push(onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'logs'), (snap) => setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b)=>b.fecha-a.fecha)), onError));
      }
    }

    return () => unsubs.forEach(u => u());
  }, [user, userProfile?.isApproved]);

  const signInGoogle = async () => {
    try { setAuthLoading(true); await signInWithPopup(auth, googleProvider); } 
    catch (e) { dialogs.alert("Error de conexión."); setAuthLoading(false); }
  };

  const cerrarSesion = async () => {
    if (userProfile && user) { try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), { isOnline: false }); } catch(e) {} }
    signOut(auth);
  };

  const loggear = async (accion, detalle) => {
    if (!userProfile) return;
    try { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'logs'), { accion, detalle, usuarioEmail: userProfile.email, usuarioNombre: userProfile.nombre, usuarioRol: userProfile.role, fecha: Date.now() }); } catch (e) {}
  };

  const cambiarEstadoPedido = async (id, nuevoEstado) => {
    try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', id), { status: nuevoEstado }); loggear('ESTADO_ACTUALIZADO', `Pedido ${id} -> ${nuevoEstado}`); } catch (e) { dialogs.alert("Sin permisos."); }
  };

  // --- VARIABLES DE PERMISOS ---
  const r_perm = userProfile?.role;
  const showVentas = [ROLES.ADMIN, ROLES.VENTAS, ROLES.AUDITOR_VENTAS, ROLES.AUDITOR_GENERAL].includes(r_perm);
  const showAdmin = [ROLES.ADMIN, ROLES.ADMINISTRACION, ROLES.AUDITOR_VENTAS, ROLES.AUDITOR_GENERAL].includes(r_perm);
  const showDespacho = [ROLES.ADMIN, ROLES.DESPACHO, ROLES.AUDITOR_GENERAL].includes(r_perm);
  const showReportes = [ROLES.ADMIN, ROLES.AUDITOR_VENTAS, ROLES.AUDITOR_GENERAL, ROLES.ADMINISTRACION].includes(r_perm);
  const showInventario = [ROLES.ADMIN, ROLES.AUDITOR_INVENTARIO, ROLES.AUDITOR_GENERAL, ROLES.ADMINISTRACION].includes(r_perm); 
  const showUsuarios = [ROLES.ADMIN].includes(r_perm);
  const showLogs = [ROLES.ADMIN, ROLES.AUDITOR_GENERAL].includes(r_perm);

  // --- RENDER ---
  if (isPublicRoute) return <div className={darkMode ? 'dark' : ''}><PublicPortal catalogo={catalogo} stock={stockInventario} config={configGral} db={db} appId={appId} dialogs={dialogs} onBack={()=>window.location.hash=''} darkMode={darkMode} setDarkMode={setDarkMode}/><GlobalDialog config={dialogConfig} setConfig={setDialogConfig}/></div>;
  if (authLoading || (user && !userProfile && !user.isAnonymous)) return <div className="min-h-screen flex flex-col items-center justify-center bg-[#f0f4f8] dark:bg-slate-900 text-sky-800"><img src={BRAND_LOGO} className="h-24 mb-6 mix-blend-multiply dark:invert animate-pulse"/><Loader2 className="animate-spin" size={40}/></div>;

  if (!user || user.isAnonymous) return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#f0f4f8] to-[#d8e4f0] dark:from-slate-900 dark:to-slate-800 p-4 transition-colors">
        <div className="bg-white dark:bg-slate-800 p-10 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center border-t-[6px] border-sky-600 relative overflow-hidden">
          <img src={BRAND_LOGO} alt="Logo" className="h-24 mx-auto mb-8 mix-blend-multiply dark:invert" />
          <button onClick={signInGoogle} className="w-full bg-[#003366] text-white font-bold py-3.5 rounded-xl mb-4 shadow-lg hover:scale-[1.02] transition-transform">Ingresar Personal</button>
          <button onClick={() => window.location.hash = '#tienda'} className="w-full bg-white dark:bg-slate-700 text-sky-900 dark:text-slate-200 font-bold py-3.5 rounded-xl border border-sky-100 dark:border-slate-600 flex items-center justify-center gap-2 transition-colors"><Store size={18}/> Comprar Online</button>
        </div>
      </div>
      <GlobalDialog config={dialogConfig} setConfig={setDialogConfig} />
    </div>
  );

  if (userProfile && !userProfile.isApproved) return <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8] text-center p-6"><div className="bg-white p-12 rounded-[2rem] shadow-xl max-w-md w-full border-t-8 border-amber-500"><ShieldCheck size={60} className="mx-auto text-amber-500 mb-4"/> <h2 className="text-2xl font-black uppercase tracking-tighter">Verificación Pendiente</h2><p className="text-slate-500 mt-2 mb-8 font-medium">Estamos validando tu acceso a Bluher.</p><button onClick={cerrarSesion} className="text-sky-700 font-bold underline">Cerrar Sesión</button></div></div>;

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="flex flex-col md:flex-row min-h-screen bg-[#f0f4f8] dark:bg-slate-900 transition-colors">
        <aside className="w-full md:w-[280px] bg-[#003366] dark:bg-slate-950 text-slate-200 flex-shrink-0 flex flex-col h-screen sticky top-0 border-r border-sky-800 dark:border-slate-800">
          <div className="p-8 pb-4 flex flex-col items-center border-b border-sky-800/50 dark:border-slate-800/50 relative">
             <button onClick={() => setDarkMode(!darkMode)} className="absolute top-4 right-4 p-2 bg-sky-800/50 dark:bg-slate-800 rounded-full">{darkMode ? <Sun size={14}/> : <Moon size={14}/>}</button>
             <img src={BRAND_LOGO} alt="Logo" className="h-12 w-auto mb-6 invert dark:invert-0 brightness-200 dark:brightness-100" />
             <div className="w-full bg-sky-900/40 rounded-xl p-4 text-center">
                <div className="text-sm font-bold truncate">{user.displayName}</div>
                <div className="text-[10px] uppercase font-black text-sky-300 tracking-widest">{userProfile?.role}</div>
             </div>
          </div>
          <nav className="mt-6 flex-1 px-4 space-y-1.5 overflow-y-auto">
            {showVentas && <TabButton active={activeTab === 'ventas'} onClick={() => setActiveTab('ventas')} icon={<ShoppingCart size={18}/>} label="Ventas y Web" badge={pedidos.filter(p=>p.status==='Rechazado' || p.esPublico).length} />}
            {showAdmin && <TabButton active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} icon={<CheckSquare size={18}/>} label="Admin" badge={pedidos.filter(p=>p.status==='Pendiente').length} />}
            {showDespacho && <TabButton active={activeTab === 'despacho'} onClick={() => setActiveTab('despacho')} icon={<Truck size={18}/>} label="Despacho" badge={pedidos.filter(p=>p.status==='Validado').length} />}
            <div className="my-4 border-t border-sky-800/50"></div>
            {showReportes && <TabButton active={activeTab === 'reportes'} onClick={() => setActiveTab('reportes')} icon={<FileSpreadsheet size={18}/>} label="Reportes" />}
            {showInventario && <TabButton active={activeTab === 'inventario'} onClick={() => setActiveTab('inventario')} icon={<Archive size={18}/>} label="Inventario" />}
            {showUsuarios && <TabButton active={activeTab === 'usuarios'} onClick={() => setActiveTab('usuarios')} icon={<Users size={18}/>} label="Usuarios" />}
            {showLogs && <TabButton active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={<FileText size={18}/>} label="Auditoría" />}
          </nav>
          <div className="p-6 border-t border-sky-800/50"><button onClick={cerrarSesion} className="w-full py-3 bg-red-900/20 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"><LogOut size={16}/> Salir</button></div>
        </aside>
        <main className="flex-1 p-4 md:p-10 overflow-y-auto transition-colors">
          <div className="max-w-6xl mx-auto">
            {activeTab === 'ventas' && <PanelVentas perfil={userProfile} pedidos={pedidos} catalogo={catalogo} stock={stockInventario} config={configGral} db={db} appId={appId} dialogs={dialogs} cambiarEstadoPedido={cambiarEstadoPedido} />}
            {activeTab === 'admin' && <PanelAdmin perfil={userProfile} config={configGral} pedidos={pedidos} db={db} appId={appId} dialogs={dialogs} loggear={loggear}/>}
            {activeTab === 'despacho' && <PanelDespacho pedidos={pedidos} catalogo={catalogo} stock={stockInventario} db={db} appId={appId} dialogs={dialogs} />}
            {activeTab === 'reportes' && <PanelReportes pedidos={pedidos} catalogo={catalogo} stock={stockInventario} />}
            {activeTab === 'inventario' && <PanelInventario stock={stockInventario} notas={notasInventario} catalogo={catalogo} db={db} appId={appId} dialogs={dialogs} perfil={userProfile} />}
            {activeTab === 'usuarios' && <PanelUsuarios usuarios={usuarios} db={db} appId={appId} loggear={loggear} dialogs={dialogs} />}
            {activeTab === 'logs' && <PanelLogs logs={logs} />}
          </div>
        </main>
      </div>
      <GlobalDialog config={dialogConfig} setConfig={setDialogConfig} />
    </div>
  );
}

// ==========================================
// SUBCOMPONENTES
// ==========================================

function PanelVentas({ perfil, pedidos, catalogo, stock, config, db, appId, dialogs, cambiarEstadoPedido }) {
  const [vista, setVista] = useState('nuevo');
  const defaultForm = { clienteNombre: '', clienteCedula: '', clienteTelefono: '', courier: 'ZOOM', direccion: '', productos: '', carritoObj: null, asesora: perfil?.nombre || '', referencia: '', moneda: 'USD', montoPago: '0', tasa: config.tasaDia || '1', esRegalo: false, descuentoPorcentaje: '0', pagoAdicional: '', refAdicional: '' };
  const [formData, setFormData] = useState(defaultForm);
  const [editId, setEditId] = useState(null);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);

  const enEspera = pedidos.filter(p => p.status === 'En Espera (Sin Stock)');
  const pedidosWeb = pedidos.filter(p => p.esPublico && p.status === 'Por Pagar / Cotización');

  useEffect(() => {
    if (!formData.carritoObj) return;
    let sub = 0;
    Object.entries(formData.carritoObj).forEach(([key, qty]) => {
      const [n, p] = key.split('|');
      catalogo.forEach(cat => cat.productos.forEach(prod => { if(prod.nombre===n){ const i=prod.presentaciones.indexOf(p); sub += (prod.precios[i]*q); }}));
    });
    const d = parseFloat(formData.descuentoPorcentaje) || 0;
    setFormData(prev => ({ ...prev, montoPago: (sub * (1 - d/100)).toFixed(2), tasa: prev.tasa || config.tasaDia }));
  }, [formData.carritoObj, formData.descuentoPorcentaje, config.tasaDia, catalogo]);

  const procesarVenta = async (st = 'Pendiente') => {
    const usd = formData.esRegalo ? 0 : parseFloat(formData.montoPago);
    const extraUsd = parseFloat(formData.pagoAdicional) || 0;
    const tasa = parseFloat(formData.tasa);
    try {
      const p = { ...formData, montoUsd: usd + extraUsd, montoVes: (usd + extraUsd) * tasa, tasaAplicada: tasa, status: st, fechaCreacion: Date.now(), esPublico: false };
      if (editId) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', editId), p);
      else await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'pedidos'), p);
      setFormData(defaultForm); setEditId(null); setVista('historial'); dialogs.alert("Venta registrada.");
    } catch(e) { dialogs.alert("Error."); }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    let sinStock = false;
    Object.entries(formData.carritoObj || {}).forEach(([k,q]) => {
       const disp = typeof stock[k] === 'object' ? stock[k].envios : (stock[k]||0);
       if (q > disp) sinStock = true;
    });
    if (sinStock) dialogs.confirm("Sin stock. ¿Enviar a espera?", () => procesarVenta('En Espera (Sin Stock)'));
    else procesarVenta('Pendiente');
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border dark:border-slate-700 transition-colors shadow-sm">
      <div className="flex gap-4 mb-8 border-b dark:border-slate-700 pb-2 overflow-x-auto">
        <button onClick={() => setVista('nuevo')} className={`pb-3 font-black text-xs uppercase tracking-widest ${vista === 'nuevo' ? 'text-sky-600 border-b-2 border-sky-600' : 'text-slate-400'}`}>Registrar</button>
        <button onClick={() => setVista('historial')} className={`pb-3 font-black text-xs uppercase tracking-widest ${vista === 'historial' ? 'text-sky-600 border-b-2 border-sky-600' : 'text-slate-400'}`}>Historial</button>
        <button onClick={() => setVista('espera')} className={`pb-3 font-black text-xs uppercase tracking-widest ${vista === 'espera' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-400'}`}>Espera ({enEspera.length})</button>
        <button onClick={() => setVista('web')} className={`pb-3 font-black text-xs uppercase tracking-widest ${vista === 'web' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-slate-400'}`}>Web ({pedidosWeb.length})</button>
      </div>

      {vista === 'nuevo' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input label="Cliente" value={formData.clienteNombre} onChange={e=>setFormData({...formData, clienteNombre: e.target.value})} required />
          <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border dark:border-slate-700">
            <button type="button" onClick={()=>setIsCatalogOpen(true)} className="bg-sky-600 text-white px-6 py-2 rounded-xl font-bold mb-4 shadow-lg flex items-center gap-2 transition-all hover:bg-sky-700"><Package size={18}/> Catálogo Bluher</button>
            <div className="text-sm italic opacity-70 whitespace-pre-wrap">{formData.productos || 'Carrito vacío...'}</div>
          </div>
          {formData.status === 'Rechazado' && (
             <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-2xl border border-red-200 dark:border-red-800 space-y-4 animate-pulse">
                <div className="font-bold text-red-600">⚠️ Faltante: Agregue el pago adicional</div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Monto adicional $" value={formData.pagoAdicional} onChange={e=>setFormData({...formData, pagoAdicional: e.target.value})} />
                  <Input label="Referencia Adicional" value={formData.refAdicional} onChange={e=>setFormData({...formData, refAdicional: e.target.value})} />
                </div>
             </div>
          )}
          <div className="bg-[#003366] text-white p-8 rounded-3xl grid grid-cols-1 md:grid-cols-4 gap-6">
             <div className="flex items-center gap-2 md:col-span-4"><input type="checkbox" checked={formData.esRegalo} onChange={e=>setFormData({...formData, esRegalo: e.target.checked})} className="w-5 h-5 accent-sky-400" /><label className="font-bold text-sky-200">Es Regalo VIP (Monto $0)</label></div>
             <InputDark label="Total $" value={formData.montoPago} onChange={e=>setFormData({...formData, montoPago: e.target.value})} disabled={formData.esRegalo} />
             <InputDark label="Descuento %" type="number" value={formData.descuentoPorcentaje} onChange={e=>setFormData({...formData, descuentoPorcentaje: e.target.value})} disabled={formData.esRegalo} />
             <InputDark label="Tasa" value={formData.tasa} onChange={e=>setFormData({...formData, tasa: e.target.value})} disabled={formData.esRegalo} />
             <InputDark label="Referencia" value={formData.referencia} onChange={e=>setFormData({...formData, referencia: e.target.value})} required={!formData.esRegalo} />
          </div>
          <button type="submit" className="w-full py-4 bg-sky-600 text-white font-black rounded-2xl shadow-xl hover:bg-sky-700 uppercase tracking-widest transition-all">Registrar Venta</button>
        </form>
      )}

      {vista === 'web' && (
         <div className="space-y-4">
            {pedidosWeb.map(p=>(
              <div key={p.id} className="p-6 border dark:border-slate-700 bg-white dark:bg-slate-900 rounded-3xl flex justify-between items-center shadow-sm">
                <div><div className="font-black text-lg">{p.clienteNombre}</div><div className="text-emerald-600 font-bold text-sm">${p.montoUsd}</div></div>
                <div className="flex gap-2">
                  <button onClick={()=>{setFormData({...p, montoPago: p.montoUsd.toString(), tasa: p.tasaAplicada.toString()}); setEditId(p.id); setVista('nuevo');}} className="bg-sky-600 text-white px-5 py-2 rounded-xl font-bold text-xs shadow transition-all hover:bg-sky-700">Validar</button>
                  <button onClick={()=>updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', p.id), {status:'En Espera (Sin Stock)'})} className="bg-amber-500 text-white px-5 py-2 rounded-xl font-bold text-xs shadow transition-all hover:bg-amber-600">Espera</button>
                </div>
              </div>
            ))}
         </div>
      )}

      {vista === 'espera' && (
         <div className="space-y-4">
            {enEspera.map(p=>(
              <div key={p.id} className="p-5 border dark:border-slate-700 bg-amber-50/50 dark:bg-amber-900/10 rounded-xl flex justify-between items-center transition-colors">
                 <div><div className="font-bold">{p.clienteNombre}</div><div className="text-xs opacity-60">Desde {new Date(p.fechaCreacion).toLocaleDateString()}</div></div>
                 <button onClick={()=>updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', p.id), {status:'Pendiente'})} className="bg-sky-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow">Retomar</button>
              </div>
            ))}
         </div>
      )}

      <ModalCatalogo catalogo={catalogo} stock={stock} isOpen={isCatalogOpen} onClose={()=>setIsCatalogOpen(false)} dialogs={dialogs} onConfirm={(txt, obj)=> { setFormData(prev => ({...prev, productos: txt, carritoObj: obj })); setIsCatalogOpen(false); }} />
    </div>
  );
}

function PanelAdmin({ perfil, config, pedidos, db, appId, dialogs, loggear }) {
  const esAdmin = [ROLES.ADMIN, ROLES.ADMINISTRACION].includes(perfil?.role);
  const pendientes = pedidos.filter(p=>p.status==='Pendiente');
  const actualizarTasa = async () => { dialogs.prompt("Tasa Bs/$:", async (nt) => { const n = parseFloat(nt); if (!isNaN(n) && n > 0) { await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'general'), { tasaDia: n }); loggear('TASA_CAMBIADA', `Nueva tasa a ${n}`); } }, "Ajuste de Tasa"); };
  
  const validarPago = async (p) => {
    dialogs.prompt("¿Dinero SOBRANTE del cliente? (En dólares $ o deja 0):", async (v) => {
      const s = parseFloat(v) || 0;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', p.id), { status: 'Validado', sobranteUsd: s });
      dialogs.alert("Aprobado.");
    }, "Validación");
  };

  return (
    <div className="space-y-6">
       <div className="bg-[#003366] text-white p-10 rounded-[2rem] flex justify-between items-center border-4 border-sky-400/20 shadow-xl transition-all">
          <div><div className="text-xs font-black uppercase opacity-60 mb-1">Tasa Oficial</div><h2 className="text-5xl font-black tracking-tighter">{config.tasaDia} Bs/$</h2></div>
          {esAdmin && <button onClick={actualizarTasa} className="bg-sky-500 px-8 py-4 rounded-2xl font-black shadow-lg hover:bg-sky-400 transition-colors">Cambiar Tasa</button>}
       </div>
       <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border dark:border-slate-700 transition-colors">
          <h3 className="font-black text-xl mb-4">Pagos por Validar ({pendientes.length})</h3>
          <div className="space-y-4">
             {pendientes.map(p=>(
               <div key={p.id} className="p-4 border-b dark:border-slate-700 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-900 transition-all rounded-xl">
                 <div><div className="font-bold text-lg">{p.clienteNombre}</div><div className="text-xs opacity-60">Ref: {p.referencia}</div></div>
                 <div className="text-right flex items-center gap-6"><div className="font-black text-xl text-sky-600">${p.montoUsd}</div><button onClick={()=>validarPago(p)} className="bg-emerald-600 text-white px-5 py-2 rounded-xl font-black text-xs shadow transition-colors hover:bg-emerald-700">Aprobar</button></div>
               </div>
             ))}
          </div>
       </div>
    </div>
  );
}

function PanelDespacho({ pedidos, catalogo, stock, db, appId }) {
  const [vista, setVista] = useState('pendientes');
  const [checked, setChecked] = useState({});
  const toggleCheck = (k) => setChecked({...checked, [k]: !checked[k]});
  const list = vista === 'pendientes' ? pedidos.filter(p=>p.status === 'Validado') : pedidos.filter(p=>p.status === 'Despachado');
  return (
    <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border dark:border-slate-700 transition-colors shadow-sm">
      <div className="flex gap-4 mb-8 border-b dark:border-slate-700 pb-2"><button onClick={()=>setVista('pendientes')} className={`pb-2 font-black text-xs uppercase tracking-widest ${vista==='pendientes'?'text-sky-600 border-b-2 border-sky-600':''}`}>Por Empacar</button><button onClick={()=>setVista('inventario')} className={`pb-2 font-black text-xs uppercase tracking-widest ${vista==='inventario'?'text-sky-600 border-b-2 border-sky-600':''}`}>Conteo Almacén</button></div>
      {vista === 'inventario' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {catalogo.map(c=>c.productos.map(p=>p.presentaciones.map(pr=>{
              const k = `${p.nombre}|${pr}`; const d = typeof stock[k] === 'object' ? stock[k].envios : (stock[k]||0);
              if (d <= 0) return null;
              return (<div key={k} onClick={()=>toggleCheck(k)} className={`p-5 rounded-2xl border-2 cursor-pointer flex justify-between items-center transition-all ${checked[k]?'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 opacity-60':'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-700'}`}><div className={checked[k]?'line-through opacity-50':''}>{p.nombre} ({pr})</div><div className="font-black text-2xl text-sky-600">{d}</div></div>);
           })))}
        </div>
      ) : (
        <div className="space-y-4">
           {list.map(p => (
             <div key={p.id} className="p-6 border-2 border-slate-100 dark:border-slate-700 rounded-3xl flex justify-between items-center bg-[#f8fafc] dark:bg-slate-900/50 shadow-sm">
                <div className="font-black text-lg">{p.clienteNombre} <span className="text-sky-600 text-xs font-black uppercase ml-2 bg-sky-100 dark:bg-sky-900 px-2 py-1 rounded-lg">{p.courier}</span></div>
                {p.status==='Validado' && <button onClick={()=>updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', p.id), {status:'Despachado'})} className="bg-sky-600 text-white px-8 py-3 rounded-2xl font-black shadow-lg hover:bg-sky-700 transition-colors">Marcar Empacado</button>}
             </div>
           ))}
        </div>
      )}
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
  const totalUSD = validados.reduce((acc, curr) => acc + (curr.montoUsd || 0), 0) - sobrantes;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
       <div className="bg-emerald-600 text-white p-10 rounded-[2.5rem] shadow-2xl flex items-center justify-between transition-transform hover:scale-105 border-b-8 border-emerald-800"><div><div className="text-xs uppercase font-black tracking-widest opacity-60 mb-1">Cierre de Ventas Neto</div><div className="text-5xl font-black">${totalUSD.toFixed(2)}</div>{sobrantes > 0 && <div className="text-[10px] mt-2 font-bold opacity-70">Sobrantes restados: ${sobrantes}</div>}</div><DollarSign size={60} className="opacity-20"/></div>
       <div className="bg-purple-600 text-white p-10 rounded-[2.5rem] shadow-2xl flex items-center justify-between transition-transform hover:scale-105 border-b-8 border-purple-800"><div><div className="text-xs uppercase font-black tracking-widest opacity-60 mb-1">Valorización de Almacén</div><div className="text-5xl font-black">${totalVal.toFixed(2)}</div></div><Archive size={60} className="opacity-20"/></div>
    </div>
  );
}

function PublicPortal({ catalogo, stock, config, db, appId, dialogs, onBack, darkMode, setDarkMode }) {
  const [f, setF] = useState({ clienteNombre: '', clienteTelefono: '', referencia: '', link: '', carrito: null, txt: '' });
  const [sub, setSub] = useState(false);
  const [total, setTotal] = useState(0);
  const [isCatOpen, setOpen] = useState(false);

  const upFile = async (e) => {
    const file = e.target.files[0]; if (!file) return; setSub(true);
    try {
      const reader = new FileReader(); reader.readAsDataURL(file);
      reader.onloadend = async () => {
        const res = await fetch(URL_GOOGLE_SCRIPT, { method: 'POST', body: JSON.stringify({ fileName: `PAGO_${Date.now()}.jpg`, mimeType: file.type, data: reader.result.split(',')[1] }) });
        const data = await res.json(); setF(prev => ({ ...prev, link: data.url })); setSub(false);
      };
    } catch(e) { setSub(false); dialogs.alert("Error de subida."); }
  };

  const send = async (e) => {
    e.preventDefault();
    if (!f.link) return dialogs.alert("La captura de pago es OBLIGATORIA.");
    try {
      const auth_curr = getAuth(); if (!auth_curr.currentUser) await signInAnonymously(auth_curr);
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'pedidos'), { ...f, montoUsd: total, status: 'Por Pagar / Cotización', esPublico: true, fechaCreacion: Date.now(), linkComprobantePago: f.link, tasaAplicada: config.tasaDia });
      dialogs.alert("¡Enviado! Una asesora procesará tu orden."); onBack();
    } catch(e) { dialogs.alert("Error de red."); }
  };

  return (
    <div className="min-h-screen bg-[#f0f4f8] dark:bg-slate-900 pb-20 transition-colors">
      <header className="bg-white dark:bg-slate-950 p-6 border-b dark:border-slate-800 flex justify-between items-center sticky top-0 z-50 shadow-sm transition-colors">
        <img src={BRAND_LOGO} alt="Logo" className="h-10 mix-blend-multiply dark:invert brightness-200 dark:brightness-100" />
        <button onClick={() => setDarkMode(!darkMode)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full shadow text-sky-600 transition-all">{darkMode ? <Sun/> : <Moon/>}</button>
      </header>
      <div className="max-w-xl mx-auto mt-10 p-10 bg-white dark:bg-slate-800 rounded-[3rem] shadow-2xl space-y-8 border dark:border-slate-700 transition-colors">
        <h1 className="text-3xl font-black text-center dark:text-white uppercase tracking-tighter">Pedido Bluher Online</h1>
        <div className="text-center p-6 bg-sky-50 dark:bg-sky-900/30 rounded-3xl border-2 border-sky-100 dark:border-sky-800 transition-colors"><div className="font-bold text-sky-600 text-xs mb-1 uppercase tracking-widest">Tasa del Día: {config.tasaDia} Bs/$</div><div className="text-4xl font-black text-slate-800 dark:text-white">${total.toFixed(2)}</div><div className="text-sky-600 font-bold">≈ {(total * config.tasaDia).toFixed(2)} Bs.</div></div>
        <form onSubmit={send} className="space-y-6">
          <Input label="Tu Nombre" value={f.clienteNombre} onChange={e=>setF({...f, clienteNombre: e.target.value})} required />
          <Input label="WhatsApp" value={f.clienteTelefono} onChange={e=>setF({...f, clienteTelefono: e.target.value})} required placeholder="0412-0000000" />
          <button type="button" onClick={()=>setOpen(true)} className="w-full py-4 bg-sky-100 text-sky-700 font-black rounded-2xl border-2 border-sky-200 uppercase tracking-widest text-xs shadow-md">Catálogo de Productos</button>
          <div className="p-6 bg-slate-900 text-white rounded-[2rem] space-y-6 border-b-8 border-sky-600 shadow-xl transition-colors">
             <InputDark label="Banco y Referencia" value={f.referencia} onChange={e=>setF({...f, referencia: e.target.value})} required />
             <label className="block bg-sky-600 p-4 text-center rounded-2xl font-black uppercase tracking-tighter cursor-pointer shadow-lg hover:bg-sky-500 transition-colors">{sub ? 'Procesando...' : 'Sube tu Capture Aquí (OBLIGATORIO)'}<input type="file" onChange={upFile} className="hidden" accept="image/*"/></label>
             {f.link && <div className="text-[10px] text-emerald-400 font-bold flex items-center justify-center gap-2 animate-bounce"><CheckCircle size={12}/> Pago cargado con éxito</div>}
          </div>
          <button type="submit" className="w-full py-5 bg-[#003366] text-white font-black rounded-3xl shadow-2xl hover:scale-[1.02] transition-transform text-lg uppercase tracking-widest">Finalizar Pedido</button>
        </form>
      </div>
      <ModalCatalogo catalogo={catalogo} stock={stock} isOpen={isCatOpen} onClose={()=>setOpen(false)} dialogs={dialogs}
        onConfirm={(txt, obj)=>{
          setF(prev => ({...prev, txt, carrito: obj }));
          let subtotal = 0;
          Object.entries(obj).forEach(([k,q]) => { const [n, p] = k.split('|'); catalogo.forEach(c => c.productos.forEach(pr => { if(pr.nombre===n){ const idx=pr.presentaciones.indexOf(p); subtotal += pr.precios[idx]*q; }})); });
          setTotal(subtotal); setOpen(false);
        }} />
    </div>
  );
}

// --- UTILS ---
function Input({ label, ...props }) { return (<div className="flex flex-col"><label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 ml-2 dark:text-slate-400 transition-colors">{label}</label><input className="p-3.5 border-2 border-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-2xl focus:border-sky-500 outline-none font-bold transition-all shadow-sm" {...props}/></div>); }
function InputDark({ label, ...props }) { return (<div className="flex flex-col"><label className="text-[10px] font-black uppercase text-slate-300 mb-1.5 ml-2 transition-colors">{label}</label><input className="p-3.5 border-2 border-slate-700 bg-slate-800 text-white rounded-2xl focus:border-sky-400 outline-none font-bold transition-all shadow-inner disabled:opacity-50" {...props}/></div>); }
function StatusBadge({ status }) { const b = { 'Pendiente': 'bg-amber-100 text-amber-700 border-amber-200', 'Validado': 'bg-sky-100 text-sky-700 border-sky-200', 'Despachado': 'bg-emerald-100 text-emerald-700 border-emerald-200', 'En Espera (Sin Stock)': 'bg-orange-100 text-orange-700 border-orange-200', 'Por Pagar / Cotización': 'bg-purple-100 text-purple-700 border-purple-200' }; return <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase border ${b[status] || 'bg-slate-100 text-slate-600'}`}>{status}</span>; }
function TabButton({ active, onClick, icon, label, badge }) { return (<button onClick={onClick} className={`flex items-center justify-between w-full p-4 rounded-2xl font-black transition-all ${active ? 'bg-sky-600 text-white shadow-xl scale-105' : 'text-sky-100/60 dark:text-slate-400 hover:bg-sky-900/40 dark:hover:bg-slate-800/80 hover:text-white'}`}><div className="flex items-center gap-3">{icon} <span className="hidden md:inline text-xs uppercase tracking-widest">{label}</span></div> {badge > 0 && <span className="bg-red-500 text-white text-[9px] px-2 py-0.5 rounded-full font-bold shadow-lg">{badge}</span>}</button>); }
function VistaImpresion({ pedidos }) { return <div className="hidden"></div>; }

function ModalCatalogo({ catalogo, stock, isOpen, onClose, onConfirm, dialogs }) {
  const [carrito, setCarrito] = useState({});
  const updateQty = (key, delta) => { setCarrito(prev => { const n = Math.max(0, (prev[key]||0)+delta); if(n===0){const c={...prev}; delete c[key]; return c;} return {...prev, [key]:n}; }); };
  if (!isOpen) return null;
  const handleConfirm = () => {
    const lineas = [];
    Object.entries(carrito).forEach(([k, q]) => lineas.push(`- ${q}x ${k.replace('|', ' ')}`));
    if (lineas.length === 0) return dialogs.alert("Selecciona productos.");
    onConfirm(lineas.join('\n'), carrito);
  };
  return (
    <div className="fixed inset-0 bg-slate-900/80 z-[200] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-[3rem] w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden shadow-2xl border dark:border-slate-700 transition-colors">
        <div className="p-8 border-b dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 transition-colors">
           <h2 className="text-2xl font-black flex items-center gap-3 dark:text-white uppercase tracking-tighter"><Search className="text-sky-600"/> Catálogo</h2>
           <button onClick={onClose} className="p-3 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200 transition-colors text-slate-500"><X size={24}/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-8 bg-[#f8fafc] dark:bg-slate-900 grid grid-cols-1 md:grid-cols-2 gap-8 transition-colors">
           {catalogo.filter(c=>c.categoria !== 'Complementos Automáticos').map(c => (
              <div key={c.categoria} className="space-y-4">
                 <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] border-b dark:border-slate-700 pb-2 transition-colors">{c.categoria}</h3>
                 {c.productos.map(p => (
                    <div key={p.nombre} className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border dark:border-slate-700 shadow-sm space-y-4 hover:shadow-md transition-all">
                       <div className="font-black text-base text-slate-800 dark:text-slate-100 transition-colors">{p.nombre}</div>
                       {p.presentaciones.map((pres, i) => {
                          const k = `${p.nombre}|${pres}`; const q = carrito[k] || 0;
                          const disp = stock ? (typeof stock[k] === 'object' ? stock[k].envios : (stock[k]||0)) : 0;
                          return (
                            <div key={pres} className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-4 rounded-[1.5rem] border dark:border-slate-700 transition-colors">
                               <div className="flex flex-col"><span className="font-bold opacity-60 text-[10px] dark:text-slate-400 uppercase tracking-widest">{pres}</span><span className="font-black text-emerald-600 text-lg">${p.precios[i]}</span><span className={`text-[9px] font-black ${disp===0?'text-red-500':'text-sky-500'}`}>Stock: {disp}</span></div>
                               <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-2xl border dark:border-slate-700 shadow-inner transition-colors">
                                  <button type="button" onClick={()=>updateQty(k,-1)} className="w-8 h-8 flex items-center justify-center font-black text-slate-400 hover:text-slate-800 transition-colors">-</button>
                                  <span className="font-black w-6 text-center dark:text-white text-lg">{q}</span>
                                  <button type="button" onClick={()=>updateQty(k,1)} className="w-8 h-8 flex items-center justify-center font-black text-sky-600 hover:text-sky-800 transition-colors">+</button>
                               </div>
                            </div>
                          )
                       })}
                    </div>
                 ))}
              </div>
           ))}
        </div>
        <div className="p-8 border-t dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 transition-colors"><div className="font-black opacity-50 dark:text-slate-400 tracking-widest uppercase text-xs">Items: {Object.values(carrito).reduce((a,b)=>a+b,0)}</div><button onClick={handleConfirm} className="bg-sky-600 text-white px-12 py-5 rounded-[2rem] font-black shadow-2xl hover:bg-sky-700 transition-all uppercase tracking-widest">Confirmar Selección</button></div>
      </div>
    </div>
  );
}

function PanelUsuarios({ usuarios, db, appId, dialogs }) {
  const ch = async (uid, isApproved, r, e) => { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', uid), { isApproved, role: r }); };
  const del = (uid, e) => { dialogs.confirm(`¿Eliminar permanentemente a ${e}?`, async () => { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', uid)); }); };
  return (
    <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border dark:border-slate-700 shadow-sm transition-colors">
      <h2 className="text-2xl font-black mb-8 dark:text-white uppercase tracking-tighter">Personal Registrado</h2>
      <div className="space-y-4">
        {usuarios.map(u => (
          <div key={u.id} className="p-6 border dark:border-slate-700 flex flex-wrap justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-2xl transition-colors">
            <div className="flex items-center gap-4"><div className="w-10 h-10 bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-400 rounded-full flex items-center justify-center font-black">{u.nombre[0]}</div><div><div className="font-bold dark:text-white">{u.nombre}</div><div className="text-[10px] text-slate-400 font-bold uppercase">{u.email}</div></div></div>
            <div className="flex gap-4 items-center">
               <select value={u.role} onChange={e=>ch(u.id, true, e.target.value, u.email)} className="bg-white dark:bg-slate-900 border-2 dark:border-slate-700 p-2 rounded-xl font-bold text-xs shadow-sm focus:border-sky-500 outline-none transition-colors">
                 {Object.values(ROLES).map(r => <option key={r} value={r}>{r}</option>)}
               </select>
               <button onClick={()=>del(u.id, u.email)} className="bg-red-50 dark:bg-red-900/20 text-red-600 p-2.5 rounded-xl hover:bg-red-600 hover:text-white transition-all"><Trash2 size={18}/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PanelInventario({ stock, notas, catalogo, db, appId, dialogs, perfil }) {
  return (
    <div className="bg-white dark:bg-slate-800 p-12 rounded-[3rem] border dark:border-slate-700 text-center shadow-sm transition-colors">
       <Archive size={64} className="mx-auto text-sky-300 dark:text-sky-600 mb-6 transition-transform hover:scale-110"/>
       <h2 className="text-3xl font-black dark:text-white uppercase tracking-tighter">Panel de Inventario</h2>
       <p className="text-slate-400 mt-2 max-w-md mx-auto font-medium">Este módulo centraliza el valor real de tu almacén. El conteo físico diario se realiza en la pestaña de Despacho para evitar errores.</p>
    </div>
  );
}

function PanelLogs({ logs }) {
  return (
    <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border dark:border-slate-700 h-[70vh] flex flex-col shadow-sm transition-colors">
       <h2 className="text-2xl font-black mb-6 dark:text-white uppercase tracking-tighter">Auditoría Bluher</h2>
       <div className="flex-1 overflow-y-auto rounded-2xl border dark:border-slate-700 p-4 space-y-2 bg-[#f8fafc] dark:bg-slate-900/50 shadow-inner">
          {logs.map(l => (
            <div key={l.id} className="p-3 border-b dark:border-slate-800 text-[10px] flex gap-6 hover:bg-white dark:hover:bg-slate-800 transition-colors rounded-lg">
               <span className="font-black text-sky-600 dark:text-sky-400 shrink-0">{new Date(l.fecha).toLocaleString()}</span>
               <span className="font-medium text-slate-600 dark:text-slate-300"><b className="dark:text-white uppercase">{l.usuarioEmail}</b>: {l.detalle}</span>
            </div>
          ))}
       </div>
    </div>
  );
}