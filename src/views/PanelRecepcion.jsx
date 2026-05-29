import React, { useState, useMemo } from 'react';
import { Store, Bike, Package, Printer, Camera, CheckCircle, Search, FileDown, Loader2, Image as ImageIcon } from 'lucide-react';
import { updateDoc, doc } from 'firebase/firestore';
import { URL_GOOGLE_SCRIPT } from '../config/firebase';
import { compressImage } from '../utils/image';
import { StatusBadge } from '../components/ui';

export default function PanelRecepcion({ pedidos, perfil, db, appId, loggear, dialogs }) {
  const [busqueda, setBusqueda] = useState('');
  const [subiendoFotoId, setSubiendoFotoId] = useState(null);
  const [vista, setVista] = useState('pendientes'); // 'pendientes' | 'retiros' | 'entregados'

  // Filtrar solo pedidos que corresponden a Recepción y están pagados/validados
  const pedidosRecepcion = useMemo(() => {
     return pedidos.filter(p => 
        ['Tienda', 'Delivery'].includes(p.tipoDespacho) && 
        !p.esPublico && 
        !['Anulado', 'Rechazado', 'Pendiente'].includes(p.status)
     ).sort((a, b) => b.fechaCreacion - a.fechaCreacion);
  }, [pedidos]);

  // Sub-clasificaciones
  const listado = useMemo(() => {
     let filtrados = pedidosRecepcion;
     
     if (vista === 'pendientes') filtrados = filtrados.filter(p => p.status === 'Validado');
     if (vista === 'retiros') filtrados = filtrados.filter(p => p.status === 'Validado' && p.tipoDespacho === 'Tienda');
     if (vista === 'entregados') filtrados = filtrados.filter(p => p.status === 'Despachado');

     if (busqueda.trim()) {
      const b = busqueda.toLowerCase();
      filtrados = filtrados.filter(p => 
         String(p.clienteNombre || '').toLowerCase().includes(b) || 
         String(p.retiroNombre || '').toLowerCase().includes(b)
      );
   }
     return filtrados;
  }, [pedidosRecepcion, vista, busqueda]);

  const imprimirEtiqueta = (p) => {
    const printWindow = window.open('', '_blank');
    if(!printWindow) return dialogs.alert("Permite las ventanas emergentes para imprimir.");
    
    const isDelivery = p.tipoDespacho === 'Delivery';
    
    const html = `
      <html>
        <head>
          <title>Etiqueta - ${p.clienteNombre}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #000; width: 350px; margin: auto; border: 2px dashed #000; }
            h2 { text-align: center; margin: 0 0 10px 0; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 10px;}
            .info { margin-bottom: 5px; font-size: 14px; }
            .info strong { text-transform: uppercase; font-size: 12px; }
            .box { background: #f0f0f0; padding: 10px; border-radius: 5px; margin: 15px 0; text-align: center; border: 1px solid #ccc; }
            .products { font-size: 12px; margin-top: 15px; white-space: pre-wrap; line-height: 1.4; border-top: 1px dotted #000; padding-top: 10px;}
            .footer { text-align: center; margin-top: 20px; font-size: 10px; font-style: italic; }
          </style>
        </head>
        <body>
          <h2>BLUHER - ${p.tipoDespacho}</h2>
          <div class="info"><strong>Cliente:</strong><br/> ${p.clienteNombre}</div>
          <div class="info"><strong>Teléfono:</strong><br/> ${p.clienteTelefono}</div>
          
          ${isDelivery ? `
             <div class="box">
               <strong>PROGRAMACIÓN DE DELIVERY</strong><br/>
               <span style="font-size: 16px; font-weight: bold;">${p.deliveryFecha} a las ${p.deliveryHora}</span>
             </div>
             <div class="info"><strong>Dirección:</strong><br/> ${p.direccion}</div>
          ` : `
             <div class="box">
               <strong>DATOS DE RETIRO EN TIENDA</strong><br/>
               <span style="font-size: 14px; font-weight: bold;">Retira: ${p.retiroNombre}</span><br/>
               C.I: ${p.retiroCedula}
             </div>
          `}
          
          <div class="products">
            <strong>CONTENIDO DEL PAQUETE:</strong><br/>
            ${typeof p.productos === 'string' ? p.productos : JSON.stringify(p.productos)}
          </div>
          
          <div class="footer">
            Generado el: ${new Date().toLocaleString('es-VE')}<br/>
            Auditoría de Recepción Bluher
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const subirFotoEntrega = async (e, pedido) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!URL_GOOGLE_SCRIPT) return dialogs.alert("Sistema de subida no configurado.");
    
    setSubiendoFotoId(pedido.id);
    try {
      const base64Data = await compressImage(file, 800, 0.7);
      const response = await fetch(URL_GOOGLE_SCRIPT, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ tokenSecreto: "BLUHER_SECURE_TOKEN_2026", fileName: `Recepcion_${pedido.id}.jpg`, mimeType: 'image/jpeg', data: base64Data })
      });
      const result = await response.json();
      if (result.url) {
         await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', pedido.id), { linkFotoProductos: result.url });
         loggear('FOTO_RECEPCION', `Foto de entrega subida para ${pedido.clienteNombre}`);
      }
    } catch(err) {
      console.error(err);
      dialogs.alert("Error subiendo la foto.");
    } finally {
      setSubiendoFotoId(null);
    }
  };

  const marcarComoEntregado = async (pedido) => {
    if (!pedido.linkFotoProductos) {
       return dialogs.alert("Debes cargar una foto del paquete físico o de la entrega antes de marcarlo como procesado.", "Foto Requerida");
    }
    dialogs.confirm(`¿Confirmas que este paquete ha sido entregado/despachado físicamente al cliente o delivery?`, async () => {
       try {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', pedido.id), { status: 'Despachado', fechaEntregaFisica: Date.now() });
          loggear('PAQUETE_ENTREGADO', `Recepción procesó la entrega de: ${pedido.clienteNombre}`);
          dialogs.alert("Paquete marcado como entregado exitosamente.", "Completado");
       } catch(e) { console.error(e); }
    });
  };

  const generarCierreAuditoria = () => {
     const hoy = new Date().toLocaleDateString('es-VE');
     const entregadosHoy = pedidosRecepcion.filter(p => p.status === 'Despachado' && new Date(p.fechaEntregaFisica || p.fechaCreacion).toLocaleDateString('es-VE') === hoy);
     
     if (entregadosHoy.length === 0) return dialogs.alert("No hay paquetes procesados el día de hoy para generar un cierre.");

     const printWindow = window.open('', '_blank');
     let html = `
      <html>
        <head>
          <style>
             body { font-family: sans-serif; padding: 30px; }
             h1 { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; }
             table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
             th, td { border: 1px solid #ccc; padding: 10px; text-align: left; }
             th { background: #f0f0f0; }
          </style>
        </head>
        <body>
          <h1>Cierre de Recepción - ${hoy}</h1>
          <p>Total de Paquetes Procesados: <strong>${entregadosHoy.length}</strong></p>
          <table>
             <tr><th>Cliente</th><th>Tipo Despacho</th><th>Asesora</th><th>Hora Entrega</th><th>Foto</th></tr>
             ${entregadosHoy.map(p => `
                <tr>
                   <td>${p.clienteNombre}</td>
                   <td>${p.tipoDespacho}</td>
                   <td>${p.asesora}</td>
                   <td>${new Date(p.fechaEntregaFisica || p.fechaCreacion).toLocaleTimeString('es-VE')}</td>
                   <td>${p.linkFotoProductos ? 'SI (Guardada)' : 'NO'}</td>
                </tr>
             `).join('')}
          </table>
          <p style="text-align: center; margin-top: 40px; font-size: 10px;">Firma del Encargado ___________________________</p>
        </body>
      </html>
     `;
     printWindow.document.write(html);
     printWindow.document.close();
     setTimeout(() => printWindow.print(), 500);
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-700 transition-colors animate-in fade-in">
       
       <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-4 border-b border-slate-100 dark:border-slate-700 pb-6">
         <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3"><Package className="text-purple-600" /> Módulo de Recepción</h2>
            <p className="text-sm font-medium text-slate-500 mt-1">Gestión de entregas en tienda y despacho de deliveries.</p>
         </div>
         <div className="flex flex-wrap gap-2 w-full xl:w-auto bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl">
           <button onClick={()=>setVista('pendientes')} className={`px-4 py-2.5 text-sm font-bold rounded-lg transition-all ${vista==='pendientes'?'bg-white dark:bg-slate-700 shadow text-purple-700 dark:text-purple-400':'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Todos los Pendientes</button>
           <button onClick={()=>setVista('retiros')} className={`px-4 py-2.5 text-sm font-bold rounded-lg transition-all ${vista==='retiros'?'bg-white dark:bg-slate-700 shadow text-purple-700 dark:text-purple-400':'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Pendientes por Retirar</button>
           <button onClick={()=>setVista('entregados')} className={`px-4 py-2.5 text-sm font-bold rounded-lg transition-all ${vista==='entregados'?'bg-white dark:bg-slate-700 shadow text-emerald-700 dark:text-emerald-400':'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Historial Entregados</button>
         </div>
       </div>

       <div className="flex flex-col md:flex-row gap-4 mb-6 justify-between items-center">
          <div className="relative w-full md:w-1/3">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
             <input type="text" placeholder="Buscar por cliente o autorizado..." className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm font-bold outline-none focus:border-purple-500 transition-colors" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
          <button onClick={generarCierreAuditoria} className="bg-slate-800 text-white px-5 py-3 rounded-xl font-bold text-sm shadow-md hover:bg-slate-700 flex items-center gap-2 transition-colors w-full md:w-auto justify-center"><FileDown size={18}/> Cierre Auditable Diario</button>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listado.length === 0 ? (
             <div className="col-span-full p-12 text-center text-slate-400 font-bold border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl">No hay paquetes en esta categoría.</div>
          ) : listado.map(p => (
             <div key={p.id} className={`bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border-2 transition-all shadow-sm flex flex-col h-full ${p.status === 'Despachado' ? 'border-emerald-200 dark:border-emerald-800/50 opacity-80' : p.tipoDespacho === 'Delivery' ? 'border-fuchsia-200 dark:border-fuchsia-800/50 hover:border-fuchsia-400' : 'border-purple-200 dark:border-purple-800/50 hover:border-purple-400'}`}>
                
                <div className="flex justify-between items-start mb-4">
                   <div>
                     <div className="text-lg font-black text-slate-800 dark:text-slate-100 leading-tight">{p.clienteNombre}</div>
                     <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Tlf: {p.clienteTelefono}</div>
                   </div>
                   {p.tipoDespacho === 'Delivery' ? (
                      <span className="bg-fuchsia-100 text-fuchsia-700 px-2 py-1 rounded-lg flex items-center gap-1 text-[10px] font-black uppercase"><Bike size={12}/> Delivery</span>
                   ) : (
                      <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-lg flex items-center gap-1 text-[10px] font-black uppercase"><Store size={12}/> Tienda</span>
                   )}
                </div>

                {p.tipoDespacho === 'Delivery' ? (
                   <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 mb-4 text-xs">
                     <span className="font-bold text-slate-400 block mb-1">PROGRAMADO PARA:</span>
                     <span className="font-black text-fuchsia-600 dark:text-fuchsia-400 text-sm">{p.deliveryFecha} a las {p.deliveryHora}</span>
                   </div>
                ) : (
                   <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 mb-4 text-xs">
                     <span className="font-bold text-slate-400 block mb-1">AUTORIZADO PARA RETIRAR:</span>
                     <span className="font-black text-purple-600 dark:text-purple-400 text-sm block">{p.retiroNombre}</span>
                     <span className="font-bold text-slate-500">C.I: {p.retiroCedula}</span>
                   </div>
                )}

                <div className="text-[11px] bg-slate-100 dark:bg-slate-800 p-3 rounded-xl whitespace-pre-wrap font-medium text-slate-600 dark:text-slate-300 mb-4 flex-grow border border-slate-200 dark:border-slate-700">
                   <div className="font-black mb-1 uppercase text-[9px] tracking-widest">Contenido del Paquete:</div>
                   {typeof p.productos === 'string' ? p.productos : JSON.stringify(p.productos)}
                </div>

                <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-700 flex flex-col gap-3">
                   {p.status === 'Despachado' ? (
                      <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-black text-xs uppercase tracking-widest py-3 rounded-xl flex justify-center items-center gap-2 border border-emerald-200 dark:border-emerald-800/50"><CheckCircle size={16}/> Procesado y Entregado</div>
                   ) : (
                      <>
                        <button onClick={()=>imprimirEtiqueta(p)} className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs hover:bg-slate-50 transition-colors"><Printer size={16}/> Imprimir Etiqueta</button>
                        
                        <label className={`font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs transition-colors cursor-pointer border-2 ${p.linkFotoProductos ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-500 dark:text-emerald-400' : 'bg-white border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 hover:border-purple-300'}`}>
                           {subiendoFotoId === p.id ? <Loader2 size={16} className="animate-spin"/> : p.linkFotoProductos ? <ImageIcon size={16}/> : <Camera size={16}/>}
                           {subiendoFotoId === p.id ? 'Subiendo...' : p.linkFotoProductos ? 'Foto Capturada' : 'Tomar / Subir Foto'}
                           <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e)=>subirFotoEntrega(e, p)} disabled={subiendoFotoId === p.id}/>
                        </label>

                        <button onClick={()=>marcarComoEntregado(p)} disabled={!p.linkFotoProductos || subiendoFotoId === p.id} className="bg-purple-600 hover:bg-purple-700 text-white font-black py-3 rounded-xl flex items-center justify-center gap-2 text-xs transition-colors shadow-md disabled:opacity-50 disabled:hover:bg-purple-600 uppercase tracking-widest"><CheckCircle size={16}/> Marcar Entregado</button>
                      </>
                   )}
                </div>
             </div>
          ))}
       </div>
    </div>
  );
}