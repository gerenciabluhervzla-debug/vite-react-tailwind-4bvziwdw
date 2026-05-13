import React, { useState } from 'react';
import { PlusCircle, ArrowRightLeft, FileText, CheckCircle } from 'lucide-react';
import { setDoc, doc, updateDoc } from 'firebase/firestore';
import ModalCrearMovimiento from './ModalCrearMovimiento';

export default function SubPanelMovimientos({ movimientos, stock, db, appId, loggear, perfil, catalogo, esRecepcion, dialogs }) {
  const [modalType, setModalType] = useState(null); 
  
  const aprobarTransferencia = async (mov) => {
    dialogs.confirm("¿Confirmas que recibiste físicamente estas cantidades exactas en el Almacén de Recepción?", async () => {
      try {
        const stockRef = doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'stock');
        let currentStock = { ...stock };
        
        Object.entries(mov.items).forEach(([key, qty]) => {
           let actualEnv = typeof currentStock[key] === 'object' ? currentStock[key].envios : (currentStock[key]||0);
           let actualRec = typeof currentStock[key] === 'object' ? currentStock[key].recepcion : 0;
           currentStock[key] = { envios: actualEnv, recepcion: actualRec + qty };
        });
        await setDoc(stockRef, currentStock);
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'movimientos', mov.id), { status: 'COMPLETADO', fechaAprobacion: Date.now(), aprobadoPor: perfil.nombre });
        loggear('TRANSFERENCIA_APROBADA', `Recepción aprobó entrada de transferencia enviada por ${mov.creadoPor}`);
      } catch(e) { console.error(e); }
    }, "Aprobar Recepción");
  };

  return (
    <div>
      <div className="flex flex-wrap gap-4 mb-8">
        <button onClick={()=>setModalType('INGRESO')} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl shadow-md flex items-center gap-2 transition-all hover:-translate-y-0.5"><PlusCircle size={18}/> Cargar Ingreso (Proveedor)</button>
        <button onClick={()=>setModalType('TRANSFERENCIA')} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-xl shadow-md flex items-center gap-2 transition-all hover:-translate-y-0.5"><ArrowRightLeft size={18}/> Enviar a Recepción</button>
      </div>

      <h3 className="font-black text-slate-800 dark:text-slate-100 mb-4 text-lg">Historial de Operaciones</h3>
      <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
        <table className="w-full text-left text-sm border-collapse">
          <thead><tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400"><th className="p-4 border-b dark:border-slate-700 font-bold">Fecha / Origen</th><th className="p-4 border-b dark:border-slate-700 font-bold">Tipo y Destino</th><th className="p-4 border-b dark:border-slate-700 font-bold">Productos</th><th className="p-4 border-b dark:border-slate-700 font-bold">Soporte Visual</th><th className="p-4 border-b dark:border-slate-700 font-bold text-right">Estatus</th></tr></thead>
          <tbody>
            {movimientos.length === 0 ? <tr><td colSpan="5" className="p-8 text-center text-slate-400 italic">No hay movimientos registrados.</td></tr> : movimientos.map(m => (
              <tr key={m.id} className="border-b border-slate-50 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="p-4">
                  <div className="font-bold text-slate-800 dark:text-slate-100 text-base">{new Date(m.fechaCreacion).toLocaleString()}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Generado por: <span className="font-semibold text-slate-700 dark:text-slate-300">{m.creadoPor}</span></div>
                </td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-md text-[10px] font-black tracking-widest uppercase border ${m.tipo === 'INGRESO' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' : 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800'}`}>{m.tipo}</span>
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1">Hacia: <span className="text-slate-800 dark:text-slate-200">Almacén {m.destino}</span></div>
                </td>
                <td className="p-4 text-sm font-medium text-slate-700 dark:text-slate-300 bg-[#f0f4f8] dark:bg-slate-900 border border-slate-100 dark:border-slate-700 m-2 rounded-lg shadow-sm">
                  {Object.entries(m.items).map(([k,q]) => <div key={k} className="flex gap-2 mb-1"><span className="font-bold text-slate-800 dark:text-slate-100">{q}x</span> <span>{k.replace('|', ' ')}</span></div>)}
                </td>
                <td className="p-4">
                  {m.foto ? <a href={m.foto} target="_blank" rel="noreferrer" className="text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30 px-3 py-1.5 rounded-lg font-bold text-xs flex items-center w-max gap-1.5 hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors"><FileText size={14}/> Ver Evidencia</a> : <span className="text-slate-400 text-xs italic">Sin respaldo</span>}
                </td>
                <td className="p-4 text-right">
                  {m.status === 'COMPLETADO' ? (
                    <div className="text-emerald-600 dark:text-emerald-400 font-bold flex flex-col items-end"><div className="flex items-center gap-1.5"><CheckCircle size={16}/> Aprobado</div>{m.aprobadoPor && <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-medium">Validado por {m.aprobadoPor}</div>}</div>
                  ) : (
                    <div className="flex flex-col items-end gap-2">
                      <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 px-3 py-1 rounded-md text-xs font-bold border border-amber-200 dark:border-amber-800">En Tránsito (Pendiente)</span>
                      {esRecepcion && <button onClick={()=>aprobarTransferencia(m)} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-4 py-2 rounded-lg font-bold shadow-md transition-colors mt-1">Aprobar Llegada</button>}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalType && <ModalCrearMovimiento tipo={modalType} catalogo={catalogo} stock={stock} db={db} appId={appId} loggear={loggear} perfil={perfil} dialogs={dialogs} onClose={()=>setModalType(null)} />}
    </div>
  );
}