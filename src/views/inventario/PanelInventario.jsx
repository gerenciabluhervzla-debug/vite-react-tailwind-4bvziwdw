import React, { useState } from 'react';
import { Archive } from 'lucide-react';
import { ROLES } from '../../config/constants';
import SubPanelStock from './SubPanelStock';
import SubPanelMovimientos from './SubPanelMovimientos';
import SubPanelCatalogo from './SubPanelCatalogo';
import SubPanelAuditoria from './SubPanelAuditoria';
import SubPanelHistorial from './SubPanelHistorial'; // <-- NUEVO COMPONENTE

export default function PanelInventario({ stock, notas, catalogo, movimientos, pedidos = [], db, appId, loggear, perfil, dialogs }) {
  const rol = perfil?.role;
  const puedeEditar = [ROLES.ADMIN].includes(rol);
  const puedeAuditar = [ROLES.ADMIN, ROLES.AUDITORIA].includes(rol);
  
  const [subTab, setSubTab] = useState('stock'); 
  
  const listaStock = [];
  catalogo.forEach(c => c.productos.forEach(p => p.presentaciones.forEach(pres => {
    const key = `${p.nombre}|${pres}`;
    const objStock = typeof stock[key] === 'object' ? stock[key] : { envios: stock[key]||0, recepcion: 0 };
    listaStock.push({ key, cat: c.categoria, nom: p.nombre, pres, envios: objStock.envios, recepcion: objStock.recepcion, nota: notas[key] });
  })));

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 border-b border-slate-100 dark:border-slate-700 pb-4 gap-4 print:hidden">
        <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3"><Archive className="text-sky-600" /> Sistema de Inventario</h2>
        <div className="flex flex-wrap gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl w-full xl:w-auto overflow-x-auto">
          <button onClick={()=>setSubTab('stock')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${subTab==='stock'?'bg-white dark:bg-slate-700 shadow text-sky-700 dark:text-sky-400':'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Control Stock (Hoy)</button>
          <button onClick={()=>setSubTab('historial')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${subTab==='historial'?'bg-white dark:bg-slate-700 shadow text-amber-600 dark:text-amber-400':'text-slate-500 hover:text-amber-600 dark:hover:text-amber-400'}`}>Historial y Cierres</button>
          <button onClick={()=>setSubTab('movimientos')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${subTab==='movimientos'?'bg-white dark:bg-slate-700 shadow text-sky-700 dark:text-sky-400':'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Transferencias</button>
          {puedeEditar && <button onClick={()=>setSubTab('catalogo')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${subTab==='catalogo'?'bg-white dark:bg-slate-700 shadow text-sky-700 dark:text-sky-400':'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Catálogo Web</button>}
          {puedeAuditar && <button onClick={()=>setSubTab('auditoria')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${subTab==='auditoria'?'bg-white dark:bg-slate-700 shadow text-sky-700 dark:text-sky-400':'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Auditoría Diaria</button>}
        </div>
      </div>

      {subTab === 'stock' && <SubPanelStock lista={listaStock} notas={notas} stock={stock} movimientos={movimientos} pedidos={pedidos} db={db} appId={appId} puedeEditar={puedeEditar} loggear={loggear} dialogs={dialogs} />}
      {subTab === 'historial' && <SubPanelHistorial lista={listaStock} movimientos={movimientos} pedidos={pedidos} db={db} appId={appId} loggear={loggear} dialogs={dialogs} puedeEditar={puedeEditar} />}
      {subTab === 'movimientos' && <SubPanelMovimientos movimientos={movimientos} stock={stock} db={db} appId={appId} loggear={loggear} perfil={perfil} catalogo={catalogo} dialogs={dialogs} />}
      {subTab === 'catalogo' && <SubPanelCatalogo catalogo={catalogo} db={db} appId={appId} loggear={loggear} dialogs={dialogs} />}
      {subTab === 'auditoria' && <SubPanelAuditoria db={db} appId={appId} dialogs={dialogs} loggear={loggear} perfil={perfil} />}
    </div>
  );
}