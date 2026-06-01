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

  // 1. Filtrar primero los pedidos que corresponden a Recepción (Pilar de datos base)
  const pedidosRecepcionBase = useMemo(() => {
     return pedidos.filter(p => 
        ['Tienda', 'Delivery'].includes(p.tipoDespacho) && 
        !p.esPublico && 
        !['Anulado', 'Rechazado', 'Pendiente'].includes(p.status)
     );
  }, [pedidos]);

  // SECUENCIA NUMÉRICA BASADA SOLO EN LO VISIBLE DEL DÍA
  const numeracionDiaria = useMemo(() => {
    const map = {};
    const agrupados = {};
    
    const [year, month, day] = fechaFiltro.split('-');
    const fechaFiltroStr = `${day}/${month}/${year}`;

    // Filtramos la base solo por la fecha que estamos viendo
    const pedidosDelDia = pedidosRecepcionBase.filter(p => p.fechaDespacho === fechaFiltroStr);

    pedidosDelDia.forEach(p => {
       const tipo = p.tipoDespacho || 'Tienda'; 
       if (!agrupados[tipo]) agrupados[tipo] = [];
       agrupados[tipo].push(p);
    });

    // Ordenamos cronológicamente CADA TIPO por separado asegurando secuencias desde 1
    Object.keys(agrupados).forEach(tipo => {
       agrupados[tipo].sort((a, b) => (a.fechaCreacion || 0) - (b.fechaCreacion || 0));
       agrupados[tipo].forEach((p, index) => { 
          map[p.id] = index + 1; // Delivery 1, 2... Tienda 1, 2...
       });
    });

    return map;
  }, [pedidosRecepcionBase, fechaFiltro]);

  // Listado final aplicar filtros de búsqueda visual y tipo
  const listado = useMemo(() => {
     let filtrados = pedidosRecepcionBase;
     
     if (vista === 'pendientes') filtrados = filtrados.filter(p => p.status === 'Validado');
     if (vista === 'retiros') filtrados = filtrados.filter(p => p.status === 'Validado' && p.tipoDespacho === 'Tienda');
     if (vista === 'entregados') filtrados = filtrados.filter(p => p.status === 'Despachado');

     if (fechaFiltro) {
        const [year, month, day] = fechaFiltro.split('-');
        const fechaFiltroStr = `${day}/${month}/${year}`;
        filtrados = filtrados.filter(p => p.fechaDespacho === fechaFiltroStr);
     }

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
     return filtrados.sort((a, b) => (b.fechaCreacion || 0) - (a.fechaCreacion || 0));
  }, [pedidosRecepcionBase, vista, busqueda, fechaFiltro, tipoFiltro]);

  // Función robusta para calcular el monto (Evita N/A)
  const calcularMontoPedido = (p) => {
     if (p.total && !isNaN(p.total) && Number(p.total) > 0) return Number(p.total);
     if (p.montoTotal && !isNaN(p.montoTotal) && Number(p.montoTotal) > 0) return Number(p.montoTotal);
     
     let listaProductos = [];
     if (Array.isArray(p.productos)) {
        listaProductos = p.productos;
     } else if (typeof p.productos === 'string') {
        try {
           const parsed = JSON.parse(p.productos);
           if (Array.isArray(parsed)) listaProductos = parsed;
        } catch (e) {
           const regexMonto = /\$\s?(\d+(?:\.\d+)?)/g;
           let match;
           let sumaExtraida = 0;
           while ((match = regexMonto.exec(p.productos)) !== null) {
              sumaExtraida += parseFloat(match[1]);
           }
           if (sumaExtraida > 0) return sumaExtraida;
        }
     }

     if (listaProductos.length > 0) {
        return listaProductos.reduce((sum, prod) => {
           const precio = Number(prod.precio || prod.price || 0);
           const cant = Number(prod.cantidad || prod.qty || prod.quantity || 1);
           return sum + (precio * cant);
        }, 0);
     }
     
     return 0;
  };

  const imprimirEtiqueta = (p) => {
    const printWindow = window.open('', '_blank');
    if(!printWindow) return dialogs.alert("Permite las ventanas emergentes para imprimir.");
    const isDelivery = p.tipoDespacho === 'Delivery';
    const html = `<html><head><title>Etiqueta</title><style>body{font-family:Arial;padding:20px;width:350px;margin:auto;border:2px dashed #000;}h2{text-align:center;text-transform:uppercase;border-bottom:2px solid #000;padding-bottom:10px;}.box{background:#f0f0f0;padding:10px;text-align:center;margin:15px 0;}.products{font-size:12px;margin-top:15px;white-space:pre-wrap;border-top:1px dotted #000;padding-top:10px;}</style></head><body><h2>BLUHER - ${p.tipoDespacho} N°${numeracionDiaria[p.id] || '-'}</h2><div><strong>Cliente:</strong> ${p.clienteNombre}</div><div><strong>Tlf:</strong> ${p.clienteTelefono}</div>${isDelivery?`<div class="box"><strong>DELIVERY</strong><br/>${p.deliveryFecha} - ${p.deliveryHora}</div><div><strong>Dirección:</strong> ${p.direccion}</div>`:`<div class="box"><strong>RETIRO TIENDA</strong><br/>Retira: ${p.retiroNombre}</div>`} <div class="products"><strong>CONTENIDO:</strong><br/>${typeof p.productos === 'string' ? p.productos : JSON.stringify(p.productos)}</div></body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const subirFotoEntrega = async (e, pedido) => {
    const file = e.target.files[0];
    if (!file || !URL_GOOGLE_SCRIPT) return;
    setSubiendoFotoId(pedido.id);
    try {
      const base64Data = await compressImage(file, 800, 0.7);
      const response = await fetch(URL_GOOGLE_SCRIPT, { method: 'POST', body: JSON.stringify({ tokenSecreto: "BLUHER_SECURE_TOKEN_2026", fileName: `Recepcion_${pedido.id}.jpg`, mimeType: 'image/jpeg', data: base64Data }) });
      const result = await response.json();
      if (result.url) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', pedido.id), { linkFotoProductos: result.url });
    } catch(err) { console.error(err); } finally { setSubiendoFotoId(null); }
  };

  const marcarComoEntregado = async (pedido) => {
    if (!pedido.linkFotoProductos) return dialogs.alert("Toma la foto del producto primero.", "Foto Requerida");
    dialogs.confirm(`¿Confirmas que este paquete ha sido entregado?`, async () => {
       try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', pedido.id), { status: 'Despachado', fechaEntregaFisica: Date.now() });
       loggear('PAQUETE_ENTREGADO', `Recepción procesó la entrega de: ${pedido.clienteNombre}`);
       } catch(e) { console.error(e); }
    });
  };

  // FUNCIÓN DE CIERRE AUDITORÍA (Restaurada al 100%)
  const generarCierreAuditoria = async () => {
     const hoy = new Date().toLocaleDateString('es-VE');
     
     const entregadosHoy = pedidosRecepcionBase.filter(p => {
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

  // Renderizado de la tarjeta individual (Diseño 2 columnas y scroll interno)
  const renderTarjetaPedido = (p) => {
    const montoProductos = calcularMontoPedido(p);
    const montoDelivery = Number(p.montoDelivery || p.deliveryMonto || 0);
    const montoTotalCliente = montoProductos + (p.tipoDespacho === 'Delivery' ? montoDelivery : 0);

    const urlValidacion = p.linkComprobante || p.fotoPago || p.comprobantePago || "";
    const urlProducto = p.linkFotoProductos || "";
    const urlExtracto = p.linkExtracto || p.extractoBancario || p.fotoExtracto || "";

    return (
      <div key={p.id} className={`relative bg-slate-50 dark:bg-slate-800/50 p-5 rounded-3xl border-2 transition-all shadow-sm flex flex-col h-full ${p.status === 'Despachado' ? 'border-emerald-200 dark:border-emerald-800/50 opacity-80' : p.tipoDespacho === 'Delivery' ? 'border-fuchsia-200 dark:border-fuchsia-800/50' : 'border-purple-200 dark:border-purple-800/50'}`}>
                  
        {/* GLOBITO INDEPENDIENTE CORRECTO */}
        <div className="absolute -top-3 -left-3 bg-purple-600 text-white w-9 h-9 rounded-full flex items-center justify-center font-black border-2 border-white dark:border-slate-800 shadow-md text-lg">
          {numeracionDiaria[p.id] || '-'}
        </div>

        <div className="flex justify-between items-start mb-3 pl-5">
           <div className="flex-grow pr-2">
             <div className="text-base font-black text-slate-800 dark:text-slate-100 leading-tight break-words">{p.clienteNombre}</div>
             <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Tlf: {p.clienteTelefono}</div>
           </div>
           {p.tipoDespacho === 'Delivery' ? (
              <span className="bg-fuchsia-100 text-fuchsia-700 px-2 py-1 rounded-lg flex items-center gap-1 text-[10px] font-black uppercase flex-shrink-0"><Bike size={12}/> Delivery</span>
           ) : (
              <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-lg flex items-center gap-1 text-[10px] font-black uppercase flex-shrink-0"><Store size={12}/> Tienda</span>
           )}
        </div>

        {p.tipoDespacho === 'Delivery' ? (
           <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 mb-2 text-xs">
             <span className="font-black text-fuchsia-600 dark:text-fuchsia-400">{p.deliveryFecha} a las {p.deliveryHora}</span>
           </div>
        ) : (
           <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 mb-2 text-xs">
             <span className="font-black text-purple-600 dark:text-purple-400 block break-words">{p.retiroNombre}</span>
             <span className="font-bold text-slate-500">C.I: {p.retiroCedula}</span>
           </div>
        )}

        {/* Bloque Montos Correctos y Dirección */}
        <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 mb-3 text-xs space-y-1">
           <div className="flex justify-between"><strong>Monto Pedido:</strong> <span className="text-slate-700 dark:text-slate-300 font-bold">${montoProductos.toFixed(2)}</span></div>
           {p.tipoDespacho === 'Delivery' && (
              <div className="flex justify-between"><strong>Monto Delivery:</strong> <span className="text-fuchsia-600 dark:text-fuchsia-400 font-bold">${montoDelivery.toFixed(2)}</span></div>
           )}
           <div className="border-t border-slate-200 dark:border-slate-600 pt-1 flex justify-between">
              <strong>Total a Cobrar:</strong> <span className="text-emerald-600 dark:text-emerald-400 font-black text-sm">${montoTotalCliente.toFixed(2)}</span>
           </div>
           <div className="pt-1 text-[11px] text-slate-600 dark:text-slate-400 break-words line-clamp-2"><strong>Dir:</strong> {p.direccion || 'Retiro en Tienda'}</div>
        </div>

        {/* Contenido del Paquete con altura limitada (Scroll) para hacer tarjeta cuadrada */}
        <div className="text-[11px] bg-white dark:bg-slate-900 p-3 rounded-xl whitespace-pre-wrap font-medium text-slate-600 dark:text-slate-300 mb-3 border border-slate-200 dark:border-slate-700 max-h-32 overflow-y-auto min-h-[60px]">
           <div className="font-black mb-1 uppercase text-[9px] tracking-widest text-slate-400">Contenido:</div>
           {typeof p.productos === 'string' ? p.productos : JSON.stringify(p.productos)}
        </div>

        {/* Miniaturas protegidas (Solo renders válidos) */}
        <div className="flex flex-wrap gap-2.5 mb-4 bg-white dark:bg-slate-950 p-2 rounded-xl border border-slate-100 dark:border-slate-800/60 justify-center">
           {[ {url: urlValidacion, txt: 'Pago'}, {url: urlExtracto, txt: 'Extracto'}, {url: urlProducto, txt: 'Producto'} ].map(img => (
              (typeof img.url === 'string' && img.url.startsWith('http')) && (
                 <div key={img.txt} className="flex flex-col items-center gap-0.5">
                    <span className="text-[8px] font-black text-slate-400 uppercase">{img.txt}</span>
                    <a href={img.url} target="_blank" rel="noreferrer" className="block w-11 h-11 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 hover:scale-105 transition-all shadow-sm">
                       <img src={img.url} alt={img.txt} className="w-full h-full object-cover" onError={(e)=>{e.target.parentNode.style.display='none'}}/>
                    </a>
                 </div>
              )
           ))}
        </div>

        <div className="mt-auto pt-3 border-t border-slate-200 dark:border-slate-700 flex flex-col gap-2.5">
           {p.status === 'Despachado' ? (
              <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-black text-xs uppercase py-2.5 rounded-xl flex justify-center items-center gap-2 border border-emerald-200 dark:border-emerald-800/50"><CheckCircle size={15}/> Entregado</div>
           ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                   <button onClick={()=>imprimirEtiqueta(p)} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 text-xs hover:bg-slate-50 transition-colors"><Printer size={14}/> Etiqueta</button>
                   <label className={`font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 text-xs transition-colors cursor-pointer border ${p.linkFotoProductos ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-900/30' : 'bg-white border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'}`}>
                      {subiendoFotoId === p.id ? <Loader2 size={14} className="animate-spin"/> : <Camera size={14}/>}
                      {p.linkFotoProductos ? 'Foto OK' : 'Subir Foto'}
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e)=>subirFotoEntrega(e, p)} disabled={subiendoFotoId === p.id}/>
                   </label>
                </div>
                <button onClick={()=>marcarComoEntregado(p)} disabled={!p.linkFotoProductos || subiendoFotoId === p.id} className="bg-purple-600 hover:bg-purple-700 text-white font-black py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs transition-colors shadow-md disabled:opacity-50 uppercase tracking-widest"><CheckCircle size={15}/> Marcar Entregado</button>
              </>
           )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-700 transition-colors animate-in fade-in">
       
       {/* Cabecera */}
       <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4 border-b border-slate-100 dark:border-slate-700 pb-5">
         <div>
            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2.5"><Package className="text-purple-600" /> Recepción Bluher</h2>
         </div>
         <div className="flex flex-wrap gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
           {['pendientes', 'retiros', 'entregados'].map(v => (
              <button key={v} onClick={()=>setVista(v)} className={`px-3 py-2 text-xs font-bold rounded-lg transition-all ${vista===v?'bg-white dark:bg-slate-700 shadow text-purple-700 dark:text-purple-400':'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>{v === 'pendientes' ? 'Todos Pendientes' : v === 'retiros' ? 'Por Retirar' : 'Historial'}</button>
           ))}
         </div>
       </div>

       {/* Barra Filtros */}
       <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="relative md:col-span-2">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
             <input type="text" placeholder="Buscar cliente..." className="w-full pl-9 pr-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm font-bold outline-none focus:border-purple-500" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
          <input type="date" value={fechaFiltro} onChange={(e)=>setFechaFiltro(e.target.value)} className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm font-bold" />
          <select value={tipoFiltro} onChange={(e)=>setTipoFiltro(e.target.value)} className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm font-bold cursor-pointer">
             <option value="Todos">Todos</option>
             <option value="Tienda">Tienda</option>
             <option value="Delivery">Delivery</option>
          </select>
       </div>

       {/* GRILLA PRINCIPAL REVISADA (lg:grid-cols-2 para 2 por fila) */}
       {listado.length === 0 ? (
          <div className="p-10 text-center text-slate-400 font-bold border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl">No hay paquetes para mostrar.</div>
       ) : vista === 'entregados' ? (
          <div className="space-y-8">
             {/* 1. TIENDA ASCENDENTE */}
             <div>
                <div className="mb-3 border-b border-purple-100 dark:border-purple-800 pb-1 flex items-center gap-2 text-purple-700 dark:text-purple-400">
                   <Store size={18} /><h3 className="text-lg font-black">Entregas en Tienda</h3>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                   {listado.filter(p => p.tipoDespacho === 'Tienda').sort((a, b) => (a.fechaCreacion || 0) - (b.fechaCreacion || 0)).map(p => renderTarjetaPedido(p))}
                </div>
             </div>
             {/* 2. DELIVERY ASCENDENTE */}
             <div>
                <div className="mb-3 border-b border-fuchsia-100 dark:border-fuchsia-800 pb-1 flex items-center gap-2 text-fuchsia-700 dark:text-fuchsia-400">
                   <Bike size={18} /><h3 className="text-lg font-black">Deliverys</h3>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                   {listado.filter(p => p.tipoDespacho === 'Delivery').sort((a, b) => (a.fechaCreacion || 0) - (b.fechaCreacion || 0)).map(p => renderTarjetaPedido(p))}
                </div>
             </div>
          </div>
       ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
             {listado.map(p => renderTarjetaPedido(p))}
          </div>
       )}
    </div>
  );
}