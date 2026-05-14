import React, { useState, useMemo } from 'react';
import { FileSpreadsheet, CalendarDays, TrendingUp, DollarSign, ShoppingBag, Search, FileOutput, Sparkles } from 'lucide-react';
import { BRAND_LOGO } from '../config/constants';

export default function PanelReportes({ perfil, pedidos, catalogo, stock }) {
  const getVeneziaDate = () => {
    const d = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Caracas"}));
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const hoy = getVeneziaDate();
  
  const [fechaInicio, setFechaInicio] = useState(hoy);
  const [fechaFin, setFechaFin] = useState(hoy);
  
  const verDinero = perfil?.role === 'ADMIN' || perfil?.role === 'ADMINISTRACION' || perfil?.role === 'AUDITORIA';

  const pedidosFiltrados = useMemo(() => {
    if (!fechaInicio || !fechaFin) return [];
    const fInicio = new Date(fechaInicio + 'T00:00:00').getTime();
    const fFin = new Date(fechaFin + 'T23:59:59').getTime();
    return pedidos.filter(p => {
      if(p.status === 'Rechazado' || p.status === 'Pendiente') return false;
      return p.fechaCreacion >= fInicio && p.fechaCreacion <= fFin;
    });
  }, [pedidos, fechaInicio, fechaFin]);

  const totales = useMemo(() => {
    let usd = 0; let ves = 0; let count = 0;
    pedidosFiltrados.forEach(p => {
      usd += (p.montoUsd || 0);
      ves += (p.montoVes || 0);
      count++;
    });
    return { usd, ves, count };
  }, [pedidosFiltrados]);

  const topProductos = useMemo(() => {
    const conteo = {};
    pedidosFiltrados.forEach(p => {
      if (p.carritoObj) {
        Object.entries(p.carritoObj).forEach(([key, qty]) => {
          if(!conteo[key]) conteo[key] = { cantidad: 0, valor: 0 };
          conteo[key].cantidad += qty;
          const [nombre, pres] = key.split('|');
          let price = 0;
          catalogo.forEach(c => c.productos.forEach(prod => {
            if(prod.nombre === nombre) {
               const idx = prod.presentaciones.indexOf(pres);
               if(idx >= 0 && prod.precios) price = prod.precios[idx];
            }
          }));
          conteo[key].valor += (price * qty);
        });
      }
    });
    return Object.entries(conteo).map(([key, data]) => ({ key, ...data })).sort((a,b) => b.cantidad - a.cantidad).slice(0, 10);
  }, [pedidosFiltrados, catalogo]);

  const imprimirPDFVentas = () => {
    const printWindow = window.open('', '_blank');
    if(!printWindow) return alert("Por favor permite las ventanas emergentes (Pop-ups) para generar el PDF.");
    
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
          h1 { color: #0f172a; font-weight: 900; margin: 0; font-size: 24px; }
          .meta-info { margin-bottom: 30px; background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between;}
          .meta-box p { margin: 5px 0; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
          th, td { border-bottom: 1px solid #e2e8f0; padding: 12px 8px; text-align: left; vertical-align: top; }
          th { background-color: #f1f5f9; color: #475569; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; }
          .total-box { margin-top: 30px; padding: 20px; background: #0f172a; color: white; border-radius: 12px; text-align: right; }
          .total-box h3 { margin: 0 0 10px 0; color: #38bdf8; text-transform: uppercase; letter-spacing: 2px; font-size: 14px; }
          .total-box .big-number { font-size: 32px; font-weight: 900; margin: 0; }
          .total-box .sub-number { font-size: 18px; color: #cbd5e1; margin: 5px 0 0 0; }
          @media print { body { padding: 0; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 20px; background: #fffbeb; color: #b45309; padding: 15px; border-radius: 8px; border: 1px solid #fde68a; font-weight: bold; text-align: center;">
           Elige "Guardar como PDF" (Save as PDF) en el menú de impresión que acaba de aparecer.
        </div>

        <div class="header">
          <div>
            <h1>Reporte Detallado de Ventas</h1>
            <p style="color: #64748b; margin-top: 5px; font-size: 14px;">Periodo: ${fechaInicio} al ${fechaFin}</p>
          </div>
          <img src="${BRAND_LOGO}" class="logo" alt="Bluher Logo"/>
        </div>

        <table>
          <thead>
            <tr><th>Cliente</th><th>Referencia</th><th>Productos</th><th style="text-align:right;">Monto Bs</th><th style="text-align:right;">Monto $</th></tr>
          </thead>
          <tbody>
    `;

    pedidosFiltrados.forEach(p => {
       const prodsFormat = typeof p.productos === 'string' ? p.productos.replace(/\n/g, '<br>') : JSON.stringify(p.productos);
       html += `<tr>
         <td><strong>${p.clienteNombre}</strong><br><span style="color:#64748b; font-size:10px;">${new Date(p.fechaCreacion).toLocaleDateString('es-VE')}</span></td>
         <td>${p.referencia}</td>
         <td style="color:#475569;">${prodsFormat}</td>
         <td style="text-align:right; font-weight:bold; color:#059669;">Bs ${(p.montoVes || 0).toFixed(2)}</td>
         <td style="text-align:right; font-weight:bold; font-size:14px;">$${(p.montoUsd || 0).toFixed(2)}</td>
       </tr>`;
    });

    html += `</tbody></table>
      
      <div class="total-box">
         <h3>Ventas Totales del Periodo</h3>
         <p class="big-number">$${totales.usd.toFixed(2)} USD</p>
         <p class="sub-number">Bs. ${totales.ves.toFixed(2)}</p>
         <p style="font-size:12px; color:#64748b; margin-top:15px;">Total de pedidos procesados: ${totales.count}</p>
      </div>

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
      <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
        <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3 mb-6"><FileSpreadsheet className="text-sky-600"/> Centro de Reportes</h2>
        <div className="flex flex-col md:flex-row gap-4 items-end bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="flex-1 w-full">
             <label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 ml-2">Desde (Fecha)</label>
             <input type="date" value={fechaInicio} onChange={e=>setFechaInicio(e.target.value)} className="w-full p-3.5 border-2 border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 font-bold outline-none focus:border-sky-500" />
          </div>
          <div className="flex-1 w-full">
             <label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 ml-2">Hasta (Fecha)</label>
             <input type="date" value={fechaFin} onChange={e=>setFechaFin(e.target.value)} className="w-full p-3.5 border-2 border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 font-bold outline-none focus:border-sky-500" />
          </div>
          {verDinero && (
            <button onClick={imprimirPDFVentas} className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-3.5 px-6 rounded-xl flex items-center gap-2 shadow-md w-full md:w-auto transition-transform hover:-translate-y-0.5 justify-center">
              <FileOutput size={18}/> Descargar PDF
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-4 transition-colors">
          <div className="w-14 h-14 rounded-2xl bg-sky-50 dark:bg-sky-900/30 flex items-center justify-center text-sky-600 dark:text-sky-400"><ShoppingBag size={24}/></div>
          <div><div className="text-sm font-bold text-slate-400 uppercase tracking-widest">Pedidos</div><div className="text-3xl font-black text-slate-800 dark:text-slate-100">{totales.count}</div></div>
        </div>
        {verDinero && (
          <>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-4 transition-colors">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400"><DollarSign size={24}/></div>
              <div><div className="text-sm font-bold text-slate-400 uppercase tracking-widest">Ingresos USD</div><div className="text-3xl font-black text-slate-800 dark:text-slate-100">${totales.usd.toFixed(2)}</div></div>
            </div>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-4 transition-colors">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400"><TrendingUp size={24}/></div>
              <div><div className="text-sm font-bold text-slate-400 uppercase tracking-widest">Ingresos Bs</div><div className="text-3xl font-black text-slate-800 dark:text-slate-100">Bs. {totales.ves.toFixed(2)}</div></div>
            </div>
          </>
        )}
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
           <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2"><Sparkles className="text-sky-600"/> Top 10 Productos Más Vendidos</h3>
           <span className="text-xs font-bold text-sky-600 bg-sky-50 dark:bg-sky-900/30 px-3 py-1 rounded-lg uppercase tracking-wider">En periodo seleccionado</span>
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