import React, { useState, useEffect, useMemo } from 'react';
import { Briefcase, ClipboardList, Package, Search, XCircle, CheckCircle, Loader2, Archive, Wallet, StoreIcon, Truck, Bike, FileType, FileText, Image as ImageIcon, ShieldCheck, Ban } from 'lucide-react';
import { Input, InputDark, StatusBadge } from '../components/ui';
import ModalCatalogo from '../components/modals/ModalCatalogo';
import { collection, onSnapshot, addDoc, doc, runTransaction, updateDoc } from 'firebase/firestore';
import { URL_GOOGLE_SCRIPT } from '../config/firebase';
import { compressImage } from '../utils/image';
import { ROLES } from '../config/constants';

export default function PanelConsignaciones({ perfil, catalogo, stock, db, appId, loggear, dialogs }) {
  const esAdmin = [ROLES.ADMIN, ROLES.ADMINISTRACION, ROLES.AUDITORIA].includes(perfil?.role);
  
  const [vista, setVista] = useState('nuevo');
  const [consignaciones, setConsignaciones] = useState([]);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [modalAbonoData, setModalAbonoData] = useState(null);
  const [subiendoArchivo, setSubiendoArchivo] = useState({ foto: false, comprobante: false });

  const getLocalToday = () => {
    const d = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Caracas"}));
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  const defaultForm = {
    clienteNombre: '', clienteCedula: '', clienteTelefono: '', direccion: '',
    asesora: perfil?.nombre || '',
    afectaInventario: true, almacenOrigen: 'envios',
    tipoDespacho: 'Nacional', courier: '', pagoEnvio: 'COD', costoEnvio: '',
    deliveryFecha: getLocalToday(), deliveryHora: '',
    retiroNombre: '', retiroCedula: '', retiroTelefono: '',
    linkFotoProductos: '', linkComprobante: '', abonoInicial: '',
    carritoObj: {}, totalMercancia: '0.00'
  };

  const [formData, setFormData] = useState(defaultForm);
  const [mismoClienteRetira, setMismoClienteRetira] = useState(false);

  // Escuchar consignaciones
  useEffect(() => {
    const ref = collection(db, 'artifacts', appId, 'public', 'data', 'consignaciones');
    const unsub = onSnapshot(ref, (snap) => {
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        data.sort((a, b) => b.fechaEmision - a.fechaEmision);
        setConsignaciones(data);
    });
    return () => unsub();
  }, [db, appId]);

  // Calcular totales
  useEffect(() => {
    let subTotal = 0;
    if (formData.carritoObj) {
      Object.entries(formData.carritoObj).forEach(([key, qty]) => {
        const [n, p] = key.split('|');
        catalogo.forEach(cat => cat.productos.forEach(prod => {
          if (prod.nombre === n) {
            const i = prod.presentaciones.indexOf(p);
            if (i >= 0 && prod.precios) subTotal += (prod.precios[i] * qty);
          }
        }));
      });
    }
    setFormData(prev => ({ ...prev, totalMercancia: subTotal.toFixed(2) }));
  }, [formData.carritoObj, catalogo]);

  const eliminarDelCarrito = (itemKey) => {
    setFormData(prev => {
      const nuevoCarrito = { ...prev.carritoObj };
      delete nuevoCarrito[itemKey];
      return { ...prev, carritoObj: nuevoCarrito };
    });
  };

  // Subida de imágenes
  const handleFileUpload = async (e, field) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!URL_GOOGLE_SCRIPT) return dialogs.alert("El sistema de subida no está configurado.");
    
    setSubiendoArchivo(prev => ({ ...prev, [field]: true }));
    try {
      const base64Data = await compressImage(file, 1000, 0.8);
      const response = await fetch(URL_GOOGLE_SCRIPT, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          tokenSecreto: import.meta.env.VITE_UPLOAD_TOKEN,
          fileName: `Consignacion_${field}_${Date.now()}.jpg`,
          mimeType: 'image/jpeg', data: base64Data
        })
      });
      const result = await response.json();
      if (result.url) setFormData(prev => ({ ...prev, [field]: result.url }));
    } catch (error) {
      dialogs.alert("Error subiendo el archivo. Revisa tu conexión.");
    }
    setSubiendoArchivo(prev => ({ ...prev, [field]: false }));
  };

  // =========================================================================
  // PASO 1: CREACIÓN (Queda PENDIENTE)
  // =========================================================================
  const procesarCreacion = async (e) => {
    e.preventDefault();
    if (!formData.carritoObj || Object.keys(formData.carritoObj).length === 0) return dialogs.alert("El carrito está vacío.");
    
    if (formData.tipoDespacho === 'Nacional' && !formData.courier) return dialogs.alert("Selecciona la Empresa de Envío.");
    if (formData.tipoDespacho === 'Tienda' && (!formData.retiroNombre || !formData.retiroCedula)) return dialogs.alert("Completa quién retira en tienda.");
    
    setEnviando(true);
    try {
      let textoProductos = "";
      Object.entries(formData.carritoObj).forEach(([key, qty]) => { textoProductos += `- ${qty}x ${key.replace('|', ' ')}\n`; });

      const costoEnvioNum = parseFloat(formData.costoEnvio) || 0;
      const mercanciaNum = parseFloat(formData.totalMercancia) || 0;
      const totalDeudaReal = mercanciaNum + ((formData.tipoDespacho === 'Delivery' || formData.pagoEnvio === 'PAGADO') ? costoEnvioNum : 0);
      const abonoInicialNum = parseFloat(formData.abonoInicial) || 0;

      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'consignaciones'), {
          ...formData,
          productosTexto: textoProductos.trim(),
          costoEnvio: costoEnvioNum,
          totalEntregado: totalDeudaReal,
          totalAbonado: 0, 
          abonoInicialPendiente: abonoInicialNum, 
          saldoPendiente: totalDeudaReal, 
          estado: 'Pendiente',
          fechaEmision: Date.now(),
          creadoPor: perfil.nombre
      });

      loggear('CONSIGNACION_REGISTRADA', `Consignación PENDIENTE para ${formData.clienteNombre}`);
      dialogs.alert("Consignación registrada y enviada a Validación de Administración.", "Éxito");
      setFormData(defaultForm);
      setVista('historial');
    } catch (e) {
      dialogs.alert("Error al procesar: " + e.message);
    }
    setEnviando(false);
  };

  // =========================================================================
  // PASO 2: VALIDACIÓN ADMIN (Descuenta Stock y Activa)
  // =========================================================================
  const handleValidar = async (c) => {
    dialogs.confirm(`¿Estás seguro de APROBAR la consignación de ${c.clienteNombre}? ${c.afectaInventario ? '\n\nEsto DESCONTARÁ el stock del inventario.' : ''}`, async () => {
        setEnviando(true);
        try {
            const consRef = doc(db, 'artifacts', appId, 'public', 'data', 'consignaciones', c.id);
            let nuevoSaldo = c.totalEntregado;
            let totalAbonado = 0;

            await runTransaction(db, async (t) => {
                // 1. Descontar Inventario si aplica
                if (c.afectaInventario) {
                    const stockRef = doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'stock');
                    const stockSnap = await t.get(stockRef);
                    if (!stockSnap.exists()) throw new Error("Inventario no encontrado.");
                    let nuevoStock = { ...stockSnap.data() };
                    
                    for (const [key, qty] of Object.entries(c.carritoObj)) {
                        let actual = typeof nuevoStock[key] === 'object' ? (nuevoStock[key][c.almacenOrigen] || 0) : (nuevoStock[key] || 0);
                        if (actual < qty) throw new Error(`Stock insuficiente para ${key}`);
                        if (typeof nuevoStock[key] === 'object') nuevoStock[key][c.almacenOrigen] -= qty;
                        else nuevoStock[key] -= qty;
                    }
                    t.update(stockRef, nuevoStock);

                    // Registrar Movimiento
                    const movRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'movimientos'));
                    t.set(movRef, {
                        tipo: 'SALIDA', motivo: 'Consignación Aprobada', referencia: `Despacho a ${c.clienteNombre}`,
                        items: c.carritoObj, fechaCreacion: Date.now(), autor: perfil.nombre, status: 'APROBADO'
                    });
                }

                // 2. Procesar Abono Inicial si lo hubo
                if (c.abonoInicialPendiente > 0) {
                    totalAbonado = c.abonoInicialPendiente;
                    nuevoSaldo -= totalAbonado;
                    
                    const cajaRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'ingresos_caja'));
                    t.set(cajaRef, {
                        monto: totalAbonado, metodo: 'Abono Inicial',
                        concepto: `Abono Inicial Consignación - ${c.clienteNombre}`,
                        asesora: c.asesora, 
                        fecha: Date.now(), tipo: 'Ingreso', registradoPor: perfil.nombre
                    });
                }

                // 3. Activar Consignación
                t.update(consRef, {
                    estado: nuevoSaldo <= 0 ? 'Liquidada' : (totalAbonado > 0 ? 'Parcialmente Pagada' : 'Abierta'),
                    saldoPendiente: nuevoSaldo,
                    totalAbonado: totalAbonado,
                    fechaValidacion: Date.now(),
                    validadoPor: perfil.nombre
                });
            });

            loggear("CONSIGNACION_VALIDADA", `Admin aprobó consignación de ${c.clienteNombre}`);
            dialogs.alert("Consignación Aprobada y Activa.", "Éxito");
        } catch (e) {
            dialogs.alert(e.message, "Fallo en Validación");
        }
        setEnviando(false);
    });
  };

  const handleRechazar = async (c) => {
    dialogs.prompt("Motivo del rechazo de esta consignación:", async (motivo) => {
        if(!motivo) return;
        try {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'consignaciones', c.id), {
                estado: 'Rechazada', motivoRechazo: motivo, fechaRechazo: Date.now(), rechazadoPor: perfil.nombre
            });
            loggear("CONSIGNACION_RECHAZADA", `Rechazada: ${c.clienteNombre}`);
        } catch(e) { dialogs.alert("Error al rechazar."); }
    });
  };

  // =========================================================================
  // PASO 3: MODAL ABONOS (Pagos Periódicos)
  // =========================================================================
  const ModalAbonos = () => {
    const [monto, setMonto] = useState('');
    const [metodo, setMetodo] = useState('Efectivo USD');
    const [cargandoAbono, setCargandoAbono] = useState(false);

    if (!modalAbonoData) return null;

    const handleAbonar = async (e) => {
        e.preventDefault();
        const montoNum = parseFloat(monto);
        if (montoNum <= 0) return dialogs.alert("El monto debe ser mayor a cero.");
        if (montoNum > modalAbonoData.saldoPendiente) return dialogs.alert("El abono supera la deuda.", "Aviso");

        setCargandoAbono(true);
        try {
            await runTransaction(db, async (t) => {
                const consRef = doc(db, 'artifacts', appId, 'public', 'data', 'consignaciones', modalAbonoData.id);
                const cajaRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'ingresos_caja'));
                
                const nuevoSaldo = modalAbonoData.saldoPendiente - montoNum;
                const nuevoAbonado = modalAbonoData.totalAbonado + montoNum;
                const nuevoEstado = nuevoSaldo <= 0 ? 'Liquidada' : 'Parcialmente Pagada';

                t.update(consRef, { saldoPendiente: nuevoSaldo, totalAbonado: nuevoAbonado, estado: nuevoEstado });

                t.set(cajaRef, {
                    monto: montoNum, metodo: metodo,
                    concepto: `Abono Consignación - ${modalAbonoData.clienteNombre}`,
                    asesora: modalAbonoData.asesora,
                    fecha: Date.now(), tipo: 'Ingreso', registradoPor: perfil.nombre
                });
            });

            dialogs.alert("Abono registrado en caja exitosamente.", "Abono Confirmado");
            setModalAbonoData(null);
        } catch (error) {
            dialogs.alert("Error registrando el abono.");
        }
        setCargandoAbono(false);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700 animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2"><Wallet className="text-sky-600"/> Registrar Abono</h3>
                    <button onClick={() => setModalAbonoData(null)} className="text-slate-400 hover:text-red-500"><XCircle size={24}/></button>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 mb-6">
                    <div className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">Cliente / Asesora</div>
                    <div className="font-black text-lg text-slate-800 dark:text-slate-100">{modalAbonoData.clienteNombre}</div>
                    <div className="text-xs text-slate-500 mb-3">{modalAbonoData.asesora}</div>
                    <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-700">
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Saldo por cobrar:</span>
                        <span className="font-black text-red-500 text-lg">${modalAbonoData.saldoPendiente.toFixed(2)}</span>
                    </div>
                </div>
                <form onSubmit={handleAbonar} className="space-y-5">
                    <Input label="Monto a abonar (USD/$)" type="number" step="0.01" max={modalAbonoData.saldoPendiente} value={monto} onChange={(e) => setMonto(e.target.value)} required placeholder="Ej: 50.00" />
                    <div className="flex flex-col">
                        <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1.5 ml-2">Método de Pago</label>
                        <select value={metodo} onChange={(e)=>setMetodo(e.target.value)} className="p-3.5 border-2 border-slate-100 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-900 outline-none focus:border-sky-500 font-bold text-slate-700 dark:text-slate-200 shadow-sm cursor-pointer">
                            <option value="Efectivo USD">Efectivo Dólares</option>
                            <option value="ZELLE">Zelle</option>
                            <option value="Pago Movil / Transferencia">Pago Móvil / Transf. (Equiv Bs)</option>
                        </select>
                    </div>
                    <button type="submit" disabled={cargandoAbono} className="w-full bg-sky-600 hover:bg-sky-700 text-white font-black py-4 rounded-2xl shadow-lg flex justify-center items-center gap-2 uppercase tracking-widest transition-all disabled:opacity-50">
                        {cargandoAbono ? <Loader2 className="animate-spin" /> : 'Confirmar Ingreso a Caja'}
                    </button>
                </form>
            </div>
        </div>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-4 md:p-8 rounded-3xl border dark:border-slate-700 shadow-sm transition-colors">
      
      <div className="flex flex-wrap gap-4 mb-8 border-b dark:border-slate-700 pb-2">
        <button onClick={() => setVista('nuevo')} className={`pb-3 font-black text-xs uppercase tracking-widest transition-colors ${vista === 'nuevo' ? 'text-sky-600 border-b-2 border-sky-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
            <Briefcase size={18} className="inline mr-1" /> Solicitar Consignación
        </button>
        <button onClick={() => setVista('historial')} className={`pb-3 font-black text-xs uppercase tracking-widest transition-colors ${vista === 'historial' ? 'text-sky-600 border-b-2 border-sky-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
            <ClipboardList size={18} className="inline mr-1" /> Control y Cuentas por Cobrar
        </button>
      </div>

      {vista === 'nuevo' && (
        <form onSubmit={procesarCreacion} className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
          
          <div className="md:col-span-2 flex flex-col md:flex-row gap-4 p-5 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50">
            <div className="flex-1">
              <h4 className="font-bold text-amber-800 dark:text-amber-500 flex items-center gap-2"><Archive size={18}/> ¿Afectar Inventario Actual?</h4>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Desactiva esta opción SOLO si estás registrando una consignación antigua que <b>ya fue entregada previamente</b>.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
               <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={formData.afectaInventario} onChange={(e) => setFormData({...formData, afectaInventario: e.target.checked})} />
                  <div className="w-14 h-7 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500"></div>
               </label>
               <span className="font-bold text-sm text-slate-700 dark:text-slate-300">{formData.afectaInventario ? 'Sí, descontar al Validar' : 'No descontar'}</span>
            </div>
          </div>

          <Input label="Asesora Responsable" value={formData.asesora} onChange={(e) => setFormData({...formData, asesora: e.target.value})} required />
          <div className="hidden md:block"></div> {/* Espaciador */}

          <Input label="Nombre del Cliente / Salón" value={formData.clienteNombre} onChange={(e) => setFormData({...formData, clienteNombre: e.target.value})} required />
          <Input label="Cédula/RIF" value={formData.clienteCedula} onChange={(e) => setFormData({...formData, clienteCedula: e.target.value})} required />
          <Input label="Teléfono (Sin el 0)" value={formData.clienteTelefono} onChange={(e) => setFormData({...formData, clienteTelefono: e.target.value})} required placeholder="Ej: 4141234567" />
          
          <div className="flex flex-col md:col-span-2 pt-4 border-t border-slate-100 dark:border-slate-700">
            <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-2 ml-2">Tipo de Despacho</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {['Nacional', 'Tienda', 'Delivery'].map(t => (
                <button type="button" key={t} onClick={() => setFormData({...formData, tipoDespacho: t})}
                  className={`p-4 rounded-xl font-black uppercase tracking-wider text-sm border-2 transition-all flex items-center justify-center gap-2 ${formData.tipoDespacho === t ? 'border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' : 'border-slate-200 text-slate-400 dark:border-slate-700 hover:border-sky-200'}`}>
                  {t === 'Nacional' ? <Truck size={18}/> : t === 'Tienda' ? <StoreIcon size={18}/> : <Bike size={18}/>}
                  {t === 'Nacional' ? 'Envío Nacional' : t === 'Tienda' ? 'Entrega Tienda' : 'Delivery'}
                </button>
              ))}
            </div>
          </div>

          {formData.tipoDespacho === 'Nacional' && (
            <>
              <div className="flex flex-col">
                <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1.5 ml-2">Empresa de Envío</label>
                <select value={formData.courier} onChange={(e)=>setFormData({...formData, courier: e.target.value})} className="p-3.5 border-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 outline-none font-bold text-slate-700 dark:text-slate-200">
                  <option value="" disabled>Seleccionar...</option><option value="ZOOM">ZOOM</option><option value="MRW">MRW</option><option value="Tealca">Tealca</option><option value="Domesa">Domesa</option>
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1.5 ml-2">Modalidad de Envío</label>
                <select value={formData.pagoEnvio} onChange={(e)=>setFormData({...formData, pagoEnvio: e.target.value})} className="p-3.5 border-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 outline-none font-bold text-slate-700 dark:text-slate-200">
                  <option value="COD">Cobro en Destino</option><option value="PAGADO">Envío Pagado</option>
                </select>
              </div>
            </>
          )}

          {formData.tipoDespacho === 'Tienda' && (
             <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="md:col-span-3 flex justify-between items-center mb-2">
                   <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Datos Retiro</h4>
                   <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-sky-600">
                      <input type="checkbox" checked={mismoClienteRetira} onChange={(e) => {
                         const chk = e.target.checked; setMismoClienteRetira(chk);
                         if (chk) setFormData(p => ({...p, retiroNombre: p.clienteNombre, retiroCedula: p.clienteCedula, retiroTelefono: p.clienteTelefono}));
                         else setFormData(p => ({...p, retiroNombre: '', retiroCedula: '', retiroTelefono: ''}));
                      }} className="w-4 h-4 accent-sky-600"/> Mismo Cliente
                   </label>
                </div>
                <Input label="Nombre Retira" value={formData.retiroNombre} onChange={e=>setFormData({...formData, retiroNombre: e.target.value})} disabled={mismoClienteRetira} />
                <Input label="Cédula Retira" value={formData.retiroCedula} onChange={e=>setFormData({...formData, retiroCedula: e.target.value})} disabled={mismoClienteRetira} />
                <Input label="Teléfono Retira" value={formData.retiroTelefono} onChange={e=>setFormData({...formData, retiroTelefono: e.target.value})} disabled={mismoClienteRetira} />
             </div>
          )}

          {formData.tipoDespacho === 'Delivery' && (
             <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                <Input label="Fecha Delivery" type="date" value={formData.deliveryFecha} onChange={e=>setFormData({...formData, deliveryFecha: e.target.value})} />
                <Input label="Hora" type="time" value={formData.deliveryHora} onChange={e=>setFormData({...formData, deliveryHora: e.target.value})} />
             </div>
          )}

          {((formData.tipoDespacho === 'Nacional' && formData.pagoEnvio === 'PAGADO') || formData.tipoDespacho === 'Delivery') && (
            <div className="md:col-span-2 bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800">
               <Input label="Costo del Despacho / Delivery ($)" type="number" step="0.01" value={formData.costoEnvio} onChange={e=>setFormData({...formData, costoEnvio: e.target.value})} placeholder="Se sumará a la deuda total" />
            </div>
          )}

          <div className="md:col-span-2">
            <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1.5 ml-2">Dirección Completa</label>
            <textarea value={formData.direccion} onChange={(e)=>setFormData({...formData, direccion: e.target.value})} required rows={2} className="w-full p-3.5 border-2 border-slate-100 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-900 outline-none focus:border-sky-500 font-bold text-slate-700 dark:text-slate-200"></textarea>
          </div>

          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
             <label className={`flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-xl cursor-pointer font-bold text-xs transition-colors ${formData.linkFotoProductos ? 'border-emerald-500 text-emerald-600 bg-emerald-50' : 'border-sky-300 text-sky-600 hover:bg-sky-50'}`}>
                {subiendoArchivo.foto ? <Loader2 className="animate-spin"/> : (formData.linkFotoProductos ? <CheckCircle/> : <ImageIcon/>)}
                <span className="mt-2">{formData.linkFotoProductos ? 'Foto de Productos Cargada' : 'Subir Foto de los Productos (Opcional)'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'linkFotoProductos')} disabled={subiendoArchivo.foto}/>
             </label>

             <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 p-4 rounded-xl">
                <Input label="¿Dio algún Abono Inicial Hoy? ($)" type="number" step="0.01" value={formData.abonoInicial} onChange={e=>setFormData({...formData, abonoInicial: e.target.value})} placeholder="Ej: 20.00" />
                <label className={`flex flex-col items-center justify-center p-3 mt-3 border-2 border-dashed rounded-xl cursor-pointer font-bold text-[10px] transition-colors ${formData.linkComprobante ? 'border-emerald-500 text-emerald-600 bg-emerald-50' : 'border-purple-300 text-purple-600 hover:bg-purple-50'}`}>
                   {subiendoArchivo.comprobante ? <Loader2 size={16} className="animate-spin"/> : (formData.linkComprobante ? <CheckCircle size={16}/> : <FileType size={16}/>)}
                   <span className="mt-1">{formData.linkComprobante ? 'Comprobante Cargado' : 'Subir Comprobante (Requerido si hay abono)'}</span>
                   <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => handleFileUpload(e, 'linkComprobante')} disabled={subiendoArchivo.comprobante}/>
                </label>
             </div>
          </div>

          <div className="md:col-span-2 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl border-2 border-slate-100 dark:border-slate-700 mt-2">
            <div className="flex justify-between items-center mb-4">
               <label className="font-black text-slate-800 dark:text-white flex items-center gap-2 text-sm"><Package className="text-sky-600"/> Mercancía</label>
               <button type="button" onClick={() => setIsCatalogOpen(true)} className="text-xs font-black bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-xl flex items-center gap-1 shadow-md"><Search size={14}/> Añadir Producto</button>
            </div>
            <div className="space-y-2">
               {formData.carritoObj && Object.entries(formData.carritoObj).map(([key, qty]) => (
                 <div key={key} className="flex justify-between items-center bg-white dark:bg-slate-800 p-3 rounded-xl border shadow-sm">
                    <div className="text-sm font-bold dark:text-slate-200"><span className="text-sky-600 mr-2">{qty}x</span> {key.replace('|', ' ')}</div>
                    <button type="button" onClick={() => eliminarDelCarrito(key)} className="text-red-400 hover:text-red-600"><XCircle size={18}/></button>
                 </div>
               ))}
            </div>
          </div>

          <div className="md:col-span-2 p-8 rounded-3xl shadow-inner bg-[#003366] dark:bg-slate-950 text-white grid grid-cols-1 gap-2 mt-2">
             <div className="flex justify-between items-end border-b border-slate-700 pb-2">
                <span className="text-sm text-sky-200 font-medium">Subtotal Mercancía:</span>
                <span className="text-lg font-bold">${formData.totalMercancia}</span>
             </div>
             {((formData.tipoDespacho === 'Nacional' && formData.pagoEnvio === 'PAGADO') || formData.tipoDespacho === 'Delivery') && (
                 <div className="flex justify-between items-end border-b border-slate-700 pb-2">
                    <span className="text-sm text-sky-200 font-medium">Costo de Envío:</span>
                    <span className="text-lg font-bold">+ ${(parseFloat(formData.costoEnvio)||0).toFixed(2)}</span>
                 </div>
             )}
             <div className="flex justify-between items-end mt-2">
                <span className="text-base text-white font-black uppercase">Deuda Total de Consignación:</span>
                <span className="text-3xl font-black text-emerald-400">
                    ${(parseFloat(formData.totalMercancia) + ((formData.tipoDespacho === 'Delivery' || formData.pagoEnvio === 'PAGADO') ? (parseFloat(formData.costoEnvio)||0) : 0)).toFixed(2)}
                </span>
             </div>
          </div>

          <div className="md:col-span-2 mt-4">
             <button type="submit" disabled={enviando} className="w-full text-white font-black py-5 rounded-3xl shadow-2xl flex justify-center items-center gap-3 text-lg transition-all tracking-widest uppercase bg-sky-600 hover:bg-sky-700 disabled:opacity-50">
               {enviando ? <Loader2 className="animate-spin" /> : <><CheckCircle size={24} /> Solicitar Aprobación</>}
             </button>
          </div>
        </form>
      )}

      {vista === 'historial' && (
        <div className="animate-in fade-in space-y-6">
           <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                   <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-black tracking-widest uppercase text-xs border-b border-slate-200 dark:border-slate-700">
                     <tr>
                       <th className="p-4">Cliente / Info</th>
                       <th className="p-4">Deuda Original</th>
                       <th className="p-4 text-emerald-600 dark:text-emerald-500">Abonado</th>
                       <th className="p-4 text-red-500 dark:text-red-400">Restante</th>
                       <th className="p-4 text-center">Estado</th>
                       <th className="p-4 text-center">Acciones</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                     {consignaciones.length === 0 ? (
                       <tr><td colSpan="6" className="p-10 text-center text-slate-400 font-bold italic">No hay consignaciones.</td></tr>
                     ) : consignaciones.map(c => (
                       <tr key={c.id} className={`hover:bg-white dark:hover:bg-slate-800 transition-colors ${c.estado === 'Rechazada' ? 'opacity-50' : ''}`}>
                         <td className="p-4">
                            <div className="font-bold text-slate-800 dark:text-slate-100 text-base">{c.clienteNombre}</div>
                            <div className="text-[10px] text-slate-400 mt-1">Asesora: <span className="font-bold">{c.asesora}</span></div>
                            <div className="text-[10px] text-sky-600 font-bold mt-0.5">{c.tipoDespacho} {c.courier && `(${c.courier})`}</div>
                            <div className="flex gap-2 mt-2">
                                {c.linkFotoProductos && <a href={c.linkFotoProductos} target="_blank" rel="noreferrer" className="text-[9px] bg-sky-100 text-sky-700 px-2 py-0.5 rounded border border-sky-200">Foto</a>}
                                {c.linkComprobante && <a href={c.linkComprobante} target="_blank" rel="noreferrer" className="text-[9px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">Recibo</a>}
                            </div>
                         </td>
                         <td className="p-4 font-bold text-slate-700 dark:text-slate-300">
                            ${c.totalEntregado.toFixed(2)}
                            {c.abonoInicialPendiente > 0 && <div className="text-[9px] text-emerald-600 mt-1 uppercase">Abono Inicial: ${c.abonoInicialPendiente}</div>}
                         </td>
                         <td className="p-4 font-black text-emerald-600 dark:text-emerald-500">${c.totalAbonado.toFixed(2)}</td>
                         <td className="p-4 font-black text-red-500 dark:text-red-400 text-lg">${c.saldoPendiente.toFixed(2)}</td>
                         <td className="p-4 text-center">
                            <StatusBadge status={c.estado === 'Pendiente' ? 'Pendiente' : c.estado === 'Abierta' ? 'En Proceso' : c.estado} />
                            {c.estado === 'Rechazada' && <div className="text-[9px] text-red-500 mt-1 max-w-[120px] whitespace-normal">Motivo: {c.motivoRechazo}</div>}
                         </td>
                         <td className="p-4">
                            <div className="flex flex-col gap-2 justify-center items-center">
                               {c.estado === 'Pendiente' ? (
                                   esAdmin ? (
                                     <>
                                        <button onClick={() => handleValidar(c)} disabled={enviando} className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase w-full flex items-center justify-center gap-1 shadow"><ShieldCheck size={12}/> Validar</button>
                                        <button onClick={() => handleRechazar(c)} className="bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase w-full flex items-center justify-center gap-1"><Ban size={12}/> Rechazar</button>
                                     </>
                                   ) : (
                                     <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded">Esperando Admin</span>
                                   )
                               ) : (
                                   <button disabled={c.saldoPendiente <= 0 || c.estado === 'Rechazada'} onClick={() => setModalAbonoData(c)} className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow uppercase w-full ${c.saldoPendiente > 0 && c.estado !== 'Rechazada' ? 'bg-sky-600 hover:bg-sky-700' : 'bg-slate-300 dark:bg-slate-700 opacity-50 cursor-not-allowed'}`}>Abonar</button>
                               )}
                            </div>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                </table>
              </div>
           </div>
        </div>
      )}

      <ModalCatalogo catalogo={catalogo} stock={stock} isOpen={isCatalogOpen} onClose={()=>setIsCatalogOpen(false)} dialogs={dialogs} onConfirm={(txt, obj)=>{ setFormData(prev => ({...prev, carritoObj: {...prev.carritoObj, ...obj}})); setIsCatalogOpen(false); }} />
      <ModalAbonos />
    </div>
  );
}