import React, { useState } from 'react';
import { ArrowRightLeft, PlusCircle, X, Camera, Loader2, CheckCircle } from 'lucide-react';
import { addDoc, collection, doc, updateDoc, increment } from 'firebase/firestore'; 
import { URL_GOOGLE_SCRIPT } from '../../config/firebase';
import { compressImage } from '../../utils/image';

export default function ModalCrearMovimiento({ tipo, catalogo, stock, db, appId, loggear, perfil, dialogs, onClose }) {
  const [carrito, setCarrito] = useState({});
  // AHORA GUARDAMOS UN ARREGLO DE FOTOS
  const [fotosUrls, setFotosUrls] = useState([]);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const isTransfer = tipo === 'TRANSFERENCIA';

  const updateQty = (key, delta) => {
    setCarrito(prev => {
      const actual = prev[key] || 0;
      const nuevo = Math.max(0, actual + delta);
      
      if (isTransfer && delta > 0) {
        let maxDisp = typeof stock[key] === 'object' ? stock[key].envios : (stock[key]||0);
        if (nuevo > maxDisp) return prev; 
      }

      if (nuevo === 0) { const copia = { ...prev }; delete copia[key]; return copia; }
      return { ...prev, [key]: nuevo };
    });
  };

  const handleDirectInput = (key, val) => {
    let num = parseInt(val, 10);
    if (isNaN(num) || num < 0) num = 0;
    
    if (isTransfer) {
      let maxDisp = typeof stock[key] === 'object' ? stock[key].envios : (stock[key]||0);
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
               fileName: `Evidencia_Mov_${Date.now()}.jpg`, 
               mimeType: 'image/jpeg', 
               data: base64Data 
            })
        });
        const result = await response.json();
        if (result.url) { 
           // AGREGAMOS LA NUEVA FOTO AL ARREGLO
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
    if (isTransfer && fotosUrls.length === 0) return dialogs.alert("Debes incluir al menos una foto como soporte físico.", "Soporte Obligatorio");
    
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'movimientos'), {
        tipo, origen: isTransfer ? 'ENVIOS' : 'PROVEEDOR', destino: isTransfer ? 'RECEPCION' : 'ENVIOS',
        items: carrito, fotos: fotosUrls, status: isTransfer ? 'PENDIENTE' : 'COMPLETADO',
        fechaCreacion: Date.now(), creadoPor: perfil.nombre
      });

      const stockRef = doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'stock');
      const updates = {};

      Object.entries(carrito).forEach(([key, qty]) => {
         if (tipo === 'INGRESO') {
           updates[`${key}.envios`] = increment(qty);
         } else if (tipo === 'TRANSFERENCIA') {
           updates[`${key}.envios`] = increment(-qty);
         }
      });
      
      if(Object.keys(updates).length > 0){
         await updateDoc(stockRef, updates);
      }

      loggear(`MOVIMIENTO_${tipo}`, `${perfil.nombre} generó un(a) ${tipo} de ${Object.keys(carrito).length} items.`);
      dialogs.alert(`La operación de ${tipo} fue registrada exitosamente.`, "Movimiento Procesado"); 
      onClose();
    } catch(e) { console.error(e); dialogs.alert("Error de conexión al procesar el movimiento."); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[80] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700">
        <div className="px-8 py-6 border-b dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800">
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">{isTransfer ? <><ArrowRightLeft className="text-purple-600"/> Transferir a Recepción</> : <><PlusCircle className="text-emerald-600"/> Cargar Ingreso Proveedor</>}</h2>
          <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors"><X size={24} className="text-slate-500 dark:text-slate-400"/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-[#f8fafc] dark:bg-slate-900 grid grid-cols-1 md:grid-cols-2 gap-6">
          {catalogo.map(cat => (
            <div key={cat.categoria} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <h3 className="font-bold text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700 pb-2 mb-4">{cat.categoria}</h3>
              {cat.productos.map(prod => (
                <div key={prod.nombre} className="mb-4">
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">{prod.nombre}</div>
                  {prod.presentaciones.map(pres => {
                    const key = `${prod.nombre}|${pres}`; const qty = carrito[key] || 0;
                    let maxDisp = typeof stock[key] === 'object' ? stock[key].envios : (stock[key]||0);
                    return (
                      <div key={pres} className="flex justify-between items-center text-sm py-2 border-b border-slate-50 dark:border-slate-700/50">
                        <span className="font-medium text-slate-600 dark:text-slate-400">{pres} {isTransfer && <span className="text-[10px] font-bold text-sky-600 bg-sky-50 dark:bg-sky-900/30 dark:text-sky-400 px-1.5 py-0.5 rounded ml-1 tracking-widest uppercase">Disp: {maxDisp}</span>}</span>
                        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1 rounded-lg">
                          <button onClick={()=>updateQty(key, -1)} className="bg-white dark:bg-slate-800 px-2 py-1 rounded text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white font-bold shadow-sm">-</button>
                          
                          <input 
                            type="number" 
                            min="0" 
                            value={qty === 0 ? '' : qty} 
                            onChange={(e) => handleDirectInput(key, e.target.value)}
                            className="w-12 text-center font-black text-slate-800 dark:text-white bg-transparent outline-none focus:ring-2 focus:ring-sky-500 rounded" 
                            placeholder="0"
                          />
                          
                          <button onClick={()=>updateQty(key, 1)} className="bg-white dark:bg-slate-800 px-2 py-1 rounded text-sky-600 dark:text-sky-400 hover:text-sky-800 font-bold shadow-sm">+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="p-6 border-t dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col gap-6">
          {isTransfer && (
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 border border-purple-100 dark:border-purple-800 rounded-2xl flex flex-col gap-3">
              <label className="text-xs font-bold uppercase tracking-widest text-purple-800 dark:text-purple-400 block">
                Evidencias Fotográficas Obligatorias (Mínimo 1)
              </label>
              
              <div className="flex gap-3 flex-wrap items-center">
                 {fotosUrls.map((url, idx) => (
                    <div key={idx} className="relative group">
                       <a href={url} target="_blank" rel="noreferrer" className="w-14 h-14 bg-white dark:bg-slate-800 border-2 border-emerald-400 dark:border-emerald-600 rounded-xl flex items-center justify-center text-emerald-500 shadow-sm hover:scale-105 transition-transform" title="Ver foto">
                          <Camera size={20} />
                       </a>
                       <button onClick={() => removeFoto(idx)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-md" title="Eliminar foto">
                          <X size={12} />
                       </button>
                    </div>
                 ))}
                 
                 <label className={`w-14 h-14 text-white rounded-xl cursor-pointer flex items-center justify-center shadow-md transition-colors ${fotosUrls.length > 0 ? 'bg-purple-400 hover:bg-purple-500' : 'bg-purple-600 hover:bg-purple-700 animate-pulse'}`} title="Añadir otra foto">
                   {subiendoFoto ? <Loader2 size={20} className="animate-spin" /> : <PlusCircle size={24}/>} 
                   <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileUpload} disabled={subiendoFoto}/>
                 </label>
              </div>
              <p className="text-[10px] font-semibold text-purple-600 dark:text-purple-400">Puedes subir varias fotos si son muchas cajas o el soporte no entra en una sola toma.</p>
            </div>
          )}
          
          <div className="flex justify-between items-center">
            <div className="font-bold text-slate-500 dark:text-slate-400 text-lg">Total de Items: <span className="text-2xl text-slate-800 dark:text-white ml-2">{Object.values(carrito).reduce((a,b)=>a+b,0)}</span></div>
            <button onClick={handleSubmit} className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg transition-all hover:-translate-y-0.5 text-lg">{isTransfer ? 'Confirmar Transferencia' : 'Aprobar Ingreso Stock'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}