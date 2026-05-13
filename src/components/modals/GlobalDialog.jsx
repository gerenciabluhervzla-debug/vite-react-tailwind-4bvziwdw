import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';

export default function GlobalDialog({ config, setConfig }) {
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if(config?.type === 'prompt') setInputValue('');
  }, [config]);

  if (!config) return null;

  const handleConfirm = () => {
    if (config.onConfirm) {
      if (config.type === 'prompt') config.onConfirm(inputValue);
      else config.onConfirm();
    }
    setConfig(null);
  };

  const handleCancel = () => setConfig(null);

  return (
    <div className="fixed inset-0 z-[300] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
       <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-8 border border-slate-200 dark:border-slate-700 transition-colors animate-in zoom-in-95">
         <div className="flex items-center gap-4 mb-4">
           {config.type === 'alert' ? <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-full"><AlertTriangle size={28}/></div> : <div className="p-3 bg-sky-100 dark:bg-sky-900/30 text-sky-600 rounded-full"><CheckCircle size={28}/></div>}
           <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">{config.title}</h3>
         </div>
         <p className="text-slate-600 dark:text-slate-300 mb-8 whitespace-pre-wrap font-medium leading-relaxed">{config.message}</p>
         {config.type === 'prompt' && (
           <input 
             autoFocus 
             type="text" 
             className="w-full p-4 border-2 border-slate-200 dark:border-slate-600 rounded-xl mb-8 outline-none focus:ring-2 focus:ring-sky-500 font-medium text-slate-800 dark:text-white bg-[#f0f4f8] dark:bg-slate-700" 
             value={inputValue} 
             onChange={e=>setInputValue(e.target.value)} 
             onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
           />
         )}
         <div className="flex justify-end gap-3">
           {config.type !== 'alert' && <button onClick={handleCancel} className="px-6 py-3 rounded-xl text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">Cancelar</button>}
           <button onClick={handleConfirm} className="px-6 py-3 rounded-xl bg-sky-600 text-white font-bold shadow-lg hover:bg-sky-700 transition-colors">Confirmar</button>
         </div>
       </div>
    </div>
  );
}