import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';

export default function ModalCatalogo({ catalogo, stock, isOpen, onClose, onConfirm, dialogs }) {
  const [carrito, setCarrito] = useState({});
  const [totalCotizacion, setTotalCotizacion] = useState(0);

  const updateQty = (key, delta) => { 
    setCarrito(prev => { 
      const n = Math.max(0, (prev[key]||0)+delta); 
      if(n===0){const c={...prev}; delete c[key]; return c;} 
      return {...prev, [key]:n}; 
    }); 
  };

  useEffect(() => {
    let total = 0;
    Object.entries(carrito).forEach(([key, qty]) => {
      const [nombre, pres] = key.split('|');
      let pPrecio = 0;
      catalogo.forEach(c => c.productos.forEach(p => {
        if(p.nombre === nombre) {
          const presIndex = p.presentaciones.indexOf(pres);
          if (presIndex >= 0 && p.precios) pPrecio = p.precios[presIndex] || 0;
        }
      }));
      total += (pPrecio * qty);
    });
    setTotalCotizacion(total);
  }, [carrito, catalogo]);

  if (!isOpen) return null; 

  const handleConfirm = () => {
    const lineas = [];
    Object.entries(carrito).forEach(([key, qty]) => {
      const [prod, pres] = key.split('|');
      let pPrecio = 0;
      catalogo.forEach(c => c.productos.forEach(p => {
        if(p.nombre === prod) {
          const presIndex = p.presentaciones.indexOf(pres);
          if (presIndex >= 0 && p.precios) pPrecio = p.precios[presIndex] || 0;
        }
      }));
      lineas.push(`- ${qty}x ${prod} (${pres}) ${pPrecio > 0 ? `[$${pPrecio} c/u]` : ''}`);
    });
    
    if (lineas.length === 0) {
      if(dialogs) dialogs.alert("Debe seleccionar al menos un producto del Catálogo Visual para confirmar la selección.", "Selección Vacía");
      return;
    }
    
    onConfirm(lineas.join('\n'), carrito); 
    setCarrito({});
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-[3rem] w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden shadow-2xl border dark:border-slate-700 transition-colors">
        <div className="p-8 border-b dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 transition-colors">
           <h2 className="text-2xl font-black flex items-center gap-3 dark:text-white uppercase tracking-tighter"><Search className="text-sky-600"/> Catálogo Oficial</h2>
           <button onClick={onClose} className="p-3 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200 transition-colors text-slate-500"><X size={24}/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-8 bg-[#f8fafc] dark:bg-slate-900 grid grid-cols-1 md:grid-cols-2 gap-8 transition-colors">
           {catalogo.filter(c=>c.categoria !== 'Complementos Automáticos').map(c => (
              <div key={c.categoria} className="space-y-4">
                 <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] border-b dark:border-slate-700 pb-2 transition-colors">{c.categoria}</h3>
                 {c.productos.map(p => (
                    <div key={p.nombre} className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border dark:border-slate-700 shadow-sm space-y-4 hover:shadow-md transition-all">
                       <div className="font-black text-base text-slate-800 dark:text-slate-100 transition-colors">{p.nombre}</div>
                       {p.presentaciones.map((pres, i) => {
                          const k = `${p.nombre}|${pres}`; const q = carrito[k] || 0;
                          const disp = stock ? (typeof stock[k] === 'object' ? stock[k].envios : (stock[k]||0)) : 0;
                          return (
                            <div key={pres} className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-4 rounded-[1.5rem] border dark:border-slate-700 transition-colors">
                               <div className="flex flex-col"><span className="font-bold opacity-60 text-[10px] dark:text-slate-400 uppercase tracking-widest">{pres}</span><span className="font-black text-emerald-600 text-lg">${p.precios[i]}</span><span className={`text-[9px] font-black ${disp===0?'text-red-500':'text-sky-500'}`}>Stock: {disp}</span></div>
                               <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-2xl border dark:border-slate-700 shadow-inner transition-colors">
                                  <button type="button" onClick={()=>updateQty(k,-1)} className="w-8 h-8 flex items-center justify-center font-black text-slate-400 hover:text-slate-800 transition-colors">-</button>
                                  <span className="font-black w-6 text-center dark:text-white text-lg">{q}</span>
                                  <button type="button" onClick={()=>updateQty(k,1)} className="w-8 h-8 flex items-center justify-center font-black text-sky-600 hover:text-sky-800 transition-colors">+</button>
                               </div>
                            </div>
                          )
                       })}
                    </div>
                 ))}
              </div>
           ))}
        </div>
        <div className="p-8 border-t dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 transition-colors"><div className="font-black opacity-50 dark:text-slate-400 tracking-widest uppercase text-xs">Items: {Object.values(carrito).reduce((a,b)=>a+b,0)}</div><button onClick={handleConfirm} className="bg-sky-600 text-white px-12 py-5 rounded-[2rem] font-black shadow-2xl hover:bg-sky-700 transition-all uppercase tracking-widest">Confirmar Selección</button></div>
      </div>
    </div>
  );
}