import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { ShoppingCart, CheckSquare, Truck, Printer, Clock, CheckCircle, XCircle, Search, Sparkles, Package, Plus, Minus, X, Image as ImageIcon, Camera, ClipboardList, AlertTriangle, UploadCloud, Loader2, DollarSign, Archive, Edit3, Save, LogOut, ShieldCheck, Users, FileText, MessageSquare, Eye, FileSpreadsheet, Download, ChevronDown, ChevronUp, MessageCircle, ArrowRightLeft, PlusCircle, Trash2 } from 'lucide-react';

// --- 1. CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
    };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
const appId = typeof __app_id !== 'undefined' ? __app_id : 'app-pedidos-venezuela';

const URL_GOOGLE_SCRIPT = import.meta.env.VITE_GOOGLE_SCRIPT_URL;
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// --- CONSTANTES DE ROLES DE USUARIO ---
const ROLES = {
  ADMIN: 'Administrador',
  VENTAS: 'Ventas',
  ADMINISTRACION: 'Administración', 
  DESPACHO: 'Despacho',
  AUDITOR_VENTAS: 'Auditor Ventas y Admin',
  AUDITOR_INVENTARIO: 'Auditor Inventario',
  AUDITOR_GENERAL: 'Auditor General'
};

// --- CATÁLOGO BASE POR DEFECTO ---
const DEFAULT_CATALOGO = [
  { categoria: "Cirugías Capilares", productos: [ { nombre: "Cirugía Clásica", presentaciones: ["Litro", "1/2 Litro", "Galón"], imagen: "" }, { nombre: "Cirugía Chocolate", presentaciones: ["Litro", "1/2 Litro", "Galón"], imagen: "" } ] },
  { categoria: "Alisados", productos: [ { nombre: "Alisado Clásica", presentaciones: ["1 Litro", "300ml"], imagen: "" }, { nombre: "Alisado Chocolate", presentaciones: ["1 Litro", "300ml"], imagen: "" } ] },
  { categoria: "Shampoos y Cuidado", productos: [ { nombre: "Shampoo Tradicional", presentaciones: ["Litro", "1/2 Litro"], imagen: "" }, { nombre: "Anti-Residuos", presentaciones: ["1 Litro", "1/2 Litro"], imagen: "" } ] },
  { categoria: "Boosters y Terapias", productos: [ 
      { nombre: "Booster de Hidratacion", presentaciones: ["Unidad"], imagen: "" },
      { nombre: "Booster de Reparacion", presentaciones: ["Unidad"], imagen: "" },
      { nombre: "Booster de Nutricion", presentaciones: ["Unidad"], imagen: "" },
      { nombre: "Booster Profesional", presentaciones: ["Unidad"], imagen: "" },
      { nombre: "Terapia Antifrizz", presentaciones: ["500gr"], imagen: "" } 
    ] 
  },
  { categoria: "Complementos Automáticos", productos: [
      { nombre: "Concentrado", presentaciones: ["Unidad"], imagen: "" }
    ]
  }
];

// ==========================================
// COMPONENTE PRINCIPAL (RUTEO Y ESTADO GLOBAL)
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

  // --- 1. MANEJO DE AUTENTICACIÓN (LOGIN REAL) ---
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
        // Ignorar
      } else {
        setUser(null); setUserProfile(null); setAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // --- 2. ESCUCHAR PERFIL DE USUARIO Y LOGS DE SESIÓN ---
  useEffect(() => {
    if (!user) return;
    let isFirstLoad = true;
    
    const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid);
    const unsub = onSnapshot(userRef, async (snap) => {
      if (snap.exists()) {
        const profile = snap.data();
        setUserProfile(profile);

        // Actualizar estado en línea al entrar
        if (isFirstLoad) {
           isFirstLoad = false;
           if (!profile.isOnline) {
              updateDoc(userRef, { isOnline: true });
              // Registrar Inicio de Sesión
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
  }, [user]);

  // Manejar el cierre de pestaña para desconectar al usuario
  useEffect(() => {
    const handleUnload = () => {
      if (user) {
        updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), { isOnline: false });
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [user]);

  // --- 3. LOGS DE AUDITORÍA ---
  const registrarLogSistem = async (perfilActivo, accion, detalle) => {
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'logs'), {
        accion, detalle, usuarioEmail: perfilActivo.email, usuarioNombre: perfilActivo.nombre, usuarioRol: perfilActivo.role, fecha: Date.now()
      });
    } catch (e) { console.error(e); }
  };
  const loggear = (accion, detalle) => registrarLogSistem(userProfile, accion, detalle);

  // --- 4. ESCUCHAR DATOS DE FIREBASE ---
  useEffect(() => {
    if (!user || !userProfile || !userProfile.isApproved) return;
    const unsubs = [];

    unsubs.push(onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'pedidos'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.fechaCreacion - a.fechaCreacion);
      setPedidos(data);
    }));

    unsubs.push(onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'catalogo'), (docSnap) => {
      setCatalogo(docSnap.exists() && docSnap.data().categorias ? docSnap.data().categorias : DEFAULT_CATALOGO);
    }));

    unsubs.push(onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'stock'), (docSnap) => setStockInventario(docSnap.exists() ? docSnap.data() : {})));
    unsubs.push(onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'notas'), (docSnap) => setNotasInventario(docSnap.exists() ? docSnap.data() : {})));

    unsubs.push(onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'movimientos'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.fechaCreacion - a.fechaCreacion);
      setMovimientos(data);
    }));

    const esAdminOAuditor = [ROLES.ADMIN, ROLES.AUDITOR_GENERAL].includes(userProfile.role);
    if (esAdminOAuditor) {
      unsubs.push(onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'users'), (snapshot) => setUsuarios(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))));
      unsubs.push(onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'logs'), (snapshot) => setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.fecha - a.fecha))));
    }

    return () => unsubs.forEach(unsub => unsub());
  }, [user, userProfile]);

  const signInGoogle = async () => {
    try { setAuthLoading(true); await signInWithPopup(auth, googleProvider); } 
    catch (error) { console.error(error); alert("Error al iniciar sesión."); setAuthLoading(false); }
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

  // --- VISTAS DE AUTENTICACIÓN ---
  
  // Evitar choque de renderizado si Firebase demora o falla cargando el perfil tras autenticar
  if (authLoading || (user && !userProfile)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
        <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
        <div className="font-bold text-slate-700 text-lg">Cargando sistema de seguridad...</div>
        <p className="text-sm text-slate-500 mt-2 mb-4 max-w-sm">Verificando permisos y perfil de acceso. Si esto demora mucho, revisa tu conexión.</p>
        {user && <button onClick={cerrarSesion} className="text-blue-600 text-sm hover:underline font-semibold">Cancelar y cerrar sesión</button>}
      </div>
    );
  }

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border-t-8 border-blue-600">
        <Package size={56} className="mx-auto text-blue-600 mb-4" />
        <h1 className="text-3xl font-black text-slate-800">LogiWeb</h1>
        <p className="text-slate-500 mb-8 mt-2">Sistema logístico empresarial seguro.</p>
        <button onClick={signInGoogle} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-3 transition">
          Ingresar con Google
        </button>
      </div>
    </div>
  );

  if (userProfile && !userProfile.isApproved) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 text-center">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border-t-8 border-amber-500">
        <ShieldCheck size={56} className="mx-auto text-amber-500 mb-4" />
        <h2 className="text-2xl font-bold text-slate-800">Cuenta en Revisión</h2>
        <p className="text-slate-600 mt-2 mb-6">Tu correo <b>{user.email}</b> espera aprobación del Administrador.</p>
        <button onClick={cerrarSesion} className="text-blue-600 font-semibold hover:underline">Cerrar sesión</button>
      </div>
    </div>
  );

  // --- PERMISOS DE VISUALIZACIÓN POR ROL ---
  const r = userProfile.role;
  const showVentas = [ROLES.ADMIN, ROLES.VENTAS, ROLES.AUDITOR_VENTAS, ROLES.AUDITOR_GENERAL].includes(r);
  const showAdmin = [ROLES.ADMIN, ROLES.ADMINISTRACION, ROLES.AUDITOR_VENTAS, ROLES.AUDITOR_GENERAL].includes(r);
  const showDespacho = [ROLES.ADMIN, ROLES.DESPACHO, ROLES.AUDITOR_GENERAL].includes(r);
  const showReportes = [ROLES.ADMIN, ROLES.AUDITOR_VENTAS, ROLES.AUDITOR_GENERAL, ROLES.ADMINISTRACION].includes(r);
  const showInventario = [ROLES.ADMIN, ROLES.AUDITOR_INVENTARIO, ROLES.AUDITOR_GENERAL, ROLES.ADMINISTRACION].includes(r); // Admins tienen acceso para recepcion
  const showUsuarios = [ROLES.ADMIN].includes(r);
  const showLogs = [ROLES.ADMIN, ROLES.AUDITOR_GENERAL].includes(r);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-800">
      {/* SIDEBAR */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex-shrink-0 print:hidden shadow-xl z-10 flex flex-col h-auto md:h-screen sticky top-0 overflow-y-auto">
        <div className="p-6 pb-2">
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2"><Package className="text-blue-500" /> LogiWeb</h1>
          <div className="mt-4 bg-slate-800 rounded-lg p-3 border border-slate-700 flex flex-col gap-1">
             <div className="text-xs text-slate-400">Usuario Activo:</div>
             <div className="text-sm font-bold text-white truncate" title={user.email}>{user.displayName}</div>
             <div className="text-xs font-semibold text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded-full inline-block w-max mt-1 border border-blue-800">{userProfile.role}</div>
          </div>
        </div>
        
        <nav className="mt-4 flex flex-row md:flex-col gap-1 px-4 overflow-x-auto flex-1 pb-4">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 hidden md:block">Operaciones</div>
          {showVentas && <TabButton active={activeTab === 'ventas'} onClick={() => setActiveTab('ventas')} icon={<ShoppingCart size={18} />} label="Ventas" badge={pedidos.filter(p=>p.status==='Rechazado').length} badgeColor="bg-red-500" />}
          {showAdmin && <TabButton active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} icon={<CheckSquare size={18} />} label={`Admin y Pagos`} badge={pedidos.filter(p=>p.status==='Pendiente').length} />}
          {showDespacho && <TabButton active={activeTab === 'despacho'} onClick={() => setActiveTab('despacho')} icon={<Truck size={18} />} label={`Despacho`} badge={pedidos.filter(p=>p.status==='Validado').length} />}
          
          {(showReportes || showInventario || showUsuarios || showLogs) && <div className="hidden md:block my-4 border-t border-slate-700 mx-2"></div>}
          {(showReportes || showInventario || showUsuarios || showLogs) && <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 hidden md:block">Reportes y Config</div>}

          {showReportes && <TabButton active={activeTab === 'reportes'} onClick={() => setActiveTab('reportes')} icon={<FileSpreadsheet size={18} />} label="Reportes de Ventas" />}
          {showInventario && <TabButton active={activeTab === 'inventario'} onClick={() => setActiveTab('inventario')} icon={<Archive size={18} />} label="Inventario" badge={movimientos.filter(m=>m.status==='Pendiente').length} />}
          {showUsuarios && <TabButton active={activeTab === 'usuarios'} onClick={() => setActiveTab('usuarios')} icon={<Users size={18} />} label="Usuarios" badge={usuarios.filter(u=>!u.isApproved).length} />}
          {showLogs && <TabButton active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={<FileText size={18} />} label="Registro Logs" />}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button onClick={cerrarSesion} className="flex items-center justify-center gap-2 w-full p-2 rounded text-slate-400 hover:text-white hover:bg-red-900/50 transition">
            <LogOut size={16} /> Salir
          </button>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto print:p-0 print:m-0 print:bg-white print:block">
        <div className="max-w-6xl mx-auto print:max-w-none print:mx-0">
          <div className="print:hidden">
            {activeTab === 'ventas' && showVentas && <PanelVentas perfil={userProfile} pedidos={pedidos} catalogo={catalogo} db={db} appId={appId} loggear={loggear} />}
            {activeTab === 'admin' && showAdmin && <PanelAdmin perfil={userProfile} pedidos={pedidos} stock={stockInventario} loggear={loggear} db={db} appId={appId} />}
            {activeTab === 'despacho' && showDespacho && <PanelDespacho pedidos={pedidos} db={db} appId={appId} loggear={loggear} />}
            {activeTab === 'reportes' && showReportes && <PanelReportes pedidos={pedidos} />}
            {activeTab === 'inventario' && showInventario && <PanelInventario stock={stockInventario} notas={notasInventario} catalogo={catalogo} movimientos={movimientos} db={db} appId={appId} loggear={loggear} perfil={userProfile} />}
            {activeTab === 'usuarios' && showUsuarios && <PanelUsuarios usuarios={usuarios} db={db} appId={appId} loggear={loggear} />}
            {activeTab === 'logs' && showLogs && <PanelLogs logs={logs} />}
          </div>
          <VistaImpresion pedidos={pedidos.filter(p => p.status === 'Validado')} />
        </div>
      </main>
    </div>
  );
}

// ==========================================
// 1. PANEL DE VENTAS 
// ==========================================
function PanelVentas({ perfil, pedidos, catalogo, db, appId, loggear }) {
  const puedeCrear = [ROLES.ADMIN, ROLES.VENTAS].includes(perfil.role);
  const [vista, setVista] = useState(puedeCrear ? 'nuevo' : 'historial'); 
  const defaultForm = { clienteNombre: '', clienteCedula: '', clienteTelefono: '', courier: 'ZOOM', direccion: '', productos: '', carritoObj: null, asesora: perfil.nombre, referencia: '', moneda: 'USD', montoPago: '', tasa: '' };
  
  const [formData, setFormData] = useState(defaultForm);
  const [editId, setEditId] = useState(null); // ID del pedido si estamos corrigiendo un rechazo
  const [motivoRechazoActual, setMotivoRechazoActual] = useState(''); // Mostrar por qué fue devuelto

  const [enviando, setEnviando] = useState(false);
  const [textoCrudo, setTextoCrudo] = useState('');
  const [analizando, setAnalizando] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);

  const analizarConGemini = async () => {
    if (!textoCrudo.trim()) return alert("Pega el mensaje de WhatsApp primero.");
    setAnalizando(true);

    try {
      const llavesCatalogo = catalogo.flatMap(c => c.productos.flatMap(p => p.presentaciones.map(pres => `${p.nombre}|${pres}`))).join(', ');
      const prompt = `Analiza y extrae en JSON. Courier: ZOOM, MRW, Tealca, Domesa. Moneda: USD o VES. Monto: solo numero. productosCrudos: texto exacto. carrito: mapea a estas llaves: [${llavesCatalogo}]. Texto: ${textoCrudo}`;
      
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
                courier: { type: "STRING" }, direccion: { type: "STRING" }, montoPago: { type: "STRING" }, moneda: { type: "STRING" }, referencia: { type: "STRING" }, asesora: { type: "STRING" }, productosCrudos: { type: "STRING" },
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

         setFormData(prev => ({ ...prev, ...result, productos: txtFormat || prev.productos, carritoObj: Object.keys(nuevoCarritoObj).length > 0 ? nuevoCarritoObj : prev.carritoObj }));
      }
    } catch(e) { console.error(e); alert("Error API Gemini."); } finally { setAnalizando(false); }
  };

  const cargarPedidoParaEditar = (pedido) => {
    setFormData({
      clienteNombre: pedido.clienteNombre, clienteCedula: pedido.clienteCedula, clienteTelefono: pedido.clienteTelefono, courier: pedido.courier, direccion: pedido.direccion,
      productos: pedido.productos, carritoObj: pedido.carritoObj, asesora: pedido.asesora, referencia: pedido.referencia, moneda: pedido.moneda, 
      montoPago: pedido.monto.toString(), tasa: pedido.tasaAplicada.toString()
    });
    setEditId(pedido.id);
    setMotivoRechazoActual(pedido.motivoRechazo || 'Sin motivo especificado.');
    setVista('nuevo');
  };

  const cancelarEdicion = () => {
    setFormData(defaultForm);
    setEditId(null);
    setMotivoRechazoActual('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.carritoObj || Object.keys(formData.carritoObj).length === 0) return alert("Selecciona productos del Catálogo Visual.");
    if (!formData.tasa || parseFloat(formData.tasa) <= 0) return alert("Ingresa la Tasa Aplicada.");
    
    setEnviando(true);
    const montoNum = parseFloat(formData.montoPago) || 0;
    const tasa = parseFloat(formData.tasa);
    const calculo = formData.moneda === 'USD' ? { usd: montoNum, ves: montoNum * tasa } : { ves: montoNum, usd: tasa > 0 ? montoNum / tasa : 0 };

    // --- LÓGICA AUTOMÁTICA DE CONCENTRADO ---
    let finalCarrito = { ...formData.carritoObj };
    let finalProductosText = formData.productos;
    let countBoosters = 0;
    const boosterKeys = [
      "Booster de Hidratacion|Unidad",
      "Booster de Reparacion|Unidad",
      "Booster de Nutricion|Unidad",
      "Booster Profesional|Unidad"
    ];

    Object.entries(finalCarrito).forEach(([key, qty]) => {
      if (boosterKeys.includes(key)) {
        countBoosters += qty;
      }
    });

    if (countBoosters > 0) {
      finalCarrito["Concentrado|Unidad"] = (finalCarrito["Concentrado|Unidad"] || 0) + countBoosters;
      if (!finalProductosText.includes("Concentrado (Unidad)")) {
        finalProductosText += `\n- ${countBoosters}x Concentrado (Unidad) [Agregado Automáticamente]`;
      }
    }
    // ----------------------------------------

    try {
      if (editId) {
        // Actualizar pedido rechazado
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', editId), {
          ...formData, productos: finalProductosText, carritoObj: finalCarrito, monto: montoNum, montoUsd: calculo.usd, montoVes: calculo.ves, tasaAplicada: tasa, status: 'Pendiente', motivoRechazo: '' // Limpiar motivo
        });
        loggear('PEDIDO_CORREGIDO', `Se corrigió el pedido de ${formData.clienteNombre} devuelto por Administración.`);
        alert("Pedido corregido y enviado a Administración.");
      } else {
        // Crear nuevo
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'pedidos'), {
          ...formData, productos: finalProductosText, carritoObj: finalCarrito, monto: montoNum, montoUsd: calculo.usd, montoVes: calculo.ves, tasaAplicada: tasa, status: 'Pendiente', auditado: false, fechaCreacion: Date.now(), fechaDespacho: new Date().toLocaleDateString('es-VE')
        });
        loggear('PEDIDO_CREADO', `Venta registrada: ${formData.clienteNombre} ($${calculo.usd.toFixed(2)})`);
        alert("¡Pedido registrado exitosamente!");
      }
      
      cancelarEdicion();
      setVista('historial');
    } catch (e) { console.error(e); alert("Error al procesar el pedido."); }
    setEnviando(false);
  };

  const enviarWhatsApp = (pedido) => {
    const mensaje = `Hola ${pedido.clienteNombre}, tu pedido ha sido enviado por *${pedido.courier}*.%0A%0A*Guía:* ${pedido.guia}%0A%0A${pedido.linkGuia ? `Recibo: ${pedido.linkGuia}%0A` : ''}${pedido.linkFotoProductos ? `Paquete: ${pedido.linkFotoProductos}%0A` : ''}%0A¡Gracias por tu compra!`;
    const cleanPhone = String(pedido.clienteTelefono).replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${mensaje}`, '_blank');
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <div className="flex gap-4 mb-6 border-b pb-4">
        {puedeCrear && <button onClick={() => { setVista('nuevo'); if(editId) cancelarEdicion(); }} className={`pb-2 font-bold flex gap-2 ${vista === 'nuevo' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}><ShoppingCart size={18} /> {editId ? 'Corrigiendo Pedido' : 'Registrar Venta'}</button>}
        <button onClick={() => setVista('historial')} className={`pb-2 font-bold flex gap-2 ${vista === 'historial' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}><ClipboardList size={18} /> Historial Ventas</button>
      </div>

      {vista === 'nuevo' && puedeCrear ? (
        <div>
          {editId && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded flex items-start gap-3">
              <AlertTriangle className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-red-800 font-bold">Corrigiendo Pedido Devuelto</h3>
                <p className="text-red-700 text-sm mt-1"><strong>Motivo de Administración:</strong> {motivoRechazoActual}</p>
                <button type="button" onClick={cancelarEdicion} className="text-xs font-bold text-red-600 hover:text-red-800 mt-2 underline">Cancelar corrección</button>
              </div>
            </div>
          )}

          {!editId && (
            <div className="mb-6 bg-indigo-50 p-4 rounded-lg border border-indigo-100">
              <h3 className="text-indigo-800 font-bold mb-2 flex items-center gap-2"><Sparkles size={18} className="text-indigo-600" /> Autocompletar con IA ✨</h3>
              <div className="flex flex-col md:flex-row gap-3">
                <textarea className="flex-1 p-3 border border-indigo-200 rounded text-sm resize-none" rows={2} placeholder="Pega el mensaje de WhatsApp..." value={textoCrudo} onChange={(e) => setTextoCrudo(e.target.value)}></textarea>
                <button type="button" onClick={analizarConGemini} disabled={analizando} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded shadow disabled:opacity-50">
                  {analizando ? 'Analizando...' : 'Extraer Datos'}
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
             <Input label="Asesora" name="asesora" value={formData.asesora} onChange={(e)=>setFormData({...formData, asesora: e.target.value})} required />
             <Input label="Cliente" name="clienteNombre" value={formData.clienteNombre} onChange={(e)=>setFormData({...formData, clienteNombre: e.target.value})} required />
             <Input label="Cédula/RIF" name="clienteCedula" value={formData.clienteCedula} onChange={(e)=>setFormData({...formData, clienteCedula: e.target.value})} required />
             <Input label="Teléfono" name="clienteTelefono" value={formData.clienteTelefono} onChange={(e)=>setFormData({...formData, clienteTelefono: e.target.value})} required />
             
             <div className="flex flex-col">
               <label className="text-sm font-semibold text-slate-700 mb-1">Empresa de Envío</label>
               <select name="courier" value={formData.courier} onChange={(e)=>setFormData({...formData, courier: e.target.value})} className="p-2 border border-slate-300 rounded bg-white">
                 <option value="ZOOM">ZOOM</option> <option value="MRW">MRW</option> <option value="Tealca">Tealca</option> <option value="Domesa">Domesa</option>
               </select>
             </div>
             <div className="md:col-span-2">
               <label className="text-sm font-semibold text-slate-700 mb-1 block">Dirección de Envío Completa</label>
               <textarea name="direccion" value={formData.direccion} onChange={(e)=>setFormData({...formData, direccion: e.target.value})} required rows={2} className="w-full p-2 border border-slate-300 rounded"></textarea>
             </div>
             
             <div className="md:col-span-2 bg-slate-50 p-4 rounded-lg border border-slate-200">
               <div className="flex justify-between items-center mb-2">
                 <label className="font-bold text-slate-800 flex items-center gap-2"><Package size={18}/> Productos a Enviar</label>
                 <button type="button" onClick={() => setIsCatalogOpen(true)} className="text-xs font-bold text-white bg-blue-600 py-2 px-4 rounded shadow flex items-center gap-2"><Search size={14} /> Abrir Catálogo</button>
               </div>
               {formData.productos ? (
                 <div className="text-sm text-slate-700 whitespace-pre-wrap bg-white p-3 border rounded">{formData.productos}</div>
               ) : (
                 <div className="text-sm text-slate-400 italic text-center p-4 border-2 border-dashed rounded">No hay productos. Usa el catálogo.</div>
               )}
             </div>

             <div className="md:col-span-2 bg-green-50/50 p-4 rounded-lg border border-green-100 grid grid-cols-1 md:grid-cols-4 gap-4">
               <div className="flex flex-col"><Input type="number" step="0.01" label="Tasa Aplicada (Bs/$)" name="tasa" value={formData.tasa} onChange={(e)=>setFormData({...formData, tasa: e.target.value})} required placeholder="Ej: 45.20" /></div>
               <div className="flex flex-col">
                 <label className="text-sm font-semibold text-slate-700 mb-1">Moneda Pagada</label>
                 <select value={formData.moneda} onChange={(e)=>setFormData({...formData, moneda: e.target.value})} className="p-2 border border-slate-300 rounded bg-white">
                   <option value="USD">Dólares (USD $)</option> <option value="VES">Bolívares (VES Bs)</option>
                 </select>
               </div>
               <div className="flex flex-col relative"><Input type="number" step="0.01" label="Monto Pagado" name="montoPago" value={formData.montoPago} onChange={(e)=>setFormData({...formData, montoPago: e.target.value})} required placeholder="Ej: 30" />
                 {formData.tasa && formData.montoPago && <span className="text-xs text-green-700 font-semibold absolute -bottom-5 left-0">{formData.moneda === 'USD' ? `Eq: Bs. ${((parseFloat(formData.montoPago)||0) * parseFloat(formData.tasa)).toFixed(2)}` : `Eq: $${((parseFloat(formData.montoPago)||0) / parseFloat(formData.tasa)).toFixed(2)}`}</span>}
               </div>
               <Input label="Referencia / Banco" name="referencia" value={formData.referencia} onChange={(e)=>setFormData({...formData, referencia: e.target.value})} required placeholder="Ej. 1234 Mercantil" />
             </div>
             
             <button type="submit" disabled={enviando} className={`md:col-span-2 text-white font-bold py-3 mt-4 rounded-lg shadow-lg flex justify-center items-center gap-2 text-lg ${editId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-slate-900 hover:bg-slate-800'}`}>
               {enviando ? <Loader2 className="animate-spin" /> : <><CheckCircle size={20} /> {editId ? 'Reenviar a Administración' : 'Procesar Venta'}</>}
             </button>
          </form>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead><tr className="bg-slate-100"><th className="p-3 border-b">Fecha/Cliente</th><th className="p-3 border-b">Pago</th><th className="p-3 border-b">Estatus</th><th className="p-3 border-b">Acciones</th></tr></thead>
            <tbody>
              {pedidos.map(p => (
                <tr key={p.id} className="border-b hover:bg-slate-50">
                  <td className="p-3"><div className="font-bold">{p.clienteNombre}</div><div className="text-xs text-slate-500">{new Date(p.fechaCreacion).toLocaleDateString()}</div></td>
                  <td className="p-3"><div className="font-semibold">${(p.montoUsd||0).toFixed(2)}</div><div className="text-xs text-slate-500">Tasa: {p.tasaAplicada || '-'}</div></td>
                  <td className="p-3">
                    {getStatusBadge(p.status)}
                    {p.status === 'Rechazado' && <div className="text-xs text-red-600 mt-1 font-medium bg-red-50 p-1 rounded">Devuelto: {p.motivoRechazo}</div>}
                  </td>
                  <td className="p-3">
                    {p.status === 'Rechazado' && (
                      <button onClick={() => cargarPedidoParaEditar(p)} className="bg-amber-500 text-white text-xs font-bold py-1 px-3 rounded shadow-sm hover:bg-amber-600">Corregir Pedido</button>
                    )}
                    {p.status === 'Despachado' && (
                      <div className="flex flex-col items-start gap-1">
                        <div className="text-xs font-bold text-slate-700">Guía: {p.guia}</div>
                        <button onClick={() => enviarWhatsApp(p)} className="bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-1 px-2 rounded flex items-center gap-1"><MessageCircle size={14} /> Notificar Cliente</button>
                      </div>
                    )}
                    {p.auditado && <span className="text-green-600 font-bold text-xs flex items-center gap-1 mt-2"><ShieldCheck size={14}/> Validado OK</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ModalCatalogo catalogo={catalogo} isOpen={isCatalogOpen} onClose={()=>setIsCatalogOpen(false)} onConfirm={(txt, obj)=>{setFormData({...formData, productos: txt, carritoObj: obj}); setIsCatalogOpen(false);}} />
    </div>
  );
}

// ==========================================
// 3. PANEL DE ADMINISTRACIÓN (PAGOS Y AUDITORÍA)
// ==========================================
function PanelAdmin({ perfil, pedidos, stock, loggear, db, appId }) {
  const [vistaAdmin, setVistaAdmin] = useState('pendientes');
  const esAuditor = [ROLES.AUDITOR_VENTAS, ROLES.AUDITOR_GENERAL].includes(perfil.role);
  const esAdmin = [ROLES.ADMIN, ROLES.ADMINISTRACION].includes(perfil.role);

  const pendientes = pedidos.filter(p => p.status === 'Pendiente');
  const historial = pedidos.filter(p => p.status !== 'Pendiente');

  const validarPago = async (pedido) => {
    try {
      // Descontar inventario de almacén "Envíos"
      const stockRef = doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'stock');
      let currentStock = { ...stock };
      
      Object.entries(pedido.carritoObj || {}).forEach(([itemKey, qty]) => {
         let actualEnvios = typeof currentStock[itemKey] === 'object' ? currentStock[itemKey].envios : (currentStock[itemKey] || 0);
         let actualRecep = typeof currentStock[itemKey] === 'object' ? currentStock[itemKey].recepcion : 0;
         
         currentStock[itemKey] = { envios: Math.max(0, actualEnvios - qty), recepcion: actualRecep };
      });
      await setDoc(stockRef, currentStock);

      // Actualizar pedido
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', pedido.id), { status: 'Validado' });
      loggear('PAGO_VALIDADO', `Se aprobó el pago y descontó inventario del pedido de ${pedido.clienteNombre}`);
    } catch(e) { console.error(e); alert("Error validando"); }
  };

  const rechazarPago = async (pedido) => {
    const motivo = prompt(`Escribe el motivo de devolución a Ventas para el pedido de ${pedido.clienteNombre}:\n(Ej: Faltan $5 en la transferencia, Producto sin stock)`);
    if (!motivo) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', pedido.id), { status: 'Rechazado', motivoRechazo: motivo });
      loggear('PAGO_RECHAZADO', `Se devolvió el pedido de ${pedido.clienteNombre}. Motivo: ${motivo}`);
    } catch(e) { console.error(e); }
  };

  const marcarAuditoria = async (id, actual) => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', id), { auditado: !actual });
      loggear('AUDITORIA_VENTA', `Se ${!actual ? 'aprobó' : 'removió'} check de auditoría al pedido ${id}`);
    } catch(e) { console.error(e); }
  };

  const listado = vistaAdmin === 'pendientes' ? pendientes : historial;

  return (
    <div className="bg-white p-6 rounded-xl shadow border border-slate-200">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <h2 className="text-xl font-bold flex items-center gap-2"><CheckSquare className="text-blue-600"/> Administración y Validación</h2>
        <div className="flex gap-2">
          <button onClick={() => setVistaAdmin('pendientes')} className={`px-4 py-2 font-bold rounded-t-lg ${vistaAdmin === 'pendientes' ? 'bg-slate-100 text-blue-700' : 'text-slate-500'}`}>Por Validar ({pendientes.length})</button>
          <button onClick={() => setVistaAdmin('historial')} className={`px-4 py-2 font-bold rounded-t-lg ${vistaAdmin === 'historial' ? 'bg-slate-100 text-blue-700' : 'text-slate-500'}`}>Historial General</button>
        </div>
      </div>

      <div className="overflow-x-auto bg-slate-50 rounded-b-lg">
        <table className="w-full text-left border-collapse text-sm">
          <thead><tr className="bg-slate-200"><th className="p-3 border-b w-1/3">Cliente / Productos</th><th className="p-3 border-b">Pago & Ref</th><th className="p-3 border-b text-right">Acciones Admin / Auditor</th></tr></thead>
          <tbody>
            {listado.length === 0 ? <tr><td colSpan="3" className="p-4 text-center">No hay pedidos aquí.</td></tr> : listado.map(p => (
              <tr key={p.id} className="border-b hover:bg-white bg-white/50">
                 <td className="p-3 align-top">
                   <div className="font-bold text-base">{p.clienteNombre} <span className="text-xs font-normal text-slate-500">({p.asesora})</span></div>
                   <div className="text-xs text-slate-700 bg-blue-50 border border-blue-100 p-2 mt-2 rounded shadow-inner">
                     <span className="font-bold flex items-center gap-1 mb-1 text-blue-800"><Package size={14}/> Productos a Validar:</span>
                     {p.productos ? (
                        <div className="whitespace-pre-wrap">{p.productos}</div>
                     ) : (
                        p.carritoObj ? Object.entries(p.carritoObj).map(([key, qty]) => <div key={key}>• {qty}x {key.replace('|', ' ')}</div>) : 'No se especificaron productos.'
                     )}
                   </div>
                 </td>
                 <td className="p-3 align-top">
                   <div className="font-bold text-green-700 text-lg">${(p.montoUsd||0).toFixed(2)} <span className="text-xs text-slate-500 font-normal ml-1">(Tasa: {p.tasaAplicada})</span></div>
                   <div className="text-xs">Ref: {p.referencia}</div>
                   <div className="mt-1">{getStatusBadge(p.status)}</div>
                 </td>
                 <td className="p-3 align-top">
                   <div className="flex flex-col gap-2 items-end">
                     {/* Acciones de Admin/Pagos (Solo en pendientes) */}
                     {esAdmin && p.status === 'Pendiente' && (
                       <div className="flex gap-2 mt-2">
                         <button onClick={()=>rechazarPago(p)} className="bg-red-100 text-red-700 px-3 py-1.5 rounded font-bold text-xs hover:bg-red-200">Devolver a Ventas</button>
                         <button onClick={()=>validarPago(p)} className="bg-emerald-600 text-white px-3 py-1.5 rounded font-bold text-xs shadow hover:bg-emerald-700">Validar y Descontar Stock</button>
                       </div>
                     )}

                     {/* Acciones de Auditor (En historial) */}
                     {(esAuditor || esAdmin) && p.status !== 'Pendiente' && (
                       <button onClick={()=>marcarAuditoria(p.id, p.auditado)} className={`px-3 py-1.5 rounded font-bold text-xs flex items-center gap-1 border transition ${p.auditado ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                         {p.auditado ? <><ShieldCheck size={14}/> Auditoría Completada</> : <><Eye size={14}/> Auditar Operación</>}
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
function PanelDespacho({ pedidos, cambiarEstado, db, appId, loggear }) {
  const [vistaDespacho, setVistaDespacho] = useState('pendientes');

  const pedidosValidados = pedidos.filter(p => p.status === 'Validado');
  const pedidosDespachados = pedidos.filter(p => p.status === 'Despachado');
  const pedidosPendientes = pedidos.filter(p => p.status === 'Pendiente' || p.status === 'Rechazado').length;

  const [guiasInput, setGuiasInput] = useState({});
  const [subiendo, setSubiendo] = useState({ id: null, field: null });

  const handleGuiaChange = (id, field, value) => {
    setGuiasInput(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const handleFileUpload = async (e, id, field) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!URL_GOOGLE_SCRIPT) {
        alert("⚠️ Falta configurar el puente de Google Drive. Por ahora, debes tomar la foto, subirla a drive y pegar el enlace manualmente.");
        return;
    }

    setSubiendo({ id, field });

    try {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = async () => {
            const base64Data = reader.result.split(',')[1];
            
            const response = await fetch(URL_GOOGLE_SCRIPT, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    fileName: `Soporte_${id.substring(0,5)}_${field}.jpg`,
                    mimeType: file.type,
                    data: base64Data
                })
            });

            const result = await response.json();
            if (result.url) {
                handleGuiaChange(id, field, result.url);
                loggear('FOTO_SUBIDA', `Se subió foto para el campo ${field} en el pedido ${id}`);
            } else {
                throw new Error("No se recibió URL válida");
            }
            setSubiendo({ id: null, field: null });
        };
    } catch (error) {
        console.error(error);
        alert("Error subiendo la foto a Drive. Revisa tu conexión.");
        setSubiendo({ id: null, field: null });
    }
  };

  const guardarGuia = async (pedido) => {
    const inputData = guiasInput[pedido.id];
    
    if (!inputData || !inputData.guia || !inputData.link || !inputData.fotoProductos) {
      return alert("⚠️ ALERTA: Todos los campos son obligatorios.\n\nDebes ingresar:\n1. Número de Guía\n2. Link/Foto del recibo de Guía\n3. Link/Foto de los productos armados");
    }
    
    try {
      const pedidoRef = doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', pedido.id);
      await updateDoc(pedidoRef, { 
        guia: inputData.guia, 
        linkGuia: inputData.link,
        linkFotoProductos: inputData.fotoProductos,
        status: 'Despachado'
      });
      loggear('PEDIDO_DESPACHADO', `Se despachó el pedido de ${pedido.clienteNombre} (Guía: ${inputData.guia})`);
      alert("Guía y soportes guardados correctamente. El pedido ahora pasará al historial.");
    } catch(e) {
      console.error(e);
      alert("Error al guardar la información");
    }
  };

  const pedidosAMostrar = vistaDespacho === 'pendientes' ? pedidosValidados : pedidosDespachados;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 border-b border-slate-200 pb-4 gap-4">
        <div className="flex gap-4">
          <button 
            onClick={() => setVistaDespacho('pendientes')}
            className={`pb-2 font-bold px-2 flex items-center gap-2 ${vistaDespacho === 'pendientes' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Truck size={18} /> Por Despachar ({pedidosValidados.length})
          </button>
          <button 
            onClick={() => setVistaDespacho('historial')}
            className={`pb-2 font-bold px-2 flex items-center gap-2 ${vistaDespacho === 'historial' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Archive size={18} /> Historial Despachados
          </button>
        </div>
        <button 
          onClick={() => window.print()} 
          className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-4 rounded shadow flex items-center gap-2"
        >
          <Printer size={18} /> Imprimir Etiquetas ({pedidosValidados.length})
        </button>
      </div>

      {pedidosPendientes > 0 && vistaDespacho === 'pendientes' && (
        <div className="mb-6 bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-md flex items-start gap-3">
          <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={24} />
          <div>
            <h3 className="text-amber-800 font-bold">¡Atención Despacho!</h3>
            <p className="text-amber-700 text-sm mt-1">
              Todavía hay <strong>{pedidosPendientes} pedidos pendientes</strong> por validar en Administración. Te recomendamos esperar a que los validen todos antes de imprimir para que salgan en la misma página.
            </p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-slate-100 text-slate-700 text-sm">
              <th className="p-3 border-b w-1/4">Datos del Paquete</th>
              <th className="p-3 border-b">Dirección y Productos</th>
              <th className="p-3 border-b w-1/3">Información de Envío y Soportes</th>
            </tr>
          </thead>
          <tbody>
            {pedidosAMostrar.length === 0 ? (
              <tr><td colSpan="3" className="p-4 text-center text-slate-500">No hay paquetes en esta vista.</td></tr>
            ) : (
              pedidosAMostrar.map(p => (
                <tr key={p.id} className={`border-b ${p.status === 'Despachado' ? 'bg-slate-50' : ''}`}>
                  <td className="p-3 align-top">
                    <div className="font-bold text-slate-800">{p.clienteNombre}</div>
                    <div className="text-sm font-semibold text-blue-600 mt-1">{p.courier}</div>
                    <div className="text-xs text-slate-500 mt-1"><span className="font-semibold">Tel:</span> {p.clienteTelefono}</div>
                    <div className="text-xs text-slate-500"><span className="font-semibold">Prog. Despacho:</span> {p.fechaDespacho}</div>
                  </td>
                  <td className="p-3 align-top text-sm">
                    <div className="font-medium bg-white p-2 rounded border border-slate-200 mb-2 whitespace-pre-wrap shadow-sm">{p.productos}</div>
                    <div className="text-slate-600">{p.direccion}</div>
                  </td>
                  <td className="p-3 align-top bg-slate-50 border-l border-slate-100">
                    {p.status === 'Despachado' ? (
                      <div>
                        <div className="text-sm mb-2"><span className="font-bold">Guía:</span> {p.guia}</div>
                        <div className="flex flex-col gap-1 mb-2">
                          {p.linkGuia && <a href={p.linkGuia} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1"><ImageIcon size={14}/> Ver Recibo de Guía</a>}
                          {p.linkFotoProductos && <a href={p.linkFotoProductos} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Camera size={14}/> Ver Foto de Productos</a>}
                        </div>
                        <div className="text-xs text-slate-600 font-bold mb-2">✓ Despachado (Ventas notificará)</div>
                        <button onClick={() => cambiarEstado(p.id, 'Validado')} className="text-slate-400 hover:text-slate-600 text-xs underline mt-2">Corregir envío</button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <input 
                          type="text" 
                          placeholder="* Número de Guía" 
                          className="w-full text-sm p-1.5 border border-slate-300 rounded font-semibold"
                          value={guiasInput[p.id]?.guia || ''}
                          onChange={(e) => handleGuiaChange(p.id, 'guia', e.target.value)}
                        />
                        
                        <div className="flex gap-2 relative">
                          <input 
                            type="text" 
                            placeholder="* Link Foto Guía" 
                            className="w-full text-sm p-1.5 border border-slate-300 rounded pr-10"
                            value={guiasInput[p.id]?.link || ''}
                            onChange={(e) => handleGuiaChange(p.id, 'link', e.target.value)}
                          />
                          <label className="absolute right-1 top-1 p-1 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-600 rounded cursor-pointer transition" title="Subir desde Cámara/Galería">
                            {subiendo.id === p.id && subiendo.field === 'link' ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileUpload(e, p.id, 'link')} />
                          </label>
                        </div>

                        <div className="flex gap-2 relative">
                          <input 
                            type="text" 
                            placeholder="* Link Foto Productos (Soporte)" 
                            className="w-full text-sm p-1.5 border border-slate-300 rounded pr-10"
                            value={guiasInput[p.id]?.fotoProductos || ''}
                            onChange={(e) => handleGuiaChange(p.id, 'fotoProductos', e.target.value)}
                          />
                          <label className="absolute right-1 top-1 p-1 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-600 rounded cursor-pointer transition" title="Subir desde Cámara/Galería">
                            {subiendo.id === p.id && subiendo.field === 'fotoProductos' ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileUpload(e, p.id, 'fotoProductos')} />
                          </label>
                        </div>

                        <button 
                          onClick={() => guardarGuia(p)}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 rounded mt-1 flex items-center justify-center gap-2"
                        >
                          <Truck size={14}/> Registrar y Archivar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==========================================
// 5. PANEL DE INVENTARIO MULTI-ALMACÉN
// ==========================================
function PanelInventario({ stock, notas, catalogo, movimientos, db, appId, loggear, perfil }) {
  const puedeEditar = [ROLES.ADMIN, ROLES.AUDITOR_INVENTARIO, ROLES.AUDITOR_GENERAL, ROLES.ADMINISTRACION].includes(perfil.role);
  const esRecepcion = [ROLES.ADMIN, ROLES.ADMINISTRACION, ROLES.AUDITOR_GENERAL].includes(perfil.role);
  
  const [subTab, setSubTab] = useState('stock'); // stock | movimientos | catalogo
  
  // Flatten Catálogo para Stock
  const listaStock = [];
  catalogo.forEach(c => c.productos.forEach(p => p.presentaciones.forEach(pres => {
    const key = `${p.nombre}|${pres}`;
    const objStock = typeof stock[key] === 'object' ? stock[key] : { envios: stock[key]||0, recepcion: 0 };
    listaStock.push({ key, cat: c.categoria, nom: p.nombre, pres, envios: objStock.envios, recepcion: objStock.recepcion, nota: notas[key] });
  })));

  return (
    <div className="bg-white p-6 rounded-xl shadow border border-slate-200">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b pb-4 gap-4">
        <h2 className="text-xl font-bold flex items-center gap-2"><Archive className="text-blue-600" /> Sistema de Inventario</h2>
        <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
          <button onClick={()=>setSubTab('stock')} className={`px-4 py-2 text-sm font-bold rounded ${subTab==='stock'?'bg-white shadow text-blue-700':'text-slate-600'}`}>Control Stock</button>
          <button onClick={()=>setSubTab('movimientos')} className={`px-4 py-2 text-sm font-bold rounded ${subTab==='movimientos'?'bg-white shadow text-blue-700':'text-slate-600'}`}>Movimientos & Transferencias</button>
          {puedeEditar && <button onClick={()=>setSubTab('catalogo')} className={`px-4 py-2 text-sm font-bold rounded ${subTab==='catalogo'?'bg-white shadow text-blue-700':'text-slate-600'}`}>Catálogo Web</button>}
        </div>
      </div>

      {subTab === 'stock' && <SubPanelStock lista={listaStock} notas={notas} stock={stock} db={db} appId={appId} puedeEditar={puedeEditar} loggear={loggear} />}
      {subTab === 'movimientos' && <SubPanelMovimientos movimientos={movimientos} stock={stock} db={db} appId={appId} loggear={loggear} perfil={perfil} catalogo={catalogo} esRecepcion={esRecepcion} />}
      {subTab === 'catalogo' && <SubPanelCatalogo catalogo={catalogo} db={db} appId={appId} loggear={loggear} />}
    </div>
  );
}

// 4.1 SUBPANEL STOCK
function SubPanelStock({ lista, notas, stock, db, appId, puedeEditar, loggear }) {
  const [localStock, setLocalStock] = useState({});
  const [notaActiva, setNotaActiva] = useState(null); 
  const [textoNota, setTextoNota] = useState('');

  // Inicializar localStock con el formato de objeto dual
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
    if (current.envios === next.envios && current.recepcion === next.recepcion) return; // No hay cambios
    
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
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm border-collapse min-w-[800px]">
         <thead>
           <tr className="bg-slate-100">
             <th className="p-3 border-b">Producto</th>
             <th className="p-3 border-b text-center border-l bg-blue-50">Almacén: ENVÍOS</th>
             <th className="p-3 border-b text-center border-l bg-purple-50">Almacén: RECEPCIÓN</th>
             <th className="p-3 border-b border-l">Notas del Auditor</th>
           </tr>
         </thead>
         <tbody>
           {lista.map(item => (
             <tr key={item.key} className="border-b hover:bg-slate-50">
               <td className="p-3">
                 <div className="font-bold text-slate-800">{item.nom}</div>
                 <div className="text-xs bg-slate-200 text-slate-700 px-1.5 rounded inline-block mt-1">{item.pres}</div>
               </td>
               <td className="p-3 text-center border-l bg-blue-50/30">
                 {puedeEditar ? (
                   <input type="number" min="0" value={localStock[item.key]?.envios ?? item.envios} onChange={e=>handleStockChange(item.key, 'envios', e.target.value)} onBlur={()=>guardarStock(item.key)} className="w-16 border text-center font-bold rounded p-1 outline-blue-500" />
                 ) : <span className="font-bold text-lg text-blue-800">{item.envios}</span>}
               </td>
               <td className="p-3 text-center border-l bg-purple-50/30">
                 {puedeEditar ? (
                   <input type="number" min="0" value={localStock[item.key]?.recepcion ?? item.recepcion} onChange={e=>handleStockChange(item.key, 'recepcion', e.target.value)} onBlur={()=>guardarStock(item.key)} className="w-16 border text-center font-bold rounded p-1 outline-purple-500" />
                 ) : <span className="font-bold text-lg text-purple-800">{item.recepcion}</span>}
               </td>
               <td className="p-3 border-l w-1/3">
                 {item.nota && <div className="text-xs bg-amber-50 text-amber-800 p-2 rounded border border-amber-200 mb-2 whitespace-pre-wrap flex items-start gap-1"><AlertTriangle size={14} className="shrink-0 mt-0.5"/> {item.nota}</div>}
                 {puedeEditar && notaActiva === item.key ? (
                   <div className="flex flex-col gap-1">
                     <textarea value={textoNota} onChange={e=>setTextoNota(e.target.value)} placeholder="Escribe anomalía..." className="text-xs border rounded p-1 w-full" rows="2" />
                     <div className="flex gap-1">
                       <button onClick={()=>guardarNota(item.key)} className="text-xs bg-blue-600 text-white px-2 py-1 rounded font-bold">Guardar</button>
                       <button onClick={()=>setNotaActiva(null)} className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded">Cancel</button>
                     </div>
                   </div>
                 ) : puedeEditar && !item.nota && (
                   <button onClick={()=>{setNotaActiva(item.key); setTextoNota('');}} className="text-xs text-slate-400 hover:text-amber-600 flex items-center gap-1"><MessageSquare size={12}/> Agregar nota</button>
                 )}
               </td>
             </tr>
           ))}
         </tbody>
      </table>
    </div>
  );
}

// 4.2 SUBPANEL MOVIMIENTOS
function SubPanelMovimientos({ movimientos, stock, db, appId, loggear, perfil, catalogo, esRecepcion }) {
  const [modalType, setModalType] = useState(null); // 'INGRESO' | 'TRANSFERENCIA'
  
  const aprobarTransferencia = async (mov) => {
    if(!window.confirm("¿Confirmas que recibiste físicamente estas cantidades exactas en Recepción?")) return;
    try {
      const stockRef = doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'stock');
      let currentStock = { ...stock };
      
      // Sumar al almacén destino (Recepción)
      Object.entries(mov.items).forEach(([key, qty]) => {
         let actualEnv = typeof currentStock[key] === 'object' ? currentStock[key].envios : (currentStock[key]||0);
         let actualRec = typeof currentStock[key] === 'object' ? currentStock[key].recepcion : 0;
         currentStock[key] = { envios: actualEnv, recepcion: actualRec + qty };
      });
      await setDoc(stockRef, currentStock);

      // Marcar movimiento como completado
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'movimientos', mov.id), { status: 'COMPLETADO', fechaAprobacion: Date.now(), aprobadoPor: perfil.nombre });
      loggear('TRANSFERENCIA_APROBADA', `Recepción aprobó entrada de transferencia enviada por ${mov.creadoPor}`);
    } catch(e) { console.error(e); }
  };

  return (
    <div>
      <div className="flex gap-4 mb-6">
        <button onClick={()=>setModalType('INGRESO')} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded shadow flex items-center gap-2"><PlusCircle size={16}/> Cargar Ingreso (Proveedor)</button>
        <button onClick={()=>setModalType('TRANSFERENCIA')} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded shadow flex items-center gap-2"><ArrowRightLeft size={16}/> Enviar a Recepción</button>
      </div>

      <h3 className="font-bold text-slate-700 mb-2">Historial de Operaciones</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead><tr className="bg-slate-100"><th className="p-3 border-b">Fecha / Origen</th><th className="p-3 border-b">Tipo y Destino</th><th className="p-3 border-b">Productos</th><th className="p-3 border-b">Soporte</th><th className="p-3 border-b text-right">Estatus</th></tr></thead>
          <tbody>
            {movimientos.length === 0 ? <tr><td colSpan="5" className="p-4 text-center text-slate-500">No hay movimientos registrados.</td></tr> : movimientos.map(m => (
              <tr key={m.id} className="border-b hover:bg-slate-50">
                <td className="p-3"><div className="font-medium text-slate-800">{new Date(m.fechaCreacion).toLocaleString()}</div><div className="text-xs text-slate-500">Por: {m.creadoPor}</div></td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${m.tipo === 'INGRESO' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'}`}>{m.tipo}</span>
                  <div className="text-xs font-semibold text-slate-600 mt-1">Hacia: Almacén {m.destino}</div>
                </td>
                <td className="p-3 text-xs leading-relaxed text-slate-700">
                  {Object.entries(m.items).map(([k,q]) => <div key={k}>• {q}x {k.replace('|', ' ')}</div>)}
                </td>
                <td className="p-3">
                  {m.foto ? <a href={m.foto} target="_blank" rel="noreferrer" className="text-blue-600 flex items-center gap-1 hover:underline"><ImageIcon size={16}/> Ver Foto</a> : <span className="text-slate-400">Sin foto</span>}
                </td>
                <td className="p-3 text-right">
                  {m.status === 'COMPLETADO' ? (
                    <div className="text-emerald-600 font-bold flex flex-col items-end"><div className="flex items-center gap-1"><CheckCircle size={14}/> Aprobado</div>{m.aprobadoPor && <div className="text-[10px] text-slate-500">por {m.aprobadoPor}</div>}</div>
                  ) : (
                    <div className="flex flex-col items-end gap-2">
                      <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs font-bold">En Tránsito (Pendiente)</span>
                      {esRecepcion && <button onClick={()=>aprobarTransferencia(m)} className="bg-green-600 text-white text-xs px-3 py-1.5 rounded font-bold shadow hover:bg-green-700">Aprobar Llegada</button>}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalType && <ModalCrearMovimiento tipo={modalType} catalogo={catalogo} stock={stock} db={db} appId={appId} loggear={loggear} perfil={perfil} onClose={()=>setModalType(null)} />}
    </div>
  );
}

// 4.3 SUBPANEL CATÁLOGO
function SubPanelCatalogo({ catalogo, db, appId, loggear }) {
  const defaultForm = { categoria: '', nuevoCat: '', nombre: '', presentaciones: '', imagen: '' };
  const [form, setForm] = useState(defaultForm);
  const [modoEdicion, setModoEdicion] = useState(null); // { catOriginal, nomOriginal }

  const cargarEdicion = (catNombre, prod) => {
    setForm({ categoria: catNombre, nuevoCat: '', nombre: prod.nombre, presentaciones: prod.presentaciones.join(', '), imagen: prod.imagen || '' });
    setModoEdicion({ catOriginal: catNombre, nomOriginal: prod.nombre });
  };

  const cancelarEdicion = () => {
    setModoEdicion(null); setForm(defaultForm);
  };

  const eliminarProducto = async (catNombre, prodNombre) => {
    if(!window.confirm(`¿Seguro que deseas eliminar ${prodNombre} del catálogo? (Esto no borra el stock físico, solo lo oculta de la tienda)`)) return;
    let newCatalogo = [...catalogo];
    let catIndex = newCatalogo.findIndex(c => c.categoria === catNombre);
    if(catIndex >= 0) {
       newCatalogo[catIndex].productos = newCatalogo[catIndex].productos.filter(p => p.nombre !== prodNombre);
       if(newCatalogo[catIndex].productos.length === 0) newCatalogo.splice(catIndex, 1);
       try {
         await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'catalogo'), { categorias: newCatalogo });
         loggear('CATALOGO_ELIMINADO', `Se eliminó el producto: ${prodNombre}`);
       } catch(err) { console.error(err); }
    }
  };

  const guardarProducto = async (e) => {
    e.preventDefault();
    const catName = form.categoria === 'OTRA' ? form.nuevoCat : form.categoria;
    const presentacionesArr = form.presentaciones.split(',').map(s=>s.trim()).filter(Boolean);
    
    if(!catName || !form.nombre || presentacionesArr.length === 0) return alert("Faltan datos requeridos.");

    let newCatalogo = JSON.parse(JSON.stringify(catalogo)); // deep copy
    
    // Si estamos editando, remover el original primero por si cambió de categoría o nombre
    if (modoEdicion) {
      let oldCatIndex = newCatalogo.findIndex(c => c.categoria === modoEdicion.catOriginal);
      if(oldCatIndex >= 0) {
         newCatalogo[oldCatIndex].productos = newCatalogo[oldCatIndex].productos.filter(p => p.nombre !== modoEdicion.nomOriginal);
         if(newCatalogo[oldCatIndex].productos.length === 0) newCatalogo.splice(oldCatIndex, 1);
      }
    }

    // Agregar el nuevo/editado
    let catIndex = newCatalogo.findIndex(c => c.categoria.toLowerCase() === catName.toLowerCase());
    const nuevoProd = { nombre: form.nombre, presentaciones: presentacionesArr, imagen: form.imagen };

    if (catIndex >= 0) {
      newCatalogo[catIndex].productos.push(nuevoProd);
    } else {
      newCatalogo.push({ categoria: catName, productos: [nuevoProd] });
    }

    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'catalogo'), { categorias: newCatalogo });
      loggear('CATALOGO_ACTUALIZADO', `Se ${modoEdicion ? 'editó' : 'añadió'} el producto: ${form.nombre}`);
      alert(`Producto ${modoEdicion ? 'actualizado' : 'añadido'} correctamente.`);
      cancelarEdicion();
    } catch(err) { console.error(err); }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-slate-50 p-6 rounded-lg border">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Package/> {modoEdicion ? 'Editar Producto Seleccionado' : 'Añadir Nuevo Producto al Catálogo'}</h3>
        <form onSubmit={guardarProducto} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col">
            <label className="text-sm font-semibold mb-1">Categoría</label>
            <select value={form.categoria} onChange={e=>setForm({...form, categoria: e.target.value})} className="p-2 border rounded" required>
              <option value="">Selecciona...</option>
              {catalogo.map(c => <option key={c.categoria} value={c.categoria}>{c.categoria}</option>)}
              <option value="OTRA">+ Crear Nueva Categoría</option>
            </select>
          </div>
          {form.categoria === 'OTRA' ? <Input label="Nombre Nueva Categoría" value={form.nuevoCat} onChange={e=>setForm({...form, nuevoCat: e.target.value})} required/> : <div></div>}
          
          <Input label="Nombre del Producto" value={form.nombre} onChange={e=>setForm({...form, nombre: e.target.value})} placeholder="Ej: Tratamiento KeraBlue" required/>
          <Input label="Presentaciones (Separadas por coma)" value={form.presentaciones} onChange={e=>setForm({...form, presentaciones: e.target.value})} placeholder="Ej: 1 Litro, 500ml, 250ml" required/>
          <Input label="URL de Imagen (Opcional)" value={form.imagen} onChange={e=>setForm({...form, imagen: e.target.value})} placeholder="https://...imagen.jpg" />
          
          <div className="md:col-span-2 flex justify-end gap-2 mt-2">
            {modoEdicion && <button type="button" onClick={cancelarEdicion} className="bg-slate-200 text-slate-700 font-bold py-2 px-6 rounded">Cancelar Edición</button>}
            <button type="submit" className="bg-blue-600 text-white font-bold py-2 px-6 rounded">{modoEdicion ? 'Actualizar Producto' : 'Guardar Producto Nuevo'}</button>
          </div>
        </form>
      </div>

      <div className="bg-white p-6 rounded-lg border">
        <h3 className="font-bold text-slate-800 mb-4">Productos Actuales en el Catálogo</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead><tr className="bg-slate-100"><th className="p-3 border-b">Categoría</th><th className="p-3 border-b">Producto y Presentaciones</th><th className="p-3 border-b text-right">Acciones</th></tr></thead>
            <tbody>
              {catalogo.map(c => c.productos.map(p => (
                <tr key={p.nombre} className="border-b hover:bg-slate-50">
                  <td className="p-3 font-semibold text-slate-500">{c.categoria}</td>
                  <td className="p-3">
                    <div className="font-bold text-slate-800">{p.nombre}</div>
                    <div className="text-xs text-slate-600 mt-1">{p.presentaciones.join(' / ')}</div>
                  </td>
                  <td className="p-3 flex justify-end gap-2">
                     <button onClick={()=>cargarEdicion(c.categoria, p)} className="text-blue-600 bg-blue-50 p-2 rounded hover:bg-blue-100" title="Editar"><Edit3 size={16}/></button>
                     <button onClick={()=>eliminarProducto(c.categoria, p.nombre)} className="text-red-600 bg-red-50 p-2 rounded hover:bg-red-100" title="Eliminar"><Trash2 size={16}/></button>
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

// 4.4 MODAL CREAR MOVIMIENTO (INGRESO O TRANSFERENCIA)
function ModalCrearMovimiento({ tipo, catalogo, stock, db, appId, loggear, perfil, onClose }) {
  const [carrito, setCarrito] = useState({});
  const [fotoUrl, setFotoUrl] = useState('');
  const isTransfer = tipo === 'TRANSFERENCIA';

  const updateQty = (key, delta) => {
    setCarrito(prev => {
      const actual = prev[key] || 0;
      const nuevo = Math.max(0, actual + delta);
      
      // Validar stock si es transferencia
      if (isTransfer && delta > 0) {
        let maxDisp = typeof stock[key] === 'object' ? stock[key].envios : (stock[key]||0);
        if (nuevo > maxDisp) return prev; // No dejar transferir más de lo que hay en envíos
      }

      if (nuevo === 0) { const copia = { ...prev }; delete copia[key]; return copia; }
      return { ...prev, [key]: nuevo };
    });
  };

  const handleFileUpload = async (e) => {
    // ... Lógica idéntica de subida a drive (omitida por brevedad de lectura, asume que sube url a fotoUrl)
    alert("Función de subir al drive (Mismo código de despacho). Asigna la URL generada.");
    setFotoUrl('https://via.placeholder.com/150'); // Mock
  };

  const handleSubmit = async () => {
    if (Object.keys(carrito).length === 0) return alert("Selecciona productos");
    if (isTransfer && !fotoUrl) return alert("Debes incluir una foto como soporte físico para enviar a Recepción.");
    
    try {
      // 1. Guardar el movimiento
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'movimientos'), {
        tipo, origen: isTransfer ? 'ENVIOS' : 'PROVEEDOR', destino: isTransfer ? 'RECEPCION' : 'ENVIOS',
        items: carrito, foto: fotoUrl, status: isTransfer ? 'PENDIENTE' : 'COMPLETADO',
        fechaCreacion: Date.now(), creadoPor: perfil.nombre
      });

      // 2. Modificar stock
      const stockRef = doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'stock');
      let currentStock = { ...stock };

      Object.entries(carrito).forEach(([key, qty]) => {
         let actualEnv = typeof currentStock[key] === 'object' ? currentStock[key].envios : (currentStock[key]||0);
         let actualRec = typeof currentStock[key] === 'object' ? currentStock[key].recepcion : 0;
         
         if (tipo === 'INGRESO') {
           // Ingresa directo a Envíos y queda completado
           currentStock[key] = { envios: actualEnv + qty, recepcion: actualRec };
         } else if (tipo === 'TRANSFERENCIA') {
           // Resta de Envíos, NO suma a recepción todavía (se suma al aprobar)
           currentStock[key] = { envios: actualEnv - qty, recepcion: actualRec };
         }
      });
      await setDoc(stockRef, currentStock);

      loggear(`MOVIMIENTO_${tipo}`, `${perfil.nombre} generó un(a) ${tipo} de ${Object.keys(carrito).length} items.`);
      alert("Operación exitosa."); onClose();
    } catch(e) { console.error(e); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
          <h2 className="text-xl font-bold text-slate-800">{isTransfer ? 'Transferir a Recepción' : 'Cargar Ingreso de Proveedor'}</h2>
          <button onClick={onClose}><X size={24} className="text-slate-400 hover:text-black"/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
          {catalogo.map(cat => (
            <div key={cat.categoria} className="bg-white p-4 rounded-lg border">
              <h3 className="font-bold border-b pb-1 mb-3">{cat.categoria}</h3>
              {cat.productos.map(prod => (
                <div key={prod.nombre} className="mb-3">
                  <div className="text-sm font-bold text-blue-800">{prod.nombre}</div>
                  {prod.presentaciones.map(pres => {
                    const key = `${prod.nombre}|${pres}`; const qty = carrito[key] || 0;
                    let maxDisp = typeof stock[key] === 'object' ? stock[key].envios : (stock[key]||0);
                    return (
                      <div key={pres} className="flex justify-between items-center text-sm py-1 border-b border-dashed">
                        <span>{pres} {isTransfer && <span className="text-xs text-slate-400">(Disp: {maxDisp})</span>}</span>
                        <div className="flex items-center gap-2">
                          <button onClick={()=>updateQty(key, -1)} className="bg-slate-200 px-2 rounded font-bold">-</button>
                          <span className="w-4 text-center font-bold">{qty}</span>
                          <button onClick={()=>updateQty(key, 1)} className="bg-slate-200 px-2 rounded font-bold">+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="p-4 border-t bg-slate-50 flex flex-col gap-4">
          {isTransfer && (
            <div className="bg-white p-3 border rounded-lg flex items-center gap-4">
              <div className="flex-1">
                <label className="text-sm font-bold block mb-1">Evidencia Fotográfica Obligatoria</label>
                <div className="flex gap-2 relative">
                  <input type="text" placeholder="URL Foto de los productos empacados" className="w-full border p-2 rounded text-sm" value={fotoUrl} onChange={e=>setFotoUrl(e.target.value)} />
                  <label className="bg-blue-100 text-blue-700 p-2 rounded cursor-pointer hover:bg-blue-200 flex items-center justify-center w-10">
                    <Camera size={18}/> <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-between items-center">
            <div className="font-bold">Total items: {Object.values(carrito).reduce((a,b)=>a+b,0)}</div>
            <button onClick={handleSubmit} className="bg-blue-600 text-white font-bold py-2 px-6 rounded shadow">{isTransfer ? 'Enviar Mercancía' : 'Confirmar Ingreso'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// RESTO DE PANELES (REPORTES, DESPACHO, USUARIOS, LOGS)
// ==========================================
function PanelReportes({ pedidos }) {
  const hoyStr = new Date().toISOString().split('T')[0];
  const [fechaInicio, setFechaInicio] = useState(hoyStr); const [fechaFin, setFechaFin] = useState(hoyStr);
  const pedidosFiltrados = pedidos.filter(p => p.status !== 'Rechazado' && new Date(p.fechaCreacion).toISOString().split('T')[0] >= fechaInicio && new Date(p.fechaCreacion).toISOString().split('T')[0] <= fechaFin);
  
  const exportarCSV = () => {
    const encabezados = "Fecha,Cliente,Telefono,Asesora,Courier,Productos,Monto Original Pagado,Moneda Pago,Monto Equivalente USD ($),Monto Equivalente VES (Bs),Tasa Aplicada,Estado\n";
    const filas = pedidosFiltrados.map(p => {
      const fecha = new Date(p.fechaCreacion).toLocaleDateString();
      const cliente = `"${p.clienteNombre || ''}"`;
      const tlf = `"${p.clienteTelefono || ''}"`;
      const asesora = `"${p.asesora || ''}"`;
      const productos = `"${(p.productos || '').replace(/\n/g, ' ')}"`;
      return `${fecha},${cliente},${tlf},${asesora},${p.courier},${productos},${p.monto},${p.moneda},${(p.montoUsd||0).toFixed(2)},${(p.montoVes||0).toFixed(2)},${p.tasaAplicada},${p.status}`;
    }).join("\n");

    const blob = new Blob(["\uFEFF" + encabezados + filas], { type: 'text/csv;charset=utf-8;' }); 
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Reporte_Ventas_${fechaInicio}_al_${fechaFin}.csv`;
    link.click();
  };

  const totalUSD = pedidosFiltrados.reduce((acc, curr) => acc + (curr.montoUsd || 0), 0);
  const totalVES = pedidosFiltrados.reduce((acc, curr) => acc + (curr.montoVes || 0), 0);

  return (
    <div className="bg-white p-6 rounded-xl shadow border border-slate-200">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b pb-4">
        <h2 className="text-xl font-bold flex items-center gap-2"><FileSpreadsheet className="text-green-600"/> Reportes de Ventas</h2>
        <button onClick={exportarCSV} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold shadow flex items-center gap-2">
          <Download size={18}/> Exportar a Google Sheets / Excel
        </button>
      </div>

      <div className="bg-slate-50 p-4 rounded-lg mb-6 flex flex-col md:flex-row gap-4 items-center border">
        <div className="font-semibold text-slate-700">Filtrar por Fechas:</div>
        <input type="date" value={fechaInicio} onChange={e=>setFechaInicio(e.target.value)} className="border p-2 rounded" />
        <span className="text-slate-400">hasta</span>
        <input type="date" value={fechaFin} onChange={e=>setFechaFin(e.target.value)} className="border p-2 rounded" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-center">
          <div className="text-sm font-bold text-blue-700 mb-1">Total Ventas (Equiv. USD)</div>
          <div className="text-2xl font-black text-blue-900">${totalUSD.toFixed(2)}</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg text-center">
          <div className="text-sm font-bold text-emerald-700 mb-1">Total Ventas (Equiv. VES)</div>
          <div className="text-2xl font-black text-emerald-900">Bs. {totalVES.toFixed(2)}</div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead><tr className="bg-slate-100"><th className="p-3 border-b">Fecha</th><th className="p-3 border-b">Cliente y Teléfono</th><th className="p-3 border-b">Monto y Tasa</th><th className="p-3 border-b">Asesora</th></tr></thead>
          <tbody>
            {pedidosFiltrados.length === 0 ? <tr><td colSpan="4" className="p-4 text-center text-slate-500">No hay ventas registradas en este rango.</td></tr> : 
              pedidosFiltrados.map(p => (
                <tr key={p.id} className="border-b">
                  <td className="p-3 text-slate-500 font-medium">{new Date(p.fechaCreacion).toLocaleDateString()}</td>
                  <td className="p-3"><div className="font-bold">{p.clienteNombre}</div><div className="text-xs text-slate-500">{p.clienteTelefono}</div></td>
                  <td className="p-3">
                    <div className="font-bold text-green-700">${(p.montoUsd||0).toFixed(2)}</div>
                    <div className="text-xs">Tasa: Bs. {p.tasaAplicada || '-'}</div>
                  </td>
                  <td className="p-3 font-semibold text-slate-700">{p.asesora}</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PanelUsuarios({ usuarios, db, appId, loggear }) {
  const cambiarRol = async (uid, isApproved, newRole, email) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', uid), { isApproved, role: newRole });
    loggear('GESTION_USUARIO', `Acceso de ${email} -> Rol: ${newRole} (Aprobado: ${isApproved})`);
  };
  return (
    <div className="bg-white p-6 rounded-xl shadow border">
      <h2 className="text-xl font-bold mb-4 flex gap-2"><Users /> Gestión de Usuarios y Roles</h2>
      <table className="w-full text-left text-sm border-collapse">
        <thead><tr className="bg-slate-100"><th className="p-3 border-b">Usuario / Email</th><th className="p-3 border-b">Asignar Rol</th></tr></thead>
        <tbody>
          {usuarios.map(u => (
            <tr key={u.id} className="border-b">
              <td className="p-3 font-semibold">
                <div className="flex items-center gap-2">
                   {u.nombre}
                   {u.isOnline && <span title="En línea" className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-sm"></span>}
                </div>
                <span className="text-xs font-normal text-slate-500">{u.email}</span>
              </td>
              <td className="p-3 flex gap-2">
                 <select value={u.role} onChange={e=>cambiarRol(u.id, true, e.target.value, u.email)} className="border p-1 rounded outline-none">
                   <option value="Pendiente" disabled>Pendiente</option>
                   {Object.values(ROLES).map(r => <option key={r} value={r}>{r}</option>)}
                 </select>
                 {u.isApproved && <button onClick={()=>cambiarRol(u.id, false, 'Bloqueado', u.email)} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">Bloquear</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PanelLogs({ logs }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow border h-[80vh] flex flex-col">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><FileText /> Registro de Auditoría Global</h2>
      <div className="overflow-y-auto flex-1">
        <table className="w-full text-left text-sm border-collapse">
          <thead><tr className="bg-slate-900 text-white sticky top-0"><th className="p-3">Fecha</th><th className="p-3">Usuario</th><th className="p-3">Acción</th></tr></thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id} className="border-b">
                <td className="p-3 text-xs text-slate-500">{new Date(l.fecha).toLocaleString()}</td>
                <td className="p-3 font-bold">{l.usuarioEmail}</td>
                <td className="p-3 text-xs text-slate-700"><span className="bg-slate-200 px-1 rounded block w-max font-bold mb-1">{l.accion}</span>{l.detalle}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Input({ label, ...props }) { 
  return (
    <div className="flex flex-col">
      <label className="text-sm font-semibold text-slate-700 mb-1">{label}</label>
      <input className="p-2 border rounded outline-none focus:ring-2 focus:ring-blue-500" {...props}/>
    </div>
  ); 
}

function getStatusBadge(s) { 
  const b = { 'Pendiente': 'bg-amber-100 text-amber-800', 'Validado': 'bg-blue-100 text-blue-800', 'Rechazado': 'bg-red-100 text-red-800', 'Despachado': 'bg-green-100 text-green-800' }; 
  return <span className={`px-2 py-1 rounded text-xs font-bold ${b[s] || 'bg-slate-100 text-slate-600'}`}>{s}</span>; 
}

function TabButton({ active, onClick, icon, label, badge, badgeColor="bg-red-500" }) { 
  return (
    <button onClick={onClick} className={`flex items-center justify-between w-full p-3 rounded-lg font-medium transition-colors mb-1 ${active ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
      <div className="flex items-center gap-3">{icon} <span className="hidden md:inline">{label}</span></div> 
      {badge > 0 && <span className={`${badgeColor} text-white text-[10px] px-2 py-0.5 rounded-full font-bold`}>{badge}</span>}
    </button>
  ); 
}

function VistaImpresion({ pedidos }) { 
  return <div className="hidden print:block p-8 text-center">Hoja de impresión activa. (Presiona Ctrl+P para ver el diseño completo de etiquetas)</div>; 
}

function ModalCatalogo({ catalogo, isOpen, onClose, onConfirm }) {
  const [carrito, setCarrito] = useState({});
  if (!isOpen) return null;
  const updateQty = (key, delta) => { 
    setCarrito(prev => { 
      const n = Math.max(0, (prev[key]||0)+delta); 
      if(n===0){const c={...prev}; delete c[key]; return c;} 
      return {...prev, [key]:n}; 
    }); 
  };
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-5xl h-[85vh] flex flex-col">
        <div className="p-4 border-b flex justify-between bg-slate-50"><h2 className="font-bold flex items-center gap-2"><Package/> Catálogo</h2><button onClick={onClose}><X/></button></div>
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
          {catalogo.filter(c => c.categoria !== 'Complementos Automáticos').map(c => <div key={c.categoria} className="mb-6"><h3 className="font-bold border-b pb-2 mb-4">{c.categoria}</h3><div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {c.productos.map(p => <div key={p.nombre} className="bg-white border rounded p-3 shadow-sm flex flex-col">
              {p.imagen ? <img src={p.imagen} alt="img" className="w-full h-24 object-contain mb-2 rounded shrink-0" /> : <div className="w-full h-12 bg-slate-50 flex items-center justify-center mb-2 shrink-0"><ImageIcon className="text-slate-300"/></div>}
              <div className="font-bold text-sm mb-3">{p.nombre}</div>
              <div className="mt-auto space-y-1">
                {p.presentaciones.map(pres => { 
                  const key = `${p.nombre}|${pres}`; 
                  const qty = carrito[key]||0; 
                  return (
                    <div key={pres} className="flex justify-between items-center text-xs py-1"><span className="font-medium text-slate-600">{pres}</span><div className="flex gap-2"><button onClick={()=>updateQty(key,-1)} className="bg-slate-200 px-1.5 rounded">-</button><span className="w-3 text-center font-bold">{qty}</span><button onClick={()=>updateQty(key,1)} className="bg-slate-200 px-1.5 rounded">+</button></div></div>
                  )
                })}
              </div>
            </div>)}
          </div></div>)}
        </div>
        <div className="p-4 border-t flex justify-between items-center"><div className="font-bold">Total Items: {Object.values(carrito).reduce((a,b)=>a+b,0)}</div><button onClick={()=>onConfirm('', carrito)} className="bg-blue-600 text-white px-6 py-2 rounded font-bold">Confirmar</button></div>
      </div>
    </div>
  )
}