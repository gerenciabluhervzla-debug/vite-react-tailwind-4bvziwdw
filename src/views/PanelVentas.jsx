import React, { useState, useEffect } from 'react';
import { ShoppingCart, ClipboardList, Clock, Store, Link, AlertTriangle, Sparkles, Loader2, Gift, Package, Search, CheckCircle, FileText, XCircle, MessageCircle, ShieldCheck, Percent } from 'lucide-react';
import { Input, InputDark, StatusBadge } from '../components/ui';
import ModalCatalogo from '../components/modals/ModalCatalogo';
import { updateDoc, doc, addDoc, collection } from 'firebase/firestore';
import { GEMINI_API_KEY } from '../config/firebase';
import { ROLES } from '../config/constants';

export default function PanelVentas({ perfil, pedidos, catalogo, stock, config, db, appId, loggear, dialogs, cambiarEstadoPedido }) {
  const puedeCrear = [ROLES.ADMIN, ROLES.VENTAS].includes(perfil?.role);
  const [vista, setVista] = useState(puedeCrear ? 'nuevo' : 'historial'); 
  
  const defaultForm = { clienteNombre: '', clienteCedula: '', clienteTelefono: '', courier: 'ZOOM', direccion: '', productos: '', carritoObj: null, asesora: perfil?.nombre || '', referencia: '', moneda: 'USD', montoPago: '0', tasa: config.tasaDia || '1', esMercadoLibre: false, esRegalo: false, descuentoPorcentaje: '0', pagoAdicional: '', refAdicional: '' };
  
  const [formData, setFormData] = useState(defaultForm);
  const [editId, setEditId] = useState(null); 
  const [pedidoDevuelto, setPedidoDevuelto] = useState(null); 
  const [enviando, setEnviando] = useState(false);
  const [textoCrudo, setTextoCrudo] = useState('');
  const [analizando, setAnalizando] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);

  const pedidosWeb = pedidos.filter(p => p.esPublico && p.status === 'Por Pagar / Cotización');
  const enEspera = pedidos.filter(p => p.status === 'En Espera (Sin Stock)');

  const fechaHoy = new Date().toLocaleDateString('es-VE');
  const tasaActualizadaHoy = config.ultimaActualizacion === fechaHoy;

  // --- COMPROBACIÓN DE DESCUENTO GLOBAL ---
  const hoyTimestamp = new Date().getTime();
  const isGlobalDiscountActive = config?.descuentoGlobalActivo &&
     config?.descuentoGlobalPorcentaje > 0 &&
     config?.descuentoGlobalInicio && config?.descuentoGlobalFin &&
     hoyTimestamp >= new Date(config.descuentoGlobalInicio + 'T00:00:00').getTime() &&
     hoyTimestamp <= new Date(config.descuentoGlobalFin + 'T23:59:59').getTime();

  const globalDiscountPercent = isGlobalDiscountActive ? parseFloat(config.descuentoGlobalPorcentaje) : 0;

  useEffect(() => {
    if (!formData.carritoObj) return;
    let sub = 0;
    Object.entries(formData.carritoObj).forEach(([key, qty]) => {
      const [n, p] = key.split('|');
      catalogo.forEach(cat => cat.productos.forEach(prod => { if(prod.nombre===n){ const i=prod.presentaciones.indexOf(p); if (i >= 0 && prod.precios) sub += (prod.precios[i]*qty); }}));
    });
    
    // Aplicamos primero la campaña global al subtotal
    const subConCampaña = sub * (1 - globalDiscountPercent / 100);
    // Luego aplicamos el descuento extra del asesor si es que dio uno
    const dExtra = parseFloat(formData.descuentoPorcentaje) || 0;
    const final = subConCampaña * (1 - dExtra / 100);
    
    setFormData(prev => ({ ...prev, montoPago: final.toFixed(2), tasa: prev.tasa || config.tasaDia }));
  }, [formData.carritoObj, formData.descuentoPorcentaje, config.tasaDia, catalogo, globalDiscountPercent]);

  const copiarLinkTienda = () => {
    const linkTienda = `${window.location.origin}${window.location.pathname}#tienda`;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(linkTienda)
        .then(() => dialogs.alert(`Enlace copiado al portapapeles:\n\n${linkTienda}`, "Enlace Copiado"))
        .catch(() => dialogs.alert("Copia manual:\n" + linkTienda, "Enlace"));
    } else {
      dialogs.alert("Copia manual:\n" + linkTienda, "Enlace");
    }
  };

  const analizarConGemini = async () => {
    if (!textoCrudo.trim()) return dialogs.alert("Pega el mensaje de WhatsApp del cliente primero.", "Mensaje Vacío");
    setAnalizando(true);

    try {
      const llavesCatalogo = catalogo.flatMap(c => c.productos.flatMap(p => p.presentaciones.map(pres => `${p.nombre}|${pres}`))).join(', ');
      const prompt = `Analiza este WhatsApp y extrae JSON: Nombre, Teléfono, Cédula, courier (ZOOM, MRW, Tealca, Domesa), Dirección, Productos, montoPago, Tipo de envío (si dice "MercadoLibre", esMercadoLibre=true), asesora. Si hay descuento con flecha 18$ ➜ 13$, precio a cobrar es 13.
      productosCrudos: texto exacto.
      carrito: mapea cantidades a estas llaves: [${llavesCatalogo}].
      Texto: ${textoCrudo}`;
      
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                clienteNombre: { type: "STRING" }, clienteCedula: { type: "STRING" }, clienteTelefono: { type: "STRING" },
                courier: { type: "STRING" }, direccion: { type: "STRING" }, montoPago: { type: "STRING" }, moneda: { type: "STRING" }, referencia: { type: "STRING" }, asesora: { type: "STRING" }, productosCrudos: { type: "STRING" }, tasa: { type: "STRING" }, esMercadoLibre: { type: "BOOLEAN" },
                carrito: { type: "ARRAY", items: { type: "OBJECT", properties: { llave: { type: "STRING" }, cantidad: { type: "INTEGER" } } } }
              }
            }
          }
        })
      });

      const resultData = await res.json();
      if (resultData?.candidates?.[0]?.content?.parts?.[0]?.text) {
         const result = JSON.parse(resultData.candidates[0].content.parts[0].text);
         let nuevoCarritoObj = {}; let txtFormat = result.productosCrudos || '';

         if (result.carrito && result.carrito.length > 0) {
           const lineas = [];
           result.carrito.forEach(item => {
             if (item.llave && item.cantidad) { nuevoCarritoObj[item.llave] = item.cantidad; lineas.push(`- ${item.cantidad}x ${item.llave.replace('|', ' ')}`); }
           });
           if (lineas.length > 0) txtFormat = lineas.join('\n');
         }

         setFormData(prev => ({ 
           ...prev, 
           ...result, 
           tasa: result.tasa || prev.tasa,
           esMercadoLibre: result.esMercadoLibre || false,
           productos: txtFormat || prev.productos, 
           carritoObj: Object.keys(nuevoCarritoObj).length > 0 ? nuevoCarritoObj : prev.carritoObj 
         }));
      }
    } catch(e) { console.error(e); dialogs.alert("Error comunicando con IA. Ingresa manual.", "Error"); } finally { setAnalizando(false); }
  };

  const cargarPedidoParaEditar = (pedido) => {
    setFormData({
      clienteNombre: pedido.clienteNombre, clienteCedula: pedido.clienteCedula, clienteTelefono: pedido.clienteTelefono, courier: pedido.courier, direccion: pedido.direccion,
      productos: typeof pedido.productos === 'string' ? pedido.productos : JSON.stringify(pedido.productos), carritoObj: pedido.carritoObj, asesora: pedido.asesora, referencia: pedido.referencia, moneda: pedido.moneda, 
      montoPago: pedido.monto?.toString() || '0', tasa: pedido.tasaAplicada?.toString() || config.tasaDia, esMercadoLibre: pedido.esMercadoLibre || false, esRegalo: pedido.esRegalo || false, descuentoPorcentaje: pedido.descuentoPorcentaje?.toString() || '0', pagoAdicional: '', refAdicional: ''
    });
    setEditId(pedido.id);
    setPedidoDevuelto(pedido);
    setVista('nuevo');
  };

  const cancelarEdicion = () => {
    setFormData(defaultForm);
    setEditId(null);
    setPedidoDevuelto(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tasaActualizadaHoy && !editId) return dialogs.alert("NO puedes registrar ventas nuevas porque la Tasa del Día no ha sido actualizada hoy por Administración.", "Tasa Desactualizada");
    if (!formData.carritoObj || Object.keys(formData.carritoObj).length === 0) return dialogs.alert("Debes seleccionar productos del Catálogo Visual.", "Carrito Vacío");
    if (!formData.esRegalo && (!formData.tasa || parseFloat(formData.tasa) <= 0)) return dialogs.alert("Por favor ingresa la tasa de cambio aplicada.", "Datos Faltantes");
    
    let sinStock = false;
    let itemsFaltantes = [];
    Object.entries(formData.carritoObj).forEach(([key, qty]) => {
      let maxDisp = typeof stock[key] === 'object' ? stock[key].envios : (stock[key]||0);
      if (qty > maxDisp) {
        sinStock = true;
        itemsFaltantes.push(key.replace('|', ' '));
      }
    });

    if (sinStock) {
      dialogs.confirm(`Falta stock en almacén de envíos para:\n\n${itemsFaltantes.join('\n')}\n\n¿Guardar en la "Lista de Espera" para procesar luego?`, () => {
        procesarVenta('En Espera (Sin Stock)');
      }, "Stock Insuficiente");
      return;
    }

    procesarVenta('Pendiente');
  };

  const procesarVenta = async (finalStatus) => {
    setEnviando(true);
    let montoNum = formData.esRegalo ? 0 : (parseFloat(formData.montoPago) || 0);
    const tasa = parseFloat(formData.tasa) || 1;
    let descuento = parseFloat(formData.descuentoPorcentaje) || 0;
    let pagoExtUsd = 0;

    if (editId && pedidoDevuelto?.faltanteUsd > 0 && formData.pagoAdicional) {
      let extra = parseFloat(formData.pagoAdicional) || 0;
      pagoExtUsd = formData.moneda === 'VES' ? extra / tasa : extra;
      montoNum += extra;
    }

    let calculo = { usd: 0, ves: 0 };
    if (!formData.esRegalo) {
       calculo = formData.moneda === 'USD' ? { usd: montoNum, ves: montoNum * tasa } : { ves: montoNum, usd: tasa > 0 ? montoNum / tasa : 0 };
    }

    let finalCarrito = { ...formData.carritoObj };
    let finalProductosText = formData.productos || '';
    let countBoosters = 0;
    const boosterKeys = ["Booster de Hidratacion|Unidad", "Booster de Reparacion|Unidad", "Booster de Nutricion|Unidad", "Booster Profesional|Unidad"];

    Object.entries(finalCarrito).forEach(([key, qty]) => { if (boosterKeys.includes(key)) countBoosters += qty; });

    if (countBoosters > 0) {
      finalCarrito["Concentrado|Unidad"] = (finalCarrito["Concentrado|Unidad"] || 0) + countBoosters;
      if (!finalProductosText.includes("Concentrado (Unidad)")) finalProductosText += `\n- ${countBoosters}x Concentrado (Unidad) [Auto]`;
    }

    const targetDate = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Caracas"}));
    if (targetDate.getHours() > 12 || (targetDate.getHours() === 12 && targetDate.getMinutes() >= 30)) {
       targetDate.setDate(targetDate.getDate() + 1);
    }
    const fechaDespachoStr = targetDate.toLocaleDateString('es-VE');

    try {
      if (editId) {
        let updateData = {
          ...formData, productos: finalProductosText, carritoObj: finalCarrito, monto: montoNum, montoUsd: calculo.usd, montoVes: calculo.ves, tasaAplicada: tasa, status: finalStatus, motivoRechazo: '', faltanteUsd: 0, descuentoPorcentaje: descuento 
        };
        // Si al momento de corregir hay campaña activa, guardamos el dato
        if (globalDiscountPercent > 0) updateData.descuentoGlobalAplicado = globalDiscountPercent;

        if (formData.refAdicional) {
           updateData.referencia = `${formData.referencia} | EXTRA: ${formData.refAdicional}`;
           updateData.pagoAdicionalUsd = pagoExtUsd;
        }

        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', editId), updateData);
        loggear('PEDIDO_CORREGIDO', `Corregido pedido de ${formData.clienteNombre}`);
        dialogs.alert(`Actualizado con éxito.`, "Aviso");
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'pedidos'), {
          ...formData, productos: finalProductosText, carritoObj: finalCarrito, monto: montoNum, montoUsd: calculo.usd, montoVes: calculo.ves, tasaAplicada: tasa, status: finalStatus, auditado: false, fechaCreacion: Date.now(), fechaDespacho: fechaDespachoStr, esPublico: false, descuentoPorcentaje: descuento,
          descuentoGlobalAplicado: globalDiscountPercent // <-- Marcamos que fue impactado por la campaña
        });
        loggear('PEDIDO_CREADO', `Venta: ${formData.clienteNombre} ($${calculo.usd.toFixed(2)})`);
        dialogs.alert(finalStatus === 'Pendiente' ? `Venta registrada. Despacho pautado: ${fechaDespachoStr}` : `Guardado en Lista de Espera.`, "Aviso");
      }
      
      cancelarEdicion();
      setVista('historial');
    } catch (e) { console.error(e); dialogs.alert("Error de guardado.", "Error"); }
    setEnviando(false);
  };

  const enviarWhatsApp = (pedido) => {
    const mensaje = `Hola ${pedido.clienteNombre}, tu pedido Bluher ha sido enviado por *${pedido.courier}*.%0A%0A*Guía:* ${pedido.guia}%0A%0A${pedido.linkGuia ? `Recibo: ${pedido.linkGuia}%0A` : ''}${pedido.linkFotoProductos ? `Paquete: ${pedido.linkFotoProductos}%0A` : ''}%0A¡Gracias por tu compra!`;
    const cleanPhone = String(pedido.clienteTelefono).replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${mensaje}`, '_blank');
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border dark:border-slate-700 transition-colors shadow-sm">
      <div className="flex flex-wrap gap-4 mb-8 border-b dark:border-slate-700 pb-2 overflow-x-auto">
        {puedeCrear && <button onClick={() => { setVista('nuevo'); if(editId) cancelarEdicion(); }} className={`pb-3 font-black text-xs uppercase tracking-widest transition-colors ${vista === 'nuevo' ? 'text-sky-600 border-b-2 border-sky-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}><ShoppingCart size={18} className="inline mr-1" /> {editId ? 'Corrigiendo' : 'Registrar'}</button>}
        
        <button onClick={() => setVista('historial')} className={`pb-3 font-black text-xs uppercase tracking-widest transition-colors ${vista === 'historial' ? 'text-sky-600 border-b-2 border-sky-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}><ClipboardList size={18} className="inline mr-1" /> Historial</button>
        
        {puedeCrear && <button onClick={() => setVista('espera')} className={`pb-3 font-black text-xs uppercase tracking-widest transition-colors ${vista === 'espera' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-400 hover:text-amber-500'}`}><Clock size={18} className="inline mr-1" /> Espera ({enEspera.length})</button>}
        {puedeCrear && <button onClick={() => setVista('web')} className={`pb-3 font-black text-xs uppercase tracking-widest transition-colors ${vista === 'web' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-slate-400 hover:text-emerald-500'}`}><Store size={18} className="inline mr-1" /> Web ({pedidosWeb.length})</button>}
        
        <button onClick={copiarLinkTienda} className="pb-3 font-black text-xs uppercase tracking-widest transition-colors text-slate-400 hover:text-sky-600 ml-auto"><Link size={18} className="inline mr-1" /> Link Tienda</button>
      </div>

      {!tasaActualizadaHoy && vista === 'nuevo' && !editId && puedeCrear && (
        <div className="mb-6 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-xl shadow-sm font-bold flex items-center gap-3">
           <AlertTriangle size={24}/> ATENCIÓN: La tasa del día no ha sido actualizada. Solicite a Administración que la actualice.
        </div>
      )}

      {/* AVISO DE CAMPAÑA GLOBAL EN VENTAS */}
      {isGlobalDiscountActive && vista === 'nuevo' && puedeCrear && (
        <div className="mb-6 bg-gradient-to-r from-emerald-500 to-teal-500 text-white p-4 rounded-xl shadow-md font-bold flex items-center justify-between gap-3 animate-pulse">
           <div className="flex items-center gap-3">
             <Percent size={24}/> 
             <div>
               <div>Campaña del {globalDiscountPercent}% activada por Administración.</div>
               <div className="text-xs opacity-90 font-medium">Los precios del sistema ya incluyen esta rebaja automáticamente.</div>
             </div>
           </div>
        </div>
      )}

      {vista === 'nuevo' && puedeCrear && (
        <div className="animate-in fade-in duration-300">
          {editId && pedidoDevuelto?.status === 'Rechazado' && (
            <div className="mb-8 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-5 rounded-r-xl shadow-sm">
              <div className="flex gap-4">
                <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-full text-red-600 dark:text-red-400 shrink-0 h-max"><AlertTriangle size={20} /></div>
                <div className="flex-1">
                  <h3 className="text-red-800 dark:text-red-300 font-bold text-lg">Administración Devolvió la Orden</h3>
                  <p className="text-red-700 dark:text-red-200 text-sm mt-1"><strong>Motivo:</strong> {pedidoDevuelto.motivoRechazo}</p>
                  
                  {pedidoDevuelto.faltanteUsd > 0 && (
                    <div className="mt-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-red-200 dark:border-red-800">
                      <div className="text-sm font-bold text-red-600 dark:text-red-400 mb-3">⚠️ Dinero Faltante Detectado: ${pedidoDevuelto.faltanteUsd.toFixed(2)} USD</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Monto adicional pagado" type="number" step="0.01" value={formData.pagoAdicional || ''} onChange={e=>setFormData({...formData, pagoAdicional: e.target.value})} placeholder="Ej: 5.50" />
                        <Input label="Referencia del pago adicional" type="text" value={formData.refAdicional || ''} onChange={e=>setFormData({...formData, refAdicional: e.target.value})} placeholder="Ref: 4321..." />
                      </div>
                    </div>
                  )}
                  <button type="button" onClick={cancelarEdicion} className="text-xs font-bold text-red-600 dark:text-red-400 hover:text-red-800 mt-4 underline transition-colors">Cancelar corrección</button>
                </div>
              </div>
            </div>
          )}

          {!editId && (
            <div className="mb-8 bg-gradient-to-r from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-blue-900/20 p-6 rounded-2xl border border-sky-100 dark:border-sky-800 shadow-sm">
              <h3 className="text-sky-900 dark:text-sky-300 font-bold mb-3 flex items-center gap-2"><Sparkles size={20} className="text-sky-600 dark:text-sky-400" /> Asistente de IA Bluher</h3>
              <div className="flex flex-col md:flex-row gap-4">
                <textarea className="flex-1 p-4 border border-sky-200/60 dark:border-sky-700 rounded-xl text-sm resize-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all shadow-inner bg-white/80 dark:bg-slate-800/80 dark:text-white" rows={2} placeholder="Pega aquí el mensaje del cliente (WhatsApp)..." value={textoCrudo} onChange={(e) => setTextoCrudo(e.target.value)}></textarea>
                <button type="button" onClick={analizarConGemini} disabled={analizando} className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 px-6 rounded-xl shadow-md disabled:opacity-50 transition-all hover:shadow-lg flex items-center justify-center min-w-[140px]">
                  {analizando ? <Loader2 className="animate-spin" size={20}/> : 'Autocompletar'}
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <Input label="Nombre de Asesora" name="asesora" value={formData.asesora} onChange={(e)=>setFormData({...formData, asesora: e.target.value})} required disabled={!tasaActualizadaHoy && !editId} />
             <Input label="Nombre del Cliente" name="clienteNombre" value={formData.clienteNombre} onChange={(e)=>setFormData({...formData, clienteNombre: e.target.value})} required disabled={!tasaActualizadaHoy && !editId} />
             <Input label="Cédula/RIF" name="clienteCedula" value={formData.clienteCedula} onChange={(e)=>setFormData({...formData, clienteCedula: e.target.value})} required disabled={!tasaActualizadaHoy && !editId} />
             <Input label="Teléfono de Contacto" name="clienteTelefono" value={formData.clienteTelefono} onChange={(e)=>setFormData({...formData, clienteTelefono: e.target.value})} required disabled={!tasaActualizadaHoy && !editId} />
             
             <div className="flex flex-col">
               <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1.5 ml-2 transition-colors">Empresa de Envío</label>
               <select name="courier" value={formData.courier} onChange={(e)=>setFormData({...formData, courier: e.target.value})} disabled={!tasaActualizadaHoy && !editId} className="p-3.5 border-2 border-slate-100 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-900 outline-none focus:border-sky-500 transition-all font-bold text-slate-700 dark:text-slate-200 cursor-pointer shadow-sm disabled:opacity-50">
                 <option value="ZOOM">ZOOM</option> <option value="MRW">MRW</option> <option value="Tealca">Tealca</option> <option value="Domesa">Domesa</option>
               </select>
             </div>
             
             <div className="flex flex-col justify-center gap-3 mt-6">
               <div className="flex items-center gap-3">
                 <input type="checkbox" id="ml-check" checked={formData.esMercadoLibre} onChange={(e) => setFormData({...formData, esMercadoLibre: e.target.checked})} disabled={!tasaActualizadaHoy && !editId} className="w-5 h-5 accent-sky-600 cursor-pointer rounded disabled:opacity-50" />
                 <label htmlFor="ml-check" className="text-sm font-bold text-slate-700 dark:text-slate-300 cursor-pointer uppercase tracking-wider">Es envío de MercadoLibre</label>
               </div>
               <div className="flex items-center gap-3">
                 <input type="checkbox" id="regalo-check" checked={formData.esRegalo} onChange={(e) => setFormData({...formData, esRegalo: e.target.checked})} disabled={!tasaActualizadaHoy && !editId} className="w-5 h-5 accent-purple-600 cursor-pointer rounded disabled:opacity-50" />
                 <label htmlFor="regalo-check" className="text-sm font-bold text-purple-700 dark:text-purple-400 cursor-pointer uppercase tracking-wider flex items-center gap-1"><Gift size={16}/> Es Regalo / Obsequio VIP</label>
               </div>
             </div>

             <div className="md:col-span-2">
               <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1.5 ml-2 transition-colors block">Dirección de Envío Completa</label>
               <textarea name="direccion" value={formData.direccion} onChange={(e)=>setFormData({...formData, direccion: e.target.value})} required disabled={!tasaActualizadaHoy && !editId} rows={2} className="w-full p-3.5 border-2 border-slate-100 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-900 outline-none focus:border-sky-500 transition-all font-bold text-slate-700 dark:text-slate-200 shadow-sm disabled:opacity-50"></textarea>
             </div>
             
             <div className="md:col-span-2 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-700">
               <div className="flex justify-between items-center mb-4">
                 <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2"><Package size={20} className="text-sky-600"/> Inventario a Despachar</label>
                 <button type="button" onClick={() => setIsCatalogOpen(true)} disabled={!tasaActualizadaHoy && !editId} className="text-sm font-bold text-sky-700 dark:text-sky-400 bg-sky-100/50 dark:bg-sky-900/30 hover:bg-sky-100 dark:hover:bg-sky-900 py-2.5 px-6 rounded-xl transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"><Search size={16} /> Catálogo Visual</button>
               </div>
               {formData.productos ? (
                 <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm font-medium leading-relaxed">{typeof formData.productos === 'string' ? formData.productos : JSON.stringify(formData.productos)}</div>
               ) : (
                 <div className="text-sm text-slate-400 italic font-bold text-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-white/50 dark:bg-slate-800/50">El carrito está vacío. Haz clic en "Catálogo Visual" para agregar productos.</div>
               )}
             </div>

             <div className={`md:col-span-2 p-8 rounded-3xl shadow-inner grid grid-cols-1 md:grid-cols-4 gap-6 transition-colors ${formData.esRegalo ? 'bg-purple-900/20 border-2 border-purple-500 text-purple-300' : 'bg-[#003366] dark:bg-slate-950 text-white'}`}>
               <div className="flex flex-col"><InputDark disabled={formData.esRegalo || (!tasaActualizadaHoy && !editId)} type="number" step="0.01" label="Tasa Aplicada (Bs/$)" value={formData.tasa} onChange={(e)=>setFormData({...formData, tasa: e.target.value})} required={!formData.esRegalo} placeholder="Ej: 45.20" /></div>
               <div className="flex flex-col">
                 <label className="text-[10px] font-black uppercase text-slate-300 mb-1.5 ml-2 transition-colors">Moneda de Pago</label>
                 <select disabled={formData.esRegalo || (!tasaActualizadaHoy && !editId)} value={formData.moneda} onChange={(e)=>setFormData({...formData, moneda: e.target.value})} className="p-3.5 border-2 border-slate-700 rounded-2xl bg-slate-800 outline-none focus:border-sky-400 transition-colors font-bold text-white cursor-pointer disabled:opacity-50 shadow-inner">
                   <option value="USD">Dólares (USD)</option> <option value="VES">Bolívares (VES)</option>
                 </select>
               </div>
               <div className="flex flex-col relative">
                  <InputDark disabled={formData.esRegalo || (!tasaActualizadaHoy && !editId)} type="number" step="0.01" label="Monto Final a Pagar" value={formData.esRegalo ? '0' : formData.montoPago} onChange={(e)=>setFormData({...formData, montoPago: e.target.value})} required={!formData.esRegalo} placeholder="Ej: 30.50" />
                  {!formData.esRegalo && formData.tasa && formData.montoPago && <span className="text-xs text-sky-400 font-bold absolute -bottom-5 left-2">{formData.moneda === 'USD' ? `Equivale: Bs. ${((parseFloat(formData.montoPago)||0) * parseFloat(formData.tasa)).toFixed(2)}` : `Equivale: $${((parseFloat(formData.montoPago)||0) / parseFloat(formData.tasa)).toFixed(2)}`}</span>}
               </div>
               <InputDark disabled={formData.esRegalo || (!tasaActualizadaHoy && !editId)} label="Referencia / Banco" value={formData.esRegalo ? 'MUESTRA / OBSEQUIO VIP' : formData.referencia} onChange={(e)=>setFormData({...formData, referencia: e.target.value})} required={!formData.esRegalo} placeholder="Ej. 1234 Banesco" />
               
               {!formData.esRegalo && (
                 <div className="md:col-span-4 mt-2 border-t border-slate-700 pt-6"><InputDark type="number" step="0.01" disabled={!tasaActualizadaHoy && !editId} label="Añadir Descuento Asesor (%)" value={formData.descuentoPorcentaje} onChange={(e)=>setFormData({...formData, descuentoPorcentaje: e.target.value})} placeholder="Ej: 5" /></div>
               )}
             </div>
             
             <div className="md:col-span-2 mt-4">
                <button type="submit" disabled={enviando || (!tasaActualizadaHoy && !editId)} className={`w-full text-white font-black py-5 rounded-3xl shadow-2xl flex justify-center items-center gap-3 text-lg transition-all hover:scale-[1.02] tracking-widest uppercase ${editId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-sky-600 hover:bg-sky-700'} disabled:opacity-50 disabled:hover:scale-100`}>
                  {enviando ? <Loader2 className="animate-spin" /> : <><CheckCircle size={24} /> {editId ? 'Actualizar y Reenviar Pedido' : 'Procesar Orden de Venta'}</>}
                </button>
             </div>
          </form>
        </div>
      )}

      {vista === 'historial' && (
        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm animate-in fade-in">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                <th className="p-4 border-b dark:border-slate-700 font-bold tracking-wide">Cliente y Fecha</th>
                <th className="p-4 border-b dark:border-slate-700 font-bold tracking-wide">Pago</th>
                <th className="p-4 border-b dark:border-slate-700 font-bold tracking-wide">Estatus</th>
                {puedeCrear && <th className="p-4 border-b dark:border-slate-700 font-bold tracking-wide text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {pedidos.filter(p => !p.esPublico).length === 0 ? <tr><td colSpan={puedeCrear ? 4 : 3} className="p-8 text-center text-slate-400 italic font-bold">No hay ventas registradas aún.</td></tr> : 
                pedidos.filter(p => !p.esPublico).map(p => (
                <tr key={p.id} className="border-b border-slate-50 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-4 align-top w-1/3">
                    <div className="font-bold text-slate-800 dark:text-slate-100 text-base flex items-center gap-2">
                       {p.clienteNombre}
                       {p.esMercadoLibre && <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border border-yellow-300">ML</span>}
                    </div>
                    <div className="text-xs font-semibold text-slate-400 mt-1">{new Date(p.fechaCreacion).toLocaleDateString()}</div>
                    <div className="mt-3 text-[11px] bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700 whitespace-pre-wrap text-slate-600 dark:text-slate-300 font-medium">
                       {typeof p.productos === 'string' ? p.productos : JSON.stringify(p.productos)}
                    </div>
                  </td>
                  <td className="p-4 align-top">
                    {p.esRegalo ? (
                       <div className="font-black text-purple-600 dark:text-purple-400 text-sm flex items-center gap-1"><Gift size={14}/> REGALO VIP</div>
                    ) : (
                       <>
                        <div className="font-black text-slate-800 dark:text-slate-100 text-lg">${(p.montoUsd||0).toFixed(2)}</div>
                        <div className="text-[11px] font-semibold text-slate-400 mt-0.5">Tasa: Bs. {p.tasaAplicada || '-'}</div>
                        {(p.descuentoPorcentaje > 0 || p.descuentoGlobalAplicado > 0) && (
                          <div className="flex flex-col gap-1 mt-2">
                            {p.descuentoGlobalAplicado > 0 && <span className="text-[10px] font-bold text-pink-600 bg-pink-50 dark:bg-pink-900/30 px-2 py-0.5 rounded w-max">Campaña: {p.descuentoGlobalAplicado}%</span>}
                            {p.descuentoPorcentaje > 0 && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded w-max">Asesor: {p.descuentoPorcentaje}%</span>}
                          </div>
                        )}
                       </>
                    )}
                  </td>
                  <td className="p-4 align-top">
                    <StatusBadge status={p.status} />
                    {p.status === 'Rechazado' && <div className="text-[10px] text-red-600 mt-1.5 font-bold bg-red-50 dark:bg-red-900/30 p-2 rounded-lg border border-red-100 dark:border-red-800 max-w-[200px] line-clamp-2 leading-relaxed" title={p.motivoRechazo}>Motivo: {p.motivoRechazo}</div>}
                  </td>
                  {puedeCrear && (
                    <td className="p-4 align-top text-right">
                      <div className="flex flex-col items-end gap-2">
                        {p.status === 'Rechazado' && (
                          <button onClick={() => cargarPedidoParaEditar(p)} className="bg-amber-100 text-amber-700 hover:bg-amber-200 text-xs font-bold py-1.5 px-3 rounded-lg transition-colors shadow-sm">Corregir Orden</button>
                        )}
                        {(p.status === 'Pendiente' || p.status === 'Rechazado') && (
                          <button onClick={() => cambiarEstadoPedido(p.id, 'En Espera (Sin Stock)')} className="text-xs text-slate-400 hover:text-amber-500 font-semibold underline transition-colors">Mover a Espera</button>
                        )}
                        {p.status === 'Despachado' && (
                          <>
                            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">Guía: {p.guia}</div>
                            <button onClick={() => enviarWhatsApp(p)} className="bg-[#25D366]/10 text-[#128C7E] dark:text-[#25D366] hover:bg-[#25D366]/20 text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-colors"><MessageCircle size={14} /> Notificar</button>
                          </>
                        )}
                        {p.auditado && <span className="text-emerald-600 font-bold text-[10px] flex items-center justify-end gap-1 mt-1 uppercase tracking-widest"><ShieldCheck size={12}/> Auditado</span>}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {vista === 'espera' && puedeCrear && (
        <div className="animate-in fade-in bg-amber-50 dark:bg-amber-900/10 p-6 rounded-xl border border-amber-200 dark:border-amber-800">
           <h3 className="font-bold text-amber-800 dark:text-amber-500 mb-4 flex items-center gap-2"><Clock/> Clientes en Espera (Sin Stock)</h3>
           {enEspera.length === 0 ? <p className="text-sm text-amber-600 dark:text-amber-400">No hay pedidos en lista de espera.</p> : (
             <div className="space-y-4">
               {enEspera.map(p => (
                 <div key={p.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-amber-100 dark:border-slate-700 flex justify-between items-center transition-colors">
                   <div>
                     <div className="font-bold text-lg">{p.clienteNombre}</div>
                     <div className="text-xs opacity-60">Desde {new Date(p.fechaCreacion).toLocaleDateString()}</div>
                   </div>
                   <button onClick={() => cambiarEstadoPedido(p.id, 'Pendiente')} className="bg-sky-600 text-white px-6 py-2 rounded-xl font-black text-xs shadow hover:bg-sky-700 transition-colors">Retomar Pedido</button>
                 </div>
               ))}
             </div>
           )}
        </div>
      )}

      {vista === 'web' && puedeCrear && (
        <div className="animate-in fade-in bg-emerald-50 dark:bg-emerald-900/10 p-6 rounded-xl border border-emerald-200 dark:border-emerald-800">
           <h3 className="font-bold text-emerald-800 dark:text-emerald-500 mb-4 flex items-center gap-2"><Store/> Pedidos Recibidos del Portal Web</h3>
           {pedidosWeb.length === 0 ? <p className="text-sm text-emerald-600 dark:text-emerald-400">No hay nuevos pedidos de clientes web.</p> : (
             <div className="space-y-4">
               {pedidosWeb.map(p => (
                 <div key={p.id} className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-emerald-100 dark:border-slate-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-colors shadow-sm">
                   <div>
                     <div className="font-black text-lg uppercase tracking-tight">{p.clienteNombre} <span className="text-xs font-normal text-slate-500">({p.clienteTelefono})</span></div>
                     <div className="text-xs font-semibold text-emerald-600 mt-1">Total Cotizado: ${p.montoUsd}</div>
                     <div className="text-xs text-slate-500 mt-2 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg whitespace-pre-wrap">{p.productos}</div>
                     
                     <div className="flex flex-col gap-1 mt-3">
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Ref: {p.referencia}</div>
                        {p.linkComprobantePago && <a href={p.linkComprobantePago} target="_blank" rel="noreferrer" className="text-xs text-sky-600 hover:underline flex items-center gap-1"><FileText size={12}/> Ver Comprobante Subido</a>}
                     </div>
                   </div>
                   <div className="flex flex-col gap-2 shrink-0">
                     <button onClick={() => {setFormData({...p, montoPago: p.montoUsd?.toString(), tasa: p.tasaAplicada?.toString() || config.tasaDia}); setEditId(p.id); setVista('nuevo');}} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-emerald-700 flex items-center gap-2 transition-colors shadow-md"><CheckCircle size={14}/> Validar Venta</button>
                     <button onClick={() => cambiarEstadoPedido(p.id, 'En Espera (Sin Stock)')} className="bg-amber-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-amber-600 flex items-center gap-2 transition-colors shadow-md"><Clock size={14}/> Mover a Espera</button>
                     <button onClick={() => cambiarEstadoPedido(p.id, 'Rechazado')} className="bg-red-50 text-red-600 px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-red-100 flex items-center gap-2 transition-colors"><XCircle size={14}/> Descartar Web</button>
                   </div>
                 </div>
               ))}
             </div>
           )}
        </div>
      )}

      <ModalCatalogo 
        catalogo={catalogo} 
        stock={stock}
        isOpen={isCatalogOpen} 
        onClose={()=>setIsCatalogOpen(false)} 
        dialogs={dialogs}
        onConfirm={(txt, obj)=>{
          setFormData(prev => ({
            ...prev, 
            productos: prev.productos ? `${prev.productos}\n${txt}` : txt, 
            carritoObj: { ...(prev.carritoObj || {}), ...obj }
          })); 
          setIsCatalogOpen(false);
        }}
      />
    </div>
  );
}