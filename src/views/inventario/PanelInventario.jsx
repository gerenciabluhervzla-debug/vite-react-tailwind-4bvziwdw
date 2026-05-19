import React, { useState } from 'react';
import { Archive } from 'lucide-react';
import { ROLES } from '../../config/constants';
import SubPanelStock from './SubPanelStock';
import SubPanelMovimientos from './SubPanelMovimientos';
import SubPanelCatalogo from './SubPanelCatalogo';
import SubPanelAuditoria from './SubPanelAuditoria';

export default function PanelInventario({ stock, notas, catalogo, movimientos, db, appId, loggear, perfil, dialogs }) {
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-slate-100 dark:border-slate-700 pb-4 gap-4">
        <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3"><Archive className="text-sky-600" /> Sistema de Inventario</h2>
        <div className="flex flex-wrap gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
          <button onClick={()=>setSubTab('stock')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${subTab==='stock'?'bg-white dark:bg-slate-700 shadow text-sky-700 dark:text-sky-400':'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Control Stock</button>
          <button onClick={()=>setSubTab('movimientos')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${subTab==='movimientos'?'bg-white dark:bg-slate-700 shadow text-sky-700 dark:text-sky-400':'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Transferencias</button>
          {puedeEditar && <button onClick={()=>setSubTab('catalogo')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${subTab==='catalogo'?'bg-white dark:bg-slate-700 shadow text-sky-700 dark:text-sky-400':'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Catálogo Web</button>}
          {puedeAuditar && <button onClick={()=>setSubTab('auditoria')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${subTab==='auditoria'?'bg-white dark:bg-slate-700 shadow text-sky-700 dark:text-sky-400':'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Auditoría Diaria</button>}
        </div>
      </div>

      {subTab === 'stock' && <SubPanelStock lista={listaStock} notas={notas} stock={stock} db={db} appId={appId} puedeEditar={puedeEditar} loggear={loggear} dialogs={dialogs} />}
      {subTab === 'movimientos' && <SubPanelMovimientos movimientos={movimientos} stock={stock} db={db} appId={appId} loggear={loggear} perfil={perfil} catalogo={catalogo} dialogs={dialogs} />}
      {subTab === 'catalogo' && <SubPanelCatalogo catalogo={catalogo} db={db} appId={appId} loggear={loggear} dialogs={dialogs} />}
      {subTab === 'auditoria' && <SubPanelAuditoria db={db} appId={appId} dialogs={dialogs} loggear={loggear} perfil={perfil} />}
    </div>
  );
}