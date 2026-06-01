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
    // ELIMINAMOS "fixed inset-0" y usamos "absolute w-full" para que el navegador 
    // permita el crecimiento infinito y genere páginas nuevas automáticamente.
    <div className="hidden print:grid absolute top-0 left-0 w-full bg-white z-[9999] grid-cols-2 gap-4 p-2 text-black">
      {pedidosOrdenados.map((pedido, index) => {
        
        const tipoDespacho = pedido.tipoDespacho || 'Nacional';
        const isDelivery = tipoDespacho === 'Delivery';
        const isTienda = tipoDespacho === 'Tienda';
        const isNacional = tipoDespacho === 'Nacional';

        return (
          // break-inside-avoid: Garantiza que la tarjeta NUNCA se corte a la mitad en el salto de página
          <div key={pedido.id} className="relative w-full bg-white p-4 border-2 border-gray-800 rounded-xl break-inside-avoid mb-2">
            
            {/* NUMERACIÓN DIARIA */}
            <div className="absolute top-0 left-0 bg-black text-white px-3 py-1 font-black text-sm rounded-tl-lg rounded-br-lg">
               #{index + 1}
            </div>

            <div className="flex flex-col items-center border-b-2 border-black pb-2 mb-3 mt-1">
              <img src={BRAND_LOGO} alt="Bluher" className="h-10 mb-1 grayscale object-contain" />
              <h1 className="text-sm font-black tracking-widest uppercase text-center leading-tight">Etiqueta de Despacho</h1>
              <div className="text-[10px] font-bold mt-1 bg-black text-white px-3 py-0.5 rounded-full uppercase tracking-widest">
                 {isTienda ? 'Retiro en Tienda' : isDelivery ? 'Delivery Local' : 'Envío Nacional'}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-[9px] font-black uppercase text-gray-500 mb-0.5 flex items-center gap-1"><User size={10}/> Destinatario</div>
                <div className="text-base font-black leading-tight uppercase">{pedido.clienteNombre}</div>
                <div className="text-xs font-bold text-gray-700 mt-0.5">C.I / RIF: {pedido.clienteCedula || 'N/A'}</div>
              </div>

              <div>
                <div className="text-[9px] font-black uppercase text-gray-500 mb-0.5 flex items-center gap-1"><Phone size={10}/> Teléfono</div>
                <div className="text-base font-bold">{pedido.clienteTelefono || 'Sin teléfono registrado'}</div>
              </div>

              {/* DIRECCIÓN: Solo aplica para Delivery y Nacional */}
              {!isTienda && (
                 <div>
                   <div className="text-[9px] font-black uppercase text-gray-500 mb-0.5 flex items-center gap-1"><MapPin size={10}/> Dirección de Entrega</div>
                   <div className="text-xs font-bold uppercase leading-snug border-l-2 border-black pl-2 py-0.5">
                     {pedido.direccion}
                   </div>
                 </div>
              )}

              {/* RECUADRO ENVÍO NACIONAL */}
              {isNacional && (
                 <div className="grid grid-cols-2 gap-2 bg-gray-100 p-2 rounded-lg border border-gray-300">
                   <div>
                     <div className="text-[9px] font-black uppercase text-gray-500">Agencia</div>
                     <div className="text-sm font-black uppercase">{pedido.courier}</div>
                   </div>
                   <div>
                     <div className="text-[9px] font-black uppercase text-gray-500">Modalidad</div>
                     <div className="text-sm font-black uppercase">{pedido.pagoEnvio === 'PAGADO' ? 'PAGADO' : 'C.O.D'}</div>
                   </div>
                 </div>
              )}

              {/* RECUADRO DELIVERY */}
              {isDelivery && (
                 <div className="grid grid-cols-2 gap-2 bg-gray-100 p-2 rounded-lg border border-gray-300">
                   <div>
                     <div className="text-[9px] font-black uppercase text-gray-500 flex items-center gap-1"><CalendarDays size={10}/> Fecha Sol.</div>
                     <div className="text-xs font-black">{pedido.deliveryFecha || 'Hoy'}</div>
                   </div>
                   <div>
                     <div className="text-[9px] font-black uppercase text-gray-500 flex items-center gap-1"><Clock size={10}/> Hora Req.</div>
                     <div className="text-xs font-black">{pedido.deliveryHora || 'Cualquier hora'}</div>
                   </div>
                 </div>
              )}

              {/* RECUADRO TIENDA */}
              {isTienda && (
                 <div className="bg-gray-100 p-2 rounded-lg border border-gray-300">
                   <div className="text-[9px] font-black uppercase text-gray-500 mb-0.5 flex items-center gap-1"><User size={10}/> Autorizado para Retirar</div>
                   <div className="text-sm font-black uppercase">{pedido.retiroNombre || pedido.clienteNombre}</div>
                   <div className="text-[10px] font-bold mt-0.5">C.I: {pedido.retiroCedula || pedido.clienteCedula} | Tlf: {pedido.retiroTelefono || pedido.clienteTelefono}</div>
                 </div>
              )}

              <div className="pt-2 border-t-2 border-dashed border-gray-300">
                <div className="text-[9px] font-black uppercase text-gray-500 mb-1 flex items-center gap-1"><Package size={10}/> Contenido del Paquete</div>
                <ul className="text-xs font-bold uppercase space-y-1">
                   {pedido.carritoObj ? Object.entries(pedido.carritoObj).map(([key, qty]) => (
                      <li key={key} className="flex gap-1.5 items-start">
                         <span className="shrink-0 w-5 text-center bg-black text-white rounded-[3px]">{qty}x</span> 
                         <span className="leading-tight">{key.replace('|', ' ')}</span>
                      </li>
                   )) : (
                      <li>{typeof pedido.productos === 'string' ? <span dangerouslySetInnerHTML={{__html: pedido.productos.replace(/\n/g, '<br>')}} /> : 'Verificar sistema para detalle'}</li>
                   )}
                </ul>
              </div>

              <div className="pt-2 text-center text-[9px] text-gray-500 font-bold">
                 Orden #{pedido.id.slice(-6).toUpperCase()} • Generado el {new Date().toLocaleDateString('es-VE')}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}