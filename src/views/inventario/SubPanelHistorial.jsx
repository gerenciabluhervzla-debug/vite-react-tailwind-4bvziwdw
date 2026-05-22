import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, FileDown, Search, Loader2, CheckCircle, SlidersHorizontal } from 'lucide-react';
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

  const metricasHoy = useMemo(() => {
    const hoyDDMM = `${fechaConsulta.split('-')[2]}/${fechaConsulta.split('-')[1]}/${fechaConsulta.split('-')[0]}`;
    const map = {};
    lista.forEach(i => map[i.key] = { ingresos: 0, traslados: 0, salidas: 0, ventas: 0 });

    pedidos.forEach(p => {
       const esParaHoy = p.fechaDespacho === hoyDDMM || (!p.fechaDespacho && new Date(p.fechaCreacion).toISOString().split('T')[0] === fechaConsulta);
       if (p.status !== 'Anulado' && p.status !== 'Rechazado' && esParaHoy) {
          Object.entries(p.carritoObj || {}).forEach(([key, qty]) => { if (map[key]) map[key].ventas += qty; });
       }
    });

    movimientos?.forEach(m => {
       const isToday = m.fecha === fechaConsulta || m.fecha === hoyDDMM || new Date(m.fechaCreacion || Date.now()).toISOString().split('T')[0] === fechaConsulta;
       if (isToday) {
          const type = (m.tipo || '').toUpperCase();
          const itemsObj = m.carritoObj || m.items || {};
          Object.entries(itemsObj).forEach(([key, qty]) => {
             if (map[key]) {
                if (type === 'INGRESO') map[key].ingresos += qty;
                if (type === 'TRANSFERENCIA' || type.includes('TRASLADO')) map[key].traslados += qty;
                if (type === 'SALIDA' && m.status === 'COMPLETADO') map[key].salidas += qty;
             }
          });
       }
    });
    return map;
  }, [pedidos, movimientos, lista, fechaConsulta]);

  useEffect(() => {
    const buscarCierre = async () => {
       setCargando(true);
       try {
          const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'cierres_inventario', fechaConsulta));
          if (snap.exists()) {
             setCierreActivo(snap.data().filas);
          } else {
             setCierreActivo(null);
          }
       } catch (error) {
          console.error(error);
       }
       setCargando(false);
    };
    buscarCierre();
  }, [fechaConsulta, db, appId]);

  useEffect(() => {
    if (fechaConsulta !== hoyISO || !lista.length) return;

    const timeoutId = setTimeout(async () => {
       try {
          const filas = lista.map(item => {
             const m = metricasHoy[item.key];
             return {
                key: item.key,
                nom: item.nom,
                pres: item.pres,
                // CORRECCIÓN MATEMÁTICA PARA EL AUTOGUARDADO:
                inicio: item.envios + m.ventas + m.traslados - m.ingresos,
                ingresos: m.ingresos,
                traslados: m.traslados,
                salidas: m.salidas,
                ventas: m.ventas,
                stockFinal: item.envios, 
                cierreRecep: item.recepcion
             };
          });

          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'cierres_inventario', hoyISO), { filas, fechaUltimaAct: Date.now() }, { merge: true });
          setCierreActivo(filas);
       } catch (error) {
          console.error("Error en autoguardado de cierre:", error);
       }
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [metricasHoy, lista, fechaConsulta, hoyISO, db, appId]);

  const generarPDF = (filtrarCambios) => {
     setSoloCambios(filtrarCambios);
     setTimeout(() => { window.print(); }, 300);
  };

  const dataMostrar = cierreActivo || [];
  const filasFiltradas = soloCambios ? dataMostrar.filter(f => f.ingresos > 0 || f.traslados > 0 || f.ventas > 0 || f.salidas > 0) : dataMostrar;

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
            {cierreActivo && fechaConsulta !== hoyISO && (
               <>
                  <button onClick={() => generarPDF(false)} className="flex-1 md:flex-none bg-slate-800 text-white hover:bg-slate-700 px-4 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors"><FileDown size={16}/> Reporte Completo PDF</button>
                  <button onClick={() => generarPDF(true)} className="flex-1 md:flex-none bg-sky-100 text-sky-700 border border-sky-200 hover:bg-sky-200 dark:bg-sky-900/30 dark:border-sky-800 dark:text-sky-300 px-4 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors"><SlidersHorizontal size={16}/> PDF Solo Movimientos</button>
               </>
            )}
            {fechaConsulta === hoyISO && (
               <div className="w-full md:w-auto bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle size={18}/> Inventario del día auto-guardándose
               </div>
            )}
         </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden print:border-none print:shadow-none print:bg-white print:text-black">
         <div className="hidden print:block text-center mb-8 border-b-2 border-black pb-4">
            <h1 className="text-2xl font-black uppercase tracking-widest">Reporte de Cierre de Inventario</h1>
            <p className="text-sm font-bold text-gray-600 mt-1">Fecha de Consulta: {fechaConsulta.split('-').reverse().join('/')}</p>
            {soloCambios && <p className="text-xs font-bold text-amber-600 mt-1">* Mostrando únicamente artículos con actividad.</p>}
         </div>

         {!cierreActivo && !cargando ? (
            <div className="p-16 text-center flex flex-col items-center justify-center print:hidden">
               <Search size={48} className="text-slate-300 dark:text-slate-600 mb-4"/>
               <h3 className="text-xl font-bold text-slate-500 dark:text-slate-400">No hay un cierre guardado para la fecha: {fechaConsulta}</h3>
            </div>
         ) : (
            <div className="overflow-x-auto print:overflow-visible">
               <table className="w-full text-left text-sm border-collapse min-w-[900px] print:min-w-full">
                  <thead>
                     <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider print:bg-gray-100 print:text-black">
                        <th className="p-4 border-b border-slate-200 dark:border-slate-700 print:border-gray-300 font-black">Producto</th>
                        <th className="p-4 border-b border-slate-200 dark:border-slate-700 print:border-gray-300 text-center font-black">Inicio Día</th>
                        <th className="p-4 border-b border-slate-200 dark:border-slate-700 print:border-gray-300 text-center font-black">Ingresos (+)</th>
                        <th className="p-4 border-b border-slate-200 dark:border-slate-700 print:border-gray-300 text-center font-black">A Recepción (-)</th>
                        <th className="p-4 border-b border-slate-200 dark:border-slate-700 print:border-gray-300 text-center font-black">Ventas (-)</th>
                        <th className="p-4 border-b border-slate-200 dark:border-slate-700 print:border-gray-300 text-center font-black bg-sky-50 dark:bg-sky-900/10 print:bg-transparent">Stock Final</th>
                        <th className="p-4 border-b border-slate-200 dark:border-slate-700 print:border-gray-300 text-center font-black">Salidas/Daños (-)</th>
                        <th className="p-4 border-b border-slate-200 dark:border-slate-700 print:border-gray-300 text-center font-black bg-purple-50 dark:bg-purple-900/10 print:bg-transparent">Cierre RECEP.</th>
                     </tr>
                  </thead>
                  <tbody className="print:text-xs">
                     {filasFiltradas.map((f, i) => (
                        <tr key={i} className="border-b border-slate-100 dark:border-slate-700/50 print:border-gray-200">
                           <td className="p-3">
                              <div className="font-bold text-slate-800 dark:text-slate-100 print:text-black">{f.nom}</div>
                              <div className="text-[9px] font-black text-slate-500 print:text-gray-600 uppercase tracking-widest">{f.pres}</div>
                           </td>
                           <td className="p-3 text-center font-black text-slate-400 print:text-gray-500">{f.inicio}</td>
                           <td className="p-3 text-center">{f.ingresos > 0 ? <span className="font-bold text-emerald-600 print:text-black">{f.ingresos}</span> : <span className="text-slate-300">-</span>}</td>
                           <td className="p-3 text-center">{f.traslados > 0 ? <span className="font-bold text-amber-600 print:text-black">{f.traslados}</span> : <span className="text-slate-300">-</span>}</td>
                           <td className="p-3 text-center">{f.ventas > 0 ? <span className="font-bold text-rose-600 print:text-black">{f.ventas}</span> : <span className="text-slate-300">-</span>}</td>
                           <td className="p-3 text-center font-black bg-sky-50/30 dark:bg-sky-900/5 print:bg-transparent print:text-black">{f.stockFinal ?? f.cierreEnvios}</td>
                           <td className="p-3 text-center">{f.salidas > 0 ? <span className="font-bold text-orange-600 print:text-black">{f.salidas}</span> : <span className="text-slate-300">-</span>}</td>
                           <td className="p-3 text-center font-black bg-purple-50/30 dark:bg-purple-900/5 print:bg-transparent print:text-black">{f.cierreRecep}</td>
                        </tr>
                     ))}
                     {filasFiltradas.length === 0 && (
                        <tr><td colSpan="8" className="p-8 text-center text-slate-400 font-bold italic">No se encontraron movimientos para aplicar en este filtro.</td></tr>
                     )}
                  </tbody>
               </table>
            </div>
         )}
      </div>
    </div>
  );
}