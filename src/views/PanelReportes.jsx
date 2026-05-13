import React, { useState, useMemo } from 'react';
import { DollarSign, Archive, Sparkles, CalendarDays, Gift, Store, Percent, TrendingUp } from 'lucide-react';
import { ROLES } from '../config/constants';

export default function PanelReportes({ pedidos, catalogo, stock, perfil }) {
  const [rangoRango, setRangoRango] = useState('hoy');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  const rol = perfil?.role;
  const verTotalInventario = rol === ROLES.ADMIN;
  // Despacho no puede ver dinero en absoluto
  const verDinero = rol !== ROLES.DESPACHO;

  const validados = useMemo(() => {
    return pedidos.filter(p => p.status !== 'Rechazado' && !p.esPublico);
  }, [pedidos]);

  const pedidosFiltrados = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

    return validados.filter(p => {
      if (rangoRango === 'hoy') return p.fechaCreacion >= startOfDay;
      if (rangoRango === 'mes') return p.fechaCreacion >= startOfMonth;
      if (rangoRango === 'año') return p.fechaCreacion >= startOfYear;
      if (rangoRango === 'todo') return true;
      if (rangoRango === 'custom') {
        const start = fechaInicio ? new Date(fechaInicio).getTime() : 0;
        const end = fechaFin ? new Date(fechaFin).getTime() + 86399999 : Infinity;
        return p.fechaCreacion >= start && p.fechaCreacion <= end;
      }
      return true;
    });
  }, [validados, rangoRango, fechaInicio, fechaFin]);

  const metricas = useMemo(() => {
    let ventasUSD = 0;
    let ventasVES = 0;
    let mlUSD = 0;
    let mlVES = 0;
    let regalosUSD = 0;
    let descuentosUSD = 0;

    pedidosFiltrados.forEach(p => {
      let valorOriginalUsd = 0;
      if (p.carritoObj) {
        Object.entries(p.carritoObj).forEach(([key, qty]) => {
          const [n, pr] = key.split('|');
          catalogo.forEach(cat => cat.productos.forEach(prod => {
            if (prod.nombre === n) {
              const idx = prod.presentaciones.indexOf(pr);
              if (idx >= 0 && prod.precios) {
                valorOriginalUsd += (prod.precios[idx] * qty);
              }
            }
          }));
        });
      }

      if (p.esRegalo) {
        regalosUSD += valorOriginalUsd;
      } else {
        ventasUSD += (p.montoUsd || 0);
        ventasVES += (p.montoVes || 0);

        if (p.esMercadoLibre) {
          mlUSD += (p.montoUsd || 0);
          mlVES += (p.montoVes || 0);
        }

        const diferencia = valorOriginalUsd - (p.montoUsd || 0);
        if (diferencia > 0) {
          descuentosUSD += diferencia;
        }
      }
    });

    return { ventasUSD, ventasVES, mlUSD, mlVES, regalosUSD, descuentosUSD };
  }, [pedidosFiltrados, catalogo]);

  const totalValInventario = useMemo(() => {
    let t = 0;
    Object.entries(stock).forEach(([key, val]) => {
      const c = typeof val === 'object' ? val.envios : val;
      if (c > 0) {
        const [n, pr] = key.split('|');
        catalogo.forEach(cat => cat.productos.forEach(p => { 
          if(p.nombre === n){ 
            const i = p.presentaciones.indexOf(pr); 
            if(i >= 0) t += (c * p.precios[i]); 
          } 
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
    return Object.entries(map)
      .map(([key, data]) => ({ key, ...data }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10);
  }, [pedidosFiltrados, catalogo]);

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 transition-colors">
        <div>
          <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-2"><CalendarDays className="text-sky-600"/> Período del Reporte</h2>
          <p className="text-xs font-medium text-slate-500">Las métricas se recalcularán basadas en las fechas seleccionadas.</p>
        </div>
        
        <div className="flex flex-wrap gap-2 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 w-full xl:w-auto">
          <button onClick={()=>setRangoRango('hoy')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${rangoRango === 'hoy' ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Hoy</button>
          <button onClick={()=>setRangoRango('mes')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${rangoRango === 'mes' ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Mes Actual</button>
          <button onClick={()=>setRangoRango('año')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${rangoRango === 'año' ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Este Año</button>
          <button onClick={()=>setRangoRango('todo')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${rangoRango === 'todo' ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Histórico Total</button>
          <button onClick={()=>setRangoRango('custom')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${rangoRango === 'custom' ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Personalizado</button>
        </div>

        {rangoRango === 'custom' && (
          <div className="flex gap-4 items-center w-full xl:w-auto animate-in slide-in-from-left-4">
             <input type="date" value={fechaInicio} onChange={e=>setFechaInicio(e.target.value)} className="p-2.5 text-xs font-bold rounded-xl border-2 border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none focus:border-sky-500" />
             <span className="text-slate-400 font-black">a</span>
             <input type="date" value={fechaFin} onChange={e=>setFechaFin(e.target.value)} className="p-2.5 text-xs font-bold rounded-xl border-2 border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none focus:border-sky-500" />
          </div>
        )}
      </div>

      {(verDinero || verTotalInventario) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {verDinero && (
             <>
               <div className="bg-[#003366] text-white p-8 rounded-[2rem] shadow-xl flex items-center justify-between transition-transform hover:scale-105 border-b-4 border-sky-600 relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="text-[11px] uppercase font-black tracking-widest opacity-70 mb-2">Ventas Netas ($)</div>
                    <div className="text-4xl lg:text-5xl font-black">${metricas.ventasUSD.toFixed(2)}</div>
                  </div>
                  <DollarSign size={80} className="absolute -right-4 -bottom-4 opacity-10"/>
               </div>
               
               <div className="bg-emerald-600 text-white p-8 rounded-[2rem] shadow-xl flex items-center justify-between transition-transform hover:scale-105 border-b-4 border-emerald-800 relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="text-[11px] uppercase font-black tracking-widest opacity-70 mb-2">Ventas Netas (Bs)</div>
                    <div className="text-4xl lg:text-5xl font-black">Bs. {metricas.ventasVES.toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                  </div>
                  <TrendingUp size={80} className="absolute -right-4 -bottom-4 opacity-10"/>
               </div>
             </>
           )}

           {verTotalInventario && (
             <div className="bg-purple-700 text-white p-8 rounded-[2rem] shadow-xl flex items-center justify-between transition-transform hover:scale-105 border-b-4 border-purple-900 relative overflow-hidden">
                <div className="relative z-10">
                  <div className="text-[11px] uppercase font-black tracking-widest text-purple-200 mb-2">Inventario Físico ($)</div>
                  <div className="text-4xl lg:text-5xl font-black">${totalValInventario.toFixed(2)}</div>
                  <div className="text-[10px] font-bold text-purple-300 mt-2 bg-purple-800/50 w-max px-2 py-1 rounded">No se afecta por filtro de fecha</div>
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

      <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
         <div className="flex justify-between items-center mb-6">
           <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2"><Sparkles className="text-sky-600"/> Top 10 Productos Más Vendidos</h3>
           <span className="text-xs font-bold text-sky-600 bg-sky-50 dark:bg-sky-900/30 px-3 py-1 rounded-lg uppercase tracking-wider">En periodo seleccionado</span>
         </div>
         <div className="overflow-x-auto">
           <table className="w-full text-left text-sm border-collapse">
             <thead>
               <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                 <th className="p-4 border-b dark:border-slate-700 font-bold tracking-wide">Producto y Presentación</th>
                 <th className="p-4 border-b dark:border-slate-700 font-bold tracking-wide text-center">Unidades Vendidas</th>
                 {verDinero && <th className="p-4 border-b dark:border-slate-700 font-bold tracking-wide text-right">Ingreso Bruto</th>}
               </tr>
             </thead>
             <tbody>
               {topProductos.length === 0 ? <tr><td colSpan={verDinero ? 3 : 2} className="p-8 text-center text-slate-400 font-bold italic">No hay ventas registradas en las fechas seleccionadas.</td></tr> : topProductos.map((prod, idx) => (
                  <tr key={prod.key} className="border-b border-slate-50 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                     <td className="p-4">
                        <div className="flex items-center gap-3">
                           <div className="w-6 h-6 rounded-full bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-400 flex items-center justify-center font-black text-xs shrink-0">{idx + 1}</div>
                           <span className="font-bold text-slate-800 dark:text-slate-100">{prod.key.replace('|', ' - ')}</span>
                        </div>
                     </td>
                     <td className="p-4 text-center font-black text-sky-600 dark:text-sky-400 text-lg">{prod.cantidad}</td>
                     {verDinero && <td className="p-4 text-right font-black text-emerald-600 dark:text-emerald-400 text-lg">${prod.valor.toFixed(2)}</td>}
                  </tr>
               ))}
             </tbody>
           </table>
         </div>
      </div>
    </div>
  );
}