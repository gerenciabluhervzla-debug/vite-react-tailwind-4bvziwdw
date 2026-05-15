import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Image as ImageIcon } from 'lucide-react';

export default function ModalCatalogo({ catalogo, stock, isOpen, onClose, onConfirm, dialogs, globalDiscountPercent = 0, isGlobalDiscountActive = false }) {
  const [carrito, setCarrito] = useState({});
  const [totalCotizacion, setTotalCotizacion] = useState(0);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');

  // FUNCIÓN PARA RENDERIZAR IMÁGENES DE DRIVE DIRECTAMENTE
  const getDirectUrl = (url) => {
    if (!url) return null;
    if (url.includes('drive.google.com/file/d/')) {
      const match = url.match(/\/d\/(.+?)\//);
      if (match && match[1]) {
        return `https://drive.google.com/uc?export=view&id=${match[1]}`;
      }
    }
    return url;
  };

  const updateQty = (key, delta) => { 
    setCarrito(prev => { 
      const actual = prev[key] || 0;
      const nuevo = Math.max(0, actual + delta); 

      if (delta > 0) {
         const maxDisp = stock && stock[key] ? (typeof stock[key] === 'object' ? stock[key].envios : stock[key]) : 0;
         if (nuevo > maxDisp) {
            if(dialogs) dialogs.alert(`Solo tenemos ${maxDisp} unidades disponibles de este producto.`, "Stock Límite");
            return prev;
         }

         const boosterKeys = ["Booster de Hidratacion|Unidad", "Booster de Reparacion|Unidad", "Booster de Nutricion|Unidad", "Booster Profesional|Unidad"];
         const isBooster = boosterKeys.includes(key);
         const isConcentrado = key === "Concentrado|Unidad";

         if (isBooster || isConcentrado) {
            let currentNeeded = prev["Concentrado|Unidad"] || 0;
            boosterKeys.forEach(bk => { currentNeeded += (prev[bk] || 0); });
            
            const dispConcentrado = stock && stock["Concentrado|Unidad"] ? (typeof stock["Concentrado|Unidad"] === 'object' ? stock["Concentrado|Unidad"].envios : stock["Concentrado|Unidad"]) : 0;
            
            if (currentNeeded + delta > dispConcentrado) {
              if(dialogs) dialogs.alert(`No puedes agregar más. Solo quedan ${dispConcentrado} Concentrados en stock (se requiere 1 Concentrado por cada Booster añadido).`, "Stock de Concentrado Límite");
              return prev;
            }
         }
      }

      if(nuevo === 0){const c={...prev}; delete c[key]; return c;} 
      return {...prev, [key]:nuevo}; 
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
    
    const finalTotal = isGlobalDiscountActive ? total * (1 - globalDiscountPercent / 100) : total;
    setTotalCotizacion(finalTotal);
  }, [carrito, catalogo, isGlobalDiscountActive, globalDiscountPercent]);

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
      
      const finalPrice = isGlobalDiscountActive ? pPrecio * (1 - globalDiscountPercent / 100) : pPrecio;
      lineas.push(`- ${qty}x ${prod} (${pres}) ${finalPrice > 0 ? `[$${finalPrice.toFixed(2)} c/u]` : ''}`);
    });
    
    if (lineas.length === 0) {
      if(dialogs) dialogs.alert("Debe seleccionar al menos un producto del Catálogo Visual para confirmar la selección.", "Selección Vacía");
      return;
    }
    
    onConfirm(lineas.join('\n'), carrito); 
    setCarrito({});
  };

  const categoriasDisponibles = useMemo(() => {
    return ['Todos', ...catalogo.filter(c => c.categoria !== 'Complementos Automáticos').map(c => c.categoria)];
  }, [catalogo]);

  const catalogFiltered = useMemo(() => {
    return catalogo
      .filter(c => c.categoria !== 'Complementos Automáticos')
      .map(cat => {
         const productosBusqueda = cat.productos.filter(prod => 
           prod.nombre.toLowerCase().includes(searchTerm.toLowerCase())
         );
         return { ...cat, productos: productosBusqueda };
      })
      .filter(cat => {
         const matchesCategory = selectedCategory === 'Todos' || cat.categoria === selectedCategory;
         const hasProducts = cat.productos.length > 0;
         return matchesCategory && hasProducts;
      });
  }, [catalogo, searchTerm, selectedCategory]);

  if (!isOpen) return null; 

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-[3rem] w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden shadow-2xl border dark:border-slate-700 transition-colors">
        
        <div className="p-6 border-b dark:border-slate-700 bg-white dark:bg-slate-800 transition-colors flex flex-col gap-4">
           <div className="flex justify-between items-center">
             <h2 className="text-2xl font-black flex items-center gap-3 dark:text-white uppercase tracking-tighter"><Search className="text-sky-600"/> Catálogo Oficial</h2>
             <button onClick={onClose} className="p-3 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200 transition-colors text-slate-500"><X size={20}/></button>
           </div>
           
           <div className="flex flex-col md:flex-row gap-3 items-center">
             <div className="relative w-full md:w-1/2">
                <Search size={18} className="absolute left-3 top-3.5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Buscar producto..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-900 border-none outline-none focus:ring-2 focus:ring-sky-500 dark:text-white font-bold transition-shadow"
                />
             </div>
             <div className="flex overflow-x-auto w-full md:w-1/2 gap-2 pb-2 md:pb-0 scrollbar-hide">
               {categoriasDisponibles.map(cat => (
                 <button 
                   key={cat} 
                   onClick={() => setSelectedCategory(cat)}
                   className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${selectedCategory === cat ? 'bg-sky-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                 >
                   {cat}
                 </button>
               ))}
             </div>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-[#f8fafc] dark:bg-slate-900 grid grid-cols-1 md:grid-cols-2 gap-8 transition-colors">
           {catalogFiltered.length === 0 ? (
             <div className="col-span-full text-center py-20 text-slate-400 font-bold italic">No se encontraron productos.</div>
           ) : catalogFiltered.map(c => (
              <div key={c.categoria} className="space-y-4">
                 <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] border-b dark:border-slate-700 pb-2 transition-colors">{c.categoria}</h3>
                 {c.productos.map(p => (
                    <div key={p.nombre} className="bg-white dark:bg-slate-800 p-5 rounded-[2rem] border dark:border-slate-700 shadow-sm space-y-4 hover:shadow-md transition-all">
                       <div className="font-black text-base text-slate-800 dark:text-slate-100 transition-colors">{p.nombre}</div>
                       {p.presentaciones.map((pres, i) => {
                          const k = `${p.nombre}|${pres}`; const q = carrito[k] || 0;
                          const disp = stock ? (typeof stock[k] === 'object' ? stock[k].envios : (stock[k]||0)) : 0;
                          
                          // APLICANDO LA TRANSFORMACIÓN DEL ENLACE DE DRIVE
                          const rawUrl = (p.imagenes && p.imagenes[i]) ? p.imagenes[i] : (i === 0 && p.imagen ? p.imagen : null);
                          const imageUrl = getDirectUrl(rawUrl);
                          
                          const originalPrice = p.precios[i] || 0;
                          const discountedPrice = originalPrice * (1 - globalDiscountPercent / 100);

                          return (
                            <div key={pres} className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-3 rounded-[1.5rem] border dark:border-slate-700 transition-colors gap-3">
                               
                               <div className="flex items-center gap-3 w-full">
                                  {imageUrl ? (
                                    <img src={imageUrl} alt={pres} className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-600 shadow-sm shrink-0 bg-white" />
                                  ) : (
                                    <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-300 dark:border-slate-700">
                                       <ImageIcon size={16} className="text-slate-400"/>
                                    </div>
                                  )}
                                  
                                  <div className="flex flex-col">
                                    <span className="font-bold opacity-60 text-[10px] dark:text-slate-400 uppercase tracking-widest leading-none mb-1">{pres}</span>
                                    <div className="flex items-baseline gap-2">
                                       {isGlobalDiscountActive ? (
                                         <>
                                           <span className="font-black text-pink-600 text-base leading-none">${discountedPrice.toFixed(2)}</span>
                                           <span className="text-[10px] font-bold text-slate-400 line-through">${originalPrice}</span>
                                         </>
                                       ) : (
                                         <span className="font-black text-emerald-600 text-base leading-none">${originalPrice}</span>
                                       )}
                                       <span className={`text-[9px] font-black ${disp===0?'text-red-500':'text-sky-500'}`}>Stock: {disp}</span>
                                    </div>
                                  </div>
                               </div>

                               <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded-2xl border dark:border-slate-700 shadow-inner transition-colors shrink-0">
                                  <button type="button" onClick={()=>updateQty(k,-1)} className="w-7 h-7 flex items-center justify-center font-black text-slate-400 hover:text-slate-800 transition-colors">-</button>
                                  <span className="font-black w-5 text-center dark:text-white text-sm">{q}</span>
                                  <button type="button" onClick={()=>updateQty(k,1)} className="w-7 h-7 flex items-center justify-center font-black text-sky-600 hover:text-sky-800 transition-colors">+</button>
                               </div>
                            </div>
                          )
                       })}
                    </div>
                 ))}
              </div>
           ))}
        </div>
        
        <div className="p-6 border-t dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 transition-colors">
          <div className="font-black opacity-50 dark:text-slate-400 tracking-widest uppercase text-xs">
            Items: {Object.values(carrito).reduce((a,b)=>a+b,0)} &nbsp;|&nbsp; Total: <span className="text-sky-600 dark:text-sky-400">${totalCotizacion.toFixed(2)}</span>
          </div>
          <button onClick={handleConfirm} className="bg-sky-600 text-white px-8 py-4 rounded-[2rem] font-black shadow-lg hover:bg-sky-700 transition-all uppercase tracking-widest text-sm">Añadir a la Orden</button>
        </div>
      </div>
    </div>
  );
}