import React from 'react';

export function Input({ label, ...props }) { 
  return (
    <div className="flex flex-col">
      <label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 ml-2 dark:text-slate-400 transition-colors">{label}</label>
      <input className="p-3.5 border-2 border-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-2xl focus:border-sky-500 outline-none font-bold transition-all shadow-sm" {...props}/>
    </div>
  ); 
}

export function InputDark({ label, ...props }) { 
  return (
    <div className="flex flex-col">
      <label className="text-[10px] font-black uppercase text-slate-300 mb-1.5 ml-2 transition-colors">{label}</label>
      <input className="p-3.5 border-2 border-slate-700 bg-slate-800 text-white rounded-2xl focus:border-sky-400 outline-none font-bold transition-all shadow-inner disabled:opacity-50" {...props}/>
    </div>
  ); 
}

export function StatusBadge({ status }) { 
  const b = { 
    'Pendiente': 'bg-amber-100 text-amber-700 border-amber-200', 
    'Validado': 'bg-sky-100 text-sky-700 border-sky-200', 
    'Despachado': 'bg-emerald-100 text-emerald-700 border-emerald-200', 
    'En Espera (Sin Stock)': 'bg-orange-100 text-orange-700 border-orange-200', 
    'Por Pagar / Cotización': 'bg-purple-100 text-purple-700 border-purple-200' 
  }; 
  return <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase border ${b[status] || 'bg-slate-100 text-slate-600'}`}>{status}</span>; 
}

export function TabButton({ active, onClick, icon, label, badge, badgeColor }) { 
  return (
    <button onClick={onClick} className={`flex items-center justify-between w-full p-4 rounded-2xl font-black transition-all ${active ? 'bg-sky-600 text-white shadow-xl scale-105' : 'text-sky-100/60 dark:text-slate-400 hover:bg-sky-900/40 dark:hover:bg-slate-800/80 hover:text-white'}`}>
      <div className="flex items-center gap-3">
         {icon} 
         <span className="text-xs uppercase tracking-widest">{label}</span>
      </div> 
      {badge > 0 && <span className={`${badgeColor || 'bg-red-500'} text-white text-[9px] px-2 py-0.5 rounded-full font-bold shadow-lg`}>{badge}</span>}
    </button>
  ); 
}