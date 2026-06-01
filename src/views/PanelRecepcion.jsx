import React, { useState, useMemo } from 'react';
import { Store, Bike, Package, Printer, Camera, CheckCircle, Search, FileDown, Loader2, Image as ImageIcon } from 'lucide-react';
import { updateDoc, doc, addDoc, collection } from 'firebase/firestore';
import { URL_GOOGLE_SCRIPT } from '../config/firebase';
import { compressImage } from '../utils/image';
import { BRAND_LOGO } from '../config/constants';

export default function PanelRecepcion({ pedidos, perfil, db, appId, loggear, dialogs }) {
  const getHoyISO = () => {
    const d = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Caracas"}));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const [busqueda, setBusqueda] = useState('');
  const [fechaFiltro, setFechaFiltro] = useState(getHoyISO());
  const [tipoFiltro, setTipoFiltro] = useState('Todos'); // 'Todos' | 'Delivery' | 'Tienda'
  const [subiendoFotoId, setSubiendoFotoId] = useState(null);
  const [vista, setVista] = useState('pendientes'); // 'pendientes' | 'retiros' | 'entregados'

  // LÓGICA DE NUMERACIÓN (Independiente por Tipo de Despacho y Fecha)
  const numeracionDiaria = useMemo(() => {
    const map = {};
    const agrupados = {};
    pedidos.forEach(p => {
       const fecha = p.fechaDespacho || 'Sin Fecha';
       const tipo = p.tipoDespacho || 'Nacional'; // Nacional, Tienda o Delivery
       // La clave combina fecha y tipo, haciendo que las secuencias sean independientes
       const key = `${fecha}_${tipo}`;
       
       if (!agrupados[key]) agrupados[key] = [];
       agrupados[key].push(p);
    });
    Object.keys(agrupados).forEach(key => {
       agrupados[key].sort((a, b) => a.fechaCreacion - b.fechaCreacion);
       agrupados[key].forEach((p, index) => { map[p.id] = index + 1; });
    });
    return map;
  }, [pedidos]);

  // Filtrar solo pedidos que corresponden a Recepción y están pagados/validados
  const pedidosRecepcion = useMemo(() => {
     return pedidos.filter(p => 
        ['Tienda', 'Delivery'].includes(p.tipoDespacho) && 
        !p.esPublico && 
        !['Anulado', 'Rechazado', 'Pendiente'].includes(p.status)
     ).sort((a, b) => b.fechaCreacion - a.fechaCreacion);
  }, [pedidos]);

  // Sub-clasificaciones con los filtros
  const listado = useMemo(() => {
     let filtrados = pedidosRecepcion;
     
     if (vista === 'pendientes') filtrados = filtrados.filter(p => p.status === 'Validado');
     if (vista === 'retiros') filtrados = filtrados.filter(p => p.status === 'Validado' && p.tipoDespacho === 'Tienda');
     if (vista === 'entregados') filtrados = filtrados.filter(p => p.status === 'Despachado');

     // Filtro de Fecha
     if (fechaFiltro) {
        const [year, month, day] = fechaFiltro.split('-');
        const fechaFiltroStr = `${day}/${month}/${year}`;
        filtrados = filtrados.filter(p => p.fechaDespacho === fechaFiltroStr);
     }

     // Filtro de Tipo de Recepción
     if (tipoFiltro !== 'Todos') {
        filtrados = filtrados.filter(p => p.tipoDespacho === tipoFiltro);
     }

     if (busqueda.trim()) {
        const b = busqueda.toLowerCase();
        filtrados = filtrados.filter(p => 
           String(p.clienteNombre || '').toLowerCase().includes(b) || 
           String(p.retiroNombre || '').toLowerCase().includes(b)
        );
     }
     return filtrados;
  }, [pedidosRecepcion, vista, busqueda, fechaFiltro, tipoFiltro]);

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
          <h2>BLUHER - ${p.tipoDespacho} N°${numeracionDiaria[p.id]}</h2>
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

  const generarCierreAuditoria = async () => {
     const hoy = new Date().toLocaleDateString('es-VE');
     
     const entregadosHoy = pedidosRecepcion.filter(p => {
        if (p.status !== 'Despachado') return false;
        const fechaReal = p.fechaEntregaFisica ? new Date(p.fechaEntregaFisica) : new Date(p.fechaCreacion);
        return fechaReal.toLocaleDateString('es-VE') === hoy;
     });
     
     if (entregadosHoy.length === 0) {
        return dialogs.alert("No hay paquetes procesados el día de hoy para generar un cierre.", "Sin Movimientos");
     }

     dialogs.confirm(`Se generará un cierre en el sistema con los ${entregadosHoy.length} paquetes entregados hoy. ¿Deseas continuar?`, async () => {
         try {
             const resumenPaquetes = entregadosHoy.map(p => ({
                 idPedido: p.id,
                 cliente: p.clienteNombre,
                 tipo: p.tipoDespacho,
                 asesora: p.asesora,
                 fotoGuardada: !!p.linkFotoProductos,
                 hora: new Date(p.fechaEntregaFisica || p.fechaCreacion).toLocaleTimeString('es-VE')
             }));

             const nuevoCierre = {
                 fecha: hoy,
                 timestamp: Date.now(),
                 creadoPor: perfil?.nombre || 'Recepcionista',
                 totalEntregas: entregadosHoy.length,
                 entregas: resumenPaquetes
             };

             await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'cierres_recepcion'), nuevoCierre);
             loggear('CIERRE_RECEPCION', `Se registró el cierre diario de Recepción con ${entregadosHoy.length} entregas.`);

             const printWindow = window.open('', '_blank');
             // ... [Código HTML del cierre se mantiene igual] ...
             let html = `
              <html>
                <head>
                  <style>
                     @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
                     body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; max-width: 900px; margin: 0 auto; }
                     .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #9333ea; padding-bottom: 20px; margin-bottom: 20px; }
                     .logo { height: 60px; object-fit: contain; }
                     h1 { color: #0f172a; font-weight: 900; margin: 0; font-size: 24px; text-transform: uppercase; }
                     .meta { background: #faf5ff; padding: 15px; border-radius: 8px; border: 1px solid #e9d5ff; margin-bottom: 30px; font-size: 14px;}
                     table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
                     th, td { border-bottom: 1px solid #e2e8f0; padding: 12px; text-align: left; }
                     th { background: #f8fafc; color: #475569; font-weight: 700; text-transform: uppercase; font-size: 11px; }
                     .badge { background: #dcfce7; color: #166534; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; }
                  </style>
                </head>
                <body>
                  <div class="header">
                    <div>
                      <h1>Auditoría de Recepción</h1>
                      <p style="color: #64748b; margin-top: 5px; font-size: 14px; font-weight: bold;">Cierre Diario Oficial</p>
                    </div>
                    <img src="${BRAND_LOGO}" class="logo" alt="Bluher Logo"/>
                  </div>
                  
                  <div class="meta">
                     <p style="margin:0 0 8px 0;"><strong>Fecha de Cierre:</strong> ${hoy}</p>
                     <p style="margin:0 0 8px 0;"><strong>Operador Responsable:</strong> ${perfil?.nombre || 'Recepcionista'}</p>
                     <p style="margin:0; font-size: 16px;"><strong>Total Paquetes Procesados:</strong> <span style="color:#9333ea; font-weight:900;">${entregadosHoy.length}</span></p>
                  </div>

                  <table>
                     <tr><th>Cliente</th><th>Tipo Despacho</th><th>Asesora</th><th>Hora Entrega</th><th>Soporte</th></tr>
                     ${entregadosHoy.map(p => `
                        <tr>
                           <td><strong>${p.clienteNombre}</strong></td>
                           <td style="font-weight:bold; color: #7e22ce;">${p.tipo}</td>
                           <td>${p.asesora}</td>
                           <td>${p.hora}</td>
                           <td>${p.fotoGuardada ? '<span class="badge">Foto Ok</span>' : 'Sin Foto'}</td>
                        </tr>
                     `).join('')}
                  </table>

                  <div style="margin-top: 80px; text-align: center; border-top: 1px solid #cbd5e1; padding-top: 20px;">
                      <p style="margin-bottom: 50px;">Firma del Encargado / Auditor</p>
                      <p>_____________________________________</p>
                  </div>
                </body>
              </html>
             `;
             printWindow.document.write(html);
             printWindow.document.close();
             setTimeout(() => printWindow.print(), 1000);

         } catch (error) {
             console.error(error);
             dialogs.alert("Ocurrió un error al guardar el cierre en la base de datos.");
         }
     }, "Confirmar Cierre Diario");
  };

  // Extraemos el renderizado de la tarjeta para reutilizarlo en las divisiones
  const renderTarjetaPedido = (p) => (
    <div key={p.id} className={`relative bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border-2 transition-all shadow-sm flex flex-col h-full ${p.status === 'Despachado' ? 'border-emerald-200 dark:border-emerald-800/50 opacity-80' : p.tipoDespacho === 'Delivery' ? 'border-fuchsia-200 dark:border-fuchsia-800/50 hover:border-fuchsia-400' : 'border-purple-200 dark:border-purple-800/50 hover:border-purple-400'}`}>
                
      <div className="absolute -top-3 -left-3 bg-purple-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-black border-2 border-white dark:border-slate-800 shadow-md">
        {numeracionDiaria[p.id]}
      </div>

      <div className="flex justify-between items-start mb-4 pl-4">
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
         <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 mb-2 text-xs">
           <span className="font-bold text-slate-400 block mb-1">PROGRAMADO PARA:</span>
           <span className="font-black text-fuchsia-600 dark:text-fuchsia-400 text-sm">{p.deliveryFecha} a las {p.deliveryHora}</span>
         </div>
      ) : (
         <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 mb-2 text-xs">
           <span className="font-bold text-slate-400 block mb-1">AUTORIZADO PARA RETIRAR:</span>
           <span className="font-black text-purple-600 dark:text-purple-400 text-sm block">{p.retiroNombre}</span>
           <span className="font-bold text-slate-500">C.I: {p.retiroCedula}</span>
         </div>
      )}

      {/* NUEVO: Dirección y Monto para Todos */}
      <div className="bg-slate-100 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 mb-4 text-xs">
         <div className="mb-1"><strong>Monto Pagado:</strong> <span className="text-emerald-600 dark:text-emerald-400 font-bold ml-1">{p.total || p.montoTotal ? `$${p.total || p.montoTotal}` : 'N/A'}</span></div>
         <div><strong className="text-slate-500">Dirección:</strong> <span className="text-slate-600 dark:text-slate-300 ml-1">{p.direccion || 'No especificada / Retiro'}</span></div>
      </div>

      <div className="text-[11px] bg-slate-100 dark:bg-slate-800 p-3 rounded-xl whitespace-pre-wrap font-medium text-slate-600 dark:text-slate-300 mb-4 flex-grow border border-slate-200 dark:border-slate-700">
         <div className="font-black mb-1 uppercase text-[9px] tracking-widest">Contenido del Paquete:</div>
         {typeof p.productos === 'string' ? p.productos : JSON.stringify(p.productos)}
      </div>

      {/* NUEVO: Accesos en miniatura */}
      <div className="flex gap-4 mb-4">
         {(p.linkComprobante || p.fotoPago || p.comprobantePago) && (
           <div className="flex flex-col items-center gap-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Validación</span>
              <a href={p.linkComprobante || p.fotoPago || p.comprobantePago} target="_blank" rel="noreferrer" className="block w-14 h-14 overflow-hidden rounded-lg border-2 border-slate-200 dark:border-slate-700 hover:border-purple-400 transition-all shadow-sm">
                 <img src={p.linkComprobante || p.fotoPago || p.comprobantePago} alt="Validación" className="w-full h-full object-cover"/>
              </a>
           </div>
         )}
         {p.linkFotoProductos && (
           <div className="flex flex-col items-center gap-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Producto</span>
              <a href={p.linkFotoProductos} target="_blank" rel="noreferrer" className="block w-14 h-14 overflow-hidden rounded-lg border-2 border-slate-200 dark:border-slate-700 hover:border-emerald-400 transition-all shadow-sm">
                 <img src={p.linkFotoProductos} alt="Producto" className="w-full h-full object-cover"/>
              </a>
           </div>
         )}
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
  );

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

       {/* BARRA DE BÚSQUEDA Y NUEVOS FILTROS */}
       <div className="flex flex-col md:flex-row gap-4 mb-6 justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="flex flex-col md:flex-row gap-3 w-full md:w-2/3">
             <div className="relative w-full md:w-1/2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                <input type="text" placeholder="Buscar por cliente o autorizado..." className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm font-bold outline-none focus:border-purple-500 transition-colors" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
             </div>
             <div className="relative w-full md:w-1/4">
                <input type="date" value={fechaFiltro} onChange={(e)=>setFechaFiltro(e.target.value)} className="w-full p-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm font-bold outline-none focus:border-purple-500 transition-colors" />
             </div>
             <div className="relative w-full md:w-1/4">
                <select value={tipoFiltro} onChange={(e)=>setTipoFiltro(e.target.value)} className="w-full p-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm font-bold outline-none focus:border-purple-500 transition-colors cursor-pointer">
                   <option value="Todos">Todos (Tipos)</option>
                   <option value="Tienda">Solo Tienda</option>
                   <option value="Delivery">Solo Delivery</option>
                </select>
             </div>
          </div>
          
          <button onClick={generarCierreAuditoria} className="bg-slate-800 text-white px-5 py-3 rounded-xl font-bold text-sm shadow-md hover:bg-slate-700 flex items-center gap-2 transition-colors w-full md:w-auto justify-center"><FileDown size={18}/> Cierre Auditable Diario</button>
       </div>

       {/* RENDERIZADO CONDICIONAL DE LA GRILLA SEGÚN LA VISTA */}
       {listado.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-bold border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl">No hay paquetes para la fecha y filtros seleccionados.</div>
       ) : vista === 'entregados' ? (
          <>
             {/* SECCIÓN ENTREGADOS: ORDENADOS DE FORMA ASCENDENTE Y SEPARADOS */}
             
             {/* 1. ENTREGAS EN TIENDA */}
             <div className="mb-4 border-b-2 border-purple-200 dark:border-purple-800/50 pb-2 flex items-center gap-2">
                <Store className="text-purple-600" />
                <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">Entregas en Tienda</h3>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {listado
                   .filter(p => p.tipoDespacho === 'Tienda')
                   .sort((a, b) => a.fechaCreacion - b.fechaCreacion) // Ascendente
                   .map(p => renderTarjetaPedido(p))}
             </div>

             {/* 2. DELIVERYS */}
             <div className="mb-4 border-b-2 border-fuchsia-200 dark:border-fuchsia-800/50 pb-2 flex items-center gap-2">
                <Bike className="text-fuchsia-600" />
                <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">Deliverys</h3>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {listado
                   .filter(p => p.tipoDespacho === 'Delivery')
                   .sort((a, b) => a.fechaCreacion - b.fechaCreacion) // Ascendente
                   .map(p => renderTarjetaPedido(p))}
             </div>
          </>
       ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {listado.map(p => renderTarjetaPedido(p))}
          </div>
       )}
    </div>
  );
}