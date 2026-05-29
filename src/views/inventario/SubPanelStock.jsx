import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, MessageSquare, TrendingDown, TrendingUp, ArrowRightLeft, Package, Store, Search, Filter } from 'lucide-react';
import { setDoc, doc } from 'firebase/firestore';

export default function SubPanelStock({ lista, notas, stock, movimientos, pedidos = [], db, appId, puedeEditar, loggear, dialogs }) {
  const [localStock, setLocalStock] = useState({});
  const [activeTab, setActiveTab] = useState('envios'); 
  
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');

  const getHoyDDMMYYYY = () => {
    const d = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Caracas"}));
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };
  const getHoyISO = () => {
    const d = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Caracas"}));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const categorias = useMemo(() => {
    const cats = new Set(lista.map(item => item.cat));
    return ['Todas', ...Array.from(cats).filter(Boolean)];
  }, [lista]);

  const metricasDia = useMemo(() => {
    const hoyDDMM = getHoyDDMMYYYY();
    const hoyISO = getHoyISO();
    const map = {};
    
    lista.forEach(i => {
       map[i.key] = { 
         envios: { ingresos: 0, trasladosOut: 0, ventas: 0, salidas: 0 },
         recepcion: { trasladosIn: 0, ventas: 0, salidas: 0 }
       };
    });

    pedidos.forEach(p => {
       const esParaHoy = p.fechaDespacho === hoyDDMM || (!p.fechaDespacho && new Date(p.fechaCreacion).toLocaleDateString('es-VE') === new Date().toLocaleDateString('es-VE'));
       
       if (p.status !== 'Anulado' && p.status !== 'Rechazado' && esParaHoy) {
          const isRecepcion = p.tipoDespacho === 'Tienda' || p.tipoDespacho === 'Delivery';
          
          Object.entries(p.carritoObj || {}).forEach(([key, qty]) => {
             if (map[key]) {
                 if (isRecepcion) map[key].recepcion.ventas += qty;
                 else map[key].envios.ventas += qty;
             }
          });
       }
    });

    movimientos?.forEach(m => {
       const isToday = m.fecha === hoyISO || m.fecha === hoyDDMM || new Date(m.fechaCreacion || Date.now()).toLocaleDateString('es-VE') === new Date().toLocaleDateString('es-VE');
       if (isToday) {
          const type = (m.tipo || '').toUpperCase();
          const itemsObj = m.carritoObj || m.items || {};
          const origen = m.origen ? m.origen.toLowerCase() : 'envios';
          
          Object.entries(itemsObj).forEach(([key, qty]) => {
             if (map[key]) {
                if (type === 'INGRESO') {
                   map[key].envios.ingresos += qty;
                }
                if (type === 'TRANSFERENCIA' || type.includes('TRASLADO')) {
                   map[key].envios.trasladosOut += qty;
                   // CORRECCIÓN: Solo se suma a la métrica de Recepción si ya lo aprobaron.
                   if (m.status === 'COMPLETADO') {
                      map[key].recepcion.trasladosIn += qty;
                   }
                }
                if (type === 'SALIDA' && m.status === 'COMPLETADO') {
                   if (origen === 'recepcion') map[key].recepcion.salidas += qty;
                   else map[key].envios.salidas += qty;
                }
             }
          });
       }
    });

    return map;
  }, [pedidos, movimientos, lista]);

  const listaFiltrada = useMemo(() => {
     let filtrada = lista;
     if (filtroCategoria !== 'Todas') filtrada = filtrada.filter(item => item.cat === filtroCategoria);
     if (busqueda.trim()) {
         const q = busqueda.toLowerCase();
         filtrada = filtrada.filter(item => item.nom.toLowerCase().includes(q) || item.pres.toLowerCase().includes(q));
     }
     return filtrada;
  }, [lista, busqueda, filtroCategoria]);

  useEffect(() => {
    const format = {};
    lista.forEach(i => { format[i.key] = { envios: i.envios, recepcion: i.recepcion }; });
    setLocalStock(format);
  }, [stock, lista]);

  const handleStockChange = (key, almacen, value) => {
    const num = parseInt(value, 10) || 0;
    setLocalStock(prev => ({ ...prev, [key]: { ...prev[key], [almacen]: num } }));
  };

  const guardarStock = async (key, almacen) => {
    const current = typeof stock[key] === 'object' ? stock[key] : { envios: stock[key]||0, recepcion: 0 };
    const next = localStock[key];
    if (!next) return;
    if (current[almacen] === next[almacen]) return; 
    
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'stock'), { [key]: next }, { merge: true });
    loggear('AJUSTE_INVENTARIO_MANUAL', `Se ajustó stock de [${key}] en Almacén ${almacen.toUpperCase()} a: ${next[almacen]}`);
  };

  return (
    <div className="animate-in fade-in flex flex-col gap-4">
      
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
         <div className="flex gap-2 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 w-full lg:w-max overflow-x-auto">
            <button onClick={() => setActiveTab('envios')} className={`flex-1 sm:flex-none px-5 py-2.5 text-sm font-black rounded-xl transition-all whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'envios' ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
              <Package size={18} /> Almacén Envíos
            </button>
            <button onClick={() => setActiveTab('recepcion')} className={`flex-1 sm:flex-none px-5 py-2.5 text-sm font-black rounded-xl transition-all whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'recepcion' ? 'bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
              <Store size={18} /> Almacén Recepción
            </button>
         </div>

         <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <div className="relative w-full sm:w-64">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
               <input type="text" placeholder="Buscar producto..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm font-bold outline-none focus:border-sky-500 transition-colors" />
            </div>
            <div className="relative w-full sm:w-56">
               <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
               <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} className="w-full pl-10 pr-8 py-2.5 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm font-bold outline-none focus:border-sky-500 transition-colors cursor-pointer appearance-none">
                  {categorias.map(c => <option key={c} value={c}>{c}</option>)}
               </select>
            </div>
         </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800">
        <div className={`p-4 border-b font-bold text-sm flex items-center justify-between ${activeTab === 'envios' ? 'bg-sky-50 dark:bg-sky-900/20 border-sky-100 dark:border-sky-800 text-sky-800 dark:text-sky-300' : 'bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800 text-purple-800 dark:text-purple-300'}`}>
            <span>Movimientos de Hoy: {getHoyDDMMYYYY()}</span>
            <span className="text-xs font-semibold bg-white dark:bg-slate-800/80 px-3 py-1 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 hidden sm:inline-block">Edición manual habilitada en Stock Final</span>
        </div>
        
        <table className="w-full text-left text-sm border-collapse min-w-[1000px]">
            <thead>
              {activeTab === 'envios' ? (
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider">
                  <th className="p-4 border-b dark:border-slate-700 font-black">Producto</th>
                  <th className="p-4 border-b dark:border-slate-700 text-center font-black text-slate-400">Inicio Día</th>
                  <th className="p-4 border-b dark:border-slate-700 text-center font-black text-emerald-600 dark:text-emerald-400">Ingresos Fábrica (+)</th>
                  <th className="p-4 border-b dark:border-slate-700 text-center font-black text-amber-600 dark:text-amber-400">A Recepción (-)</th>
                  <th className="p-4 border-b dark:border-slate-700 text-center font-black text-rose-600 dark:text-rose-400">Ventas Nacional (-)</th>
                  <th className="p-4 border-b dark:border-slate-700 text-center font-black text-orange-600 dark:text-orange-400">Daños/Salidas (-)</th>
                  <th className="p-4 border-b dark:border-slate-700 text-center border-l border-slate-200 dark:border-slate-600 bg-sky-100/50 dark:bg-sky-900/30 font-black text-sky-800 dark:text-sky-300">Stock Envíos</th>
                </tr>
              ) : (
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider">
                  <th className="p-4 border-b dark:border-slate-700 font-black">Producto</th>
                  <th className="p-4 border-b dark:border-slate-700 text-center font-black text-slate-400">Inicio Día</th>
                  <th className="p-4 border-b dark:border-slate-700 text-center font-black text-emerald-600 dark:text-emerald-400">Desde Envíos (+)</th>
                  <th className="p-4 border-b dark:border-slate-700 text-center font-black text-fuchsia-600 dark:text-fuchsia-400">Ventas Tienda/Del. (-)</th>
                  <th className="p-4 border-b dark:border-slate-700 text-center font-black text-orange-600 dark:text-orange-400">Daños/Salidas (-)</th>
                  <th className="p-4 border-b dark:border-slate-700 text-center border-l border-slate-200 dark:border-slate-600 bg-purple-100/50 dark:bg-purple-900/30 font-black text-purple-800 dark:text-purple-300">Stock Recepción</th>
                </tr>
              )}
            </thead>
            <tbody>
              {listaFiltrada.map(item => {
                const m = metricasDia[item.key];
                
                const inicioEnvios = item.envios + m.envios.ventas + m.envios.trasladosOut + m.envios.salidas - m.envios.ingresos;
                const inicioRecepcion = item.recepcion + m.recepcion.ventas + m.recepcion.salidas - m.recepcion.trasladosIn;

                if (activeTab === 'envios') {
                  return (
                    <tr key={item.key} className="border-b border-slate-50 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-slate-800 dark:text-slate-100 text-sm">{item.nom}</div>
                        <div className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-black px-2 py-0.5 rounded inline-block mt-1 uppercase tracking-widest">{item.pres}</div>
                      </td>
                      <td className="p-4 text-center font-black text-slate-400 text-lg">{inicioEnvios}</td>
                      <td className="p-4 text-center">
                        {m.envios.ingresos > 0 ? <span className="font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-lg text-sm flex items-center justify-center gap-1"><TrendingUp size={14}/> {m.envios.ingresos}</span> : <span className="text-slate-300 dark:text-slate-600 font-bold">-</span>}
                      </td>
                      <td className="p-4 text-center">
                        {m.envios.trasladosOut > 0 ? <span className="font-black text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded-lg text-sm flex items-center justify-center gap-1"><ArrowRightLeft size={14}/> {m.envios.trasladosOut}</span> : <span className="text-slate-300 dark:text-slate-600 font-bold">-</span>}
                      </td>
                      <td className="p-4 text-center">
                        {m.envios.ventas > 0 ? <span className="font-black text-rose-600 bg-rose-50 dark:bg-rose-900/30 px-2 py-1 rounded-lg text-sm flex items-center justify-center gap-1"><TrendingDown size={14}/> {m.envios.ventas}</span> : <span className="text-slate-300 dark:text-slate-600 font-bold">-</span>}
                      </td>
                      <td className="p-4 text-center">
                        {m.envios.salidas > 0 ? <span className="font-black text-orange-600 bg-orange-50 dark:bg-orange-900/30 px-2 py-1 rounded-lg text-sm flex items-center justify-center gap-1"><TrendingDown size={14}/> {m.envios.salidas}</span> : <span className="text-slate-300 dark:text-slate-600 font-bold">-</span>}
                      </td>
                      <td className="p-4 text-center border-l border-slate-200 dark:border-slate-600 bg-sky-50/30 dark:bg-sky-900/10">
                        {puedeEditar ? (
                          <input type="number" min="0" value={localStock[item.key]?.envios ?? item.envios} onChange={e=>handleStockChange(item.key, 'envios', e.target.value)} onBlur={()=>guardarStock(item.key, 'envios')} className="w-20 border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 focus:border-sky-500 text-center font-black rounded-lg p-1.5 outline-none transition-colors dark:text-white shadow-inner text-sky-800 dark:text-sky-400" />
                        ) : <span className="font-black text-xl text-sky-800 dark:text-sky-400">{item.envios}</span>}
                      </td>
                    </tr>
                  );
                }

                // TAB RECEPCIÓN
                return (
                  <tr key={item.key} className="border-b border-slate-50 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-slate-800 dark:text-slate-100 text-sm">{item.nom}</div>
                      <div className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-black px-2 py-0.5 rounded inline-block mt-1 uppercase tracking-widest">{item.pres}</div>
                    </td>
                    <td className="p-4 text-center font-black text-slate-400 text-lg">{inicioRecepcion}</td>
                    <td className="p-4 text-center">
                      {m.recepcion.trasladosIn > 0 ? <span className="font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-lg text-sm flex items-center justify-center gap-1"><ArrowRightLeft size={14}/> {m.recepcion.trasladosIn}</span> : <span className="text-slate-300 dark:text-slate-600 font-bold">-</span>}
                    </td>
                    <td className="p-4 text-center">
                      {m.recepcion.ventas > 0 ? <span className="font-black text-fuchsia-600 bg-fuchsia-50 dark:bg-fuchsia-900/30 px-2 py-1 rounded-lg text-sm flex items-center justify-center gap-1"><TrendingDown size={14}/> {m.recepcion.ventas}</span> : <span className="text-slate-300 dark:text-slate-600 font-bold">-</span>}
                    </td>
                    <td className="p-4 text-center">
                      {m.recepcion.salidas > 0 ? <span className="font-black text-orange-600 bg-orange-50 dark:bg-orange-900/30 px-2 py-1 rounded-lg text-sm flex items-center justify-center gap-1"><TrendingDown size={14}/> {m.recepcion.salidas}</span> : <span className="text-slate-300 dark:text-slate-600 font-bold">-</span>}
                    </td>
                    <td className="p-4 text-center border-l border-slate-200 dark:border-slate-600 bg-purple-50/30 dark:bg-purple-900/10">
                      {puedeEditar ? (
                        <input type="number" min="0" value={localStock[item.key]?.recepcion ?? item.recepcion} onChange={e=>handleStockChange(item.key, 'recepcion', e.target.value)} onBlur={()=>guardarStock(item.key, 'recepcion')} className="w-20 border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 focus:border-purple-500 text-center font-black rounded-lg p-1.5 outline-none transition-colors dark:text-white shadow-inner text-purple-800 dark:text-purple-400" />
                      ) : <span className="font-black text-xl text-purple-800 dark:text-purple-400">{item.recepcion}</span>}
                    </td>
                  </tr>
                );
              })}
              {listaFiltrada.length === 0 && (
                <tr>
                   <td colSpan="7" className="p-8 text-center text-slate-400 font-bold italic border-b-0">
                      No se encontraron productos que coincidan con la búsqueda.
                   </td>
                </tr>
              )}
            </tbody>
        </table>
      </div>
    </div>
  );
}