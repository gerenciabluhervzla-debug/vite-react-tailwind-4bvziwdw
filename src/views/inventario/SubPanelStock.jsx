import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, MessageSquare, TrendingDown, TrendingUp, ArrowRightLeft } from 'lucide-react';
import { setDoc, doc } from 'firebase/firestore';

export default function SubPanelStock({ lista, notas, stock, movimientos, pedidos = [], db, appId, puedeEditar, loggear, dialogs }) {
  const [localStock, setLocalStock] = useState({});

  // Helpers para fechas
  const getHoyDDMMYYYY = () => {
    const d = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Caracas"}));
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };
  const getHoyISO = () => {
    const d = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Caracas"}));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // CÁLCULO DINÁMICO DE MÉTRICAS DEL DÍA
  const metricasDia = useMemo(() => {
    const hoyDDMM = getHoyDDMMYYYY();
    const hoyISO = getHoyISO();
    const map = {};
    lista.forEach(i => map[i.key] = { ingresos: 0, traslados: 0, ventas: 0, salidas: 0 });

    // 1. Sumar Ventas del Día
    pedidos.forEach(p => {
       const esParaHoy = p.fechaDespacho === hoyDDMM || (!p.fechaDespacho && new Date(p.fechaCreacion).toLocaleDateString('es-VE') === new Date().toLocaleDateString('es-VE'));
       
       if (p.status !== 'Anulado' && p.status !== 'Rechazado' && esParaHoy) {
          Object.entries(p.carritoObj || {}).forEach(([key, qty]) => {
             if (map[key]) map[key].ventas += qty;
          });
       }
    });

    // 2. Sumar Movimientos del Día (Ajustado a los nuevos Tipos)
    movimientos?.forEach(m => {
       const isToday = m.fecha === hoyISO || m.fecha === hoyDDMM || new Date(m.fechaCreacion || Date.now()).toLocaleDateString('es-VE') === new Date().toLocaleDateString('es-VE');
       if (isToday) {
          const type = (m.tipo || '').toUpperCase();
          const itemsObj = m.carritoObj || m.items || {};
          Object.entries(itemsObj).forEach(([key, qty]) => {
             if (map[key]) {
                if (type === 'INGRESO') map[key].ingresos += qty;
                if (type === 'TRANSFERENCIA' || type.includes('TRASLADO')) map[key].traslados += qty;
                // SOLO sumar salidas si ya fueron APROBADAS (COMPLETADO) por el Admin
                if (type === 'SALIDA' && m.status === 'COMPLETADO') map[key].salidas += qty;
             }
          });
       }
    });

    return map;
  }, [pedidos, movimientos, lista]);

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

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm animate-in fade-in">
      <div className="p-4 bg-sky-50 dark:bg-sky-900/20 border-b border-sky-100 dark:border-sky-800 text-sky-800 dark:text-sky-300 font-bold text-sm flex items-center justify-between">
         <span>Resumen Operativo de Hoy: {getHoyDDMMYYYY()}</span>
         <span className="text-xs font-semibold bg-white dark:bg-slate-800 px-3 py-1 rounded-lg shadow-sm border border-sky-200 dark:border-sky-700">Visualización Dinámica (Stock Final es de solo lectura)</span>
      </div>
      <table className="w-full text-left text-sm border-collapse min-w-[1000px]">
         <thead>
           <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider">
             <th className="p-4 border-b dark:border-slate-700 font-black">Producto</th>
             <th className="p-4 border-b dark:border-slate-700 text-center font-black text-slate-400">Inicio Día</th>
             <th className="p-4 border-b dark:border-slate-700 text-center font-black text-emerald-600 dark:text-emerald-400">Ingresos (+)</th>
             <th className="p-4 border-b dark:border-slate-700 text-center font-black text-amber-600 dark:text-amber-400">A Recepción (-)</th>
             <th className="p-4 border-b dark:border-slate-700 text-center font-black text-rose-600 dark:text-rose-400">Ventas (-)</th>
             <th className="p-4 border-b dark:border-slate-700 text-center border-l border-slate-200 dark:border-slate-600 bg-sky-100/50 dark:bg-sky-900/30 font-black text-sky-800 dark:text-sky-300">Stock Final</th>
             {/* COLUMNA MOVIDA: Relacionada directamente con Recepción */}
             <th className="p-4 border-b dark:border-slate-700 text-center font-black text-orange-600 dark:text-orange-400">Salidas/Daños (-)</th>
             <th className="p-4 border-b dark:border-slate-700 text-center bg-purple-50/50 dark:bg-purple-900/10 font-black text-purple-800 dark:text-purple-400">Cierre RECEPCIÓN</th>
           </tr>
         </thead>
         <tbody>
           {lista.map(item => {
             const m = metricasDia[item.key];
             // CORRECCIÓN MATEMÁTICA: Las salidas afectan a Recepción, NO al Stock Final de Envíos.
             const inicioEnvios = item.envios + m.ventas + m.traslados - m.ingresos;

             return (
             <tr key={item.key} className="border-b border-slate-50 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
               <td className="p-4">
                 <div className="font-bold text-slate-800 dark:text-slate-100 text-sm">{item.nom}</div>
                 <div className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-black px-2 py-0.5 rounded inline-block mt-1 uppercase tracking-widest">{item.pres}</div>
               </td>
               
               <td className="p-4 text-center font-black text-slate-400 text-lg">{inicioEnvios}</td>
               
               <td className="p-4 text-center">
                 {m.ingresos > 0 ? <span className="font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-lg text-sm flex items-center justify-center gap-1"><TrendingUp size={14}/> {m.ingresos}</span> : <span className="text-slate-300 dark:text-slate-600 font-bold">-</span>}
               </td>
               
               <td className="p-4 text-center">
                 {m.traslados > 0 ? <span className="font-black text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded-lg text-sm flex items-center justify-center gap-1"><ArrowRightLeft size={14}/> {m.traslados}</span> : <span className="text-slate-300 dark:text-slate-600 font-bold">-</span>}
               </td>

               <td className="p-4 text-center">
                 {m.ventas > 0 ? <span className="font-black text-rose-600 bg-rose-50 dark:bg-rose-900/30 px-2 py-1 rounded-lg text-sm flex items-center justify-center gap-1"><TrendingDown size={14}/> {m.ventas}</span> : <span className="text-slate-300 dark:text-slate-600 font-bold">-</span>}
               </td>

               <td className="p-4 text-center border-l border-slate-200 dark:border-slate-600 bg-sky-50/30 dark:bg-sky-900/10">
                 <span className="font-black text-xl text-sky-800 dark:text-sky-400">{item.envios}</span>
               </td>

               <td className="p-4 text-center">
                 {m.salidas > 0 ? <span className="font-black text-orange-600 bg-orange-50 dark:bg-orange-900/30 px-2 py-1 rounded-lg text-sm flex items-center justify-center gap-1"><TrendingDown size={14}/> {m.salidas}</span> : <span className="text-slate-300 dark:text-slate-600 font-bold">-</span>}
               </td>
               
               <td className="p-4 text-center bg-purple-50/20 dark:bg-purple-900/5">
                 {puedeEditar ? (
                   <input type="number" min="0" value={localStock[item.key]?.recepcion ?? item.recepcion} onChange={e=>handleStockChange(item.key, 'recepcion', e.target.value)} onBlur={()=>guardarStock(item.key)} className="w-20 border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 focus:border-purple-500 text-center font-black rounded-lg p-1.5 outline-none transition-colors dark:text-white shadow-inner" />
                 ) : <span className="font-black text-xl text-purple-800 dark:text-purple-400">{item.recepcion}</span>}
               </td>
             </tr>
           )})}
         </tbody>
      </table>
    </div>
  );
}