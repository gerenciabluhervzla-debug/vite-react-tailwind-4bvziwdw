import React, { useState, useMemo, useEffect } from 'react';
import { Store, Bike, Package, Printer, Camera, CheckCircle, Search, Loader2, ClipboardCheck, ShieldCheck, CheckSquare, Save, FileSpreadsheet, Download, FileOutput, AlertTriangle, MessageSquare } from 'lucide-react';
import { updateDoc, doc, addDoc, collection, getDocs, query, orderBy, onSnapshot } from 'firebase/firestore';
import { URL_GOOGLE_SCRIPT } from '../config/firebase';
import { compressImage } from '../utils/image';
import { BRAND_LOGO, ROLES } from '../config/constants';

export default function PanelRecepcion({ pedidos, catalogo = [], stock = {}, perfil, db, appId, loggear, dialogs }) {
  const getHoyISO = () => {
    const d = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Caracas"}));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const esAuditor = [ROLES.AUDITORIA, ROLES.ADMIN].includes(perfil?.role);

  const [busqueda, setBusqueda] = useState('');
  const [fechaFiltro, setFechaFiltro] = useState(getHoyISO());
  const [tipoFiltro, setTipoFiltro] = useState('Todos');
  const [subiendoFotoId, setSubiendoFotoId] = useState(null);
  const [vista, setVista] = useState('pendientes'); 
  
  // Estados para Auditoría y Conteo Físico
  const [cierresGuardados, setCierresGuardados] = useState([]);
  const [cargandoCierres, setCargandoCierres] = useState(false);
  const [conteoActivo, setConteoActivo] = useState(false);
  const [conteoFisico, setConteoFisico] = useState({});
  const [notasConteo, setNotasConteo] = useState({});
  const [movimientos, setMovimientos] = useState([]);

  // Cargar movimientos en tiempo real para el cálculo de Ingresos/Salidas
  useEffect(() => {
    const qMovs = query(collection(db, 'artifacts', appId, 'public', 'data', 'movimientos'));
    const unsubMovs = onSnapshot(qMovs, (snap) => setMovimientos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsubMovs();
  }, [db, appId]);

  // Lógica del Kardex Diario de Recepción
  const hoyKardex = useMemo(() => {
    const aggr = {};
    catalogo.forEach(c => c.productos.forEach(p => p.presentaciones.forEach(pres => {
        aggr[`${p.nombre}|${pres}`] = { ventas: 0, ingresos: 0, salidas: 0 };
    })));

    const getVeneziaTime = () => new Date(new Date().toLocaleString("en-US", {timeZone: "America/Caracas"}));
    const tDate = getVeneziaTime();
    const todayStr = `${String(tDate.getDate()).padStart(2, '0')}/${String(tDate.getMonth() + 1).padStart(2, '0')}/${tDate.getFullYear()}`;
    const startOfDay = new Date(tDate.getFullYear(), tDate.getMonth(), tDate.getDate()).getTime();

    // 1. Sumar Ventas (Pedidos Tienda o Delivery del día)
    pedidos.forEach(p => {
        if (['Validado', 'Despachado'].includes(p.status) && p.fechaDespacho === todayStr && ['Tienda', 'Delivery'].includes(p.tipoDespacho)) {
            if (p.carritoObj) {
                Object.entries(p.carritoObj).forEach(([k, qty]) => {
                    if (aggr[k]) aggr[k].ventas += qty;
                });
            }
        }
    });

    // 2. Sumar Movimientos (Transferencias desde Envíos, Ingresos y Salidas manuales)
    movimientos.forEach(m => {
        if (m.fechaCreacion >= startOfDay) {
            if (m.tipo === 'TRANSFERENCIA') {
                Object.entries(m.items || {}).forEach(([k, qty]) => {
                    if (aggr[k]) aggr[k].ingresos += qty;
                });
            } else if (m.tipo === 'INGRESO' && (!m.destino || m.destino === 'recepcion' || m.destino === 'tienda')) {
                Object.entries(m.items || {}).forEach(([k, qty]) => {
                    if (aggr[k]) aggr[k].ingresos += qty;
                });
            } else if (m.tipo === 'SALIDA' && m.status === 'COMPLETADO' && (m.origen === 'recepcion' || m.origen === 'tienda')) {
                Object.entries(m.items || {}).forEach(([k, qty]) => {
                    if (aggr[k]) aggr[k].salidas += qty;
                });
            }
        }
    });
    
    return aggr;
  }, [pedidos, movimientos, catalogo]);

  const pedidosRecepcionBase = useMemo(() => {
     return pedidos.filter(p => 
        ['Tienda', 'Delivery'].includes(p.tipoDespacho) && !p.esPublico && !['Anulado', 'Rechazado', 'Pendiente'].includes(p.status)
     );
  }, [pedidos]);

  const numeracionDiaria = useMemo(() => {
    const map = {};
    const agrupados = {};

    // Agrupamos por tipo y por fecha para mantener la numeración estable sin importar el filtro activo
    pedidosRecepcionBase.forEach(p => {
       const tipo = p.tipoDespacho || 'Tienda'; 
       const fecha = p.fechaDespacho || 'SinFecha';
       const key = `${tipo}-${fecha}`;
       if (!agrupados[key]) agrupados[key] = [];
       agrupados[key].push(p);
    });

    Object.keys(agrupados).forEach(key => {
       agrupados[key].sort((a, b) => (a.fechaCreacion || 0) - (b.fechaCreacion || 0));
       agrupados[key].forEach((p, index) => { map[p.id] = index + 1; });
    });

    return map;
  }, [pedidosRecepcionBase]);

  const listado = useMemo(() => {
     let filtrados = pedidosRecepcionBase;
     if (vista === 'pendientes') filtrados = filtrados.filter(p => p.status === 'Validado');
     if (vista === 'retiros') filtrados = filtrados.filter(p => p.status === 'Validado' && p.tipoDespacho === 'Tienda');
     if (vista === 'entregados') filtrados = filtrados.filter(p => p.status === 'Despachado');

     if (fechaFiltro) {
        const [year, month, day] = fechaFiltro.split('-');
        filtrados = filtrados.filter(p => p.fechaDespacho === `${day}/${month}/${year}`);
     }
     
     if (tipoFiltro !== 'Todos') filtrados = filtrados.filter(p => p.tipoDespacho === tipoFiltro);
     if (busqueda.trim()) {
        const b = busqueda.toLowerCase();
        filtrados = filtrados.filter(p => String(p.clienteNombre || '').toLowerCase().includes(b) || String(p.retiroNombre || '').toLowerCase().includes(b));
     }
     return filtrados.sort((a, b) => (b.fechaCreacion || 0) - (a.fechaCreacion || 0));
  }, [pedidosRecepcionBase, vista, busqueda, fechaFiltro, tipoFiltro]);

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
    if (!pedido.linkFotoProductos) return dialogs.alert("Toma la foto del paquete primero.", "Foto Requerida");
    dialogs.confirm(`¿Confirmas que este paquete ha sido entregado?`, async () => {
       try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', pedido.id), { status: 'Despachado', fechaEntregaFisica: Date.now() });
       loggear('PAQUETE_ENTREGADO', `Recepción procesó la entrega de: ${pedido.clienteNombre}`);
       } catch(e) { console.error(e); }
    });
  };

  const cargarCierres = async () => {
    setCargandoCierres(true);
    try {
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'cierres_recepcion'), orderBy('timestamp', 'desc'));
        const snap = await getDocs(q);
        setCierresGuardados(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error("Error cargando cierres:", e); } 
    finally { setCargandoCierres(false); }
  };

  useEffect(() => {
    if (vista === 'auditoria') cargarCierres();
  }, [vista, db, appId]);

  const iniciarConteo = () => {
    const inicial = {};
    catalogo.forEach(c => c.productos.forEach(p => p.presentaciones.forEach(pres => {
      const key = `${p.nombre}|${pres}`;
      inicial[key] = typeof stock[key] === 'object' ? (stock[key].recepcion || stock[key].tienda || 0) : 0;
    })));
    setConteoFisico(inicial);
    setNotasConteo({});
    setConteoActivo(true);
  };

  const handleConteoChange = (key, val) => {
    const num = parseInt(val, 10);
    setConteoFisico(prev => ({ ...prev, [key]: isNaN(num) ? 0 : num }));
  };

  const guardarCierre = async () => {
    dialogs.confirm("¿Estás seguro de registrar el cierre físico de Recepción?", async () => {
      const productosCierre = [];
      let totalDiferencias = 0;
      
      catalogo.forEach(c => c.productos.forEach(p => p.presentaciones.forEach(pres => {
        const key = `${p.nombre}|${pres}`;
        const kData = hoyKardex[key] || { ventas: 0, ingresos: 0, salidas: 0 };
        
        const sistema = typeof stock[key] === 'object' ? (stock[key].recepcion || stock[key].tienda || 0) : 0;
        const inicioDia = sistema + kData.ventas + kData.salidas - kData.ingresos;
        const fisico = conteoFisico[key] ?? sistema;
        const diferencia = fisico - sistema; 
        
        if (diferencia !== 0) totalDiferencias++;
        
        productosCierre.push({ 
           categoria: c.categoria, 
           nombre: p.nombre, 
           presentacion: pres,
           inicioDia,
           ingresos: kData.ingresos,
           salidas: kData.salidas,
           ventas: kData.ventas,
           sistema, 
           fisico, 
           diferencia, 
           nota: notasConteo[key] || '' 
        });
      })));

      const nuevoCierre = { 
         fecha: new Date().toLocaleDateString('es-VE'), 
         timestamp: Date.now(), 
         creadoPor: perfil?.nombre || 'Recepcionista', 
         totalItemsAuditados: productosCierre.length, 
         anomaliasDetectadas: totalDiferencias, 
         productos: productosCierre, 
         auditado: false 
      };

      try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'cierres_recepcion'), nuevoCierre);
        loggear('CIERRE_RECEPCION_FISICO', `Cierre de inventario en Recepción registrado con ${totalDiferencias} diferencias.`);
        setConteoActivo(false);
        setVista('auditoria');
        dialogs.confirm("Cierre guardado con éxito. ¿Deseas descargar el reporte en PDF ahora?", () => { imprimirPDF(nuevoCierre); }, "Reporte Listo");
      } catch (error) { console.error(error); dialogs.alert("Error al guardar el cierre.", "Fallo del Sistema"); }
    }, "Confirmar Cierre");
  };

  const generarCSV = (cierre) => {
    let csv = 'Categoria,Producto,Presentacion,Inicio Dia,Ingresos (Envios),Salidas,Ventas,Stock Sistema,Conteo Fisico,Diferencia,Estatus,Notas\n';
    cierre.productos.forEach(p => {
      const estatus = p.diferencia === 0 ? 'OK' : (p.diferencia > 0 ? 'SOBRANTE' : 'FALTANTE');
      csv += `"${p.categoria}","${p.nombre}","${p.presentacion}",${p.inicioDia||0},${p.ingresos||0},${p.salidas||0},${p.ventas||0},${p.sistema},${p.fisico},${p.diferencia},"${estatus}","${p.nota}"\n`;
    });
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' }); 
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Cierre_Recepcion_${cierre.fecha.replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const imprimirPDF = (cierre) => {
    const printWindow = window.open('', '_blank');
    if(!printWindow) return dialogs.alert("Permite las ventanas emergentes (Pop-ups) para generar el PDF.");
    
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Reporte Cierre Recepción - ${cierre.fecha}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; max-width: 1050px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #9333ea; padding-bottom: 20px; margin-bottom: 20px; }
          .logo { height: 60px; object-fit: contain; }
          h1 { color: #0f172a; font-weight: 900; margin: 0; font-size: 24px; text-transform: uppercase; }
          .meta-info { margin-bottom: 20px; background: #faf5ff; padding: 20px; border-radius: 12px; border: 1px solid #e9d5ff; display: flex; justify-content: space-between;}
          .meta-box p { margin: 5px 0; font-size: 14px; }
          .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
          .badge-ok { background: #dcfce7; color: #166534; }
          .badge-warn { background: #fee2e2; color: #991b1b; }
          .status-box { padding: 15px; border-radius: 8px; font-weight: 900; text-align: center; border: 1px solid currentColor; margin-bottom: 30px; font-size: 13px; letter-spacing: 1px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th, td { border-bottom: 1px solid #e2e8f0; padding: 12px 6px; text-align: left; }
          th { background-color: #f8fafc; color: #475569; font-weight: 700; text-transform: uppercase; font-size: 10px; }
          .ok { color: #166534; font-weight: bold; }
          .faltante { color: #dc2626; font-weight: bold; }
          .sobrante { color: #ea580c; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>Cierre de Inventario: Recepción</h1>
            <p style="color: #64748b; margin-top: 5px; font-size: 14px; font-weight: bold;">Auditoría Diaria de Tienda</p>
          </div>
          <img src="${BRAND_LOGO}" class="logo" alt="Bluher Logo"/>
        </div>
        <div class="meta-info">
           <div class="meta-box"><p><strong>Fecha del Cierre:</strong> ${cierre.fecha}</p><p><strong>Operador Responsable:</strong> ${cierre.creadoPor}</p></div>
           <div class="meta-box" style="text-align: right;">
              <p><strong>Total Items Auditados:</strong> ${cierre.totalItemsAuditados}</p>
              <p><strong>Resultado:</strong> 
                 <span class="badge ${cierre.anomaliasDetectadas === 0 ? 'badge-ok' : 'badge-warn'}">${cierre.anomaliasDetectadas === 0 ? 'Inventario Cuadra' : cierre.anomaliasDetectadas + ' Diferencias'}</span>
              </p>
           </div>
        </div>
        <div class="status-box" style="background: ${cierre.auditado ? '#dcfce7' : '#fffbeb'}; color: ${cierre.auditado ? '#166534' : '#b45309'};">
           ${cierre.auditado ? 'AUDITORÍA VALIDADA POR: ' + (cierre.auditadoPor || 'AUDITOR').toUpperCase() : 'CIERRE PENDIENTE DE AUDITORÍA OFICIAL'}
        </div>
        <table>
          <thead>
            <tr>
              <th>Categoría</th>
              <th>Producto</th>
              <th style="text-align:center;">Inicio Día</th>
              <th style="text-align:center; color:#2563eb;">Ingresos</th>
              <th style="text-align:center; color:#ea580c;">Salidas</th>
              <th style="text-align:center; color:#059669;">Ventas</th>
              <th style="text-align:center; background:#f8fafc;">Stock Sist.</th>
              <th style="text-align:center;">Stock Físico</th>
              <th style="text-align:center;">Diferencia</th>
              <th>Notas Adicionales</th>
            </tr>
          </thead>
          <tbody>
    `;
    cierre.productos.forEach(p => {
       const claseDif = p.diferencia === 0 ? 'ok' : (p.diferencia < 0 ? 'faltante' : 'sobrante');
       const textDif = p.diferencia === 0 ? 'OK' : (p.diferencia > 0 ? '+'+p.diferencia : p.diferencia);
       const ini = p.inicioDia !== undefined ? p.inicioDia : '-';
       const ing = p.ingresos !== undefined ? p.ingresos : '-';
       const sal = p.salidas !== undefined ? p.salidas : '-';
       const vta = p.ventas !== undefined ? p.ventas : '-';

       html += `<tr>
         <td>${p.categoria}</td>
         <td><strong>${p.nombre}</strong><br><span style="color:#64748b; font-size:10px;">${p.presentacion}</span></td>
         <td style="text-align:center;">${ini}</td>
         <td style="text-align:center; color:#2563eb; font-weight:bold;">${ing}</td>
         <td style="text-align:center; color:#ea580c; font-weight:bold;">${sal}</td>
         <td style="text-align:center; color:#059669; font-weight:bold;">${vta}</td>
         <td style="text-align:center; font-weight:bold; font-size:13px; background:#f8fafc;">${p.sistema}</td>
         <td style="text-align:center; font-weight:900; font-size:13px;">${p.fisico}</td>
         <td class="${claseDif}" style="text-align:center;">${textDif}</td>
         <td><i>${p.nota || '-'}</i></td>
       </tr>`;
    });
    html += `</tbody></table>
        <div style="margin-top: 50px; text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 20px;">
             <p style="margin-bottom: 40px; color: #1e293b; font-weight: bold;">Firma del Encargado / Auditor</p>
             <p>_____________________________________</p>
        </div>
      </body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 1000);
  };

  const renderTarjetaPedido = (p) => {
    const urlValidacion = p.linkComprobante || p.fotoPago || p.comprobantePago || "";
    const urlProductoFinal = p.linkFotoProductos || ""; // La foto que toma recepción al entregar/preparar
    const urlExtracto = p.linkExtracto || p.extractoBancario || p.fotoExtracto || "";

    return (
      <div key={p.id} className={`relative bg-slate-50 dark:bg-slate-800/50 p-5 rounded-3xl border-2 transition-all shadow-sm flex flex-col h-full ${p.status === 'Despachado' ? 'border-emerald-200 dark:border-emerald-800/50 opacity-80' : p.tipoDespacho === 'Delivery' ? 'border-fuchsia-200 dark:border-fuchsia-800/50' : 'border-purple-200 dark:border-purple-800/50'}`}>
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

        <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 mb-3 text-xs space-y-2">
           <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-900/30 p-2 rounded-lg">
              <MessageSquare size={14} className="flex-shrink-0" /> Asesora: {p.asesora || p.vendedor || p.vendedora || p.creadoPor || 'No especificada'}
           </div>
           <div className="text-[11px] text-slate-600 dark:text-slate-400 break-words pt-1"><strong>Dir:</strong> {p.direccion || 'Retiro en Tienda'}</div>
        </div>

        <div className="text-[11px] bg-white dark:bg-slate-900 p-3 rounded-xl whitespace-pre-wrap font-medium text-slate-600 dark:text-slate-300 mb-3 border border-slate-200 dark:border-slate-700 max-h-32 overflow-y-auto min-h-[60px]">
           <div className="font-black mb-1 uppercase text-[9px] tracking-widest text-slate-400">Contenido:</div>
           {typeof p.productos === 'string' ? p.productos : JSON.stringify(p.productos)}
        </div>

        {/* Galería de adjuntos que incluye la foto del paquete una vez tomada */}
        <div className="flex flex-wrap gap-2.5 mb-4 bg-white dark:bg-slate-950 p-2 rounded-xl border border-slate-100 dark:border-slate-800/60 justify-center">
           {[ {url: urlValidacion, txt: 'Pago'}, {url: urlExtracto, txt: 'Extracto'}, {url: urlProductoFinal, txt: 'Paquete'} ].map(img => (
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
       
       <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4 border-b border-slate-100 dark:border-slate-700 pb-5">
         <div>
            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2.5"><Package className="text-purple-600" /> Recepción Bluher</h2>
         </div>
         <div className="flex flex-wrap gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
           {[
              { id: 'pendientes', label: 'Todos Pendientes' },
              { id: 'retiros', label: 'Por Retirar' },
              { id: 'entregados', label: 'Historial' },
              { id: 'inventario', label: 'Cierre Físico' },
              { id: 'auditoria', label: 'Auditoría / Cierres' }
           ].map(v => (
              <button 
                 key={v.id} 
                 onClick={()=>setVista(v.id)} 
                 className={`px-3 py-2 text-xs font-bold rounded-lg transition-all ${vista===v.id ? 'bg-white dark:bg-slate-700 shadow text-purple-700 dark:text-purple-400':'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              >
                 {v.label}
              </button>
           ))}
         </div>
       </div>

       {/* VISTA: CIERRE FÍSICO */}
       {vista === 'inventario' && (
         <div className="animate-in fade-in">
           {!conteoActivo ? (
             <div className="text-center py-16 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                <CheckSquare size={64} className="mx-auto text-purple-300 dark:text-purple-800 mb-6" />
                <h3 className="text-2xl font-black text-slate-700 dark:text-slate-200 mb-2">Auditoría Diaria de Recepción</h3>
                <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-8">Compara el inventario físico en la tienda contra el registrado en Bluher Sys evaluando el Kárdex de hoy.</p>
                <button onClick={iniciarConteo} className="bg-purple-600 hover:bg-purple-700 text-white font-black py-4 px-8 rounded-xl shadow-lg transition-all hover:-translate-y-1">
                  Iniciar Conteo del Día
                </button>
             </div>
           ) : (
             <div className="space-y-6">
               <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-purple-50 dark:bg-purple-900/20 p-6 rounded-2xl border border-purple-100 dark:border-purple-800">
                  <div>
                    <h3 className="font-black text-purple-900 dark:text-purple-300 text-lg">Hoja de Trabajo Activa</h3>
                    <p className="text-sm font-medium text-purple-700 dark:text-purple-400">Las casillas ya tienen la cantidad final del sistema calculada en base a los movimientos de hoy. Modifica solo donde haya diferencias.</p>
                  </div>
                  <div className="flex gap-3 w-full md:w-auto">
                    <button onClick={()=>setConteoActivo(false)} className="flex-1 md:flex-none px-6 py-3 font-bold text-slate-600 bg-white dark:bg-slate-800 rounded-xl hover:bg-slate-100 transition-colors">Cancelar</button>
                    <button onClick={guardarCierre} className="flex-1 md:flex-none px-6 py-3 font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 shadow-md flex items-center justify-center gap-2 transition-transform hover:-translate-y-0.5"><Save size={18}/> Finalizar y Guardar</button>
                  </div>
               </div>

               <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <table className="w-full text-left text-sm border-collapse min-w-[1000px]">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        <th className="p-4 font-black">Producto</th>
                        <th className="p-4 font-black text-center w-24">Inicio Día</th>
                        <th className="p-4 font-black text-center w-24 text-blue-600">Ingresos</th>
                        <th className="p-4 font-black text-center w-24 text-orange-600">Salidas</th>
                        <th className="p-4 font-black text-center w-24 text-emerald-600">Ventas</th>
                        <th className="p-4 font-black text-center w-24">Stock Sist.</th>
                        <th className="p-4 font-black text-center bg-purple-100 dark:bg-purple-900/40 w-32">Físico Tienda</th>
                        <th className="p-4 font-black text-center w-28">Diferencia</th>
                        <th className="p-4 font-black">Notas / Justificación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {catalogo.map(c => c.productos.map(p => p.presentaciones.map(pres => {
                         const key = `${p.nombre}|${pres}`;
                         const kData = hoyKardex[key] || { ventas: 0, ingresos: 0, salidas: 0 };
                         
                         const sistema = typeof stock[key] === 'object' ? (stock[key].recepcion || stock[key].tienda || 0) : 0;
                         const inicioDia = sistema + kData.ventas + kData.salidas - kData.ingresos;
                         const fisico = conteoFisico[key] ?? sistema;
                         const diferencia = fisico - sistema;
                         
                         let badgeDif = <span className="text-slate-400 font-bold">OK</span>;
                         if (diferencia > 0) badgeDif = <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-black text-xs uppercase tracking-widest">+ {diferencia} (Sob)</span>;
                         if (diferencia < 0) badgeDif = <span className="bg-red-100 text-red-700 px-2 py-1 rounded font-black text-xs uppercase tracking-widest">{diferencia} (Falt)</span>;

                         return (
                           <tr key={key} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="p-4">
                                <div className="font-bold text-slate-800 dark:text-slate-100">{p.nombre}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{pres}</div>
                              </td>
                              <td className="p-4 text-center font-bold text-lg text-slate-500">{inicioDia}</td>
                              <td className="p-4 text-center font-bold text-lg text-blue-600">{kData.ingresos}</td>
                              <td className="p-4 text-center font-bold text-lg text-orange-600">{kData.salidas}</td>
                              <td className="p-4 text-center font-bold text-lg text-emerald-600">{kData.ventas}</td>
                              <td className="p-4 text-center font-black text-lg text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-900/30">{sistema}</td>
                              <td className="p-4 text-center bg-purple-50 dark:bg-purple-900/20">
                                 <input 
                                   type="number" 
                                   min="0"
                                   className="w-full text-center p-2 rounded-lg font-black text-lg border-2 border-slate-200 dark:border-slate-600 focus:border-purple-500 outline-none bg-white dark:bg-slate-800 dark:text-white"
                                   value={fisico}
                                   onChange={(e) => handleConteoChange(key, e.target.value)}
                                 />
                              </td>
                              <td className="p-4 text-center">{badgeDif}</td>
                              <td className="p-4">
                                 <input 
                                   type="text" 
                                   placeholder={diferencia !== 0 ? "Requerido: ¿Por qué la diferencia?" : "Opcional..."}
                                   className={`w-full p-2 rounded-lg border-2 outline-none text-sm dark:bg-slate-800 dark:text-white ${diferencia !== 0 && !(notasConteo[key]||'') ? 'border-red-300 focus:border-red-500 bg-red-50' : 'border-slate-200 dark:border-slate-600 focus:border-purple-500'}`}
                                   value={notasConteo[key] || ''}
                                   onChange={(e) => setNotasConteo(prev => ({...prev, [key]: e.target.value}))}
                                 />
                              </td>
                           </tr>
                         );
                      })))}
                    </tbody>
                  </table>
               </div>
             </div>
           )}
         </div>
       )}

       {/* VISTA: AUDITORÍA DE CIERRES */}
       {vista === 'auditoria' && (
         <div className="animate-in fade-in space-y-6">
           <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div>
                <h3 className="font-black text-slate-700 dark:text-slate-200 text-lg flex items-center gap-2"><FileSpreadsheet className="text-emerald-600"/> Reportes Guardados (Recepción)</h3>
                <p className="text-sm text-slate-500">Consulta y descarga cierres de inventario.</p>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {cargandoCierres ? (
                <div className="col-span-full py-10 flex justify-center"><Loader2 className="animate-spin text-purple-600" size={32} /></div>
             ) : cierresGuardados.length === 0 ? (
                <div className="col-span-full py-10 text-center text-slate-400 font-bold italic border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                  No hay cierres de inventario registrados.
                </div>
             ) : (
                cierresGuardados.map(cierre => (
                  <div key={cierre.id} className="bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                     <div>
                       <div className="flex justify-between items-start mb-4">
                         <div className="bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 px-3 py-1 rounded-lg font-black text-sm tracking-widest">{cierre.fecha}</div>
                         <div className="text-[10px] text-slate-400 font-bold uppercase text-right">Por: {cierre.creadoPor}</div>
                       </div>
                       
                       <div className="space-y-2 mb-6">
                         <div className="flex justify-between text-sm">
                           <span className="font-medium text-slate-500">Items Auditados:</span>
                           <span className="font-black text-slate-700 dark:text-slate-200">{cierre.totalItemsAuditados}</span>
                         </div>
                         <div className="flex justify-between text-sm">
                           <span className="font-medium text-slate-500">Estado:</span>
                           {cierre.anomaliasDetectadas === 0 
                             ? <span className="font-black text-emerald-600 flex items-center gap-1"><CheckCircle size={14}/> Perfecto</span>
                             : <span className="font-black text-red-500 flex items-center gap-1"><AlertTriangle size={14}/> {cierre.anomaliasDetectadas} Diferencias</span>
                           }
                         </div>
                       </div>
                     </div>
                     
                     <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                       <button onClick={() => imprimirPDF(cierre)} className="flex-1 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:hover:bg-rose-900/50 dark:text-rose-400 font-bold rounded-xl flex justify-center items-center gap-2 transition-colors text-sm">
                          <FileOutput size={16}/> PDF
                       </button>
                       <button onClick={() => generarCSV(cierre)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 font-bold rounded-xl flex justify-center items-center gap-2 transition-colors text-sm">
                          <Download size={16}/> Excel
                       </button>
                     </div>
                  </div>
                ))
             )}
           </div>
         </div>
       )}

       {/* VISTAS DE PEDIDOS */}
       {['pendientes', 'retiros', 'entregados'].includes(vista) && (
         <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
               <div className="relative md:col-span-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                  <input type="text" placeholder="Buscar cliente..." className="w-full pl-9 pr-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm font-bold outline-none focus:border-purple-500" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
               </div>
               
               {/* Controles de fecha rediseñados con opción de limpiar filtro */}
               <div className="flex w-full relative">
                  <input type="date" value={fechaFiltro} onChange={(e)=>setFechaFiltro(e.target.value)} className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-l-xl bg-white dark:bg-slate-900 text-sm font-bold outline-none focus:border-purple-500" title="Filtrar por fecha" />
                  <button onClick={()=>setFechaFiltro('')} className={`px-4 border border-l-0 border-slate-200 dark:border-slate-700 rounded-r-xl font-bold text-xs transition-colors outline-none focus:border-purple-500 ${!fechaFiltro ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400' : 'bg-slate-50 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:bg-slate-800'}`} title="Ver todas las fechas">
                     {fechaFiltro ? 'X' : 'Todas'}
                  </button>
               </div>

               <select value={tipoFiltro} onChange={(e)=>setTipoFiltro(e.target.value)} className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm font-bold cursor-pointer outline-none focus:border-purple-500">
                  <option value="Todos">Todos</option>
                  <option value="Tienda">Tienda</option>
                  <option value="Delivery">Delivery</option>
               </select>
            </div>

            {listado.length === 0 ? (
               <div className="p-10 text-center text-slate-400 font-bold border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl">No hay paquetes para mostrar.</div>
            ) : vista === 'entregados' ? (
               <div className="space-y-8">
                  <div>
                     <div className="mb-3 border-b border-purple-100 dark:border-purple-800 pb-1 flex items-center gap-2 text-purple-700 dark:text-purple-400">
                        <Store size={18} /><h3 className="text-lg font-black">Entregas en Tienda</h3>
                     </div>
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {listado.filter(p => p.tipoDespacho === 'Tienda').sort((a, b) => (a.fechaCreacion || 0) - (b.fechaCreacion || 0)).map(p => renderTarjetaPedido(p))}
                     </div>
                  </div>
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
         </>
       )}
    </div>
  );
}