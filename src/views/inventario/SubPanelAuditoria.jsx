import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, MessageSquare, CalendarDays } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, updateDoc, doc } from 'firebase/firestore';

export default function SubPanelAuditoria({ db, appId, dialogs, loggear, perfil }) {
   const [cierres, setCierres] = useState([]);
   
   useEffect(() => {
      const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'cierres_inventario'), orderBy('timestamp', 'desc'));
      const unsub = onSnapshot(q, snap => setCierres(snap.docs.map(d => ({id: d.id, ...d.data()}))));
      return () => unsub();
   }, [db, appId]);

   const agregarNota = (cierre) => {
      setTimeout(() => {
         dialogs.prompt("Añadir nota de auditoría a este cierre:", async (nota) => {
            if(!nota) return;
            try {
               const notas = cierre.notasAuditoria || [];
               notas.push({ fecha: Date.now(), texto: nota, autor: perfil.nombre });
               await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'cierres_inventario', cierre.id), { notasAuditoria: notas });
               loggear('NOTA_AUDITORIA_INVENTARIO', `Añadió nota al cierre ${cierre.fecha}`);
               setTimeout(() => dialogs.alert("Nota añadida exitosamente.", "Auditoría"), 150);
            } catch(e) { console.error(e); }
         }, "Nota de Auditoría");
      }, 150);
   };

   return (
      <div className="space-y-6 animate-in fade-in">
         {cierres.length === 0 ? (
            <div className="py-10 text-center text-slate-400 font-bold italic border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
              No hay reportes de cierre de inventario todavía.
            </div>
         ) : cierres.map(cierre => (
            <div key={cierre.id} className={`p-6 rounded-2xl border ${cierre.anomaliasDetectadas > 0 ? 'bg-red-50/50 border-red-200 dark:bg-red-900/10 dark:border-red-900' : 'bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700'}`}>
               <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                  <div>
                     <h3 className="font-black text-lg flex items-center gap-2">
                        <CalendarDays className="text-sky-600"/> Cierre del {cierre.fecha}
                     </h3>
                     <p className="text-xs text-slate-500 font-bold uppercase mt-1">Cargado por: {cierre.creadoPor}</p>
                  </div>
                  {cierre.anomaliasDetectadas === 0 ? (
                     <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-black uppercase flex items-center gap-1"><CheckCircle size={14}/> Sin Anomalías</span>
                  ) : (
                     <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-black uppercase flex items-center gap-1"><AlertTriangle size={14}/> {cierre.anomaliasDetectadas} Anomalía(s)</span>
                  )}
               </div>

               {cierre.anomaliasDetectadas > 0 && (
                  <div className="mb-4 space-y-2 bg-white dark:bg-slate-900 p-4 rounded-xl border border-red-100 dark:border-red-900/50">
                     <div className="text-[10px] font-black uppercase text-red-600 dark:text-red-400 mb-2 tracking-widest">Detalle de Anomalías:</div>
                     {cierre.productos.filter(p => p.diferencia !== 0).map((p, i) => (
                        <div key={i} className="text-sm font-bold flex justify-between">
                           <span>{p.nombre} ({p.presentacion})</span>
                           <span className={p.diferencia > 0 ? 'text-emerald-600' : 'text-red-600'}>
                              {p.diferencia > 0 ? `+${p.diferencia} Sobrante` : `${p.diferencia} Faltante`}
                           </span>
                        </div>
                     ))}
                  </div>
               )}

               <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                  {cierre.notasAuditoria && cierre.notasAuditoria.length > 0 ? (
                     <div className="space-y-2 mb-4">
                        <div className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest">Notas del Auditor:</div>
                        {cierre.notasAuditoria.map((n, i) => (
                           <div key={i} className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg italic">
                              "{n.texto}" - <span className="font-bold">{n.autor}</span>
                           </div>
                        ))}
                     </div>
                  ) : null}
                  <button onClick={() => agregarNota(cierre)} className="text-xs font-bold text-sky-600 hover:text-sky-800 dark:text-sky-400 flex items-center gap-1.5 transition-colors">
                     <MessageSquare size={14}/> Añadir Observación al Cierre
                  </button>
               </div>
            </div>
         ))}
      </div>
   );
}