import React, { useState, useEffect, useMemo } from 'react';
import { 
  signInWithPopup, signOut, onAuthStateChanged, signInAnonymously, signInWithCustomToken 
} from 'firebase/auth';
import { 
  collection, addDoc, onSnapshot, updateDoc, doc, setDoc, query, orderBy, limit
} from 'firebase/firestore';
import { 
  ShoppingCart, CheckSquare, Truck, Clock, Loader2, Archive, LogOut, ShieldCheck, Users, 
  FileText, FileSpreadsheet, Store, Moon, Sun, Menu, X 
} from 'lucide-react';

import { auth, db, googleProvider, appId } from './config/firebase';
import { BRAND_LOGO, ROLES, DEFAULT_CATALOGO } from './config/constants';
import { TabButton } from './components/ui';

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
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [dialogConfig, setDialogConfig] = useState(null);
  const dialogs = useMemo(() => ({
    alert: (msg, title) => setDialogConfig({ type: 'alert', message: msg, title: title || "Bluher" }),
    confirm: (msg, onConfirm, title) => setDialogConfig({ type: 'confirm', message: msg, title: title || "Confirmación", onConfirm }),
    prompt: (msg, onConfirm, title) => setDialogConfig({ type: 'prompt', message: msg, title: title || "Entrada de Datos", onConfirm })
  }), []);

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  useEffect(() => {
    const handleHashChange = () => setIsPublicRoute(window.location.hash === '#tienda');
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    // Puente por si el servidor inyecta un token inicial
    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
       signInWithCustomToken(auth, __initial_auth_token).catch(()=>{});
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Si el navegador recuerda la sesión (sea Empleado o Cliente Anónimo), la restaura.
        setUser(currentUser);
      } else {
        // Si Firebase confirma que NO hay nadie conectado, creamos el "Cliente Fantasma".
        try { 
          await signInAnonymously(auth); 
        } catch (error) { 
          setUser(null); 
          setUserProfile(null); 
          setAuthLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    let isFirstLoad = true;
    const unsubs = [];
    
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
              }).catch(()=>{});
           }
        }
      } else if (!user.isAnonymous) {
        const newProfile = { uid: user.uid, email: user.email, nombre: user.displayName || 'Usuario', foto: user.photoURL || '', role: 'Pendiente', isApproved: false, isOnline: true, fechaRegistro: Date.now() };
        await setDoc(userRef, newProfile);
        setUserProfile(newProfile);
      }
      setAuthLoading(false);
    }, () => setAuthLoading(false)));

    return () => unsubs.forEach(u => u());
  }, [user]);

  // =======================================================================
  // 1. CARGA DE DATOS PÚBLICOS (RECONEXIÓN AUTOMÁTICA)
  // Depende de [user] para reiniciarse si la sesión cambia, evitando el bloqueo.
  // =======================================================================
  useEffect(() => {
    const unsubs = [];
    const onError = (e) => console.warn("Firestore Listener Error Público:", e.message);

    unsubs.push(onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'catalogo'), (docSnap) => {
      setCatalogo(docSnap.exists() && docSnap.data().categorias ? docSnap.data().categorias : DEFAULT_CATALOGO);
    }, onError));

    unsubs.push(onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'stock'), (docSnap) => {
      setStockInventario(docSnap.exists() ? docSnap.data() : {});
    }, onError));

    unsubs.push(onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'general'), (docSnap) => {
      if(docSnap.exists()) setConfigGral(docSnap.data());
    }, onError));

    return () => unsubs.forEach(unsub => unsub());
  }, []); // <--- CLAVE: Este arreglo vacío [] asegura que la conexión jamás se corte al cerrar sesión.

  // =======================================================================
  // 2. CARGA DE DATOS PRIVADOS (SOLO EMPLEADOS APROBADOS)
  // =======================================================================
  useEffect(() => {
    if (!userProfile || !userProfile.isApproved) return;
    const unsubs = [];
    const onError = (e) => console.warn("Firestore Listener Error Privado:", e.message);

    const qPedidos = query(collection(db, 'artifacts', appId, 'public', 'data', 'pedidos'), orderBy('fechaCreacion', 'desc'), limit(150));
    unsubs.push(onSnapshot(qPedidos, (snapshot) => {
      setPedidos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, onError));

    unsubs.push(onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'notas'), (docSnap) => {
      setNotasInventario(docSnap.exists() ? docSnap.data() : {});
    }, onError));

    const qMovimientos = query(collection(db, 'artifacts', appId, 'public', 'data', 'movimientos'), orderBy('fechaCreacion', 'desc'), limit(50));
    unsubs.push(onSnapshot(qMovimientos, (snapshot) => {
      setMovimientos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, onError));

    const esAdminOAuditor = [ROLES.ADMIN, ROLES.AUDITORIA].includes(userProfile.role);
    if (esAdminOAuditor) {
      unsubs.push(onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'users'), (snapshot) => {
        setUsuarios(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, onError));
      
      const qLogs = query(collection(db, 'artifacts', appId, 'public', 'data', 'logs'), orderBy('fecha', 'desc'), limit(200));
      unsubs.push(onSnapshot(qLogs, (snapshot) => {
        setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, onError));
    }

    return () => unsubs.forEach(unsub => unsub());
  }, [userProfile?.isApproved]);

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
    catch (error) { console.error(error); dialogs.alert("Error de conexión."); setAuthLoading(false); }
  };
  
  // =======================================================================
  // CIERRE DE SESIÓN TOTAL Y RECARGA
  // =======================================================================
  const cerrarSesion = async () => {
    if (userProfile && user) {
       try {
         await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), { isOnline: false });
         await registrarLogSistem(userProfile, 'CIERRE_SESION', `Cerró sesión.`);
       } catch(e) {}
    }
    await signOut(auth); // Corta la conexión de raíz
    
    // Forzamos un "Hard Reload" para limpiar la memoria de React por completo.
    // Esto asegura que entrarás fresco como un cliente normal sin errores de Firebase.
    window.location.hash = ''; 
    window.location.reload(); 
  };

  const cambiarEstadoPedido = async (id, nuevoEstado) => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', id), { status: nuevoEstado });
      loggear('ESTADO_PEDIDO_ACTUALIZADO', `Se cambió a ${nuevoEstado}.`);
    } catch (error) {
      dialogs.alert("Error de red al intentar cambiar el estado.", "Fallo de conexión");
    }
  };

  const handleTabClick = (tab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  let content;

  if (isPublicRoute) {
    content = <PublicPortal catalogo={catalogo} stock={stockInventario} config={configGral} db={db} appId={appId} dialogs={dialogs} onBack={() => window.location.hash = ''} darkMode={darkMode} setDarkMode={setDarkMode} />;
  } else if (authLoading || (user && !userProfile && !user.isAnonymous)) {
    content = (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center bg-[#f0f4f8] dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors">
        <img src={BRAND_LOGO} alt="Logo Bluher" className="h-20 mb-8 mix-blend-multiply dark:invert animate-pulse" />
        <Loader2 className="animate-spin text-sky-600 dark:text-sky-400 mb-4" size={48} />
        <div className="font-bold text-xl tracking-tight">Verificando seguridad...</div>
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
          <button onClick={signInGoogle} className="w-full bg-[#003366] dark:bg-sky-600 hover:bg-[#002244] dark:hover:bg-sky-500 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-3 transition-all duration-300 shadow-lg hover:-translate-y-0.5 mb-4">Acceso Empleados</button>
          <button onClick={() => window.location.hash = '#tienda'} className="w-full bg-[#f0f4f8] dark:bg-slate-700 hover:bg-[#e2ebf3] dark:hover:bg-slate-600 text-sky-900 dark:text-slate-200 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-3 transition-all duration-300 border border-sky-100 dark:border-slate-600"><Store size={18}/> Comprar Online (Clientes)</button>
        </div>
      </div>
    );
  } else if (userProfile && !userProfile.isApproved) {
    content = (
      <div className="min-h-screen flex items-center justify-center p-4 text-center bg-[#f0f4f8] dark:bg-slate-900 transition-colors text-slate-800 dark:text-slate-100">
        <div className="bg-white dark:bg-slate-800 p-10 rounded-3xl shadow-xl max-w-md w-full border-t-[6px] border-amber-500 transition-colors">
          <ShieldCheck size={56} className="mx-auto text-amber-500 mb-4" />
          <h2 className="text-2xl font-bold">Cuenta en Revisión</h2>
          <p className="text-slate-600 dark:text-slate-400 mt-2 mb-8 leading-relaxed">Tu correo <b>{user.email}</b> espera aprobación.</p>
          <button onClick={cerrarSesion} className="text-sky-700 dark:text-sky-400 font-semibold hover:underline transition-colors">Cerrar sesión</button>
        </div>
      </div>
    );
  } else {
    const r = userProfile?.role;
    const showVentas = [ROLES.ADMIN, ROLES.VENTAS, ROLES.ADMINISTRACION, ROLES.DESPACHO].includes(r);
    const showAdmin = [ROLES.ADMIN, ROLES.ADMINISTRACION, ROLES.AUDITORIA].includes(r);
    const showDespacho = [ROLES.ADMIN, ROLES.DESPACHO, ROLES.AUDITORIA].includes(r);
    const showReportes = [ROLES.ADMIN, ROLES.ADMINISTRACION, ROLES.AUDITORIA, ROLES.DESPACHO].includes(r);
    const showInventario = [ROLES.ADMIN, ROLES.ADMINISTRACION, ROLES.VENTAS, ROLES.AUDITORIA, ROLES.DESPACHO].includes(r); 
    const showUsuarios = [ROLES.ADMIN].includes(r);
    const showLogs = [ROLES.ADMIN, ROLES.AUDITORIA].includes(r);

    const getVeneziaTimeApp = () => new Date(new Date().toLocaleString("en-US", {timeZone: "America/Caracas"}));
    const tDateApp = getVeneziaTimeApp();
    const ddApp = String(tDateApp.getDate()).padStart(2, '0');
    const mmApp = String(tDateApp.getMonth() + 1).padStart(2, '0');
    const todayStrApp = `${ddApp}/${mmApp}/${tDateApp.getFullYear()}`;

    content = (
      <div className="flex flex-col min-h-screen bg-[#f0f4f8] dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors selection:bg-sky-200 dark:selection:bg-sky-900">
        
        <div className="md:hidden flex items-center justify-between bg-[#003366] dark:bg-slate-950 p-4 text-white sticky top-0 z-40 shadow-md">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-1 rounded-md hover:bg-white/10 transition-colors">
              <Menu size={28} />
            </button>
            <img src={BRAND_LOGO} alt="Logo" className="h-8 brightness-200" />
          </div>
          <button onClick={() => setDarkMode(!darkMode)} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
            {darkMode ? <Sun size={18}/> : <Moon size={18}/>}
          </button>
        </div>

        <div className="flex flex-1 relative">
          {isMobileMenuOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden transition-opacity" onClick={() => setIsMobileMenuOpen(false)}></div>
          )}

          <aside className={`fixed inset-y-0 left-0 z-50 w-[280px] bg-[#003366] dark:bg-slate-950 text-slate-200 flex flex-col h-full transform transition-transform duration-300 ease-in-out md:sticky md:top-0 md:h-screen md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
            <div className="p-8 pb-4 flex flex-col items-center border-b border-sky-800/50 dark:border-slate-800/50 relative">
              <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden absolute top-4 right-4 p-1.5 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors">
                <X size={20}/>
              </button>
              <button onClick={() => setDarkMode(!darkMode)} className="hidden md:block absolute top-4 right-4 p-1.5 bg-sky-800/50 dark:bg-slate-800 rounded-full text-sky-200 dark:text-slate-400 hover:text-white transition-colors">
                {darkMode ? <Sun size={14}/> : <Moon size={14}/>}
              </button>
              
              <div className="w-full flex justify-center mb-6 mt-4 md:mt-0">
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
            
            <nav className="mt-6 flex flex-col gap-1.5 px-4 overflow-y-auto flex-1 pb-4">
              <div className="text-[10px] font-bold text-sky-300 dark:text-slate-500 uppercase tracking-widest mb-2 px-2">Área Operativa</div>
              {showVentas && <TabButton active={activeTab === 'ventas'} onClick={() => handleTabClick('ventas')} icon={<ShoppingCart size={18} />} label="Ventas y Web" badge={pedidos.filter(p=>p.status==='Rechazado' || p.esPublico).length} badgeColor="bg-red-500 dark:bg-sky-500" />}
              {showAdmin && <TabButton active={activeTab === 'admin'} onClick={() => handleTabClick('admin')} icon={<CheckSquare size={18} />} label={r === ROLES.AUDITORIA ? 'Auditoría Pagos' : 'Admin y Pagos'} badge={pedidos.filter(p=>p.status==='Pendiente').length} />}
              {showDespacho && <TabButton active={activeTab === 'despacho'} onClick={() => handleTabClick('despacho')} icon={<Truck size={18} />} label={`Despacho`} badge={pedidos.filter(p=>p.status==='Validado').length} />}
              
              {(showReportes || showInventario || showUsuarios || showLogs) && <div className="my-4 border-t border-sky-800/50 dark:border-slate-800 mx-2"></div>}
              {(showReportes || showInventario || showUsuarios || showLogs) && <div className="text-[10px] font-bold text-sky-300 dark:text-slate-500 uppercase tracking-widest mb-2 px-2">Gestión y Reportes</div>}

              {showReportes && <TabButton active={activeTab === 'reportes'} onClick={() => handleTabClick('reportes')} icon={<FileSpreadsheet size={18} />} label="Reportes" />}
              {showInventario && <TabButton active={activeTab === 'inventario'} onClick={() => handleTabClick('inventario')} icon={<Archive size={18} />} label="Inventario" badge={movimientos.filter(m=>m.status==='PENDIENTE').length} />}
              {showUsuarios && <TabButton active={activeTab === 'usuarios'} onClick={() => handleTabClick('usuarios')} icon={<Users size={18} />} label="Usuarios" badge={usuarios.filter(u=>!u.isApproved).length} />}
              {showLogs && <TabButton active={activeTab === 'logs'} onClick={() => handleTabClick('logs')} icon={<FileText size={18} />} label="Auditoría" />}
            </nav>

            <div className="p-6 border-t border-sky-800/50 dark:border-slate-800/50">
              <button onClick={cerrarSesion} className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl text-sky-200 dark:text-slate-400 hover:text-white hover:bg-sky-800 dark:hover:bg-slate-800 transition-colors font-medium text-sm">
                <LogOut size={16} /> Cerrar Sesión
              </button>
            </div>
          </aside>

          <main className="flex-1 p-4 md:p-10 overflow-y-auto print:p-0 print:m-0 print:bg-white print:block w-full">
            <div className="max-w-6xl mx-auto print:max-w-none print:mx-0">
              <div className="print:hidden">
                {activeTab === 'ventas' && showVentas && <PanelVentas perfil={userProfile} pedidos={pedidos} catalogo={catalogo} stock={stockInventario} config={configGral} db={db} appId={appId} loggear={loggear} dialogs={dialogs} cambiarEstadoPedido={cambiarEstadoPedido} />}
                {activeTab === 'admin' && showAdmin && <PanelAdmin perfil={userProfile} config={configGral} pedidos={pedidos} stock={stockInventario} loggear={loggear} db={db} appId={appId} dialogs={dialogs} />}
                {activeTab === 'despacho' && showDespacho && <PanelDespacho pedidos={pedidos} catalogo={catalogo} stock={stockInventario} cambiarEstado={cambiarEstadoPedido} db={db} appId={appId} loggear={loggear} dialogs={dialogs} perfil={userProfile} />}
                {activeTab === 'reportes' && showReportes && <PanelReportes perfil={userProfile} pedidos={pedidos} catalogo={catalogo} stock={stockInventario} />}
                {activeTab === 'inventario' && showInventario && <PanelInventario stock={stockInventario} notas={notasInventario} catalogo={catalogo} movimientos={movimientos} db={db} appId={appId} loggear={loggear} perfil={userProfile} dialogs={dialogs} />}
                {activeTab === 'usuarios' && showUsuarios && <PanelUsuarios usuarios={usuarios} db={db} appId={appId} loggear={loggear} dialogs={dialogs} />}
                {activeTab === 'logs' && showLogs && <PanelLogs logs={logs} />}
              </div>
              <VistaImpresion pedidos={pedidos.filter(p => {
    if (p.status !== 'Validado') return false;
    if (!p.fechaDespacho || p.fechaDespacho === 'Sin Fecha') return false;
    const parts = p.fechaDespacho.split('/');
    if (parts.length !== 3) return false;
    const timeDespacho = new Date(parts[2], parts[1] - 1, parts[0]).getTime();
    
    const getVeneziaTimeApp = () => new Date(new Date().toLocaleString("en-US", {timeZone: "America/Caracas"}));
    const tDateApp = getVeneziaTimeApp();
    const timeHoy = new Date(tDateApp.getFullYear(), tDateApp.getMonth(), tDateApp.getDate()).getTime();
    
    return timeDespacho <= timeHoy;
})} />
            </div>
          </main>
        </div>
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
