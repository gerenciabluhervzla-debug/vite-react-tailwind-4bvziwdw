import React, { useState } from 'react';
import { CheckSquare, Package, Gift, FileText, ShieldCheck, Eye } from 'lucide-react';
import { StatusBadge } from '../components/ui';
import { setDoc, doc, updateDoc } from 'firebase/firestore';
import { ROLES } from '../config/constants';

export default function PanelAdmin({ perfil, config, pedidos, stock, db, appId, dialogs, loggear }) {
  const [vistaAdmin, setVistaAdmin] = useState('pendientes');
  const esAuditor = [ROLES.AUDITOR_VENTAS, ROLES.AUDITOR_GENERAL].includes(perfil?.role);
  const esAdmin = [ROLES.ADMIN, ROLES.ADMINISTRACION].includes(perfil?.role);

  const pendientes = pedidos.filter(p => p.status === 'Pendiente');
  const historial = pedidos.filter(p => p.status !== 'Pendiente');

  const actualizarTasa = async () => {
    dialogs.prompt("Ingresa la nueva tasa del día en Bolívares (Bs/$):", async (nuevaTasa) => {
      const tasaNum = parseFloat(nuevaTasa);
      if (isNaN(tasaNum) || tasaNum <= 0) return dialogs.alert("Ingresa un número válido.");
      
      try {
        const hoy = new Date().toLocaleDateString('es-VE');
        const hist = config.historialTasas || [];
        const nuevoHistorial = [{ fecha: hoy, tasa: tasaNum }, ...hist].filter((v,i,a)=>a.findIndex(t=>(t.fecha === v.fecha))===i).slice(0, 15);
        
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'general'), { 
          tasaDia: tasaNum, 
          ultimaActualizacion: hoy,
          historialTasas: nuevoHistorial
        }, { merge: true });
        
        loggear('ACTUALIZACION_TASA', `Se cambió la tasa del día a: ${tasaNum} Bs/$`);
        dialogs.alert("Tasa actualizada correctamente para todo el sistema.");
      } catch(e) { dialogs.alert("Error actualizando tasa."); }
    }, "Ajustar Tasa del Día");
  };

  const validarPago = async (pedido) => {
    dialogs.prompt("¿El cliente pagó de más?\n\nSi hay dinero SOBRANTE a favor del cliente, ingrésalo en dólares ($). Deja 0 si el pago fue exacto.", async (valSobrante) => {
      let sobranteUsd = parseFloat(valSobrante) || 0;

      try {
        const stockRef = doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'stock');
        let currentStock = { ...stock };
        Object.entries(pedido.carritoObj || {}).forEach(([itemKey, qty]) => {
           let actualEnvios = typeof currentStock[itemKey] === 'object' ? currentStock[itemKey].envios : (currentStock[itemKey] || 0);
           let actualRecep = typeof currentStock[itemKey] === 'object' ? currentStock[itemKey].recepcion : 0;
           currentStock[itemKey] = { envios: Math.max(0, actualEnvios - qty), recepcion: actualRecep };
        });
        await setDoc(stockRef, currentStock);
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', pedido.id), { status: 'Validado', sobranteUsd });
        loggear('PAGO_VALIDADO', `Aprobación y descuento de stock: ${pedido.clienteNombre} ${sobranteUsd > 0 ? `(Sobrante registrado: $${sobranteUsd})` : ''}`);
      } catch(e) { console.error(e); dialogs.alert("Ocurrió un error al validar el pago.", "Error"); }
    }, "Validar Pago");
  };

  const rechazarPago = (pedido) => {
    dialogs.prompt(`Escribe el motivo de devolución a Ventas para el pedido de ${pedido.clienteNombre}:\n(Ej: Faltan dinero en la transferencia, Producto sin stock)`, async (motivo) => {
      if (!motivo) return;
      
      dialogs.prompt("¿Cuánto dinero FALTÓ en el pago?\n\nIngresa el monto faltante en dólares ($). Deja 0 si lo devuelves por otra razón que no sea dinero.", async (valFaltante) => {
        let faltanteUsd = parseFloat(valFaltante) || 0;
        try {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', pedido.id), { status: 'Rechazado', motivoRechazo: motivo, faltanteUsd });
          loggear('PAGO_RECHAZADO', `Devolución: ${pedido.clienteNombre} - ${motivo} (Faltante: $${faltanteUsd})`);
        } catch(e) { console.error(e); }
      }, "Monto Faltante");

    }, "Devolver Pedido");
  };

  const marcarAuditoria = async (id, actual) => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', id), { auditado: !actual });
      loggear('AUDITORIA_VENTA', `${!actual ? 'Aprobó' : 'Removió'} auditoría: ${id}`);
    } catch(e) { console.error(e); }
  };

  const listado = vistaAdmin === 'pendientes' ? pendientes : historial;
  const fechaHoy = new Date().toLocaleDateString('es-VE');
  const tasaActualizadaHoy = config?.ultimaActualizacion === fechaHoy;

  return (
    <div className="space-y-6">
       <div className="bg-[#003366] text-white p-8 rounded-[2rem] flex flex-col md:flex-row justify-between items-center border-4 border-sky-400/20 shadow-xl mb-8">
          <div className="text-center md:text-left mb-6 md:mb-0">
            <div className="text-xs font-black uppercase tracking-widest opacity-60 mb-1">Tasa Oficial Bluher</div>
            <h2 className="text-4xl font-black">{config?.tasaDia || 1} <span className="text-lg">Bs/$</span></h2>
            {!tasaActualizadaHoy && (
              <div className="mt-2 text-[10px] font-bold text-yellow-300 bg-yellow-900/30 px-3 py-1.5 rounded-lg border border-yellow-400 inline-block uppercase tracking-wider">
                ⚠️ Las ventas están bloqueadas. Actualiza la tasa de hoy.
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3 items-center md:items-end w-full md:w-auto">
             {esAdmin && <button onClick={actualizarTasa} className="bg-sky-500 px-8 py-3 rounded-xl font-black shadow-lg hover:bg-sky-400 transition-colors uppercase tracking-widest text-sm w-full md:w-auto">Ajustar Tasa de Hoy</button>}
             
             {config?.historialTasas && config.historialTasas.length > 0 && (
                <div className="w-full md:w-48 bg-sky-900/40 rounded-xl p-3 border border-sky-800 max-h-32 overflow-y-auto mt-2 text-xs">
                  <div className="font-bold text-sky-200 mb-2 uppercase tracking-widest text-[9px] border-b border-sky-800 pb-1">Historial Reciente</div>
                  {config.historialTasas.map((h, i) => (
                    <div key={i} className="flex justify-between items-center py-1 opacity-80 hover:opacity-100 transition-opacity">
                      <span>{h.fecha}</span>
                      <span className="font-bold">{h.tasa} Bs</span>
                    </div>
                  ))}
                </div>
             )}
          </div>
       </div>

      <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border dark:border-slate-700 transition-colors">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b border-slate-100 dark:border-slate-700 pb-4 gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3"><CheckSquare className="text-sky-600"/> Validación de Pagos</h2>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Revisión de transferencias y control de inventario.</p>
          </div>
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
            <button onClick={() => setVistaAdmin('pendientes')} className={`px-5 py-2 font-bold rounded-lg text-sm transition-all ${vistaAdmin === 'pendientes' ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Pendientes ({pendientes.length})</button>
            <button onClick={() => setVistaAdmin('historial')} className={`px-5 py-2 font-bold rounded-lg text-sm transition-all ${vistaAdmin === 'historial' ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Historial</button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
          <table className="w-full text-left border-collapse text-sm">
            <thead><tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400"><th className="p-4 border-b dark:border-slate-700 font-bold tracking-wide w-2/5">Datos del Pedido</th><th className="p-4 border-b dark:border-slate-700 font-bold tracking-wide">Información de Pago</th><th className="p-4 border-b dark:border-slate-700 font-bold tracking-wide text-right">Acción Requerida</th></tr></thead>
            <tbody>
              {listado.length === 0 ? <tr><td colSpan="3" className="p-10 text-center text-slate-400 italic font-bold">Lista limpia. Buen trabajo.</td></tr> : listado.map(p => (
                <tr key={p.id} className="border-b border-slate-50 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                   <td className="p-4 align-top">
                     <div className="font-bold text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                       {p.clienteNombre}
                       {p.esMercadoLibre && <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border border-yellow-300">ML</span>}
                     </div>
                     <div className="text-xs font-semibold text-slate-400 mt-1">Asesora: {p.asesora}</div>
                     <div className="text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 mt-3 rounded-xl shadow-sm">
                       <span className="font-bold text-sky-700 dark:text-sky-400 flex items-center gap-1.5 mb-2 uppercase tracking-wider"><Package size={14}/> Productos a descontar:</span>
                       {p.productos ? (
                          <div className="whitespace-pre-wrap leading-relaxed">{typeof p.productos === 'string' ? p.productos : JSON.stringify(p.productos)}</div>
                       ) : (
                          p.carritoObj ? Object.entries(p.carritoObj).map(([key, qty]) => <div key={key} className="flex gap-2 mb-1"><span className="font-bold text-slate-800 dark:text-slate-100">{qty}x</span> <span>{key.replace('|', ' ')}</span></div>) : 'Sin detalle.'
                       )}
                     </div>
                   </td>
                   <td className="p-4 align-top">
                     {p.esRegalo ? (
                        <div className="font-black text-purple-600 dark:text-purple-400 text-lg flex items-center gap-2 mb-2"><Gift size={20}/> REGALO VIP</div>
                     ) : (
                        <>
                          <div className="font-black text-slate-800 dark:text-slate-100 text-2xl">${(p.montoUsd||0).toFixed(2)}</div>
                          <div className="font-bold text-emerald-600 dark:text-emerald-400 text-lg mb-2">Bs. {(p.montoVes||0).toFixed(2)}</div>
                          <div className="text-xs font-semibold text-slate-500 mb-1">Tasa Aplicada: Bs. {p.tasaAplicada}</div>
                          {p.sobranteUsd > 0 && <div className="text-xs font-bold text-purple-600 dark:text-purple-400 mb-2">+ Sobrante: ${p.sobranteUsd}</div>}
                          {p.faltanteUsd > 0 && <div className="text-xs font-bold text-red-600 dark:text-red-400 mb-2">- Faltante: ${p.faltanteUsd}</div>}
                          {p.descuentoPorcentaje > 0 && <div className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded w-max my-1 border border-emerald-200 dark:border-emerald-800">Descuento aplicado: {p.descuentoPorcentaje}%</div>}
                        </>
                     )}
                     <div className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-[#f0f4f8] dark:bg-slate-800 px-3 py-1.5 rounded-lg inline-block my-3 border border-slate-200 dark:border-slate-700">Ref: {p.referencia}</div>
                     {p.linkComprobantePago && <div className="mb-3"><a href={p.linkComprobantePago} target="_blank" rel="noreferrer" className="text-xs text-sky-600 dark:text-sky-400 hover:underline font-bold flex items-center gap-1.5"><FileText size={14}/> Ver Capture Subido por Cliente</a></div>}
                     <div><StatusBadge status={p.status}/></div>
                   </td>
                   <td className="p-4 align-top text-right">
                     <div className="flex flex-col gap-2 items-end">
                       {esAdmin && p.status === 'Pendiente' && (
                         <>
                           <button onClick={()=>validarPago(p)} className="bg-sky-600 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md hover:bg-sky-700 transition-all hover:-translate-y-0.5 w-full sm:w-auto">Aprobar y Descontar</button>
                           <button onClick={()=>rechazarPago(p)} className="bg-white dark:bg-slate-800 border-2 border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 px-5 py-2.5 rounded-xl font-bold text-xs transition-colors w-full sm:w-auto">Devolver Pedido</button>
                         </>
                       )}
                       {(esAuditor || esAdmin) && p.status !== 'Pendiente' && (
                         <button onClick={()=>marcarAuditoria(p.id, p.auditado)} className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border-2 transition-all w-full sm:w-auto ${p.auditado ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                           {p.auditado ? <><ShieldCheck size={16}/> Auditoría Validada</> : <><Eye size={16}/> Marcar Revisión</>}
                         </button>
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
  );
}