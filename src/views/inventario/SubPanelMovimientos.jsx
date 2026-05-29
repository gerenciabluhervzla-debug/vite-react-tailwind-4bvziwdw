import React, { useState } from 'react';
import { PlusCircle, ArrowRightLeft, FileText, CheckCircle, AlertTriangle, Trash2, Settings2 } from 'lucide-react';
import { doc, updateDoc, deleteDoc, setDoc, increment } from 'firebase/firestore'; 
import ModalCrearMovimiento from './ModalCrearMovimiento';
import { ROLES } from '../../config/constants';

export default function SubPanelMovimientos({ movimientos, stock, db, appId, loggear, perfil, catalogo, dialogs }) {
  const [modalType, setModalType] = useState(null); 
  
  const rol = perfil?.role;
  const puedeHacerIngreso = [ROLES.ADMIN, ROLES.DESPACHO].includes(rol);
  const puedeTransferir = [ROLES.ADMIN, ROLES.DESPACHO].includes(rol);
  const puedeHacerSalida = [ROLES.ADMIN, ROLES.DESPACHO, ROLES.ADMINISTRACION].includes(rol);
  const esRecepcion = [ROLES.ADMIN, ROLES.ADMINISTRACION].includes(rol);
  const esAdmin = [ROLES.ADMIN].includes(rol);
  
  const aprobarTransferencia = async (mov) => {
    dialogs.confirm("¿Confirmas que recibiste físicamente estas cantidades exactas en el Almacén de Recepción?", async () => {
      try {
        const stockRef = doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'stock');
        const updates = {};
        
        Object.entries(mov.items).forEach(([key, qty]) => { 
           // Resta del almacén principal (Envíos) y suma al destino (Recepción) atómicamente
           updates[`${key}.envios`] = increment(-qty);
           updates[`${key}.recepcion`] = increment(qty); 
        });
        
        if(Object.keys(updates).length > 0){ 
           await updateDoc(stockRef, updates); 
        }

        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'movimientos', mov.id), { status: 'COMPLETADO', fechaAprobacion: Date.now(), aprobadoPor: perfil.nombre });
        loggear('TRANSFERENCIA_APROBADA', `Recepción aprobó entrada de transferencia enviada por ${mov.creadoPor}`);
        dialogs.alert("Transferencia completada. El stock ha sido movido a Recepción.");
      } catch(e) { console.error(e); dialogs.alert("Error al procesar la transferencia."); }
    }, "Aprobar Recepción");
  };

  const aprobarSalida = async (mov) => {
    dialogs.confirm("¿Confirmas que deseas aprobar esta SALIDA de inventario? Las cantidades se RESTARÁN permanentemente del sistema.", async () => {
      try {
        const stockRef = doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'stock');
        const updates = {};
        
        const origenStock = mov.origen ? mov.origen.toLowerCase() : 'envios';
        
        Object.entries(mov.items).forEach(([key, qty]) => { 
           updates[`${key}.${origenStock}`] = increment(-qty); 
        });
        
        if(Object.keys(updates).length > 0){ 
           await updateDoc(stockRef, updates); 
        }

        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'movimientos', mov.id), { 
            status: 'COMPLETADO', 
            fechaAprobacion: Date.now(), 
            aprobadoPor: perfil.nombre 
        });
        loggear('SALIDA_APROBADA', `Admin aprobó salida de inventario por daños/mermas registrada por ${mov.creadoPor}`);
        dialogs.alert("Salida de inventario aplicada correctamente.");
      } catch(e) { console.error(e); dialogs.alert("Error procesando la salida."); }
    }, "Aprobar Salida de Inventario");
  };

  const eliminarMovimiento = (id, tipo) => {
     dialogs.confirm(`¿ESTÁS SEGURO? Eliminarás permanentemente este historial de ${tipo}. (Las cantidades NO se devolverán al inventario, solo se borra el registro).`, async () => {
        try {
           await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'movimientos', id));
           loggear('MOVIMIENTO_ELIMINADO', `Administrador borró un registro de ${tipo}`);
           dialogs.alert("Registro de movimiento eliminado.");
        } catch(e) { console.error(e); }
     }, "Confirmar Borrado");
  };

  const mostrarAyudaAjuste = () => {
     dialogs.alert("Para iniciar el lunes con los números correctos, ve a la pestaña 'Control Stock (Hoy)'.\n\nAllí, en la última columna ('Stock Envíos' o 'Stock Recepción'), puedes hacer clic directo en el número y escribir la cantidad real física. El sistema guardará el ajuste automáticamente.", "Ajuste Rápido de Inventario");
  };

  return (
    <div className="animate-in fade-in">
      <div className="flex flex-wrap gap-4 mb-8">
        {puedeHacerIngreso && <button onClick={()=>setModalType('INGRESO')} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl shadow-md flex items-center gap-2 transition-all hover:-translate-y-0.5"><PlusCircle size={18}/> Cargar Ingreso</button>}
        {puedeTransferir && <button onClick={()=>setModalType('TRANSFERENCIA')} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-xl shadow-md flex items-center gap-2 transition-all hover:-translate-y-0.5"><ArrowRightLeft size={18}/> Enviar a Recepción</button>}
        {puedeHacerSalida && <button onClick={()=>setModalType('SALIDA')} className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl shadow-md flex items-center gap-2 transition-all hover:-translate-y-0.5"><AlertTriangle size={18}/> Registrar Salida (Daños)</button>}
        
        {esAdmin && (
           <button onClick={mostrarAyudaAjuste} className="ml-auto bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-xl shadow-md flex items-center gap-2 transition-all hover:-translate-y-0.5">
              <Settings2 size={18}/> Ajuste de Lunes
           </button>
        )}
      </div>

      <h3 className="font-black text-slate-800 dark:text-slate-100 mb-4 text-lg">Historial de Operaciones</h3>
      <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
        <table className="w-full text-left text-sm border-collapse min-w-[800px]">
          <thead><tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400"><th className="p-4 border-b dark:border-slate-700 font-bold">Fecha / Origen</th><th className="p-4 border-b dark:border-slate-700 font-bold">Tipo y Destino</th><th className="p-4 border-b dark:border-slate-700 font-bold">Productos</th><th className="p-4 border-b dark:border-slate-700 font-bold">Soporte Visual</th><th className="p-4 border-b dark:border-slate-700 font-bold text-right">Estatus</th></tr></thead>
          <tbody>
            {movimientos.length === 0 ? <tr><td colSpan="5" className="p-8 text-center text-slate-400 italic font-bold">No hay movimientos registrados.</td></tr> : movimientos.map(m => (
              <tr key={m.id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="p-4">
                  <div className="font-bold text-slate-800 dark:text-slate-100 text-base">{new Date(m.fechaCreacion).toLocaleString('es-VE')}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Por: <span className="font-semibold text-slate-700 dark:text-slate-300">{m.creadoPor}</span></div>
                </td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-md text-[10px] font-black tracking-widest uppercase border 
                    ${m.tipo === 'INGRESO' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' : 
                      m.tipo === 'SALIDA' ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' :
                      'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800'}`}>
                    {m.tipo}
                  </span>
                  
                  {m.destino && (
                     <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1">Destino: <span className="text-slate-800 dark:text-slate-200 uppercase tracking-widest">{m.destino}</span></div>
                  )}
                  {m.tipo === 'SALIDA' && (
                     <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1">Causa: <span className="text-slate-800 dark:text-slate-200">Ajuste / Daños</span></div>
                  )}
                </td>
                <td className="p-4 text-sm font-medium text-slate-700 dark:text-slate-300 bg-[#f0f4f8] dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 m-2 rounded-lg shadow-inner">
                  {Object.entries(m.items).map(([k,q]) => <div key={k} className="flex gap-2 mb-1"><span className="font-bold text-slate-800 dark:text-slate-100">{q}x</span> <span>{k.replace('|', ' ')}</span></div>)}
                </td>
                <td className="p-4">
                  {m.fotos && m.fotos.length > 0 ? (
                     <div className="flex flex-col gap-1.5">
                        {m.fotos.map((url, idx) => (
                           <a key={idx} href={url} target="_blank" rel="noreferrer" className="text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30 px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-widest flex items-center w-max gap-1.5 hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors">
                              <FileText size={12}/> Evidencia {idx + 1}
                           </a>
                        ))}
                     </div>
                  ) : m.foto ? (
                     <a href={m.foto} target="_blank" rel="noreferrer" className="text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30 px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-widest flex items-center w-max gap-1.5 hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors">
                        <FileText size={12}/> Ver Evidencia
                     </a>
                  ) : (
                     <span className="text-slate-400 text-xs italic">Sin respaldo</span>
                  )}
                </td>
                <td className="p-4 text-right">
                  {m.status === 'COMPLETADO' ? (
                    <div className="text-emerald-600 dark:text-emerald-400 font-bold flex flex-col items-end">
                       <div className="flex items-center gap-1.5"><CheckCircle size={16}/> Aprobado</div>
                       {m.aprobadoPor && <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-medium">Validado por {m.aprobadoPor}</div>}
                    </div>
                  ) : (
                    <div className="flex flex-col items-end gap-2">
                      <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 px-3 py-1 rounded-md text-xs font-bold border border-amber-200 dark:border-amber-800">En Revisión (Pendiente)</span>
                      
                      {m.tipo === 'TRANSFERENCIA' && esRecepcion && (
                         <button onClick={()=>aprobarTransferencia(m)} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-4 py-2 rounded-lg font-bold shadow-md transition-colors mt-1">Aprobar Llegada</button>
                      )}
                      {m.tipo === 'SALIDA' && esAdmin && (
                         <button onClick={()=>aprobarSalida(m)} className="bg-red-600 hover:bg-red-700 text-white text-xs px-4 py-2 rounded-lg font-bold shadow-md transition-colors mt-1">Aprobar Salida</button>
                      )}
                    </div>
                  )}
                  {esAdmin && (
                     <button onClick={()=>eliminarMovimiento(m.id, m.tipo)} className="mt-3 text-[10px] text-red-400 hover:text-red-600 uppercase font-black tracking-widest flex items-center justify-end w-full gap-1 transition-colors opacity-50 hover:opacity-100">
                        <Trash2 size={12}/> Borrar Registro
                     </button>
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