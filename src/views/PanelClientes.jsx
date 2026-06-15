import React, { useState, useMemo } from 'react';
import { Users, Search, ShoppingBag, CalendarClock, DollarSign, Award, Store, Pencil, ShoppingCart, Trophy, X, Save } from 'lucide-react';
import { ROLES } from '../config/constants';

export default function PanelClientes({ pedidos = [], perfil, onActualizarCliente, onTomarPedido }) {
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState('alfabetico'); // 'alfabetico' | 'fecha' | 'compras' | 'gasto'
  const [clienteAEditar, setClienteAEditar] = useState(null);

  const puedeEditar = perfil?.role === ROLES?.ADMIN || perfil?.role === 'Administración' || perfil?.role === 'Administrador';

  const clientesBase = useMemo(() => {
     const map = {};
     if (!Array.isArray(pedidos)) return [];

     pedidos.forEach(p => {
        try {
            if(!p || p.status === 'Anulado' || p.status === 'Rechazado' || p.status === 'Pendiente' || p.esPublico) return;
            
            const tlf = p.clienteTelefono ? String(p.clienteTelefono).trim() : '';
            const ci = p.clienteCedula ? String(p.clienteCedula).trim() : '';
            const nom = p.clienteNombre ? String(p.clienteNombre).trim() : 'Sin Nombre';

            const key = tlf || ci || nom;
            if (!key) return;

            if (!map[key]) {
                map[key] = {
                    keyOriginal: key,
                    nombre: nom,
                    cedula: ci || 'S/N',
                    telefono: tlf || 'S/N',
                    direccion: p.direccion ? String(p.direccion) : 'No especificada',
                    primeraCompra: p.fechaCreacion || 0,
                    ultimaCompra: p.fechaCreacion || 0,
                    totalCompras: 0,
                    totalGastado: 0,
                    historialProductos: {},
                    asesoras: new Set()
                };
            }

            const fechaPedido = p.fechaCreacion || 0;
            if (fechaPedido > map[key].ultimaCompra) {
                map[key].ultimaCompra = fechaPedido;
                if (p.direccion) map[key].direccion = String(p.direccion);
                if (nom !== 'Sin Nombre') map[key].nombre = nom; 
            }

            map[key].totalCompras += 1;
            map[key].totalGastado += (Number(p.montoUsd) || 0);
            if (p.asesora) map[key].asesoras.add(String(p.asesora));

            if (p.carritoObj && typeof p.carritoObj === 'object') {
                Object.entries(p.carritoObj).forEach(([prodKey, qty]) => {
                    const safeKey = String(prodKey);
                    if (!map[key].historialProductos[safeKey]) map[key].historialProductos[safeKey] = 0;
                    map[key].historialProductos[safeKey] += (Number(qty) || 0);
                });
            }
        } catch (errorInt) {
            console.warn("Se omitió un pedido corrupto en el cálculo del CRM:", errorInt);
        }
     });

     return Object.values(map).map(c => {
         let favProd = 'Ninguno';
         let maxQty = 0;
         Object.entries(c.historialProductos).forEach(([prodKey, qty]) => {
             if (qty > maxQty) {
                 maxQty = qty;
                 favProd = String(prodKey).replace('|', ' ');
             }
         });
         return {
             ...c,
             productoFavorito: favProd,
             asesorasList: Array.from(c.asesoras).join(', ')
         };
     });
  }, [pedidos]);

  // Rankings para el Dashboard Top VIP
  const topClientesGasto = useMemo(() => {
     return [...clientesBase].sort((a,b) => b.totalGastado - a.totalGastado).slice(0, 3);
  }, [clientesBase]);

  const topClientesCompras = useMemo(() => {
     return [...clientesBase].sort((a,b) => b.totalCompras - a.totalCompras).slice(0, 3);
  }, [clientesBase]);

  // Clientes a mostrar en la vista principal (con filtros y orden)
  const clientesProcesados = useMemo(() => {
      let array = [...clientesBase];
      
      if (busqueda && busqueda.trim() !== '') {
         const b = String(busqueda).toLowerCase().trim();
         array = array.filter(c => 
             String(c.nombre || '').toLowerCase().includes(b) || 
             String(c.telefono || '').toLowerCase().includes(b) || 
             String(c.cedula || '').toLowerCase().includes(b)
         );
      }

      if (orden === 'alfabetico') array.sort((a,b) => String(a.nombre).localeCompare(String(b.nombre)));
      if (orden === 'fecha') array.sort((a,b) => (b.ultimaCompra || 0) - (a.ultimaCompra || 0));
      if (orden === 'compras') array.sort((a,b) => (b.totalCompras || 0) - (a.totalCompras || 0));
      if (orden === 'gasto') array.sort((a,b) => (b.totalGastado || 0) - (a.totalGastado || 0));

      return array;
  }, [clientesBase, busqueda, orden]);

  const handleGuardarEdicion = (e) => {
     e.preventDefault();
     if(onActualizarCliente) {
        onActualizarCliente(clienteAEditar);
     }
     setClienteAEditar(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in">
       
       {/* PANEL SUPERIOR: ESTADÍSTICAS Y TOP VIP */}
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-sky-600 dark:bg-sky-800 text-white p-6 rounded-[2rem] shadow-sm flex flex-col justify-center border-b-4 border-sky-800 dark:border-sky-950 relative overflow-hidden">
             <div className="relative z-10">
               <h2 className="text-sm uppercase font-black tracking-widest opacity-80 mb-1 flex items-center gap-2">
                 <Users size={16}/> Total CRM
               </h2>
               <div className="text-4xl font-black">{clientesBase.length}</div>
               <p className="text-xs font-medium opacity-80 mt-2">Clientes únicos registrados en el sistema.</p>
             </div>
             <Users size={100} className="absolute -right-6 -bottom-6 opacity-10"/>
          </div>

          <div className="bg-emerald-50 dark:bg-emerald-900/20 p-5 rounded-3xl border border-emerald-100 dark:border-emerald-800 shadow-sm relative">
             <h3 className="text-xs font-black uppercase text-emerald-700 dark:text-emerald-400 mb-3 flex items-center gap-2"><Trophy size={14}/> Top Volumen de Gasto</h3>
             <div className="space-y-3">
                {topClientesGasto.map((c, i) => (
                   <div key={i} className="flex justify-between items-center bg-white dark:bg-slate-800 px-3 py-2 rounded-xl shadow-sm">
                      <div className="flex items-center gap-2 truncate">
                         <span className="w-5 h-5 flex items-center justify-center bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black shrink-0">{i+1}</span>
                         <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{c.nombre}</span>
                      </div>
                      <span className="text-sm font-black text-emerald-600 shrink-0">${c.totalGastado.toFixed(2)}</span>
                   </div>
                ))}
             </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 p-5 rounded-3xl border border-amber-100 dark:border-amber-800 shadow-sm relative">
             <h3 className="text-xs font-black uppercase text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-2"><Award size={14}/> Top Recurrencia (Compras)</h3>
             <div className="space-y-3">
                {topClientesCompras.map((c, i) => (
                   <div key={i} className="flex justify-between items-center bg-white dark:bg-slate-800 px-3 py-2 rounded-xl shadow-sm">
                      <div className="flex items-center gap-2 truncate">
                         <span className="w-5 h-5 flex items-center justify-center bg-amber-100 text-amber-700 rounded-full text-[10px] font-black shrink-0">{i+1}</span>
                         <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{c.nombre}</span>
                      </div>
                      <span className="text-xs font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md shrink-0">{c.totalCompras} pedidos</span>
                   </div>
                ))}
             </div>
          </div>
       </div>

       {/* CONTROLES BÚSQUEDA Y ORDEN */}
       <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
             <div className="relative w-full md:w-1/2">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                <input type="text" placeholder="Buscar por nombre, cédula o teléfono..." className="w-full pl-11 pr-4 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm font-bold outline-none focus:border-sky-500 transition-colors" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
             </div>
             
             <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto scrollbar-hide bg-slate-50 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-black uppercase text-slate-400 ml-2 whitespace-nowrap">Ordenar:</span>
                <button onClick={()=>setOrden('alfabetico')} className={`px-4 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${orden==='alfabetico'?'bg-white dark:bg-slate-700 shadow text-sky-700 dark:text-sky-400':'text-slate-500 hover:text-slate-700'}`}>A-Z</button>
                <button onClick={()=>setOrden('fecha')} className={`px-4 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${orden==='fecha'?'bg-white dark:bg-slate-700 shadow text-sky-700 dark:text-sky-400':'text-slate-500 hover:text-slate-700'}`}>Última Compra</button>
                <button onClick={()=>setOrden('compras')} className={`px-4 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${orden==='compras'?'bg-white dark:bg-slate-700 shadow text-amber-600 dark:text-amber-400':'text-slate-500 hover:text-slate-700'}`}>N° Compras</button>
                <button onClick={()=>setOrden('gasto')} className={`px-4 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${orden==='gasto'?'bg-white dark:bg-slate-700 shadow text-emerald-600 dark:text-emerald-400':'text-slate-500 hover:text-slate-700'}`}>Valor LTV</button>
             </div>
          </div>

          {clientesProcesados.length === 0 && (
             <div className="p-12 text-center text-slate-400 font-bold border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl mt-6">
                 No se encontraron coincidencias.
             </div>
          )}

          {/* VISTA ESCRITORIO: TABLA */}
          {clientesProcesados.length > 0 && (
             <div className="hidden lg:block mt-6 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
               <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b dark:border-slate-700">
                      <th className="p-4 font-black tracking-wide">Cliente</th>
                      <th className="p-4 font-black tracking-wide">Contacto</th>
                      <th className="p-4 font-black tracking-wide">Producto Principal</th>
                      <th className="p-4 font-black tracking-wide text-center">Compras</th>
                      <th className="p-4 font-black tracking-wide text-right">Monto Acumulado</th>
                      <th className="p-4 font-black tracking-wide text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                     {clientesProcesados.map((c, i) => (
                        <tr key={i} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                           <td className="p-4">
                              <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                 {c.nombre} {c.totalCompras >= 3 && <Award size={14} className="text-amber-500"/>}
                              </div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">C.I: {c.cedula}</div>
                           </td>
                           <td className="p-4">
                              <div className="text-xs font-medium text-slate-600 dark:text-slate-300">{c.telefono}</div>
                              <div className="text-[10px] text-slate-500 truncate max-w-[150px]" title={c.direccion}>{c.direccion}</div>
                           </td>
                           <td className="p-4">
                              <div className="text-xs font-bold text-sky-700 dark:text-sky-400 truncate max-w-[200px]">{c.productoFavorito}</div>
                           </td>
                           <td className="p-4 text-center">
                              <span className="font-black text-slate-700 dark:text-slate-200">{c.totalCompras}</span>
                           </td>
                           <td className="p-4 text-right font-black text-emerald-600 dark:text-emerald-400">
                              ${c.totalGastado.toFixed(2)}
                           </td>
                           <td className="p-4">
                              <div className="flex items-center justify-center gap-2">
                                 <button onClick={() => onTomarPedido && onTomarPedido(c)} title="Tomar Pedido" className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors border border-indigo-200">
                                    <ShoppingCart size={16}/>
                                 </button>
                                 {puedeEditar && (
                                    <button onClick={() => setClienteAEditar(c)} title="Editar Cliente" className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors border border-slate-300">
                                       <Pencil size={16}/>
                                    </button>
                                 )}
                              </div>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
             </div>
          )}

          {/* VISTA MÓVIL/TABLET: TARJETAS */}
          {clientesProcesados.length > 0 && (
             <div className="grid lg:hidden grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                {clientesProcesados.map((c, i) => (
                   <div key={i} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border-2 border-slate-100 dark:border-slate-700 shadow-sm flex flex-col h-full relative">
                      
                      {c.totalCompras >= 3 && (
                         <div className="absolute top-4 right-4 bg-amber-100 text-amber-700 p-1.5 rounded-full"><Award size={14}/></div>
                      )}
                      
                      <div className="flex flex-col mb-3 pr-8">
                         <h3 className="text-base font-black text-slate-800 dark:text-slate-100 leading-tight">{c.nombre}</h3>
                         <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">C.I: {c.cedula}</span>
                      </div>

                      <div className="space-y-1.5 mb-4 flex-grow">
                         <div className="text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-2">
                            <span className="text-slate-400"><Search size={12}/></span> {c.telefono}
                         </div>
                         <div className="text-xs font-medium text-slate-600 dark:text-slate-300 flex items-start gap-2 line-clamp-2">
                            <span className="text-slate-400 mt-0.5"><Store size={12}/></span> <span className="leading-snug">{c.direccion}</span>
                         </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mb-4 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                         <div>
                            <div className="text-[9px] font-black uppercase text-slate-400 mb-0.5">Compras</div>
                            <div className="font-bold text-sm text-slate-700 dark:text-slate-200">{c.totalCompras} pedidos</div>
                         </div>
                         <div className="text-right">
                            <div className="text-[9px] font-black uppercase text-slate-400 mb-0.5">Monto LTV</div>
                            <div className="font-black text-emerald-600 dark:text-emerald-400">${c.totalGastado.toFixed(2)}</div>
                         </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-auto">
                         <button onClick={() => onTomarPedido && onTomarPedido(c)} className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-xs font-bold transition-colors">
                            <ShoppingCart size={14}/> Pedido
                         </button>
                         {puedeEditar ? (
                            <button onClick={() => setClienteAEditar(c)} className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600 py-2 rounded-lg text-xs font-bold transition-colors">
                               <Pencil size={14}/> Editar
                            </button>
                         ) : (
                            <div className="flex items-center justify-center py-2 text-[10px] uppercase font-bold text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-lg border border-dashed border-slate-200">
                               Solo Lectura
                            </div>
                         )}
                      </div>
                   </div>
                ))}
             </div>
          )}
       </div>

       {/* MODAL DE EDICIÓN (SOLO ADMIN) */}
       {clienteAEditar && puedeEditar && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
             <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
                <div className="bg-sky-600 px-6 py-4 flex justify-between items-center text-white">
                   <h3 className="font-black text-lg flex items-center gap-2"><Pencil size={18}/> Editar Cliente</h3>
                   <button onClick={() => setClienteAEditar(null)} className="hover:bg-white/20 p-1.5 rounded-full transition-colors"><X size={20}/></button>
                </div>
                
                <form onSubmit={handleGuardarEdicion} className="p-6 space-y-4">
                   <div className="bg-amber-50 text-amber-800 text-xs font-bold p-3 rounded-lg border border-amber-200 mb-4">
                      Estás editando la información de contacto principal. No se modificarán los productos adquiridos.
                   </div>

                   <div>
                      <label className="text-[10px] font-black uppercase text-slate-500 ml-1 block mb-1">Nombre del Cliente</label>
                      <input required type="text" value={clienteAEditar.nombre} onChange={(e) => setClienteAEditar({...clienteAEditar, nombre: e.target.value})} className="w-full p-3 text-sm font-bold rounded-xl border-2 border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white outline-none focus:border-sky-500 transition-colors" />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                         <label className="text-[10px] font-black uppercase text-slate-500 ml-1 block mb-1">Cédula</label>
                         <input required type="text" value={clienteAEditar.cedula} onChange={(e) => setClienteAEditar({...clienteAEditar, cedula: e.target.value})} className="w-full p-3 text-sm font-bold rounded-xl border-2 border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white outline-none focus:border-sky-500 transition-colors" />
                      </div>
                      <div>
                         <label className="text-[10px] font-black uppercase text-slate-500 ml-1 block mb-1">Teléfono</label>
                         <input required type="text" value={clienteAEditar.telefono} onChange={(e) => setClienteAEditar({...clienteAEditar, telefono: e.target.value})} className="w-full p-3 text-sm font-bold rounded-xl border-2 border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white outline-none focus:border-sky-500 transition-colors" />
                      </div>
                   </div>
                   <div>
                      <label className="text-[10px] font-black uppercase text-slate-500 ml-1 block mb-1">Dirección Estándar</label>
                      <textarea required rows="2" value={clienteAEditar.direccion} onChange={(e) => setClienteAEditar({...clienteAEditar, direccion: e.target.value})} className="w-full p-3 text-sm font-medium rounded-xl border-2 border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white outline-none focus:border-sky-500 transition-colors resize-none" />
                   </div>

                   <div className="pt-4 flex gap-3">
                      <button type="button" onClick={() => setClienteAEditar(null)} className="flex-1 py-3 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">Cancelar</button>
                      <button type="submit" className="flex-1 py-3 text-sm font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl transition-colors shadow-md flex justify-center items-center gap-2">
                         <Save size={16}/> Guardar
                      </button>
                   </div>
                </form>
             </div>
          </div>
       )}

    </div>
  );
}