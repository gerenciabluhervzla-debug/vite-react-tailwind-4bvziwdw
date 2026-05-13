import React from 'react';

export default function VistaImpresion({ pedidos }) { 
  if (pedidos.length === 0) {
    return (
      <div className="hidden print:block p-8 text-center text-xl font-bold italic text-slate-400">
        No hay pedidos listos y validados para imprimir guías de despacho.
      </div>
    );
  }

  return (
    <div className="hidden print:block w-full bg-white text-black p-2">
      <h1 className="text-xl font-black text-center mb-4 tracking-tight border-b-2 border-black pb-2">
        HOJA DE DESPACHO BLUHER - <span className="text-base font-medium">FECHA DE CORTE: {new Date().toLocaleDateString('es-VE')}</span>
      </h1>
      
      <div className="grid grid-cols-2 gap-4 print:overflow-visible">
        {pedidos.map((p) => (
          <div key={p.id} className="border-2 border-slate-900 p-3 rounded-xl break-inside-avoid shadow-none relative mb-2 page-break-inside-avoid">
            {p.esMercadoLibre && <div className="absolute top-0 right-0 bg-black text-white font-bold px-2 py-0.5 rounded-bl-lg text-[10px] uppercase tracking-widest">MERCADOLIBRE</div>}
            <div className="flex justify-between border-b border-slate-300 pb-2 mb-2 mt-1">
              <span className="font-black text-lg uppercase tracking-widest">{p.courier || 'ENVÍO'}</span>
              <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-300">Salida: {p.fechaDespacho}</span>
            </div>
            <div className="space-y-1 text-xs">
              <p><span className="font-bold text-slate-600">DESTINATARIO:</span> <span className="font-black text-sm ml-1">{p.clienteNombre?.toUpperCase()}</span></p>
              <p><span className="font-bold text-slate-600">C.I / RIF:</span> <span className="font-bold ml-1">{p.clienteCedula}</span></p>
              <p><span className="font-bold text-slate-600">TELÉFONO:</span> <span className="font-bold ml-1">{p.clienteTelefono}</span></p>
              <div className="mt-2"><span className="font-bold text-slate-600 block mb-0.5">DIRECCIÓN DE ENTREGA:</span></div>
              <p className="pl-2 border-l-2 border-slate-300 leading-tight font-bold bg-slate-50 p-1 rounded-r">{p.direccion}</p>
              <div className="mt-2 border-t border-dashed border-slate-300 pt-2"><span className="font-bold text-slate-600 block mb-1">CONTENIDO DEL PAQUETE:</span> 
                 <div className="font-bold whitespace-pre-wrap leading-tight text-[11px]">{typeof p.productos === 'string' ? p.productos : JSON.stringify(p.productos)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  ); 
}