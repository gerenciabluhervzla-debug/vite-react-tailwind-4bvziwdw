import React, { useState, useMemo } from 'react';
import { ShoppingCart, ArrowLeft, Sun, Moon, Store, CheckCircle, Package, Trash2, Loader2, UploadCloud, Search, Percent } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { BRAND_LOGO } from '../config/constants';
import { URL_GOOGLE_SCRIPT } from '../config/firebase'; 
import { compressImage } from '../utils/image';
import { Input, InputDark } from '../components/ui';

export default function PublicPortal({ catalogo, stock, config, db, appId, dialogs, onBack, darkMode, setDarkMode }) {
  const [carrito, setCarrito] = useState({});
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');

  const [form, setForm] = useState({
    nombre: '',
    cedula: '',
    telefono: '',
    agencia: '',
    direccion: '',
    referencia: '',
    comprobanteUrl: ''
  });

  const tasa = parseFloat(config?.tasaDia) || 1;

  const hoyTimestamp = new Date().getTime();
  const isGlobalDiscountActive = config?.descuentoGlobalActivo &&
     config?.descuentoGlobalPorcentaje > 0 &&
     config?.descuentoGlobalInicio && config?.descuentoGlobalFin &&
     hoyTimestamp >= new Date(config.descuentoGlobalInicio + 'T00:00:00').getTime() &&
     hoyTimestamp <= new Date(config.descuentoGlobalFin + 'T23:59:59').getTime();

  const globalDiscountPercent = isGlobalDiscountActive ? parseFloat(config.descuentoGlobalPorcentaje) : 0;

  const updateQty = (key, delta) => {
    setCarrito(prev => {
      const actual = prev[key] || 0;
      const nuevo = Math.max(0, actual + delta);
      
      const maxDisp = typeof stock[key] === 'object' ? stock[key].envios : (stock[key] || 0);
      if (delta > 0 && nuevo > maxDisp) {
        dialogs.alert(`Solo tenemos ${maxDisp} unidades disponibles de este producto.`, "Stock Límite");
        return prev;
      }

      if (nuevo === 0) {
        const copia = { ...prev };
        delete copia[key];
        return copia;
      }
      return { ...prev, [key]: nuevo };
    });
  };

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

  const categoriasDisponibles = useMemo(() => {
    return ['Todos', ...catalogo.filter(c => c.categoria !== 'Complementos Automáticos').map(c => c.categoria)];
  }, [catalogo]);

  const { totalItems, subtotalUsdOriginal, subtotalUsd } = useMemo(() => {
    let items = 0;
    let usd = 0;
    Object.entries(carrito).forEach(([key, qty]) => {
      items += qty;
      const [nombre, pres] = key.split('|');
      catalogo.forEach(c => c.productos.forEach(p => {
        if (p.nombre === nombre) {
          const idx = p.presentaciones.indexOf(pres);
          if (idx >= 0 && p.precios) usd += (p.precios[idx] * qty);
        }
      }));
    });
    
    const discountedUsd = usd * (1 - globalDiscountPercent / 100);
    return { totalItems: items, subtotalUsdOriginal: usd, subtotalUsd: discountedUsd };
  }, [carrito, catalogo, globalDiscountPercent]);

  const totalVes = subtotalUsd * tasa;

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!URL_GOOGLE_SCRIPT) return dialogs.alert("El sistema de subida no está configurado.");

    setSubiendoFoto(true);
    try {
      const base64Data = await compressImage(file, 800, 0.7);
      const response = await fetch(URL_GOOGLE_SCRIPT, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ 
           tokenSecreto: "BLUHER_SECURE_TOKEN_2026",
           fileName: `ComprobanteWeb_${Date.now()}.jpg`, 
           mimeType: 'image/jpeg', 
           data: base64Data 
        })
      });
      const result = await response.json();
      if (result.url) setForm({ ...form, comprobanteUrl: result.url });
      setSubiendoFoto(false);
    } catch (error) {
      console.error(error);
      dialogs.alert("Error subiendo el comprobante.", "Fallo de Red");
      setSubiendoFoto(false);
    }
  };

  // LIMPIEZA DE CÓDIGO MALICIOSO
  const limpiarTexto = (str) => str ? str.replace(/[<>]/g, "") : "";

  const confirmarPedido = async (e) => {
    e.preventDefault();
    if (totalItems === 0) return dialogs.alert("Tu carrito está vacío.");
    if (!form.nombre || !form.cedula || !form.telefono || !form.agencia || !form.direccion) {
      return dialogs.alert("Por favor, llena todos los datos obligatorios de envío.");
    }
    if (!form.referencia || !form.comprobanteUrl) {
      return dialogs.alert("La referencia bancaria y la captura del comprobante son obligatorias para procesar el pedido.");
    }

    setEnviando(true);
    try {
      const lineas = [];
      Object.entries(carrito).forEach(([key, qty]) => {
        lineas.push(`- ${qty}x ${key.replace('|', ' ')}`);
      });
      const productosString = lineas.join('\n');

      const nuevoPedido = {
        clienteNombre: limpiarTexto(form.nombre),
        clienteCedula: limpiarTexto(form.cedula),
        clienteTelefono: limpiarTexto(form.telefono),
        direccion: limpiarTexto(form.direccion),
        courier: form.agencia,
        esMercadoLibre: false,
        esRegalo: false,
        asesora: 'Portal Web',
        moneda: 'VES', 
        monto: subtotalUsd,
        montoUsd: subtotalUsd,
        montoVes: totalVes,
        tasaAplicada: tasa,
        referencia: form.referencia,
        linkComprobantePago: form.comprobanteUrl,
        productos: productosString,
        carritoObj: carrito,
        status: 'Por Pagar / Cotización',
        esPublico: true,
        auditado: false,
        fechaCreacion: Date.now(),
        descuentoGlobalAplicado: globalDiscountPercent 
      };

      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'pedidos'), nuevoPedido);
      
      dialogs.alert("¡Tu pedido y pago han sido enviados con éxito! Nuestro equipo lo procesará en breve.", "¡Gracias por tu compra!");
      setCarrito({});
      setIsCartOpen(false);
      setForm({ nombre: '', cedula: '', telefono: '', agencia: '', direccion: '', referencia: '', comprobanteUrl: '' });
      
    } catch (error) {
      console.error(error);
      dialogs.alert("Error al procesar tu pedido. Intenta nuevamente.", "Error");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-900 transition-colors text-slate-800 dark:text-slate-100 pb-20">
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex justify-between items-center shadow-sm">
        <button onClick={onBack} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
          <ArrowLeft size={24} />
        </button>
        <img src={BRAND_LOGO} alt="Bluher" className="h-8 object-contain dark:invert" />
        <div className="flex gap-2">
          <button onClick={() => setDarkMode(!darkMode)} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            {darkMode ? <Sun size={20}/> : <Moon size={20}/>}
          </button>
          <button onClick={() => setIsCartOpen(true)} className="p-2 text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/30 rounded-full relative transition-colors">
            <ShoppingCart size={24}/>
            {totalItems > 0 && <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-black w-4 h-4 flex items-center justify-center rounded-full animate-bounce">{totalItems}</span>}
          </button>
        </div>
      </header>

      {isGlobalDiscountActive && (
         <div className="bg-gradient-to-r from-pink-500 to-purple-600 text-white text-center py-2 px-4 font-bold text-xs sm:text-sm animate-pulse shadow-md">
            ¡APROVECHA EL {globalDiscountPercent}% DE DESCUENTO EN TODA LA TIENDA HASTA EL {config.descuentoGlobalFin}!
         </div>
      )}

      <div className="bg-[#003366] text-white py-12 px-4 text-center border-b-4 border-sky-400">
        <Store size={48} className="mx-auto mb-4 opacity-50" />
        <h1 className="text-3xl md:text-4xl font-black mb-2 uppercase tracking-tighter">Tienda Oficial Bluher</h1>
        <p className="text-sky-200 text-sm md:text-base font-medium max-w-lg mx-auto">Selecciona tus productos profesionales. Tasa de cálculo de hoy: <b>{tasa} Bs/$</b></p>
      </div>

      <div className="max-w-6xl mx-auto px-4 mt-8">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
          <div className="relative mb-6">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
              <Search size={20} />
            </div>
            <input 
              type="text" 
              placeholder="¿Qué producto estás buscando hoy?" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-2xl bg-[#f0f4f8] dark:bg-slate-900 border-2 border-transparent focus:border-sky-500 outline-none text-slate-800 dark:text-white font-bold transition-all"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {categoriasDisponibles.map(cat => (
              <button 
                key={cat} 
                onClick={() => setSelectedCategory(cat)}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${selectedCategory === cat ? 'bg-[#003366] dark:bg-sky-600 text-white shadow-md hover:-translate-y-0.5' : 'bg-[#f0f4f8] dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto p-4 mt-4">
        {catalogFiltered.length === 0 ? (
          <div className="text-center py-20 px-4 bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 mt-8">
             <Search size={48} className="mx-auto mb-4 text-slate-300 dark:text-slate-600" />
             <h3 className="text-xl font-black text-slate-700 dark:text-slate-300 mb-2">No encontramos resultados</h3>
             <p className="text-slate-500 dark:text-slate-400">Intenta buscar con otras palabras o selecciona otra categoría.</p>
             <button onClick={() => {setSearchTerm(''); setSelectedCategory('Todos');}} className="mt-6 text-sky-600 font-bold underline hover:text-sky-800">Limpiar búsqueda</button>
          </div>
        ) : (
          catalogFiltered.map((cat) => (
            <div key={cat.categoria} className="mb-12 animate-in fade-in">
              <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-6 border-b-2 border-sky-100 dark:border-slate-800 pb-2 uppercase tracking-widest">{cat.categoria}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {cat.productos.map(prod => (
                  <div key={prod.nombre} className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-lg transition-all hover:-translate-y-1 flex flex-col">
                    {prod.imagen ? (
                      <div className="aspect-square bg-slate-50 dark:bg-slate-900 rounded-2xl mb-4 overflow-hidden"><img src={prod.imagen} alt={prod.nombre} className="w-full h-full object-cover" /></div>
                    ) : (
                      <div className="aspect-square bg-sky-50 dark:bg-sky-900/10 rounded-2xl mb-4 flex items-center justify-center text-sky-200 dark:text-sky-800"><Package size={64} /></div>
                    )}
                    <h3 className="font-black text-lg mb-4 leading-tight flex-1">{prod.nombre}</h3>
                    <div className="space-y-3">
                      {prod.presentaciones.map((pres, i) => {
                        const key = `${prod.nombre}|${pres}`;
                        const qty = carrito[key] || 0;
                        const disp = typeof stock[key] === 'object' ? stock[key].envios : (stock[key] || 0);
                        
                        const originalPrice = prod.precios[i];
                        const discountedPrice = originalPrice * (1 - globalDiscountPercent / 100);

                        return (
                          <div key={pres} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl">
                            <div>
                              <div className="text-xs font-bold text-slate-500 uppercase">{pres}</div>
                              {isGlobalDiscountActive ? (
                                <div className="flex items-baseline gap-2">
                                  <span className="font-black text-pink-600 dark:text-pink-400">${discountedPrice.toFixed(2)}</span>
                                  <span className="text-xs font-bold text-slate-400 line-through">${originalPrice}</span>
                                </div>
                              ) : (
                                <div className="font-black text-emerald-600 dark:text-emerald-400">${originalPrice}</div>
                              )}
                            </div>
                            {disp > 0 ? (
                              <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
                                <button onClick={() => updateQty(key, -1)} className="w-8 h-8 flex items-center justify-center font-black text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors">-</button>
                                <span className="w-4 text-center font-black text-sm">{qty}</span>
                                <button onClick={() => updateQty(key, 1)} className="w-8 h-8 flex items-center justify-center font-black text-sky-600 hover:text-sky-800 dark:hover:text-sky-300 transition-colors">+</button>
                              </div>
                            ) : (
                              <span className="text-[10px] font-black text-red-500 bg-red-50 px-2 py-1 rounded uppercase tracking-wider">Agotado</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </main>

      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsCartOpen(false)}></div>
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-in slide-in-from-right">
            <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
              <h2 className="text-2xl font-black flex items-center gap-2"><ShoppingCart className="text-sky-600"/> Tu Carrito</h2>
              <button onClick={() => setIsCartOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white"><ArrowLeft size={24}/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950">
              {totalItems === 0 ? (
                <div className="text-center text-slate-400 mt-20 flex flex-col items-center">
                  <ShoppingCart size={48} className="mb-4 opacity-20" />
                  <p className="font-bold">Tu carrito está vacío.</p>
                  <button onClick={() => setIsCartOpen(false)} className="mt-6 text-sky-600 font-bold underline">Volver a la tienda</button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <h3 className="text-xs font-black uppercase text-slate-400 mb-3 border-b dark:border-slate-700 pb-2">Resumen de Productos</h3>
                    {Object.entries(carrito).map(([key, qty]) => (
                      <div key={key} className="flex justify-between items-center mb-3 last:mb-0">
                        <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
                          <span className="text-sky-600 mr-2">{qty}x</span>{key.replace('|', ' - ')}
                        </div>
                        <button onClick={() => updateQty(key, -qty)} className="text-red-400 hover:text-red-600 p-1 transition-colors"><Trash2 size={16}/></button>
                      </div>
                    ))}
                  </div>

                  <form id="checkout-form" onSubmit={confirmarPedido} className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 space-y-4">
                     <h3 className="text-xs font-black uppercase text-slate-400 mb-2 border-b dark:border-slate-700 pb-2">Tus Datos de Envío</h3>
                     {darkMode ? (
                       <>
                         <InputDark label="Nombre y Apellido" value={form.nombre} onChange={e=>setForm({...form, nombre: e.target.value})} required/>
                         <InputDark label="Cédula o RIF" value={form.cedula} onChange={e=>setForm({...form, cedula: e.target.value})} required placeholder="Ej: V-12345678"/>
                         <InputDark label="Teléfono" value={form.telefono} onChange={e=>setForm({...form, telefono: e.target.value})} required placeholder="Ej: 0414..."/>
                         
                         <div className="flex flex-col">
                           <label className="text-[10px] font-black uppercase text-slate-300 mb-1.5 ml-2">Agencia de Envío</label>
                           <select value={form.agencia} onChange={e=>setForm({...form, agencia: e.target.value})} required className={`p-3.5 border-2 bg-slate-800 rounded-2xl focus:border-sky-400 outline-none font-bold transition-all text-sm ${!form.agencia ? 'border-amber-500 text-slate-400' : 'border-slate-700 text-white'}`}>
                             <option value="" disabled>Seleccionar agencia...</option>
                             <option value="ZOOM">ZOOM</option>
                             <option value="MRW">MRW</option>
                             <option value="Tealca">Tealca</option>
                             <option value="Domesa">Domesa</option>
                           </select>
                         </div>

                         <div className="flex flex-col">
                           <label className="text-[10px] font-black uppercase text-slate-300 mb-1.5 ml-2">Dirección Agencia</label>
                           <textarea value={form.direccion} onChange={e=>setForm({...form, direccion: e.target.value})} required rows="2" placeholder="Estado, Ciudad y nombre de la agencia" className="p-3.5 border-2 border-slate-700 bg-slate-800 text-white rounded-2xl focus:border-sky-400 outline-none font-bold transition-all text-sm"></textarea>
                         </div>
                       </>
                     ) : (
                       <>
                         <Input label="Nombre y Apellido" value={form.nombre} onChange={e=>setForm({...form, nombre: e.target.value})} required/>
                         <Input label="Cédula o RIF" value={form.cedula} onChange={e=>setForm({...form, cedula: e.target.value})} required placeholder="Ej: V-12345678"/>
                         <Input label="Teléfono" value={form.telefono} onChange={e=>setForm({...form, telefono: e.target.value})} required placeholder="Ej: 0414..."/>
                         
                         <div className="flex flex-col">
                           <label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 ml-2">Agencia de Envío</label>
                           <select value={form.agencia} onChange={e=>setForm({...form, agencia: e.target.value})} required className={`p-3.5 border-2 rounded-2xl focus:border-sky-500 outline-none font-bold transition-all text-sm bg-slate-50 ${!form.agencia ? 'border-amber-400 text-slate-400' : 'border-slate-100 text-slate-700'}`}>
                             <option value="" disabled>Seleccionar agencia...</option>
                             <option value="ZOOM">ZOOM</option>
                             <option value="MRW">MRW</option>
                             <option value="Tealca">Tealca</option>
                             <option value="Domesa">Domesa</option>
                           </select>
                         </div>

                         <div className="flex flex-col">
                           <label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 ml-2">Dirección Agencia</label>
                           <textarea value={form.direccion} onChange={e=>setForm({...form, direccion: e.target.value})} required rows="2" placeholder="Estado, Ciudad y nombre de la agencia" className="p-3.5 border-2 border-slate-100 rounded-2xl focus:border-sky-500 outline-none font-bold transition-all text-sm bg-slate-50 text-slate-700"></textarea>
                         </div>
                       </>
                     )}

                     <h3 className="text-xs font-black uppercase text-slate-400 mt-6 mb-2 border-b dark:border-slate-700 pb-2">Información de Pago (Obligatorio)</h3>
                     <p className="text-[10px] text-slate-500 mb-3">Adjunta la referencia y captura del pago móvil o transferencia para procesar tu orden.</p>
                     
                     {darkMode ? <InputDark label="Referencia Bancaria" value={form.referencia} onChange={e=>setForm({...form, referencia: e.target.value})} required placeholder="Ej: 1234 Banesco"/> 
                               : <Input label="Referencia Bancaria" value={form.referencia} onChange={e=>setForm({...form, referencia: e.target.value})} required placeholder="Ej: 1234 Banesco"/>}
                     
                     <div className="mt-2">
                        <label className={`flex items-center justify-center gap-2 w-full p-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors font-bold text-sm ${form.comprobanteUrl ? 'border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-300 dark:border-slate-600 text-slate-500 hover:border-sky-500 hover:text-sky-600'}`}>
                          {subiendoFoto ? <Loader2 size={20} className="animate-spin"/> : (form.comprobanteUrl ? <CheckCircle size={20}/> : <UploadCloud size={20}/>)}
                          {form.comprobanteUrl ? 'Comprobante Cargado' : 'Subir Capture de Pantalla'}
                          <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={subiendoFoto}/>
                        </label>
                     </div>
                  </form>
                </div>
              )}
            </div>

            <div className="p-6 bg-white dark:bg-slate-900 border-t dark:border-slate-800">
               {isGlobalDiscountActive && (
                 <div className="flex justify-between items-center mb-1 text-slate-400">
                   <span className="text-xs font-bold">Subtotal Original</span>
                   <span className="text-sm font-bold line-through">${subtotalUsdOriginal.toFixed(2)}</span>
                 </div>
               )}
               <div className="flex justify-between items-center mb-2">
                 <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-xs tracking-widest">Total a Pagar</span>
                 <div className="flex items-center gap-2">
                   {isGlobalDiscountActive && <span className="bg-pink-100 text-pink-700 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border border-pink-200">-{globalDiscountPercent}%</span>}
                   <span className="text-3xl font-black text-slate-800 dark:text-white">${subtotalUsd.toFixed(2)}</span>
                 </div>
               </div>
               <div className="text-right text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-6">Equivale a: Bs. {totalVes.toFixed(2)}</div>
               
               <button form="checkout-form" type="submit" disabled={totalItems === 0 || enviando || subiendoFoto} className="w-full bg-[#003366] dark:bg-sky-600 hover:bg-[#002244] dark:hover:bg-sky-500 disabled:bg-slate-400 dark:disabled:bg-slate-700 text-white font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 uppercase tracking-widest transition-all hover:-translate-y-1 disabled:opacity-50 disabled:hover:translate-y-0">
                 {enviando ? <><Loader2 className="animate-spin"/> Procesando...</> : 'Enviar Pedido y Comprobante'}
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}