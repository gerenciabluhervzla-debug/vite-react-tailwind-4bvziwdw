import React, { useState, useMemo } from 'react';
import { Users, Search, ShoppingBag, CalendarClock, DollarSign, Award } from 'lucide-react';

export default function PanelClientes({ pedidos }) {
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState('fecha'); // 'fecha' | 'compras' | 'gasto'

  const clientes = useMemo(() => {
     const map = {};

     pedidos.forEach(p => {
        // Ignoramos pedidos no concretados
        if(p.status === 'Anulado' || p.status === 'Rechazado' || p.status === 'Pendiente' || p.esPublico) return;
        
        // SANITIZACIÓN ESTRICTA: Forzamos a que todo sea texto para evitar el pantallazo blanco
        const tlf = p.clienteTelefono ? String(p.clienteTelefono).trim() : '';
        const ci = p.clienteCedula ? String(p.clienteCedula).trim() : '';
        const nom = p.clienteNombre ? String(p.clienteNombre).trim() : 'Sin Nombre';

        // Estandarizar la llave del cliente (Prioridad: Teléfono -> Cédula -> Nombre)
        const key = tlf || ci || nom;
        if (!key) return;

        if (!map[key]) {
            map[key] = {
                nombre: nom,
                cedula: ci || 'S/N',
                telefono: tlf || 'S/N',
                direccion: p.direccion ? String(p.direccion) : 'No especificada',
                primeraCompra: p.fechaCreacion,
                ultimaCompra: p.fechaCreacion,
                totalCompras: 0,
                totalGastado: 0,
                historialProductos: {},
                asesoras: new Set()
            };
        }

        // Actualizar datos si el pedido es más reciente
        if (p.fechaCreacion > map[key].ultimaCompra) {
            map[key].ultimaCompra = p.fechaCreacion;
            if (p.direccion) map[key].direccion = String(p.direccion);
            map[key].nombre = nom; 
        }

        map[key].totalCompras += 1;
        map[key].totalGastado += (Number(p.montoUsd) || 0);
        if (p.asesora) map[key].asesoras.add(p.asesora);

        // Analizar productos comprados
        if (p.carritoObj) {
            Object.entries(p.carritoObj).forEach(([prodKey, qty]) => {
                if (!map[key].historialProductos[prodKey]) map[key].historialProductos[prodKey] = 0;
                map[key].historialProductos[prodKey] += Number(qty) || 0;
            });
        }
     });

     // Calcular Producto Favorito y transformar a Array
     let clientesArray = Object.values(map).map(c => {
         let favProd = 'Ninguno';
         let maxQty = 0;
         Object.entries(c.historialProductos).forEach(([prodKey, qty]) => {
             if (qty > maxQty) {
                 maxQty = qty;
                 favProd = prodKey.replace('|', ' ');
             }
         });
         return {
             ...c,
             productoFavorito: favProd,
             asesorasList: Array.from(c.asesoras).join(', ')
         };
     });

     // Aplicar Filtro de Búsqueda Seguro
     if (busqueda.trim()) {
         const b = busqueda.toLowerCase();
         clientesArray = clientesArray.filter(c => 
             String(c.nombre).toLowerCase().includes(b) || 
             String(c.telefono).toLowerCase().includes(b) || 
             String(c.cedula).toLowerCase().includes(b)
         );
     }

     // Aplicar Ordenamiento
     if (orden === 'fecha') clientesArray.sort((a,b) => b.ultimaCompra - a.ultimaCompra);
     if (orden === 'compras') clientesArray.sort((a,b) => b.totalCompras - a.totalCompras);
     if (orden === 'gasto') clientesArray.sort((a,b) => b.totalGastado - a.totalGastado);

     return clientesArray;
  }, [pedidos, busqueda, orden]);

  return (
    <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-700 transition-colors animate-in fade-in">
       
       <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-4 border-b border-slate-100 dark:border-slate-700 pb-6">
         <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3"><Users className="text-sky-600" /> Registro de Clientes (CRM)</h2>
            <p className="text-sm font-medium text-slate-500 mt-1">Base de datos calculada automáticamente basada en el historial de ventas validadas.</p>
         </div>
         <div className="bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 px-4 py-2 rounded-xl font-bold text-sm border border-sky-200 dark:border-sky-800">
            Total Clientes: {clientes.length}
         </div>
       </div>

       <div className="flex flex-col md:flex-row gap-4 mb-6 justify-between items-center">
          <div className="relative w-full md:w-1/2">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
             <input type="text" placeholder="Buscar por nombre, cédula o teléfono..." className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm font-bold outline-none focus:border-sky-500 transition-colors" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto bg-slate-50 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
             <span className="text-[10px] font-black uppercase text-slate-400 ml-2">Ordenar por:</span>
             <button onClick={()=>setOrden('fecha')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${orden==='fecha'?'bg-white dark:bg-slate-700 shadow text-sky-700 dark:text-sky-400':'text-slate-500 hover:text-slate-700'}`}>Última Compra</button>
             <button onClick={()=>setOrden('compras')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${orden==='compras'?'bg-white dark:bg-slate-700 shadow text-sky-700 dark:text-sky-400':'text-slate-500 hover:text-slate-700'}`}>N° Compras</button>
             <button onClick={()=>setOrden('gasto')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${orden==='gasto'?'bg-white dark:bg-slate-700 shadow text-emerald-600 dark:text-emerald-400':'text-slate-500 hover:text-slate-700'}`}>Valor (LTV)</button>
          </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clientes.length === 0 ? (
             <div className="col-span-full p-12 text-center text-slate-400 font-bold border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl">No hay clientes en la base de datos o que coincidan con la búsqueda.</div>
          ) : clientes.map((c, i) => (
             <div key={i} className="bg-white dark:bg-slate-800 p-6 rounded-3xl border-2 border-slate-100 dark:border-slate-700 shadow-sm flex flex-col h-full hover:border-sky-300 dark:hover:border-sky-700 transition-colors">
                
                <div className="flex justify-between items-start mb-4">
                   <div className="flex flex-col">
                     <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 leading-tight">{c.nombre}</h3>
                     <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">C.I: {c.cedula}</span>
                   </div>
                   {c.totalCompras >= 3 && (
                      <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 p-1.5 rounded-full shrink-0" title="Cliente Recurrente VIP"><Award size={16}/></span>
                   )}
                </div>

                <div className="space-y-2 mb-5 flex-grow">
                   <div className="flex gap-2 items-start text-xs font-medium text-slate-600 dark:text-slate-300">
                      <span className="bg-slate-100 dark:bg-slate-900 p-1.5 rounded text-slate-400 shrink-0"><Search size={14}/></span>
                      <span className="mt-1">{c.telefono}</span>
                   </div>
                   <div className="flex gap-2 items-start text-xs font-medium text-slate-600 dark:text-slate-300 line-clamp-2">
                      <span className="bg-slate-100 dark:bg-slate-900 p-1.5 rounded text-slate-400 shrink-0"><Store size={14}/></span>
                      <span className="mt-1 leading-snug">{c.direccion}</span>
                   </div>
                </div>

                <div className="bg-sky-50 dark:bg-sky-900/10 p-4 rounded-xl border border-sky-100 dark:border-sky-800/50 mb-4">
                   <div className="flex items-center gap-2 text-[10px] font-black uppercase text-sky-700 dark:text-sky-400 mb-1 tracking-widest"><ShoppingBag size={12}/> Producto Favorito</div>
                   <div className="font-bold text-slate-700 dark:text-slate-200 text-sm leading-tight">{c.productoFavorito}</div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-auto pt-4 border-t border-slate-100 dark:border-slate-700">
                   <div className="flex flex-col">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1"><CalendarClock size={10}/> Última Compra</span>
                      <span className="font-bold text-sm text-slate-700 dark:text-slate-200">{new Date(c.ultimaCompra).toLocaleDateString('es-VE')}</span>
                   </div>
                   <div className="flex flex-col text-right">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center justify-end gap-1"><DollarSign size={10}/> Total Gastado</span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400 text-base">${c.totalGastado.toFixed(2)}</span>
                   </div>
                </div>
                
                <div className="mt-3 text-[10px] font-bold text-slate-400 text-center uppercase tracking-widest bg-slate-50 dark:bg-slate-900/50 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700">
                   {c.totalCompras} {c.totalCompras === 1 ? 'Compra Registrada' : 'Compras Registradas'}
                </div>
             </div>
          ))}
       </div>
    </div>
  );
}