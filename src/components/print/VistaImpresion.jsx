import React, { useMemo } from 'react';
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
    // Cuadrícula de 2 columnas con espacio mínimo (gap-2) para maximizar etiquetas por hoja
    <div className="hidden print:grid absolute top-0 left-0 w-full bg-white z-[9999] grid-cols-2 gap-2 p-2 text-black">
      {pedidosOrdenados.map((pedido, index) => {
        
        const tipoDespacho = pedido.tipoDespacho || 'Nacional';
        const isDelivery = tipoDespacho === 'Delivery';
        const isTienda = tipoDespacho === 'Tienda';
        const isNacional = tipoDespacho === 'Nacional';

        return (
          // break-inside-avoid: Garantiza que la tarjeta no se divida entre dos páginas
          <div key={pedido.id} className="relative w-full bg-white p-3 border-2 border-gray-800 rounded-xl break-inside-avoid">
            
            {/* NUMERACIÓN DIARIA */}
            <div className="absolute top-0 left-0 bg-black text-white px-2 py-0.5 font-black text-xs rounded-tl-lg rounded-br-lg">
               #{index + 1}
            </div>

            {/* ENCABEZADO: AGENCIA Y MODALIDAD */}
            <div className="flex justify-between items-center border-b-2 border-black pb-1.5 mb-1.5 pl-8">
              {isNacional && (
                 <div className="text-lg font-black uppercase leading-none tracking-tight">
                    {pedido.courier} - {pedido.pagoEnvio === 'PAGADO' ? 'PAGADO' : 'C.O.D'}
                 </div>
              )}
              {isDelivery && (
                 <div className="text-sm font-black uppercase leading-none">
                    DELIVERY: {pedido.deliveryFecha} {pedido.deliveryHora}
                 </div>
              )}
              {isTienda && (
                 <div className="text-sm font-black uppercase leading-none">
                    RETIRO EN TIENDA
                 </div>
              )}
              {/* Logo pequeño a la derecha */}
              <img src={BRAND_LOGO} alt="Bluher" className="h-5 grayscale object-contain ml-auto" />
            </div>

            {/* DATOS DEL CLIENTE COMPACTOS */}
            <div className="text-[11px] leading-tight space-y-1">
              <div>
                <strong>Nombre:</strong> <span className="uppercase font-bold">{pedido.clienteNombre}</span> <span className="mx-1">|</span> <strong>Tlf:</strong> {pedido.clienteTelefono}
              </div>
              <div><strong>C.I/RIF:</strong> {pedido.clienteCedula || 'N/A'}</div>
              
              {!isTienda && (
                 <div><strong>Dir:</strong> <span className="uppercase">{pedido.direccion}</span></div>
              )}

              {isTienda && (
                 <div><strong>Retira:</strong> {pedido.retiroNombre || pedido.clienteNombre} <span className="mx-1">|</span> <strong>C.I:</strong> {pedido.retiroCedula || pedido.clienteCedula} <span className="mx-1">|</span> <strong>Tlf:</strong> {pedido.retiroTelefono || pedido.clienteTelefono}</div>
              )}
            </div>

            {/* PRODUCTOS */}
            <div className="pt-1.5 mt-1.5 border-t border-dashed border-gray-400">
              <ul className="text-[10px] font-bold uppercase leading-tight space-y-0.5">
                 {pedido.carritoObj ? Object.entries(pedido.carritoObj).map(([key, qty]) => (
                    <li key={key} className="flex gap-1.5 items-start">
                       <span className="shrink-0 w-4 text-center bg-black text-white rounded-[2px]">{qty}</span> 
                       <span>{key.replace('|', ' ')}</span>
                    </li>
                 )) : (
                    <li>{typeof pedido.productos === 'string' ? <span dangerouslySetInnerHTML={{__html: pedido.productos.replace(/\n/g, '<br>')}} /> : 'Verificar sistema para detalle'}</li>
                 )}
              </ul>
            </div>

            {/* PIE DE ETIQUETA */}
            <div className="pt-1 mt-1.5 text-center text-[8px] text-gray-500 font-bold border-t border-gray-200">
               Ord: #{pedido.id.slice(-6).toUpperCase()} • {new Date(pedido.fechaCreacion).toLocaleDateString('es-VE')}
            </div>
          </div>
        );
      })}
    </div>
  );
}