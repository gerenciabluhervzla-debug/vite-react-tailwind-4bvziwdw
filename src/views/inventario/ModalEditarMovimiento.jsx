import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Trash2, AlertCircle } from 'lucide-react';
import { doc, writeBatch, increment } from 'firebase/firestore';

export default function ModalEditarMovimiento({ movimiento, catalogo, db, appId, loggear, perfil, dialogs, onClose }) {
  const [lineas, setLineas] = useState([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (movimiento && movimiento.items) {
      const lineasIniciales = Object.entries(movimiento.items).map(([id, qty]) => ({
        id, // Mantenemos el ID original de Firebase (ej: Producto|Rojo)
        qty: Number(qty)
      }));
      setLineas(lineasIniciales);
    }
  }, [movimiento]);

  const agregarLinea = () => {
    setLineas([...lineas, { id: '', qty: 1 }]);
  };

  const eliminarLinea = (index) => {
    setLineas(lineas.filter((_, i) => i !== index));
  };

  const actualizarLinea = (index, campo, valor) => {
    const nuevasLineas = [...lineas];
    nuevasLineas[index][campo] = valor;
    setLineas(nuevasLineas);
  };

  const guardarEdicion = async () => {
    if (lineas.length === 0) {
      dialogs.alert("Debes incluir al menos un producto.");
      return;
    }
    
    if (lineas.some(l => !l.id || l.qty <= 0)) {
      dialogs.alert("Todas las líneas deben tener un producto válido seleccionado y una cantidad mayor a 0.");
      return;
    }

    setGuardando(true);

    try {
      const batch = writeBatch(db);
      const stockRef = doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'stock');
      const movRef = doc(db, 'artifacts', appId, 'public', 'data', 'movimientos', movimiento.id);

      const diferenciasDeStock = {};
      
      // A. DEVOLVEMOS el stock del producto erróneo (sumamos)
      Object.entries(movimiento.items).forEach(([prodId, qty]) => {
        diferenciasDeStock[prodId] = (diferenciasDeStock[prodId] || 0) + Number(qty);
      });

      // B. DESCONTAMOS el stock de los productos correctos (restamos)
      const nuevosItemsObj = {};
      lineas.forEach(linea => {
        const qty = Number(linea.qty);
        diferenciasDeStock[linea.id] = (diferenciasDeStock[linea.id] || 0) - qty;
        nuevosItemsObj[linea.id] = (nuevosItemsObj[linea.id] || 0) + qty;
      });

      const stockUpdates = {};
      const origenStock = movimiento.origen ? movimiento.origen.toLowerCase() : 'envios';

      Object.entries(diferenciasDeStock).forEach(([prodId, diferencia]) => {
        if (diferencia !== 0) {
          stockUpdates[prodId] = { [origenStock]: increment(diferencia) };
        }
      });

      if (Object.keys(stockUpdates).length > 0) {
        batch.set(stockRef, stockUpdates, { merge: true });
      }

      batch.update(movRef, {
        items: nuevosItemsObj,
        editadoPor: perfil.nombre,
        fechaEdicion: Date.now()
      });

      await batch.commit();

      loggear('TRANSFERENCIA_EDITADA', `Usuario editó productos/cantidades de la transferencia enviada el ${new Date(movimiento.fechaCreacion).toLocaleDateString()}`);
      dialogs.alert("Transferencia corregida. El inventario ha sido reajustado automáticamente.");
      onClose();

    } catch (error) {
      console.error("Error al guardar edición:", error);
      dialogs.alert("Hubo un error al intentar guardar los cambios. Intenta nuevamente.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
          <div>
            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">
              Corregir Transferencia
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Modifica los productos o cantidades. El stock se ajustará automáticamente.
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 bg-sky-50 dark:bg-sky-900/30 border-b border-sky-100 dark:border-sky-800 flex items-start gap-3">
          <AlertCircle size={18} className="text-sky-600 dark:text-sky-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-sky-800 dark:text-sky-300">
            <strong>Atención:</strong> Los productos que elimines regresarán al almacén de origen, y los nuevos serán descontados de inmediato.
          </p>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="space-y-3">
            {lineas.map((linea, idx) => (
              <div key={idx} className="flex gap-3 items-start animate-in slide-in-from-left-2">
                <div className="flex-1">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1 block">
                    Producto
                  </label>
                  <select
                    value={linea.id}
                    onChange={(e) => actualizarLinea(idx, 'id', e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:border-sky-500 transition-colors"
                  >
                    <option value="">Selecciona un producto...</option>
                    {catalogo && catalogo.map((prod, i) => {
                      // AQUÍ ESTÁ LA MAGIA: Detectamos la estructura de tu catálogo automáticamente
                      const esString = typeof prod === 'string';
                      const valorOpcion = esString ? prod : prod.id;
                      const nombreOpcion = esString ? prod.replace(/\|/g, ' ') : prod.nombre;

                      return (
                        <option key={esString ? i : prod.id} value={valorOpcion}>
                          {nombreOpcion}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="w-24">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1 block">
                    Cant.
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={linea.qty}
                    onChange={(e) => actualizarLinea(idx, 'qty', e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:border-sky-500 transition-colors text-center font-bold"
                  />
                </div>

                <button
                  onClick={() => eliminarLinea(idx)}
                  className="mt-6 p-3 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors"
                  title="Eliminar producto"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={agregarLinea}
            className="mt-4 w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 hover:text-sky-600 hover:border-sky-200 dark:hover:border-sky-800 dark:hover:text-sky-400 flex items-center justify-center gap-2 font-bold text-sm transition-colors"
          >
            <Plus size={16} /> Agregar otro producto
          </button>
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={guardando}
            className="px-6 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          
          <button
            onClick={guardarEdicion}
            disabled={guardando}
            className="px-6 py-2.5 rounded-xl font-bold text-white bg-sky-600 hover:bg-sky-700 shadow-md flex items-center gap-2 transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none"
          >
            {guardando ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Procesando...
              </span>
            ) : (
              <>
                <Save size={18} /> Guardar Cambios
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}