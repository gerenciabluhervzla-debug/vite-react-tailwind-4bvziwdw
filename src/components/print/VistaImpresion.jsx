import React, { useMemo } from 'react';
import { Truck, MapPin, Phone, User, Package, CalendarDays, Clock } from 'lucide-react';
import { BRAND_LOGO } from '../../config/constants';

export default function VistaImpresion({ pedidos }) {
  // 1. ORDEN ASCENDENTE: Los más antiguos primero
  const pedidosOrdenados = useMemo(() => {
    if (!pedidos) return [];
    return [...pedidos].sort((a, b) => a.fechaCreacion - b.fechaCreacion);
  }, [pedidos]);

  // Si no hay pedidos validados para imprimir, no renderizamos nada
  if (pedidosOrdenados.length === 0) return null;

  return (
    // 2. MULTIPLES POR HOJA: Usamos grid de 2 columnas en modo impresión
    <div className="hidden print:grid fixed inset-0 bg-white z-[9999] grid-cols-2 gap-6 p-4 overflow-visible content-start text-black">
      {pedidosOrdenados.map((pedido, index) => {
        
        // Mapeo seguro a la nueva arquitectura
        const tipoDespacho = pedido.tipoDespacho || 'Nacional';
        const isDelivery = tipoDespacho === 'Delivery';
        const isTienda = tipoDespacho === 'Tienda';
        const isNacional = tipoDespacho === 'Nacional';

        return (
          // break-inside-avoid evita que la etiqueta se corte a la mitad entre dos páginas
          <div key={pedido.id} className="relative w-full bg-white p-6 border-2 border-gray-800 rounded-2xl break-inside-avoid">
            
            {/* 3. NUMERACIÓN DIARIA */}
            <div className="absolute top-0 left-0 bg-black text-white px-4 py-2 font-black text-xl rounded-tl-xl rounded-br-xl">
               #{index + 1}
            </div>

            <div className="flex flex-col items-center border-b-2 border-black pb-4 mb-4 mt-2">
              <img src={BRAND_LOGO} alt="Bluher" className="h-14 mb-2 grayscale object-contain" />
              <h1 className="text-lg font-black tracking-widest uppercase text-center leading-tight">Etiqueta de Despacho</h1>
              <div className="text-xs font-bold mt-2 bg-black text-white px-4 py-1 rounded-full uppercase tracking-widest">
                 {isTienda ? 'Retiro en Tienda' : isDelivery ? 'Delivery Local' : 'Envío Nacional'}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-[10px] font-black uppercase text-gray-500 mb-1 flex items-center gap-1"><User size={12}/> Destinatario</div>
                <div className="text-xl font-black leading-tight uppercase">{pedido.clienteNombre}</div>
                <div className="text-sm font-bold text-gray-700 mt-1">C.I / RIF: {pedido.clienteCedula || 'N/A'}</div>
              </div>

              <div>
                <div className="text-[10px] font-black uppercase text-gray-500 mb-1 flex items-center gap-1"><Phone size={12}/> Teléfono</div>
                <div className="text-xl font-bold">{pedido.clienteTelefono || 'Sin teléfono registrado'}</div>
              </div>

              {/* DIRECCIÓN: Solo aplica para Delivery y Nacional */}
              {!isTienda && (
                 <div>
                   <div className="text-[10px] font-black uppercase text-gray-500 mb-1 flex items-center gap-1"><MapPin size={12}/> Dirección de Entrega</div>
                   <div className="text-sm font-bold uppercase leading-snug border-l-4 border-black pl-3 py-1">
                     {pedido.direccion}
                   </div>
                 </div>
              )}

              {/* RECUADRO ENVÍO NACIONAL */}
              {isNacional && (
                 <div className="grid grid-cols-2 gap-4 bg-gray-100 p-3 rounded-xl border border-gray-300">
                   <div>
                     <div className="text-[10px] font-black uppercase text-gray-500">Agencia</div>
                     <div className="text-base font-black uppercase">{pedido.courier}</div>
                   </div>
                   <div>
                     <div className="text-[10px] font-black uppercase text-gray-500">Modalidad</div>
                     <div className="text-base font-black uppercase">{pedido.pagoEnvio === 'PAGADO' ? 'PAGADO' : 'C.O.D'}</div>
                   </div>
                 </div>
              )}

              {/* RECUADRO DELIVERY */}
              {isDelivery && (
                 <div className="grid grid-cols-2 gap-4 bg-gray-100 p-3 rounded-xl border border-gray-300">
                   <div>
                     <div className="text-[10px] font-black uppercase text-gray-500 flex items-center gap-1"><CalendarDays size={10}/> Fecha Solicitada</div>
                     <div className="text-sm font-black">{pedido.deliveryFecha || 'Hoy'}</div>
                   </div>
                   <div>
                     <div className="text-[10px] font-black uppercase text-gray-500 flex items-center gap-1"><Clock size={10}/> Hora Req.</div>
                     <div className="text-sm font-black">{pedido.deliveryHora || 'Cualquier hora'}</div>
                   </div>
                 </div>
              )}

              {/* RECUADRO TIENDA */}
              {isTienda && (
                 <div className="bg-gray-100 p-3 rounded-xl border border-gray-300">
                   <div className="text-[10px] font-black uppercase text-gray-500 mb-1 flex items-center gap-1"><User size={12}/> Autorizado para Retirar</div>
                   <div className="text-base font-black uppercase">{pedido.retiroNombre || pedido.clienteNombre}</div>
                   <div className="text-xs font-bold mt-1">C.I: {pedido.retiroCedula || pedido.clienteCedula} | Tlf: {pedido.retiroTelefono || pedido.clienteTelefono}</div>
                 </div>
              )}

              <div className="pt-4 border-t-2 border-dashed border-gray-300">
                <div className="text-[10px] font-black uppercase text-gray-500 mb-2 flex items-center gap-1"><Package size={12}/> Contenido del Paquete</div>
                <ul className="text-sm font-bold uppercase space-y-1">
                   {pedido.carritoObj ? Object.entries(pedido.carritoObj).map(([key, qty]) => (
                      <li key={key} className="flex gap-2">
                         <span className="shrink-0 w-6 text-center bg-black text-white rounded-sm">{qty}x</span> 
                         <span>{key.replace('|', ' ')}</span>
                      </li>
                   )) : (
                      <li>{typeof pedido.productos === 'string' ? <span dangerouslySetInnerHTML={{__html: pedido.productos.replace(/\n/g, '<br>')}} /> : 'Verificar sistema para detalle'}</li>
                   )}
                </ul>
              </div>

              <div className="pt-4 text-center text-[10px] text-gray-500 font-bold">
                 Orden #{pedido.id.slice(-6).toUpperCase()} • Generado el {new Date().toLocaleDateString('es-VE')}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}