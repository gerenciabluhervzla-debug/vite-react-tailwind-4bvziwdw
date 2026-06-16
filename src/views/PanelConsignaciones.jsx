import React, { useState, useEffect, useMemo } from 'react';
import { Briefcase, ClipboardList, Package, Search, XCircle, CheckCircle, Loader2, Archive, Wallet } from 'lucide-react';
import { Input, InputDark } from '../components/ui';
import ModalCatalogo from '../components/modals/ModalCatalogo';
import { collection, onSnapshot, addDoc, doc, runTransaction } from 'firebase/firestore';

export default function PanelConsignaciones({ perfil, catalogo, stock, db, appId, loggear, dialogs }) {
  const [vista, setVista] = useState('nuevo');
  const [consignaciones, setConsignaciones] = useState([]);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [modalAbonoData, setModalAbonoData] = useState(null);

  const defaultForm = {
    clienteNombre: '',
    afectaInventario: true,
    almacenOrigen: 'envios', // 'envios' o 'recepcion'
    carritoObj: {},
    totalEntregado: '0.00'
  };

  const [formData, setFormData] = useState(defaultForm);

  // Escuchar las consignaciones en tiempo real
  useEffect(() => {
    const ref = collection(db, 'artifacts', appId, 'public', 'data', 'consignaciones');
    const unsub = onSnapshot(ref, (snap) => {
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Ordenar por fecha descendente
        data.sort((a, b) => b.fechaEmision - a.fechaEmision);
        setConsignaciones(data);
    });
    return () => unsub();
  }, [db, appId]);

  // Cálculo automático del total de la consignación según el catálogo
  useEffect(() => {
    let subTotal = 0;
    if (formData.carritoObj && Object.keys(formData.carritoObj).length > 0) {
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
    setFormData(prev => ({ ...prev, totalEntregado: subTotal.toFixed(2) }));
  }, [formData.carritoObj, catalogo]);

  const eliminarDelCarrito = (itemKey) => {
    setFormData(prev => {
      const nuevoCarrito = { ...prev.carritoObj };
      delete nuevoCarrito[itemKey];
      return { ...prev, carritoObj: nuevoCarrito };
    });
  };

  const procesarConsignacion = async (e) => {
    e.preventDefault();
    if (!formData.carritoObj || Object.keys(formData.carritoObj).length === 0) {
      return dialogs.alert("El carrito está vacío. Añade productos desde el catálogo.", "Carrito Vacío");
    }
    if (!formData.clienteNombre.trim()) {
      return dialogs.alert("Por favor ingresa el nombre del cliente.", "Falta Cliente");
    }

    setEnviando(true);
    try {
      const consignacionRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'consignaciones'));

      if (formData.afectaInventario) {
        const stockRef = doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'stock');
        const movRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'movimientos'));

        await runTransaction(db, async (transaction) => {
          const stockSnap = await transaction.get(stockRef);
          if (!stockSnap.exists()) throw new Error("El documento de inventario global no existe.");
          const stockData = stockSnap.data();

          let nuevoStock = { ...stockData };
          const tipoInv = formData.almacenOrigen; 

          // Verificar stock y descontar
          for (const [key, qty] of Object.entries(formData.carritoObj)) {
            let actual = typeof nuevoStock[key] === 'object' ? (nuevoStock[key][tipoInv] || 0) : (nuevoStock[key] || 0);
            if (actual < qty) throw new Error(`Stock insuficiente para ${key} en el almacén de ${tipoInv}.`);

            if (typeof nuevoStock[key] === 'object') {
                nuevoStock[key][tipoInv] -= qty;
            } else {
                nuevoStock[key] -= qty; // Por compatibilidad si hay items viejos que no son objetos
            }
          }

          transaction.update(stockRef, nuevoStock);

          // Registrar el movimiento de salida para que cuadre el módulo de Inventario Dual
          transaction.set(movRef, {
            tipo: 'SALIDA',
            motivo: 'Consignación',
            referencia: `Consignación entregada a ${formData.clienteNombre}`,
            items: formData.carritoObj,
            fechaCreacion: Date.now(),
            autor: perfil.nombre,
            status: 'APROBADO'
          });

          // Registrar la consignación
          transaction.set(consignacionRef, {
            ...formData,
            totalAbonado: 0,
            saldoPendiente: parseFloat(formData.totalEntregado),
            estado: 'Abierta',
            fechaEmision: Date.now(),
            creadoPor: perfil.nombre
          });
        });
      } else {
        // Guardado simple para consignaciones históricas (sin afectar inventario)
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'consignaciones'), {
            ...formData,
            totalAbonado: 0,
            saldoPendiente: parseFloat(formData.totalEntregado),
            estado: 'Abierta',
            fechaEmision: Date.now(),
            creadoPor: perfil.nombre
        });
      }

      loggear('CONSIGNACION_CREADA', `Se registró una consignación para ${formData.clienteNombre} por $${formData.totalEntregado}`);
      dialogs.alert("La consignación se ha guardado exitosamente.", "Éxito");
      setFormData(defaultForm);
      setVista('historial');
    } catch (e) {
      console.error(e);
      dialogs.alert("Error al procesar: " + e.message, "Fallo al guardar");
    }
    setEnviando(false);
  };

  // =========================================================================
  // COMPONENTE INTERNO: MODAL DE ABONOS
  // =========================================================================
  const ModalAbonos = () => {
    const [monto, setMonto] = useState('');
    const [metodo, setMetodo] = useState('Efectivo');
    const [cargandoAbono, setCargandoAbono] = useState(false);

    if (!modalAbonoData) return null;

    const handleAbonar = async (e) => {
        e.preventDefault();
        const montoNum = parseFloat(monto);
        if (montoNum <= 0) return dialogs.alert("El monto debe ser mayor a cero.");
        if (montoNum > modalAbonoData.saldoPendiente) {
            return dialogs.alert("El abono no puede superar el saldo pendiente de la deuda.", "Aviso");
        }

        setCargandoAbono(true);
        try {
            await runTransaction(db, async (t) => {
                const consRef = doc(db, 'artifacts', appId, 'public', 'data', 'consignaciones', modalAbonoData.id);
                const cajaRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'ingresos_caja'));
                
                const nuevoSaldo = modalAbonoData.saldoPendiente - montoNum;
                const nuevoAbonado = modalAbonoData.totalAbonado + montoNum;
                const nuevoEstado = nuevoSaldo <= 0 ? 'Liquidada' : 'Parcialmente Pagada';

                // 1. Actualiza el saldo en la consignación
                t.update(consRef, {
                    saldoPendiente: nuevoSaldo,
                    totalAbonado: nuevoAbonado,
                    estado: nuevoEstado
                });

                // 2. Inyecta el dinero al módulo de ingresos de la caja (Impacta Reportes)
                t.set(cajaRef, {
                    monto: montoNum,
                    metodo: metodo,
                    concepto: `Abono Consignación - ${modalAbonoData.clienteNombre}`,
                    fecha: Date.now(),
                    tipo: 'Ingreso',
                    registradoPor: perfil.nombre
                });
            });

            dialogs.alert("El abono se ha sumado a la caja exitosamente.", "Abono Confirmado");
            loggear("ABONO_CONSIGNACION", `Recibió $${montoNum} de ${modalAbonoData.clienteNombre}`);
            setModalAbonoData(null);
        } catch (error) {
            console.error(error);
            dialogs.alert("Error registrando el abono en base de datos.", "Fallo");
        }
        setCargandoAbono(false);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700 animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2"><Wallet className="text-sky-600"/> Registrar Abono</h3>
                    <button onClick={() => setModalAbonoData(null)} className="text-slate-400 hover:text-red-500 transition-colors"><XCircle size={24}/></button>
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 mb-6">
                    <div className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">Cliente Consignación</div>
                    <div className="font-black text-lg text-slate-800 dark:text-slate-100">{modalAbonoData.clienteNombre}</div>
                    <div className="mt-3 flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-700">
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
                            <option value="Pago Movil / Transferencia">Pago Móvil / Transf. (Equivalente en Bs)</option>
                            <option value="Efectivo Bs">Efectivo Bs</option>
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
      
      {/* NAVEGACIÓN DE PESTAÑAS */}
      <div className="flex flex-wrap gap-4 mb-8 border-b dark:border-slate-700 pb-2">
        <button onClick={() => setVista('nuevo')} className={`pb-3 font-black text-xs uppercase tracking-widest transition-colors ${vista === 'nuevo' ? 'text-sky-600 border-b-2 border-sky-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
            <Briefcase size={18} className="inline mr-1" /> Registrar Consignación
        </button>
        <button onClick={() => setVista('historial')} className={`pb-3 font-black text-xs uppercase tracking-widest transition-colors ${vista === 'historial' ? 'text-sky-600 border-b-2 border-sky-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
            <ClipboardList size={18} className="inline mr-1" /> Control y Cuentas por Cobrar
        </button>
      </div>

      {vista === 'nuevo' && (
        <form onSubmit={procesarConsignacion} className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
          
          {/* SWITCH DE INVENTARIO PARA RESOLVER PROBLEMA HISTÓRICO */}
          <div className="md:col-span-2 flex flex-col md:flex-row gap-4 p-5 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50">
            <div className="flex-1">
              <h4 className="font-bold text-amber-800 dark:text-amber-500 flex items-center gap-2"><Archive size={18}/> ¿Afectar Inventario Actual?</h4>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Desactiva esta opción si estás registrando una consignación antigua que <b>ya fue entregada previamente</b> y cuyo stock ya salió físicamente de tus almacenes.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
               <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={formData.afectaInventario} onChange={(e) => setFormData({...formData, afectaInventario: e.target.checked})} />
                  <div className="w-14 h-7 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500"></div>
               </label>
               <span className="font-bold text-sm text-slate-700 dark:text-slate-300">{formData.afectaInventario ? 'Sí, descontar stock' : 'No descontar'}</span>
            </div>
          </div>

          {formData.afectaInventario && (
            <div className="md:col-span-2 flex flex-col">
              <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1.5 ml-2">¿De qué almacén se descontarán los productos?</label>
              <select value={formData.almacenOrigen} onChange={(e) => setFormData({...formData, almacenOrigen: e.target.value})} className="p-3.5 border-2 border-slate-100 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-900 outline-none focus:border-sky-500 transition-all font-bold text-slate-700 dark:text-slate-200 shadow-sm cursor-pointer">
                  <option value="envios">Almacén Principal (Envíos Nacionales)</option>
                  <option value="recepcion">Almacén Tienda Fïsica (Recepción)</option>
              </select>
            </div>
          )}

          <div className="md:col-span-2">
             <Input label="Nombre del Cliente / Salón / Barbería" value={formData.clienteNombre} onChange={(e) => setFormData({...formData, clienteNombre: e.target.value})} required placeholder="Ej: Salón de Belleza VIP" />
          </div>

          {/* CARRITO IDENTICO AL DE VENTAS */}
          <div className="md:col-span-2 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl border-2 border-slate-100 dark:border-slate-700 mt-2">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
               <label className="font-black text-slate-800 dark:text-white flex items-center gap-2 uppercase tracking-tighter text-sm"><Package className="text-sky-600"/> Mercancía Entregada</label>
               <button type="button" onClick={() => setIsCatalogOpen(true)} className="text-xs font-black bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-xl flex items-center gap-1 shadow-md transition-colors"><Search size={14}/> Añadir Producto</button>
            </div>

            <div className="space-y-2">
               {formData.carritoObj && Object.entries(formData.carritoObj).map(([key, qty]) => (
                 <div key={key} className="flex justify-between items-center bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="text-sm font-bold dark:text-slate-200">
                       <span className="text-sky-600 dark:text-sky-400 mr-2">{qty}x</span> {key.replace('|', ' ')}
                    </div>
                    <button type="button" onClick={() => eliminarDelCarrito(key)} className="text-red-400 hover:text-red-600"><XCircle size={18}/></button>
                 </div>
               ))}
               {(!formData.carritoObj || Object.keys(formData.carritoObj).length === 0) && (
                 <div className="text-center p-8 text-slate-400 font-bold border-2 border-dashed dark:border-slate-700 rounded-xl">No has agregado productos a esta consignación.</div>
               )}
            </div>
          </div>

          <div className="md:col-span-2 p-8 rounded-3xl shadow-inner bg-[#003366] dark:bg-slate-950 text-white grid grid-cols-1 md:grid-cols-2 gap-6 transition-colors items-center mt-2">
             <div className="flex flex-col">
                <p className="text-sm text-sky-200 font-medium mb-1">Valor Total de la Mercancía Entregada</p>
                <p className="text-xs opacity-70">Este valor se calcula automáticamente según los precios actuales de catálogo, pero puedes modificarlo si negociaste un total distinto.</p>
             </div>
             <InputDark type="number" step="0.01" label="Total a Cobrar ($)" value={formData.totalEntregado} onChange={(e)=>setFormData({...formData, totalEntregado: e.target.value})} required />
          </div>

          <div className="md:col-span-2 mt-4">
             <button type="submit" disabled={enviando} className="w-full text-white font-black py-5 rounded-3xl shadow-2xl flex justify-center items-center gap-3 text-lg transition-all tracking-widest uppercase bg-sky-600 hover:bg-sky-700 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100">
               {enviando ? <Loader2 className="animate-spin" /> : <><CheckCircle size={24} /> Registrar Consignación</>}
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
                       <th className="p-4">Cliente / Salón</th>
                       <th className="p-4">Deuda Original</th>
                       <th className="p-4 text-emerald-600 dark:text-emerald-500">Ingresos (Abonado)</th>
                       <th className="p-4 text-red-500 dark:text-red-400">Saldo Pendiente</th>
                       <th className="p-4 text-center">Estado</th>
                       <th className="p-4 text-center">Acción</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                     {consignaciones.length === 0 ? (
                       <tr><td colSpan="6" className="p-10 text-center text-slate-400 font-bold italic">No tienes consignaciones registradas.</td></tr>
                     ) : consignaciones.map(c => (
                       <tr key={c.id} className="hover:bg-white dark:hover:bg-slate-800 transition-colors">
                         <td className="p-4">
                            <div className="font-bold text-slate-800 dark:text-slate-100 text-base">{c.clienteNombre}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{new Date(c.fechaEmision).toLocaleDateString()}</div>
                         </td>
                         <td className="p-4 font-bold text-slate-700 dark:text-slate-300">${c.totalEntregado}</td>
                         <td className="p-4 font-black text-emerald-600 dark:text-emerald-500">${c.totalAbonado.toFixed(2)}</td>
                         <td className="p-4 font-black text-red-500 dark:text-red-400 text-lg">${c.saldoPendiente.toFixed(2)}</td>
                         <td className="p-4 text-center">
                            <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${c.estado === 'Liquidada' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400' : c.estado === 'Parcialmente Pagada' ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'}`}>
                              {c.estado}
                            </span>
                         </td>
                         <td className="p-4 text-center">
                            <button 
                                disabled={c.saldoPendiente <= 0} 
                                onClick={() => setModalAbonoData(c)} 
                                className={`px-4 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm transition-all uppercase tracking-wider ${c.saldoPendiente > 0 ? 'bg-sky-600 hover:bg-sky-700 hover:scale-105' : 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed opacity-50'}`}
                            >
                                Abonar
                            </button>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                </table>
              </div>
           </div>
        </div>
      )}

      {/* MODAL CATALOGO REUTILIZADO EXACTO */}
      <ModalCatalogo
        catalogo={catalogo}
        stock={stock}
        isOpen={isCatalogOpen}
        onClose={()=>setIsCatalogOpen(false)}
        dialogs={dialogs}
        onConfirm={(txt, obj)=>{
          setFormData(prev => ({
             ...prev,
             carritoObj: { ...prev.carritoObj, ...obj }
          }));
          setIsCatalogOpen(false);
        }}
      />

      {/* RENDERIZADO DEL MODAL DE ABONOS */}
      <ModalAbonos />

    </div>
  );
}