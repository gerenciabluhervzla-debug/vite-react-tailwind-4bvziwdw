import React, { useState, useMemo, useEffect } from 'react';
import { CheckSquare, Package, Gift, FileText, ShieldCheck, Eye, CalendarDays, Clock, AlertTriangle, CheckCircle, Percent, Power, PowerOff, X, UploadCloud, Loader2, ImageIcon, MessageSquare, Database, DownloadCloud, Upload, Ban, Search } from 'lucide-react';
import { StatusBadge, InputDark } from '../components/ui';
import { setDoc, doc, updateDoc, increment, deleteDoc, getDocs, getDoc, collection } from 'firebase/firestore'; 
import { URL_GOOGLE_SCRIPT } from '../config/firebase'; 
import { compressImage } from '../utils/image';
import { ROLES } from '../config/constants';

export default function PanelAdmin({ perfil, config, pedidos, stock, db, appId, dialogs, loggear }) {
  const [vistaAdmin, setVistaAdmin] = useState(perfil?.role === ROLES.AUDITORIA ? 'auditoria' : 'pendientes'); 
  const esAuditor = [ROLES.AUDITORIA, ROLES.ADMIN].includes(perfil?.role);
  const esAdmin = [ROLES.ADMIN, ROLES.ADMINISTRACION].includes(perfil?.role);
  const esAdminSupremo = perfil?.role === ROLES.ADMIN;

  const [descForm, setDescForm] = useState({ porcentaje: '', inicio: '', fin: '' });
  const [modalValidacion, setModalValidacion] = useState(null);
  const [backupLoading, setBackupLoading] = useState(false);

  // ESTADOS PARA BUSCADOR Y ANULADOS
  const [busqueda, setBusqueda] = useState('');
  const [mostrarAnulados, setMostrarAnulados] = useState(false);

  const getVeneziaDate = () => {
    const d = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Caracas"}));
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const hoyStr = getVeneziaDate();

  // NUEVA FUNCIÓN: Calcula la fecha operativa (corte a las 12:30 PM)
  const getFechaOperativaObj = (timestamp) => {
    const d = new Date(new Date(timestamp).toLocaleString("en-US", {timeZone: "America/Caracas"}));
    // Si es después de las 12:30 PM, cuenta para el día siguiente
    if (d.getHours() > 12 || (d.getHours() === 12 && d.getMinutes() >= 30)) {
      d.setDate(d.getDate() + 1);
    }
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const visual = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    return { iso, visual };
  };
  
  const [fechaInicio, setFechaInicio] = useState(hoyStr);
  const [fechaFin, setFechaFin] = useState(hoyStr);

  useEffect(() => {
    if (config) {
      setDescForm({ porcentaje: config.descuentoGlobalPorcentaje || '', inicio: config.descuentoGlobalInicio || '', fin: config.descuentoGlobalFin || '' });
    }
  }, [config]);

  // --- LÓGICA DE BACKUP DIARIO A GOOGLE DRIVE ---
  const recolectarDataBackup = async () => {
    const data = { pedidos: [], cierres_inventario: [], movimientos: [], logs: [], users: [], inventario: {}, config: {} };
    const cols = ['pedidos', 'cierres_inventario', 'movimientos', 'logs', 'users'];
    for (const c of cols) {
        const snap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', c));
        snap.forEach(d => data[c].push({ id: d.id, ...d.data() }));
    }
    const docs = ['catalogo', 'stock', 'notas'];
    for (const d of docs) {
        const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', d));
        if (snap.exists()) data.inventario[d] = snap.data();
    }
    const snapConfig = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'general'));
    if (snapConfig.exists()) data.config = snapConfig.data();
    return data;
  };

  const triggerBackup = async (isAuto = false) => {
    if(!URL_GOOGLE_SCRIPT) return;
    if(!isAuto) setBackupLoading(true);
    try {
        const payload = await recolectarDataBackup();
        const jsonStr = JSON.stringify(payload);
        const fileBlob = new Blob([jsonStr], { type: 'application/json' });
        const reader = new FileReader();
        reader.readAsDataURL(fileBlob);
        reader.onloadend = async () => {
            const base64data = reader.result.split(',')[1];
            await fetch(URL_GOOGLE_SCRIPT, {
                method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ 
                   tokenSecreto: "BLUHER_SECURE_TOKEN_2026",
                   fileName: `Backup_Bluher_${hoyStr.replace(/\//g,'-')}.json`, 
                   mimeType: 'application/json', data: base64data 
                })
            });
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'general'), { ultimaFechaBackup: hoyStr }, { merge: true });
            
            if(isAuto) { loggear('BACKUP_AUTO', 'Respaldo automático del día guardado en Drive.'); } 
            else {
                loggear('BACKUP_MANUAL', 'El administrador generó un respaldo manual.');
                dialogs.alert("El respaldo del sistema ha sido comprimido y enviado a tu Google Drive exitosamente.", "Backup Completado");
            }
            if(!isAuto) setBackupLoading(false);
        };
    } catch(e) { 
        console.error(e); 
        if(!isAuto) { dialogs.alert("Ocurrió un error al generar el respaldo.", "Error"); setBackupLoading(false); }
    }
  };

  useEffect(() => {
    if (esAdminSupremo && config && config.ultimaFechaBackup !== hoyStr && !backupLoading) {
        triggerBackup(true); 
    }
  }, [esAdminSupremo, config?.ultimaFechaBackup, hoyStr]);

  const handleRestaurarBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    dialogs.prompt("⚠️ ADVERTENCIA CRÍTICA:\nEstás a punto de sobrescribir toda la base de datos actual con este archivo de respaldo. Se borrará la información reciente.\n\nEscribe la palabra 'RESTAURAR' para confirmar:", async (textoConfirmacion) => {
        if (textoConfirmacion !== 'RESTAURAR') {
            dialogs.alert("Palabra de seguridad incorrecta. Operación cancelada por seguridad.");
            return;
        }

        setBackupLoading(true);
        try {
            const reader = new FileReader();
            reader.onload = async (event) => {
               try {
                   const data = JSON.parse(event.target.result);
                   const colecciones = ['pedidos', 'cierres_inventario', 'movimientos', 'logs', 'users'];
                   for (const col of colecciones) {
                       if (data[col]) {
                           for (const docData of data[col]) {
                               const { id, ...resto } = docData;
                               await setDoc(doc(db, 'artifacts', appId, 'public', 'data', col, id), resto);
                           }
                       }
                   }
                   if (data.inventario) {
                       if (data.inventario.catalogo) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'catalogo'), data.inventario.catalogo);
                       if (data.inventario.stock) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'stock'), data.inventario.stock);
                       if (data.inventario.notas) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'notas'), data.inventario.notas);
                   }
                   if (data.config) { await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'general'), data.config); }

                   loggear('BACKUP_RESTAURADO', 'Se ejecutó una restauración de base de datos desde un archivo local.');
                   dialogs.alert("Restauración completada con éxito. Por favor recarga la página para ver los cambios.", "Éxito");
               } catch (err) {
                   console.error(err);
                   dialogs.alert("El archivo seleccionado no es válido o está corrupto.", "Error");
               } finally { setBackupLoading(false); }
            };
            reader.readAsText(file);
        } catch (err) { setBackupLoading(false); dialogs.alert("Error leyendo el archivo."); }
    }, "Confirmación Requerida");
    
    e.target.value = '';
  };

  // --- ORDENAMIENTO DE PENDIENTES (ASCENDENTE PARA PRIORIDAD POR ENTRADA) ---
  const pendientesOrdenados = useMemo(() => {
    return pedidos
      .filter(p => p.status === 'Pendiente')
      .sort((a, b) => a.fechaCreacion - b.fechaCreacion); 
  }, [pedidos]);
  
  // --- FILTRADO DEL HISTORIAL CON FECHA OPERATIVA ---
  const historialFiltrado = useMemo(() => {
    let todosHistorial = pedidos.filter(p => p.status !== 'Pendiente');
    
    if (!mostrarAnulados) {
      todosHistorial = todosHistorial.filter(p => p.status !== 'Anulado');
    }

    if (fechaInicio && fechaFin) {
      // Evaluamos la fecha operativa para que coincida con el corte de las 12:30 PM
      todosHistorial = todosHistorial.filter(p => {
         const opIso = getFechaOperativaObj(p.fechaCreacion).iso;
         return opIso >= fechaInicio && opIso <= fechaFin;
      });
    }
    
    return todosHistorial.sort((a, b) => b.fechaCreacion - a.fechaCreacion);
  }, [pedidos, fechaInicio, fechaFin, mostrarAnulados]);

  // --- APLICAR BUSCADOR GLOBAL ---
  const listado = useMemo(() => {
    const base = vistaAdmin === 'pendientes' ? pendientesOrdenados : historialFiltrado;
    if (!busqueda.trim()) return base;
    
    const busquedaMinuscula = busqueda.toLowerCase();
    return base.filter(p => p.clienteNombre?.toLowerCase().includes(busquedaMinuscula));
  }, [vistaAdmin, pendientesOrdenados, historialFiltrado, busqueda]);

  const actualizarTasa = async () => {
    dialogs.prompt("Ingresa la nueva tasa del día en Bolívares (Bs/$):", async (nuevaTasa) => {
      const tasaSanitizada = nuevaTasa.replace(',', '.');
      const tasaNum = parseFloat(tasaSanitizada);
      if (isNaN(tasaNum) || tasaNum <= 0) { setTimeout(() => dialogs.alert("Ingresa un número válido."), 150); return; }
      try {
        const hoy = new Date().toLocaleDateString('es-VE');
        const hist = config.historialTasas || [];
        const nuevoHistorial = [{ fecha: hoy, tasa: tasaNum }, ...hist].filter((v,i,a)=>a.findIndex(t=>(t.fecha === v.fecha))===i).slice(0, 15);
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'general'), { tasaDia: tasaNum, ultimaActualizacion: hoy, historialTasas: nuevoHistorial }, { merge: true });
        loggear('ACTUALIZACION_TASA', `Se cambió la tasa del día a: ${tasaNum} Bs/$`);
        setTimeout(() => dialogs.alert(`Tasa actualizada correctamente a ${tasaNum} Bs/$.`, "Éxito"), 150);
      } catch(e) { setTimeout(() => dialogs.alert("Error actualizando tasa.", "Error"), 150); }
    }, "Ajustar Tasa del Día");
  };

  const guardarDescuento = async (e) => {
    e.preventDefault();
    if (!descForm.porcentaje || !descForm.inicio || !descForm.fin) return dialogs.alert("Debes llenar el porcentaje y ambas fechas para activar la campaña.", "Datos incompletos");
    dialogs.confirm(`¿Estás seguro de activar un ${descForm.porcentaje}% de descuento en TODO EL SISTEMA desde el ${descForm.inicio} hasta el ${descForm.fin}?`, async () => {
      try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'general'), { descuentoGlobalPorcentaje: parseFloat(descForm.porcentaje), descuentoGlobalInicio: descForm.inicio, descuentoGlobalFin: descForm.fin, descuentoGlobalActivo: true }, { merge: true });
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

  const abrirModalValidacion = (pedido) => setModalValidacion({ pedido: pedido, sobrante: '', file: null, previewUrl: '', subiendo: false });

  const handlePasteComprobante = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        setModalValidacion(prev => ({ ...prev, file: blob, previewUrl: URL.createObjectURL(blob) }));
        break;
      }
    }
  };

  const procesarValidacionDefinitiva = async () => {
    if (!modalValidacion) return;
    const { pedido, sobrante, file } = modalValidacion;
    setModalValidacion(prev => ({ ...prev, subiendo: true }));
    try {
      let urlComprobanteAdmin = '';
      if (file && URL_GOOGLE_SCRIPT) {
        const base64Data = await compressImage(file, 800, 0.7);
        const response = await fetch(URL_GOOGLE_SCRIPT, {
          method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ tokenSecreto: "BLUHER_SECURE_TOKEN_2026", fileName: `ExtractoAdmin_${Date.now()}.jpg`, mimeType: 'image/jpeg', data: base64Data })
        });
        const result = await response.json();
        if (result.url) urlComprobanteAdmin = result.url;
      }

      const stockRef = doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'stock');
      const updates = {};
      Object.entries(pedido.carritoObj || {}).forEach(([itemKey, qty]) => { updates[itemKey] = { envios: increment(-qty) }; });
      if (Object.keys(updates).length > 0) { await setDoc(stockRef, updates, { merge: true }); }

      const sobranteUsd = parseFloat(sobrante.replace(',', '.')) || 0;
      const payloadPedido = { status: 'Validado', sobranteUsd };
      if (urlComprobanteAdmin) payloadPedido.linkComprobanteAdmin = urlComprobanteAdmin;

      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', pedido.id), payloadPedido);
      loggear('PAGO_VALIDADO', `Aprobación y descuento de stock: ${pedido.clienteNombre}`);
      dialogs.alert("El pago fue aprobado, el extracto guardado y el inventario descontado exitosamente.", "Pago Validado");
      setModalValidacion(null);
    } catch(e) { console.error(e); dialogs.alert("Ocurrió un error al validar el pago o subir el archivo.", "Error"); setModalValidacion(prev => ({ ...prev, subiendo: false })); }
  };

  const rechazarPago = (pedido) => {
    dialogs.prompt(`Escribe el motivo de devolución a Ventas:\n(Ej: Falta dinero, Capture falso, Sin stock)`, async (motivo) => {
      if (!motivo) return;
      setTimeout(() => {
        dialogs.prompt("¿Cuánto dinero FALTÓ en el pago?\n\nIngresa el monto en dólares ($). Deja 0 si devuelves por otra razón.", async (valFaltante) => {
          let faltanteUsd = parseFloat(valFaltante.replace(',', '.')) || 0;
          try {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', pedido.id), { status: 'Rechazado', motivoRechazo: motivo, faltanteUsd });
            loggear('PAGO_RECHAZADO', `Devolución: ${pedido.clienteNombre} (Faltante: $${faltanteUsd})`);
            setTimeout(() => dialogs.alert("El pedido ha sido devuelto a ventas.", "Pedido Devuelto"), 150);
          } catch(e) { console.error(e); }
        }, "Monto Faltante");
      }, 150);
    }, "Devolver Pedido");
  };

  const anularPedido = (pedido) => {
    dialogs.prompt(`Estás a punto de ANULAR el pedido de ${pedido.clienteNombre}.\n\nEsta operación mantendrá el registro pero lo excluirá de los reportes financieros.\n\nEscribe el motivo de la anulación (Obligatorio):`, async (motivo) => {
      if (!motivo) return;
      try {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', pedido.id), { 
           status: 'Anulado', 
           motivoAnulacion: motivo,
           anuladoPor: perfil.nombre,
           fechaAnulacion: Date.now(),
           montoUsd: 0, montoVes: 0, 
           notasAuditoria: [...(pedido.notasAuditoria || []), { fecha: Date.now(), texto: `ORDEN ANULADA: ${motivo}`, autor: 'SISTEMA' }]
        });
        loggear('PEDIDO_ANULADO', `Administrador anuló el pedido de ${pedido.clienteNombre} por: ${motivo}`);
        dialogs.alert("Pedido anulado exitosamente.", "Completado");
      } catch (e) { console.error(e); dialogs.alert("Error anulando pedido."); }
    }, "Confirmar Anulación");
  };

  const revisionRapida = async (p) => {
    if (!esAuditor) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', p.id), { auditado: true });
      loggear('AUDITORIA_RAPIDA', `Revisión rápida aprobada para ${p.clienteNombre}`);
    } catch (e) { console.error(e); }
  };

  const marcarAuditoriaConNota = async (pedido) => {
    if (!esAuditor) return;
    dialogs.prompt("Escribe un comentario o nota de auditoría para este pedido:", async (nota) => {
       if(!nota) return;
       try {
          const notasExistentes = pedido.notasAuditoria || [];
          const nuevasNotas = [...notasExistentes, { fecha: Date.now(), texto: nota, autor: perfil.nombre }];
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', pedido.id), { auditado: true, notasAuditoria: nuevasNotas });
          loggear('AUDITORIA_NOTA', `Añadió comentario a: ${pedido.clienteNombre}`);
       } catch(e) { console.error(e); }
    }, "Nuevo Comentario");
  };

  // --- AGRUPACIÓN DE AUDITORÍA CON FECHA OPERATIVA ---
  const diasAuditoria = useMemo(() => {
    const dias = {};
    pedidos.forEach(p => {
       // Usamos la fecha operativa calculada
       const { iso, visual } = getFechaOperativaObj(p.fechaCreacion);
       if (!dias[iso]) dias[iso] = { isoKey: iso, fecha: visual, total: 0, auditados: 0, fallas: 0, pedidos: [] };
       dias[iso].total++;
       if (p.auditado) dias[iso].auditados++;
       if (p.faltanteUsd > 0 || p.sobranteUsd > 0 || p.status === 'Rechazado' || p.status === 'Anulado') dias[iso].fallas++;
       dias[iso].pedidos.push(p);
    });
    // Ordenamos descendente por el ISO para que los días más recientes queden arriba
    return Object.values(dias).sort((a,b) => b.isoKey.localeCompare(a.isoKey)); 
  }, [pedidos]);

  const fechaHoy = new Date().toLocaleDateString('es-VE');
  const tasaActualizadaHoy = config?.ultimaActualizacion === fechaHoy;
  const isGlobalDiscountActiveStatus = config?.descuentoGlobalActivo;

  return (
    <div className="space-y-6 animate-in fade-in relative">
       
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-[#003366] text-white p-6 rounded-[2rem] border-4 border-sky-400/20 shadow-xl flex flex-col relative overflow-hidden h-full">
             <div className="relative z-10 mb-4">
                <div className="text-xs font-black uppercase tracking-widest opacity-60 mb-1">Tasa Bluher</div>
                <h2 className="text-4xl font-black">{config?.tasaDia || 1} <span className="text-lg">Bs/$</span></h2>
                {!tasaActualizadaHoy && <div className="mt-2 text-[10px] font-bold text-yellow-300 bg-yellow-900/30 px-3 py-1.5 rounded-lg border border-yellow-400 inline-block uppercase tracking-wider">⚠️ Actualiza la tasa de hoy.</div>}
             </div>
             {esAdmin && <button onClick={actualizarTasa} className="mt-auto bg-sky-500 hover:bg-sky-400 px-6 py-3 rounded-xl font-bold text-sm shadow-md transition-colors w-full relative z-10">Ajustar Tasa</button>}
          </div>

          {esAdminSupremo && (
            <div className={`p-6 rounded-[2rem] shadow-xl relative overflow-hidden border-4 flex flex-col h-full ${isGlobalDiscountActiveStatus ? 'bg-gradient-to-r from-emerald-600 to-teal-600 border-emerald-400/30 text-white' : 'bg-gradient-to-r from-pink-600 to-purple-700 border-pink-400/30 text-white'}`}>
              <Percent size={120} className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none"/>
              <div className="flex justify-between items-start mb-4 relative z-10">
                 <div>
                   <h3 className="text-xl font-black flex items-center gap-2">Campaña Global</h3>
                   <p className="text-xs font-medium opacity-80 mt-1">Rebaja en toda la tienda.</p>
                 </div>
                 {isGlobalDiscountActiveStatus && (
                   <span className="bg-emerald-800/50 text-emerald-100 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-emerald-400/30 flex items-center gap-1 animate-pulse"><Power size={12}/> Activa</span>
                 )}
              </div>

              <div className="relative z-10 mt-auto">
                {isGlobalDiscountActiveStatus ? (
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white/10 p-5 rounded-2xl backdrop-blur-sm border border-white/20">
                     <div>
                       <div className="text-3xl font-black">{config?.descuentoGlobalPorcentaje}% OFF</div>
                       <div className="text-[10px] font-bold mt-1 bg-black/20 inline-block px-2 py-1 rounded uppercase tracking-wider">Hasta {config?.descuentoGlobalFin}</div>
                     </div>
                     <button onClick={apagarDescuento} className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 shadow-lg transition-transform hover:-translate-y-0.5 w-full sm:w-auto justify-center"><PowerOff size={18}/> Detener</button>
                  </div>
                ) : (
                  <form onSubmit={guardarDescuento} className="grid grid-cols-2 gap-3">
                     <div className="col-span-2 flex flex-col"><label className="text-[10px] font-black uppercase opacity-70 mb-1 ml-1">Rebaja (%)</label><input type="number" min="1" max="99" required value={descForm.porcentaje} onChange={e=>setDescForm({...descForm, porcentaje: e.target.value})} className="p-2.5 rounded-xl bg-black/20 border border-white/20 outline-none text-white font-bold text-sm" placeholder="Ej: 15" /></div>
                     <div className="flex flex-col"><label className="text-[10px] font-black uppercase opacity-70 mb-1 ml-1">Inicio</label><input type="date" required value={descForm.inicio} onChange={e=>setDescForm({...descForm, inicio: e.target.value})} className="p-2.5 rounded-xl bg-black/20 border border-white/20 outline-none text-white font-bold text-xs" /></div>
                     <div className="flex flex-col"><label className="text-[10px] font-black uppercase opacity-70 mb-1 ml-1">Fin</label><input type="date" required value={descForm.fin} onChange={e=>setDescForm({...descForm, fin: e.target.value})} className="p-2.5 rounded-xl bg-black/20 border border-white/20 outline-none text-white font-bold text-xs" /></div>
                     <div className="col-span-2 mt-2"><button type="submit" className="w-full bg-white text-purple-700 font-black py-3 rounded-xl shadow-lg transition-transform hover:-translate-y-0.5 text-sm uppercase tracking-widest">Activar Campaña</button></div>
                  </form>
                )}
              </div>
           </div>
         )}

         {esAdminSupremo && (
           <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-xl relative overflow-hidden border-4 border-slate-700 flex flex-col h-full">
              <Database size={120} className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none"/>
              <div className="flex justify-between items-start mb-4 relative z-10">
                 <div>
                   <h3 className="text-xl font-black flex items-center gap-2">Base de Datos</h3>
                   <p className="text-xs font-medium opacity-80 mt-1">Backup en Google Drive.</p>
                 </div>
                 {config?.ultimaFechaBackup === hoyStr && (
                   <span className="bg-emerald-500/30 text-emerald-300 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-emerald-400/30 flex items-center gap-1"><CheckCircle size={12}/> Al día</span>
                 )}
              </div>
              
              <div className="relative z-10 mt-auto bg-white/5 p-4 rounded-2xl border border-white/10 flex flex-col gap-3">
                 <div>
                   <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Último backup exportado:</div>
                   <div className="text-sm font-black text-emerald-300">{config?.ultimaFechaBackup === hoyStr ? 'Hoy, sistema respaldado.' : (config?.ultimaFechaBackup || 'Nunca')}</div>
                 </div>
                 <div className="flex gap-2">
                    <button onClick={()=>triggerBackup(false)} disabled={backupLoading} className="bg-sky-500 hover:bg-sky-600 text-white font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1 shadow-md transition-all flex-1 text-xs disabled:opacity-50">
                      {backupLoading ? <Loader2 size={16} className="animate-spin"/> : <DownloadCloud size={16}/>} 
                      {backupLoading ? 'Generando...' : 'Backup'}
                    </button>

                    <label className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1 shadow-md transition-all flex-1 cursor-pointer text-xs">
                      {backupLoading ? <Loader2 size={16} className="animate-spin"/> : <Upload size={16}/>} 
                      {backupLoading ? 'Cargando...' : 'Restaurar'}
                      <input type="file" accept=".json" className="hidden" onChange={handleRestaurarBackup} disabled={backupLoading} />
                    </label>
                 </div>
              </div>
           </div>
         )}
       </div>

      <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm">
        
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 border-b border-slate-100 dark:border-slate-700 pb-4 gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3"><CheckSquare className="text-sky-600"/> Validación y Auditoría</h2>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
             
             {/* BARRA DE BÚSQUEDA APLICADA */}
             <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                <input 
                  type="text" 
                  placeholder="Buscar por cliente..." 
                  className="w-full pl-10 pr-4 py-2 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm font-bold outline-none focus:border-sky-500 transition-colors"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
             </div>

             <div className="flex overflow-x-auto scrollbar-hide gap-2 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 w-full sm:w-max">
               {esAdmin && <button onClick={() => setVistaAdmin('pendientes')} className={`px-5 py-2.5 text-sm font-bold rounded-lg whitespace-nowrap transition-all ${vistaAdmin === 'pendientes' ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Pendientes ({pendientesOrdenados.length})</button>}
               <button onClick={() => setVistaAdmin('historial')} className={`px-5 py-2.5 text-sm font-bold rounded-lg whitespace-nowrap transition-all ${vistaAdmin === 'historial' ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Historial General</button>
               {esAuditor && <button onClick={() => setVistaAdmin('auditoria')} className={`px-5 py-2.5 text-sm font-bold rounded-lg whitespace-nowrap transition-all ${vistaAdmin === 'auditoria' ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Diario de Auditoría</button>}
             </div>
          </div>
        </div>

        {vistaAdmin === 'historial' && (
          <div className="flex flex-col md:flex-row gap-4 mb-8 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 items-end">
            <div className="flex-1 w-full">
               <label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 ml-2 block">Desde (Fecha)</label>
               <input type="date" value={fechaInicio} onChange={e=>setFechaInicio(e.target.value)} className="w-full p-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 font-bold outline-none focus:border-sky-500 text-sm transition-colors" />
            </div>
            <div className="flex-1 w-full">
               <label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 ml-2 block">Hasta (Fecha)</label>
               <input type="date" value={fechaFin} onChange={e=>setFechaFin(e.target.value)} className="w-full p-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 font-bold outline-none focus:border-sky-500 text-sm transition-colors" />
            </div>
            <div className="flex items-center gap-4 w-full md:w-auto">
               <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-600 px-4 py-3 rounded-xl font-bold text-sm select-none transition-colors w-full sm:w-auto justify-center">
                 <input type="checkbox" className="w-4 h-4 accent-sky-500 rounded" checked={mostrarAnulados} onChange={(e) => setMostrarAnulados(e.target.checked)}/>
                 Mostrar Anulados
               </label>

               {(fechaInicio !== hoyStr || fechaFin !== hoyStr) && (
                 <button onClick={()=>{setFechaInicio(hoyStr); setFechaFin(hoyStr);}} className="text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 py-3 px-6 rounded-xl w-full md:w-auto transition-colors">Ver Solo Hoy</button>
               )}
            </div>
          </div>
        )}

        {['pendientes', 'historial'].includes(vistaAdmin) && (
          <div className="flex flex-col gap-6">
            {listado.length === 0 ? (
              <div className="p-12 text-center text-slate-400 font-bold border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl">No hay pedidos para mostrar con estos filtros.</div>
            ) : listado.map((p, index) => (
              <div key={p.id} className={`relative flex flex-col lg:grid lg:grid-cols-12 gap-6 p-6 md:p-8 transition-all border-2 rounded-[2rem] shadow-sm bg-white dark:bg-slate-800 ${vistaAdmin === 'historial' && !p.auditado && p.status !== 'Anulado' ? 'border-amber-300 dark:border-amber-700' : 'border-slate-200 dark:border-slate-600 hover:border-sky-300'}`}>
                 
                 <div className="absolute -top-3 -left-3 bg-[#003366] dark:bg-sky-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-black border-2 border-white dark:border-slate-800 shadow-md z-10">
                    {index + 1}
                 </div>

                 <div className="absolute top-5 right-6"><StatusBadge status={p.status}/></div>

                 <div className="lg:col-span-5 flex flex-col justify-start">
                   <div className="font-bold text-xl text-slate-800 dark:text-slate-100 pr-24 leading-tight">{p.clienteNombre}</div>
                   
                   {/* MODIFICACIÓN: Indicador visual de la fecha operativa */}
                   <div className="text-[11px] font-black tracking-widest uppercase text-sky-600 dark:text-sky-400 mt-1 mb-3 flex items-center flex-wrap gap-2">
                     <span>Ingreso: {new Date(p.fechaCreacion).toLocaleDateString('es-VE')} {new Date(p.fechaCreacion).toLocaleTimeString('es-VE', {hour: '2-digit', minute:'2-digit'})}</span>
                     {/* Solo mostramos la etiqueta si la fecha operativa difiere de la fecha real de creación */}
                     {getFechaOperativaObj(p.fechaCreacion).visual !== new Date(p.fechaCreacion).toLocaleDateString('es-VE') && (
                        <span className="bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-700">Operativo: {getFechaOperativaObj(p.fechaCreacion).visual}</span>
                     )}
                   </div>
                   
                   <div className="text-xs font-semibold text-slate-500 flex items-center gap-2 mb-4">
                     <span className="bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-lg">Asesora: {p.asesora}</span>
                     {p.esMercadoLibre && <span className="bg-yellow-100 text-yellow-800 px-3 py-1.5 rounded-lg font-black uppercase tracking-widest border border-yellow-300">MercadoLibre</span>}
                   </div>
                   
                   <div className="text-[13px] font-medium text-slate-700 dark:text-slate-300 bg-[#f0f4f8] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 mt-1 rounded-xl shadow-inner">
                     <span className="font-black text-sky-700 dark:text-sky-400 flex items-center gap-1.5 mb-2 uppercase tracking-wider text-[10px]"><Package size={14}/> Productos Facturados:</span>
                     {p.productos ? <div className="whitespace-pre-wrap leading-relaxed">{typeof p.productos === 'string' ? p.productos : JSON.stringify(p.productos)}</div> : 'Sin detalle.'}
                   </div>
                 </div>

                 <div className="lg:col-span-4 flex flex-col justify-start mt-4 lg:mt-0">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 dark:border-slate-700 pb-2">Análisis Financiero</span>
                   
                   {p.status === 'Anulado' ? (
                       <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl border border-slate-300 dark:border-slate-600 mb-4 opacity-70">
                         <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1"><Ban size={12}/> ORDEN ANULADA</div>
                         <div className="font-black text-slate-400 text-lg line-through">${(p.montoUsd||0).toFixed(2)}</div>
                         <div className="text-xs text-red-500 font-bold mt-2 leading-tight">Motivo: {p.motivoAnulacion || 'Cancelado por el Administrador'}</div>
                       </div>
                   ) : p.esRegalo ? (
                      <div className="font-black text-purple-600 dark:text-purple-400 text-lg flex items-center gap-2 bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl"><Gift size={20}/> REGALO VIP</div>
                   ) : p.moneda === 'ZELLE' ? (
                      <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl border border-purple-200 dark:border-purple-800 mb-4">
                        <div className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-1">Pago Vía Zelle</div>
                        <div className="font-black text-purple-800 dark:text-purple-300 text-3xl">${(p.montoUsd||0).toFixed(2)}</div>
                        
                        <div className="flex flex-wrap gap-2 mt-3">
                           {p.sobranteUsd > 0 && <span className="text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-2.5 py-1 rounded-lg">+ Sobrante: ${p.sobranteUsd}</span>}
                           {p.faltanteUsd > 0 && <span className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2.5 py-1 rounded-lg">- Faltante: ${p.faltanteUsd}</span>}
                        </div>
                      </div>
                   ) : (
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-4">
                        <div className="font-black text-slate-800 dark:text-slate-100 text-3xl">${(p.montoUsd||0).toFixed(2)}</div>
                        <div className="font-bold text-emerald-600 dark:text-emerald-400 text-lg mb-1">Bs. {(p.montoVes||0).toFixed(2)}</div>
                        <div className="text-[11px] font-bold text-slate-500 mb-3">Tasa Aplicada: Bs. {p.tasaAplicada}</div>
                        
                        <div className="flex flex-wrap gap-2">
                           {p.sobranteUsd > 0 && <span className="text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-2.5 py-1 rounded-lg border border-purple-200">+ Sobrante: ${p.sobranteUsd}</span>}
                           {p.faltanteUsd > 0 && <span className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2.5 py-1 rounded-lg border border-red-200">- Faltante: ${p.faltanteUsd}</span>}
                           {p.descuentoGlobalAplicado > 0 && <span className="text-[10px] font-bold text-pink-600 bg-pink-50 px-2.5 py-1 rounded-lg border border-pink-200">Campaña: {p.descuentoGlobalAplicado}%</span>}
                           {p.descuentoPorcentaje > 0 && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">Asesor: {p.descuentoPorcentaje}%</span>}
                        </div>
                      </div>
                   )}
                   
                   <div className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 break-all mb-4">
                     <span className="text-slate-400 mr-1 block sm:inline">Ref:</span>{p.referencia}
                   </div>
                   
                   <div className="flex flex-col gap-2">
                      {p.linkComprobantePago && <a href={p.linkComprobantePago} target="_blank" rel="noreferrer" className="text-xs text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/30 p-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors border border-sky-100 dark:border-sky-800/50"><FileText size={16}/> Capture (Cliente/Ventas)</a>}
                      {p.linkComprobanteAdmin && <a href={p.linkComprobanteAdmin} target="_blank" rel="noreferrer" className="text-xs text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 p-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors border border-purple-100 dark:border-purple-800/50"><ImageIcon size={16}/> Extracto Banco (Admin)</a>}
                   </div>
                 </div>

                 <div className="lg:col-span-3 flex flex-col items-stretch justify-start mt-6 lg:mt-0 pt-6 lg:pt-0 border-t border-slate-100 dark:border-slate-700 lg:border-none h-full relative">
                     
                     {esAdmin && p.status === 'Pendiente' && (
                       <div className="flex flex-col gap-3 w-full mt-auto">
                         <button onClick={()=>abrirModalValidacion(p)} className="bg-sky-600 text-white py-3.5 rounded-xl font-black text-sm shadow-lg hover:bg-sky-700 hover:-translate-y-0.5 transition-all w-full uppercase tracking-wider">Validar Pago</button>
                         <button onClick={()=>rechazarPago(p)} className="bg-white dark:bg-slate-800 border-2 border-red-200 text-red-600 py-3 rounded-xl font-bold text-sm hover:bg-red-50 transition-colors w-full">Devolver a Ventas</button>
                       </div>
                     )}
                     
                     {p.status !== 'Pendiente' && p.notasAuditoria && p.notasAuditoria.length > 0 && (
                       <div className="mb-4 bg-amber-50 dark:bg-amber-900/10 p-3 rounded-xl border border-amber-200 dark:border-amber-800">
                         <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 block mb-2 uppercase tracking-widest flex items-center gap-1"><MessageSquare size={12}/> Hilo de Comentarios:</span>
                         <div className="space-y-2">
                           {p.notasAuditoria.map((n, i) => (
                             <div key={i} className="text-[11px] text-amber-900 dark:text-amber-200 bg-white dark:bg-slate-800 p-2 rounded-lg shadow-sm border border-amber-100 dark:border-amber-800/50">
                               <div className="font-bold mb-0.5 opacity-80">{n.autor} <span className="font-normal text-[9px]">({new Date(n.fecha).toLocaleDateString()})</span>:</div>
                               <div className="italic leading-snug">"{n.texto}"</div>
                             </div>
                           ))}
                         </div>
                       </div>
                     )}

                     {esAuditor && p.status !== 'Pendiente' && p.status !== 'Anulado' && (
                       <div className="flex flex-col gap-3 w-full mt-auto">
                         {!p.auditado && (
                            <button onClick={()=>revisionRapida(p)} className="bg-emerald-50 hover:bg-emerald-100 border-2 border-emerald-200 text-emerald-700 py-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"><CheckCircle size={18}/> Aprobación Rápida</button>
                         )}
                         <button onClick={()=>marcarAuditoriaConNota(p)} className="bg-white hover:bg-slate-50 border-2 border-slate-200 text-slate-600 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm">
                            <MessageSquare size={16}/> {p.notasAuditoria?.length > 0 ? 'Responder / Añadir Nota' : 'Revisar con Nota'}
                         </button>
                       </div>
                     )}
                     
                     {p.auditado && p.status !== 'Anulado' && (
                       <div className="bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400 font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 py-4 rounded-2xl shadow-sm mt-4"><ShieldCheck size={20}/> Auditado</div>
                     )}
                     
                     {vistaAdmin === 'historial' && !p.auditado && p.status !== 'Anulado' && (
                       <div className="text-[10px] font-black uppercase text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-lg flex items-center justify-center gap-1 w-full lg:w-max mt-4 border border-amber-200"><AlertTriangle size={14}/> Sin Auditar</div>
                     )}

                     {vistaAdmin === 'historial' && esAdminSupremo && p.status !== 'Anulado' && (
                       <button onClick={()=>anularPedido(p)} className="mt-4 pt-4 text-slate-400 hover:text-red-500 text-[11px] font-bold flex items-center justify-center gap-1 opacity-60 hover:opacity-100 transition-opacity uppercase tracking-widest border-t border-slate-100 dark:border-slate-700"><Ban size={14}/> Anular Orden (Sin borrar historial)</button>
                     )}
                 </div>
              </div>
            ))}
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
                      {dia.pedidos.filter(p => p.notasAuditoria?.length > 0 || p.faltanteUsd > 0 || p.sobranteUsd > 0 || p.status === 'Rechazado' || p.status === 'Anulado').map(p => (
                         <div key={p.id} className="text-sm bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                            <div className="font-bold flex items-center justify-between">
                              <span className={p.status === 'Anulado' ? 'line-through text-slate-400' : ''}>{p.clienteNombre}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded uppercase ${p.status === 'Anulado' ? 'bg-slate-200 text-slate-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{p.status}</span>
                            </div>
                            <div className="mt-2 space-y-1">
                              {p.sobranteUsd > 0 && <div className="text-xs text-purple-600 font-bold">• Sobrante reportado: ${p.sobranteUsd}</div>}
                              {p.faltanteUsd > 0 && <div className="text-xs text-red-600 font-bold">• Faltante reportado: ${p.faltanteUsd}</div>}
                              {p.status === 'Anulado' && <div className="text-xs text-slate-600 font-bold mt-2 p-2 bg-slate-100 rounded">Motivo Anulación: {p.motivoAnulacion}</div>}
                              {p.notasAuditoria?.map((n, i) => (
                                 <div key={i} className="text-xs text-amber-600 mt-1 italic">- Nota ({n.autor}): "{n.texto}"</div>
                              ))}
                            </div>
                         </div>
                      ))}
                      {dia.pedidos.filter(p => p.notasAuditoria?.length > 0 || p.faltanteUsd > 0 || p.sobranteUsd > 0 || p.status === 'Rechazado' || p.status === 'Anulado').length === 0 && (
                        <div className="text-xs text-slate-500 italic">No se detectaron notas ni anomalías financieras en los pedidos de este día.</div>
                      )}
                   </div>
                </div>
             ))}
          </div>
        )}
      </div>

      {modalValidacion && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
           <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 border border-slate-200 dark:border-slate-700">
              <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                 <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2"><CheckCircle className="text-sky-600"/> Confirmar Pago</h3>
                 <button onClick={() => setModalValidacion(null)} className="p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"><X size={20}/></button>
              </div>
              <div className="p-6">
                 <div className="bg-[#f0f4f8] dark:bg-slate-900 p-4 rounded-xl mb-6 flex justify-between items-center border border-slate-200 dark:border-slate-700">
                    <div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Cliente</div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">{modalValidacion.pedido.clienteNombre}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Monto a Cobrar</div>
                      <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">${modalValidacion.pedido.montoUsd}</div>
                    </div>
                 </div>
                 
                 <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1.5 ml-1 block">¿Sobrante ($)? (Opcional)</label>
                 <input type="number" step="0.01" value={modalValidacion.sobrante} onChange={e=>setModalValidacion(prev=>({...prev, sobrante: e.target.value}))} className="w-full border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-white p-3.5 rounded-xl mb-6 outline-none focus:border-sky-500 font-bold" placeholder="0.00" />

                 <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1.5 ml-1 flex items-center justify-between">
                    <span>Extracto Bancario (Recomendado)</span>
                    <span className="text-sky-600 dark:text-sky-400 font-black tracking-widest bg-sky-50 dark:bg-sky-900 px-2 py-1 rounded">Ctrl+V</span>
                 </label>
                 
                 <div 
                    className="border-2 border-dashed border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/10 hover:bg-sky-100 dark:hover:bg-sky-900/20 transition-colors rounded-2xl p-6 text-center cursor-pointer relative"
                    onPaste={handlePasteComprobante}
                 >
                    {modalValidacion.previewUrl ? (
                       <img src={modalValidacion.previewUrl} className="max-h-48 mx-auto rounded-lg shadow-sm" alt="Preview"/>
                    ) : (
                       <div className="text-sky-700 dark:text-sky-500 flex flex-col items-center py-4">
                          <UploadCloud size={36} className="mb-3 opacity-80" />
                          <p className="font-bold text-sm">Haz clic aquí y presiona <kbd className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 mx-1 shadow-sm text-slate-800 dark:text-slate-200">Ctrl</kbd> + <kbd className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 mx-1 shadow-sm text-slate-800 dark:text-slate-200">V</kbd></p>
                          <p className="text-xs mt-1 opacity-70">Para pegar la captura del banco desde tu portapapeles</p>
                       </div>
                    )}
                    <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e)=>{
                       if(e.target.files[0]){
                          setModalValidacion(prev=>({...prev, file: e.target.files[0], previewUrl: URL.createObjectURL(e.target.files[0])}))
                       }
                    }}/>
                 </div>
                 
                 <button onClick={procesarValidacionDefinitiva} disabled={modalValidacion.subiendo} className="w-full bg-[#003366] hover:bg-[#002244] dark:bg-sky-600 dark:hover:bg-sky-700 text-white font-black py-4 rounded-xl mt-6 shadow-xl transition-transform hover:-translate-y-0.5 disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-widest">
                   {modalValidacion.subiendo ? <><Loader2 className="animate-spin"/> Guardando...</> : 'Aprobar y Descontar'}
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}