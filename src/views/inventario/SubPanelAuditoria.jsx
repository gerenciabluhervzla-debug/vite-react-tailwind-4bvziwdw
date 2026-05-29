import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, MessageSquare, CalendarDays, FileOutput, Download, ShieldCheck, Eye, Package, Store } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { BRAND_LOGO } from '../../config/constants';

export default function SubPanelAuditoria({ db, appId, dialogs, loggear, perfil }) {
   const [cierres, setCierres] = useState([]);
   const esAuditor = ['Auditoría', 'Administrador', 'Admin'].includes(perfil?.role);
   
   useEffect(() => {
      // Escuchar ambas colecciones simultáneamente
      const qInv = query(collection(db, 'artifacts', appId, 'public', 'data', 'cierres_inventario'), orderBy('timestamp', 'desc'));
      const qRec = query(collection(db, 'artifacts', appId, 'public', 'data', 'cierres_recepcion'), orderBy('timestamp', 'desc'));
      
      let invData = [];
      let recData = [];

      const unificarCierres = () => {
         const combinados = [...invData, ...recData].sort((a, b) => b.timestamp - a.timestamp);
         setCierres(combinados);
      };

      const unsubInv = onSnapshot(qInv, snap => {
         invData = snap.docs.map(d => ({id: d.id, tipoCierre: 'INVENTARIO', ...d.data()}));
         unificarCierres();
      });

      const unsubRec = onSnapshot(qRec, snap => {
         recData = snap.docs.map(d => ({id: d.id, tipoCierre: 'RECEPCION', ...d.data()}));
         unificarCierres();
      });

      return () => { unsubInv(); unsubRec(); };
   }, [db, appId]);

  const auditarCierreRapido = async (cierre) => {
    if(!esAuditor) return;
    try {
      const coleccion = cierre.tipoCierre === 'INVENTARIO' ? 'cierres_inventario' : 'cierres_recepcion';
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', coleccion, cierre.id), { 
        auditado: true, auditadoPor: perfil?.nombre || 'Auditor', fechaAuditoria: Date.now() 
      });
      loggear('AUDITORIA_CIERRE_RAPIDA', `Cierre de ${cierre.tipoCierre} del ${cierre.fecha} validado.`);
    } catch(e) { console.error(e); }
  };

  const auditarCierreConNota = (cierre) => {
    if(!esAuditor) return;
    dialogs.prompt("Escribe un comentario u observación para este cierre:", async (nota) => {
       if(!nota) return;
       try {
          const coleccion = cierre.tipoCierre === 'INVENTARIO' ? 'cierres_inventario' : 'cierres_recepcion';
          const notasExistentes = cierre.notasAuditoria || [];
          const nuevasNotas = [...notasExistentes, { fecha: Date.now(), texto: nota, autor: perfil?.nombre || 'Auditor' }];
          
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', coleccion, cierre.id), { 
             auditado: true, auditadoPor: perfil?.nombre || 'Auditor', notasAuditoria: nuevasNotas, fechaAuditoria: Date.now() 
          });
          loggear('AUDITORIA_CIERRE_NOTA', `Añadió nota al cierre de ${cierre.tipoCierre} del ${cierre.fecha}`);
       } catch(e) { console.error(e); }
    }, "Añadir Comentario");
  };

  const imprimirPDF = (cierre) => {
    const printWindow = window.open('', '_blank');
    if(!printWindow) return dialogs.alert("Por favor permite las ventanas emergentes (Pop-ups) para generar el PDF.");
    
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Reporte de Cierre - ${cierre.fecha}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; max-width: 900px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid ${cierre.tipoCierre === 'INVENTARIO' ? '#0ea5e9' : '#9333ea'}; padding-bottom: 20px; margin-bottom: 20px; }
          .logo { height: 60px; object-fit: contain; }
          h1 { color: #0f172a; font-weight: 900; margin: 0; font-size: 24px; text-transform: uppercase;}
          .meta-info { margin-bottom: 20px; background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between;}
          .meta-box p { margin: 5px 0; font-size: 14px; }
          .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
          .badge-ok { background: #dcfce7; color: #166534; }
          .badge-warn { background: #fee2e2; color: #991b1b; }
          .status-box { padding: 15px; border-radius: 8px; font-weight: 900; text-align: center; border: 1px solid currentColor; margin-bottom: 30px; font-size: 13px; letter-spacing: 1px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border-bottom: 1px solid #e2e8f0; padding: 12px 8px; text-align: left; }
          th { background-color: #f1f5f9; color: #475569; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; }
          .ok { color: #166534; font-weight: bold; }
          .faltante { color: #dc2626; font-weight: bold; }
          .sobrante { color: #ea580c; font-weight: bold; }
          @media print { body { padding: 0; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 20px; background: #fffbeb; color: #b45309; padding: 15px; border-radius: 8px; border: 1px solid #fde68a; font-weight: bold; text-align: center;">
           Para guardarlo, elige "Guardar como PDF" (Save as PDF) en el menú de impresión.
        </div>

        <div class="header">
          <div>
            <h1>Auditoría: ${cierre.tipoCierre === 'INVENTARIO' ? 'Despacho Nacional' : 'Recepción (Tienda)'}</h1>
            <p style="color: #64748b; margin-top: 5px; font-size: 14px;">Cierre Oficial Diario</p>
          </div>
          <img src="${BRAND_LOGO}" class="logo" alt="Bluher Logo"/>
        </div>
        
        <div class="meta-info">
           <div class="meta-box">
              <p><strong>Fecha del Cierre:</strong> ${cierre.fecha}</p>
              <p><strong>Realizado por:</strong> ${cierre.creadoPor}</p>
           </div>
           <div class="meta-box" style="text-align: right;">
              <p><strong>Total Procesado:</strong> ${cierre.tipoCierre === 'INVENTARIO' ? cierre.totalItemsAuditados + ' Items' : cierre.totalEntregas + ' Paquetes'}</p>
              ${cierre.tipoCierre === 'INVENTARIO' ? `
              <p><strong>Anomalías:</strong> 
                 <span class="badge ${cierre.anomaliasDetectadas === 0 ? 'badge-ok' : 'badge-warn'}">
                    ${cierre.anomaliasDetectadas === 0 ? 'Sin Anomalías' : cierre.anomaliasDetectadas + ' Diferencias'}
                 </span>
              </p>` : ''}
           </div>
        </div>

        <div class="status-box" style="background: ${cierre.auditado ? '#dcfce7' : '#fffbeb'}; color: ${cierre.auditado ? '#166534' : '#b45309'};">
           ${cierre.auditado ? 'AUDITORÍA VALIDADA POR: ' + cierre.auditadoPor.toUpperCase() : 'CIERRE PENDIENTE DE AUDITORÍA OFICIAL'}
        </div>

        <table>
    `;

    if (cierre.tipoCierre === 'INVENTARIO') {
        html += `<thead><tr><th>Categoría</th><th>Producto</th><th>Sistema</th><th>Físico</th><th>Diferencia</th><th>Notas Relevantes</th></tr></thead><tbody>`;
        cierre.productos.forEach(p => {
           const claseDif = p.diferencia === 0 ? 'ok' : (p.diferencia < 0 ? 'faltante' : 'sobrante');
           const textDif = p.diferencia === 0 ? 'OK' : (p.diferencia > 0 ? '+'+p.diferencia : p.diferencia);
           html += `<tr>
             <td>${p.categoria}</td>
             <td><strong>${p.nombre}</strong><br><span style="color:#64748b; font-size:11px;">${p.presentacion}</span></td>
             <td style="text-align:center;">${p.sistema}</td>
             <td style="text-align:center; font-weight:bold;">${p.fisico}</td>
             <td class="${claseDif}" style="text-align:center;">${textDif}</td>
             <td><i>${p.nota || '-'}</i></td>
           </tr>`;
        });
    } else {
        html += `<thead><tr><th>Cliente</th><th>Tipo Despacho</th><th>Asesora</th><th>Hora Entrega</th><th>Soporte</th></tr></thead><tbody>`;
        cierre.entregas.forEach(p => {
           html += `<tr>
             <td><strong>${p.cliente}</strong></td>
             <td style="font-weight:bold; color: #7e22ce;">${p.tipo}</td>
             <td>${p.asesora}</td>
             <td>${p.hora}</td>
             <td>${p.fotoGuardada ? '<span style="color:#166534; font-weight:bold;">Foto Ok</span>' : '<span style="color:#dc2626; font-weight:bold;">Sin Foto</span>'}</td>
           </tr>`;
        });
    }

    html += `</tbody></table>
      <div style="margin-top: 50px; border-top: 1px dashed #cbd5e1; padding-top: 20px; color: #94a3b8; font-size: 11px; text-align: center;">
         Documento generado automáticamente por el Sistema de Gestión Bluher el ${new Date().toLocaleString('es-VE')}
      </div>
    </body></html>`;
    
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 1000);
  };

  return (
    <div className="space-y-6 animate-in fade-in">
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {cierres.length === 0 ? (
            <div className="col-span-full py-10 text-center text-slate-400 font-bold italic border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
              No hay reportes de cierre todavía.
            </div>
         ) : cierres.map(cierre => (
            <div key={cierre.id} className={`bg-white dark:bg-slate-800 border-2 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between ${cierre.auditado ? 'border-emerald-200 dark:border-emerald-800/50' : 'border-slate-100 dark:border-slate-700'}`}>
               <div>
                 <div className="flex justify-between items-start mb-4">
                   <div className={`px-3 py-1 rounded-lg font-black text-sm tracking-widest flex items-center gap-1.5 ${cierre.tipoCierre === 'INVENTARIO' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400'}`}>
                      {cierre.tipoCierre === 'INVENTARIO' ? <Package size={14}/> : <Store size={14}/>}
                      {cierre.fecha}
                   </div>
                   <div className="text-[10px] text-slate-400 font-bold uppercase text-right">Por: {cierre.creadoPor}</div>
                 </div>
                 
                 <div className="space-y-2 mb-6">
                   <div className="flex justify-between text-sm">
                     <span className="font-medium text-slate-500">{cierre.tipoCierre === 'INVENTARIO' ? 'Items Auditados:' : 'Paquetes Entregados:'}</span>
                     <span className="font-black text-slate-700 dark:text-slate-200">{cierre.tipoCierre === 'INVENTARIO' ? cierre.totalItemsAuditados : cierre.totalEntregas}</span>
                   </div>
                   
                   {cierre.tipoCierre === 'INVENTARIO' && (
                     <div className="flex justify-between text-sm">
                       <span className="font-medium text-slate-500">Estado:</span>
                       {cierre.anomaliasDetectadas === 0 
                         ? <span className="font-black text-emerald-600 flex items-center gap-1"><CheckCircle size={14}/> Perfecto</span>
                         : <span className="font-black text-red-500 flex items-center gap-1"><AlertTriangle size={14}/> {cierre.anomaliasDetectadas} Diferencias</span>
                       }
                     </div>
                   )}
                 </div>
                 
                 {cierre.notasAuditoria && cierre.notasAuditoria.length > 0 && (
                   <div className="mb-4 bg-amber-50 dark:bg-amber-900/10 p-3 rounded-xl border border-amber-200 dark:border-amber-800">
                     <span className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400 tracking-widest mb-2 flex items-center gap-1">
                       <MessageSquare size={12}/> Hilo de Comentarios:
                     </span>
                     <div className="space-y-2">
                       {cierre.notasAuditoria.map((n, i) => (
                          <div key={i} className="text-[11px] text-amber-900 dark:text-amber-200 bg-white dark:bg-slate-800 p-2 rounded-lg shadow-sm border border-amber-100 dark:border-amber-800/50">
                             <div className="font-bold mb-0.5 opacity-80">{n.autor} <span className="font-normal text-[9px]">({new Date(n.fecha).toLocaleDateString()})</span>:</div>
                             <div className="italic leading-snug">"{n.texto}"</div>
                          </div>
                       ))}
                     </div>
                   </div>
                 )}
               </div>
               
               <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                  <button onClick={() => imprimirPDF(cierre)} className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:hover:bg-rose-900/50 dark:text-rose-400 font-bold rounded-xl flex justify-center items-center gap-2 transition-colors text-sm">
                     <FileOutput size={16}/> Ver Reporte en PDF
                  </button>

                  {esAuditor && (
                     <div className="flex gap-2 mt-2">
                        {!cierre.auditado && (
                           <button onClick={()=>auditarCierreRapido(cierre)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl flex items-center justify-center shadow-md transition-colors font-bold text-xs"><CheckCircle size={16} className="mr-1.5"/> Aprobar Rápido</button>
                        )}
                        <button onClick={()=>auditarCierreConNota(cierre)} className="flex-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 py-2.5 rounded-xl flex items-center justify-center transition-colors font-bold text-xs">
                           <MessageSquare size={16} className="mr-1.5"/> {cierre.notasAuditoria?.length > 0 ? 'Responder' : 'Añadir Nota'}
                        </button>
                     </div>
                  )}

                  {cierre.auditado && (
                     <div className="text-center font-black text-emerald-700 dark:text-emerald-400 uppercase text-[10px] tracking-widest mt-2 bg-emerald-50 dark:bg-emerald-900/20 py-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center justify-center gap-1.5">
                        <ShieldCheck size={14}/> Cierre Validado por {cierre.auditadoPor}
                     </div>
                  )}
               </div>
            </div>
         ))}
       </div>
    </div>
  );
}