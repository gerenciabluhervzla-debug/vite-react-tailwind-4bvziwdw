import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, FileDown, Search, Loader2, CheckCircle, SlidersHorizontal, Package, Store, TrendingUp, ArrowRightLeft, TrendingDown } from 'lucide-react';
import { setDoc, doc, getDoc } from 'firebase/firestore';

export default function SubPanelHistorial({ lista, movimientos, pedidos = [], db, appId, loggear, dialogs, puedeEditar }) {
  const getHoyISO = () => {
    const d = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Caracas"}));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const hoyISO = getHoyISO();
  const [fechaConsulta, setFechaConsulta] = useState(hoyISO);
  const [cierreActivo, setCierreActivo] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [soloCambios, setSoloCambios] = useState(false);
  const [activeTab, setActiveTab] = useState('envios');

  const metricasHoy = useMemo(() => {
    const [yyyy, mm, dd] = fechaConsulta.split('-');
    const hoyDDMMFormat = `${dd}/${mm}/${yyyy}`;
    const map = {};
    
    lista.forEach(i => {
       map[i.key] = {
         envios: { ingresos: 0, trasladosOut: 0, ventas: 0, salidas: 0 },
         recepcion: { trasladosIn: 0, ventas: 0, salidas: 0 }
       };
    });

    pedidos.forEach(p => {
       const esParaHoy = p.fechaDespacho === hoyDDMMFormat || (!p.fechaDespacho && new Date(p.fechaCreacion).toISOString().split('T')[0] === fechaConsulta);
       if (p.status !== 'Anulado' && p.status !== 'Rechazado' && esParaHoy) {
          const isRecepcion = p.tipoDespacho === 'Tienda' || p.tipoDespacho === 'Delivery';
          Object.entries(p.carritoObj || {}).forEach(([key, qty]) => { 
             if (map[key]) {
                 if (isRecepcion) map[key].recepcion.ventas += qty;
                 else map[key].envios.ventas += qty;
             }
          });
       }
    });

    movimientos?.forEach(m => {
       const isToday = m.fecha === fechaConsulta || m.fecha === hoyDDMMFormat || new Date(m.fechaCreacion || Date.now()).toISOString().split('T')[0] === fechaConsulta;
       if (isToday) {
          const type = (m.tipo || '').toUpperCase();
          const itemsObj = m.carritoObj || m.items || {};
          const origen = m.origen || 'envios';

          Object.entries(itemsObj).forEach(([key, qty]) => {
             if (map[key]) {
                if (type === 'INGRESO') {
                   map[key].envios.ingresos += qty;
                }
                if (type === 'TRANSFERENCIA' || type.includes('TRASLADO')) {
                   map[key].envios.trasladosOut += qty;
                   // CORRECCIÓN
                   if (m.status === 'COMPLETADO') {
                       map[key].recepcion.trasladosIn += qty;
                   }
                }
                if (type === 'SALIDA' && m.status === 'COMPLETADO') {
                   if (origen === 'recepcion') map[key].recepcion.salidas += qty;
                   else map[key].envios.salidas += qty;
                }
             }
          });
       }
    });
    return map;
  }, [pedidos, movimientos, lista, fechaConsulta]);

  useEffect(() => {
    if (fechaConsulta === hoyISO) return;

    let isMounted = true;
    const buscarCierre = async () => {
       setCargando(true);
       try {
          const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'cierres_inventario', fechaConsulta));
          if (isMounted) {
             if (snap.exists()) setCierreActivo(snap.data().filas);
             else setCierreActivo(null);
          }
       } catch (error) { console.error(error); }
       if (isMounted) setCargando(false);
    };
    buscarCierre();
    return () => { isMounted = false; };
  }, [fechaConsulta, hoyISO, db, appId]);

  useEffect(() => {
    if (fechaConsulta !== hoyISO || !lista.length) return;

    const timeoutId = setTimeout(async () => {
       try {
          const filas = lista.map(item => {
             const m = metricasHoy[item.key];
             const stockEnviosActual = item.envios || 0;
             const stockRecepcionActual = item.recepcion || 0;

             const inicioEnvios = stockEnviosActual + (m.envios.ventas || 0) + (m.envios.trasladosOut || 0) + (m.envios.salidas || 0) - (m.envios.ingresos || 0);
             const inicioRecepcion = stockRecepcionActual + (m.recepcion.ventas || 0) + (m.recepcion.salidas || 0) - (m.recepcion.trasladosIn || 0);

             return {
                key: item.key || 'Desconocido', 
                nom: item.nom || 'Sin Nombre', 
                pres: item.pres || 'N/A',
                envios: {
                   inicio: inicioEnvios || 0,
                   ingresos: m.envios.ingresos || 0,
                   trasladosOut: m.envios.trasladosOut || 0,
                   ventas: m.envios.ventas || 0,
                   salidas: m.envios.salidas || 0,
                   cierre: stockEnviosActual
                },
                recepcion: {
                   inicio: inicioRecepcion || 0,
                   trasladosIn: m.recepcion.trasladosIn || 0,
                   ventas: m.recepcion.ventas || 0,
                   salidas: m.recepcion.salidas || 0,
                   cierre: stockRecepcionActual
                }
             };
          });

          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'cierres_inventario', hoyISO), { filas, fechaUltimaAct: Date.now() }, { merge: true });
       } catch (error) { console.error("Error en autoguardado de cierre:", error); }
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [metricasHoy, lista, fechaConsulta, hoyISO, db, appId]);

  const dataMostrarAdaptada = useMemo(() => {
     let baseData = [];
     if (fechaConsulta === hoyISO) {
         baseData = lista.map(item => {
             const m = metricasHoy[item.key];
             return {
                key: item.key, nom: item.nom, pres: item.pres,
                envios: {
                   inicio: item.envios + m.envios.ventas + m.envios.trasladosOut + m.envios.salidas - m.envios.ingresos,
                   ingresos: m.envios.ingresos, trasladosOut: m.envios.trasladosOut, ventas: m.envios.ventas, salidas: m.envios.salidas,
                   cierre: item.envios
                },
                recepcion: {
                   inicio: item.recepcion + m.recepcion.ventas + m.recepcion.salidas - m.recepcion.trasladosIn,
                   trasladosIn: m.recepcion.trasladosIn, ventas: m.recepcion.ventas, salidas: m.recepcion.salidas,
                   cierre: item.recepcion
                }
             };
         });
     } else {
         baseData = cierreActivo || [];
     }

     return baseData.map(f => {
         if (f.envios && f.recepcion) return f; 
         return {
            key: f.key, nom: f.nom, pres: f.pres,
            envios: {
               inicio: f.inicio || 0,
               ingresos: f.ingresos || 0,
               trasladosOut: f.traslados || 0,
               ventas: f.ventas || 0,
               salidas: f.salidas || 0,
               cierre: f.stockFinal || f.cierreEnvios || 0
            },
            recepcion: {
               inicio: f.cierreRecep || 0, 
               trasladosIn: f.traslados || 0,
               ventas: 0,
               salidas: 0,
               cierre: f.cierreRecep || 0
            }
         };
     });
  }, [fechaConsulta, hoyISO, lista, metricasHoy, cierreActivo]);

  const filasFiltradas = useMemo(() => {
     if (!soloCambios) return dataMostrarAdaptada;
     return dataMostrarAdaptada.filter(f => {
         if (activeTab === 'envios') {
             return f.envios && (f.envios.ingresos > 0 || f.envios.trasladosOut > 0 || f.envios.ventas > 0 || f.envios.salidas > 0);
         } else {
             return f.recepcion && (f.recepcion.trasladosIn > 0 || f.recepcion.ventas > 0 || f.recepcion.salidas > 0);
         }
     });
  }, [dataMostrarAdaptada, soloCambios, activeTab]);

  const generarPDF = (filtrarCambios) => {
     setSoloCambios(filtrarCambios);
     setTimeout(() => { window.print(); }, 300);
  };

  return (
    <div className="animate-in fade-in space-y-6 print:m-0 print:p-0">
      <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-6 justify-between items-center print:hidden">
         <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative w-full md:w-64">
               <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
               <input type="date" value={fechaConsulta} max={hoyISO} onChange={e => setFechaConsulta(e.target.value)} className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-sm font-bold outline-none focus:border-amber-500 transition-colors" />
            </div>
            {cargando && <Loader2 className="animate-spin text-amber-500" size={24}/>}
         </div>

         <div className="flex flex-wrap gap-3 w-full md:w-auto">
            {fechaConsulta !== hoyISO && dataMostrarAdaptada.length > 0 && (
               <>
                  <button onClick={() => generarPDF(false)} className="flex-1 md:flex-none bg-slate-800 text-white hover:bg-slate-700 px-4 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors"><FileDown size={16}/> PDF Completo</button>
                  <button onClick={() => generarPDF(true)} className="flex-1 md:flex-none bg-sky-100 text-sky-700 border border-sky-200 hover:bg-sky-200 dark:bg-sky-900/30 dark:border-sky-800 dark:text-sky-300 px-4 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors"><SlidersHorizontal size={16}/> PDF (Solo Actividad)</button>
               </>
            )}
            {fechaConsulta === hoyISO && (
               <div className="w-full md:w-auto bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle size={18}/> Cierre actual auto-guardándose...
               </div>
            )}
         </div>
      </div>

      <div className="flex gap-2 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 w-full sm:w-max print:hidden">
         <button onClick={() => setActiveTab('envios')} className={`flex-1 sm:flex-none px-6 py-3 text-sm font-black rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'envios' ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
           <Package size={18} /> Historial Envíos
         </button>
         <button onClick={() => setActiveTab('recepcion')} className={`flex-1 sm:flex-none px-6 py-3 text-sm font-black rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'recepcion' ? 'bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
           <Store size={18} /> Historial Recepción
         </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden print:border-none print:shadow-none print:bg-white print:text-black">
         <div className="hidden print:block text-center mb-8 border-b-2 border-black pb-4">
            <h1 className="text-2xl font-black uppercase tracking-widest">Reporte de Cierre de Inventario</h1>
            <h2 className="text-xl font-bold uppercase mt-2">Almacén: {activeTab === 'envios' ? 'Envíos Nacionales' : 'Recepción (Tienda/Delivery)'}</h2>
            <p className="text-sm font-bold text-gray-600 mt-2">Fecha de Consulta: {fechaConsulta.split('-').reverse().join('/')}</p>
            {soloCambios && <p className="text-xs font-bold text-amber-600 mt-1">* Mostrando únicamente artículos con actividad.</p>}
         </div>

         {!cargando && dataMostrarAdaptada.length === 0 ? (
            <div className="p-16 text-center flex flex-col items-center justify-center print:hidden">
               <Search size={48} className="text-slate-300 dark:text-slate-600 mb-4"/>
               <h3 className="text-xl font-bold text-slate-500 dark:text-slate-400">No hay un cierre guardado para la fecha: {fechaConsulta.split('-').reverse().join('/')}</h3>
            </div>
         ) : (
            <div className="overflow-x-auto print:overflow-visible">
               <table className="w-full text-left text-sm border-collapse min-w-[900px] print:min-w-full">
                  <thead>
                     {activeTab === 'envios' ? (
                        <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider print:bg-gray-100 print:text-black">
                           <th className="p-4 border-b border-slate-200 dark:border-slate-700 print:border-gray-300 font-black">Producto</th>
                           <th className="p-4 border-b border-slate-200 dark:border-slate-700 print:border-gray-300 text-center font-black">Inicio Día</th>
                           <th className="p-4 border-b border-slate-200 dark:border-slate-700 print:border-gray-300 text-center font-black text-emerald-600">Ingresos (+)</th>
                           <th className="p-4 border-b border-slate-200 dark:border-slate-700 print:border-gray-300 text-center font-black text-amber-600">A Recepción (-)</th>
                           <th className="p-4 border-b border-slate-200 dark:border-slate-700 print:border-gray-300 text-center font-black text-rose-600">Ventas (-)</th>
                           <th className="p-4 border-b border-slate-200 dark:border-slate-700 print:border-gray-300 text-center font-black text-orange-600">Daños/Salidas (-)</th>
                           <th className="p-4 border-b border-slate-200 dark:border-slate-700 print:border-gray-300 text-center font-black bg-sky-50 dark:bg-sky-900/10 text-sky-800 print:bg-transparent print:text-black">Cierre Envíos</th>
                        </tr>
                     ) : (
                        <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider print:bg-gray-100 print:text-black">
                           <th className="p-4 border-b border-slate-200 dark:border-slate-700 print:border-gray-300 font-black">Producto</th>
                           <th className="p-4 border-b border-slate-200 dark:border-slate-700 print:border-gray-300 text-center font-black">Inicio Día</th>
                           <th className="p-4 border-b border-slate-200 dark:border-slate-700 print:border-gray-300 text-center font-black text-emerald-600">Desde Envíos (+)</th>
                           <th className="p-4 border-b border-slate-200 dark:border-slate-700 print:border-gray-300 text-center font-black text-fuchsia-600">Ventas (-)</th>
                           <th className="p-4 border-b border-slate-200 dark:border-slate-700 print:border-gray-300 text-center font-black text-orange-600">Daños/Salidas (-)</th>
                           <th className="p-4 border-b border-slate-200 dark:border-slate-700 print:border-gray-300 text-center font-black bg-purple-50 dark:bg-purple-900/10 text-purple-800 print:bg-transparent print:text-black">Cierre Recepción</th>
                        </tr>
                     )}
                  </thead>
                  <tbody className="print:text-xs">
                     {filasFiltradas.map((f, i) => {
                        const m = activeTab === 'envios' ? f.envios : f.recepcion;
                        if (!m) return null;

                        if (activeTab === 'envios') {
                           return (
                              <tr key={i} className="border-b border-slate-100 dark:border-slate-700/50 print:border-gray-200">
                                 <td className="p-3">
                                    <div className="font-bold text-slate-800 dark:text-slate-100 print:text-black">{f.nom}</div>
                                    <div className="text-[9px] font-black text-slate-500 print:text-gray-600 uppercase tracking-widest">{f.pres}</div>
                                 </td>
                                 <td className="p-3 text-center font-black text-slate-400 print:text-gray-500">{m.inicio}</td>
                                 <td className="p-3 text-center">{m.ingresos > 0 ? <span className="font-bold text-emerald-600 print:text-black flex items-center justify-center gap-1"><TrendingUp size={12} className="print:hidden"/> {m.ingresos}</span> : <span className="text-slate-300">-</span>}</td>
                                 <td className="p-3 text-center">{m.trasladosOut > 0 ? <span className="font-bold text-amber-600 print:text-black flex items-center justify-center gap-1"><ArrowRightLeft size={12} className="print:hidden"/> {m.trasladosOut}</span> : <span className="text-slate-300">-</span>}</td>
                                 <td className="p-3 text-center">{m.ventas > 0 ? <span className="font-bold text-rose-600 print:text-black flex items-center justify-center gap-1"><TrendingDown size={12} className="print:hidden"/> {m.ventas}</span> : <span className="text-slate-300">-</span>}</td>
                                 <td className="p-3 text-center">{m.salidas > 0 ? <span className="font-bold text-orange-600 print:text-black flex items-center justify-center gap-1"><TrendingDown size={12} className="print:hidden"/> {m.salidas}</span> : <span className="text-slate-300">-</span>}</td>
                                 <td className="p-3 text-center font-black bg-sky-50/30 dark:bg-sky-900/5 print:bg-transparent print:text-black text-sky-800 dark:text-sky-400 text-lg">{m.cierre}</td>
                              </tr>
                           );
                        }

                        return (
                           <tr key={i} className="border-b border-slate-100 dark:border-slate-700/50 print:border-gray-200">
                              <td className="p-3">
                                 <div className="font-bold text-slate-800 dark:text-slate-100 print:text-black">{f.nom}</div>
                                 <div className="text-[9px] font-black text-slate-500 print:text-gray-600 uppercase tracking-widest">{f.pres}</div>
                              </td>
                              <td className="p-3 text-center font-black text-slate-400 print:text-gray-500">{m.inicio}</td>
                              <td className="p-3 text-center">{m.trasladosIn > 0 ? <span className="font-bold text-emerald-600 print:text-black flex items-center justify-center gap-1"><ArrowRightLeft size={12} className="print:hidden"/> {m.trasladosIn}</span> : <span className="text-slate-300">-</span>}</td>
                              <td className="p-3 text-center">{m.ventas > 0 ? <span className="font-bold text-fuchsia-600 print:text-black flex items-center justify-center gap-1"><TrendingDown size={12} className="print:hidden"/> {m.ventas}</span> : <span className="text-slate-300">-</span>}</td>
                              <td className="p-3 text-center">{m.salidas > 0 ? <span className="font-bold text-orange-600 print:text-black flex items-center justify-center gap-1"><TrendingDown size={12} className="print:hidden"/> {m.salidas}</span> : <span className="text-slate-300">-</span>}</td>
                              <td className="p-3 text-center font-black bg-purple-50/30 dark:bg-purple-900/5 print:bg-transparent print:text-black text-purple-800 dark:text-purple-400 text-lg">{m.cierre}</td>
                           </tr>
                        );
                     })}
                     {filasFiltradas.length === 0 && (
                        <tr><td colSpan="7" className="p-8 text-center text-slate-400 font-bold italic">No se encontraron movimientos para aplicar en este filtro.</td></tr>
                     )}
                  </tbody>
               </table>
            </div>
         )}
      </div>
    </div>
  );
}