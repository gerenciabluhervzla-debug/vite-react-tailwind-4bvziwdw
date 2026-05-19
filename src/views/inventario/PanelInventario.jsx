import React, { useState } from 'react';
import { Archive, Save, Calendar, Info } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore'; // Importamos funciones de lectura/escritura
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
  const [guardando, setGuardando] = useState(false);

  // Estados para el historial
  const [fechaConsulta, setFechaConsulta] = useState('');
  const [datosHistoricos, setDatosHistoricos] = useState(null);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  
  // 1. Mapeo del stock actual (En Vivo)
  const listaStockActual = [];
  catalogo.forEach(c => c.productos.forEach(p => p.presentaciones.forEach(pres => {
    const key = `${p.nombre}|${pres}`;
    const objStock = typeof stock[key] === 'object' ? stock[key] : { envios: stock[key]||0, recepcion: 0, fisico: null };
    
    const teorico = (objStock.recepcion || 0) - (objStock.envios || 0);
    const fisico = (objStock.fisico !== null && objStock.fisico !== undefined) ? objStock.fisico : teorico;
    const diferencia = fisico - teorico;

    listaStockActual.push({ 
      key, cat: c.categoria, nom: p.nombre, pres, 
      envios: objStock.envios, recepcion: objStock.recepcion, 
      teorico, fisico, diferencia, nota: notas[key] 
    });
  })));

  // 2. Determinar qué datos mostrar (Históricos o En Vivo)
  const isHistorial = datosHistoricos !== null;
  const listaAMostrar = isHistorial ? datosHistoricos : listaStockActual;
  // Si estamos viendo historial, nadie puede editar
  const permisosEdicion = isHistorial ? false : puedeEditar;

  // 3. Función para buscar una fecha en el historial
  const consultarHistorial = async (fecha) => {
    setFechaConsulta(fecha);
    if (!fecha) {
      setDatosHistoricos(null); // Volver al modo en vivo
      return;
    }

    setCargandoHistorial(true);
    try {
      // Ruta sugerida para guardar/leer los cierres
      const docRef = doc(db, 'artifacts', appId, 'cierres_inventario', fecha);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setDatosHistoricos(docSnap.data().datos);
      } else {
        setDatosHistoricos([]); // Array vacío para indicar que no hay datos
        dialogs && dialogs.error(`No hay ningún cierre archivado para el ${fecha}`);
      }
    } catch (error) {
      console.error("Error al buscar historial:", error);
      dialogs && dialogs.error('Error al consultar la base de datos.');
    } finally {
      setCargandoHistorial(false);
    }
  };

  // 4. Función para archivar el cierre del día
  const archivarCierreDiario = async () => {
    if (!window.confirm('¿Estás seguro de archivar el cierre físico de hoy? Esto guardará una copia inmutable del inventario actual.')) return;
    
    setGuardando(true);
    try {
      // Obtenemos la fecha local en formato YYYY-MM-DD
      const fechaHoy = new Date().toLocaleDateString('en-CA'); 
      
      const snapshotCierre = {
        fecha: fechaHoy,
        timestamp: new Date().getTime(),
        responsable: perfil?.nombre || 'Desconocido',
        datos: listaStockActual, // Guardamos la foto actual
        totalItems: listaStockActual.length
      };

      // Guardamos en la misma ruta que usamos para consultar
      const docRef = doc(db, 'artifacts', appId, 'cierres_inventario', fechaHoy);
      await setDoc(docRef, snapshotCierre);
      
      loggear && loggear(`Cierre físico de inventario archivado exitosamente para la fecha: ${fechaHoy}`);
      dialogs && dialogs.success('Cierre diario archivado correctamente.');
    } catch (error) {
      console.error("Error al guardar cierre:", error);
      dialogs && dialogs.error('Hubo un error al archivar el cierre.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-slate-100 dark:border-slate-700 pb-4 gap-4">
        
        <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
          <Archive className="text-sky-600" /> Sistema de Inventario
        </h2>
        
        <div className="flex flex-wrap gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
          <button onClick={()=>{setSubTab('stock'); setFechaConsulta(''); setDatosHistoricos(null);}} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${subTab==='stock'?'bg-white dark:bg-slate-700 shadow text-sky-700 dark:text-sky-400':'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Control Stock</button>
          <button onClick={()=>setSubTab('movimientos')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${subTab==='movimientos'?'bg-white dark:bg-slate-700 shadow text-sky-700 dark:text-sky-400':'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Transferencias</button>
          {puedeEditar && <button onClick={()=>setSubTab('catalogo')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${subTab==='catalogo'?'bg-white dark:bg-slate-700 shadow text-sky-700 dark:text-sky-400':'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Catálogo Web</button>}
          {puedeAuditar && <button onClick={()=>setSubTab('auditoria')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${subTab==='auditoria'?'bg-white dark:bg-slate-700 shadow text-sky-700 dark:text-sky-400':'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Auditoría Diaria</button>}
        </div>
      </div>

      {/* Controles superiores exclusivos de la pestaña de Stock */}
      {subTab === 'stock' && puedeAuditar && (
        <div className="flex flex-col md:flex-row justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 mb-6 gap-4">
          
          {/* Buscador por fecha */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <label className="text-sm font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2">
              <Calendar size={18} /> Consultar Fecha:
            </label>
            <input 
              type="date" 
              value={fechaConsulta}
              onChange={(e) => consultarHistorial(e.target.value)}
              className="border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-sky-500 transition-colors"
            />
            {cargandoHistorial && <span className="text-xs text-sky-600 font-bold animate-pulse">Buscando...</span>}
          </div>

          {/* Botón de Archivar (Solo visible si NO estamos en el historial) */}
          {!isHistorial && (
            <button 
              onClick={archivarCierreDiario}
              disabled={guardando}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm disabled:opacity-50 w-full md:w-auto"
            >
              <Save size={18} />
              {guardando ? 'Guardando...' : 'Archivar Cierre de Hoy'}
            </button>
          )}
        </div>
      )}

      {/* Banner de advertencia cuando estamos viendo un historial */}
      {isHistorial && subTab === 'stock' && (
        <div className="mb-6 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 px-4 py-3 rounded-xl flex items-center gap-3 font-medium text-sm">
          <Info size={20} className="shrink-0" />
          <p>Estás viendo el archivo de inventario del día <strong>{fechaConsulta}</strong>. Los datos son de solo lectura y no pueden ser modificados. Para editar el inventario actual, borra la fecha en el buscador.</p>
        </div>
      )}

      {/* Renders de SubPaneles */}
      {subTab === 'stock' && <SubPanelStock lista={listaAMostrar} notas={notas} stock={stock} db={db} appId={appId} puedeEditar={permisosEdicion} loggear={loggear} dialogs={dialogs} />}
      {subTab === 'movimientos' && <SubPanelMovimientos movimientos={movimientos} stock={stock} db={db} appId={appId} loggear={loggear} perfil={perfil} catalogo={catalogo} dialogs={dialogs} />}
      {subTab === 'catalogo' && <SubPanelCatalogo catalogo={catalogo} db={db} appId={appId} loggear={loggear} dialogs={dialogs} />}
      {subTab === 'auditoria' && <SubPanelAuditoria db={db} appId={appId} dialogs={dialogs} loggear={loggear} perfil={perfil} />}
    </div>
  );
}