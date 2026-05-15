import React, { useState, useMemo } from 'react';
import { DollarSign, Archive, Sparkles, CalendarDays, Gift, Store, Percent, TrendingUp, FileOutput, Users } from 'lucide-react';
import { ROLES, BRAND_LOGO } from '../config/constants';

export default function PanelReportes({ pedidos, catalogo, stock, perfil }) {
  const [rangoRango, setRangoRango] = useState('hoy');
  
  const getLocalToday = () => {
    const d = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Caracas"}));
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  
  const [fechaInicio, setFechaInicio] = useState(getLocalToday());
  const [fechaFin, setFechaFin] = useState(getLocalToday());

  const rol = perfil?.role;
  const verTotalInventario = rol === ROLES.ADMIN;
  const verDinero = rol !== ROLES.DESPACHO;

  const validados = useMemo(() => {
    return pedidos.filter(p => p.status !== 'Rechazado' && p.status !== 'Anulado' && !p.esPublico);
  }, [pedidos]);

  const pedidosFiltrados = useMemo(() => {
    const d = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Caracas"}));
    const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const startOfYear = new Date(d.getFullYear(), 0, 1).getTime();

    return validados.filter(p => {
      if (rangoRango === 'hoy') return p.fechaCreacion >= startOfDay;
      if (rangoRango === 'mes') return p.fechaCreacion >= startOfMonth;
      if (rangoRango === 'año') return p.fechaCreacion >= startOfYear;
      if (rangoRango === 'todo') return true;
      if (rangoRango === 'custom') {
        const start = fechaInicio ? new Date(fechaInicio + 'T00:00:00').getTime() : 0;
        const end = fechaFin ? new Date(fechaFin + 'T23:59:59').getTime() : Infinity;
        return p.fechaCreacion >= start && p.fechaCreacion <= end;
      }
      return true;
    });
  }, [validados, rangoRango, fechaInicio, fechaFin]);

  const ventasMesUsdPDF = useMemo(() => {
    const now = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Caracas"}));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return validados
      .filter(p => p.fechaCreacion >= startOfMonth)
      .reduce((sum, p) => sum + (p.montoUsd || 0), 0);
  }, [validados]);

  const metricas = useMemo(() => {
    let ventasUSD = 0; let ventasVES = 0; let ventasZelle = 0; let mlUSD = 0; let mlVES = 0; let regalosUSD = 0; let descuentosUSD = 0;

    pedidosFiltrados.forEach(p => {
      let valorOriginalUsd = 0;
      if (p.carritoObj) {
        Object.entries(p.carritoObj).forEach(([key, qty]) => {
          const [n, pr] = key.split('|');
          catalogo.forEach(cat => cat.productos.forEach(prod => {
            if (prod.nombre === n) {
              const idx = prod.presentaciones.indexOf(pr);
              if (idx >= 0 && prod.precios) { valorOriginalUsd += (prod.precios[idx] * qty); }
            }
          }));
        });
      }

      if (p.esRegalo) {
        regalosUSD += valorOriginalUsd;
      } else {
        if (p.moneda === 'ZELLE') {
           ventasZelle += (p.montoUsd || 0);
        } else {
           ventasUSD += (p.montoUsd || 0);
           ventasVES += (p.montoVes || 0);
        }

        if (p.esMercadoLibre) { mlUSD += (p.montoUsd || 0); mlVES += (p.montoVes || 0); }

        const diferencia = valorOriginalUsd - (p.montoUsd || 0);
        if (diferencia > 0) descuentosUSD += diferencia;
      }
    });

    return { ventasUSD, ventasVES, ventasZelle, mlUSD, mlVES, regalosUSD, descuentosUSD };
  }, [pedidosFiltrados, catalogo]);

  const ventasPorAsesora = useMemo(() => {
      const map = {};
      pedidosFiltrados.forEach(p => {
         if(p.esRegalo) return; 
         const as = p.asesora || 'Sin Asignar';
         if (!map[as]) map[as] = { nombre: as, totalUsd: 0, totalVes: 0, totalZelle: 0, clientes: [] };
         
         if (p.moneda === 'ZELLE') {
             map[as].totalZelle += (p.montoUsd || 0);
         } else {
             map[as].totalUsd += (p.montoUsd || 0);
             map[as].totalVes += (p.montoVes || 0);
         }
         
         map[as].clientes.push({
             nombre: p.clienteNombre,
             telefono: p.clienteTelefono,
             montoUsd: p.montoUsd || 0,
             montoVes: p.montoVes || 0,
             moneda: p.moneda,
             origen: p.origenPedido || 'Sin Origen'
         });
      });
      return Object.values(map).sort((a,b) => (b.totalUsd + b.totalZelle) - (a.totalUsd + a.totalZelle));
  }, [pedidosFiltrados]);

  const totalValInventario = useMemo(() => {
    let t = 0;
    Object.entries(stock).forEach(([key, val]) => {
      const c = typeof val === 'object' ? val.envios : val;
      if (c > 0) {
        const [n, pr] = key.split('|');
        catalogo.forEach(cat => cat.productos.forEach(p => { 
          if(p.nombre === n){ const i = p.presentaciones.indexOf(pr); if(i >= 0) t += (c * p.precios[i]); } 
        }));
      }
    });
    return t;
  }, [stock, catalogo]);

  const topProductos = useMemo(() => {
    const map = {};
    pedidosFiltrados.forEach(p => {
      if (p.carritoObj) {
        Object.entries(p.carritoObj).forEach(([key, qty]) => {
          if (!map[key]) map[key] = { cantidad: 0, valor: 0 };
          map[key].cantidad += qty;
          const [n, pr] = key.split('|');
          let precioUnitario = 0;
          catalogo.forEach(c => c.productos.forEach(prod => {
            if (prod.nombre === n) {
              const idx = prod.presentaciones.indexOf(pr);
              if (idx >= 0) precioUnitario = prod.precios[idx] || 0;
            }
          }));
          map[key].valor += (qty * precioUnitario);
        });
      }
    });
    return Object.entries(map).map(([key, data]) => ({ key, ...data })).sort((a, b) => b.cantidad - a.cantidad).slice(0, 10);
  }, [pedidosFiltrados, catalogo]);

  const imprimirPDFVentas = () => {
    const printWindow = window.open('', '_blank');
    if(!printWindow) return alert("Por favor permite las ventanas emergentes (Pop-ups) para generar el PDF.");

    let periodoEtiqueta = '';
    const d = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Caracas"}));
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    if (rangoRango === 'hoy') {
       periodoEtiqueta = `Hoy (${d.toLocaleDateString('es-VE')})`;
    } else if (rangoRango === 'mes') {
       periodoEtiqueta = `Mes de ${meses[d.getMonth()]} ${d.getFullYear()}`;
    } else if (rangoRango === 'año') {
       periodoEtiqueta = `Año ${d.getFullYear()}`;
    } else if (rangoRango === 'todo') {
       periodoEtiqueta = `Histórico Completo`;
    } else if (rangoRango === 'custom') {
       periodoEtiqueta = `Del ${fechaInicio.split('-').reverse().join('/')} al ${fechaFin.split('-').reverse().join('/')}`;
    }

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Reporte de Ventas Bluher</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; max-width: 900px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0ea5e9; padding-bottom: 20px; margin-bottom: 30px; }
          .logo { height: 60px; object-fit: contain; }
          h1 { color: #0f172a; font-weight: 900; margin: 0; font-size: 24px; text-transform: uppercase; }
          
          .kpi-container { display: flex; gap: 15px; margin-bottom: 30px; }
          .kpi-box { flex: 1; background: #f8fafc; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0; text-align: center; }
          .kpi-box.main { background: #0f172a; color: white; border: none; }
          .kpi-box.zelle { background: #581c87; color: white; border: none; }
          .kpi-box h3 { margin: 0 0 8px 0; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; }
          .kpi-box.main h3, .kpi-box.zelle h3 { color: #38bdf8; }
          .kpi-box.zelle h3 { color: #d8b4fe; }
          .kpi-box p { margin: 0; font-size: 20px; font-weight: 900; }
          .kpi-box.main p, .kpi-box.zelle p { font-size: 26px; }
          
          h2 { font-size: 16px; font-weight: 900; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-top: 40px;}
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
          th, td { border-bottom: 1px solid #e2e8f0; padding: 12px 8px; text-align: left; vertical-align: top; }
          th { background-color: #f1f5f9; color: #475569; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
          .products-list { color: #475569; line-height: 1.5; }
          .zelle-tag { background: #f3e8ff; color: #6b21a8; font-weight: bold; padding: 2px 6px; border-radius: 4px; font-size: 9px; }
          
          @media print { body { padding: 0; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 20px; background: #fffbeb; color: #b45309; padding: 15px; border-radius: 8px; border: 1px solid #fde68a; font-weight: bold; text-align: center;">
           Elige "Guardar como PDF" (Save as PDF) en el menú de impresión que acaba de aparecer.
        </div>

        <div class="header">
          <div>
            <h1>Reporte de Ventas</h1>
            <p style="color: #64748b; margin-top: 5px; font-size: 14px; font-weight: bold;">Periodo: ${periodoEtiqueta}</p>
          </div>
          <img src="${BRAND_LOGO}" class="logo" alt="Bluher Logo"/>
        </div>

        <div class="kpi-container">
           <div class="kpi-box">
              <h3>Ventas en Bs.</h3>
              <p>Bs. ${metricas.ventasVES.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}</p>
           </div>
           <div class="kpi-box main">
              <h3>Ventas Efect/Transf ($)</h3>
              <p>$${metricas.ventasUSD.toFixed(2)}</p>
           </div>
           <div class="kpi-box zelle">
              <h3>Ventas ZELLE ($)</h3>
              <p>$${metricas.ventasZelle.toFixed(2)}</p>
           </div>
           <div class="kpi-box" style="border-color: #c084fc; background: #faf5ff;">
              <h3 style="color: #9333ea;">Acum. General Mes ($)</h3>
              <p style="color: #7e22ce;">$${ventasMesUsdPDF.toFixed(2)}</p>
           </div>
        </div>

        <h2>Rendimiento por Asesora</h2>
    `;
    
    ventasPorAsesora.forEach(asesora => {
       html += `
         <div style="background: #f8fafc; padding: 15px; margin-top: 15px; border-radius: 8px; border-left: 4px solid #0ea5e9;">
            <h3 style="margin: 0 0 10px 0; font-size: 14px;">${asesora.nombre.toUpperCase()}</h3>
            <p style="margin: 0; font-size: 12px; font-weight: bold; color: #475569;">
               Efectivo: <span style="color:#0f172a;">$${asesora.totalUsd.toFixed(2)}</span> | 
               Zelle: <span style="color:#6b21a8;">$${asesora.totalZelle.toFixed(2)}</span> | 
               Bolívares: <span style="color:#059669;">Bs. ${asesora.totalVes.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
            </p>
         </div>
         <table>
            <thead><tr><th style="width:25%;">Cliente Atendido</th><th style="width:20%;">Teléfono</th><th style="width:20%;">Origen Pedido</th><th style="width:15%; text-align:right;">Monto Bs</th><th style="width:20%; text-align:right;">Monto USD / Zelle</th></tr></thead>
            <tbody>
       `;
       asesora.clientes.forEach(c => {
          const isZelle = c.moneda === 'ZELLE';
          html += `<tr>
             <td><strong>${c.nombre}</strong></td>
             <td>${c.telefono}</td>
             <td><span style="background: #eef2ff; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; color: #4338ca;">${c.origen}</span></td>
             <td style="text-align:right; color:#059669;">${isZelle ? '-' : c.montoVes.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
             <td style="text-align:right; font-weight:bold;">$${c.montoUsd.toFixed(2)} ${isZelle ? '<span class="zelle-tag">ZELLE</span>' : ''}</td>
          </tr>`;
       });
       html += `</tbody></table>`;
    });

    html += `
        <h2 style="margin-top: 50px;">Detalle Histórico Global (Todas las Órdenes)</h2>
        <table>
          <thead>
            <tr>
              <th style="width: 20%;">Cliente / Asesora</th>
              <th style="width: 15%;">Ref. / Origen</th>
              <th style="width: 45%;">Productos Facturados</th>
              <th style="text-align:right; width: 10%;">Bs</th>
              <th style="text-align:right; width: 10%;">USD</th>
            </tr>
          </thead>
          <tbody>
    `;

    pedidosFiltrados.forEach(p => {
       const prodsFormat = typeof p.productos === 'string' ? p.productos.replace(/\n/g, '<br>') : JSON.stringify(p.productos);
       const isZelle = p.moneda === 'ZELLE';
       html += `<tr>
         <td><strong>${p.clienteNombre}</strong><br><span style="color:#64748b; font-size:10px;">${new Date(p.fechaCreacion).toLocaleDateString('es-VE')}</span><br><span style="font-size:10px; font-weight:bold;">Asesora: ${p.asesora}</span></td>
         <td><span style="background: #f1f5f9; padding: 4px 6px; border-radius: 4px; font-family: monospace;">${p.referencia || 'N/A'}</span><br><span style="font-size:9px; font-weight:bold; color:#4338ca; display:block; margin-top:4px;">${p.origenPedido || 'Sin Origen'}</span></td>
         <td class="products-list">${prodsFormat}</td>
         <td style="text-align:right; font-weight:bold; color:#059669;">${isZelle ? '-' : (p.montoVes || 0).toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
         <td style="text-align:right; font-weight:900; font-size:13px;">$${(p.montoUsd || 0).toFixed(2)} ${isZelle ? '<br><span class="zelle-tag">ZELLE</span>' : ''}</td>
       </tr>`;
    });

    if (pedidosFiltrados.length === 0) {
      html += `<tr><td colspan="5" style="text-align:center; padding: 30px; font-style: italic; color: #94a3b8;">No se registraron ventas válidas en este periodo.</td></tr>`;
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
    <div className="space-y-8 animate-in fade-in">
      <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-6 transition-colors">
        
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
          <div>
            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-2"><CalendarDays className="text-sky-600"/> Período del Reporte</h2>
            <p className="text-xs font-medium text-slate-500">Las métricas se recalcularán basadas en las fechas seleccionadas.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto items-start sm:items-center">
            <div className="flex overflow-x-auto scrollbar-hide gap-2 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 w-full sm:w-max">
              <button onClick={()=>setRangoRango('hoy')} className={`px-5 py-2.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${rangoRango === 'hoy' ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Hoy</button>
              <button onClick={()=>setRangoRango('mes')} className={`px-5 py-2.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${rangoRango === 'mes' ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Mes Actual</button>
              <button onClick={()=>setRangoRango('año')} className={`px-5 py-2.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${rangoRango === 'año' ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Este Año</button>
              <button onClick={()=>setRangoRango('todo')} className={`px-5 py-2.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${rangoRango === 'todo' ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Histórico Total</button>
              <button onClick={()=>setRangoRango('custom')} className={`px-5 py-2.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${rangoRango === 'custom' ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Personalizado</button>
            </div>
            
            {verDinero && (
              <button onClick={imprimirPDFVentas} className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 text-xs shadow-md transition-colors w-full sm:w-auto shrink-0">
                 <FileOutput size={16}/> Exportar PDF
              </button>
            )}
          </div>
        </div>

        {rangoRango === 'custom' && (
          <div className="flex flex-col sm:flex-row gap-4 items-center w-full animate-in slide-in-from-top-4 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
             <div className="flex-1 w-full">
               <label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 ml-2 block">Desde (Fecha)</label>
               <input type="date" value={fechaInicio} onChange={e=>setFechaInicio(e.target.value)} className="w-full p-3 text-sm font-bold rounded-xl border-2 border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none focus:border-sky-500 transition-colors" />
             </div>
             <div className="flex-1 w-full">
               <label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 ml-2 block">Hasta (Fecha)</label>
               <input type="date" value={fechaFin} onChange={e=>setFechaFin(e.target.value)} className="w-full p-3 text-sm font-bold rounded-xl border-2 border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none focus:border-sky-500 transition-colors" />
             </div>
          </div>
        )}
      </div>

      {(verDinero || verTotalInventario) && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
           {verDinero && (
             <>
               <div className="bg-[#003366] text-white p-6 rounded-[2rem] shadow-xl flex flex-col justify-center transition-transform hover:scale-105 border-b-4 border-sky-600 relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="text-[10px] uppercase font-black tracking-widest opacity-70 mb-1">Efectivo / Transf ($)</div>
                    <div className="text-3xl lg:text-4xl font-black">${metricas.ventasUSD.toFixed(2)}</div>
                  </div>
                  <DollarSign size={80} className="absolute -right-4 -bottom-4 opacity-10"/>
               </div>

               <div className="bg-purple-800 text-white p-6 rounded-[2rem] shadow-xl flex flex-col justify-center transition-transform hover:scale-105 border-b-4 border-purple-950 relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="text-[10px] uppercase font-black tracking-widest opacity-80 text-purple-200 mb-1">Ventas ZELLE ($)</div>
                    <div className="text-3xl lg:text-4xl font-black">${metricas.ventasZelle.toFixed(2)}</div>
                  </div>
                  <DollarSign size={80} className="absolute -right-4 -bottom-4 opacity-10"/>
               </div>
               
               <div className="bg-emerald-600 text-white p-6 rounded-[2rem] shadow-xl flex flex-col justify-center transition-transform hover:scale-105 border-b-4 border-emerald-800 relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="text-[10px] uppercase font-black tracking-widest opacity-70 mb-1">Ventas Netas (Bs)</div>
                    <div className="text-2xl lg:text-3xl font-black">Bs. {metricas.ventasVES.toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                  </div>
                  <TrendingUp size={80} className="absolute -right-4 -bottom-4 opacity-10"/>
               </div>
             </>
           )}

           {verTotalInventario && (
             <div className="bg-slate-800 text-white p-6 rounded-[2rem] shadow-xl flex flex-col justify-center transition-transform hover:scale-105 border-b-4 border-slate-950 relative overflow-hidden">
                <div className="relative z-10">
                  <div className="text-[10px] uppercase font-black tracking-widest text-slate-300 mb-1">Inventario Físico ($)</div>
                  <div className="text-3xl lg:text-4xl font-black">${totalValInventario.toFixed(2)}</div>
                </div>
                <Archive size={80} className="absolute -right-4 -bottom-4 opacity-10"/>
             </div>
           )}
        </div>
      )}

      {verDinero && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4 transition-colors">
            <div className="w-14 h-14 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-500 rounded-2xl flex items-center justify-center shrink-0">
              <Store size={28}/>
            </div>
            <div>
              <div className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">MercadoLibre</div>
              <div className="font-black text-2xl text-slate-800 dark:text-slate-100">${metricas.mlUSD.toFixed(2)}</div>
              <div className="text-[11px] font-bold text-slate-400 mt-0.5">Bs. {metricas.mlVES.toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4 transition-colors">
            <div className="w-14 h-14 bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-500 rounded-2xl flex items-center justify-center shrink-0">
              <Gift size={28}/>
            </div>
            <div>
              <div className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Costo por Obsequios</div>
              <div className="font-black text-2xl text-slate-800 dark:text-slate-100">${metricas.regalosUSD.toFixed(2)}</div>
              <div className="text-[11px] font-bold text-slate-400 mt-0.5">Dinero no ingresado por VIPs</div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4 transition-colors">
            <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-500 rounded-2xl flex items-center justify-center shrink-0">
              <Percent size={28}/>
            </div>
            <div>
              <div className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Impacto Descuentos</div>
              <div className="font-black text-2xl text-slate-800 dark:text-slate-100">${metricas.descuentosUSD.toFixed(2)}</div>
              <div className="text-[11px] font-bold text-slate-400 mt-0.5">Diferencia Vs precio catálogo</div>
            </div>
          </div>
        </div>
      )}

      {/* NUEVA TABLA DE ASESORAS */}
      {verDinero && (
        <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
           <div className="flex items-center gap-2 mb-6">
             <Users className="text-sky-600"/>
             <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">Control de Ventas por Asesoras</h3>
           </div>
           
           <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
             <table className="w-full text-left text-sm border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b dark:border-slate-700">
                    <th className="p-4 font-black tracking-wide">Cliente y Teléfono</th>
                    <th className="p-4 font-black tracking-wide">Origen del Pedido</th>
                    <th className="p-4 font-black tracking-wide text-right">Monto Bs</th>
                    <th className="p-4 font-black tracking-wide text-right">Monto USD / Zelle</th>
                  </tr>
                </thead>
                <tbody>
                   {ventasPorAsesora.length === 0 ? (
                      <tr><td colSpan="4" className="p-8 text-center text-slate-400 font-bold italic">No hay ventas registradas en este periodo.</td></tr>
                   ) : ventasPorAsesora.map((asesora) => (
                      <React.Fragment key={asesora.nombre}>
                         <tr className="bg-sky-50 dark:bg-sky-900/30 border-y border-sky-100 dark:border-sky-800/50">
                            <td colSpan="4" className="p-4">
                               <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                  <span className="font-black text-lg text-sky-800 dark:text-sky-300 uppercase tracking-tighter">{asesora.nombre}</span>
                                  <div className="flex flex-wrap gap-4 text-xs font-bold text-slate-600 dark:text-slate-300">
                                     <span className="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border dark:border-slate-700 shadow-sm">Efectivo: <span className="text-slate-900 dark:text-white">${asesora.totalUsd.toFixed(2)}</span></span>
                                     <span className="bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800/50 shadow-sm">Zelle: ${asesora.totalZelle.toFixed(2)}</span>
                                     <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/50 shadow-sm">Bs. {asesora.totalVes.toLocaleString('es-VE', {minimumFractionDigits:2})}</span>
                                  </div>
                               </div>
                            </td>
                         </tr>
                         {asesora.clientes.map((c, i) => (
                            <tr key={i} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                               <td className="p-4">
                                  <div className="font-bold text-slate-800 dark:text-slate-200">{c.nombre}</div>
                                  <div className="text-xs text-slate-500 font-medium">{c.telefono}</div>
                               </td>
                               <td className="p-4">
                                  <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest border border-indigo-200 dark:border-indigo-800">
                                     {c.origen}
                                  </span>
                               </td>
                               <td className="p-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                  {c.moneda === 'ZELLE' ? '-' : `Bs. ${c.montoVes.toLocaleString('es-VE', {minimumFractionDigits:2})}`}
                               </td>
                               <td className="p-4 text-right">
                                  <span className={`font-black text-base ${c.moneda==='ZELLE' ? 'text-purple-600 dark:text-purple-400' : 'text-slate-800 dark:text-slate-200'}`}>
                                     ${c.montoUsd.toFixed(2)}
                                  </span>
                                  {c.moneda === 'ZELLE' && <span className="ml-2 text-[9px] bg-purple-100 text-purple-700 dark:bg-purple-900/50 px-1.5 py-0.5 rounded font-black border border-purple-200 dark:border-purple-800">ZELLE</span>}
                               </td>
                            </tr>
                         ))}
                      </React.Fragment>
                   ))}
                </tbody>
             </table>
           </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
           <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2"><Sparkles className="text-sky-600"/> Top 10 Productos Más Vendidos</h3>
         </div>
         
         <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-700/50">
            {topProductos.length === 0 ? (
               <div className="p-8 text-center text-slate-400 font-bold italic">No hay ventas registradas en las fechas seleccionadas.</div>
            ) : topProductos.map((prod, idx) => (
               <div key={prod.key} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors rounded-xl gap-4">
                  <div className="flex items-center gap-3 w-full sm:w-1/2">
                     <div className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-400 flex items-center justify-center font-black text-sm shrink-0">{idx + 1}</div>
                     <span className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base leading-tight">{prod.key.replace('|', ' - ')}</span>
                  </div>
                  
                  <div className="flex w-full sm:w-1/2 justify-between sm:justify-end items-center gap-6 pl-11 sm:pl-0">
                     <div className="text-center sm:text-right">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest sm:hidden mb-0.5">Unidades</div>
                        <div className="font-black text-sky-600 dark:text-sky-400 text-lg sm:text-xl">{prod.cantidad}</div>
                     </div>
                     {verDinero && (
                       <div className="text-right">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest sm:hidden mb-0.5">Ingreso Bruto</div>
                          <div className="font-black text-emerald-600 dark:text-emerald-400 text-lg sm:text-xl">${prod.valor.toFixed(2)}</div>
                       </div>
                     )}
                  </div>
               </div>
            ))}
         </div>
      </div>
    </div>
  );
}