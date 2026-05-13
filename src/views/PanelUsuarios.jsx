import React from 'react';
import { Users, Trash2, AlertTriangle, Edit2 } from 'lucide-react';
import { updateDoc, deleteDoc, doc, getDocs, collection, setDoc } from 'firebase/firestore';
import { ROLES } from '../config/constants';

export default function PanelUsuarios({ usuarios, db, appId, loggear, dialogs }) {
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

  const formatearSistema = () => {
    dialogs.confirm("⚠️ PELIGRO CRÍTICO ⚠️\n\nEstás a punto de ELIMINAR TODOS los Pedidos, Movimientos de Inventario y Logs de Auditoría.\n\nEl Stock de los almacenes también se reiniciará a CERO. Las cuentas de usuario y el catálogo se mantendrán intactos.\n\n¿Estás absolutamente seguro de querer limpiar todo el entorno?", () => {
      
      setTimeout(() => {
        dialogs.prompt("Para confirmar esta acción irreversible, escribe la palabra exacta: BORRAR", async (val) => {
          if (val !== "BORRAR") {
             setTimeout(() => {
               dialogs.alert("La palabra de seguridad es incorrecta. La operación ha sido cancelada por seguridad.", "Operación Cancelada");
             }, 150);
             return;
          }
          
          try {
            const wipeCollection = async (collName) => {
              const snap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', collName));
              const promises = snap.docs.map(d => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', collName, d.id)));
              await Promise.all(promises);
            };

            await wipeCollection('pedidos');
            await wipeCollection('movimientos');
            await wipeCollection('logs');

            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'stock'), {});
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventario', 'notas'), {});

            loggear('SISTEMA_REINICIADO', 'El administrador formateó toda la data operativa del sistema.');
            
            setTimeout(() => {
              dialogs.alert("¡El entorno ha sido restablecido a CERO exitosamente! La página se recargará automáticamente.", "Formateo Completo");
              setTimeout(() => window.location.reload(), 3000);
            }, 150);
            
          } catch(e) {
            console.error(e);
            setTimeout(() => {
              dialogs.alert("Error de conexión al intentar formatear las bases de datos.", "Fallo Crítico");
            }, 150);
          }
        }, "Confirmación de Seguridad");
      }, 150);
      
    }, "Formatear Entorno");
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border dark:border-slate-700 shadow-sm transition-colors">
        <h2 className="text-2xl font-black mb-6 flex gap-3 items-center text-slate-800 dark:text-white"><Users className="text-indigo-600 dark:text-indigo-400"/> Gestión de Accesos y Roles</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
          <table className="w-full text-left text-sm border-collapse">
            <thead><tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400"><th className="p-4 border-b dark:border-slate-700 font-bold tracking-wide">Colaborador Registrado</th><th className="p-4 border-b dark:border-slate-700 font-bold tracking-wide text-right">Asignación de Permisos</th></tr></thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id} className="border-b border-slate-50 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-400 rounded-full flex items-center justify-center font-black">{u.nombre[0]}</div>
                       <div>
                          <div className="font-bold dark:text-white text-base flex items-center gap-2">
                            {u.nombre} 
                            <button onClick={() => cambiarNombre(u.id, u.nombre)} className="text-sky-600 hover:text-sky-800 transition-colors" title="Cambiar Nombre"><Edit2 size={14}/></button>
                            {u.isOnline && <span title="Sesión Activa" className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-sm shadow-emerald-200 inline-block"></span>}
                          </div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase">{u.email}</div>
                       </div>
                    </div>
                  </td>
                  <td className="p-4 flex gap-3 justify-end items-center">
                     <select value={u.role} onChange={e=>cambiarRol(u.id, true, e.target.value, u.email)} className="bg-white dark:bg-slate-900 border-2 dark:border-slate-700 p-2 rounded-xl font-bold text-xs shadow-sm focus:border-sky-500 outline-none transition-colors">
                       <option value="Pendiente" disabled>Usuario Nuevo (Pendiente)</option>
                       {Object.values(ROLES).map(r => <option key={r} value={r}>{r}</option>)}
                     </select>
                     {u.isApproved && <button onClick={()=>cambiarRol(u.id, false, 'Bloqueado', u.email)} className="text-xs bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-400 px-4 py-3 rounded-xl font-bold transition-colors">Suspender</button>}
                     <button onClick={()=>eliminarUsuario(u.id, u.email)} className="text-xs bg-red-50 dark:bg-red-900/30 hover:bg-red-600 hover:text-white text-red-600 dark:text-red-400 dark:hover:text-white px-4 py-3 rounded-xl font-bold transition-colors flex items-center gap-1.5"><Trash2 size={14}/> Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-red-50 dark:bg-red-950/30 p-8 rounded-2xl shadow-sm border border-red-200 dark:border-red-900/50 relative overflow-hidden transition-colors">
        <div className="absolute -right-4 -top-4 opacity-10"><AlertTriangle size={150} className="text-red-600"/></div>
        <h2 className="text-2xl font-black mb-3 flex items-center gap-3 text-red-800 dark:text-red-400 relative z-10"><AlertTriangle /> Zona de Restauración del Sistema</h2>
        <p className="text-red-800/80 dark:text-red-300/80 text-sm mb-6 max-w-3xl relative z-10 font-medium leading-relaxed">Utiliza esta opción con extremo cuidado, idealmente solo al finalizar las pruebas o cambiar de base de datos. Esta acción eliminará permanentemente todas las ventas, las transferencias logísticas y los respaldos. Todo el inventario físico regresará al nivel cero (0).</p>
        <button onClick={formatearSistema} className="bg-red-600 hover:bg-red-700 text-white font-black py-4 px-8 rounded-xl shadow-lg flex items-center gap-3 transition-all hover:-translate-y-0.5 relative z-10 text-lg">
          <Trash2 size={22} /> Formatear Base de Datos
        </button>
      </div>
    </div>
  );
}