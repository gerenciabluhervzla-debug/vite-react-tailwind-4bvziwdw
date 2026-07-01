import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Truck, Clock, Printer, CheckSquare, AlertTriangle, Package, FileText, Camera, CheckCircle, Loader2, UploadCloud, Save, Download, FileSpreadsheet, CalendarDays, FileOutput, MessageSquare, ShieldCheck, Eye, X, Ban } from 'lucide-react';
import { updateDoc, doc, addDoc, collection, onSnapshot, query, orderBy, setDoc, increment } from 'firebase/firestore';
import { URL_GOOGLE_SCRIPT } from '../config/firebase';
import { compressImage } from '../utils/image'; 
import { ROLES, BRAND_LOGO } from '../config/constants';

export default function PanelDespacho({ pedidos, catalogo, stock, cambiarEstado, db, appId, loggear, dialogs, perfil }) {
  const esAuditor = [ROLES.AUDITORIA, ROLES.ADMIN].includes(perfil?.role);
  const esAuditorPuro = perfil?.role === ROLES.AUDITORIA;
  const puedeAnular = [ROLES.ADMIN, ROLES.DESPACHO].includes(perfil?.role);
  
  const esSoloLectura = perfil?.role === ROLES.ADMINISTRACION;
  const puedeHacerCierre = [ROLES.ADMIN, ROLES.DESPACHO].includes(perfil?.role);
  
  const [vistaDespacho, setVistaDespacho] = useState(esAuditorPuro ? 'historial_cierres' : 'pendientes');
  const [filtroFechaHistorial, setFiltroFechaHistorial] = useState('');
  const [previewImage, setPreviewImage] = useState(null);

  const getDirectUrl = (url) => {
    if (!url) return null;
    let id = null;
    if (url.includes('/d/')) {
      const match = url.match(/\/d\/(.+?)\//);
      if (match && match[1]) id = match[1];
    } else if (url.includes('id=')) {
      const match = url.match(/[?&]id=([^&]+)/);
      if (match && match[1]) id = match[1];
    }
    if (id) {
      return `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
    }
    return url;
  };

  const getHoyISO = () => {
    const d = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Caracas"}));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // Excluimos explícitamente los Abonos de la vista de Despacho
  const pedidosValidados = useMemo(() => 
    pedidos.filter(p => p.status === 'Validado' && !p.esAbono && (!p.tipoDespacho || p.tipoDespacho === 'Nacional')),
    [pedidos]
  );

  const pedidosDespachados = useMemo(() => 
    pedidos.filter(p => p.status === 'Despachado' && !p.esAbono && (!p.tipoDespacho || p.tipoDespacho === 'Nacional')),
    [pedidos]
  );

  const pedidosPendientes = useMemo(() => 
    pedidos.filter(p => (p.status === 'Pendiente' || p.status === 'Rechazado') && !p.esAbono && (!p.tipoDespacho || p.tipoDespacho === 'Nacional')).length,
    [pedidos]
  );

  const [guiasInput, setGuiasInput] = useState({});
  const [subiendo, setSubiendo] = useState({ id: null, field: null });

  const [cierres, setCierres] = useState([]);
  const [movimientos, setMovimientos] = useState([]); 
  const [conteoActivo, setConteoActivo] = useState(false);
  const [conteoFisico, setConteoFisico] = useState({});
  const [notasConteo, setNotasConteo] = useState({});
  const [filtroFechaCierre, setFiltroFechaCierre] = useState('');
  
  const [fechaCierreElegida, setFechaCierreElegida] = useState(getHoyISO());

  const numeracionDiaria = useMemo(() => {
    const map = {};
    const agrupados = {};
    
    // Solo pedidos nacionales con fecha, excluyendo Abonos puramente financieros
    pedidos
      .filter(p => !p.esAbono && (!p.tipoDespacho || p.tipoDespacho === 'Nacional'))
      .forEach(p => {
        const fecha = p.fechaDespacho || 'Sin Fecha';
        const tipo = p.tipoDespacho || 'Nacional'; 
        const key = `${fecha}_${tipo}`;
        
        if (!agrupados[key]) agrupados[key] = [];
        agrupados[key].push(p);
      });
      
    Object.values(agrupados).forEach(group => {
      group.sort((a, b) => a.fechaCreacion - b.fechaCreacion);
      group.forEach((p, index) => { map[p.id] = index + 1; });
    });
    
    return map;
  }, [pedidos]);

  useEffect(() => {
    const qCierres = query(collection(db, 'artifacts', appId, 'public', 'data', 'cierres_inventario'), orderBy('timestamp', 'desc'));
    const unsubCierres = onSnapshot(
      qCierres, 
      (snap) => setCierres(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      (error) => {
        console.error("Error escuchando cierres:", error);
      }
    );
    
    const qMovs = query(collection(db, 'artifacts', appId, 'public', 'data', 'movimientos'));
    const unsubMovs = onSnapshot(qMovs, (snap) => setMovimientos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { unsubCierres(); unsubMovs(); };
  }, [db, appId]);

  const hoyKardex = useMemo(() => {
    const aggr = {};
    catalogo.forEach(c => c.productos.forEach(p => p.presentaciones.forEach(pres => {
        aggr[`${p.nombre}|${pres}`] = { ventas: 0, recepcion: 0, ingresos: 0, salidas: 0 };
    })));

    const [year, month, day] = fechaCierreElegida.split('-');
    const tDate = new Date(year, month - 1, day);
    const todayStr = `${String(tDate.getDate()).padStart(2, '0')}/${String(tDate.getMonth() + 1).padStart(2, '0')}/${tDate.getFullYear()}`;
    const startOfDay = tDate.getTime();
    const endOfDay = startOfDay + 86400000;

    const boosterKeys = ["Booster de Hidratacion|Unidad", "Booster de Reparacion|Unidad", "Booster de Nutricion|Unidad", "Booster Profesional|Unidad"];

    // Ignoramos Abonos en el cálculo del Kardex Físico
    pedidos.forEach(p => {
       if (['Validado', 'Despachado'].includes(p.status) && !p.esAbono && p.fechaDespacho === todayStr && (!p.tipoDespacho || p.tipoDespacho === 'Nacional')) {
           
           const carritoTotal = { ...(p.carritoObj || {}) };
           if (p.carritoObsequiosObj) {
               Object.entries(p.carritoObsequiosObj).forEach(([k, qty]) => {
                   carritoTotal[k] = (carritoTotal[k] || 0) + qty;
               });
           }

           let countBoosters = 0;
           Object.entries(carritoTotal).forEach(([k, qty]) => {
               if (aggr[k]) aggr[k].ventas += qty;
               if (boosterKeys.includes(k)) countBoosters += qty;
           });

           if (countBoosters > 0) {
               const concentradosActuales = carritoTotal["Concentrado|Unidad"] || 0;
               if (concentradosActuales < countBoosters) {
                   const faltantes = countBoosters - concentradosActuales;
                   if (aggr["Concentrado|Unidad"]) {
                       aggr["Concentrado|Unidad"].ventas += faltantes;
                   }
               }
           }
       }
    });

    movimientos.forEach(m => {
       if (m.fechaCreacion >= startOfDay && m.fechaCreacion < endOfDay) {
           if (m.tipo === 'TRANSFERENCIA') {
               Object.entries(m.items || {}).forEach(([k, qty]) => {
                   if (aggr[k]) aggr[k].recepcion += qty; 
               });
           } else if (m.tipo === 'INGRESO') {
               Object.entries(m.items || {}).forEach(([k, qty]) => {
                   if (aggr[k]) aggr[k].ingresos += qty;
               });
           } else if (m.tipo === 'SALIDA' && m.status === 'COMPLETADO' && (!m.origen || m.origen === 'envios')) {
               Object.entries(m.items || {}).forEach(([k, qty]) => {
                   if (aggr[k]) aggr[k].salidas += qty;
               });
           }
       }
    });
    
    return aggr;
  }, [pedidos, movimientos, catalogo, fechaCierreElegida]);

  const handleGuiaChange = useCallback((id, field, value) => {
    setGuiasInput(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }, []);

  const handleFileUpload = async (e, id, field) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!URL_GOOGLE_SCRIPT) return dialogs.alert("⚠️ Falta configurar el puente de Google Drive.", "Configuración Faltante");
    
    const pedidoActivo = pedidos.find(p => p.id === id);
    const nombreBase = pedidoActivo?.clienteNombre || 'Sin_Nombre';
    const nombreLimpio = nombreBase.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, '_');
    
    const hoy = new Date();
    const dia = String(hoy.getDate()).padStart(2, '0');
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const anio = hoy.getFullYear();
    const fechaCarpeta = `${dia}-${mes}-${anio}`;

    const numeroAsignado = numeracionDiaria[id] || 1;
    const prefijoE = `E${numeroAsignado}`;

    const carpetaRaiz = field === 'link' ? 'Guias' : 'Fotos_Productos';
    const nombreFinal = `${prefijoE}_${nombreLimpio}_${fechaCarpeta}.jpg`;
    const rutaCarpetas = `${carpetaRaiz}/${fechaCarpeta}`;

    setSubiendo({ id, field });
    try {
        const base64Data = await compressImage(file, 800, 0.7);

        const response = await fetch(URL_GOOGLE_SCRIPT, {
            method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ 
               tokenSecreto: import.meta.env.VITE_UPLOAD_TOKEN,
               fileName: nombreFinal, 
               folderPath: rutaCarpetas,
               mimeType: 'image/jpeg', 
               data: base64Data 
            })
        });
        const result = await response.json();
        
        if (result.url) { 
           const dbField = field === 'link' ? 'linkGuia' : 'linkFotoProductos';
           await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', id), { [dbField]: result.url });
           handleGuiaChange(id, field, result.url); 
           loggear('FOTO_PROCESADA', `Archivo ${nombreFinal} guardado exitosamente`); 
        }
        setSubiendo({ id: null, field: null });
    } catch (error) { 
      console.error(error); 
      dialogs.alert("Error subiendo la foto a Drive.", "Fallo de Red"); 
      setSubiendo({ id: null, field: null }); 
    }
  };

  const guardarAvance = async (pedido) => {
    if (esSoloLectura) return;
    const inputData = guiasInput[pedido.id] || {};
    const updateData = {};
    if (inputData.guia !== undefined) updateData.guia = inputData.guia;
    if (inputData.link !== undefined) updateData.linkGuia = inputData.link;
    if (inputData.fotoProductos !== undefined) updateData.linkFotoProductos = inputData.fotoProductos;

    if (Object.keys(updateData).length === 0) return dialogs.alert("No has agregado nueva información para guardar.", "Sin Cambios");
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', pedido.id), updateData);
      loggear('AVANCE_DESPACHO', `Avance guardado para ${pedido.clienteNombre}`);
      dialogs.alert("Se ha guardado tu avance (Fotos o N° Guía).", "Progreso Guardado");
    } catch (error) { console.error(error); dialogs.alert("Error al intentar guardar el avance.", "Error"); }
  };

  const guardarGuia = async (pedido) => {
    if (esSoloLectura) return;
    const inputData = guiasInput[pedido.id] || {};
    const guiaFinal = inputData.guia !== undefined ? inputData.guia : pedido.guia;
    const linkFinal = (pedido.esMercadoLibre && pedido.linkGuiaML) ? pedido.linkGuiaML : (inputData.link !== undefined ? inputData.link : pedido.linkGuia);
    const fotoFinal = inputData.fotoProductos !== undefined ? inputData.fotoProductos : pedido.linkFotoProductos;

    if (!guiaFinal || !linkFinal || !fotoFinal) {
      return dialogs.alert("⚠️ Faltan datos.\n\nPara archivar el pedido debes tener:\n1. Número de Guía\n2. Foto del recibo de Guía (Ya cubierta si es ML)\n3. Foto del paquete armado", "Información Incompleta");
    }
    
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', pedido.id), { 
        guia: guiaFinal, linkGuia: linkFinal, linkFotoProductos: fotoFinal, status: 'Despachado'
      });
      loggear('PEDIDO_DESPACHADO', `Despacho completado ${pedido.clienteNombre} (Guía: ${guiaFinal})`);
      dialogs.alert("Soportes verificados. El pedido pasó al historial de Despachos.", "Despacho Finalizado");
    } catch(e) { console.error(e); dialogs.alert("Error al intentar archivar el pedido.", "Error"); }
  };

  const forzarEnvioHoy = async (id) => {
    dialogs.confirm("¿Autorizar que este pedido se imprima y se envíe HOY de forma excepcional?", async () => {
      try {
        const getVeneziaTime = () => new Date(new Date().toLocaleString("en-US", {timeZone: "America/Caracas"}));
        const tDate = getVeneziaTime();
        const dd = String(tDate.getDate()).padStart(2, '0');
        const mm = String(tDate.getMonth() + 1).padStart(2, '0');
        const yyyy = tDate.getFullYear();
        const fechaHoy = `${dd}/${mm}/${yyyy}`;

        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', id), { fechaDespacho: fechaHoy });
        loggear('ENVIO_FORZADO', `Se autorizó envío fuera de horario para pedido ${id}`);
        setTimeout(() => dialogs.alert("Envío autorizado exitosamente.", "Actualizado"), 150);
      } catch (error) { console.error(error); }
    }, "Autorizar Excepción");
  };

  const marcarGuiaMLImpresa = async (pedido) => {
    if (pedido.linkGuiaML) {
      window.open(pedido.linkGuiaML, '_blank');
      if (!pedido.guiaMLImpresa && !esSoloLectura) {
         try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', pedido.id), { guiaMLImpresa: true }); } 
         catch(e) { console.error(e); }
      }
    } else {
      dialogs.alert("El asesor de ventas no adjuntó la guía de MercadoLibre para este pedido.", "Guía Faltante");
    }
  };

  const anularEnvio = (pedido) => {
    if (esSoloLectura) return;
    dialogs.prompt(`Estás a punto de CANCELAR el envío de ${pedido.clienteNombre}.\n\nIMPORTANTE: Como esta orden ya estaba en preparación, el sistema DEVOLVERÁ automáticamente los productos al inventario.\n\nEscribe el motivo de la cancelación a última hora:`, async (motivo) => {
      if (!motivo) return;
      
      try {
        const stockRef = doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'stock');
        const updates = {};
        
        const carritoDevolver = { ...(pedido.carritoObj || {}) };
        if (pedido.carritoObsequiosObj) {
           Object.entries(pedido.carritoObsequiosObj).forEach(([k, qty]) => {
              carritoDevolver[k] = (carritoDevolver[k] || 0) + qty;
           });
        }

        let countBoosters = 0;
        const boosterKeys = ["Booster de Hidratacion|Unidad", "Booster de Reparacion|Unidad", "Booster de Nutricion|Unidad", "Booster Profesional|Unidad"];
        Object.entries(carritoDevolver).forEach(([k, qty]) => {
           if (boosterKeys.includes(k)) countBoosters += qty;
        });

        if (countBoosters > 0) {
           const concentradosActuales = carritoDevolver["Concentrado|Unidad"] || 0;
           if (concentradosActuales < countBoosters) {
              carritoDevolver["Concentrado|Unidad"] = concentradosActuales + (countBoosters - concentradosActuales);
           }
        }

        Object.entries(carritoDevolver).forEach(([itemKey, qty]) => { 
            updates[itemKey] = { envios: increment(qty) }; 
        });

        if (Object.keys(updates).length > 0) { 
            await setDoc(stockRef, updates, { merge: true }); 
        }

        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', pedido.id), { 
          status: 'Anulado', 
          motivoAnulacion: `Cancelado en Despacho: ${motivo}`,
          anuladoPor: perfil.nombre,
          fechaAnulacion: Date.now(),
          montoUsd: 0, montoVes: 0, 
          notasAuditoria: [...(pedido.notasAuditoria || []), { fecha: Date.now(), texto: `ENVÍO CANCELADO/DEVUELTO: ${motivo}`, autor: perfil.nombre }]
        });

        loggear('ENVIO_ANULADO', `Despacho canceló envío de ${pedido.clienteNombre}`);
        dialogs.alert("El envío ha sido anulado y la mercancía se ha devuelto al inventario del sistema.", "Operación Completada");
      } catch(e) { 
        console.error(e); 
        dialogs.alert("Ocurrió un error al intentar anular el envío.", "Error"); 
      }
    }, "Cancelar y Devolver Mercancía");
  };

  const iniciarConteo = () => {
    const inicial = {};
    catalogo.forEach(c => c.productos.forEach(p => p.presentaciones.forEach(pres => {
      const key = `${p.nombre}|${pres}`;
      inicial[key] = typeof stock[key] === 'object' ? stock[key].envios : (stock[key] || 0);
    })));
    setConteoFisico(inicial);
    setNotasConteo({});
    setConteoActivo(true);
  };

  const handleConteoChange = useCallback((key, val) => {
    const num = parseInt(val, 10);
    setConteoFisico(prev => ({ ...prev, [key]: isNaN(num) ? 0 : num }));
  }, []);

  const generarCSV = (cierre) => {
    let csv = 'Categoria,Producto,Presentacion,Inicio Dia,Ingresos,Recepcion,Salidas,Ventas/Regalos,Stock Sistema,Conteo Fisico,Diferencia,Estatus,Notas\n';
    cierre.productos.forEach(p => {
      const estatus = p.diferencia === 0 ? 'OK' : (p.diferencia > 0 ? 'SOBRANTE' : 'FALTANTE');
      csv += `"${p.categoria}","${p.nombre}","${p.presentacion}",${p.inicioDia||0},${p.ingresos||0},${p.recepcion||0},${p.salidas||0},${p.ventas||0},${p.sistema},${p.fisico},${p.diferencia},"${estatus}","${p.nota}"\n`;
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
          body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; max-width: 1050px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0ea5e9; padding-bottom: 20px; margin-bottom: 20px; }
          .logo { height: 60px; object-fit: contain; }
          h1 { color: #0f172a; font-weight: 900; margin: 0; font-size: 24px; }
          .meta-info { margin-bottom: 20px; background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between;}
          .meta-box p { margin: 5px 0; font-size: 14px; }
          .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
          .badge-ok { background: #dcfce7; color: #166534; }
          .badge-warn { background: #fee2e2; color: #991b1b; }
          .status-box { padding: 15px; border-radius: 8px; font-weight: 900; text-align: center; border: 1px solid currentColor; margin-bottom: 30px; font-size: 13px; letter-spacing: 1px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th, td { border-bottom: 1px solid #e2e8f0; padding: 12px 6px; text-align: left; }
          th { background-color: #f1f5f9; color: #475569; font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: 1px; }
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
            <h1>Cierre de Inventario: Almacén Envíos</h1>
            <p style="color: #64748b; margin-top: 5px; font-size: 14px;">Departamento de Despacho & Logística</p>
          </div>
          <img src="${BRAND_LOGO}" class="logo" alt="Bluher Logo"/>
        </div>
        <div class="meta-info">
           <div class="meta-box"><p><strong>Fecha del Cierre:</strong> ${cierre.fecha}</p><p><strong>Realizado por:</strong> ${cierre.creadoPor}</p></div>
           <div class="meta-box" style="text-align: right;">
              <p><strong>Items Auditados:</strong> ${cierre.totalItemsAuditados}</p>
              <p><strong>Anomalías:</strong> 
                 <span class="badge ${cierre.anomaliasDetectadas === 0 ? 'badge-ok' : 'badge-warn'}">${cierre.anomaliasDetectadas === 0 ? 'Sin Anomalías' : cierre.anomaliasDetectadas + ' Diferencias detectadas'}</span>
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
              <th style="text-align:center; color:#9333ea;">A Recepción</th>
              <th style="text-align:center; color:#ea580c;">Salidas</th>
              <th style="text-align:center; color:#059669;">Ventas + Regalos</th>
              <th style="text-align:center; background:#f8fafc;">Stock Final (Sis)</th>
              <th style="text-align:center;">Físico Real</th>
              <th style="text-align:center;">Dif.</th>
              <th>Notas</th>
            </tr>
          </thead>
          <tbody>
    `;
    cierre.productos.forEach(p => {
       const claseDif = p.diferencia === 0 ? 'ok' : (p.diferencia < 0 ? 'faltante' : 'sobrante');
       const textDif = p.diferencia === 0 ? 'OK' : (p.diferencia > 0 ? '+'+p.diferencia : p.diferencia);
       const ini = p.inicioDia !== undefined ? p.inicioDia : '-';
       const ing = p.ingresos !== undefined ? p.ingresos : '-';
       const rec = p.recepcion !== undefined ? p.recepcion : '-';
       const sal = p.salidas !== undefined ? p.salidas : '-';
       const vta = p.ventas !== undefined ? p.ventas : '-';

       html += `<tr>
         <td>${p.categoria}</td>
         <td><strong>${p.nombre}</strong><br><span style="color:#64748b; font-size:10px;">${p.presentacion}</span></td>
         <td style="text-align:center;">${ini}</td>
         <td style="text-align:center; color:#2563eb; font-weight:bold;">${ing}</td>
         <td style="text-align:center; color:#9333ea; font-weight:bold;">${rec}</td>
         <td style="text-align:center; color:#ea580c; font-weight:bold;">${sal}</td>
         <td style="text-align:center; color:#059669; font-weight:bold;">${vta}</td>
         <td style="text-align:center; font-weight:bold; font-size:13px; background:#f8fafc;">${p.sistema}</td>
         <td style="text-align:center; font-weight:900; font-size:13px;">${p.fisico}</td>
         <td class="${claseDif}" style="text-align:center;">${textDif}</td>
         <td><i>${p.nota || '-'}</i></td>
       </tr>`;
    });
    html += `</tbody></table>
      <div style="margin-top: 50px; border-top: 1px dashed #cbd5e1; padding-top: 20px; color: #94a3b8; font-size: 11px; text-align: center;">
         Documento generado automáticamente por el Sistema de Gestión Bluher el ${new Date().toLocaleString('es-VE')}
      </div></body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 1000);
  };

  const guardarCierre = async () => {
    dialogs.confirm("¿Estás seguro de registrar el cierre de inventario para la fecha seleccionada?", async () => {
      const productosCierre = [];
      let totalDiferencias = 0;
      
      catalogo.forEach(c => c.productos.forEach(p => p.presentaciones.forEach(pres => {
        const key = `${p.nombre}|${pres}`;
        const kData = hoyKardex[key] || { ventas: 0, recepcion: 0, ingresos: 0, salidas: 0 };
        
        const sistema = typeof stock[key] === 'object' ? stock[key].envios : (stock[key] || 0);
        const inicioDia = sistema + kData.ventas + kData.recepcion + kData.salidas - kData.ingresos;
        const fisico = conteoFisico[key] ?? sistema;
        const diferencia = fisico - sistema; 
        
        if (diferencia !== 0) totalDiferencias++;
        
        productosCierre.push({ 
           categoria: c.categoria, 
           nombre: p.nombre, 
           presentacion: pres, 
           inicioDia,
           recepcion: kData.recepcion,
           salidas: kData.salidas,
           ventas: kData.ventas,
           ingresos: kData.ingresos,
           sistema, 
           fisico, 
           diferencia, 
           nota: notasConteo[key] || '' 
        });
      })));

      const [year, month, day] = fechaCierreElegida.split('-');
      const fechaCierreFormat = `${day}/${month}/${year}`;

      const nuevoCierre = { 
         fecha: fechaCierreFormat, 
         timestamp: Date.now(), 
         creadoPor: perfil?.nombre || 'Despachador', 
         totalItemsAuditados: productosCierre.length, 
         anomaliasDetectadas: totalDiferencias, 
         productos: productosCierre, 
         auditado: false 
      };

      try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'cierres_inventario'), nuevoCierre);
        loggear('CIERRE_INVENTARIO', `Cierre registrado con ${totalDiferencias} diferencias para la fecha ${fechaCierreFormat}.`);
        setConteoActivo(false);
        dialogs.confirm("Cierre guardado con éxito. ¿Deseas descargar el reporte en PDF ahora?", () => { imprimirPDF(nuevoCierre); }, "Reporte Listo");
      } catch (error) { console.error(error); }
    }, "Confirmar Cierre");
  };

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

  const cierresFiltrados = useMemo(() => 
  cierres.filter(c => {
    if (!filtroFechaCierre) return true;
    const fechaFiltro = new Date(filtroFechaCierre);
    const fechaCierre = new Date(c.timestamp);
    return fechaFiltro.toLocaleDateString('es-VE') === fechaCierre.toLocaleDateString('es-VE');
  }),
  [cierres, filtroFechaCierre]
);

  const todayStr = useMemo(() => {
    const getVeneziaTime = () => new Date(new Date().toLocaleString("en-US", {timeZone: "America/Caracas"}));
    const tDate = getVeneziaTime();
    return `${String(tDate.getDate()).padStart(2, '0')}/${String(tDate.getMonth() + 1).padStart(2, '0')}/${tDate.getFullYear()}`;
  }, []);

  const parseDateVzla = (dateStr) => {
      if (!dateStr || dateStr === 'Sin Fecha') return 0;
      const parts = dateStr.split('/');
      return parts.length === 3 ? new Date(parts[2], parts[1] - 1, parts[0]).getTime() : 0;
  };

  const pedidosAMostrar = useMemo(() => {
    let lista = vistaDespacho === 'pendientes' ? pedidosValidados : pedidosDespachados;
    
    if (vistaDespacho === 'historial' && filtroFechaHistorial) {
      const [year, month, day] = filtroFechaHistorial.split('-');
      const fechaFiltroStr = `${day}/${month}/${year}`;
      lista = lista.filter(p => p.fechaDespacho === fechaFiltroStr);
    }
    
    return lista;
  }, [vistaDespacho, pedidosValidados, pedidosDespachados, filtroFechaHistorial]);
  
  const pedidosOrdenados = useMemo(() => {
      return [...pedidosAMostrar].sort((a, b) => {
         const numA = numeracionDiaria[a.id] || 999999;
         const numB = numeracionDiaria[b.id] || 999999;
         return numA - numB;
      });
  }, [pedidosAMostrar, numeracionDiaria]);

  return (
    <div className="bg-white dark:bg-slate-800 p-4 md:p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
      
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end mb-8 border-b border-slate-100 dark:border-slate-700 pb-4 gap-4">
        <div className="w-full xl:w-auto">
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3 mb-4"><Truck className="text-sky-600"/> Logística de Envíos Nacionales</h2>
          
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl w-full md:w-max overflow-x-auto scrollbar-hide">
            {!esAuditorPuro && <button onClick={() => setVistaDespacho('pendientes')} className={`px-4 py-2 text-sm font-bold rounded-lg whitespace-nowrap transition-colors ${vistaDespacho === 'pendientes' ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Por Empacar ({pedidosValidados.length})</button>}
            {!esAuditorPuro && <button onClick={() => setVistaDespacho('historial')} className={`px-4 py-2 text-sm font-bold rounded-lg whitespace-nowrap transition-colors ${vistaDespacho === 'historial' ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Enviados</button>}
            {!esAuditorPuro && puedeHacerCierre && <button onClick={() => setVistaDespacho('inventario')} className={`px-4 py-2 text-sm font-bold rounded-lg whitespace-nowrap transition-colors ${vistaDespacho === 'inventario' ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Cierre Físico</button>}
            <button onClick={() => setVistaDespacho('historial_cierres')} className={`px-4 py-2 text-sm font-bold rounded-lg whitespace-nowrap transition-colors ${vistaDespacho === 'historial_cierres' ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>{esAuditorPuro ? 'Auditar Cierres' : 'Historial de Cierres'}</button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row w-full md:w-auto items-center gap-3">
           {vistaDespacho === 'historial' && (
             <div className="flex items-center gap-2 w-full md:w-auto">
               <CalendarDays className="text-slate-400 shrink-0"/>
               <input 
                 type="date"
                 value={filtroFechaHistorial}
                 onChange={(e) => setFiltroFechaHistorial(e.target.value)}
                 className="p-2 w-full md:w-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold outline-none focus:border-sky-500 transition-colors"
               />
               {filtroFechaHistorial && <button onClick={() => setFiltroFechaHistorial('')} className="text-xs text-red-500 hover:text-red-700 underline font-bold px-2">Limpiar</button>}
             </div>
           )}

           {['pendientes', 'historial'].includes(vistaDespacho) && !esSoloLectura && (
             <button onClick={() => window.print()} className="bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900 font-bold py-2.5 px-5 rounded-xl transition-colors flex items-center gap-2 text-sm shadow-sm w-full md:w-auto justify-center shrink-0">
               <Printer size={18} /> Imprimir Etiquetas ({todayStr})
             </button>
           )}
        </div>
      </div>

      {pedidosPendientes > 0 && vistaDespacho === 'pendientes' && !esSoloLectura && (
        <div className="mb-8 bg-sky-50/50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800 p-5 rounded-xl flex items-start gap-4 shadow-sm animate-in fade-in">
          <div className="p-2 bg-sky-100 dark:bg-sky-900/50 rounded-full text-sky-600 dark:text-sky-400 shrink-0"><Clock size={20} /></div>
          <div>
            <h3 className="text-sky-900 dark:text-sky-300 font-bold text-lg">Órdenes en proceso</h3>
            <p className="text-sky-800/80 dark:text-sky-200/80 text-sm mt-1 font-medium">Hay <strong>{pedidosPendientes} pedido(s)</strong> en revisión por administración. Imprime cuando estén validados.</p>
          </div>
        </div>
      )}

      {['pendientes', 'historial'].includes(vistaDespacho) && (
        <div className="flex flex-col gap-8 w-full">
          {pedidosOrdenados.length === 0 ? (
            <div className="p-10 text-center text-slate-400 italic font-bold border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
              No hay envíos en esta vista o fecha.
            </div>
          ) : pedidosOrdenados.map(p => {
            
            const valorGuia = guiasInput[p.id]?.guia !== undefined ? guiasInput[p.id].guia : (p.guia || '');
            const valorLinkFoto = guiasInput[p.id]?.fotoProductos !== undefined ? guiasInput[p.id].fotoProductos : (p.linkFotoProductos || '');

            const isLinkML = p.esMercadoLibre && !!p.linkGuiaML;
            const valorLinkGuia = isLinkML ? p.linkGuiaML : (guiasInput[p.id]?.link !== undefined ? guiasInput[p.id].link : (p.linkGuia || ''));

            const timeDespacho = parseDateVzla(p.fechaDespacho);
            const timeHoy = parseDateVzla(todayStr);

            const esParaManana = timeDespacho > timeHoy;
            const esAtrasado = timeDespacho > 0 && timeDespacho < timeHoy;

            const cardClass = esParaManana && vistaDespacho === 'pendientes' 
                ? "bg-red-50/80 dark:bg-red-900/20 border-red-300 dark:border-red-800" 
                : esAtrasado && vistaDespacho === 'pendientes'
                ? "bg-amber-50/80 dark:bg-amber-900/20 border-amber-300 dark:border-amber-800"
                : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 hover:border-sky-400";

            return (
              <div key={p.id} className={`relative flex flex-col lg:grid lg:grid-cols-12 gap-4 lg:gap-6 p-5 md:p-6 transition-colors border-2 rounded-2xl shadow-md ${cardClass}`}>
                
                <div className="absolute -top-3 -left-3 bg-[#003366] dark:bg-sky-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-black border-2 border-white dark:border-slate-800 shadow-md">
                  {numeracionDiaria[p.id]}
                </div>
                
                <div className="lg:col-span-3 flex flex-col justify-start">
                  <div className="font-bold text-slate-800 dark:text-slate-100 text-lg flex items-center gap-2">{p.clienteNombre}</div>
                  <div className="text-xs font-black tracking-widest uppercase text-sky-600 dark:text-sky-400 mt-2">{p.courier}</div>
                  <div className="text-xs font-semibold text-slate-500 mt-2">Tel: {p.clienteTelefono}</div>
                  
                  <div className={`text-[11px] font-bold uppercase tracking-wider mt-3 p-2 rounded-lg inline-block w-auto max-w-full break-words ${esParaManana && vistaDespacho === 'pendientes' ? 'bg-red-100 text-red-700 border border-red-200' : esAtrasado && vistaDespacho === 'pendientes' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'text-slate-500 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700'}`}>
                    Sale: {p.fechaDespacho} 
                    {esParaManana && vistaDespacho === 'pendientes' && <span className="block sm:inline sm:ml-1 mt-1 sm:mt-0">(NO IMPRIMIR HOY)</span>}
                    {esAtrasado && vistaDespacho === 'pendientes' && <span className="block sm:inline sm:ml-1 mt-1 sm:mt-0">(ATRASADO - ENVIAR HOY)</span>}
                  </div>

                  {esParaManana && vistaDespacho === 'pendientes' && [ROLES.ADMIN].includes(perfil?.role) && (
                    <button onClick={() => forzarEnvioHoy(p.id)} className="w-full mt-3 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/40 dark:text-red-300 py-2 rounded-xl text-xs font-bold transition-colors">
                      Autorizar Envío Hoy
                    </button>
                  )}
                </div>

                <div className="lg:col-span-5 flex flex-col justify-start mt-2 lg:mt-0">
                  {p.esMercadoLibre && vistaDespacho === 'pendientes' && (
                    <button 
                      onClick={() => !esSoloLectura && marcarGuiaMLImpresa(p)}
                      disabled={esSoloLectura}
                      className={`mb-3 w-full text-left p-3 rounded-xl text-xs font-black flex items-center gap-2 shadow-md uppercase tracking-wider transition-colors ${p.guiaMLImpresa ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-yellow-400 text-slate-900 animate-pulse'} ${esSoloLectura ? 'opacity-75 cursor-default' : ''}`}
                    >
                      {p.guiaMLImpresa ? <CheckCircle size={18} className="shrink-0" /> : <AlertTriangle size={18} className="shrink-0" />}
                      {p.guiaMLImpresa ? 'GUÍA DE MERCADOLIBRE (IMPRESA)' : (esSoloLectura ? 'MERCADOLIBRE (PENDIENTE)' : '¡MERCADOLIBRE! IMPRIMIR GUÍA')}
                    </button>
                  )}

                  <div className="font-medium bg-[#f0f4f8] dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50 mb-3 whitespace-pre-wrap shadow-inner text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">
                    {typeof p.productos === 'string' ? p.productos : JSON.stringify(p.productos)}
                  </div>

                  {p.notaVentas && (
                      <div className="mt-1 mb-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400 p-3 rounded-xl text-xs border border-amber-200 dark:border-amber-800/50 flex items-start gap-2 shadow-sm w-full">
                        <MessageSquare size={16} className="shrink-0 mt-0.5" />
                        <div className="flex-1 whitespace-pre-wrap font-bold">
                          <span className="uppercase tracking-widest text-[9px] block mb-0.5 opacity-70">Nota de Ventas:</span>
                          {p.notaVentas}
                        </div>
                      </div>
                  )}

                  <div className="text-[13px] font-semibold text-slate-600 dark:text-slate-400 flex items-start gap-2 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50">
                    <div className="mt-0.5 text-sky-600"><Package size={16}/></div>
                    {p.direccion}
                  </div>
                </div>

                <div className="lg:col-span-4 flex flex-col justify-start mt-4 lg:mt-0 bg-slate-50/50 dark:bg-slate-900/30 p-4 lg:p-0 rounded-2xl lg:bg-transparent lg:rounded-none border border-slate-200 dark:border-slate-700 lg:border-none">
                  {p.status === 'Despachado' ? (
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm w-full h-full flex flex-col">
                      <div className="text-sm mb-4"><span className="font-bold text-slate-400 uppercase text-[10px] tracking-widest block mb-1">Número de Guía</span> <span className="font-black text-slate-800 dark:text-slate-100 text-lg break-all">{p.guia}</span></div>
                      
                      <div className="flex gap-3 mt-1 mb-5">
                          {p.linkGuia && !p.esMercadoLibre && (
                              <div className="flex-1 relative group cursor-pointer" title="Ver comprobante de envío">
                                  <span className="text-[10px] font-bold text-slate-500 mb-1 block uppercase tracking-widest">Recibo:</span>
                                  <div onClick={() => setPreviewImage(p.linkGuia)} className="block relative h-28 sm:h-32 w-full overflow-hidden rounded-xl border-2 border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer">
                                      <img src={getDirectUrl(p.linkGuia)} alt="Recibo" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                          <Eye className="text-white" size={28} />
                                      </div>
                                  </div>
                              </div>
                          )}
                          {p.linkFotoProductos && (
                              <div className="flex-1 relative group cursor-pointer" title="Ver foto del paquete">
                                  <span className="text-[10px] font-bold text-slate-500 mb-1 block uppercase tracking-widest">Paquete:</span>
                                  <div onClick={() => setPreviewImage(p.linkFotoProductos)} className="block relative h-28 sm:h-32 w-full overflow-hidden rounded-xl border-2 border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer">
                                      <img src={getDirectUrl(p.linkFotoProductos)} alt="Paquete" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                          <Eye className="text-white" size={28} />
                                      </div>
                                  </div>
                              </div>
                          )}
                      </div>

                      <div className="text-xs text-emerald-600 dark:text-emerald-400 font-black mb-auto uppercase tracking-widest flex items-center gap-1"><CheckCircle size={14}/> Despachado OK</div>
                      
                      {!esSoloLectura && (
                        <div className="flex flex-col lg:flex-row gap-3 mt-4">
                          <button onClick={() => cambiarEstado(p.id, 'Validado')} className="flex-1 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 text-xs font-bold underline decoration-slate-300 transition-colors text-left lg:text-center">Corregir</button>
                          {puedeAnular && (
                             <button onClick={() => anularEnvio(p)} className="flex-1 text-red-400 hover:text-red-600 dark:hover:text-red-400 text-xs font-bold flex items-center justify-start lg:justify-end gap-1 transition-colors"><Ban size={14}/> Cancelar Envío</button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border-2 border-sky-100 dark:border-slate-700 shadow-sm flex flex-col gap-3 w-full h-full justify-between">
                      <input type="text" placeholder="N° de Guía Tracking" className={`w-full text-sm p-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl font-bold outline-none transition-colors bg-slate-50 dark:bg-slate-900 dark:text-white ${esSoloLectura ? 'opacity-80' : 'focus:border-sky-500'}`} value={valorGuia} onChange={(e) => handleGuiaChange(p.id, 'guia', e.target.value)} readOnly={esSoloLectura} />
                      
                      <div className="flex flex-col lg:flex-row gap-3">
                          <div className="flex-1 relative w-full">
                            <input type="text" placeholder="URL Recibo" readOnly={isLinkML || esSoloLectura} className={`w-full text-xs p-3 border-2 rounded-xl pr-12 outline-none font-semibold transition-colors dark:bg-slate-900 dark:text-white ${valorLinkGuia ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800/50' : 'border-slate-200 dark:border-slate-600 bg-slate-50'} ${(isLinkML || esSoloLectura) ? 'opacity-70 cursor-not-allowed' : 'focus:border-sky-500'}`} value={valorLinkGuia} onChange={(e) => !isLinkML && handleGuiaChange(p.id, 'link', e.target.value)} />
                            {!esSoloLectura && (
                                <label className={`absolute right-1.5 top-1.5 p-2 rounded-lg transition-colors shadow-sm ${isLinkML ? 'cursor-not-allowed bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400' : 'cursor-pointer'} ${valorLinkGuia && !isLinkML ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400' : 'bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-400 hover:bg-sky-600 hover:text-white'}`} title={isLinkML ? "Guía provista por Ventas" : "Subir Recibo Agencia"}>
                                  {subiendo.id === p.id && subiendo.field === 'link' ? <Loader2 size={16} className="animate-spin" /> : (valorLinkGuia ? <CheckCircle size={16}/> : <UploadCloud size={16} />)}
                                  <input type="file" accept="image/*" className="hidden" onChange={(e) => !isLinkML && handleFileUpload(e, p.id, 'link')} disabled={isLinkML || subiendo.field !== null} />
                                </label>
                            )}
                          </div>
                          <div className="flex-1 relative w-full">
                            <input type="text" placeholder="URL Foto Caja" readOnly={esSoloLectura} className={`w-full text-xs p-3 border-2 rounded-xl pr-12 outline-none font-semibold transition-colors dark:bg-slate-900 dark:text-white ${valorLinkFoto ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800/50' : 'border-slate-200 dark:border-slate-600 bg-slate-50'} ${esSoloLectura ? 'opacity-70 cursor-not-allowed' : 'focus:border-sky-500'}`} value={valorLinkFoto} onChange={(e) => handleGuiaChange(p.id, 'fotoProductos', e.target.value)} />
                            {!esSoloLectura && (
                                <label className={`absolute right-1.5 top-1.5 p-2 rounded-lg cursor-pointer transition-colors shadow-sm ${valorLinkFoto ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400' : 'bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-400 hover:bg-sky-600 hover:text-white'}`} title="Subir Foto del Paquete">
                                  {subiendo.id === p.id && subiendo.field === 'fotoProductos' ? <Loader2 size={16} className="animate-spin" /> : (valorLinkFoto ? <CheckCircle size={16}/> : <Camera size={16} />)}
                                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, p.id, 'fotoProductos')} disabled={subiendo.field !== null} />
                                </label>
                            )}
                          </div>
                      </div>

                      {(valorLinkGuia || valorLinkFoto) && (
                        <div className="flex gap-3 mt-1 mb-1">
                            {valorLinkGuia && !isLinkML && (
                                <div className="flex-1 relative group cursor-pointer" title="Ver comprobante de envío">
                                    <span className="text-[10px] font-bold text-slate-500 mb-1 block uppercase tracking-widest">Recibo:</span>
                                    <div onClick={() => setPreviewImage(valorLinkGuia)} className="block relative h-28 sm:h-32 w-full overflow-hidden rounded-xl border-2 border-slate-200 dark:border-slate-700 shadow-sm">
                                        <img src={getDirectUrl(valorLinkGuia)} alt="Recibo" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Eye className="text-white" size={28} />
                                        </div>
                                    </div>
                                </div>
                            )}
                            {valorLinkFoto && (
                                <div className="flex-1 relative group cursor-pointer" title="Ver foto del paquete">
                                    <span className="text-[10px] font-bold text-slate-500 mb-1 block uppercase tracking-widest">Paquete:</span>
                                    <div onClick={() => setPreviewImage(valorLinkFoto)} className="block relative h-28 sm:h-32 w-full overflow-hidden rounded-xl border-2 border-slate-200 dark:border-slate-700 shadow-sm">
                                        <img src={getDirectUrl(valorLinkFoto)} alt="Paquete" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Eye className="text-white" size={28} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                      )}

                      {!esSoloLectura && (
                        <div className="flex flex-col gap-2 mt-2">
                           <div className="flex flex-col lg:flex-row gap-2">
                             <button onClick={() => guardarAvance(p)} className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white text-xs font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                               <Save size={16}/> Guardar Avance
                             </button>
                             <button onClick={() => guardarGuia(p)} className="flex-1 bg-[#003366] dark:bg-sky-600 hover:bg-[#002244] dark:hover:bg-sky-500 text-white text-xs font-bold py-3 rounded-xl transition-colors shadow-md flex items-center justify-center gap-2">
                               <Truck size={16}/> Archivar
                             </button>
                           </div>
                           
                           {puedeAnular && (
                              <button onClick={() => anularEnvio(p)} className="w-full bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 py-2.5 rounded-xl text-xs font-bold transition-colors border border-red-200 dark:border-red-800/50 flex justify-center items-center gap-1.5 mt-1">
                                 <Ban size={14}/> Cancelar Envío (Devolver Inventario)
                              </button>
                           )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {vistaDespacho === 'inventario' && puedeHacerCierre && !esSoloLectura && (
        <div className="animate-in fade-in">
          {!conteoActivo ? (
            <div className="text-center py-16 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
               <CheckSquare size={64} className="mx-auto text-sky-300 dark:text-sky-800 mb-6" />
               <h3 className="text-2xl font-black text-slate-700 dark:text-slate-200 mb-2">Auditoría Diaria de Despacho</h3>
               <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-8">Compara las cantidades físicas en los anaqueles contra las registradas en el sistema para detectar faltantes o sobrantes.</p>
               <button onClick={iniciarConteo} className="bg-sky-600 hover:bg-sky-700 text-white font-black py-4 px-8 rounded-xl shadow-lg transition-all hover:-translate-y-1">
                 Iniciar Conteo del Día
               </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-sky-50 dark:bg-sky-900/20 p-6 rounded-2xl border border-sky-100 dark:border-sky-800">
                 <div>
                   <h3 className="font-black text-sky-900 dark:text-sky-300 text-lg">Hoja de Trabajo Activa</h3>
                   <p className="text-sm font-medium text-sky-700 dark:text-sky-400">Las casillas ya tienen la cantidad del sistema. Modifica solo donde haya diferencias.</p>
                 </div>
                 <div className="flex gap-3 w-full md:w-auto items-center">
                   <div className="flex items-center gap-2 mr-2 border-r pr-4 border-sky-200 dark:border-sky-800">
                      <label className="text-xs font-bold text-sky-700 dark:text-sky-400 uppercase tracking-widest">Fecha a cerrar:</label>
                      <input 
                         type="date" 
                         value={fechaCierreElegida} 
                         onChange={(e) => setFechaCierreElegida(e.target.value)}
                         className="bg-white dark:bg-slate-800 border border-sky-200 dark:border-sky-700 rounded-lg px-2 py-2 text-sm font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-sky-500"
                      />
                   </div>

                   <button onClick={()=>setConteoActivo(false)} className="flex-1 md:flex-none px-6 py-3 font-bold text-slate-600 bg-white dark:bg-slate-800 rounded-xl hover:bg-slate-100 transition-colors">Cancelar</button>
                   <button onClick={guardarCierre} className="flex-1 md:flex-none px-6 py-3 font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 shadow-md flex items-center justify-center gap-2 transition-transform hover:-translate-y-0.5"><Save size={18}/> Finalizar y Guardar</button>
                 </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                 <table className="w-full text-left text-sm border-collapse min-w-[900px]">
                   <thead>
                     <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                       <th className="p-4 font-black">Producto</th>
                       <th className="p-4 font-black text-center w-24">Inicio Día</th>
                       <th className="p-4 font-black text-center w-24 text-blue-600">Ingresos</th>
                       <th className="p-4 font-black text-center w-24 text-purple-600">A Recepción</th>
                       <th className="p-4 font-black text-center w-24 text-orange-600">Salidas</th>
                       <th className="p-4 font-black text-center w-24 text-emerald-600">Ventas/Obsequios</th>
                       <th className="p-4 font-black text-center w-24">Stock Final</th>
                       <th className="p-4 font-black text-center bg-sky-100 dark:bg-sky-900/40 w-32">Validación Física</th>
                       <th className="p-4 font-black text-center w-28">Diferencia</th>
                       <th className="p-4 font-black">Notas / Justificación</th>
                     </tr>
                   </thead>
                   <tbody>
                     {catalogo.map(c => c.productos.map(p => p.presentaciones.map(pres => {
                        const key = `${p.nombre}|${pres}`;
                        const kData = hoyKardex[key] || { ventas: 0, recepcion: 0, ingresos: 0, salidas: 0 };
                        
                        const sistema = typeof stock[key] === 'object' ? stock[key].envios : (stock[key] || 0);
                        const inicioDia = sistema + kData.ventas + kData.recepcion + kData.salidas - kData.ingresos;
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
                             <td className="p-4 text-center font-bold text-lg text-purple-600">{kData.recepcion}</td>
                             <td className="p-4 text-center font-bold text-lg text-orange-600">{kData.salidas}</td>
                             <td className="p-4 text-center font-bold text-lg text-emerald-600">{kData.ventas}</td>
                             <td className="p-4 text-center font-black text-lg text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-900/30">{sistema}</td>
                             <td className="p-4 text-center bg-sky-50 dark:bg-sky-900/20">
                                <input 
                                  type="number" 
                                  min="0"
                                  className="w-full text-center p-2 rounded-lg font-black text-lg border-2 border-slate-200 dark:border-slate-600 focus:border-sky-500 outline-none bg-white dark:bg-slate-800 dark:text-white"
                                  value={fisico}
                                  onChange={(e) => handleConteoChange(key, e.target.value)}
                                />
                             </td>
                             <td className="p-4 text-center">{badgeDif}</td>
                             <td className="p-4">
                                <input 
                                  type="text" 
                                  placeholder={diferencia !== 0 ? "Requerido: ¿Por qué la diferencia?" : "Opcional..."}
                                  className={`w-full p-2 rounded-lg border-2 outline-none text-sm dark:bg-slate-800 dark:text-white ${diferencia !== 0 && !(notasConteo[key]||'') ? 'border-red-300 focus:border-red-500 bg-red-50' : 'border-slate-200 dark:border-slate-600 focus:border-sky-500'}`}
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

      {vistaDespacho === 'historial_cierres' && (
        <div className="animate-in fade-in space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
             <div>
               <h3 className="font-black text-slate-700 dark:text-slate-200 text-lg flex items-center gap-2"><FileSpreadsheet className="text-emerald-600"/> Reportes Guardados</h3>
               <p className="text-sm text-slate-500">Consulta, descarga o audita cierres de inventario.</p>
             </div>
             <div className="flex items-center gap-3 mt-4 sm:mt-0 w-full sm:w-auto">
               <CalendarDays className="text-slate-400 shrink-0"/>
               <input 
                 type="date" 
                 value={filtroFechaCierre} 
                 onChange={e => setFiltroFechaCierre(e.target.value)}
                 className="p-3 w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-bold outline-none focus:border-sky-500"
               />
               {filtroFechaCierre && <button onClick={()=>setFiltroFechaCierre('')} className="text-xs font-bold text-red-500 hover:text-red-700 underline">Limpiar</button>}
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cierresFiltrados.length === 0 ? (
               <div className="col-span-full py-10 text-center text-slate-400 font-bold italic border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                 No se encontraron cierres de inventario en la fecha seleccionada.
               </div>
            ) : (
               cierresFiltrados.map(cierre => (
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
                       <div className="flex gap-2">
                         <button onClick={() => imprimirPDF(cierre)} className="flex-1 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:hover:bg-rose-900/50 dark:text-rose-400 font-bold rounded-xl flex justify-center items-center gap-2 transition-colors text-sm">
                            <FileOutput size={16}/> PDF
                         </button>
                         <button onClick={() => generarCSV(cierre)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 font-bold rounded-xl flex justify-center items-center gap-2 transition-colors text-sm">
                            <Download size={16}/> Excel
                         </button>
                       </div>

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
               ))
            )}
          </div>
        </div>
      )}

      {/* MODAL PARA PREVISUALIZACIÓN DE IMÁGENES */}
      {previewImage && (
        <div className="fixed inset-0 z-[400] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4">
          <button 
            onClick={() => setPreviewImage(null)} 
            className="absolute top-6 right-6 text-white bg-white/20 p-2 rounded-full hover:bg-white/40 transition-colors">
            <X size={24}/>
          </button>
          <img 
            src={getDirectUrl(previewImage)} 
            alt="Vista previa" 
            className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain"
          />
          <a 
            href={previewImage} 
            target="_blank" 
            rel="noreferrer" 
            className="mt-6 bg-sky-600 hover:bg-sky-500 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2 transition-colors">
            Abrir Original en Google Drive
          </a>
        </div>
      )}
    </div>
  );
}