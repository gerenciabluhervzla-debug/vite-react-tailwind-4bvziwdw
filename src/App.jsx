import React, { useState, useEffect, useMemo } from 'react';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  signInAnonymously, 
  signInWithCustomToken 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  updateDoc, 
  doc, 
  setDoc, 
} from 'firebase/firestore';
import { 
  ShoppingCart, CheckSquare, Truck, Clock, 
  Loader2, Archive, LogOut, ShieldCheck, Users, 
  FileText, FileSpreadsheet, Store, Moon, Sun
} from 'lucide-react';

// --- IMPORTACIONES DE CONFIGURACIÓN Y UI ---
import { auth, db, googleProvider, appId } from './config/firebase';
import { BRAND_LOGO, ROLES, DEFAULT_CATALOGO } from './config/constants';
import { TabButton } from './components/ui';

// --- IMPORTACIONES DE MODALES Y VISTAS ---
// (Asegúrate de crear estos archivos y pegar el código correspondiente de tus componentes)
import GlobalDialog from './components/modals/GlobalDialog';
import VistaImpresion from './components/print/VistaImpresion';
import PublicPortal from './views/PublicPortal'; 
import PanelVentas from './views/PanelVentas';
import PanelAdmin from './views/PanelAdmin';
import PanelDespacho from './views/PanelDespacho';
import PanelReportes from './views/PanelReportes';
import PanelInventario from './views/inventario/PanelInventario';
import PanelUsuarios from './views/PanelUsuarios';
import PanelLogs from './views/PanelLogs';

// ==========================================
// COMPONENTE PRINCIPAL APP
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

  // --- AUTH FIRST ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          try {
             await signInAnonymously(auth);
          } catch(e) {
             console.warn("Autenticación anónima deshabilitada en Firebase.");
          }
        }
      } catch (error) { console.error("Auth error", error); }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser && !currentUser.isAnonymous) {
        setUser(currentUser);
      } else if (currentUser && currentUser.isAnonymous) {
        setUser(currentUser); 
      } else {
        setUser(null); setUserProfile(null); setAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // --- DATA FETCHING (Gated by Auth) ---
  useEffect(() => {
    if (!user) return;
    let isFirstLoad = true;
    const unsubs = [];
    
    // Perfil
    const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid);
    unsubs.push(onSnapshot(userRef, async (snap) => {
      if (snap.exists()) {
        const profile = snap.data();
        setUserProfile(profile);
        if (isFirstLoad) {
           isFirstLoad = false;
           if (!profile.isOnline) {
              updateDoc(userRef, { isOnline: true });
              addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'logs'), {
                  accion: 'INICIO_SESION', detalle: 'El usuario inició sesión en el sistema.', usuarioEmail: profile.email, usuarioNombre: profile.nombre, usuarioRol: profile.role, fecha: Date.now()
              }).catch(()=>console.warn("Log silencioso falló"));
           }
        }
      } else if (!user.isAnonymous) {
        const newProfile = { uid: user.uid, email: user.email, nombre: user.displayName || 'Usuario', foto: user.photoURL || '', role: 'Pendiente', isApproved: false, isOnline: true, fechaRegistro: Date.now() };
        await setDoc(userRef, newProfile);
        setUserProfile(newProfile);
      }
      setAuthLoading(false);
    }, (err) => { 
      console.warn("Perfil sin acceso aún:", err.message); 
      setAuthLoading(false); 
    }));

    return () => unsubs.forEach(u => u());
  }, [user]);

  // Cargar datos operativos 
  useEffect(() => {
    if (!user) return;
    const unsubs = [];
    const onError = (e) => console.warn("Firestore Listener Error:", e.message);

    // Públicamente disponibles (Catálogo, Stock, Config)
    unsubs.push(onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'catalogo'), (docSnap) => {
      setCatalogo(docSnap.exists() && docSnap.data().categorias ? docSnap.data().categorias : DEFAULT_CATALOGO);
    }, onError));

    unsubs.push(onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'stock'), (docSnap) => {
      setStockInventario(docSnap.exists() ? docSnap.data() : {});
    }, onError));

    unsubs.push(onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'general'), (docSnap) => {
      if(docSnap.exists()) setConfigGral(docSnap.data());
    }, onError));

    // Data restringida
    if (userProfile && userProfile.isApproved) {
      unsubs.push(onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'pedidos'), (snapshot) => {
        setPedidos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.fechaCreacion - a.fechaCreacion));
      }, onError));

      unsubs.push(onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'notas'), (docSnap) => {
        setNotasInventario(docSnap.exists() ? docSnap.data() : {});
      }, onError));

      unsubs.push(onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'movimientos'), (snapshot) => {
        setMovimientos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.fechaCreacion - a.fechaCreacion));
      }, onError));

      const esAdminOAuditor = [ROLES.ADMIN, ROLES.AUDITOR_GENERAL].includes(userProfile.role);
      if (esAdminOAuditor) {
        unsubs.push(onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'users'), (snapshot) => {
          setUsuarios(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, onError));
        unsubs.push(onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'logs'), (snapshot) => {
          setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.fecha - a.fecha));
        }, onError));
      }
    }

    return () => unsubs.forEach(unsub => unsub());
  }, [user, userProfile?.isApproved]);

  useEffect(() => {
    const handleUnload = () => {
      if (user && !user.isAnonymous) updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), { isOnline: false });
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
    content = <PublicPortal catalogo={catalogo} stock={stockInventario} config={configGral} db={db} appId={appId} dialogs={dialogs} onBack={() => window.location.hash = ''} darkMode={darkMode} setDarkMode={setDarkMode} />;
  } else if (authLoading || (user && !userProfile && !user.isAnonymous)) {
    content = (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center bg-[#f0f4f8] dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors">
        <img src={BRAND_LOGO} alt="Logo Bluher" className="h-20 mb-8 mix-blend-multiply dark:invert animate-pulse" />
        <Loader2 className="animate-spin text-sky-600 dark:text-sky-400 mb-4" size={48} />
        <div className="font-bold text-xl tracking-tight">Verificando seguridad...</div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Autenticando credenciales de acceso a Bluher.</p>
        {user && <button onClick={cerrarSesion} className="text-sky-600 dark:text-sky-400 text-sm hover:underline font-semibold mt-4">Cancelar y regresar</button>}
      </div>
    );
  } else if (!user || user.isAnonymous) {
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
              {activeTab === 'ventas' && showVentas && <PanelVentas perfil={userProfile} pedidos={pedidos} catalogo={catalogo} stock={stockInventario} config={configGral} db={db} appId={appId} loggear={loggear} dialogs={dialogs} cambiarEstadoPedido={cambiarEstadoPedido} />}
              {activeTab === 'admin' && showAdmin && <PanelAdmin perfil={userProfile} config={configGral} pedidos={pedidos} stock={stockInventario} loggear={loggear} db={db} appId={appId} dialogs={dialogs} />}
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

  return (
    <div className={darkMode ? 'dark' : ''}>
      {content}
      <GlobalDialog config={dialogConfig} setConfig={setDialogConfig} />
    </div>
  );
}