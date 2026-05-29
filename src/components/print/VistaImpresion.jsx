import React, { useEffect, useState } from 'react';
import { Truck, MapPin, Phone, User, Package, CalendarDays, Clock } from 'lucide-react';
import { BRAND_LOGO } from '../../config/constants';

export default function VistaImpresion({ pedidos }) {
  const [pedidosImprimir, setPedidosImprimir] = useState([]);

  useEffect(() => {
    const handlePrint = (e) => {
      const data = e.detail;
      setPedidosImprimir(Array.isArray(data) ? data : [data]);
      setTimeout(() => {
        window.print();
        setPedidosImprimir([]);
      }, 500);
    };

    window.addEventListener('print-ticket', handlePrint);
    return () => window.removeEventListener('print-ticket', handlePrint);
  }, []);

  if (pedidosImprimir.length === 0) return null;

  return (
    <div className="hidden print:block fixed inset-0 bg-white z-[9999] overflow-visible">
      {pedidosImprimir.map((pedido, index) => (
        <div key={pedido.id} className={`w-full max-w-[4in] mx-auto bg-white text-black p-6 ${index > 0 ? 'break-before-page' : ''}`}>
          
          <div className="flex flex-col items-center border-b-2 border-black pb-4 mb-4">
            <img src={BRAND_LOGO} alt="Bluher" className="h-16 mb-2 grayscale" />
            <h1 className="text-xl font-black tracking-widest uppercase text-center">Etiqueta de Despacho</h1>
            <div className="text-sm font-bold mt-1 bg-black text-white px-3 py-1 rounded-full uppercase">
               {pedido.tipoEntrega || 'Nacional'}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-[10px] font-black uppercase text-gray-500 mb-1 flex items-center gap-1"><User size={12}/> Destinatario</div>
              <div className="text-lg font-black leading-tight uppercase">{pedido.clienteNombre}</div>
              <div className="text-sm font-bold text-gray-700 mt-1">C.I / RIF: {pedido.clienteCedula || 'N/A'}</div>
            </div>

            <div>
              <div className="text-[10px] font-black uppercase text-gray-500 mb-1 flex items-center gap-1"><Phone size={12}/> Teléfono</div>
              <div className="text-lg font-bold">{pedido.clienteTelefono || 'Sin teléfono registrado'}</div>
            </div>

            {pedido.tipoEntrega !== 'Retiro en Tienda' && (
               <div>
                 <div className="text-[10px] font-black uppercase text-gray-500 mb-1 flex items-center gap-1"><MapPin size={12}/> Dirección de Entrega</div>
                 <div className="text-sm font-bold uppercase leading-snug border-l-4 border-black pl-3 py-1">
                   {pedido.direccion}
                 </div>
               </div>
            )}

            {pedido.tipoEntrega === 'Nacional' && (
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

            {pedido.tipoEntrega === 'Delivery' && (
               <div className="grid grid-cols-2 gap-4 bg-gray-100 p-3 rounded-xl border border-gray-300">
                 <div>
                   <div className="text-[10px] font-black uppercase text-gray-500 flex items-center gap-1"><CalendarDays size={10}/> Fecha Solicitada</div>
                   <div className="text-sm font-black">{pedido.fechaDelivery || 'Hoy'}</div>
                 </div>
                 <div>
                   <div className="text-[10px] font-black uppercase text-gray-500 flex items-center gap-1"><Clock size={10}/> Hora / Modalidad</div>
                   <div className="text-sm font-black">{pedido.horaDelivery || 'Cualquier hora'} - {pedido.pagoEnvio === 'PAGADO' ? 'PAG.' : 'COD'}</div>
                 </div>
               </div>
            )}

            {pedido.tipoEntrega === 'Retiro en Tienda' && (
               <div className="bg-gray-100 p-3 rounded-xl border border-gray-300">
                 <div className="text-[10px] font-black uppercase text-gray-500 mb-1 flex items-center gap-1"><User size={12}/> Autorizado para Retirar</div>
                 <div className="text-base font-black uppercase">{pedido.personaRetiroNombre}</div>
                 <div className="text-xs font-bold mt-1">C.I: {pedido.personaRetiroCedula} | Tlf: {pedido.personaRetiroTelefono}</div>
               </div>
            )}

            <div className="pt-4 border-t-2 border-dashed border-gray-300">
              <div className="text-[10px] font-black uppercase text-gray-500 mb-2 flex items-center gap-1"><Package size={12}/> Contenido del Paquete</div>
              <ul className="text-sm font-bold uppercase space-y-1">
                 {pedido.carritoObj && Object.entries(pedido.carritoObj).map(([key, qty]) => (
                    <li key={key} className="flex gap-2">
                       <span className="shrink-0 w-6 text-center bg-black text-white rounded-sm">{qty}x</span> 
                       <span>{key.replace('|', ' ')}</span>
                    </li>
                 ))}
                 {!pedido.carritoObj && <li>Verificar sistema para detalle</li>}
              </ul>
            </div>

            <div className="pt-4 text-center text-[10px] text-gray-500 font-bold">
               Orden #{pedido.id.slice(-6).toUpperCase()} • Generado el {new Date().toLocaleDateString('es-VE')}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}