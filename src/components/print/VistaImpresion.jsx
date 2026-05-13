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
    <div className="hidden print:block w-full bg-white text-black p-4">
      <h1 className="text-3xl font-black text-center mb-8 tracking-tight border-b-4 border-black pb-4">
        HOJA DE DESPACHO BLUHER <br/><span className="text-xl font-medium">FECHA DE CORTE: {new Date().toLocaleDateString('es-VE')}</span>
      </h1>
      
      <div className="grid grid-cols-2 gap-6 print:overflow-visible">
        {pedidos.map((p) => (
          <div key={p.id} className="border-4 border-slate-900 p-6 rounded-2xl break-inside-avoid shadow-sm relative mb-6 page-break-inside-avoid">
            {p.esMercadoLibre && <div className="absolute top-0 right-0 bg-black text-white font-black px-4 py-1 rounded-bl-xl text-sm uppercase tracking-widest border-b-2 border-l-2 border-slate-900">MERCADOLIBRE</div>}
            <div className="flex justify-between border-b-2 border-slate-300 pb-3 mb-4 mt-2">
              <span className="font-black text-2xl uppercase tracking-widest">{p.courier || 'ENVÍO'}</span>
              <span className="text-sm font-bold bg-slate-100 px-3 py-1 rounded-lg border border-slate-300">Salida: {p.fechaDespacho}</span>
            </div>
            <div className="space-y-2 text-base">
              <p><span className="font-black text-slate-600">DESTINATARIO:</span> <span className="font-bold text-xl ml-2">{p.clienteNombre?.toUpperCase()}</span></p>
              <p><span className="font-black text-slate-600">CI / RIF:</span> <span className="font-bold ml-2">{p.clienteCedula}</span></p>
              <p><span className="font-black text-slate-600">TLF:</span> <span className="font-bold ml-2">{p.clienteTelefono}</span></p>
              <div className="mt-4"><span className="font-black text-slate-600 block mb-1">DIRECCIÓN:</span></div>
              <p className="pl-4 border-l-4 border-slate-300 leading-relaxed font-bold bg-slate-50 p-2 rounded-r-lg">{p.direccion}</p>
              <div className="mt-4 border-t-2 border-dashed border-slate-300 pt-4"><span className="font-black text-slate-600 block mb-2">PRODUCTOS:</span> 
                 <div className="font-bold whitespace-pre-wrap leading-relaxed">{typeof p.productos === 'string' ? p.productos : JSON.stringify(p.productos)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  ); 
}