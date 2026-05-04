import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { ShoppingCart, CheckSquare, Truck, Printer, Clock, CheckCircle, XCircle, Search, Sparkles, Package, Plus, Minus, X, Image as ImageIcon, Camera, ClipboardList, AlertTriangle, UploadCloud, Loader2, DollarSign, Archive, Edit3, Save, LogOut, ShieldCheck, Users, FileText, MessageSquare, Eye, FileSpreadsheet, Download, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';

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

const URL_GOOGLE_SCRIPT = '';
const GEMINI_API_KEY = typeof __gemini_api_key !== 'undefined' ? __gemini_api_key : '';

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

// --- CATÁLOGO BASE ---
const CATALOGO = [
  { categoria: "Cirugías Capilares", productos: [ { nombre: "Cirugía Clásica", presentaciones: ["Litro", "1/2 Litro", "Galón"] }, { nombre: "Cirugía Chocolate", presentaciones: ["Litro", "1/2 Litro", "Galón"] } ] },
  { categoria: "Alisados", productos: [ { nombre: "Alisado Clásica", presentaciones: ["1 Litro", "300ml"] }, { nombre: "Alisado Chocolate", presentaciones: ["1 Litro", "300ml"] } ] },
  { categoria: "Shampoos y Cuidado", productos: [ { nombre: "Shampoo Tradicional", presentaciones: ["Litro", "1/2 Litro"] }, { nombre: "Anti-Residuos", presentaciones: ["1 Litro", "1/2 Litro"] } ] },
  { categoria: "Boosters y Terapias", productos: [ { nombre: "Terapia Antifrizz", presentaciones: ["500gr"] }, { nombre: "Booster Full Hidratación", presentaciones: ["Unidad"] } ] }
];

// ==========================================
// COMPONENTE PRINCIPAL (RUTEO Y ESTADO GLOBAL)
// ==========================================
export default function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [pedidos, setPedidos] = useState([]);
  const [stockInventario, setStockInventario] = useState({});
  const [notasInventario, setNotasInventario] = useState({});
  const [usuarios, setUsuarios] = useState([]);
  const [logs, setLogs] = useState([]);

  const [activeTab, setActiveTab] = useState('ventas');

  // --- 1. MANEJO DE AUTENTICACIÓN (LOGIN REAL CON GOOGLE) ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        setUser(null);
        setUserProfile(null);
        setAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // --- 2. ESCUCHAR PERFIL DE USUARIO Y REDIRIGIR ---
  useEffect(() => {
    if (!user) return;
    const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid);
    const unsub = onSnapshot(userRef, async (snap) => {
      if (snap.exists()) {
        const profile = snap.data();
        setUserProfile(profile);
        
        // Redirección inicial basada en rol
        if (profile.isApproved && activeTab === 'ventas') {
          if (profile.role === ROLES.ADMINISTRACION) setActiveTab('admin');
          if (profile.role === ROLES.DESPACHO) setActiveTab('despacho');
          if (profile.role === ROLES.AUDITOR_INVENTARIO) setActiveTab('inventario');
          if (profile.role === ROLES.ADMIN || profile.role === ROLES.AUDITOR_GENERAL) setActiveTab('admin');
        }
      } else {
        // Primer login: Crear documento pendiente de aprobación
        const newProfile = {
          uid: user.uid,
          email: user.email,
          nombre: user.displayName || 'Usuario Google',
          foto: user.photoURL || '',
          role: 'Pendiente',
          isApproved: false,
          fechaRegistro: Date.now()
        };
        await setDoc(userRef, newProfile);
        setUserProfile(newProfile);
        registrarLogSistem(newProfile, 'NUEVO_REGISTRO', `El usuario ${user.email} se ha registrado y espera aprobación.`);
      }
      setAuthLoading(false);
    }, (err) => {
      console.error(err);
      setAuthLoading(false);
    });
    return () => unsub();
  }, [user]);

  // --- 3. FUNCIÓN GLOBAL DE LOGS DE AUDITORÍA ---
  const registrarLogSistem = async (perfilActivo, accion, detalle) => {
    try {
      const logsRef = collection(db, 'artifacts', appId, 'public', 'data', 'logs');
      await addDoc(logsRef, {
        accion,
        detalle,
        usuarioEmail: perfilActivo.email,
        usuarioNombre: perfilActivo.nombre,
        usuarioRol: perfilActivo.role,
        fecha: Date.now()
      });
    } catch (e) {
      console.error("Error registrando log:", e);
    }
  };

  const loggear = (accion, detalle) => registrarLogSistem(userProfile, accion, detalle);

  // --- 4. ESCUCHAR DATOS DE FIREBASE ---
  useEffect(() => {
    if (!user || !userProfile || !userProfile.isApproved) return;

    const unsubs = [];

    // Pedidos
    unsubs.push(onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'pedidos'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => b.fechaCreacion - a.fechaCreacion);
      setPedidos(data);
    }));

    // Stock y Notas Inventario
    unsubs.push(onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'stock'), (docSnap) => setStockInventario(docSnap.exists() ? docSnap.data() : {})));
    unsubs.push(onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'notas'), (docSnap) => setNotasInventario(docSnap.exists() ? docSnap.data() : {})));

    // Usuarios y Logs (Solo Admins y Auditores)
    const esAdminOAuditorG = userProfile.role === ROLES.ADMIN || userProfile.role === ROLES.AUDITOR_GENERAL;
    if (esAdminOAuditorG) {
      unsubs.push(onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'users'), (snapshot) => {
        setUsuarios(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }));
      unsubs.push(onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'logs'), (snapshot) => {
        const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        logsData.sort((a, b) => b.fecha - a.fecha); 
        setLogs(logsData);
      }));
    }

    return () => unsubs.forEach(unsub => unsub());
  }, [user, userProfile]);

  // --- ACCIONES GLOBALES REUTILIZABLES ---
  const signInGoogle = async () => {
    try {
      setAuthLoading(true);
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error(error);
      alert("Error al iniciar sesión. Revisa la consola o asegúrate de permitir ventanas emergentes.");
      setAuthLoading(false);
    }
  };

  const cerrarSesion = () => signOut(auth);

  const cambiarEstadoPedido = async (id, nuevoEstado, pedidoActual = null) => {
    try {
      const pedidoRef = doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', id);
      
      // LOGICA INVENTARIO: Descontar solo cuando pasa de Pendiente a Validado
      if (nuevoEstado === 'Validado' && pedidoActual && pedidoActual.status !== 'Validado' && pedidoActual.carritoObj) {
        const stockRef = doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'stock');
        const stockSnap = await getDoc(stockRef);
        let currentStock = stockSnap.exists() ? stockSnap.data() : {};
        
        Object.entries(pedidoActual.carritoObj).forEach(([itemKey, qty]) => {
           currentStock[itemKey] = Math.max(0, (currentStock[itemKey] || 0) - qty);
        });
        await setDoc(stockRef, currentStock);
        loggear('STOCK_DESCONTADO_AUTO', `Se descontó inventario por el Pedido de ${pedidoActual.clienteNombre}`);
      }

      await updateDoc(pedidoRef, { status: nuevoEstado });
      loggear('ESTADO_PEDIDO', `Cambió estado del pedido de ${pedidoActual?.clienteNombre || id} a ${nuevoEstado}`);
    } catch (error) {
      console.error(error);
    }
  };

  // --- VISTAS DE AUTENTICACIÓN ---
  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-blue-600 mb-2" size={48} /><div className="font-bold text-slate-600">Cargando seguridad...</div></div>;

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border-t-8 border-blue-600">
        <Package size={56} className="mx-auto text-blue-600 mb-4" />
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">LogiWeb</h1>
        <p className="text-slate-500 mb-8 mt-2">Sistema logístico empresarial seguro. Ingresa con tu cuenta autorizada.</p>
        <button onClick={signInGoogle} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-3 transition">
          <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
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
        <p className="text-slate-600 mt-2 mb-6">Tu correo <b>{user.email}</b> ha sido registrado exitosamente. Avisa a tu Administrador para que apruebe tu acceso y te asigne un rol.</p>
        <button onClick={cerrarSesion} className="text-blue-600 font-semibold hover:underline">Cerrar sesión y probar otra cuenta</button>
      </div>
    </div>
  );

  // --- PERMISOS DE VISUALIZACIÓN POR ROL ---
  const r = userProfile.role;
  const showVentas = [ROLES.ADMIN, ROLES.VENTAS, ROLES.AUDITOR_VENTAS, ROLES.AUDITOR_GENERAL].includes(r);
  const showAdmin = [ROLES.ADMIN, ROLES.ADMINISTRACION, ROLES.AUDITOR_VENTAS, ROLES.AUDITOR_GENERAL].includes(r);
  const showDespacho = [ROLES.ADMIN, ROLES.DESPACHO, ROLES.AUDITOR_GENERAL].includes(r);
  const showReportes = [ROLES.ADMIN, ROLES.AUDITOR_VENTAS, ROLES.AUDITOR_GENERAL, ROLES.ADMINISTRACION].includes(r);
  const showInventario = [ROLES.ADMIN, ROLES.AUDITOR_INVENTARIO, ROLES.AUDITOR_GENERAL].includes(r);
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
          {showVentas && <TabButton active={activeTab === 'ventas'} onClick={() => setActiveTab('ventas')} icon={<ShoppingCart size={18} />} label="Ventas" />}
          {showAdmin && <TabButton active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} icon={<CheckSquare size={18} />} label={`Admin y Pagos`} badge={pedidos.filter(p=>p.status==='Pendiente').length} />}
          {showDespacho && <TabButton active={activeTab === 'despacho'} onClick={() => setActiveTab('despacho')} icon={<Truck size={18} />} label={`Despacho`} badge={pedidos.filter(p=>p.status==='Validado').length} />}
          
          {(showReportes || showInventario || showUsuarios || showLogs) && <div className="hidden md:block my-4 border-t border-slate-700 mx-2"></div>}
          {(showReportes || showInventario || showUsuarios || showLogs) && <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 hidden md:block">Reportes y Config</div>}

          {showReportes && <TabButton active={activeTab === 'reportes'} onClick={() => setActiveTab('reportes')} icon={<FileSpreadsheet size={18} />} label="Reportes de Ventas" />}
          {showInventario && <TabButton active={activeTab === 'inventario'} onClick={() => setActiveTab('inventario')} icon={<Archive size={18} />} label="Inventario" />}
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
            {activeTab === 'ventas' && showVentas && <PanelVentas perfil={userProfile} pedidos={pedidos} db={db} appId={appId} loggear={loggear} />}
            {activeTab === 'admin' && showAdmin && <PanelAdmin perfil={userProfile} pedidos={pedidos} cambiarEstado={cambiarEstadoPedido} loggear={loggear} db={db} appId={appId} />}
            {activeTab === 'despacho' && showDespacho && <PanelDespacho pedidos={pedidos} cambiarEstado={cambiarEstadoPedido} db={db} appId={appId} loggear={loggear} />}
            {activeTab === 'reportes' && showReportes && <PanelReportes pedidos={pedidos} />}
            {activeTab === 'inventario' && showInventario && <PanelInventario stock={stockInventario} notas={notasInventario} db={db} appId={appId} loggear={loggear} perfil={userProfile} />}
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
// 1. PANEL DE VENTAS (TASA POR PEDIDO)
// ==========================================
function PanelVentas({ perfil, pedidos, db, appId, loggear }) {
  const puedeCrear = [ROLES.ADMIN, ROLES.VENTAS].includes(perfil.role);
  const [vista, setVista] = useState(puedeCrear ? 'nuevo' : 'historial'); 
  const [formData, setFormData] = useState({ 
    clienteNombre: '', clienteCedula: '', clienteTelefono: '', courier: 'ZOOM', direccion: '', productos: '', carritoObj: null, asesora: perfil.nombre, referencia: '', moneda: 'USD', montoPago: '', 
    tasa: '' // Nuevo campo Tasa
  });
  const [enviando, setEnviando] = useState(false);
  const [textoCrudo, setTextoCrudo] = useState('');
  const [analizando, setAnalizando] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);

  const analizarConGemini = async () => {
    if (!textoCrudo.trim()) return alert("Por favor, pega el mensaje de WhatsApp primero.");
    setAnalizando(true);

    try {
      const apiKey = GEMINI_API_KEY; 
      const llavesCatalogo = CATALOGO.flatMap(c => c.productos.flatMap(p => p.presentaciones.map(pres => `${p.nombre}|${pres}`))).join(', ');
      const prompt = `Eres un asistente de logística. Analiza el texto y extrae datos en JSON. 
REGLAS: Courier: 'ZOOM', 'MRW', 'Tealca', 'Domesa'. Moneda: 'USD' o 'VES'. Monto: solo el número. 
En 'productosCrudos' extrae el texto exacto pedido. En 'carrito' mapea a estas llaves: [${llavesCatalogo}]. Texto: ${textoCrudo}`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
         let nuevoCarritoObj = {}; let textoProductosFormateado = result.productosCrudos || '';

         if (result.carrito && result.carrito.length > 0) {
           const lineas = [];
           result.carrito.forEach(item => {
             if (item.llave && item.cantidad) {
               nuevoCarritoObj[item.llave] = item.cantidad;
               const partes = item.llave.split('|');
               if(partes.length === 2) lineas.push(`- ${item.cantidad}x ${partes[0]} (${partes[1]})`);
             }
           });
           if (lineas.length > 0) textoProductosFormateado = lineas.join('\n');
         }

         setFormData(prev => ({
           ...prev,
           clienteNombre: result.clienteNombre || prev.clienteNombre,
           clienteCedula: result.clienteCedula || prev.clienteCedula,
           clienteTelefono: result.clienteTelefono || prev.clienteTelefono,
           courier: result.courier || prev.courier,
           direccion: result.direccion || prev.direccion,
           montoPago: result.montoPago || prev.montoPago,
           moneda: result.moneda || prev.moneda,
           referencia: result.referencia || prev.referencia,
           asesora: result.asesora || prev.asesora,
           productos: textoProductosFormateado || prev.productos,
           carritoObj: Object.keys(nuevoCarritoObj).length > 0 ? nuevoCarritoObj : prev.carritoObj
         }));
      }
    } catch(e) {
      console.error(e); alert("Error API Gemini.");
    } finally { setAnalizando(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.carritoObj || Object.keys(formData.carritoObj).length === 0) return alert("Selecciona productos del Catálogo.");
    if (!formData.tasa || parseFloat(formData.tasa) <= 0) return alert("Por favor, ingresa la Tasa de Cambio aplicada para este pedido.");
    
    setEnviando(true);

    const montoNum = parseFloat(formData.montoPago) || 0;
    const tasaAplicada = parseFloat(formData.tasa);
    const calculo = formData.moneda === 'USD' ? { usd: montoNum, ves: montoNum * tasaAplicada } : { ves: montoNum, usd: tasaAplicada > 0 ? montoNum / tasaAplicada : 0 };

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'pedidos'), {
        ...formData, monto: montoNum, montoUsd: calculo.usd, montoVes: calculo.ves, tasaAplicada: tasaAplicada, status: 'Pendiente', auditado: false, fechaCreacion: Date.now(), fechaDespacho: new Date().toLocaleDateString('es-VE')
      });
      loggear('PEDIDO_CREADO', `Se registró pedido para ${formData.clienteNombre} por $${calculo.usd.toFixed(2)} (Tasa: ${tasaAplicada})`);
      alert("¡Pedido registrado!");
      setFormData({ clienteNombre: '', clienteCedula: '', clienteTelefono: '', courier: 'ZOOM', direccion: '', productos: '', carritoObj: null, montoPago: '', moneda: 'USD', referencia: '', asesora: perfil.nombre, tasa: '' });
      setVista('historial');
    } catch (e) { console.error(e); }
    setEnviando(false);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <div className="flex gap-4 mb-6 border-b pb-4">
        {puedeCrear && <button onClick={() => setVista('nuevo')} className={`pb-2 font-bold flex gap-2 ${vista === 'nuevo' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}><ShoppingCart size={18} /> Registrar Venta</button>}
        <button onClick={() => setVista('historial')} className={`pb-2 font-bold flex gap-2 ${vista === 'historial' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}><ClipboardList size={18} /> Historial Ventas</button>
      </div>

      {vista === 'nuevo' && puedeCrear ? (
        <div>
          <div className="mb-6 bg-indigo-50 p-4 rounded-lg border border-indigo-100">
            <h3 className="text-indigo-800 font-bold mb-2 flex items-center gap-2"><Sparkles size={18} className="text-indigo-600" /> Autocompletar con IA ✨</h3>
            <div className="flex flex-col md:flex-row gap-3">
              <textarea className="flex-1 p-3 border border-indigo-200 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-sm resize-none" rows={2} placeholder="Pega el mensaje de WhatsApp..." value={textoCrudo} onChange={(e) => setTextoCrudo(e.target.value)}></textarea>
              <button type="button" onClick={analizarConGemini} disabled={analizando} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded shadow disabled:opacity-50">
                {analizando ? 'Analizando...' : 'Extraer Datos'}
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
             <Input label="Asesora de Ventas" name="asesora" value={formData.asesora} onChange={(e)=>setFormData({...formData, asesora: e.target.value})} required />
             <Input label="Cliente" name="clienteNombre" value={formData.clienteNombre} onChange={(e)=>setFormData({...formData, clienteNombre: e.target.value})} required />
             <Input label="Cédula / RIF" name="clienteCedula" value={formData.clienteCedula} onChange={(e)=>setFormData({...formData, clienteCedula: e.target.value})} required />
             <Input label="Teléfono" name="clienteTelefono" value={formData.clienteTelefono} onChange={(e)=>setFormData({...formData, clienteTelefono: e.target.value})} required />
             
             <div className="flex flex-col">
               <label className="text-sm font-semibold text-slate-700 mb-1">Empresa de Envío</label>
               <select name="courier" value={formData.courier} onChange={(e)=>setFormData({...formData, courier: e.target.value})} className="p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                 <option value="ZOOM">ZOOM</option> <option value="MRW">MRW</option> <option value="Tealca">Tealca</option> <option value="Domesa">Domesa</option>
               </select>
             </div>
             <div className="md:col-span-2">
               <label className="text-sm font-semibold text-slate-700 mb-1 block">Dirección de Envío Completa</label>
               <textarea name="direccion" value={formData.direccion} onChange={(e)=>setFormData({...formData, direccion: e.target.value})} required rows={2} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"></textarea>
             </div>
             
             <div className="md:col-span-2 bg-slate-50 p-4 rounded-lg border border-slate-200">
               <div className="flex justify-between items-center mb-2">
                 <label className="font-bold text-slate-800 flex items-center gap-2"><Package size={18}/> Productos a Enviar</label>
                 <button type="button" onClick={() => setIsCatalogOpen(true)} className="text-xs font-bold text-white bg-blue-600 py-2 px-4 rounded hover:bg-blue-700 shadow flex items-center gap-2"><Search size={14} /> Abrir Catálogo Visual</button>
               </div>
               {formData.productos ? (
                 <div className="text-sm text-slate-700 whitespace-pre-wrap bg-white p-3 border border-slate-200 rounded">{formData.productos}</div>
               ) : (
                 <div className="text-sm text-slate-400 italic text-center p-4 border-2 border-dashed border-slate-300 rounded">No has seleccionado productos.</div>
               )}
             </div>

             <div className="md:col-span-2 bg-green-50/50 p-4 rounded-lg border border-green-100 grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
               {/* NUEVO CAMPO DE TASA */}
               <div className="flex flex-col relative">
                 <label className="text-sm font-bold text-slate-700 mb-1">Tasa Aplicada (Bs/$)</label>
                 <input type="number" step="0.01" name="tasa" value={formData.tasa} onChange={(e)=>setFormData({...formData, tasa: e.target.value})} required placeholder="Ej: 45.20" className="p-2 border border-slate-300 rounded outline-none font-bold text-lg text-blue-700" />
               </div>

               <div className="flex flex-col">
                 <label className="text-sm font-bold text-slate-700 mb-1">Moneda Pagada</label>
                 <select value={formData.moneda} onChange={(e)=>setFormData({...formData, moneda: e.target.value})} className="p-2 border border-slate-300 rounded outline-none font-bold bg-white text-slate-800">
                   <option value="USD">Dólares (USD $)</option>
                   <option value="VES">Bolívares (VES Bs)</option>
                 </select>
               </div>
               <div className="flex flex-col relative">
                 <label className="text-sm font-bold text-slate-700 mb-1">Monto Pagado</label>
                 <input type="number" step="0.01" name="montoPago" value={formData.montoPago} onChange={(e)=>setFormData({...formData, montoPago: e.target.value})} required placeholder="Ej: 30" className="p-2 border border-slate-300 rounded outline-none font-bold text-lg" />
                 
                 {formData.tasa && formData.montoPago && (
                   <span className="text-xs text-green-700 font-semibold absolute -bottom-5 left-0">
                     {formData.moneda === 'USD' ? `Eq: Bs. ${((parseFloat(formData.montoPago)||0) * parseFloat(formData.tasa)).toFixed(2)}` : `Eq: $${((parseFloat(formData.montoPago)||0) / parseFloat(formData.tasa)).toFixed(2)}`}
                   </span>
                 )}
               </div>
               <Input label="Referencia / Banco" name="referencia" value={formData.referencia} onChange={(e)=>setFormData({...formData, referencia: e.target.value})} required placeholder="Ej. 1234 Mercantil" />
             </div>
             
             <button type="submit" disabled={enviando} className="md:col-span-2 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 mt-4 rounded-lg shadow-lg flex justify-center items-center gap-2 text-lg">
               {enviando ? <Loader2 className="animate-spin" /> : <><CheckCircle size={20} /> Procesar Venta</>}
             </button>
          </form>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead><tr className="bg-slate-100"><th className="p-3 border-b">Fecha/Cliente</th><th className="p-3 border-b">Monto</th><th className="p-3 border-b">Tasa</th><th className="p-3 border-b">Estatus</th><th className="p-3 border-b">Auditoría</th></tr></thead>
            <tbody>
              {pedidos.map(p => (
                <tr key={p.id} className="border-b">
                  <td className="p-3"><div className="font-bold">{p.clienteNombre}</div><div className="text-xs text-slate-500">{new Date(p.fechaCreacion).toLocaleDateString()}</div></td>
                  <td className="p-3 font-semibold">${(p.montoUsd||0).toFixed(2)}</td>
                  <td className="p-3 text-slate-500">Bs. {p.tasaAplicada || '-'}</td>
                  <td className="p-3">{getStatusBadge(p.status)}</td>
                  <td className="p-3">
                    {p.auditado ? <span className="text-green-600 font-bold text-xs flex items-center gap-1"><ShieldCheck size={14}/> Validado OK</span> : <span className="text-slate-400 text-xs">Sin revisión</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ModalCatalogo isOpen={isCatalogOpen} onClose={()=>setIsCatalogOpen(false)} onConfirm={(txt, obj)=>{setFormData({...formData, productos: txt, carritoObj: obj}); setIsCatalogOpen(false);}} />
    </div>
  );
}

// ==========================================
// 2. PANEL DE REPORTES (EXPORTAR CSV)
// ==========================================
function PanelReportes({ pedidos }) {
  const hoyStr = new Date().toISOString().split('T')[0];
  const [fechaInicio, setFechaInicio] = useState(hoyStr);
  const [fechaFin, setFechaFin] = useState(hoyStr);

  const pedidosFiltrados = pedidos.filter(p => {
    // Solo mostramos pedidos válidos (Validados o Despachados) para el reporte de ventas
    if(p.status === 'Rechazado') return false; 
    
    const fechaObj = new Date(p.fechaCreacion);
    const dateStr = fechaObj.toISOString().split('T')[0];
    return dateStr >= fechaInicio && dateStr <= fechaFin;
  });

  const exportarCSV = () => {
    // Construir contenido CSV
    const encabezados = "Fecha,Cliente,Telefono,Asesora,Courier,Productos,Monto Original Pagado,Moneda Pago,Monto Equivalente USD ($),Monto Equivalente VES (Bs),Tasa Aplicada,Estado\n";
    const filas = pedidosFiltrados.map(p => {
      const fecha = new Date(p.fechaCreacion).toLocaleDateString();
      // Escapamos campos de texto con comillas dobles para que el CSV no se rompa si hay comas
      const cliente = `"${p.clienteNombre || ''}"`;
      const tlf = `"${p.clienteTelefono || ''}"`;
      const asesora = `"${p.asesora || ''}"`;
      const productos = `"${(p.productos || '').replace(/\n/g, ' ')}"`;
      
      return `${fecha},${cliente},${tlf},${asesora},${p.courier},${productos},${p.monto},${p.moneda},${(p.montoUsd||0).toFixed(2)},${(p.montoVes||0).toFixed(2)},${p.tasaAplicada},${p.status}`;
    }).join("\n");

    const blob = new Blob(["\uFEFF" + encabezados + filas], { type: 'text/csv;charset=utf-8;' }); // \uFEFF for Excel UTF-8 BOM
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
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

// ==========================================
// 3. PANEL DE ADMINISTRACIÓN Y PAGOS
// ==========================================
function PanelAdmin({ perfil, pedidos, cambiarEstado, loggear, db, appId }) {
  const esAuditor = perfil.role === ROLES.AUDITOR_VENTAS || perfil.role === ROLES.AUDITOR_GENERAL;
  const esAdmin = perfil.role === ROLES.ADMIN || perfil.role === ROLES.ADMINISTRACION;

  const marcarAuditoria = async (id, actual) => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', id), { auditado: !actual });
      loggear('AUDITORIA_VENTA', `Se ${!actual ? 'aprobó' : 'removió'} el check de auditoría al pedido ${id}`);
    } catch(e) { console.error(e); }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow border border-slate-200">
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><CheckSquare className="text-blue-600"/> Administración y Validación de Pagos</h2>
      <table className="w-full text-left border-collapse text-sm">
        <thead><tr className="bg-slate-100"><th className="p-3 border-b">Cliente y Productos</th><th className="p-3 border-b">Pago</th><th className="p-3 border-b text-right">Acciones Admin / Auditor</th></tr></thead>
        <tbody>
          {pedidos.filter(p=>p.status === 'Pendiente' || esAuditor).map(p => (
            <tr key={p.id} className="border-b hover:bg-slate-50">
               <td className="p-3">
                 <div className="font-bold text-base">{p.clienteNombre} <span className="text-xs font-normal text-slate-500">({p.asesora})</span></div>
                 <div className="text-xs text-slate-600 bg-slate-100 p-2 mt-1 rounded whitespace-pre-wrap">{p.productos}</div>
               </td>
               <td className="p-3">
                 <div className="font-bold text-green-700 text-lg">${(p.montoUsd||0).toFixed(2)} <span className="text-xs text-slate-500 font-normal ml-1">(Tasa: {p.tasaAplicada})</span></div>
                 <div className="text-xs">Ref: {p.referencia}</div>
               </td>
               <td className="p-3">
                 <div className="flex flex-col gap-2 items-end">
                   {getStatusBadge(p.status)}
                   
                   {/* Acciones de Admin/Pagos */}
                   {esAdmin && p.status === 'Pendiente' && (
                     <div className="flex gap-2 mt-2">
                       <button onClick={()=>cambiarEstado(p.id, 'Rechazado', p)} className="bg-red-100 text-red-700 px-3 py-1 rounded font-bold text-xs">Rechazar</button>
                       <button onClick={()=>cambiarEstado(p.id, 'Validado', p)} className="bg-emerald-600 text-white px-3 py-1 rounded font-bold text-xs shadow-sm">Validar y Descontar Stock</button>
                     </div>
                   )}

                   {/* Acciones de Auditor */}
                   {esAuditor && p.status === 'Validado' && (
                     <button onClick={()=>marcarAuditoria(p.id, p.auditado)} className={`px-3 py-1.5 rounded font-bold text-xs flex items-center gap-1 border transition ${p.auditado ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                       {p.auditado ? <><ShieldCheck size={14}/> Auditado OK</> : <><Eye size={14}/> Auditar Envío</>}
                     </button>
                   )}
                 </div>
               </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ==========================================
// 4. PANEL DE DESPACHO
// ==========================================
function PanelDespacho({ pedidos, cambiarEstado, db, appId, loggear }) {
  const pedidosValidados = pedidos.filter(p => p.status === 'Validado' || p.status === 'Despachado');
  const pedidosPendientes = pedidos.filter(p => p.status === 'Pendiente' || p.status === 'Rechazado').length;
  const [guiasInput, setGuiasInput] = useState({});
  const [subiendo, setSubiendo] = useState({ id: null, field: null });

  const handleGuiaChange = (id, field, value) => {
    setGuiasInput(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const enviarWhatsApp = (pedido) => {
    const mensaje = `Hola ${pedido.clienteNombre}, tu pedido ha sido procesado y enviado por *${pedido.courier}*.%0A%0A*Tu número de guía es:* ${pedido.guia}%0A%0A${pedido.linkGuia ? `Foto de tu guía: ${pedido.linkGuia}%0A` : ''}${pedido.linkFotoProductos ? `Foto de tus productos: ${pedido.linkFotoProductos}%0A` : ''}%0ACualquier duda estamos a la orden.`;
    const cleanPhone = String(pedido.clienteTelefono).replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${mensaje}`, '_blank');
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
      alert("Guía y soportes guardados correctamente.");
    } catch(e) {
      console.error(e);
      alert("Error al guardar la información");
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Logística y Despacho</h2>
          <p className="text-slate-500 text-sm mt-1">Imprime etiquetas, asigna guías y sube soportes fotográficos obligatorios.</p>
        </div>
        <button 
          onClick={() => window.print()} 
          className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-4 rounded shadow flex items-center gap-2"
        >
          <Printer size={18} /> Imprimir Etiquetas ({pedidosValidados.filter(p=>p.status === 'Validado').length})
        </button>
      </div>

      {pedidosPendientes > 0 && (
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
            {pedidosValidados.length === 0 ? (
              <tr><td colSpan="3" className="p-4 text-center text-slate-500">No hay paquetes pendientes por despachar.</td></tr>
            ) : (
              pedidosValidados.map(p => (
                <tr key={p.id} className={`border-b ${p.status === 'Despachado' ? 'bg-green-50/50' : ''}`}>
                  <td className="p-3 align-top">
                    <div className="font-bold text-slate-800">{p.clienteNombre}</div>
                    <div className="text-sm font-semibold text-blue-600 mt-1">{p.courier}</div>
                    <div className="text-xs text-slate-500 mt-1"><span className="font-semibold">Tel:</span> {p.clienteTelefono}</div>
                    <div className="text-xs text-slate-500"><span className="font-semibold">Prog. Despacho:</span> {p.fechaDespacho}</div>
                  </td>
                  <td className="p-3 align-top text-sm">
                    <div className="font-medium bg-slate-50 p-2 rounded border border-slate-100 mb-2 whitespace-pre-wrap">{p.productos}</div>
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
                        <button 
                            onClick={() => enviarWhatsApp(p)} 
                            className="bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-1.5 px-3 rounded flex items-center justify-center gap-1 shadow-sm transition mb-2 w-full"
                          >
                            <MessageCircle size={14} /> Notificar Cliente
                        </button>
                        <button onClick={() => cambiarEstado(p.id, 'Validado', p)} className="text-slate-400 hover:text-slate-600 text-xs underline mt-2">Editar envío</button>
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
                          className="w-full bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold py-2 rounded mt-1 flex items-center justify-center gap-2"
                        >
                          <Truck size={14}/> Registrar Despacho
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
// 5. PANEL DE INVENTARIO
// ==========================================
function PanelInventario({ stock, notas, db, appId, loggear, perfil }) {
  const puedeEditar = [ROLES.ADMIN, ROLES.AUDITOR_INVENTARIO, ROLES.AUDITOR_GENERAL].includes(perfil.role);
  const [localStock, setLocalStock] = useState(stock);
  const [notaActiva, setNotaActiva] = useState(null); 
  const [textoNota, setTextoNota] = useState('');

  useEffect(() => { setLocalStock(stock); }, [stock]);

  const guardarStock = async (key, val) => {
    const num = parseInt(val, 10) || 0;
    if (num === stock[key]) return; // Evitar guardados innecesarios
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'stock'), { [key]: num }, { merge: true });
    loggear('AJUSTE_INVENTARIO_MANUAL', `Se ajustó manualmente el stock de [${key}] a ${num}`);
  };

  const guardarNota = async (key) => {
    if(!textoNota.trim()) return;
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'notas'), { [key]: textoNota }, { merge: true });
    loggear('NOTA_INVENTARIO', `Auditor agregó nota a [${key}]: "${textoNota}"`);
    setNotaActiva(null); setTextoNota('');
  };

  const lista = [];
  CATALOGO.forEach(c => c.productos.forEach(p => p.presentaciones.forEach(pres => {
    const key = `${p.nombre}|${pres}`;
    lista.push({ key, cat: c.categoria, nom: p.nombre, pres, qty: stock[key]||0, nota: notas[key] });
  })));

  return (
    <div className="bg-white p-6 rounded-xl shadow border border-slate-200">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Archive /> Control y Auditoría de Inventario</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse min-w-[700px]">
           <thead><tr className="bg-slate-100"><th className="p-3 border-b">Producto</th><th className="p-3 border-b text-center">Físico (Sistema)</th><th className="p-3 border-b">Notas del Auditor</th></tr></thead>
           <tbody>
             {lista.map(item => (
               <tr key={item.key} className="border-b">
                 <td className="p-3">
                   <div className="font-bold text-slate-800">{item.nom}</div>
                   <div className="text-xs bg-blue-50 text-blue-700 px-1.5 rounded inline-block mt-1">{item.pres}</div>
                 </td>
                 <td className="p-3 text-center">
                   {puedeEditar ? (
                     <input type="number" min="0" value={localStock[item.key] ?? item.qty} onChange={e=>setLocalStock({...localStock, [item.key]: e.target.value})} onBlur={()=>guardarStock(item.key, localStock[item.key])} className="w-20 border-2 border-slate-300 text-center font-bold rounded p-1" />
                   ) : (
                     <span className="font-bold text-lg">{item.qty}</span>
                   )}
                 </td>
                 <td className="p-3 w-1/3">
                   {item.nota && <div className="text-xs bg-amber-50 text-amber-800 p-2 rounded border border-amber-200 mb-2 whitespace-pre-wrap flex items-start gap-1"><AlertTriangle size={14} className="shrink-0 mt-0.5"/> {item.nota}</div>}
                   
                   {puedeEditar && notaActiva === item.key ? (
                     <div className="flex flex-col gap-1">
                       <textarea value={textoNota} onChange={e=>setTextoNota(e.target.value)} placeholder="Ej: Faltan 2 unidades en almacén" className="text-xs border rounded p-1 w-full" rows="2" />
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
    </div>
  );
}

// ==========================================
// 6. PANEL DE USUARIOS
// ==========================================
function PanelUsuarios({ usuarios, db, appId, loggear }) {
  const cambiarRol = async (uid, isApproved, newRole, email) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', uid), { isApproved, role: newRole });
    loggear('GESTION_USUARIO', `Se cambió acceso de ${email} a Rol: ${newRole} (Aprobado: ${isApproved})`);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow border border-slate-200">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Users /> Gestión de Usuarios y Permisos</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse min-w-[600px]">
          <thead><tr className="bg-slate-100"><th className="p-3 border-b">Usuario / Email</th><th className="p-3 border-b">Estado</th><th className="p-3 border-b">Asignar Rol</th></tr></thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id} className="border-b">
                <td className="p-3 font-semibold">{u.nombre}<br/><span className="text-xs font-normal text-slate-500">{u.email}</span></td>
                <td className="p-3">{u.isApproved ? <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">Aprobado</span> : <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs font-bold">Pendiente</span>}</td>
                <td className="p-3 flex gap-2 items-center">
                   <select value={u.role} onChange={(e)=>cambiarRol(u.id, true, e.target.value, u.email)} className="border p-1 rounded text-sm outline-none">
                     <option value="Pendiente" disabled>Pendiente</option>
                     {Object.values(ROLES).map(r => <option key={r} value={r}>{r}</option>)}
                   </select>
                   {u.isApproved && <button onClick={()=>cambiarRol(u.id, false, 'Bloqueado', u.email)} className="text-xs bg-red-100 text-red-700 px-2 py-1.5 rounded font-bold hover:bg-red-200 transition">Revocar Acceso</button>}
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
// 7. PANEL DE LOGS (AUDITORÍA)
// ==========================================
function PanelLogs({ logs }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow border border-slate-200 h-[80vh] flex flex-col">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><FileText /> Registro de Auditoría (Logs del Sistema)</h2>
      <div className="overflow-y-auto flex-1">
        <table className="w-full text-left text-sm border-collapse">
          <thead><tr className="bg-slate-900 text-white sticky top-0"><th className="p-3">Fecha y Hora</th><th className="p-3">Usuario (Rol)</th><th className="p-3">Acción Registrada</th><th className="p-3">Detalle Técnico</th></tr></thead>
          <tbody>
            {logs.length === 0 ? <tr><td colSpan="4" className="p-4 text-center">No hay registros aún.</td></tr> : logs.map(l => (
              <tr key={l.id} className="border-b hover:bg-slate-50">
                <td className="p-3 text-xs font-mono text-slate-500">{new Date(l.fecha).toLocaleString()}</td>
                <td className="p-3"><div className="font-bold text-slate-700">{l.usuarioEmail}</div><div className="text-xs text-blue-600">{l.usuarioRol}</div></td>
                <td className="p-3"><span className="bg-slate-200 px-2 py-1 rounded text-xs font-bold text-slate-700">{l.accion}</span></td>
                <td className="p-3 text-xs text-slate-600 font-medium">{l.detalle}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==========================================
// COMPONENTES AUXILIARES UI
// ==========================================
function Input({ label, ...props }) { 
  return (
    <div className="flex flex-col">
      <label className="text-sm font-semibold text-slate-700 mb-1">{label}</label>
      <input className="p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" {...props}/>
    </div>
  );
}

function getStatusBadge(status) { 
  const b = { 'Pendiente': 'bg-amber-100 text-amber-800', 'Validado': 'bg-blue-100 text-blue-800', 'Rechazado': 'bg-red-100 text-red-800', 'Despachado': 'bg-green-100 text-green-800' }; 
  return <span className={`px-2 py-1 rounded text-xs font-bold ${b[status]}`}>{status}</span>; 
}

function TabButton({ active, onClick, icon, label, badge }) { 
  return (
    <button onClick={onClick} className={`flex items-center justify-between w-full p-3 rounded-lg font-medium transition-colors mb-1 ${active ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
      <div className="flex items-center gap-3">{icon} <span className="hidden md:inline">{label}</span></div> 
      {badge > 0 && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">{badge}</span>}
    </button>
  ); 
}

// ==========================================
// VISTA IMPRESIÓN (HOJA DE DESPACHO)
// ==========================================
function VistaImpresion({ pedidos }) {
  if (pedidos.length === 0) {
    return (
      <div className="hidden print:block p-8 text-center text-xl">
        No hay pedidos validados para imprimir.
      </div>
    );
  }

  return (
    <div className="hidden print:block w-full bg-white text-black p-4">
      <h1 className="text-2xl font-bold text-center mb-6">HOJA DE DESPACHO - {new Date().toLocaleDateString('es-VE')}</h1>
      
      <div className="grid grid-cols-2 gap-4">
        {pedidos.map((p) => (
          <div key={p.id} className="border-2 border-black p-4 break-inside-avoid">
            <div className="flex justify-between border-b-2 border-black pb-2 mb-2">
              <span className="font-bold text-lg">{p.courier?.toUpperCase() || 'ENVÍO'}</span>
              <span className="text-sm">Envío programado: {p.fechaDespacho}</span>
            </div>
            <div className="space-y-1 text-sm">
              <p><span className="font-bold">DESTINATARIO:</span> {p.clienteNombre?.toUpperCase()}</p>
              <p><span className="font-bold">C.I / RIF:</span> {p.clienteCedula}</p>
              <p><span className="font-bold">TELÉFONO:</span> {p.clienteTelefono}</p>
              <p className="mt-2"><span className="font-bold">DIRECCIÓN DE ENTREGA:</span></p>
              <p className="pl-2 border-l-2 border-gray-300 leading-tight">{p.direccion}</p>
              <p className="mt-2 border-t pt-1"><span className="font-bold">CONTENIDO:</span> {p.productos}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// MODAL DEL CATÁLOGO VISUAL
// ==========================================
function ModalCatalogo({ isOpen, onClose, onConfirm }) {
  const [carrito, setCarrito] = useState({});

  if (!isOpen) return null;

  const updateQty = (key, delta) => {
    setCarrito(prev => {
      const actual = prev[key] || 0;
      const nuevo = Math.max(0, actual + delta);
      if (nuevo === 0) { const copia = { ...prev }; delete copia[key]; return copia; }
      return { ...prev, [key]: nuevo };
    });
  };

  const handleConfirm = () => {
    const lineas = [];
    Object.entries(carrito).forEach(([key, qty]) => {
      const [prod, pres] = key.split('|');
      lineas.push(`- ${qty}x ${prod} (${pres})`);
    });
    if (lineas.length === 0) return alert("Selecciona algún producto.");
    
    onConfirm(lineas.join('\n'), carrito); 
    setCarrito({});
  };

  const totalItems = Object.values(carrito).reduce((a, b) => a + b, 0);

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-2 md:p-4 animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[95vh] md:h-[85vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Package className="text-blue-600" /> Catálogo Visual de Productos
            </h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-100">
          {CATALOGO.map(cat => (
            <div key={cat.categoria} className="mb-8">
              <h3 className="text-lg font-bold text-slate-700 border-b-2 border-blue-200 pb-2 mb-4 inline-block">{cat.categoria}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {cat.productos.map(prod => (
                  <ProductCard key={prod.nombre} prod={prod} carrito={carrito} updateQty={updateQty} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t bg-white flex justify-between items-center">
          <div className="text-slate-600 font-medium">
            Seleccionados: <span className="font-bold text-blue-600 text-lg">{totalItems}</span>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-6 py-2 border rounded text-slate-700 hover:bg-slate-50">Cancelar</button>
            <button onClick={handleConfirm} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow flex gap-2">
              <Plus size={18}/> Añadir al Pedido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductCard({ prod, carrito, updateQty }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition flex flex-col">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center text-slate-300 shrink-0">
          <ImageIcon size={24} />
        </div>
        <div className="font-bold text-slate-800 leading-tight pt-1">{prod.nombre}</div>
      </div>
      
      <div className="flex flex-col gap-2.5 mt-auto">
        {prod.presentaciones.map(pres => {
          const key = `${prod.nombre}|${pres}`;
          const qty = carrito[key] || 0;
          const hasQty = qty > 0;
          
          return (
            <div key={pres} className={`flex justify-between items-center text-sm p-1.5 rounded-md transition ${hasQty ? 'bg-blue-50 border border-blue-100' : 'hover:bg-slate-50'}`}>
              <span className={`font-medium ${hasQty ? 'text-blue-800' : 'text-slate-600'}`}>{pres}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => updateQty(key, -1)} disabled={!hasQty} className={`p-1 rounded transition ${hasQty ? 'bg-white text-blue-600 shadow-sm hover:bg-blue-100' : 'text-slate-300 bg-slate-50 cursor-not-allowed'}`}>
                  <Minus size={14} />
                </button>
                <span className={`w-5 text-center font-bold ${hasQty ? 'text-blue-700' : 'text-slate-400'}`}>{qty}</span>
                <button onClick={() => updateQty(key, 1)} className="p-1 bg-white border border-slate-200 text-slate-600 shadow-sm rounded hover:bg-slate-100 transition">
                  <Plus size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}