import React from 'react';

export default function PanelLogs({ logs }) {
  return (
    <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border dark:border-slate-700 h-[70vh] flex flex-col shadow-sm transition-colors">
       <h2 className="text-2xl font-black mb-6 dark:text-white uppercase tracking-tighter">Auditoría Bluher</h2>
       <div className="flex-1 overflow-y-auto rounded-2xl border dark:border-slate-700 p-4 space-y-2 bg-[#f8fafc] dark:bg-slate-900/50 shadow-inner">
          {logs.map(l => (
            <div key={l.id} className="p-3 border-b dark:border-slate-800 text-[10px] flex gap-6 hover:bg-white dark:hover:bg-slate-800 transition-colors rounded-lg">
               <span className="font-black text-sky-600 dark:text-sky-400 shrink-0">{new Date(l.fecha).toLocaleString()}</span>
               <span className="font-medium text-slate-600 dark:text-slate-300"><b className="dark:text-white uppercase">{l.usuarioNombre}</b>: {l.detalle}</span>
            </div>
          ))}
       </div>
    </div>
  );
}