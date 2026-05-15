import React, { useState, useEffect } from 'react';
import { ShoppingCart, ClipboardList, Clock, Store, Link, AlertTriangle, Sparkles, Loader2, Gift, Package, Search, CheckCircle, FileText, XCircle, MessageCircle, ShieldCheck, Percent, UploadCloud, FileType, Ban } from 'lucide-react';
import { Input, InputDark, StatusBadge } from '../components/ui';
import ModalCatalogo from '../components/modals/ModalCatalogo';
import { updateDoc, doc, addDoc, collection } from 'firebase/firestore';
import { WORKER_GEMINI_URL, URL_GOOGLE_SCRIPT } from '../config/firebase'; 
import { compressImage, fileToBase64 } from '../utils/image';
import { ROLES } from '../config/constants';

export default function PanelVentas({ perfil, pedidos, catalogo, stock, config, db, appId, loggear, dialogs, cambiarEstadoPedido }) {
  const puedeCrear = [ROLES.ADMIN, ROLES.VENTAS].includes(perfil?.role);
  const [vista, setVista] = useState(puedeCrear ? 'nuevo' : 'historial'); 
  
  const defaultForm = { 
    clienteNombre: '', clienteCedula: '', clienteTelefono: '', courier: '', pagoEnvio: 'COD', origenPedido: '',
    direccion: '', productos: '', carritoObj: null, asesora: perfil?.nombre || '', referencia: '', moneda: '', 
    montoPago: '0', tasa: config.tasaDia || '1', esMercadoLibre: false, linkGuiaML: '', esRegalo: false, 
    descuentoPorcentaje: '0', pagoAdicional: '', refAdicional: '' 
  };
  
  const [formData, setFormData] = useState(defaultForm);
  const [editId, setEditId] = useState(null); 
  const [pedidoDevuelto, setPedidoDevuelto] = useState(null); 
  const [enviando, setEnviando] = useState(false);
  const [subiendoML, setSubiendoML] = useState(false);
  const [textoCrudo, setTextoCrudo] = useState('');
  const [analizando, setAnalizando] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);

  const pedidosWeb = pedidos.filter(p => p.esPublico && p.status === 'Por Pagar / Cotización');
  const enEspera = pedidos.filter(p => p.status === 'En Espera (Sin Stock)');

  const fechaHoy = new Date().toLocaleDateString('es-VE');
  const tasaActualizadaHoy = config?.ultimaActualizacion === fechaHoy;

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
    
    const subConCampaña = sub * (1 - globalDiscountPercent / 100);
    const dExtra = parseFloat(formData.descuentoPorcentaje) || 0;
    const final = subConCampaña * (1 - dExtra / 100);
    
    setFormData(prev => ({ 
      ...prev, 
      montoPago: prev.esRegalo ? prev.montoPago : final.toFixed(2), 
      moneda: prev.moneda === 'ZELLE' ? 'ZELLE' : 'USD', 
      tasa: prev.tasa || config?.tasaDia 
    }));
  }, [formData.carritoObj, formData.descuentoPorcentaje, config?.tasaDia, catalogo, globalDiscountPercent]);

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
    if (!WORKER_GEMINI_URL) return dialogs.alert("La URL del Worker de Gemini no está configurada.", "Error de Entorno");
    
    setAnalizando(true);

    try {
      const llavesCatalogo = catalogo.flatMap(c => c.productos.flatMap(p => p.presentaciones.map(pres => `${p.nombre}|${pres}`))).join(', ');
      
      const prompt = `Analiza este WhatsApp y extrae JSON: Nombre, Teléfono, Cédula, courier (ZOOM, MRW, Tealca, Domesa), Dirección, Productos, montoPago, Tipo de envío (si dice "MercadoLibre", esMercadoLibre=true), asesora. 
      La variable "moneda" DEBE ser "USD", "VES" o "ZELLE". Si habla de Zelle es "ZELLE", si es dólares en efectivo es "USD", si es bolívares o Bs es "VES".
      La variable "pagoEnvio" DEBE ser "COD" (cobro en destino) o "PAGADO" (envío pagado). Por defecto usa "COD".
      productosCrudos: texto exacto.
      carrito: mapea cantidades a estas llaves: [${llavesCatalogo}].
      Texto: ${textoCrudo}`;
      
      const res = await fetch(WORKER_GEMINI_URL, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                clienteNombre: { type: "STRING" }, clienteCedula: { type: "STRING" }, clienteTelefono: { type: "STRING" },
                courier: { type: "STRING" }, pagoEnvio: { type: "STRING" }, direccion: { type: "STRING" }, montoPago: { type: "STRING" }, moneda: { type: "STRING" }, referencia: { type: "STRING" }, asesora: { type: "STRING" }, productosCrudos: { type: "STRING" }, tasa: { type: "STRING" }, esMercadoLibre: { type: "BOOLEAN" },
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

         let monedaSanitizada = result.moneda;
         if (typeof monedaSanitizada === 'string') {
            const m = monedaSanitizada.toUpperCase();
            if (m.includes('ZELLE')) monedaSanitizada = 'ZELLE';
            else if (m.includes('BS') || m.includes('VES') || m.includes('BOL')) monedaSanitizada = 'VES';
            else monedaSanitizada = 'USD';
         } else {
            monedaSanitizada = 'USD';
         }

         setFormData(prev => ({ 
           ...prev, 
           ...result, 
           tasa: result.tasa || prev.tasa,
           moneda: Object.keys(nuevoCarritoObj).length > 0 && monedaSanitizada !== 'ZELLE' ? 'USD' : monedaSanitizada,
           esMercadoLibre: result.esMercadoLibre || false,
           pagoEnvio: result.pagoEnvio || 'COD',
           productos: txtFormat || prev.productos, 
           carritoObj: Object.keys(nuevoCarritoObj).length > 0 ? nuevoCarritoObj : prev.carritoObj 
         }));
      }
    } catch(e) { console.error(e); dialogs.alert("Error comunicando con la IA. Ingresa manual.", "Error"); } finally { setAnalizando(false); }
  };

  const eliminarDelCarrito = (itemKey) => {
    setFormData(prev => {
      const nuevoCarrito = { ...prev.carritoObj };
      delete nuevoCarrito[itemKey];
      let nuevoTexto = "";
      Object.entries(nuevoCarrito).forEach(([key, qty]) => {
         nuevoTexto += `- ${qty}x ${key.replace('|', ' ')}\n`;
      });
      return { ...prev, carritoObj: nuevoCarrito, productos: nuevoTexto.trim() };
    });
  };

  const cargarPedidoParaEditar = (pedido) => {
    setFormData({
      clienteNombre: pedido.clienteNombre, clienteCedula: pedido.clienteCedula, clienteTelefono: pedido.clienteTelefono, courier: pedido.courier, pagoEnvio: pedido.pagoEnvio || 'COD', origenPedido: pedido.origenPedido || '', direccion: pedido.direccion,
      productos: typeof pedido.productos === 'string' ? pedido.productos : JSON.stringify(pedido.productos), carritoObj: pedido.carritoObj, asesora: pedido.asesora, referencia: pedido.referencia, moneda: pedido.moneda || 'USD', 
      montoPago: pedido.monto?.toString() || '0', tasa: pedido.tasaAplicada?.toString() || config.tasaDia, esMercadoLibre: pedido.esMercadoLibre || false, linkGuiaML: pedido.linkGuiaML || '', esRegalo: pedido.esRegalo || false, descuentoPorcentaje: pedido.descuentoPorcentaje?.toString() || '0', pagoAdicional: '', refAdicional: ''
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

  // NUEVA FUNCIÓN: Anular / Descartar Pedido desde Ventas
  const anularPedidoVentas = (pedido) => {
    dialogs.prompt(`Estás a punto de ANULAR y descartar el pedido de ${pedido.clienteNombre}.\n\nEscribe el motivo de la cancelación:`, async (motivo) => {
      if (!motivo) return;
      try {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', pedido.id), { 
           status: 'Anulado', 
           motivoAnulacion: `Cancelado por Ventas: ${motivo}`,
           anuladoPor: perfil.nombre,
           fechaAnulacion: Date.now(),
           montoUsd: 0, montoVes: 0, 
           notasAuditoria: [...(pedido.notasAuditoria || []), { fecha: Date.now(), texto: `ORDEN ANULADA POR VENTAS: ${motivo}`, autor: perfil.nombre }]
        });
        loggear('PEDIDO_ANULADO_VENTAS', `Ventas anuló el pedido de ${pedido.clienteNombre} por: ${motivo}`);
        dialogs.alert("El pedido ha sido anulado y descartado exitosamente.", "Completado");
      } catch (e) { 
        console.error(e); 
        dialogs.alert("Error al intentar anular el pedido."); 
      }
    }, "Cancelar Pedido");
  };

  const handleFileUploadML = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!URL_GOOGLE_SCRIPT) return dialogs.alert("El sistema de subida no está configurado.");

    setSubiendoML(true);
    try {
      let base64Data;
      let mimeType = file.type;

      if (mimeType === 'application/pdf') {
        base64Data = await fileToBase64(file);
      } else {
        base64Data = await compressImage(file, 1000, 0.8);
      }

      const response = await fetch(URL_GOOGLE_SCRIPT, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ 
           tokenSecreto: "BLUHER_SECURE_TOKEN_2026",
           fileName: `GuiaML_${Date.now()}.${mimeType === 'application/pdf' ? 'pdf' : 'jpg'}`, 
           mimeType: mimeType, 
           data: base64Data 
        })
      });
      const result = await response.json();
      if (result.url) setFormData({ ...formData, linkGuiaML: result.url });
      setSubiendoML(false);
    } catch (error) {
      console.error(error);
      dialogs.alert("Error subiendo el archivo. Revisa tu conexión.", "Fallo de Red");
      setSubiendoML(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tasaActualizadaHoy && !editId) return dialogs.alert("NO puedes registrar ventas nuevas porque la Tasa del Día no ha sido actualizada hoy por Administración.", "Tasa Desactualizada");
    if (!formData.carritoObj || Object.keys(formData.carritoObj).length === 0) return dialogs.alert("Debes seleccionar productos del Catálogo Visual.", "Carrito Vacío");
    if (!formData.courier) return dialogs.alert("Por favor selecciona la Empresa de Envío.", "Falta Agencia");
    if (!formData.origenPedido) return dialogs.alert("Por favor selecciona de dónde viene el pedido.", "Falta Origen");
    
    if (!formData.tasa || parseFloat(formData.tasa) <= 0) return dialogs.alert("Por favor ingresa la tasa de cambio aplicada.", "Datos Faltantes");
    if (!formData.moneda) return dialogs.alert("Por favor selecciona la moneda de pago.", "Falta Moneda");
    
    if (formData.esMercadoLibre && !formData.linkGuiaML) return dialogs.alert("Si es un envío de MercadoLibre, debes adjuntar el PDF o Imagen de la guía antes de procesar.", "Falta Guía ML");
    
    const boosterKeys = ["Booster de Hidratacion|Unidad", "Booster de Reparacion|Unidad", "Booster de Nutricion|Unidad", "Booster Profesional|Unidad"];
    let sinStock = false;
    let itemsFaltantes = [];
    let extraConcentrados = 0;

    Object.entries(formData.carritoObj).forEach(([key, qty]) => {
      let maxDisp = typeof stock[key] === 'object' ? stock[key].envios : (stock[key]||0);
      if (qty > maxDisp) {
        sinStock = true;
        itemsFaltantes.push(key.replace('|', ' '));
      }
      if (boosterKeys.includes(key)) {
         extraConcentrados += qty;
      }
    });

    if (extraConcentrados > 0) {
       const qtyConcentradosActual = formData.carritoObj["Concentrado|Unidad"] || 0;
       const totalConcentradosNecesarios = qtyConcentradosActual + extraConcentrados;
       const dispConcentrado = typeof stock["Concentrado|Unidad"] === 'object' ? stock["Concentrado|Unidad"].envios : (stock["Concentrado|Unidad"]||0);
       
       if (totalConcentradosNecesarios > dispConcentrado) {
          sinStock = true;
          if (!itemsFaltantes.some(i => i.includes("Concentrado"))) {
             itemsFaltantes.push(`Concentrado (Requiere ${totalConcentradosNecesarios} total por los Boosters)`);
          }
       }
    }

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
    let montoNum = parseFloat(formData.montoPago) || 0;
    const tasa = parseFloat(formData.tasa) || 1;
    let descuento = parseFloat(formData.descuentoPorcentaje) || 0;
    let pagoExtUsd = 0;

    if (editId && pedidoDevuelto?.faltanteUsd > 0 && formData.pagoAdicional) {
      let extra = parseFloat(formData.pagoAdicional) || 0;
      pagoExtUsd = formData.moneda === 'VES' ? extra / tasa : extra;
      montoNum += extra;
    }

    let calculo = { usd: 0, ves: 0 };
    if (formData.moneda === 'ZELLE') {
        calculo.usd = montoNum; 
        calculo.ves = 0; 
    } else if (formData.moneda === 'USD') {
        calculo.usd = montoNum;
        calculo.ves = montoNum * tasa;
    } else {
        calculo.ves = montoNum;
        calculo.usd = tasa > 0 ? montoNum / tasa : 0;
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

    const getVeneziaTime = () => {
      const now = new Date();
      return new Date(now.toLocaleString("en-US", {timeZone: "America/Caracas"}));
    };

    const targetDate = getVeneziaTime();
    const hora = targetDate.getHours();
    const minutos = targetDate.getMinutes();

    if (hora > 12 || (hora === 12 && minutos >= 30)) {
       targetDate.setDate(targetDate.getDate() + 1);
    }
    
    const dd = String(targetDate.getDate()).padStart(2, '0');
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const yyyy = targetDate.getFullYear();
    const fechaDespachoStr = `${dd}/${mm}/${yyyy}`;

    try {
      if (editId) {
        let updateData = {
          ...formData, productos: finalProductosText, carritoObj: finalCarrito, monto: montoNum, montoUsd: calculo.usd, montoVes: calculo.ves, tasaAplicada: tasa, status: finalStatus, motivoRechazo: '', faltanteUsd: 0, descuentoPorcentaje: descuento 
        };
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
          descuentoGlobalAplicado: globalDiscountPercent 
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
    const mensaje = `Hola ${pedido.clienteNombre}, tu pedido Bluher ha sido enviado por *${pedido.courier}*.%0A%0A*Guía:* ${pedido.guia}%0A%0A${pedido.linkGuia ? `Recibo: ${pedido.linkGuia}%0A` : ''}%0A¡Gracias por tu compra!`;
    let cleanPhone = String(pedido.clienteTelefono).replace(/\D/g, '');
    
    if (cleanPhone.startsWith('0')) {
        cleanPhone = cleanPhone.substring(1);
    }
    if (!cleanPhone.startsWith('58')) {
        cleanPhone = '58' + cleanPhone;
    }

    window.open(`https://wa.me/${cleanPhone}?text=${mensaje}`, '_blank');
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-4 md:p-8 rounded-3xl border dark:border-slate-700 shadow-sm transition-colors">
      <div className="flex flex-wrap gap-4 mb-8 border-b dark:border-slate-700 pb-2 overflow-x-auto">
        {puedeCrear && <button onClick={() => { setVista('nuevo'); if(editId) cancelarEdicion(); }} className={`pb-3 font-black text-xs uppercase tracking-widest transition-colors ${vista === 'nuevo' ? 'text-sky-600 border-b-2 border-sky-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}><ShoppingCart size={18} className="inline mr-1" /> {editId ? 'Corrigiendo' : 'Registrar'}</button>}
        
        <button onClick={() => setVista('historial')} className={`pb-3 font-black text-xs uppercase tracking-widest transition-colors ${vista === 'historial' ? 'text-sky-600 border-b-2 border-sky-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}><ClipboardList size={18} className="inline mr-1" /> Historial</button>
        
        {puedeCrear && <button onClick={() => setVista('espera')} className={`pb-3 font-black text-xs uppercase tracking-widest transition-colors ${vista === 'espera' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-400 hover:text-amber-500'}`}><Clock size={18} className="inline mr-1" /> Espera ({enEspera.length})</button>}
        {puedeCrear && <button onClick={() => setVista('web')} className={`pb-3 font-black text-xs uppercase tracking-widest transition-colors ${vista === 'web' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-slate-400 hover:text-emerald-500'}`}><Store size={18} className="inline mr-1" /> Web ({pedidosWeb.length})</button>}
        
        <button onClick={copiarLinkTienda} className="pb-3 font-black text-xs uppercase tracking-widest transition-colors text-slate-400 hover:text-sky-600 ml-auto"><Link size={18} className="inline mr-1" /> Link Tienda</button>
      </div>

      {!tasaActualizadaHoy && vista === 'nuevo' && !editId && puedeCrear && (
        <div className="mb-6 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-xl shadow-sm font-bold flex items-center gap-3">
           <AlertTriangle size={24} className="shrink-0"/> 
           <div>
             ATENCIÓN: La tasa del día no ha sido actualizada. 
             <span className="block text-xs font-normal">Puedes preparar el pedido pero no podrás enviarlo hasta que Administración actualice la tasa.</span>
           </div>
        </div>
      )}

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
             <Input label="Nombre de Asesora" name="asesora" value={formData.asesora} onChange={(e)=>setFormData({...formData, asesora: e.target.value})} required />
             
             <div className="flex flex-col">
               <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1.5 ml-2 transition-colors">Origen del Pedido</label>
               <select name="origenPedido" value={formData.origenPedido} onChange={(e)=>setFormData({...formData, origenPedido: e.target.value})} required className="p-3.5 border-2 border-slate-100 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-900 outline-none focus:border-sky-500 transition-all font-bold text-slate-700 dark:text-slate-200 shadow-sm">
                 <option value="" disabled>Seleccionar origen...</option>
                 <option value="CADENITA DIA MADRE">CADENITA DIA MADRE</option>
                 <option value="CADENITA 15% DESCUENTO">CADENITA 15% DESCUENTO</option>
                 <option value="CADENITA 30% DESCUENTO">CADENITA 30% DESCUENTO</option>
                 <option value="PAUTA">PAUTA</option>
                 <option value="PAGINA WEB">PAGINA WEB</option>
                 <option value="RECOMPRA">RECOMPRA</option>
               </select>
             </div>

             <Input label="Nombre del Cliente" name="clienteNombre" value={formData.clienteNombre} onChange={(e)=>setFormData({...formData, clienteNombre: e.target.value})} required />
             <Input label="Cédula/RIF" name="clienteCedula" value={formData.clienteCedula} onChange={(e)=>setFormData({...formData, clienteCedula: e.target.value})} required />
             
             <div className="md:col-span-2">
                 <Input label="Teléfono (Ej: 4141234567, sin el 0)" name="clienteTelefono" value={formData.clienteTelefono} onChange={(e)=>setFormData({...formData, clienteTelefono: e.target.value})} required placeholder="Ej: 4141234567" />
                 <p className="text-[10px] text-slate-400 mt-1 ml-2 font-bold italic">NOTA: Ingresa el número sin el 0 inicial (Ej. 4141234567). El sistema le agregará el +58 automáticamente.</p>
             </div>
             
             <div className="flex flex-col">
               <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1.5 ml-2 transition-colors">Empresa de Envío</label>
               <select name="courier" value={formData.courier} onChange={(e)=>setFormData({...formData, courier: e.target.value})} required className={`p-3.5 border-2 rounded-2xl bg-slate-50 dark:bg-slate-900 outline-none focus:border-sky-500 transition-all font-bold cursor-pointer shadow-sm ${!formData.courier ? 'border-amber-300 text-slate-400' : 'border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-200'}`}>
                 <option value="" disabled>Seleccionar...</option> <option value="ZOOM">ZOOM</option> <option value="MRW">MRW</option> <option value="Tealca">Tealca</option> <option value="Domesa">Domesa</option>
               </select>
             </div>

             <div className="flex flex-col">
               <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1.5 ml-2 transition-colors">Modalidad de Envío</label>
               <select name="pagoEnvio" value={formData.pagoEnvio} onChange={(e)=>setFormData({...formData, pagoEnvio: e.target.value})} className="p-3.5 border-2 rounded-2xl bg-slate-50 dark:bg-slate-900 outline-none focus:border-sky-500 transition-all font-bold cursor-pointer shadow-sm border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                 <option value="COD">Cobro en Destino (COD)</option>
                 <option value="PAGADO">Envío Pagado</option>
               </select>
             </div>
             
             <div className="md:col-span-2 flex flex-wrap items-center gap-6 mt-2 mb-2">
               <div className="flex items-center gap-3">
                 <input type="checkbox" id="ml-check" checked={formData.esMercadoLibre} onChange={(e) => setFormData({...formData, esMercadoLibre: e.target.checked})} className="w-5 h-5 accent-sky-600 cursor-pointer rounded" />
                 <label htmlFor="ml-check" className="text-sm font-bold text-slate-700 dark:text-slate-300 cursor-pointer uppercase tracking-wider">Envío MercadoLibre (PDF/Imagen)</label>
               </div>
               
               {formData.esMercadoLibre && (
                 <div className="animate-in fade-in slide-in-from-top-2 ml-8 mb-2">
                    <label className={`flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-xl cursor-pointer transition-colors font-bold text-xs ${formData.linkGuiaML ? 'border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' : 'border-sky-300 dark:border-sky-700 text-sky-600 hover:border-sky-50 dark:hover:bg-sky-900/20'}`}>
                       {subiendoML ? <Loader2 size={16} className="animate-spin"/> : (formData.linkGuiaML ? <CheckCircle size={16}/> : <FileType size={16}/>)}
                       {formData.linkGuiaML ? 'Archivo Cargado y Listo' : 'Adjuntar Guía PDF o Imagen'}
                       <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileUploadML} disabled={subiendoML}/>
                    </label>
                 </div>
               )}

               <div className="flex items-center gap-3">
                 <input 
                    type="checkbox" 
                    id="regalo-check" 
                    checked={formData.esRegalo} 
                    onChange={(e) => {
                       const checked = e.target.checked;
                       setFormData(prev => ({
                          ...prev, 
                          esRegalo: checked,
                          montoPago: checked ? '0' : prev.montoPago,
                          referencia: checked ? 'MUESTRA / OBSEQUIO VIP' : ''
                       }))
                    }} 
                    className="w-5 h-5 accent-purple-600 cursor-pointer rounded" 
                 />
                 <label htmlFor="regalo-check" className="text-sm font-bold text-purple-700 dark:text-purple-400 cursor-pointer uppercase tracking-wider flex items-center gap-1"><Gift size={16}/> Es Regalo / Obsequio VIP</label>
               </div>
             </div>

             <div className="md:col-span-2">
               <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1.5 ml-2 transition-colors block">Dirección de Envío Completa</label>
               <textarea name="direccion" value={formData.direccion} onChange={(e)=>setFormData({...formData, direccion: e.target.value})} required rows={2} className="w-full p-3.5 border-2 border-slate-100 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-900 outline-none focus:border-sky-500 transition-all font-bold text-slate-700 dark:text-slate-200 shadow-sm"></textarea>
             </div>
             
             <div className="md:col-span-2 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl border-2 border-slate-100 dark:border-slate-700">
               <div className="flex justify-between items-center mb-4">
                  <label className="font-black text-slate-800 dark:text-white flex items-center gap-2 uppercase tracking-tighter text-sm"><Package className="text-sky-600"/> Carrito de la Orden</label>
                  <button type="button" onClick={() => setIsCatalogOpen(true)} className="text-xs font-black bg-sky-600 text-white px-4 py-2 rounded-xl flex items-center gap-1 shadow-md"><Search size={14}/> Catálogo</button>
               </div>

               {formData.carritoObj && Object.keys(formData.carritoObj).length > 0 ? (
                 <div className="space-y-2">
                    {Object.entries(formData.carritoObj).map(([key, qty]) => (
                      <div key={key} className="flex justify-between items-center bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                         <div className="text-sm font-bold dark:text-slate-200">
                            <span className="text-sky-600 dark:text-sky-400 mr-2">{qty}x</span> {key.replace('|', ' ')}
                         </div>
                         <button type="button" onClick={() => eliminarDelCarrito(key)} className="text-red-400 hover:text-red-600"><XCircle size={18}/></button>
                      </div>
                    ))}
                 </div>
               ) : (
                 <div className="text-center p-8 text-slate-400 font-bold border-2 border-dashed dark:border-slate-700 rounded-xl">El carrito está vacío. Haz clic en "Catálogo" para agregar productos.</div>
               )}
             </div>

             <div className={`md:col-span-2 p-8 rounded-3xl shadow-inner grid grid-cols-1 md:grid-cols-4 gap-6 transition-colors ${formData.esRegalo ? 'bg-purple-900/20 border-2 border-purple-500 text-purple-300' : 'bg-[#003366] dark:bg-slate-950 text-white'}`}>
               <div className="flex flex-col"><InputDark disabled={formData.moneda === 'ZELLE'} type="number" step="0.01" label="Tasa Aplicada (Bs/$)" value={formData.tasa} onChange={(e)=>setFormData({...formData, tasa: e.target.value})} required placeholder="Ej: 45.20" /></div>
               <div className="flex flex-col">
                 <label className="text-[10px] font-black uppercase text-slate-300 mb-1.5 ml-2 transition-colors">Moneda de Pago</label>
                 <select value={formData.moneda} onChange={(e)=>setFormData({...formData, moneda: e.target.value})} required className={`p-3.5 border-2 rounded-2xl bg-slate-800 outline-none focus:border-sky-400 transition-colors font-bold cursor-pointer shadow-inner ${!formData.moneda ? 'border-amber-500 text-slate-400' : 'border-slate-700 text-white'}`}>
                   <option value="" disabled>Seleccionar...</option> 
                   <option value="USD">Dólares (Efectivo / Panamá)</option> 
                   <option value="ZELLE">Zelle (USD Directo)</option>
                   <option value="VES">Bolívares (Pago Móvil / Transf)</option>
                 </select>
               </div>
               <div className="flex flex-col relative">
                  <InputDark type="number" step="0.01" label="Monto Final a Pagar" value={formData.montoPago} onChange={(e)=>setFormData({...formData, montoPago: e.target.value})} required placeholder="Ej: 30.50" />
                  
                  {formData.tasa && formData.montoPago && formData.moneda && (
                    <span className="text-xs text-sky-400 font-bold absolute -bottom-5 left-2">
                       {formData.moneda === 'ZELLE' 
                          ? 'Pago directo vía Zelle (Sin Bs)'
                          : formData.moneda === 'USD' 
                          ? `Equivale: Bs. ${((parseFloat(formData.montoPago)||0) * parseFloat(formData.tasa)).toFixed(2)}` 
                          : `Equivale: $${((parseFloat(formData.montoPago)||0) / parseFloat(formData.tasa)).toFixed(2)}`
                       }
                    </span>
                  )}
               </div>
               <InputDark label="Referencia / Banco" value={formData.referencia} onChange={(e)=>setFormData({...formData, referencia: e.target.value})} required placeholder="Ej. 1234 Banesco" />
               
               {!formData.esRegalo && (
                 <div className="md:col-span-4 mt-2 border-t border-slate-700 pt-6"><InputDark type="number" step="0.01" label="Añadir Descuento Asesor (%)" value={formData.descuentoPorcentaje} onChange={(e)=>setFormData({...formData, descuentoPorcentaje: e.target.value})} placeholder="Ej: 5" /></div>
               )}
             </div>
             
             <div className="md:col-span-2 mt-4">
                <button type="submit" disabled={enviando || (!tasaActualizadaHoy && !editId)} className={`w-full text-white font-black py-5 rounded-3xl shadow-2xl flex justify-center items-center gap-3 text-lg transition-all tracking-widest uppercase ${editId ? 'bg-amber-600 hover:bg-amber-700 hover:scale-[1.02]' : 'bg-sky-600 hover:bg-sky-700 hover:scale-[1.02]'} disabled:bg-slate-400 disabled:hover:scale-100 dark:disabled:bg-slate-700`}>
                  {enviando ? <Loader2 className="animate-spin" /> : <><CheckCircle size={24} /> {editId ? 'Actualizar y Reenviar Pedido' : 'Procesar Orden de Venta'}</>}
                </button>
             </div>
          </form>
        </div>
      )}

      {vista === 'historial' && (
        <div className="rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden bg-white dark:bg-slate-800/20 animate-in fade-in">
          <div className="hidden lg:grid lg:grid-cols-12 gap-6 p-4 bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b dark:border-slate-700 text-sm">
            <div className="lg:col-span-4 font-bold tracking-wide">Cliente y Fecha</div>
            <div className="lg:col-span-3 font-bold tracking-wide">Pago</div>
            <div className="lg:col-span-2 font-bold tracking-wide">Estatus</div>
            {puedeCrear && <div className="lg:col-span-3 font-bold tracking-wide text-right">Acciones</div>}
          </div>

          <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-700">
            {pedidos.filter(p => !p.esPublico).length === 0 ? (
              <div className="p-10 text-center text-slate-400 italic font-bold">No hay ventas registradas aún.</div>
            ) : pedidos.filter(p => !p.esPublico).map(p => {
              const isAnulado = p.status === 'Anulado';
              
              return (
              <div key={p.id} className={`relative flex flex-col lg:grid lg:grid-cols-12 gap-4 lg:gap-6 p-4 md:p-6 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors ${isAnulado ? 'opacity-60 grayscale-[50%]' : ''}`}>
                
                <div className="lg:col-span-4 flex flex-col justify-start">
                  <div className={`font-bold text-slate-800 dark:text-slate-100 text-lg flex items-center gap-2 ${isAnulado ? 'line-through text-slate-400' : ''}`}>
                     {p.clienteNombre}
                     {p.esMercadoLibre && <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border border-yellow-300">ML</span>}
                  </div>
                  
                  <div className="text-xs font-black tracking-widest uppercase text-sky-600 dark:text-sky-400 mt-1.5 flex flex-wrap items-center gap-2">
                     {p.courier} 
                     <span className={`px-1.5 py-0.5 rounded text-[9px] border ${p.pagoEnvio === 'PAGADO' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-400' : 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/50 dark:text-orange-400'}`}>
                        {p.pagoEnvio === 'PAGADO' ? 'PAGADO' : 'COD'}
                     </span>
                     {p.origenPedido && (
                        <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 px-1.5 py-0.5 rounded text-[9px] border border-indigo-200 dark:border-indigo-800">
                           {p.origenPedido}
                        </span>
                     )}
                  </div>

                  <div className="text-xs font-semibold text-slate-400 mt-1">{new Date(p.fechaCreacion).toLocaleDateString()}</div>
                  <div className="mt-3 text-[12px] bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700 whitespace-pre-wrap text-slate-600 dark:text-slate-300 font-medium">
                     {typeof p.productos === 'string' ? p.productos : JSON.stringify(p.productos)}
                  </div>
                </div>

                <div className="lg:col-span-3 flex flex-col justify-start mt-2 lg:mt-0">
                  <span className="lg:hidden text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Monto a pagar:</span>
                  {isAnulado ? (
                     <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-300 dark:border-slate-600">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1"><Ban size={12}/> ORDEN ANULADA</div>
                        <div className="font-black text-slate-400 text-lg line-through">${(p.montoUsd||0).toFixed(2)}</div>
                        <div className="text-[10px] text-red-500 font-bold mt-1 leading-tight">Motivo: {p.motivoAnulacion}</div>
                     </div>
                  ) : p.esRegalo ? (
                     <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-xl border border-purple-200 dark:border-purple-800/50">
                        <div className="font-black text-purple-600 dark:text-purple-400 text-sm flex items-center gap-1 mb-1"><Gift size={14}/> REGALO VIP</div>
                        {p.montoUsd > 0 && <div className="font-black text-purple-800 dark:text-purple-300 text-lg">+ ${p.montoUsd.toFixed(2)}</div>}
                     </div>
                  ) : p.moneda === 'ZELLE' ? (
                     <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-xl border border-purple-200 dark:border-purple-800/50">
                        <div className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-1">ZELLE</div>
                        <div className="font-black text-purple-800 dark:text-purple-300 text-xl">${(p.montoUsd||0).toFixed(2)}</div>
                     </div>
                  ) : (
                     <>
                      <div className="font-black text-slate-800 dark:text-slate-100 text-xl">${(p.montoUsd||0).toFixed(2)}</div>
                      <div className="text-[11px] font-semibold text-slate-400 mt-0.5">Tasa: Bs. {p.tasaAplicada || '-'}</div>
                      {(p.descuentoPorcentaje > 0 || p.descuentoGlobalAplicado > 0) && (
                        <div className="flex flex-col gap-1 mt-2 w-max">
                          {p.descuentoGlobalAplicado > 0 && <span className="text-[10px] font-bold text-pink-600 bg-pink-50 dark:bg-pink-900/30 px-2 py-0.5 rounded border border-pink-200 dark:border-pink-800/50">Campaña: {p.descuentoGlobalAplicado}%</span>}
                          {p.descuentoPorcentaje > 0 && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/50">Asesor: {p.descuentoPorcentaje}%</span>}
                        </div>
                      )}
                     </>
                  )}
                </div>

                <div className="lg:col-span-2 flex flex-col justify-start mt-2 lg:mt-0 items-start">
                  <span className="lg:hidden text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Estado de la orden:</span>
                  <StatusBadge status={p.status} />
                  {p.status === 'Rechazado' && <div className="text-[10px] text-red-600 mt-2 font-bold bg-red-50 dark:bg-red-900/30 p-2 rounded-lg border border-red-100 dark:border-red-800 leading-relaxed w-full">Motivo: {p.motivoRechazo}</div>}
                </div>

                {puedeCrear && (
                  <div className="lg:col-span-3 flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-start gap-3 mt-4 lg:mt-0 pt-4 lg:pt-0 border-t border-slate-100 dark:border-slate-700 lg:border-none w-full">
                    <div className="flex flex-wrap lg:flex-col gap-2 w-full lg:w-auto items-center lg:items-end">
                      
                      {/* BOTONES EXCLUSIVOS DE "PENDIENTE" O "RECHAZADO" */}
                      {(p.status === 'Pendiente' || p.status === 'Rechazado') && (
                        <>
                          <button onClick={() => cargarPedidoParaEditar(p)} className="bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 dark:text-amber-400 text-xs font-bold py-2 px-4 rounded-lg transition-colors shadow-sm w-full lg:w-auto text-center border border-amber-200 dark:border-amber-800">
                             Corregir / Modificar
                          </button>
                          <button onClick={() => anularPedidoVentas(p)} className="bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 text-xs font-bold py-2 px-4 rounded-lg transition-colors shadow-sm w-full lg:w-auto text-center flex justify-center items-center gap-1.5 border border-red-200 dark:border-red-800/50">
                             <Ban size={14}/> Descartar
                          </button>
                          <button onClick={() => cambiarEstadoPedido(p.id, 'En Espera (Sin Stock)')} className="text-xs text-slate-500 hover:text-amber-500 font-bold underline transition-colors p-2 lg:p-0">
                             Mover a Espera
                          </button>
                        </>
                      )}

                      {p.status === 'Despachado' && (
                        <>
                          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">Guía: {p.guia}</div>
                          <button onClick={() => enviarWhatsApp(p)} className="bg-[#25D366]/10 text-[#128C7E] dark:text-[#25D366] hover:bg-[#25D366]/20 text-xs font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 transition-colors w-full lg:w-auto mt-1"><MessageCircle size={16} /> Notificar</button>
                        </>
                      )}
                    </div>
                    {p.auditado && p.status !== 'Anulado' && <span className="text-emerald-600 font-bold text-[10px] flex items-center justify-end gap-1 mt-1 uppercase tracking-widest w-full lg:w-auto"><ShieldCheck size={14}/> Auditado</span>}
                  </div>
                )}
              </div>
            )})}
          </div>
        </div>
      )}

      {vista === 'espera' && puedeCrear && (
        <div className="animate-in fade-in bg-amber-50 dark:bg-amber-900/10 p-6 rounded-xl border border-amber-200 dark:border-amber-800">
           <h3 className="font-bold text-amber-800 dark:text-amber-500 mb-4 flex items-center gap-2"><Clock/> Clientes en Espera (Sin Stock)</h3>
           {enEspera.length === 0 ? <p className="text-sm text-amber-600 dark:text-amber-400">No hay pedidos en lista de espera.</p> : (
             <div className="space-y-4">
               {enEspera.map(p => (
                 <div key={p.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-amber-100 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-colors">
                   <div className="flex-1 w-full">
                     <div className="font-bold text-lg">{p.clienteNombre}</div>
                     <div className="text-xs opacity-60 mb-2">Desde {new Date(p.fechaCreacion).toLocaleDateString()}</div>
                     <div className="text-[12px] bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700 whitespace-pre-wrap text-slate-600 dark:text-slate-300 font-medium">
                       {typeof p.productos === 'string' ? p.productos : JSON.stringify(p.productos)}
                     </div>
                   </div>
                   <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                     <button onClick={() => cargarPedidoParaEditar(p)} className="bg-amber-100 text-amber-700 px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm hover:bg-amber-200 transition-colors w-full sm:w-auto">Modificar</button>
                     <button onClick={() => anularPedidoVentas(p)} className="bg-red-100 text-red-700 px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm hover:bg-red-200 transition-colors w-full sm:w-auto">Descartar</button>
                     <button onClick={() => cambiarEstadoPedido(p.id, 'Pendiente')} className="bg-sky-600 text-white px-6 py-2.5 rounded-xl font-black text-xs shadow hover:bg-sky-700 transition-colors w-full sm:w-auto">Retomar Pedido</button>
                   </div>
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
        globalDiscountPercent={globalDiscountPercent}
        isGlobalDiscountActive={isGlobalDiscountActive}
        onConfirm={(txt, obj)=>{
          setFormData(prev => ({
            ...prev, 
            productos: prev.productos ? `${prev.productos}\n${txt}` : txt, 
            carritoObj: { ...(prev.carritoObj || {}), ...obj },
            moneda: prev.moneda === 'ZELLE' ? 'ZELLE' : 'USD' 
          })); 
          setIsCatalogOpen(false);
        }}
      />
    </div>
  );
}