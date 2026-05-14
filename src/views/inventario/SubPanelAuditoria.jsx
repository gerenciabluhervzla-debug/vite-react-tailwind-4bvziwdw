import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, MessageSquare, CalendarDays, FileOutput, Download, ShieldCheck, Eye } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { BRAND_LOGO } from '../../config/constants';

export default function SubPanelAuditoria({ db, appId, dialogs, loggear, perfil }) {
   const [cierres, setCierres] = useState([]);
   const esAuditor = ['Auditoría', 'Administrador'].includes(perfil?.role);
   
   useEffect(() => {
      const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'cierres_inventario'), orderBy('timestamp', 'desc'));
      const unsub = onSnapshot(q, snap => setCierres(snap.docs.map(d => ({id: d.id, ...d.data()}))));
      return () => unsub();
   }, [db, appId]);

  const auditarCierreRapido = async (cierre) => {
    if(!esAuditor) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'cierres_inventario', cierre.id), { 
        auditado: true, auditadoPor: perfil?.nombre || 'Auditor', fechaAuditoria: Date.now() 
      });
      loggear('AUDITORIA_CIERRE_RAPIDA', `Cierre de ${cierre.fecha} validado.`);
    } catch(e) { console.error(e); }
  };

  const auditarCierreConNota = (cierre) => {
    if(!esAuditor) return;
    dialogs.prompt("Escribe una observación de auditoría para este cierre:", async (nota) => {
       if(!nota) return;
       try {
          const notasExistentes = cierre.notasAuditoria || [];
          const nuevasNotas = [...notasExistentes, { fecha: Date.now(), texto: nota, autor: perfil?.nombre || 'Auditor' }];
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'cierres_inventario', cierre.id), { 
             auditado: true, auditadoPor: perfil?.nombre || 'Auditor', notasAuditoria: nuevasNotas, fechaAuditoria: Date.now() 
          });
          loggear('AUDITORIA_CIERRE_NOTA', `Cierre de ${cierre.fecha} auditado con nota.`);
       } catch(e) { console.error(e); }
    }, "Añadir Nota de Auditoría");
  };

  const generarCSV = (cierre) => {
    let csv = 'Categoria,Producto,Presentacion,Stock Sistema,Conteo Fisico,Diferencia,Estatus,Notas\n';
    cierre.productos.forEach(p => {
      const estatus = p.diferencia === 0 ? 'OK' : (p.diferencia > 0 ? 'SOBRANTE' : 'FALTANTE');
      csv += `"${p.categoria}","${p.nombre}","${p.presentacion}",${p.sistema},${p.fisico},${p.diferencia},"${estatus}","${p.nota}"\n`;
    });
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' }); 
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Cierre_Inventario_${cierre.fecha.replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0ea5e9; padding-bottom: 20px; margin-bottom: 20px; }
          .logo { height: 60px; object-fit: contain; }
          h1 { color: #0f172a; font-weight: 900; margin: 0; font-size: 24px; }
          .meta-info { margin-bottom: 20px; background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between;}
          .meta-box p { margin: 5px 0; font-size: 14px; }
          .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
          .badge-ok { background: #dcfce7; color: #166534; }
          .badge-warn { background: #fee2e2; color: #991b1b; }
          .status-box { padding: 15px; border-radius: 8px; font-weight: 900; text-align: center; border: 1px solid currentColor; margin-bottom: 30px; font-size: 13px; letter-spacing: 1px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
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
           Para guardarlo en tu computadora, elige "Guardar como PDF" (Save as PDF) en el menú de impresión que acaba de aparecer.
        </div>

        <div class="header">
          <div>
            <h1>Reporte de Cierre de Inventario</h1>
            <p style="color: #64748b; margin-top: 5px; font-size: 14px;">Departamento de Despacho & Logística</p>
          </div>
          <img src="${BRAND_LOGO}" class="logo" alt="Bluher Logo"/>
        </div>
        
        <div class="meta-info">
           <div class="meta-box">
              <p><strong>Fecha del Cierre:</strong> ${cierre.fecha}</p>
              <p><strong>Realizado por:</strong> ${cierre.creadoPor}</p>
           </div>
           <div class="meta-box" style="text-align: right;">
              <p><strong>Items Auditados:</strong> ${cierre.totalItemsAuditados}</p>
              <p><strong>Anomalías:</strong> 
                 <span class="badge ${cierre.anomaliasDetectadas === 0 ? 'badge-ok' : 'badge-warn'}">
                    ${cierre.anomaliasDetectadas === 0 ? 'Sin Anomalías' : cierre.anomaliasDetectadas + ' Diferencias detectadas'}
                 </span>
              </p>
           </div>
        </div>

        <div class="status-box" style="background: ${cierre.auditado ? '#dcfce7' : '#fffbeb'}; color: ${cierre.auditado ? '#166534' : '#b45309'};">
           ${cierre.auditado ? 'AUDITORÍA VALIDADA POR: ' + cierre.auditadoPor.toUpperCase() : 'CIERRE PENDIENTE DE AUDITORÍA OFICIAL'}
        </div>

        <table>
          <thead>
            <tr><th>Categoría</th><th>Producto</th><th>Sistema</th><th>Físico</th><th>Diferencia</th><th>Notas Relevantes</th></tr>
          </thead>
          <tbody>
    `;

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
              No hay reportes de cierre de inventario todavía.
            </div>
         ) : cierres.map(cierre => (
            <div key={cierre.id} className={`bg-white dark:bg-slate-800 border-2 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between ${cierre.auditado ? 'border-emerald-200 dark:border-emerald-800/50' : 'border-slate-100 dark:border-slate-700'}`}>
               <div>
                 <div className="flex justify-between items-start mb-4">
                   <div className="bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-400 px-3 py-1 rounded-lg font-black text-sm tracking-widest">{cierre.fecha}</div>
                   <div className="text-[10px] text-slate-400 font-bold uppercase text-right">Por: {cierre.creadoPor}</div>
                 </div>
                 
                 <div className="space-y-2 mb-6">
                   <div className="flex justify-between text-sm">
                     <span className="font-medium text-slate-500">Items Auditados:</span>
                     <span className="font-black text-slate-700 dark:text-slate-200">{cierre.totalItemsAuditados}</span>
                   </div>
                   <div className="flex justify-between text-sm">
                     <span className="font-medium text-slate-500">Estado de la Auditoría:</span>
                     {cierre.anomaliasDetectadas === 0 
                       ? <span className="font-black text-emerald-600 flex items-center gap-1"><CheckCircle size={14}/> Perfecto</span>
                       : <span className="font-black text-red-500 flex items-center gap-1"><AlertTriangle size={14}/> {cierre.anomaliasDetectadas} Diferencias</span>
                     }
                   </div>
                 </div>
                 
                 {cierre.notasAuditoria && cierre.notasAuditoria.length > 0 && (
                   <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                     <div className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400 tracking-widest mb-1.5 flex items-center gap-1">
                       <MessageSquare size={12}/> Observaciones de Auditoría:
                     </div>
                     {cierre.notasAuditoria.map((n, i) => (
                        <div key={i} className="text-xs text-amber-800 dark:text-amber-300 italic mb-1 last:mb-0">
                           "{n.texto}" <span className="font-bold opacity-70">- {n.autor}</span>
                        </div>
                     ))}
                   </div>
                 )}
               </div>
               
               <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                  <div className="flex gap-2">
                    <button onClick={() => imprimirPDF(cierre)} className="flex-1 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:hover:bg-rose-900/50 dark:text-rose-400 font-bold rounded-xl flex justify-center items-center gap-2 transition-colors text-sm">
                       <FileOutput size={16}/> PDF
                    </button>
                    <button onClick={() => generarCSV(cierre)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 font-bold rounded-xl flex justify-center items-center gap-2 transition-colors text-sm">
                       <Download size={16}/> Excel
                    </button>
                  </div>

                  {/* BOTONES DE AUDITORÍA */}
                  {esAuditor && !cierre.auditado && (
                     <div className="flex gap-2 mt-2">
                        <button onClick={()=>auditarCierreRapido(cierre)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl flex items-center justify-center shadow-md transition-colors font-bold text-xs"><CheckCircle size={16} className="mr-1.5"/> Aprobar Rápido</button>
                        <button onClick={()=>auditarCierreConNota(cierre)} className="flex-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 py-2.5 rounded-xl flex items-center justify-center transition-colors font-bold text-xs"><Eye size={16} className="mr-1.5"/> Con Nota</button>
                     </div>
                  )}

                  {/* SELLO DE AUDITORÍA */}
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