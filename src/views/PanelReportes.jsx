import React, { useMemo } from 'react';
import { DollarSign, Archive, Sparkles } from 'lucide-react';

export default function PanelReportes({ pedidos, catalogo, stock }) {
  const totalVal = useMemo(() => {
    let t = 0;
    Object.entries(stock).forEach(([key, val]) => {
      const c = typeof val === 'object' ? val.envios : val;
      if (c > 0) {
        const [n, pr] = key.split('|');
        catalogo.forEach(cat => cat.productos.forEach(p => { if(p.nombre === n){ const i = p.presentaciones.indexOf(pr); if(i >= 0) t += (c * p.precios[i]); } }));
      }
    });
    return t;
  }, [stock, catalogo]);
  
  const validados = pedidos.filter(p => p.status !== 'Rechazado' && !p.esPublico);
  const sobrantes = validados.reduce((acc, curr) => acc + (curr.sobranteUsd || 0), 0);
  const descuentos = validados.reduce((acc, curr) => acc + (curr.descuentoUsd || 0), 0);
  const totalUSD = validados.reduce((acc, curr) => acc + (curr.montoUsd || 0), 0) - sobrantes;

  const topProductos = useMemo(() => {
    const map = {};
    validados.forEach(p => {
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
  }, [validados, catalogo]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
         <div className="bg-emerald-600 text-white p-10 rounded-[2.5rem] shadow-2xl flex items-center justify-between transition-transform hover:scale-105 border-b-8 border-emerald-800">
            <div>
              <div className="text-xs uppercase font-black tracking-widest opacity-60 mb-1">Cierre Neto Ventas</div>
              <div className="text-5xl font-black">${totalUSD.toFixed(2)}</div>
              {(sobrantes > 0 || descuentos > 0) && <div className="text-xs mt-2 opacity-70 font-bold">Restado: ${sobrantes} Sobrante | ${descuentos.toFixed(2)} Desc.</div>}
            </div>
            <DollarSign size={60} className="opacity-20"/>
         </div>
         <div className="bg-purple-600 text-white p-10 rounded-[2.5rem] shadow-2xl flex items-center justify-between transition-transform hover:scale-105 border-b-8 border-purple-800">
            <div>
              <div className="text-xs uppercase font-black tracking-widest opacity-60 mb-1">Valorización de Almacén</div>
              <div className="text-5xl font-black">${totalVal.toFixed(2)}</div>
            </div>
            <Archive size={60} className="opacity-20"/>
         </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
         <h3 className="text-xl font-black mb-6 text-slate-800 dark:text-slate-100 flex items-center gap-2"><Sparkles className="text-sky-600"/> Top 10 Productos Más Vendidos</h3>
         <div className="overflow-x-auto">
           <table className="w-full text-left text-sm border-collapse">
             <thead>
               <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                 <th className="p-4 border-b dark:border-slate-700 font-bold tracking-wide">Producto y Presentación</th>
                 <th className="p-4 border-b dark:border-slate-700 font-bold tracking-wide text-center">Unidades Vendidas</th>
                 <th className="p-4 border-b dark:border-slate-700 font-bold tracking-wide text-right">Ingreso Generado</th>
               </tr>
             </thead>
             <tbody>
               {topProductos.length === 0 ? <tr><td colSpan="3" className="p-6 text-center text-slate-400 italic">No hay datos para mostrar.</td></tr> : topProductos.map((prod, idx) => (
                  <tr key={prod.key} className="border-b border-slate-50 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                     <td className="p-4">
                        <div className="flex items-center gap-3">
                           <div className="w-6 h-6 rounded-full bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-400 flex items-center justify-center font-black text-xs">{idx + 1}</div>
                           <span className="font-bold text-slate-800 dark:text-slate-100">{prod.key.replace('|', ' - ')}</span>
                        </div>
                     </td>
                     <td className="p-4 text-center font-black text-sky-600 dark:text-sky-400 text-lg">{prod.cantidad}</td>
                     <td className="p-4 text-right font-black text-emerald-600 dark:text-emerald-400 text-lg">${prod.valor.toFixed(2)}</td>
                  </tr>
               ))}
             </tbody>
           </table>
         </div>
      </div>
    </div>
  );
}