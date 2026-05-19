import React, { useMemo } from 'react';

export default function VistaImpresion({ pedidos }) { 
  
  // 1. Calculamos la misma numeración diaria que en el panel
  const numeracionDiaria = useMemo(() => {
    const map = {};
    const agrupados = {};
    pedidos.forEach(p => {
       const fecha = p.fechaDespacho || 'Sin Fecha';
       if (!agrupados[fecha]) agrupados[fecha] = [];
       agrupados[fecha].push(p);
    });
    Object.keys(agrupados).forEach(fecha => {
       agrupados[fecha].sort((a, b) => a.fechaCreacion - b.fechaCreacion);
       agrupados[fecha].forEach((p, index) => { map[p.id] = index + 1; });
    });
    return map;
  }, [pedidos]);

  // 2. Ordenamos los pedidos de forma ascendente (1, 2, 3...)
  const pedidosOrdenados = useMemo(() => {
     return [...pedidos].sort((a, b) => {
        const numA = numeracionDiaria[a.id] || 999999;
        const numB = numeracionDiaria[b.id] || 999999;
        return numA - numB;
     });
  }, [pedidos, numeracionDiaria]);

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
      
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 print:overflow-visible pl-2 pt-2">
        {pedidosOrdenados.map((p) => (
          <div key={p.id} className="border-2 border-slate-900 p-3 rounded-xl break-inside-avoid shadow-none relative mb-2 page-break-inside-avoid">
            
            {/* Círculo con el número identificador del pedido */}
            <div className="absolute -top-4 -left-4 bg-black text-white w-8 h-8 rounded-full flex items-center justify-center font-black border-2 border-white print:border-white z-10 text-sm">
              {numeracionDiaria[p.id]}
            </div>

            {p.esMercadoLibre && <div className="absolute top-0 right-0 bg-black text-white font-bold px-2 py-0.5 rounded-bl-lg rounded-tr-md text-[10px] uppercase tracking-widest">MERCADOLIBRE</div>}
            
            <div className="flex justify-between items-center border-b border-slate-300 pb-2 mb-2 mt-1 ml-2">
              <div className="flex items-center gap-2">
                 <span className="font-black text-lg uppercase tracking-widest">{p.courier || 'ENVÍO'}</span>
                 <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest border ${p.pagoEnvio === 'PAGADO' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-white text-black border-black'}`}>
                   {p.pagoEnvio === 'PAGADO' ? 'PAGADO' : 'COBRO EN DESTINO'}
                 </span>
                 {p.moneda === 'ZELLE' && (
                   <span className="text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest border bg-purple-100 text-purple-800 border-purple-300">ZELLE</span>
                 )}
              </div>
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