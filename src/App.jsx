import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { ShoppingCart, CheckSquare, Truck, Printer, MessageCircle, Clock, CheckCircle, XCircle, Search, Sparkles, Package, Plus, Minus, X, Image as ImageIcon, ChevronDown, ChevronUp, Camera, ClipboardList, AlertTriangle, UploadCloud, Loader2 } from 'lucide-react';

// --- 1. CONFIGURACIÓN DE FIREBASE (A TRAVÉS DE .ENV EN VITE) ---
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
const appId = typeof __app_id !== 'undefined' ? __app_id : 'app-pedidos-venezuela';

// --- 2. URL WEB APP DE GOOGLE SCRIPT PARA DRIVE ---
const URL_GOOGLE_SCRIPT = import.meta.env.VITE_GOOGLE_SCRIPT_URL;

// --- 3. API KEY DE GEMINI ---
// En la vista previa local usa "", en producción usará la variable de entorno
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;


// --- CATÁLOGO DE PRODUCTOS ---
const CATALOGO = [
  {
    categoria: "Cirugías Capilares",
    productos: [
      { nombre: "Cirugía Clásica", presentaciones: ["Litro", "1/2 Litro", "Galón"] },
      { nombre: "Cirugía Chocolate", presentaciones: ["Litro", "1/2 Litro", "Galón"] },
      { nombre: "Cirugía Azul", presentaciones: ["Litro", "1/2 Litro", "Galón"] }
    ]
  },
  {
    categoria: "Alisados",
    productos: [
      { nombre: "Alisado Clásica", presentaciones: ["1 Litro", "300ml", "100ml", "Galón"] },
      { nombre: "Alisado Chocolate", presentaciones: ["1 Litro", "300ml", "100ml", "Galón"] },
      { nombre: "Alisado Light Blue", presentaciones: ["1 Litro", "300ml", "100ml", "Galón"] },
      { nombre: "Alisado Hydraliss", presentaciones: ["1 Litro", "300ml", "100ml"] }
    ]
  },
  {
    categoria: "Shampoos y Cuidado",
    productos: [
      { nombre: "Shampoo Tradicional", presentaciones: ["Litro", "Litro Nueva P.", "1/2 Litro", "300ml", "100ml", "Galón"] },
      { nombre: "Anti-Residuos", presentaciones: ["1 Litro", "1/2 Litro", "Galón"] },
      { nombre: "Shampoo Sin Sal", presentaciones: ["1K", "500gm", "250cc"] },
      { nombre: "Baño de Crema", presentaciones: ["1 Litro", "1/2 Litro", "300ml", "Galón"] },
      { nombre: "Shampoo Free Off", presentaciones: ["300ml"] },
      { nombre: "Mascarilla Free Off", presentaciones: ["200gr"] },
      { nombre: "Acondicionador Free Off", presentaciones: ["300ml"] }
    ]
  },
  {
    categoria: "Terapias, Sueros y Protectores",
    productos: [
      { nombre: "Terapia Antifrizz", presentaciones: ["500gr", "150gr"] },
      { nombre: "Suero Purificante", presentaciones: ["50ml"] },
      { nombre: "Suero Revitalizante", presentaciones: ["50ml"] },
      { nombre: "Suero Calmante", presentaciones: ["50ml"] },
      { nombre: "Protector Térmico Repair", presentaciones: ["240ml"] },
      { nombre: "Protector Térmico Frizz Boost", presentaciones: ["240ml"] }
    ]
  },
  {
    categoria: "Línea Anticaída y Detox",
    productos: [
      { nombre: "Shampoo Anticaída", presentaciones: ["300ml"] },
      { nombre: "Shampoo Anticaída For Men", presentaciones: ["300ml"] },
      { nombre: "Acondicionador Nutritivo", presentaciones: ["300ml"] },
      { nombre: "Tónico Anticaída", presentaciones: ["50ml"] },
      { nombre: "Tónico Anticaída For Men", presentaciones: ["60ml"] },
      { nombre: "Shampoo Detox", presentaciones: ["300ml"] }
    ]
  },
  {
    categoria: "Boosters",
    productos: [
      { nombre: "Booster Full Hidratación", presentaciones: ["Unidad"] },
      { nombre: "Booster Full Nutrición", presentaciones: ["Unidad"] },
      { nombre: "Booster Full Reparación", presentaciones: ["Unidad"] },
      { nombre: "Booster Profesional", presentaciones: ["20ml"] }
    ]
  }
];

export default function App() {
  const [user, setUser] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [activeTab, setActiveTab] = useState('ventas');
  const [loading, setLoading] = useState(true);

  // Autenticación inicial
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Error de autenticación:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Escuchar datos de Firestore en tiempo real
  useEffect(() => {
    if (!user) return;

    // Ruta compatible con el entorno de Canvas y la versión de producción
    const pedidosRef = collection(db, 'artifacts', appId, 'public', 'data', 'pedidos');
    const unsubscribe = onSnapshot(pedidosRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Ordenar por fecha de creación (los más nuevos primero)
      data.sort((a, b) => b.fechaCreacion - a.fechaCreacion);
      setPedidos(data);
      setLoading(false);
    }, (error) => {
      console.error("Error obteniendo pedidos:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Actualizar el estado de un pedido
  const cambiarEstado = async (id, nuevoEstado) => {
    if (!user) return;
    try {
      const pedidoRef = doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', id);
      await updateDoc(pedidoRef, { status: nuevoEstado });
    } catch (error) {
      console.error("Error actualizando:", error);
    }
  };

  const eliminarPedido = async (id) => {
    if(!window.confirm("¿Estás seguro de eliminar este pedido?")) return;
    if (!user) return;
    try {
      const pedidoRef = doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', id);
      await deleteDoc(pedidoRef);
    } catch (error) {
      console.error("Error eliminando:", error);
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-blue-600 font-semibold">Cargando sistema...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row font-sans text-slate-800">
      
      {/* SIDEBAR (No visible al imprimir) */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex-shrink-0 print:hidden shadow-xl z-10">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-white tracking-tight">📦 LogiWeb</h1>
          <p className="text-xs text-slate-500 mt-1">Gestión de Envíos</p>
        </div>
        <nav className="mt-2 flex flex-row md:flex-col gap-1 px-4 overflow-x-auto">
          <TabButton 
            active={activeTab === 'ventas'} 
            onClick={() => setActiveTab('ventas')} 
            icon={<ShoppingCart size={20} />} 
            label="1. Ventas" 
          />
          <TabButton 
            active={activeTab === 'admin'} 
            onClick={() => setActiveTab('admin')} 
            icon={<CheckSquare size={20} />} 
            label={`2. Administración (${pedidos.filter(p => p.status === 'Pendiente').length})`} 
          />
          <TabButton 
            active={activeTab === 'despacho'} 
            onClick={() => setActiveTab('despacho')} 
            icon={<Truck size={20} />} 
            label={`3. Despacho (${pedidos.filter(p => p.status === 'Validado').length})`} 
          />
        </nav>
      </aside>

      {/* CONTENIDO PRINCIPAL (Oculto al imprimir si no es lo que queremos imprimir) */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto print:p-0 print:m-0 print:bg-white print:block">
        <div className="max-w-5xl mx-auto print:max-w-none print:mx-0">
          
          <div className="print:hidden">
            {activeTab === 'ventas' && <PanelVentas user={user} pedidos={pedidos} />}
            {activeTab === 'admin' && <PanelAdmin pedidos={pedidos} cambiarEstado={cambiarEstado} eliminarPedido={eliminarPedido} />}
            {activeTab === 'despacho' && <PanelDespacho pedidos={pedidos} cambiarEstado={cambiarEstado} user={user} />}
          </div>

          {/* VISTA DE IMPRESIÓN (Solo visible al imprimir) */}
          <VistaImpresion pedidos={pedidos.filter(p => p.status === 'Validado')} />

        </div>
      </main>
    </div>
  );
}

// ==========================================
// COMPONENTES DE PANELES
// ==========================================

function PanelVentas({ user, pedidos }) {
  const [vista, setVista] = useState('nuevo'); // 'nuevo' | 'historial'
  
  const [formData, setFormData] = useState({
    clienteNombre: '',
    clienteCedula: '',
    clienteTelefono: '',
    courier: 'ZOOM',
    direccion: '',
    productos: '',
    monto: '',
    referencia: '',
    asesora: ''
  });
  const [enviando, setEnviando] = useState(false);
  
  // Estados para la funcionalidad de IA y Catálogo
  const [textoCrudo, setTextoCrudo] = useState('');
  const [analizando, setAnalizando] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);

  const handleChange = (e) => setFormData({...formData, [e.target.name]: e.target.value});

  const analizarConGemini = async () => {
    if (!textoCrudo.trim()) return alert("Por favor, pega el mensaje de WhatsApp primero.");
    setAnalizando(true);
    
    try {
      const apiKey = GEMINI_API_KEY;
      const prompt = "Eres un asistente de logística. Analiza el siguiente texto y extrae los datos del pedido en formato JSON para autocompletar un formulario. TOMA EN CUENTA ESTO: El nombre de la empresa de envíos (courier) suele estar al principio del texto (ej. 'ENVIO 3 ZOOM', 'ENVIO TEALCA'). El nombre de la asesora suele estar al final del texto (ej. 'Asesora Manuela'). Formatea el teléfono internacionalmente (ej. 584...). Si no encuentras un dato, omítelo. Texto:\n\n" + textoCrudo;
      
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
      const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                clienteNombre: { type: "STRING" },
                clienteCedula: { type: "STRING" },
                clienteTelefono: { type: "STRING", description: "Formato internacional sin el +, ej: 584123456789" },
                courier: { type: "STRING", description: "La empresa de envíos. DEBE SER EXACTAMENTE uno de estos: ZOOM, MRW, Tealca, Domesa." },
                direccion: { type: "STRING" },
                productos: { type: "STRING" },
                monto: { type: "STRING", description: "Monto y moneda pagada" },
                referencia: { type: "STRING", description: "Referencia de la transferencia" },
                asesora: { type: "STRING", description: "Nombre de la asesora (suele estar al final)" }
              }
            }
          }
        })
      };

      let resultData;
      const delays = [1000, 2000, 4000, 8000, 16000];
      for (let i = 0; i < 5; i++) {
        try {
          const res = await fetch(url, options);
          if (!res.ok) throw new Error(`HTTP error ${res.status}`);
          resultData = await res.json();
          break;
        } catch (err) {
          if (i === 4) throw err;
          await new Promise(r => setTimeout(r, delays[i]));
        }
      }

      if (resultData?.candidates?.[0]?.content?.parts?.[0]?.text) {
         const result = JSON.parse(resultData.candidates[0].content.parts[0].text);
         
         let detectedCourier = prev => prev.courier;
         if (result.courier) {
           const upperCourier = result.courier.toUpperCase();
           if (upperCourier.includes("TEALCA")) detectedCourier = "Tealca";
           else if (upperCourier.includes("ZOOM")) detectedCourier = "ZOOM";
           else if (upperCourier.includes("MRW")) detectedCourier = "MRW";
           else if (upperCourier.includes("DOMESA")) detectedCourier = "Domesa";
         }

         setFormData(prev => ({
           ...prev,
           clienteNombre: result.clienteNombre || prev.clienteNombre,
           clienteCedula: result.clienteCedula || prev.clienteCedula,
           clienteTelefono: result.clienteTelefono || prev.clienteTelefono,
           courier: typeof detectedCourier === 'function' ? detectedCourier(prev) : detectedCourier,
           direccion: result.direccion || prev.direccion,
           productos: result.productos || prev.productos,
           monto: result.monto || prev.monto,
           referencia: result.referencia || prev.referencia,
           asesora: result.asesora || prev.asesora
         }));
      }
    } catch(e) {
      console.error("Error API Gemini:", e);
      alert("Hubo un error al intentar extraer los datos con la IA. Por favor, inténtalo de nuevo.");
    } finally {
      setAnalizando(false);
    }
  };

  const calcularFechaDespacho = () => {
    const ahora = new Date();
    const hora = ahora.getHours();
    const minutos = ahora.getMinutes();
    
    let fechaDespacho = new Date(ahora);
    if (hora > 12 || (hora === 12 && minutos > 15)) {
      fechaDespacho.setDate(fechaDespacho.getDate() + 1);
    }
    return fechaDespacho.toLocaleDateString('es-VE');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return alert("Error de conexión");
    setEnviando(true);

    try {
      const pedidosRef = collection(db, 'artifacts', appId, 'public', 'data', 'pedidos');
      await addDoc(pedidosRef, {
        ...formData,
        status: 'Pendiente',
        fechaCreacion: Date.now(),
        fechaDespacho: calcularFechaDespacho(),
        guia: '',
        linkGuia: '',
        linkFotoProductos: ''
      });
      alert("¡Pedido registrado con éxito! Pasó a Administración.");
      setFormData({
        clienteNombre: '', clienteCedula: '', clienteTelefono: '', courier: 'ZOOM',
        direccion: '', productos: '', monto: '', referencia: '', asesora: ''
      });
      setVista('historial'); // Redirigir al historial para verlo
    } catch (error) {
      console.error("Error al guardar:", error);
      alert("Hubo un error al guardar.");
    }
    setEnviando(false);
  };

  const enviarWhatsApp = (pedido) => {
    const mensaje = `Hola ${pedido.clienteNombre}, tu pedido ha sido procesado y enviado por *${pedido.courier}*.%0A%0A*Tu número de guía es:* ${pedido.guia}%0A%0A${pedido.linkGuia ? `Foto de tu guía: ${pedido.linkGuia}%0A` : ''}${pedido.linkFotoProductos ? `Foto de tus productos: ${pedido.linkFotoProductos}%0A` : ''}%0ACualquier duda estamos a la orden.`;
    const cleanPhone = String(pedido.clienteTelefono).replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${mensaje}`, '_blank');
  };

  const getStatusBadge = (status) => {
    const badges = {
      'Pendiente': 'bg-amber-100 text-amber-800 border-amber-200',
      'Validado': 'bg-blue-100 text-blue-800 border-blue-200',
      'Rechazado': 'bg-red-100 text-red-800 border-red-200',
      'Despachado': 'bg-green-100 text-green-800 border-green-200'
    };
    return <span className={`px-2 py-1 rounded-full text-xs font-bold border ${badges[status] || 'bg-slate-100 text-slate-800'}`}>{status}</span>;
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      
      {/* Navegación Interna */}
      <div className="flex gap-4 border-b border-slate-200 mb-6">
        <button 
          onClick={() => setVista('nuevo')}
          className={`pb-3 font-bold px-2 flex items-center gap-2 ${vista === 'nuevo' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <ShoppingCart size={18} /> Registrar Nuevo
        </button>
        <button 
          onClick={() => setVista('historial')}
          className={`pb-3 font-bold px-2 flex items-center gap-2 ${vista === 'historial' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <ClipboardList size={18} /> Mis Pedidos
        </button>
      </div>

      {vista === 'nuevo' ? (
        <div>
          {/* Módulo de Inteligencia Artificial (Gemini) */}
          <div className="mb-6 bg-indigo-50 p-4 rounded-lg border border-indigo-100">
            <h3 className="text-indigo-800 font-bold mb-2 flex items-center gap-2">
              <Sparkles size={18} className="text-indigo-600" /> Autocompletar con IA ✨
            </h3>
            <p className="text-sm text-indigo-600 mb-3">Pega el texto que te envió el cliente por WhatsApp y la Inteligencia Artificial extraerá y rellenará los datos en el formulario por ti.</p>
            <div className="flex flex-col md:flex-row gap-3">
              <textarea 
                className="flex-1 p-3 border border-indigo-200 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-sm resize-none" 
                rows={3} 
                placeholder="Ej: Hola, soy Maria Perez, CI 1234567, Tlf 04141234567. Pago por 30$ ref 987654. Enviar a Ciudad Bolivar por ZOOM. 1 Litro de Células Madres."
                value={textoCrudo}
                onChange={(e) => setTextoCrudo(e.target.value)}
              ></textarea>
              <button 
                type="button"
                onClick={analizarConGemini}
                disabled={analizando}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded shadow transition disabled:opacity-50 flex items-center justify-center gap-2 md:w-48"
              >
                {analizando ? 'Analizando...' : 'Extraer Datos ✨'}
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Input label="Asesora de Ventas" name="asesora" value={formData.asesora} onChange={handleChange} placeholder="Ej. Manuela" required />
            <Input label="Nombre del Cliente" name="clienteNombre" value={formData.clienteNombre} onChange={handleChange} required />
            <Input label="Cédula / RIF" name="clienteCedula" value={formData.clienteCedula} onChange={handleChange} required />
            <Input label="Teléfono (Formato Ej: 584241234567)" name="clienteTelefono" value={formData.clienteTelefono} onChange={handleChange} type="tel" required />
            
            <div className="flex flex-col">
              <label className="text-sm font-semibold text-slate-700 mb-1">Empresa de Envío (Courier)</label>
              <select name="courier" value={formData.courier} onChange={handleChange} className="p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="ZOOM">ZOOM</option>
                <option value="MRW">MRW</option>
                <option value="Tealca">Tealca</option>
                <option value="Domesa">Domesa</option>
              </select>
            </div>

            <Input label="Monto Pagado ($ o Bs)" name="monto" value={formData.monto} onChange={handleChange} placeholder="Ej. 30$" required />
            <Input label="Referencia de Pago / Banco" name="referencia" value={formData.referencia} onChange={handleChange} placeholder="Ej. 123456 Mercantil" required />
            
            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-700 mb-1 block">Dirección de Envío Completa</label>
              <textarea name="direccion" value={formData.direccion} onChange={handleChange} required rows={2} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"></textarea>
            </div>
            
            <div className="md:col-span-2">
              <div className="flex justify-between items-end mb-1">
                <label className="text-sm font-semibold text-slate-700 block">Productos y Cantidades</label>
                <button 
                  type="button" 
                  onClick={() => setIsCatalogOpen(true)} 
                  className="text-xs font-bold text-white bg-slate-800 py-1.5 px-3 rounded hover:bg-slate-900 flex items-center gap-1 shadow-sm transition"
                >
                  <Package size={14} /> Seleccionar del Catálogo Visual
                </button>
              </div>
              <textarea name="productos" value={formData.productos} onChange={handleChange} required rows={3} placeholder="Ej. 1 Litro de Células Madres" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"></textarea>
            </div>

            <div className="md:col-span-2 flex justify-end mt-4">
              <button type="submit" disabled={enviando} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-md transition flex items-center gap-2">
                {enviando ? 'Guardando...' : <><ShoppingCart size={18} /> Enviar a Administración</>}
              </button>
            </div>
          </form>

          <ModalCatalogo 
            isOpen={isCatalogOpen} 
            onClose={() => setIsCatalogOpen(false)} 
            onConfirm={(textoNuevosProductos) => {
              setFormData(prev => ({
                ...prev,
                productos: prev.productos ? `${prev.productos}\n${textoNuevosProductos}` : textoNuevosProductos
              }));
              setIsCatalogOpen(false);
            }} 
          />
        </div>
      ) : (
        /* VISTA DE HISTORIAL DE VENTAS */
        <div className="overflow-x-auto">
          {pedidos.length === 0 ? (
            <p className="text-slate-500 text-center p-4">No hay pedidos registrados aún.</p>
          ) : (
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-100 text-slate-700 text-sm">
                  <th className="p-3 border-b">Fecha</th>
                  <th className="p-3 border-b">Cliente</th>
                  <th className="p-3 border-b">Monto</th>
                  <th className="p-3 border-b">Estatus</th>
                  <th className="p-3 border-b text-center">Acciones / Guía</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map(p => (
                  <tr key={p.id} className="border-b hover:bg-slate-50 transition">
                    <td className="p-3 text-sm text-slate-600">
                      {new Date(p.fechaCreacion).toLocaleDateString('es-VE')}
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-800">{p.clienteNombre}</div>
                      <div className="text-xs text-slate-500">{p.asesora}</div>
                    </td>
                    <td className="p-3 font-semibold text-slate-700">{p.monto}</td>
                    <td className="p-3">{getStatusBadge(p.status)}</td>
                    <td className="p-3 text-center">
                      {p.status === 'Despachado' ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-bold text-slate-600">Guía: {p.guia}</span>
                          <button 
                            onClick={() => enviarWhatsApp(p)} 
                            className="bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-1.5 px-3 rounded flex items-center justify-center gap-1 shadow-sm transition"
                          >
                            <MessageCircle size={14} /> Enviar al Cliente
                          </button>
                        </div>
                      ) : p.status === 'Rechazado' ? (
                        <span className="text-xs text-red-500">Revisar Pago</span>
                      ) : (
                        <span className="text-xs text-slate-400">En proceso...</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function PanelAdmin({ pedidos, cambiarEstado, eliminarPedido }) {
  const [vistaAdmin, setVistaAdmin] = useState('pendientes');
  const [expandedRows, setExpandedRows] = useState({});

  const pedidosPendientes = pedidos.filter(p => p.status === 'Pendiente' || p.status === 'Rechazado');
  const historial = pedidos.filter(p => p.status === 'Validado' || p.status === 'Despachado');

  const toggleExpand = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      
      {/* Navegación Interna */}
      <div className="flex justify-between items-end border-b border-slate-200 mb-6">
        <div className="flex gap-4">
          <button 
            onClick={() => setVistaAdmin('pendientes')}
            className={`pb-3 font-bold px-2 flex items-center gap-2 ${vistaAdmin === 'pendientes' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Clock size={18} /> Por Validar ({pedidosPendientes.length})
          </button>
          <button 
            onClick={() => setVistaAdmin('historial')}
            className={`pb-3 font-bold px-2 flex items-center gap-2 ${vistaAdmin === 'historial' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <CheckSquare size={18} /> Historial
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        {(vistaAdmin === 'pendientes' ? pedidosPendientes : historial).length === 0 ? (
          <p className="text-slate-500 text-center p-4">No hay pedidos en esta sección.</p>
        ) : (
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-slate-100 text-slate-700 text-sm">
                <th className="p-3 border-b w-10 text-center">Info</th>
                <th className="p-3 border-b">Fecha/Asesora</th>
                <th className="p-3 border-b">Cliente</th>
                <th className="p-3 border-b">Monto & Ref</th>
                <th className="p-3 border-b text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {(vistaAdmin === 'pendientes' ? pedidosPendientes : historial).map(p => (
                <React.Fragment key={p.id}>
                  <tr className={`border-b hover:bg-slate-50 transition ${p.status === 'Rechazado' ? 'bg-red-50' : ''}`}>
                    <td className="p-3 text-center align-top pt-4">
                      <button 
                        onClick={() => toggleExpand(p.id)}
                        className="p-1 rounded-full text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                        title="Ver productos cotizados"
                      >
                        {expandedRows[p.id] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </button>
                    </td>
                    <td className="p-3 text-sm align-top">
                      <div>{new Date(p.fechaCreacion).toLocaleString('es-VE', {dateStyle:'short', timeStyle:'short'})}</div>
                      <div className="text-slate-500 font-semibold">{p.asesora}</div>
                    </td>
                    <td className="p-3 align-top">
                      <div className="font-semibold">{p.clienteNombre}</div>
                      <div className="text-xs text-slate-500">{p.clienteCedula}</div>
                    </td>
                    <td className="p-3 align-top">
                      <div className="font-bold text-green-600">{p.monto}</div>
                      <div className="text-sm text-slate-600">Ref: {p.referencia}</div>
                    </td>
                    <td className="p-3 align-top">
                      {vistaAdmin === 'pendientes' ? (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => cambiarEstado(p.id, 'Rechazado')} className="p-2 text-red-600 hover:bg-red-100 rounded-full transition" title="Rechazar Pago">
                            <XCircle size={24} />
                          </button>
                          <button onClick={() => cambiarEstado(p.id, 'Validado')} className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-full transition" title="Aprobar Pago">
                            <CheckCircle size={24} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-end gap-1">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${p.status === 'Despachado' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                            {p.status}
                          </span>
                          <button onClick={() => cambiarEstado(p.id, 'Pendiente')} className="text-xs text-slate-400 hover:text-slate-600 underline">Deshacer</button>
                        </div>
                      )}
                    </td>
                  </tr>
                  
                  {/* Fila desplegable con los productos (Soporte) */}
                  {expandedRows[p.id] && (
                    <tr className="bg-blue-50/30">
                      <td colSpan="5" className="px-6 py-4 border-b border-blue-100">
                        <div className="bg-white border border-blue-200 rounded p-3 text-sm flex gap-3">
                          <Package className="text-blue-400 shrink-0 mt-1" size={18} />
                          <div>
                            <div className="font-bold text-slate-700 mb-1">Productos a Despachar:</div>
                            <div className="whitespace-pre-wrap text-slate-600">{p.productos}</div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function PanelDespacho({ pedidos, cambiarEstado, user }) {
  const pedidosValidados = pedidos.filter(p => p.status === 'Validado' || p.status === 'Despachado');
  const pedidosPendientes = pedidos.filter(p => p.status === 'Pendiente' || p.status === 'Rechazado').length;
  const [guiasInput, setGuiasInput] = useState({});
  const [subiendo, setSubiendo] = useState({ id: null, field: null });

  const handleGuiaChange = (id, field, value) => {
    setGuiasInput(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
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
    
    // Validación de campos obligatorios
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

      {/* NOTIFICACIÓN DE PEDIDOS PENDIENTES */}
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
                        <div className="text-xs text-emerald-600 font-bold mb-2">✓ Listo (Ventas notificará)</div>
                        <button onClick={() => cambiarEstado(p.id, 'Validado')} className="text-slate-400 hover:text-slate-600 text-xs underline">Editar envío</button>
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
                        
                        {/* Campo Foto de Guía */}
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

                        {/* Campo Foto de Productos */}
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
// COMPONENTE DE IMPRESIÓN (Solo visible en Ctrl+P)
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
        {pedidos.map((p, index) => (
          <div key={p.id} className="border-2 border-black p-4 break-inside-avoid">
            <div className="flex justify-between border-b-2 border-black pb-2 mb-2">
              <span className="font-bold text-lg">{p.courier.toUpperCase()}</span>
              <span className="text-sm">Envío programado: {p.fechaDespacho}</span>
            </div>
            <div className="space-y-1 text-sm">
              <p><span className="font-bold">DESTINATARIO:</span> {p.clienteNombre.toUpperCase()}</p>
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
// COMPONENTES UI AUXILIARES
// ==========================================

function TabButton({ active, onClick, icon, label }) {
  return (
    <button 
      onClick={onClick} 
      className={`flex items-center gap-3 w-full p-3 rounded-lg font-medium transition-colors mb-2 whitespace-nowrap
        ${active 
          ? 'bg-blue-600 text-white shadow-md' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }`}
    >
      {icon} {label}
    </button>
  );
}

function Input({ label, name, value, onChange, type = "text", required = false, placeholder = "" }) {
  return (
    <div className="flex flex-col">
      <label className="text-sm font-semibold text-slate-700 mb-1">{label}</label>
      <input 
        type={type} 
        name={name} 
        value={value} 
        onChange={onChange} 
        required={required}
        placeholder={placeholder}
        className="p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none transition"
      />
    </div>
  );
}

// ==========================================
// COMPONENTES DEL CATÁLOGO VISUAL
// ==========================================

function ModalCatalogo({ isOpen, onClose, onConfirm }) {
  const [carrito, setCarrito] = useState({});

  if (!isOpen) return null;

  const updateQty = (key, delta) => {
    setCarrito(prev => {
      const actual = prev[key] || 0;
      const nuevo = Math.max(0, actual + delta);
      if (nuevo === 0) {
        const copia = { ...prev };
        delete copia[key];
        return copia;
      }
      return { ...prev, [key]: nuevo };
    });
  };

  const handleConfirm = () => {
    const lineas = [];
    Object.entries(carrito).forEach(([key, qty]) => {
      const [prod, pres] = key.split('|');
      lineas.push(`- ${qty}x ${prod} (${pres})`);
    });
    
    if (lineas.length === 0) {
      alert("No has seleccionado ningún producto.");
      return;
    }

    onConfirm(lineas.join('\n'));
    setCarrito({}); // Resetear el carrito tras confirmar
  };

  const totalItems = Object.values(carrito).reduce((a, b) => a + b, 0);

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-2 md:p-4 animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[95vh] md:h-[85vh] flex flex-col overflow-hidden">
        
        {/* Header del Modal */}
        <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Package className="text-blue-600" /> Catálogo Visual de Productos
            </h2>
            <p className="text-sm text-slate-500 mt-1">Selecciona las presentaciones y cantidades para añadir al pedido.</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition">
            <X size={24} />
          </button>
        </div>

        {/* Contenido Scrolleable */}
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

        {/* Footer / Resumen de Compra */}
        <div className="p-4 border-t bg-white flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-slate-600 font-medium">
            Productos seleccionados: <span className="font-bold text-blue-600 text-lg">{totalItems}</span>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <button onClick={onClose} className="flex-1 md:flex-none px-6 py-2 border border-slate-300 text-slate-700 font-semibold rounded hover:bg-slate-50 transition">
              Cancelar
            </button>
            <button 
              onClick={handleConfirm} 
              className="flex-1 md:flex-none px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow transition flex justify-center items-center gap-2"
            >
              <Plus size={18} /> Añadir al Pedido
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
                <button 
                  onClick={() => updateQty(key, -1)} 
                  disabled={!hasQty}
                  className={`p-1 rounded transition ${hasQty ? 'bg-white text-blue-600 shadow-sm hover:bg-blue-100' : 'text-slate-300 bg-slate-50 cursor-not-allowed'}`}
                >
                  <Minus size={14} />
                </button>
                <span className={`w-5 text-center font-bold ${hasQty ? 'text-blue-700' : 'text-slate-400'}`}>{qty}</span>
                <button 
                  onClick={() => updateQty(key, 1)} 
                  className="p-1 bg-white border border-slate-200 text-slate-600 shadow-sm rounded hover:bg-slate-100 hover:text-slate-800 transition"
                >
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