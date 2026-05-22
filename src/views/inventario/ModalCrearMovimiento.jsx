import React, { useState } from 'react';
import { ArrowRightLeft, PlusCircle, X, Camera, Loader2, AlertTriangle, Search } from 'lucide-react';
import { addDoc, collection, doc, setDoc, increment } from 'firebase/firestore'; 
import { URL_GOOGLE_SCRIPT } from '../../config/firebase';
import { compressImage } from '../../utils/image';

export default function ModalCrearMovimiento({ tipo, catalogo, stock, db, appId, loggear, perfil, dialogs, onClose }) {
  const [carrito, setCarrito] = useState({});
  const [fotosUrls, setFotosUrls] = useState([]);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [busqueda, setBusqueda] = useState(''); // ESTADO DEL BUSCADOR

  const isTransfer = tipo === 'TRANSFERENCIA';
  const isSalida = tipo === 'SALIDA';

  // Función para obtener la disponibilidad según el tipo de operación
  const getMaxDisp = (key) => {
    const itemStock = stock[key] || 0;
    if (typeof itemStock !== 'object') return itemStock;
    if (isTransfer) return itemStock.envios || 0; // Envía desde el almacén de envíos
    if (isSalida) return itemStock.recepcion || 0; // Salida se descuenta del almacén principal/recepción
    return 999999; // INGRESO no tiene límite
  };

  // Agregamos isConcentrado para ignorar el límite si es verdadero
  const updateQty = (key, delta, isConcentrado = false) => {
    setCarrito(prev => {
      const actual = prev[key] || 0;
      const nuevo = Math.max(0, actual + delta);
      
      // Si no es un concentrado, validamos contra el máximo disponible
      if ((isTransfer || isSalida) && delta > 0 && !isConcentrado) {
        if (nuevo > getMaxDisp(key)) return prev; 
      }

      if (nuevo === 0) { const copia = { ...prev }; delete copia[key]; return copia; }
      return { ...prev, [key]: nuevo };
    });
  };

  // Agregamos isConcentrado para ignorar el límite si es verdadero
  const handleDirectInput = (key, val, isConcentrado = false) => {
    let num = parseInt(val, 10);
    if (isNaN(num) || num < 0) num = 0;
    
    // Si no es un concentrado, validamos contra el máximo disponible
    if ((isTransfer || isSalida) && !isConcentrado) {
      const maxDisp = getMaxDisp(key);
      if (num > maxDisp) num = maxDisp; 
    }

    setCarrito(prev => {
      if (num === 0) {
        const copia = { ...prev };
        delete copia[key];
        return copia;
      }
      return { ...prev, [key]: num };
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!URL_GOOGLE_SCRIPT) {
        dialogs.alert("⚠️ Falta configurar el puente de Google Drive.", "Configuración Faltante");
        return;
    }

    setSubiendoFoto(true);
    try {
        const base64Data = await compressImage(file, 800, 0.7);
        const response = await fetch(URL_GOOGLE_SCRIPT, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ 
               tokenSecreto: "BLUHER_SECURE_TOKEN_2026",
               fileName: `Evidencia_${tipo}_${Date.now()}.jpg`, 
               mimeType: 'image/jpeg', 
               data: base64Data 
            })
        });
        const result = await response.json();
        if (result.url) { 
           setFotosUrls(prev => [...prev, result.url]); 
        } 
        else { throw new Error("No se recibió URL válida"); }
    } catch (error) {
        console.error(error); dialogs.alert("Error subiendo la evidencia fotográfica a Drive.", "Fallo de Red");
    } finally { setSubiendoFoto(false); }
  };

  const removeFoto = (indexToRemove) => {
    setFotosUrls(prev => prev.filter((_, i) => i !== indexToRemove));
  };

  const handleSubmit = async () => {
    if (Object.keys(carrito).length === 0) return dialogs.alert("No has seleccionado ningún producto.", "Carrito Vacío");
    if (fotosUrls.length === 0) return dialogs.alert("Debes incluir al menos una foto como soporte físico de la operación.", "Soporte Obligatorio");
    
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'movimientos'), {
        tipo, 
        origen: isSalida ? 'RECEPCION' : (isTransfer ? 'ENVIOS' : 'PROVEEDOR'), 
        destino: isSalida ? 'AJUSTE/MERMAS' : (isTransfer ? 'RECEPCION' : 'ENVIOS'),
        items: carrito, 
        fotos: fotosUrls, 
        status: tipo === 'INGRESO' ? 'COMPLETADO' : 'PENDIENTE', 
        fechaCreacion: Date.now(), 
        creadoPor: perfil.nombre
      });

      if (!isSalida) {
        const stockRef = doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'stock');
        const updates = {};

        Object.entries(carrito).forEach(([key, qty]) => {
           updates[key] = { envios: increment(tipo === 'INGRESO' ? qty : -qty) };
        });
        
        if(Object.keys(updates).length > 0){
           await setDoc(stockRef, updates, { merge: true });
        }
      }

      loggear(`MOVIMIENTO_${tipo}`, `${perfil.nombre} generó un(a) ${tipo} de ${Object.keys(carrito).length} items.`);
      dialogs.alert(`La operación de ${tipo} fue registrada exitosamente. ${isSalida ? 'Requiere aprobación del administrador para descontar del stock.' : ''}`, "Movimiento Procesado"); 
      onClose();
    } catch(e) { console.error(e); dialogs.alert("Error de conexión al procesar el movimiento."); }
  };

  const categoriasFiltradas = catalogo.map(cat => {
    const productosFiltrados = cat.productos.filter(prod =>
      prod.nombre.toLowerCase().includes(busqueda.toLowerCase())
    );
    return { ...cat, productos: productosFiltrados };
  }).filter(cat => cat.productos.length > 0);

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[80] flex items-center justify-center p-2 md:p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-4xl h-[98vh] md:h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700">
        
        {/* ENCABEZADO Y BUSCADOR (Reducido el padding para dar más espacio) */}
        <div className="border-b dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col">
           <div className="px-4 py-4 md:px-6 md:py-5 flex justify-between items-center">
             <h2 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 md:gap-3">
                {isTransfer && <><ArrowRightLeft className="text-purple-600"/> Transferir a Recepción</>}
                {isSalida && <><AlertTriangle className="text-red-600"/> Registrar Salida</>}
                {tipo === 'INGRESO' && <><PlusCircle className="text-emerald-600"/> Cargar Ingreso</>}
             </h2>
             <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors"><X size={20} className="text-slate-500 dark:text-slate-400"/></button>
           </div>
           
           {/* BARRA DE BÚSQUEDA */}
           <div className="px-4 pb-3 md:px-6 md:pb-4">
              <div className="relative">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                 <input 
                   type="text" 
                   placeholder="Buscar producto por nombre..." 
                   value={busqueda}
                   onChange={(e) => setBusqueda(e.target.value)}
                   className="w-full pl-11 pr-4 py-2.5 md:py-3 bg-slate-100 dark:bg-slate-900 border-none rounded-xl text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 outline-none transition-all shadow-inner text-sm md:text-base"
                 />
              </div>
           </div>
        </div>

        {/* LISTA DE PRODUCTOS FILTRADOS (Ajuste en grid y gaps) */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#f8fafc] dark:bg-slate-900 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 items-start content-start">
          {categoriasFiltradas.length === 0 ? (
             <div className="col-span-1 md:col-span-2 text-center py-12 text-slate-400 font-bold">No se encontraron productos con "{busqueda}"</div>
          ) : categoriasFiltradas.map(cat => {
            // Validamos a nivel de categoría si pertenece a concentrados
            const esCatConcentrado = cat.categoria.toLowerCase().includes('concentrado');
            
            return (
            <div key={cat.categoria} className="bg-white dark:bg-slate-800 p-4 md:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <h3 className="font-bold text-[10px] md:text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700 pb-2 mb-3 md:mb-4">{cat.categoria}</h3>
              {cat.productos.map(prod => {
                // También validamos si el nombre del producto incluye la palabra
                const isConcentrado = esCatConcentrado || prod.nombre.toLowerCase().includes('concentrado');
                
                return (
                <div key={prod.nombre} className="mb-4 last:mb-0">
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">{prod.nombre}</div>
                  {prod.presentaciones.map(pres => {
                    const key = `${prod.nombre}|${pres}`; const qty = carrito[key] || 0;
                    return (
                      <div key={pres} className="flex justify-between items-center text-xs md:text-sm py-2 border-b border-slate-50 dark:border-slate-700/50">
                        <span className="font-medium text-slate-600 dark:text-slate-400">
                          {pres} 
                          {(isTransfer || isSalida) && (
                             <span className={`text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded ml-1.5 md:ml-2 tracking-widest uppercase ${isSalida ? 'text-red-600 bg-red-50 dark:bg-red-900/30' : 'text-sky-600 bg-sky-50 dark:bg-sky-900/30'}`}>
                               {isConcentrado ? 'Disp: ∞' : `Disp: ${getMaxDisp(key)}`}
                             </span>
                          )}
                        </span>
                        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1 rounded-lg">
                          <button onClick={()=>updateQty(key, -1, isConcentrado)} className="bg-white dark:bg-slate-800 px-2 py-0.5 md:py-1 rounded text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white font-bold shadow-sm">-</button>
                          
                          <input 
                            type="number" 
                            min="0" 
                            value={qty === 0 ? '' : qty} 
                            onChange={(e) => handleDirectInput(key, e.target.value, isConcentrado)}
                            className="w-10 md:w-12 text-center font-black text-slate-800 dark:text-white bg-transparent outline-none focus:ring-2 focus:ring-sky-500 rounded" 
                            placeholder="0"
                          />
                          
                          <button onClick={()=>updateQty(key, 1, isConcentrado)} className="bg-white dark:bg-slate-800 px-2 py-0.5 md:py-1 rounded text-sky-600 dark:text-sky-400 hover:text-sky-800 font-bold shadow-sm">+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )})}
            </div>
          )})}
        </div>

        {/* SECCIÓN DE FOTOS Y BOTÓN GUARDAR (Hecha mucho más compacta) */}
        <div className="p-3 md:p-5 border-t dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col gap-3 md:gap-4">
          
          <div className={`${isSalida ? 'bg-red-50 dark:bg-red-900/20 border-red-100' : isTransfer ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-100' : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100'} p-3 md:p-4 border rounded-xl md:rounded-2xl flex flex-col gap-2 transition-colors`}>
            <label className={`text-[10px] md:text-xs font-bold uppercase tracking-widest block ${isSalida ? 'text-red-800 dark:text-red-400' : isTransfer ? 'text-purple-800 dark:text-purple-400' : 'text-emerald-800 dark:text-emerald-400'}`}>
              Evidencias Fotográficas (Mínimo 1)
            </label>
            
            <div className="flex gap-2 md:gap-3 flex-wrap items-center">
               {fotosUrls.map((url, idx) => (
                  <div key={idx} className="relative group">
                     <a href={url} target="_blank" rel="noreferrer" className={`w-10 h-10 md:w-12 md:h-12 bg-white dark:bg-slate-800 border-2 rounded-xl flex items-center justify-center shadow-sm hover:scale-105 transition-transform ${isSalida ? 'border-red-400 text-red-500' : isTransfer ? 'border-purple-400 dark:border-purple-600 text-purple-500' : 'border-emerald-400 dark:border-emerald-600 text-emerald-500'}`} title="Ver foto">
                        <Camera size={18} />
                     </a>
                     <button onClick={() => removeFoto(idx)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity shadow-md" title="Eliminar foto">
                        <X size={10} />
                     </button>
                  </div>
               ))}
               
               <label className={`w-10 h-10 md:w-12 md:h-12 text-white rounded-xl cursor-pointer flex items-center justify-center shadow-md transition-colors ${fotosUrls.length > 0 ? (isSalida ? 'bg-red-400 hover:bg-red-500' : isTransfer ? 'bg-purple-400 hover:bg-purple-500' : 'bg-emerald-400 hover:bg-emerald-500') : (isSalida ? 'bg-red-600 hover:bg-red-700 animate-pulse' : isTransfer ? 'bg-purple-600 hover:bg-purple-700 animate-pulse' : 'bg-emerald-600 hover:bg-emerald-700 animate-pulse')} disabled:opacity-50`} title="Añadir foto">
                 {subiendoFoto ? <Loader2 size={18} className="animate-spin" /> : <PlusCircle size={20}/>} 
                 <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileUpload} disabled={subiendoFoto}/>
               </label>
            </div>
          </div>
          
          <div className="flex justify-between items-center gap-2">
            <div className="font-bold text-slate-500 dark:text-slate-400 text-sm md:text-lg">
               Total: <span className="text-lg md:text-2xl text-slate-800 dark:text-white ml-1 md:ml-2">{Object.values(carrito).reduce((a,b)=>a+b,0)}</span>
            </div>
            <button onClick={handleSubmit} className={`${isSalida ? 'bg-red-600 hover:bg-red-700' : 'bg-sky-600 hover:bg-sky-700'} text-white font-bold py-2.5 px-4 md:py-3 md:px-8 rounded-xl shadow-lg transition-all hover:-translate-y-0.5 text-sm md:text-lg`}>
               {isSalida ? 'Confirmar Salida' : isTransfer ? 'Confirmar Transferencia' : 'Aprobar Ingreso'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}