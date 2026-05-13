import React, { useState } from 'react';
import { Truck, Clock, Printer, CheckSquare, AlertTriangle, Package, FileText, Camera, CheckCircle, Loader2, UploadCloud } from 'lucide-react';
import { updateDoc, doc } from 'firebase/firestore';
import { URL_GOOGLE_SCRIPT } from '../config/firebase';

export default function PanelDespacho({ pedidos, catalogo, stock, cambiarEstado, db, appId, loggear, dialogs }) {
  const [vistaDespacho, setVistaDespacho] = useState('pendientes');

  const pedidosValidados = pedidos.filter(p => p.status === 'Validado');
  const pedidosDespachados = pedidos.filter(p => p.status === 'Despachado');
  const pedidosPendientes = pedidos.filter(p => p.status === 'Pendiente' || p.status === 'Rechazado').length;

  const [guiasInput, setGuiasInput] = useState({});
  const [subiendo, setSubiendo] = useState({ id: null, field: null });
  const [inventarioChecked, setInventarioChecked] = useState({}); 

  const handleGuiaChange = (id, field, value) => setGuiasInput(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  const handleFileUpload = async (e, id, field) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!URL_GOOGLE_SCRIPT) return dialogs.alert("⚠️ Falta configurar el puente de Google Drive. Por ahora, debes tomar la foto, subirla a drive y pegar el enlace manualmente.", "Configuración Faltante");
    
    setSubiendo({ id, field });
    try {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = async () => {
            const base64Data = reader.result.split(',')[1];
            const response = await fetch(URL_GOOGLE_SCRIPT, {
                method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ fileName: `Soporte_${id.substring(0,5)}_${field}.jpg`, mimeType: file.type, data: base64Data })
            });
            const result = await response.json();
            if (result.url) { handleGuiaChange(id, field, result.url); loggear('FOTO_SUBIDA', `Foto ${field} en ${id}`); }
            setSubiendo({ id: null, field: null });
        };
    } catch (error) { console.error(error); dialogs.alert("Error subiendo la foto a Drive. Revisa tu conexión.", "Fallo de Red"); setSubiendo({ id: null, field: null }); }
  };

  const guardarGuia = async (pedido) => {
    const inputData = guiasInput[pedido.id];
    if (!inputData || !inputData.guia || !inputData.link || !inputData.fotoProductos) {
      return dialogs.alert("⚠️ ALERTA: Todos los campos son obligatorios.\n\nDebes ingresar:\n1. Número de Guía\n2. Link/Foto del recibo de Guía\n3. Link/Foto de los productos armados", "Información Incompleta");
    }
    
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', pedido.id), { 
        guia: inputData.guia, linkGuia: inputData.link, linkFotoProductos: inputData.fotoProductos, status: 'Despachado'
      });
      loggear('PEDIDO_DESPACHADO', `Despacho ${pedido.clienteNombre} (Guía: ${inputData.guia})`);
      dialogs.alert("Guía y soportes guardados correctamente. El pedido ahora pasará al historial de Despachos.", "Despacho Confirmado");
    } catch(e) { console.error(e); dialogs.alert("Error al intentar guardar la información.", "Error"); }
  };

  const pedidosAMostrar = vistaDespacho === 'pendientes' ? pedidosValidados : pedidosDespachados;

  const toggleCheck = (key) => {
    setInventarioChecked(prev => ({...prev, [key]: !prev[key]}));
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b border-slate-100 dark:border-slate-700 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3"><Truck className="text-sky-600"/> Logística de Envíos</h2>
          <div className="flex flex-wrap gap-2 mt-4 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl w-max">
            <button onClick={() => setVistaDespacho('pendientes')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${vistaDespacho === 'pendientes' ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Por Empacar ({pedidosValidados.length})</button>
            <button onClick={() => setVistaDespacho('historial')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${vistaDespacho === 'historial' ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Enviados</button>
            <button onClick={() => setVistaDespacho('inventario')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${vistaDespacho === 'inventario' ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Validar Inventario</button>
          </div>
        </div>
        {vistaDespacho !== 'inventario' && (
          <button onClick={() => window.print()} className="bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900 font-bold py-2.5 px-5 rounded-xl transition-colors flex items-center gap-2 text-sm shadow-sm">
            <Printer size={18} /> Imprimir Etiquetas
          </button>
        )}
      </div>

      {pedidosPendientes > 0 && vistaDespacho === 'pendientes' && (
        <div className="mb-8 bg-sky-50/50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800 p-5 rounded-xl flex items-start gap-4 shadow-sm">
          <div className="p-2 bg-sky-100 dark:bg-sky-900/50 rounded-full text-sky-600 dark:text-sky-400 shrink-0"><Clock size={20} /></div>
          <div>
            <h3 className="text-sky-900 dark:text-sky-300 font-bold text-lg">Órdenes en proceso</h3>
            <p className="text-sky-800/80 dark:text-sky-200/80 text-sm mt-1 font-medium">Hay <strong>{pedidosPendientes} pedido(s)</strong> siendo verificados por administración. Te sugerimos esperar a que los validen todos antes de imprimir para que las etiquetas salgan en la misma página.</p>
          </div>
        </div>
      )}

      {vistaDespacho === 'inventario' ? (
        <div className="animate-in fade-in">
          <div className="mb-6 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2"><CheckSquare className="text-sky-500"/> Esta vista es exclusiva para validar las cantidades físicas en el almacén de despacho. Las marcas no se guardan.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
             {catalogo.map(c => c.productos.map(p => p.presentaciones.map(pres => {
                const key = `${p.nombre}|${pres}`;
                const disp = typeof stock[key] === 'object' ? stock[key].envios : (stock[key]||0);
                if (disp === 0) return null; 
                return (
                  <div key={key} onClick={()=>toggleCheck(key)} className={`p-4 rounded-xl border-2 cursor-pointer transition-colors flex items-center justify-between ${inventarioChecked[key] ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-white border-slate-100 dark:bg-slate-800 dark:border-slate-700 hover:border-sky-300'}`}>
                    <div>
                      <div className={`font-bold text-sm ${inventarioChecked[key] ? 'text-emerald-800 dark:text-emerald-400 line-through opacity-70' : 'text-slate-800 dark:text-slate-100'}`}>{p.nombre}</div>
                      <div className={`text-xs font-semibold mt-1 ${inventarioChecked[key] ? 'text-emerald-600 dark:text-emerald-500 opacity-70' : 'text-slate-500'}`}>{pres}</div>
                    </div>
                    <div className={`text-2xl font-black ${inventarioChecked[key] ? 'text-emerald-600 dark:text-emerald-500 opacity-70' : 'text-sky-600 dark:text-sky-400'}`}>
                      {disp}
                    </div>
                  </div>
                )
             })))}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
          <table className="w-full text-left border-collapse min-w-[800px] text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                <th className="p-4 border-b dark:border-slate-700 font-bold tracking-wide w-1/4">Datos del Paquete</th>
                <th className="p-4 border-b dark:border-slate-700 font-bold tracking-wide">Dirección y Contenido</th>
                <th className="p-4 border-b dark:border-slate-700 font-bold tracking-wide w-1/3">Gestión de Guía y Soportes</th>
              </tr>
            </thead>
            <tbody>
              {pedidosAMostrar.length === 0 ? <tr><td colSpan="3" className="p-10 text-center text-slate-400 italic font-bold">No hay envíos pendientes en esta vista.</td></tr> : pedidosAMostrar.map(p => (
                <tr key={p.id} className="border-b border-slate-50 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-4 align-top">
                    <div className="font-bold text-slate-800 dark:text-slate-100 text-lg flex items-center gap-2">
                       {p.clienteNombre}
                    </div>
                    <div className="text-xs font-black tracking-widest uppercase text-sky-600 dark:text-sky-400 mt-2">{p.courier}</div>
                    <div className="text-xs font-semibold text-slate-500 mt-2">Tel: {p.clienteTelefono}</div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-3">Sale: {p.fechaDespacho}</div>
                  </td>
                  <td className="p-4 align-top">
                    {p.esMercadoLibre && vistaDespacho === 'pendientes' && (
                      <div className="mb-3 bg-yellow-400 text-slate-900 p-3 rounded-xl text-xs font-black flex items-center gap-2 shadow-md uppercase tracking-wider animate-pulse">
                        <AlertTriangle size={18} className="text-slate-900 shrink-0" /> ¡MERCADOLIBRE! IMPRIMIR GUÍA DE ML
                      </div>
                    )}
                    <div className="font-medium bg-[#f0f4f8] dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-3 whitespace-pre-wrap shadow-sm text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">{typeof p.productos === 'string' ? p.productos : JSON.stringify(p.productos)}</div>
                    <div className="text-[13px] font-semibold text-slate-600 dark:text-slate-400 flex items-start gap-2 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg"><div className="mt-0.5 text-sky-600"><Package size={16}/></div>{p.direccion}</div>
                  </td>
                  <td className="p-4 align-top bg-slate-50/50 dark:bg-slate-900/30">
                    {p.status === 'Despachado' ? (
                      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="text-sm mb-4"><span className="font-bold text-slate-400 uppercase text-[10px] tracking-widest block mb-1">Número de Guía</span> <span className="font-black text-slate-800 dark:text-slate-100 text-lg">{p.guia}</span></div>
                        <div className="flex flex-col gap-3 mb-5">
                          {p.linkGuia && <a href={p.linkGuia} target="_blank" rel="noreferrer" className="text-xs text-sky-600 dark:text-sky-400 hover:text-sky-800 font-bold flex items-center gap-2 bg-sky-50 dark:bg-sky-900/30 p-2 rounded-lg transition-colors"><FileText size={16}/> Ver Recibo Digital</a>}
                          {p.linkFotoProductos && <a href={p.linkFotoProductos} target="_blank" rel="noreferrer" className="text-xs text-sky-600 dark:text-sky-400 hover:text-sky-800 font-bold flex items-center gap-2 bg-sky-50 dark:bg-sky-900/30 p-2 rounded-lg transition-colors"><Camera size={16}/> Ver Foto del Paquete</a>}
                        </div>
                        <div className="text-xs text-emerald-600 dark:text-emerald-400 font-black mb-3 uppercase tracking-widest flex items-center gap-1"><CheckCircle size={14}/> Despachado OK</div>
                        <button onClick={() => cambiarEstado(p.id, 'Validado')} className="text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 text-xs font-bold underline decoration-slate-300 transition-colors">Corregir Información de Envío</button>
                      </div>
                    ) : (
                      <div className="space-y-4 bg-white dark:bg-slate-800 p-5 rounded-2xl border-2 border-sky-100 dark:border-slate-700 shadow-sm">
                        <input type="text" placeholder="Número de Guía Tracker" className="w-full text-sm p-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl font-bold outline-none focus:border-sky-500 bg-slate-50 dark:bg-slate-900 dark:text-white transition-colors" value={guiasInput[p.id]?.guia || ''} onChange={(e) => handleGuiaChange(p.id, 'guia', e.target.value)} />
                        
                        <div className="flex gap-2 relative">
                          <input type="text" placeholder="URL Recibo Guía" className="w-full text-xs p-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl pr-12 outline-none focus:border-sky-500 bg-slate-50 dark:bg-slate-900 dark:text-white font-semibold transition-colors" value={guiasInput[p.id]?.link || ''} onChange={(e) => handleGuiaChange(p.id, 'link', e.target.value)} />
                          <label className="absolute right-1.5 top-1.5 p-2 bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-400 hover:bg-sky-600 hover:text-white rounded-lg cursor-pointer transition-colors shadow-sm" title="Subir Foto de Galería">
                            {subiendo.id === p.id && subiendo.field === 'link' ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileUpload(e, p.id, 'link')} />
                          </label>
                        </div>

                        <div className="flex gap-2 relative">
                          <input type="text" placeholder="URL Foto Empaque" className="w-full text-xs p-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl pr-12 outline-none focus:border-sky-500 bg-slate-50 dark:bg-slate-900 dark:text-white font-semibold transition-colors" value={guiasInput[p.id]?.fotoProductos || ''} onChange={(e) => handleGuiaChange(p.id, 'fotoProductos', e.target.value)} />
                          <label className="absolute right-1.5 top-1.5 p-2 bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-400 hover:bg-sky-600 hover:text-white rounded-lg cursor-pointer transition-colors shadow-sm" title="Subir Foto de Galería">
                            {subiendo.id === p.id && subiendo.field === 'fotoProductos' ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileUpload(e, p.id, 'fotoProductos')} />
                          </label>
                        </div>

                        <button onClick={() => guardarGuia(p)} className="w-full bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold py-3.5 rounded-xl mt-2 flex items-center justify-center gap-2 transition-all shadow-md hover:-translate-y-0.5">
                          <Truck size={18}/> Confirmar y Archivar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}