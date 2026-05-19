import React, { useState, useEffect } from 'react';
import { AlertTriangle, MessageSquare } from 'lucide-react';
import { setDoc, doc } from 'firebase/firestore';

export default function SubPanelStock({ lista, notas, stock, db, appId, puedeEditar, loggear, dialogs }) {
  const [localStock, setLocalStock] = useState({});
  const [notaActiva, setNotaActiva] = useState(null); 
  const [textoNota, setTextoNota] = useState('');

  // 1. Inicializamos el estado local incluyendo 'fisico'
  useEffect(() => {
    const format = {};
    lista.forEach(i => { 
      format[i.key] = { 
        envios: i.envios, 
        recepcion: i.recepcion, 
        fisico: i.fisico 
      }; 
    });
    setLocalStock(format);
  }, [stock, lista]);

  const handleStockChange = (key, almacen, value) => {
    // Permitir string vacío para que el usuario pueda borrar antes de escribir
    const num = value === '' ? '' : parseInt(value, 10) || 0;
    setLocalStock(prev => ({ ...prev, [key]: { ...prev[key], [almacen]: num } }));
  };

  const guardarStock = async (key) => {
    const current = typeof stock[key] === 'object' ? stock[key] : { envios: stock[key]||0, recepcion: 0, fisico: null };
    const next = localStock[key];
    if (!next) return;
    
    // Validamos que 'fisico' se guarde como número
    const nextFisico = next.fisico === '' ? 0 : next.fisico;

    // Comparamos si hubo algún cambio real, incluyendo el conteo físico
    if (current.envios === next.envios && current.recepcion === next.recepcion && current.fisico === nextFisico) return; 
    
    const payload = { envios: next.envios, recepcion: next.recepcion, fisico: nextFisico };

    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'stock'), { [key]: payload }, { merge: true });
    loggear('AJUSTE_INVENTARIO_MANUAL', `Ajuste en [${key}]. Envíos: ${next.envios}, Recepción: ${next.recepcion}, Físico: ${nextFisico}`);
  };

  const guardarNota = async (key) => {
    if(!textoNota.trim()) return;
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'notas'), { [key]: textoNota }, { merge: true });
    loggear('NOTA_INVENTARIO', `Nota a [${key}]: "${textoNota}"`);
    setNotaActiva(null); setTextoNota('');
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
      <table className="w-full text-left text-sm border-collapse min-w-[1000px]">
         <thead>
           <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
             <th className="p-4 border-b dark:border-slate-700 font-bold tracking-wide">Producto</th>
             <th className="p-4 border-b dark:border-slate-700 text-center border-l border-slate-100 dark:border-slate-700 bg-sky-50/50 dark:bg-sky-900/10 font-bold tracking-wide text-sky-800 dark:text-sky-400">ENVÍOS</th>
             <th className="p-4 border-b dark:border-slate-700 text-center border-l border-slate-100 dark:border-slate-700 bg-purple-50/50 dark:bg-purple-900/10 font-bold tracking-wide text-purple-800 dark:text-purple-400">RECEPCIÓN</th>
             {/* Nuevas Columnas de Cierre Físico */}
             <th className="p-4 border-b dark:border-slate-700 text-center border-l border-slate-100 dark:border-slate-700 font-bold tracking-wide text-slate-700 dark:text-slate-300">Teórico</th>
             <th className="p-4 border-b dark:border-slate-700 text-center border-l border-slate-100 dark:border-slate-700 bg-emerald-50/50 dark:bg-emerald-900/10 font-bold tracking-wide text-emerald-800 dark:text-emerald-400">C. Físico</th>
             <th className="p-4 border-b dark:border-slate-700 text-center border-l border-slate-100 dark:border-slate-700 font-bold tracking-wide">Diferencia</th>
             <th className="p-4 border-b dark:border-slate-700 border-l border-slate-100 dark:border-slate-700 font-bold tracking-wide">Notas del Auditor</th>
           </tr>
         </thead>
         <tbody>
           {lista.map(item => {
             // 2. Cálculos en tiempo real basados en los inputs actuales
             const enviosActual = localStock[item.key]?.envios ?? item.envios;
             const recepcionActual = localStock[item.key]?.recepcion ?? item.recepcion;
             const fisicoActual = localStock[item.key]?.fisico ?? item.fisico;
             
             const teoricoActual = recepcionActual - enviosActual;
             const difActual = (fisicoActual === '' ? 0 : fisicoActual) - teoricoActual;

             return (
               <tr key={item.key} className="border-b border-slate-50 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                 <td className="p-4">
                   <div className="font-bold text-slate-800 dark:text-slate-100 text-base">{item.nom}</div>
                   <div className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold px-2 py-0.5 rounded inline-block mt-1">{item.pres}</div>
                 </td>
                 
                 <td className="p-4 text-center border-l border-slate-50 dark:border-slate-700 bg-sky-50/20 dark:bg-sky-900/5">
                   {puedeEditar ? (
                     <input type="number" min="0" value={enviosActual} onChange={e=>handleStockChange(item.key, 'envios', e.target.value)} onBlur={()=>guardarStock(item.key)} className="w-20 border-2 border-slate-200 dark:border-slate-600 bg-transparent focus:border-sky-500 text-center font-bold rounded-lg p-2 outline-none transition-colors dark:text-white" />
                   ) : <span className="font-black text-lg text-sky-800 dark:text-sky-400">{enviosActual}</span>}
                 </td>
                 
                 <td className="p-4 text-center border-l border-slate-50 dark:border-slate-700 bg-purple-50/20 dark:bg-purple-900/5">
                   {puedeEditar ? (
                     <input type="number" min="0" value={recepcionActual} onChange={e=>handleStockChange(item.key, 'recepcion', e.target.value)} onBlur={()=>guardarStock(item.key)} className="w-20 border-2 border-slate-200 dark:border-slate-600 bg-transparent focus:border-purple-500 text-center font-bold rounded-lg p-2 outline-none transition-colors dark:text-white" />
                   ) : <span className="font-black text-lg text-purple-800 dark:text-purple-400">{recepcionActual}</span>}
                 </td>

                 {/* Celdas de Cierre Físico */}
                 <td className="p-4 text-center border-l border-slate-50 dark:border-slate-700">
                   <span className="font-bold text-lg text-slate-600 dark:text-slate-400">{teoricoActual}</span>
                 </td>

                 <td className="p-4 text-center border-l border-slate-50 dark:border-slate-700 bg-emerald-50/20 dark:bg-emerald-900/5">
                   {puedeEditar ? (
                     <input type="number" min="0" value={fisicoActual} onChange={e=>handleStockChange(item.key, 'fisico', e.target.value)} onBlur={()=>guardarStock(item.key)} className="w-20 border-2 border-slate-200 dark:border-slate-600 bg-transparent focus:border-emerald-500 text-center font-bold rounded-lg p-2 outline-none transition-colors dark:text-white" />
                   ) : <span className="font-black text-lg text-emerald-800 dark:text-emerald-400">{fisicoActual}</span>}
                 </td>

                 <td className="p-4 text-center border-l border-slate-50 dark:border-slate-700">
                   <span className={`font-black text-lg ${difActual < 0 ? 'text-red-500' : difActual > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                     {difActual > 0 ? `+${difActual}` : difActual}
                   </span>
                 </td>

                 <td className="p-4 border-l border-slate-50 dark:border-slate-700 min-w-[250px]">
                   {item.nota && <div className="text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400 p-3 rounded-lg border border-amber-200 dark:border-amber-800 mb-3 whitespace-pre-wrap flex items-start gap-2 shadow-sm font-medium"><AlertTriangle size={16} className="shrink-0 text-amber-500"/> {item.nota}</div>}
                   {puedeEditar && notaActiva === item.key ? (
                     <div className="flex flex-col gap-2">
                       <textarea value={textoNota} onChange={e=>setTextoNota(e.target.value)} placeholder="Escribe anomalía u observación..." className="text-sm border-2 border-slate-200 dark:border-slate-600 bg-transparent dark:text-white rounded-lg p-2 w-full outline-none focus:border-sky-500 transition-colors" rows="2" />
                       <div className="flex gap-2">
                         <button onClick={()=>guardarNota(item.key)} className="text-xs bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-lg font-bold shadow-sm transition-colors">Guardar</button>
                         <button onClick={()=>setNotaActiva(null)} className="text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white px-3 py-1.5 rounded-lg font-bold transition-colors">Cancelar</button>
                       </div>
                     </div>
                   ) : puedeEditar && !item.nota && (
                     <button onClick={()=>{setNotaActiva(item.key); setTextoNota('');}} className="text-xs text-slate-400 hover:text-amber-600 flex items-center gap-1 font-semibold transition-colors"><MessageSquare size={14}/> Agregar nota / observación</button>
                   )}
                 </td>
               </tr>
             );
           })}
         </tbody>
      </table>
    </div>
  );
}