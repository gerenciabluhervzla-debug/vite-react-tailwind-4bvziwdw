import React, { useState, useMemo, useEffect } from 'react';
import { CheckSquare, Package, Gift, FileText, ShieldCheck, Eye, CalendarDays, Clock, AlertTriangle, CheckCircle, Percent, Power, PowerOff } from 'lucide-react';
import { StatusBadge, InputDark } from '../components/ui';
import { setDoc, doc, updateDoc } from 'firebase/firestore';
import { ROLES } from '../config/constants';

export default function PanelAdmin({ perfil, config, pedidos, stock, db, appId, dialogs, loggear }) {
  const [vistaAdmin, setVistaAdmin] = useState('pendientes');
  const esAuditor = [ROLES.AUDITORIA, ROLES.ADMIN].includes(perfil?.role);
  const esAdmin = [ROLES.ADMIN, ROLES.ADMINISTRACION].includes(perfil?.role);

  // Estados para el formulario de Descuento Global
  const [descForm, setDescForm] = useState({ porcentaje: '', inicio: '', fin: '' });

  useEffect(() => {
    if (config) {
      setDescForm({
        porcentaje: config.descuentoGlobalPorcentaje || '',
        inicio: config.descuentoGlobalInicio || '',
        fin: config.descuentoGlobalFin || ''
      });
    }
  }, [config]);

  const pendientes = pedidos.filter(p => p.status === 'Pendiente');
  const historial = pedidos.filter(p => p.status !== 'Pendiente');

  const actualizarTasa = async () => {
    dialogs.prompt("Ingresa la nueva tasa del día en Bolívares (Bs/$):", async (nuevaTasa) => {
      const tasaNum = parseFloat(nuevaTasa);
      if (isNaN(tasaNum) || tasaNum <= 0) {
        setTimeout(() => dialogs.alert("Ingresa un número válido."), 150);
        return;
      }
      
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
        setTimeout(() => dialogs.alert("Tasa actualizada correctamente para todo el sistema.", "Éxito"), 150);
      } catch(e) { 
        setTimeout(() => dialogs.alert("Error actualizando tasa.", "Error"), 150); 
      }
    }, "Ajustar Tasa del Día");
  };

  // --- LÓGICA DE CAMPAÑA DE DESCUENTOS ---
  const guardarDescuento = async (e) => {
    e.preventDefault();
    if (!descForm.porcentaje || !descForm.inicio || !descForm.fin) {
      return dialogs.alert("Debes llenar el porcentaje y ambas fechas para activar la campaña.", "Datos incompletos");
    }
    
    dialogs.confirm(`¿Estás seguro de activar un ${descForm.porcentaje}% de descuento en TODO EL SISTEMA (Ventas internas y Portal Público) desde el ${descForm.inicio} hasta el ${descForm.fin}?`, async () => {
      try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'general'), { 
          descuentoGlobalPorcentaje: parseFloat(descForm.porcentaje),
          descuentoGlobalInicio: descForm.inicio,
          descuentoGlobalFin: descForm.fin,
          descuentoGlobalActivo: true
        }, { merge: true });
        loggear('DESCUENTO_ACTIVADO', `Campaña del ${descForm.porcentaje}% iniciada.`);
        setTimeout(() => dialogs.alert("La campaña de descuento global se ha activado exitosamente.", "Campaña Activa"), 150);
      } catch(error) { console.error(error); }
    }, "Activar Campaña");
  };

  const apagarDescuento = async () => {
    dialogs.confirm("¿Deseas APAGAR INMEDIATAMENTE la campaña de descuento actual? Los precios volverán a la normalidad.", async () => {
      try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'general'), { descuentoGlobalActivo: false }, { merge: true });
        loggear('DESCUENTO_APAGADO', `Campaña de descuento detenida manualmente.`);
        setTimeout(() => dialogs.alert("La campaña ha sido apagada.", "Campaña Detenida"), 150);
      } catch(error) { console.error(error); }
    }, "Apagar Campaña");
  };

  const isGlobalDiscountActive = config?.descuentoGlobalActivo;

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
        
        setTimeout(() => dialogs.alert("El pago fue aprobado y el inventario descontado exitosamente.", "Pago Validado"), 150);
      } catch(e) { 
        console.error(e); 
        setTimeout(() => dialogs.alert("Ocurrió un error al validar el pago.", "Error"), 150); 
      }
    }, "Validar Pago");
  };

  const rechazarPago = (pedido) => {
    dialogs.prompt(`Escribe el motivo de devolución a Ventas para el pedido de ${pedido.clienteNombre}:\n(Ej: Faltan dinero en la transferencia, Producto sin stock)`, async (motivo) => {
      if (!motivo) return;
      
      setTimeout(() => {
        dialogs.prompt("¿Cuánto dinero FALTÓ en el pago?\n\nIngresa el monto faltante en dólares ($). Deja 0 si lo devuelves por otra razón que no sea dinero.", async (valFaltante) => {
          let faltanteUsd = parseFloat(valFaltante) || 0;
          try {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', pedido.id), { status: 'Rechazado', motivoRechazo: motivo, faltanteUsd });
            loggear('PAGO_RECHAZADO', `Devolución: ${pedido.clienteNombre} - ${motivo} (Faltante: $${faltanteUsd})`);
            
            setTimeout(() => dialogs.alert("El pedido ha sido devuelto a ventas para su corrección.", "Pedido Devuelto"), 150);
          } catch(e) { console.error(e); }
        }, "Monto Faltante");
      }, 150);

    }, "Devolver Pedido");
  };

  const marcarAuditoria = async (pedido) => {
    if (pedido.auditado) {
       try {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', pedido.id), { auditado: false });
          loggear('AUDITORIA_VENTA', `Removió auditoría: ${pedido.id}`);
       } catch(e) { console.error(e); }
    } else {
       setTimeout(() => {
          dialogs.prompt("Escribe una nota de auditoría (Déjalo en blanco si no hay observaciones):", async (nota) => {
             try {
                const notasExistentes = pedido.notasAuditoria || [];
                const nuevasNotas = nota ? [...notasExistentes, { fecha: Date.now(), texto: nota, autor: perfil.nombre }] : notasExistentes;
                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', pedido.id), { auditado: true, notasAuditoria: nuevasNotas });
                loggear('AUDITORIA_VENTA', `Aprobó auditoría: ${pedido.clienteNombre}`);
             } catch(e) { console.error(e); }
          }, "Validar Auditoría");
       }, 150);
    }
  };

  const diasAuditoria = useMemo(() => {
    const dias = {};
    pedidos.forEach(p => {
       const d = new Date(p.fechaCreacion).toLocaleDateString('es-VE');
       if (!dias[d]) dias[d] = { fecha: d, total: 0, auditados: 0, fallas: 0, pedidos: [] };
       dias[d].total++;
       if (p.auditado) dias[d].auditados++;
       if (p.faltanteUsd > 0 || p.sobranteUsd > 0 || p.status === 'Rechazado') dias[d].fallas++;
       dias[d].pedidos.push(p);
    });
    return Object.values(dias).sort((a,b) => b.fecha.localeCompare(a.fecha)); 
  }, [pedidos]);

  const listado = vistaAdmin === 'pendientes' ? pendientes : historial;
  const fechaHoy = new Date().toLocaleDateString('es-VE');
  const tasaActualizadaHoy = config?.ultimaActualizacion === fechaHoy;

  return (
    <div className="space-y-6 animate-in fade-in">
       
       <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
         {/* TARJETA TASA DEL DÍA */}
         <div className="bg-[#003366] text-white p-8 rounded-[2rem] flex flex-col md:flex-row justify-between items-center border-4 border-sky-400/20 shadow-xl h-full">
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
                  <div className="w-full md:w-48 bg-sky-900/40 rounded-xl p-3 border border-sky-800 max-h-24 overflow-y-auto mt-2 text-xs">
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

         {/* TARJETA CAMPAÑA DE DESCUENTOS (SOLO ADMIN) */}
         {perfil?.role === ROLES.ADMIN && (
           <div className={`p-8 rounded-[2rem] shadow-xl relative overflow-hidden h-full border-4 flex flex-col justify-center ${isGlobalDiscountActive ? 'bg-gradient-to-r from-emerald-600 to-teal-600 border-emerald-400/30 text-white' : 'bg-gradient-to-r from-pink-600 to-purple-700 border-pink-400/30 text-white'}`}>
              <Percent size={120} className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none"/>
              <div className="flex justify-between items-start mb-4 relative z-10">
                 <div>
                   <h3 className="text-xl font-black flex items-center gap-2">
                     Campaña de Descuento Global
                   </h3>
                   <p className="text-xs font-medium opacity-80 mt-1">Aplica un rebaja automática a todos los productos.</p>
                 </div>
                 {isGlobalDiscountActive && (
                   <span className="bg-emerald-800/50 text-emerald-100 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-emerald-400/30 flex items-center gap-1 animate-pulse"><Power size={12}/> Activa</span>
                 )}
              </div>

              {isGlobalDiscountActive ? (
                <div className="relative z-10 flex flex-col sm:flex-row justify-between items-center gap-4 mt-2 bg-white/10 p-5 rounded-2xl backdrop-blur-sm border border-white/20">
                   <div>
                     <div className="text-sm font-semibold opacity-90">Descuento aplicado en tienda:</div>
                     <div className="text-3xl font-black">{config?.descuentoGlobalPorcentaje}% OFF</div>
                     <div className="text-[10px] font-bold mt-1 bg-black/20 inline-block px-2 py-1 rounded uppercase tracking-wider">
                       Del {config?.descuentoGlobalInicio} al {config?.descuentoGlobalFin}
                     </div>
                   </div>
                   <button onClick={apagarDescuento} className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 shadow-lg transition-transform hover:-translate-y-0.5 w-full sm:w-auto justify-center">
                     <PowerOff size={18}/> Detener Campaña
                   </button>
                </div>
              ) : (
                <form onSubmit={guardarDescuento} className="relative z-10 grid grid-cols-3 gap-3">
                   <div className="col-span-3 sm:col-span-1 flex flex-col">
                     <label className="text-[10px] font-black uppercase opacity-70 mb-1 ml-1">Rebaja (%)</label>
                     <input type="number" min="1" max="99" required value={descForm.porcentaje} onChange={e=>setDescForm({...descForm, porcentaje: e.target.value})} className="p-2.5 rounded-xl bg-black/20 border border-white/20 outline-none focus:border-white text-white font-bold text-sm" placeholder="Ej: 15" />
                   </div>
                   <div className="col-span-3 sm:col-span-1 flex flex-col">
                     <label className="text-[10px] font-black uppercase opacity-70 mb-1 ml-1">Fecha Inicio</label>
                     <input type="date" required value={descForm.inicio} onChange={e=>setDescForm({...descForm, inicio: e.target.value})} className="p-2.5 rounded-xl bg-black/20 border border-white/20 outline-none focus:border-white text-white font-bold text-sm" />
                   </div>
                   <div className="col-span-3 sm:col-span-1 flex flex-col">
                     <label className="text-[10px] font-black uppercase opacity-70 mb-1 ml-1">Fecha Fin</label>
                     <input type="date" required value={descForm.fin} onChange={e=>setDescForm({...descForm, fin: e.target.value})} className="p-2.5 rounded-xl bg-black/20 border border-white/20 outline-none focus:border-white text-white font-bold text-sm" />
                   </div>
                   <div className="col-span-3 mt-2">
                     <button type="submit" className="w-full bg-white text-purple-700 hover:bg-slate-100 font-black py-3 rounded-xl shadow-lg transition-transform hover:-translate-y-0.5 text-sm uppercase tracking-widest">Activar Campaña en Tienda</button>
                   </div>
                </form>
              )}
           </div>
         )}
       </div>

      <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border dark:border-slate-700 transition-colors">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b border-slate-100 dark:border-slate-700 pb-4 gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3"><CheckSquare className="text-sky-600"/> Validación y Auditoría</h2>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Revisión de transferencias, control de inventario y cierre de ventas.</p>
          </div>
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl overflow-x-auto w-full md:w-auto">
            <button onClick={() => setVistaAdmin('pendientes')} className={`px-5 py-2 font-bold rounded-lg text-sm transition-all whitespace-nowrap ${vistaAdmin === 'pendientes' ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Pendientes ({pendientes.length})</button>
            <button onClick={() => setVistaAdmin('historial')} className={`px-5 py-2 font-bold rounded-lg text-sm transition-all whitespace-nowrap ${vistaAdmin === 'historial' ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Historial</button>
            {esAuditor && <button onClick={() => setVistaAdmin('auditoria')} className={`px-5 py-2 font-bold rounded-lg text-sm transition-all whitespace-nowrap ${vistaAdmin === 'auditoria' ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Diario de Auditoría</button>}
          </div>
        </div>

        {['pendientes', 'historial'].includes(vistaAdmin) && (
          <div className="rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden bg-white dark:bg-slate-800/20 animate-in fade-in">
            
            <div className="hidden lg:grid lg:grid-cols-12 gap-6 p-4 bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b dark:border-slate-700 text-sm">
              <div className="lg:col-span-5 font-bold tracking-wide">Datos del Pedido</div>
              <div className="lg:col-span-4 font-bold tracking-wide">Información de Pago</div>
              <div className="lg:col-span-3 font-bold tracking-wide text-right">Acción Requerida</div>
            </div>

            <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-700">
              {listado.length === 0 ? (
                <div className="p-10 text-center text-slate-400 italic font-bold">Lista limpia. Buen trabajo.</div>
              ) : listado.map(p => (
                <div key={p.id} className={`flex flex-col lg:grid lg:grid-cols-12 gap-4 lg:gap-6 p-4 md:p-6 transition-colors ${vistaAdmin === 'historial' && !p.auditado ? 'bg-amber-50/30 border-l-4 border-amber-300 dark:bg-amber-900/5 dark:border-amber-800' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-l-4 border-transparent'}`}>
                   
                   {/* Columna 1: Pedido */}
                   <div className="lg:col-span-5 flex flex-col justify-start">
                     <div className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                       {p.clienteNombre}
                       {p.esMercadoLibre && <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border border-yellow-300">ML</span>}
                     </div>
                     <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Asesora: <span className="text-slate-700 dark:text-slate-300">{p.asesora}</span></div>
                     
                     <div className="text-[13px] font-medium text-slate-700 dark:text-slate-300 bg-[#f0f4f8] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 mt-3 rounded-xl shadow-sm">
                       <span className="font-bold text-sky-700 dark:text-sky-400 flex items-center gap-1.5 mb-2 uppercase tracking-wider text-xs"><Package size={14}/> Productos a descontar:</span>
                       {p.productos ? (
                          <div className="whitespace-pre-wrap leading-relaxed">{typeof p.productos === 'string' ? p.productos : JSON.stringify(p.productos)}</div>
                       ) : (
                          p.carritoObj ? Object.entries(p.carritoObj).map(([key, qty]) => <div key={key} className="flex gap-2 mb-1"><span className="font-bold text-slate-800 dark:text-slate-100">{qty}x</span> <span>{key.replace('|', ' ')}</span></div>) : 'Sin detalle.'
                       )}
                     </div>
                   </div>

                   {/* Columna 2: Pagos */}
                   <div className="lg:col-span-4 flex flex-col justify-start mt-2 lg:mt-0">
                     <span className="lg:hidden text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Monto Validado:</span>
                     {p.esRegalo ? (
                        <div className="font-black text-purple-600 dark:text-purple-400 text-lg flex items-center gap-2 mb-2"><Gift size={20}/> REGALO VIP</div>
                     ) : (
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 mb-3">
                          <div className="font-black text-slate-800 dark:text-slate-100 text-2xl">${(p.montoUsd||0).toFixed(2)}</div>
                          <div className="font-bold text-emerald-600 dark:text-emerald-400 text-base mb-1">Bs. {(p.montoVes||0).toFixed(2)}</div>
                          <div className="text-[11px] font-semibold text-slate-500 mb-2">Tasa Aplicada: Bs. {p.tasaAplicada}</div>
                          
                          {p.sobranteUsd > 0 && <div className="text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded w-max">+ Sobrante: ${p.sobranteUsd}</div>}
                          {p.faltanteUsd > 0 && <div className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded w-max mt-1">- Faltante: ${p.faltanteUsd}</div>}
                          
                          {(p.descuentoPorcentaje > 0 || p.descuentoGlobalAplicado > 0) && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {p.descuentoGlobalAplicado > 0 && <span className="text-[10px] font-bold text-pink-600 bg-pink-50 dark:bg-pink-900/30 px-2 py-0.5 rounded border border-pink-200 dark:border-pink-800">Campaña: {p.descuentoGlobalAplicado}%</span>}
                              {p.descuentoPorcentaje > 0 && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">Asesor: {p.descuentoPorcentaje}%</span>}
                            </div>
                          )}
                        </div>
                     )}
                     
                     <div className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 break-all mb-2">
                       <span className="text-slate-400 mr-1 block sm:inline">Ref:</span>{p.referencia}
                     </div>
                     
                     {p.linkComprobantePago && (
                       <a href={p.linkComprobantePago} target="_blank" rel="noreferrer" className="text-xs text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/30 p-2 rounded-lg font-bold flex items-center gap-1.5 transition-colors mb-3 w-max">
                         <FileText size={16}/> Ver Capture Subido
                       </a>
                     )}

                     <div className="mb-2"><StatusBadge status={p.status}/></div>
                     
                     {p.notasAuditoria && p.notasAuditoria.length > 0 && (
                       <div className="mt-2 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                         <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 block mb-1.5">Notas de Auditoría:</span>
                         {p.notasAuditoria.map((n, i) => <div key={i} className="text-[11px] text-amber-800 dark:text-amber-300 italic mb-1 last:mb-0">"{n.texto}" - {n.autor}</div>)}
                       </div>
                     )}
                   </div>

                   {/* Columna 3: Acciones */}
                   <div className="lg:col-span-3 flex flex-col items-stretch lg:items-end justify-start mt-4 lg:mt-0 pt-4 lg:pt-0 border-t border-slate-100 dark:border-slate-700 lg:border-none w-full gap-3">
                       {esAdmin && p.status === 'Pendiente' && (
                         <div className="flex flex-col sm:flex-row lg:flex-col gap-2 w-full">
                           <button onClick={()=>validarPago(p)} className="bg-sky-600 text-white px-5 py-3 rounded-xl font-bold text-sm lg:text-xs shadow-md hover:bg-sky-700 transition-all hover:-translate-y-0.5 w-full">Aprobar y Descontar</button>
                           <button onClick={()=>rechazarPago(p)} className="bg-white dark:bg-slate-800 border-2 border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 px-5 py-3 rounded-xl font-bold text-sm lg:text-xs transition-colors w-full">Devolver Pedido</button>
                         </div>
                       )}
                       {(esAuditor || esAdmin) && p.status !== 'Pendiente' && (
                         <button onClick={()=>marcarAuditoria(p)} className={`px-5 py-3 rounded-xl font-bold text-sm lg:text-xs flex items-center justify-center gap-2 border-2 transition-all w-full lg:w-max ${p.auditado ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                           {p.auditado ? <><ShieldCheck size={16}/> Auditoría Validada</> : <><Eye size={16}/> Marcar Revisión</>}
                         </button>
                       )}
                       {vistaAdmin === 'historial' && !p.auditado && (
                         <div className="text-[10px] font-black uppercase text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-lg flex items-center justify-center gap-1 w-full lg:w-max mt-1"><AlertTriangle size={14}/> Sin Auditar</div>
                       )}
                   </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {vistaAdmin === 'auditoria' && (
          <div className="space-y-6 animate-in fade-in">
             {diasAuditoria.map(dia => (
                <div key={dia.fecha} className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                   <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                      <h3 className="font-black text-lg flex items-center gap-2"><CalendarDays className="text-sky-600"/> {dia.fecha}</h3>
                      {dia.fallas === 0 && dia.auditados === dia.total ? (
                         <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-black uppercase flex items-center gap-1"><CheckCircle size={14}/> Día Perfecto</span>
                      ) : dia.fallas > 0 ? (
                         <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-black uppercase flex items-center gap-1"><AlertTriangle size={14}/> {dia.fallas} Fallas Detectadas</span>
                      ) : (
                         <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-black uppercase flex items-center gap-1"><Clock size={14}/> Auditoría Pendiente ({dia.auditados}/{dia.total})</span>
                      )}
                   </div>
                   
                   <div className="space-y-3">
                      {dia.pedidos.filter(p => p.notasAuditoria?.length > 0 || p.faltanteUsd > 0 || p.sobranteUsd > 0 || p.status === 'Rechazado').map(p => (
                         <div key={p.id} className="text-sm bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                            <div className="font-bold flex items-center justify-between">
                              <span>{p.clienteNombre}</span>
                              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500 uppercase">{p.status}</span>
                            </div>
                            <div className="mt-2 space-y-1">
                              {p.sobranteUsd > 0 && <div className="text-xs text-purple-600 font-bold">• Sobrante reportado: ${p.sobranteUsd}</div>}
                              {p.faltanteUsd > 0 && <div className="text-xs text-red-600 font-bold">• Faltante reportado: ${p.faltanteUsd}</div>}
                              {p.notasAuditoria?.map((n, i) => (
                                 <div key={i} className="text-xs text-amber-600 mt-1 italic">- Nota ({n.autor}): "{n.texto}"</div>
                              ))}
                            </div>
                         </div>
                      ))}
                      {dia.pedidos.filter(p => p.notasAuditoria?.length > 0 || p.faltanteUsd > 0 || p.sobranteUsd > 0 || p.status === 'Rechazado').length === 0 && (
                        <div className="text-xs text-slate-500 italic">No se detectaron notas ni anomalías financieras en los pedidos de este día.</div>
                      )}
                   </div>
                </div>
             ))}
          </div>
        )}
      </div>
    </div>
  );
}