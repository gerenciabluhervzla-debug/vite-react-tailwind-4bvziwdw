import React, { useState } from 'react';
import { Package, Edit3, Trash2 } from 'lucide-react';
import { Input } from '../../components/ui';
import { setDoc, doc } from 'firebase/firestore';

export default function SubPanelCatalogo({ catalogo, db, appId, loggear, dialogs }) {
  const defaultForm = { categoria: '', nuevoCat: '', nombre: '', presentaciones: '', precios: '', imagen: '' };
  const [form, setForm] = useState(defaultForm);
  const [modoEdicion, setModoEdicion] = useState(null); 

  const cargarEdicion = (catNombre, prod) => {
    setForm({ 
      categoria: catNombre, 
      nuevoCat: '', 
      nombre: prod.nombre, 
      presentaciones: prod.presentaciones.join(', '), 
      precios: prod.precios ? prod.precios.join(', ') : '', 
      imagen: prod.imagen || '' 
    });
    setModoEdicion({ catOriginal: catNombre, nomOriginal: prod.nombre });
  };

  const cancelarEdicion = () => {
    setModoEdicion(null); setForm(defaultForm);
  };

  const eliminarProducto = (catNombre, prodNombre) => {
    dialogs.confirm(`¿Seguro que deseas eliminar ${prodNombre} del catálogo?\n\nNota: Esto no altera el stock físico, solo lo oculta del carrito de ventas.`, async () => {
      let newCatalogo = [...catalogo];
      let catIndex = newCatalogo.findIndex(c => c.categoria === catNombre);
      if(catIndex >= 0) {
         newCatalogo[catIndex].productos = newCatalogo[catIndex].productos.filter(p => p.nombre !== prodNombre);
         if(newCatalogo[catIndex].productos.length === 0) newCatalogo.splice(catIndex, 1);
         try {
           await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'catalogo'), { categorias: newCatalogo });
           loggear('CATALOGO_ELIMINADO', `Se eliminó el producto: ${prodNombre}`);
           dialogs.alert("Producto eliminado del catálogo web.", "Operación Exitosa");
         } catch(err) { console.error(err); }
      }
    }, "Eliminar Producto");
  };

  const guardarProducto = async (e) => {
    e.preventDefault();
    const catName = form.categoria === 'OTRA' ? form.nuevoCat : form.categoria;
    const presentacionesArr = form.presentaciones.split(',').map(s=>s.trim()).filter(Boolean);
    const preciosArr = form.precios ? form.precios.split(',').map(s=>parseFloat(s.trim()) || 0) : presentacionesArr.map(()=>0);
    
    if(!catName || !form.nombre || presentacionesArr.length === 0) return dialogs.alert("Por favor completa todos los campos requeridos.", "Información Incompleta");

    let newCatalogo = JSON.parse(JSON.stringify(catalogo)); 
    
    if (modoEdicion) {
      let oldCatIndex = newCatalogo.findIndex(c => c.categoria === modoEdicion.catOriginal);
      if(oldCatIndex >= 0) {
         newCatalogo[oldCatIndex].productos = newCatalogo[oldCatIndex].productos.filter(p => p.nombre !== modoEdicion.nomOriginal);
         if(newCatalogo[oldCatIndex].productos.length === 0) newCatalogo.splice(oldCatIndex, 1);
      }
    }

    let catIndex = newCatalogo.findIndex(c => c.categoria.toLowerCase() === catName.toLowerCase());
    const nuevoProd = { nombre: form.nombre, presentaciones: presentacionesArr, precios: preciosArr, imagen: form.imagen };

    if (catIndex >= 0) {
      newCatalogo[catIndex].productos.push(nuevoProd);
    } else {
      newCatalogo.push({ categoria: catName, productos: [nuevoProd] });
    }

    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'catalogo'), { categorias: newCatalogo });
      loggear('CATALOGO_ACTUALIZADO', `Se ${modoEdicion ? 'editó' : 'añadió'} el producto: ${form.nombre}`);
      dialogs.alert(`El producto ha sido ${modoEdicion ? 'actualizado' : 'añadido'} correctamente en la tienda.`, "Catálogo Actualizado");
      cancelarEdicion();
    } catch(err) { console.error(err); }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-inner">
        <h3 className="font-black text-xl text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2"><Package className="text-sky-600"/> {modoEdicion ? 'Editar Producto Seleccionado' : 'Añadir Nuevo Producto al Catálogo'}</h3>
        <form onSubmit={guardarProducto} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Categoría Principal</label>
            <select value={form.categoria} onChange={e=>setForm({...form, categoria: e.target.value})} className="p-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 outline-none focus:border-sky-500 font-bold text-slate-700 dark:text-slate-200 transition-colors" required>
              <option value="">Selecciona...</option>
              {catalogo.map(c => <option key={c.categoria} value={c.categoria}>{c.categoria}</option>)}
              <option value="OTRA">+ Crear Nueva Categoría</option>
            </select>
          </div>
          {form.categoria === 'OTRA' ? <Input label="Nombre de Nueva Categoría" value={form.nuevoCat} onChange={e=>setForm({...form, nuevoCat: e.target.value})} required/> : <div></div>}
          
          <Input label="Nombre del Producto" value={form.nombre} onChange={e=>setForm({...form, nombre: e.target.value})} placeholder="Ej: Tratamiento KeraBluher" required/>
          <Input label="Presentaciones (Separadas por coma)" value={form.presentaciones} onChange={e=>setForm({...form, presentaciones: e.target.value})} placeholder="Ej: 1 Litro, 500ml, 250ml" required/>
          <Input label="Precios en USD (Separados por coma en mismo orden)" value={form.precios} onChange={e=>setForm({...form, precios: e.target.value})} placeholder="Ej: 25, 15, 8" />
          <Input label="URL de Imagen (Opcional)" value={form.imagen} onChange={e=>setForm({...form, imagen: e.target.value})} placeholder="https://...imagen.jpg" />
          
          <div className="md:col-span-2 flex justify-end gap-3 mt-4">
            {modoEdicion && <button type="button" onClick={cancelarEdicion} className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-3 px-6 rounded-xl transition-colors">Cancelar Edición</button>}
            <button type="submit" className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 px-8 rounded-xl shadow-md transition-all hover:-translate-y-0.5">{modoEdicion ? 'Actualizar Producto' : 'Guardar Producto Nuevo'}</button>
          </div>
        </form>
      </div>

      <div className="bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-700">
        <h3 className="font-black text-xl text-slate-800 dark:text-slate-100 mb-4 px-2">Catálogo Web Actual</h3>
        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
          <table className="w-full text-left text-sm border-collapse">
            <thead><tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400"><th className="p-4 border-b dark:border-slate-700 font-bold tracking-wide">Categoría</th><th className="p-4 border-b dark:border-slate-700 font-bold tracking-wide">Producto, Presentaciones y Precio</th><th className="p-4 border-b dark:border-slate-700 font-bold tracking-wide text-right">Acciones</th></tr></thead>
            <tbody>
              {catalogo.map(c => c.productos.map(p => (
                <tr key={p.nombre} className="border-b border-slate-50 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-4 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-widest">{c.categoria}</td>
                  <td className="p-4">
                    <div className="font-bold text-slate-800 dark:text-slate-100 text-base">{p.nombre}</div>
                    <div className="flex flex-wrap gap-2 mt-2">
                       {p.presentaciones.map((pres, i) => (
                         <span key={pres} className="text-xs font-semibold bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 px-2 py-1 rounded">
                           {pres} {p.precios && p.precios[i] > 0 ? `($${p.precios[i]})` : ''}
                         </span>
                       ))}
                    </div>
                  </td>
                  <td className="p-4 flex justify-end gap-2">
                     <button onClick={()=>cargarEdicion(c.categoria, p)} className="text-sky-600 bg-sky-50 dark:bg-sky-900/30 dark:text-sky-400 p-2.5 rounded-lg hover:bg-sky-100 dark:hover:bg-sky-900 transition-colors" title="Editar Producto"><Edit3 size={18}/></button>
                     <button onClick={()=>eliminarProducto(c.categoria, p.nombre)} className="text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400 p-2.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900 transition-colors" title="Eliminar del Catálogo"><Trash2 size={18}/></button>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}