import React, { useState } from 'react';
import { Users, Trash2, Edit2, AlertTriangle, Loader2 } from 'lucide-react';
import { updateDoc, deleteDoc, doc, getDocs, collection, setDoc } from 'firebase/firestore';
import { ROLES } from '../config/constants';

export default function PanelUsuarios({ usuarios, db, appId, loggear, dialogs }) {
  const [formateando, setFormateando] = useState(false);

  const cambiarRol = async (uid, isApproved, newRole, email) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', uid), { isApproved, role: newRole });
    loggear('GESTION_USUARIO', `Acceso de ${email} -> Rol: ${newRole} (Aprobado: ${isApproved})`);
  };

  const cambiarNombre = (uid, nombreActual) => {
    dialogs.prompt(`Cambiar nombre del usuario (Actual: ${nombreActual}):`, async (nuevoNombre) => {
       if (!nuevoNombre || nuevoNombre.trim() === '') return;
       try {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', uid), { nombre: nuevoNombre.trim() });
          loggear('USUARIO_RENOMBRADO', `De ${nombreActual} a ${nuevoNombre}`);
       } catch(e) { console.error(e); }
    }, "Renombrar Usuario");
  };

  const eliminarUsuario = (uid, email) => {
    dialogs.confirm(`Estás a punto de eliminar de forma permanente la cuenta de usuario:\n\n${email}\n\n¿Estás absolutamente seguro de realizar esta acción?`, async () => {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', uid));
        loggear('USUARIO_ELIMINADO', `El administrador eliminó la cuenta del sistema: ${email}`);
        
        setTimeout(() => {
          dialogs.alert("La cuenta de usuario ha sido eliminada del sistema exitosamente.", "Usuario Eliminado");
        }, 150);
      } catch(e) {
        console.error(e);
        setTimeout(() => {
          dialogs.alert("Ocurrió un error en la base de datos al intentar eliminar la cuenta.", "Error Interno");
        }, 150);
      }
    }, "Eliminar Usuario");
  };

  const formatearParaDespliegue = () => {
    dialogs.prompt("⚠️ PREPARACIÓN PARA PRODUCCIÓN:\n\nEsta acción borrará TODOS los pedidos, ventas, movimientos de almacén, cierres de inventario y logs de prueba. Reiniciará todo el stock físico a CERO (0).\n\nSE CONSERVARÁN INTACTOS: El Catálogo de Productos y las cuentas de Usuario.\n\nEscribe la palabra 'DESPLIEGUE' en mayúsculas para confirmar:", async (texto) => {
      if (texto !== 'DESPLIEGUE') {
         dialogs.alert("Palabra de seguridad incorrecta. Operación cancelada.");
         return;
      }

      setFormateando(true);
      try {
         // 1. Borrar transacciones e historial
         const coleccionesABorrar = ['pedidos', 'movimientos', 'cierres_inventario', 'logs'];
         for (const col of coleccionesABorrar) {
            const snap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', col));
            const borrados = snap.docs.map(d => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', col, d.id)));
            await Promise.all(borrados);
         }

         // 2. Reiniciar Stock y Notas a vacío (esto el sistema lo interpreta como 0 unidades para todos los productos)
         await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'stock'), {});
         await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'notas'), {});

         loggear('DESPLIEGUE_PRODUCCION', 'Se limpiaron las transacciones de prueba y se reinició el stock para paso a producción.');
         dialogs.alert("¡El sistema ha sido limpiado exitosamente! Todas las ventas de prueba fueron borradas y el stock de todos los productos está en 0.\n\nEl sistema está listo para trabajar.", "Despliegue Listo");
      } catch (e) {
         console.error(e);
         dialogs.alert("Ocurrió un error al limpiar el sistema.", "Error");
      } finally {
         setFormateando(false);
      }
    }, "Confirmar Despliegue");
  };

  return (
    <div className="flex flex-col gap-8 animate-in fade-in pb-10">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
        <h2 className="text-2xl font-black mb-6 flex gap-3 items-center text-slate-800 dark:text-white">
           <Users className="text-indigo-600 dark:text-indigo-400"/> Gestión de Accesos y Roles
        </h2>
        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
          <table className="w-full text-left text-sm border-collapse min-w-[600px]">
            <thead>
               <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                  <th className="p-4 border-b dark:border-slate-700 font-bold tracking-wide">Colaborador Registrado</th>
                  <th className="p-4 border-b dark:border-slate-700 font-bold tracking-wide text-right">Asignación de Permisos</th>
               </tr>
            </thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id} className="border-b border-slate-50 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-400 rounded-full flex items-center justify-center font-black shrink-0">
                          {u.nombre[0]?.toUpperCase()}
                       </div>
                       <div>
                          <div className="font-bold dark:text-white text-base flex items-center gap-2">
                            {u.nombre} 
                            <button onClick={() => cambiarNombre(u.id, u.nombre)} className="text-sky-600 hover:text-sky-800 transition-colors" title="Cambiar Nombre">
                               <Edit2 size={14}/>
                            </button>
                            {u.isOnline && <span title="Sesión Activa" className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-sm shadow-emerald-200 inline-block"></span>}
                          </div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{u.email}</div>
                       </div>
                    </div>
                  </td>
                  <td className="p-4 flex flex-wrap gap-2 justify-end items-center h-full">
                     <select 
                        value={u.role} 
                        onChange={e=>cambiarRol(u.id, true, e.target.value, u.email)} 
                        className="bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 p-2.5 rounded-xl font-bold text-xs shadow-sm focus:border-sky-500 outline-none transition-colors text-slate-700 dark:text-slate-300"
                     >
                       <option value="Pendiente" disabled>Usuario Nuevo (Pendiente)</option>
                       {Object.values(ROLES).map(r => <option key={r} value={r}>{r}</option>)}
                     </select>
                     
                     {u.isApproved && (
                        <button onClick={()=>cambiarRol(u.id, false, 'Bloqueado', u.email)} className="text-xs bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-400 px-4 py-3 rounded-xl font-bold transition-colors border border-amber-200 dark:border-amber-800/50">
                           Suspender
                        </button>
                     )}
                     
                     <button onClick={()=>eliminarUsuario(u.id, u.email)} className="text-xs bg-red-50 hover:bg-red-600 dark:bg-red-900/30 text-red-600 hover:text-white dark:text-red-400 dark:hover:text-white px-4 py-3 rounded-xl font-bold transition-colors flex items-center gap-1.5 border border-red-200 dark:border-red-800/50 hover:border-red-600">
                        <Trash2 size={14}/> Eliminar
                     </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ZONA DE DESPLIEGUE (LIMPIEZA) */}
      <div className="bg-red-50 dark:bg-red-900/10 border-2 border-red-200 dark:border-red-800/50 p-8 rounded-[2rem] transition-colors shadow-sm">
         <h3 className="text-xl font-black text-red-700 dark:text-red-400 mb-2 flex items-center gap-2">
           <AlertTriangle size={24} /> Preparar Sistema para Despliegue
         </h3>
         <p className="text-sm text-red-600/80 dark:text-red-300/80 mb-6 font-bold">
           Usa esta opción una sola vez antes de iniciar operaciones reales. Borrará todas las pruebas (Ventas, Pedidos, Movimientos de almacén y Logs de auditoría) y pondrá todo el Stock en 0.<br/><br/>
           <span className="text-red-700 dark:text-red-300 font-black">Tu Catálogo de Productos (con sus fotos y precios) y las Cuentas de Usuario se mantendrán intactos.</span>
         </p>
         
         <button onClick={formatearParaDespliegue} disabled={formateando} className="bg-red-600 hover:bg-red-700 text-white font-black py-4 px-8 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 uppercase tracking-widest text-sm w-full md:w-auto">
           {formateando ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
           {formateando ? 'Limpiando Base de Datos...' : 'Limpiar Pruebas y Reiniciar Stock a 0'}
         </button>
      </div>
    </div>
  );
}