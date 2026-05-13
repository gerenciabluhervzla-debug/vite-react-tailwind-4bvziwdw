import React, { useState, useMemo } from 'react';
import { ShieldAlert, Filter, X } from 'lucide-react';

export default function PanelLogs({ logs }) {
  // Validación defensiva
  const safeLogs = logs || [];

  // Estados para los filtros
  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [filtroFecha, setFiltroFecha] = useState('');

  // Extraer usuarios únicos para el selector
  const usuariosUnicos = useMemo(() => {
    const nombres = safeLogs.map(l => l.usuarioNombre).filter(Boolean);
    return [...new Set(nombres)].sort();
  }, [safeLogs]);

  // Aplicar filtros
  const logsFiltrados = useMemo(() => {
    return safeLogs.filter(l => {
      let coincideUsuario = true;
      let coincideFecha = true;

      if (filtroUsuario) {
        coincideUsuario = l.usuarioNombre === filtroUsuario;
      }

      if (filtroFecha) {
        // Convertir el timestamp del log a formato YYYY-MM-DD respetando la zona horaria local
        const fechaLog = new Date(l.fecha);
        const anio = fechaLog.getFullYear();
        const mes = String(fechaLog.getMonth() + 1).padStart(2, '0');
        const dia = String(fechaLog.getDate()).padStart(2, '0');
        const fechaFormateada = `${anio}-${mes}-${dia}`;
        
        coincideFecha = fechaFormateada === filtroFecha;
      }

      return coincideUsuario && coincideFecha;
    });
  }, [safeLogs, filtroUsuario, filtroFecha]);

  const limpiarFiltros = () => {
    setFiltroUsuario('');
    setFiltroFecha('');
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border dark:border-slate-700 h-[80vh] flex flex-col shadow-sm transition-colors animate-in fade-in">
       
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-slate-100 dark:border-slate-700 pb-4">
         <h2 className="text-2xl font-black dark:text-white uppercase tracking-tighter flex items-center gap-2">
           <ShieldAlert className="text-sky-600" /> Auditoría Bluher
         </h2>

         {/* Barra de Filtros */}
         <div className="flex flex-wrap items-center gap-3 bg-slate-50 dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-700 w-full md:w-auto">
            <div className="flex items-center gap-2 px-2 text-slate-500 dark:text-slate-400">
              <Filter size={16} />
              <span className="text-xs font-bold uppercase tracking-widest hidden sm:inline">Filtros</span>
            </div>

            <select 
              value={filtroUsuario} 
              onChange={(e) => setFiltroUsuario(e.target.value)}
              className="p-2 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white outline-none focus:border-sky-500 transition-colors"
            >
              <option value="">Todos los usuarios</option>
              {usuariosUnicos.map(user => (
                <option key={user} value={user}>{user}</option>
              ))}
            </select>

            <input 
              type="date" 
              value={filtroFecha} 
              onChange={(e) => setFiltroFecha(e.target.value)}
              className="p-2 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white outline-none focus:border-sky-500 transition-colors cursor-pointer"
            />

            {(filtroUsuario || filtroFecha) && (
              <button 
                onClick={limpiarFiltros}
                className="p-2 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 rounded-lg transition-colors flex items-center gap-1"
                title="Limpiar filtros"
              >
                <X size={16} />
              </button>
            )}
         </div>
       </div>
       
       {/* Lista de Resultados */}
       <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-100 dark:border-slate-700 p-4 space-y-2 bg-[#f8fafc] dark:bg-slate-900/50 shadow-inner">
          {logsFiltrados.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 italic font-bold">
              {safeLogs.length === 0 
                ? "No hay registros de auditoría en el sistema."
                : "Ningún registro coincide con los filtros aplicados."}
            </div>
          ) : (
            logsFiltrados.map(l => (
              <div key={l.id} className="p-3 border-b border-slate-200/60 dark:border-slate-800 text-[10px] md:text-xs flex flex-col md:flex-row gap-2 md:gap-6 hover:bg-white dark:hover:bg-slate-800 transition-colors rounded-lg">
                 <span className="font-black text-sky-600 dark:text-sky-400 shrink-0 md:w-40">
                   {new Date(l.fecha).toLocaleString()}
                 </span>
                 <span className="font-medium text-slate-600 dark:text-slate-300">
                   <b className="dark:text-white uppercase">{l.usuarioNombre}</b>: {l.detalle}
                 </span>
              </div>
            ))
          )}
       </div>

       {/* Resumen de resultados */}
       <div className="mt-4 text-right text-xs font-bold text-slate-400">
         Mostrando {logsFiltrados.length} registro(s)
       </div>
    </div>
  );
}