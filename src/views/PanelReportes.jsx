import React, { useState, useMemo } from 'react';
import { DollarSign, Archive, Sparkles, CalendarDays, Gift, Store, Percent, TrendingUp, FileOutput, Users, Truck, Wallet, ArrowDownCircle, ShoppingBag } from 'lucide-react';
import { ROLES, BRAND_LOGO } from '../config/constants';

export default function PanelReportes({ pedidos, catalogo, stock, perfil }) {
  const [rangoRango, setRangoRango] = useState('hoy');
  
  const getLocalToday = () => {
    const d = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Caracas"}));
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  
  const [fechaInicio, setFechaInicio] = useState(getLocalToday());
  const [fechaFin, setFechaFin] = useState(getLocalToday());

  const rol = perfil?.role;
  const verTotalInventario = rol === ROLES.ADMIN;
  const verDinero = true; 

  const validados = useMemo(() => {
    return pedidos.filter(p => 
      p.status !== 'Pendiente' && 
      p.status !== 'Rechazado' && 
      p.status !== 'Anulado' && 
      !p.esPublico
    );
  }, [pedidos]);

  // --- FILTRAR REPORTES USANDO FECHA DE DESPACHO ---
  const parseDateVzla = (dateStr) => {
     if (!dateStr || dateStr === 'Sin Fecha') return 0;
     const parts = dateStr.split('/');
     return parts.length === 3 ? new Date(parts[2], parts[1] - 1, parts[0]).getTime() : 0;
  };

  const pedidosFiltrados = useMemo(() => {
    const d = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Caracas"}));
    
    return validados.filter(p => {
      if (rangoRango === 'hoy') {
         const todayStr = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
         return p.fechaDespacho === todayStr;
      }
      if (rangoRango === 'mes') {
         const [, dMes, dAno] = (p.fechaDespacho || '').split('/');
         return dMes === String(d.getMonth()+1).padStart(2,'0') && dAno === String(d.getFullYear());
      }
      if (rangoRango === 'año') {
         const [, , dAno] = (p.fechaDespacho || '').split('/');
         return dAno === String(d.getFullYear());
      }
      if (rangoRango === 'todo') return true;
      if (rangoRango === 'custom') {
        const pTime = parseDateVzla(p.fechaDespacho);
        const start = fechaInicio ? new Date(fechaInicio + 'T00:00:00').getTime() : 0;
        const end = fechaFin ? new Date(fechaFin + 'T23:59:59').getTime() : Infinity;
        return pTime >= start && pTime <= end;
      }
      return true;
    });
  }, [validados, rangoRango, fechaInicio, fechaFin]);

  const ventasMesUsdPDF = useMemo(() => {
    const d = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Caracas"}));
    const currentMonth = String(d.getMonth() + 1).padStart(2, '0');
    const currentYear = String(d.getFullYear());
    
    return validados
      .filter(p => {
         const [, dMes, dAno] = (p.fechaDespacho || '').split('/');
         return dMes === currentMonth && dAno === currentYear;
      })
      .reduce((sum, p) => sum + (p.montoUsd || 0), 0);
  }, [validados]);

  const metricas = useMemo(() => {
    let ventasVES = 0; let ventasZelle = 0; let mlUSD = 0; let mlVES = 0; let regalosUSD = 0; let descuentosUSD = 0;
    let totalBrutoGeneralUsd = 0; let totalCobroEnviosUsd = 0;
    
    // MÉTRICAS SEGMENTADAS DE VENTAS 
    let ventasEnviosUsd = 0; let ventasDeliveryUsd = 0; let ventasTiendaUsd = 0;

    // MÉTRICAS DE CAJAS FÍSICAS (Tienda y Delivery)
    let totalEfectivoTienda = 0; 
    let totalEfectivoBs = 0;
    let totalPuntoTiendaBs = 0; 
    let totalTarjetaCreditoBs = 0;
    let totalVueltosDados = 0; 
    let totalVueltosBs = 0; 

    pedidosFiltrados.forEach(p => {
      let valorVentaUsd = 0;
      if (p.carritoObj) {
        Object.entries(p.carritoObj).forEach(([key, qty]) => {
          const [n, pr] = key.split('|');
          catalogo.forEach(cat => cat.productos.forEach(prod => {
            if (prod.nombre === n) {
              const idx = prod.presentaciones.indexOf(pr);
              if (idx >= 0 && prod.precios) { valorVentaUsd += (prod.precios[idx] * qty); }
            }
          }));
        });
      }

      let valorObsequiosUsd = 0;
      if (p.carritoObsequiosObj) {
        Object.entries(p.carritoObsequiosObj).forEach(([key, qty]) => {
          const [n, pr] = key.split('|');
          catalogo.forEach(cat => cat.productos.forEach(prod => {
            if (prod.nombre === n) {
              const idx = prod.presentaciones.indexOf(pr);
              if (idx >= 0 && prod.precios) { valorObsequiosUsd += (prod.precios[idx] * qty); }
            }
          }));
        });
      }

      const creditoRegalo = parseFloat(p.montoCreditoRegaloUsd) || 0;

      if (p.esRegalo) {
        // Soporte a registros antiguos donde todo era regalo por un switch
        regalosUSD += valorVentaUsd + valorObsequiosUsd;
      } else {
        const mUsd = p.montoUsd || 0;
        const costoEnvio = parseFloat(p.costoEnvio) || 0;
        
        // El total en obsequios es el valor de los productos regalados + el crédito concedido
        regalosUSD += valorObsequiosUsd + creditoRegalo;
        
        if (p.tipoDespacho === 'Delivery') {
          ventasDeliveryUsd += mUsd;
        } else if (p.tipoDespacho === 'Tienda' || p.tipoDespacho === 'Entrega en tienda') {
          ventasTiendaUsd += mUsd;
        } else {
          ventasEnviosUsd += mUsd;
        }

        if (p.tipoDespacho === 'Tienda' || p.tipoDespacho === 'Entrega en tienda' || p.tipoDespacho === 'Delivery') {
           totalEfectivoTienda += (p.montoEfectivoUsd || 0);
           totalEfectivoBs += (p.montoEfectivoBs || 0);
           totalPuntoTiendaBs += (p.montoPuntoVentaBs || 0);
           totalTarjetaCreditoBs += (p.montoTarjetaCreditoBs || 0);
           totalVueltosDados += (p.vueltoUsd || 0);
           totalVueltosBs += (p.vueltoBs || 0);
        }

        totalBrutoGeneralUsd += mUsd;
        totalCobroEnviosUsd += costoEnvio;

        if (p.moneda === 'ZELLE') {
           ventasZelle += mUsd;
        } else {
           ventasVES += (p.montoVes || 0);
        }

        if (p.esMercadoLibre) { mlUSD += mUsd; mlVES += (p.montoVes || 0); }

        // El descuento real (Campaña/Asesor) se aísla restando primero el crédito
        const diferenciaReal = (valorVentaUsd + costoEnvio) - (mUsd + creditoRegalo);
        if (diferenciaReal > 0) descuentosUSD += diferenciaReal;
      }
    });

    totalBrutoGeneralUsd -= totalVueltosDados;
    const totalNetoProductosUsd = totalBrutoGeneralUsd - totalCobroEnviosUsd;

    return { 
       ventasVES, ventasZelle, mlUSD, mlVES, regalosUSD, descuentosUSD, 
       totalBrutoGeneralUsd, totalCobroEnviosUsd, totalNetoProductosUsd,
       totalEfectivoTienda, totalEfectivoBs, totalPuntoTiendaBs, totalTarjetaCreditoBs, totalVueltosDados, totalVueltosBs,
       ventasEnviosUsd, ventasDeliveryUsd, ventasTiendaUsd
    };
  }, [pedidosFiltrados, catalogo]);

  const ventasPorAsesora = useMemo(() => {
      const map = {};
      pedidosFiltrados.forEach(p => {
         if(p.esRegalo) return; 
         const as = p.asesora || 'Sin Asignar';
         if (!map[as]) map[as] = { nombre: as, totalUsd: 0, totalVes: 0, totalZelle: 0, clientes: [] };
         
         if (p.moneda === 'ZELLE') {
             map[as].totalZelle += (p.montoUsd || 0);
         } else {
             map[as].totalUsd += (p.montoUsd || 0);
             map[as].totalVes += (p.montoVes || 0);
         }
         
         map[as].clientes.push({
             nombre: p.clienteNombre,
             telefono: p.clienteTelefono,
             montoUsd: p.montoUsd || 0,
             montoVes: p.montoVes || 0,
             moneda: p.moneda,
             origen: p.origenPedido || 'Sin Origen',
             costoEnvio: parseFloat(p.costoEnvio) || 0,
             tipoDespacho: p.tipoDespacho || 'Nacional',
             creditoRegalo: parseFloat(p.montoCreditoRegaloUsd) || 0
         });
      });
      return Object.values(map).sort((a,b) => (b.totalUsd + b.totalZelle) - (a.totalUsd + a.totalZelle));
  }, [pedidosFiltrados]);

  // --- CÁLCULO INVENTARIO FÍSICO (Ventas + Obsequios) ---
  const totalValInventario = useMemo(() => {
    let valorInicialStock = 0;
    Object.entries(stock).forEach(([key, val]) => {
      const cantEnvios = typeof val === 'object' ? (val.envios || 0) : (val || 0);
      const cantRecepcion = typeof val === 'object' ? (val.recepcion || 0) : 0;
      const totalCant = cantEnvios + cantRecepcion;

      if (totalCant > 0) {
        const [n, pr] = key.split('|');
        catalogo.forEach(cat => cat.productos.forEach(p => { 
          if(p.nombre === n){ 
            const i = p.presentaciones.indexOf(pr); 
            if(i >= 0) valorInicialStock += (totalCant * p.precios[i]); 
          } 
        }));
      }
    });

    let valorDescontarPorDespachos = 0;
    pedidosFiltrados.forEach(p => {
      const sumarAlDescuento = (carrito) => {
         if (!carrito) return;
         Object.entries(carrito).forEach(([key, qty]) => {
            const [n, pr] = key.split('|');
            catalogo.forEach(cat => cat.productos.forEach(prod => {
              if (prod.nombre === n) {
                const idx = prod.presentaciones.indexOf(pr);
                if (idx >= 0 && prod.precios) { 
                  valorDescontarPorDespachos += (prod.precios[idx] * qty); 
                }
              }
            }));
          });
      };
      
      sumarAlDescuento(p.carritoObj);
      sumarAlDescuento(p.carritoObsequiosObj);
    });

    return Math.max(0, valorInicialStock - valorDescontarPorDespachos);
  }, [stock, catalogo, pedidosFiltrados]);

  // --- TOP 10 PRODUCTOS (Ventas + Obsequios) ---
  const topProductos = useMemo(() => {
    const map = {};
    pedidosFiltrados.forEach(p => {
      const contabilizar = (carrito) => {
         if (!carrito) return;
         Object.entries(carrito).forEach(([key, qty]) => {
            if (!map[key]) map[key] = { cantidad: 0, valor: 0 };
            map[key].cantidad += qty;
            const [n, pr] = key.split('|');
            let precioUnitario = 0;
            catalogo.forEach(c => c.productos.forEach(prod => {
              if (prod.nombre === n) {
                const idx = prod.presentaciones.indexOf(pr);
                if (idx >= 0) precioUnitario = prod.precios[idx] || 0;
              }
            }));
            map[key].valor += (qty * precioUnitario);
          });
      };
      
      contabilizar(p.carritoObj);
      contabilizar(p.carritoObsequiosObj);
    });
    return Object.entries(map).map(([key, data]) => ({ key, ...data })).sort((a, b) => b.cantidad - a.cantidad).slice(0, 10);
  }, [pedidosFiltrados, catalogo]);

  const imprimirPDFVentas = () => {
    const printWindow = window.open('', '_blank');
    if(!printWindow) return alert("Por favor permite las ventanas emergentes (Pop-ups) para generar el PDF.");

    let periodoEtiqueta = '';
    const d = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Caracas"}));
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    if (rangoRango === 'hoy') {
       periodoEtiqueta = `Hoy (${d.toLocaleDateString('es-VE')})`;
    } else if (rangoRango === 'mes') {
       periodoEtiqueta = `Mes de ${meses[d.getMonth()]} ${d.getFullYear()}`;
    } else if (rangoRango === 'año') {
       periodoEtiqueta = `Año ${d.getFullYear()}`;
    } else if (rangoRango === 'todo') {
       periodoEtiqueta = `Histórico Completo`;
    } else if (rangoRango === 'custom') {
       periodoEtiqueta = `Del ${fechaInicio.split('-').reverse().join('/')} al ${fechaFin.split('-').reverse().join('/')}`;
    }

    const productosDetallados = {};
    pedidosFiltrados.forEach(p => {
       if (p.esRegalo) return; 
       
       const descuentoAsesora = p.descuentoPorcentaje || 0;
       const descuentoGlobal = p.descuentoGlobalAplicado || 0;
       const descuentoRealAplicado = Math.max(descuentoAsesora, descuentoGlobal); 

       const procesarParaPDF = (carrito, esObsequio) => {
          if (!carrito) return;
          Object.entries(carrito).forEach(([key, qty]) => {
             const keyPdf = esObsequio ? `${key} (OBSEQUIO)` : key;
             
             if (!productosDetallados[keyPdf]) {
                productosDetallados[keyPdf] = { 
                   nombre: keyPdf.replace('|', ' - '), 
                   unidadesEnvios: 0, 
                   unidadesRecepcion: 0, 
                   valorRealUsd: 0 
                };
             }
             
             if (p.tipoDespacho === 'Delivery' || p.tipoDespacho === 'Tienda' || p.tipoDespacho === 'Entrega en tienda') {
                productosDetallados[keyPdf].unidadesRecepcion += qty;
             } else {
                productosDetallados[keyPdf].unidadesEnvios += qty;
             }
             
             if (!esObsequio) {
                 const [n, pr] = key.split('|');
                 let precioUnitarioCata = 0;
                 catalogo.forEach(c => c.productos.forEach(prod => {
                    if (prod.nombre === n) {
                       const idx = prod.presentaciones.indexOf(pr);
                       if (idx >= 0) precioUnitarioCata = prod.precios[idx] || 0;
                    }
                 }));
                 
                 let precioConDescuento = precioUnitarioCata;
                 if (descuentoRealAplicado > 0) {
                     precioConDescuento = precioUnitarioCata - (precioUnitarioCata * (descuentoRealAplicado / 100));
                 }
                 productosDetallados[keyPdf].valorRealUsd += (precioConDescuento * qty);
             }
          });
       };

       procesarParaPDF(p.carritoObj, false);
       procesarParaPDF(p.carritoObsequiosObj, true);
    });

    const listaProductosPDF = Object.values(productosDetallados).sort((a, b) => (b.unidadesEnvios + b.unidadesRecepcion) - (a.unidadesEnvios + a.unidadesRecepcion));

    const pedidosEnviosNacionales = pedidosFiltrados.filter(p => p.tipoDespacho !== 'Delivery' && p.tipoDespacho !== 'Tienda' && p.tipoDespacho !== 'Entrega en tienda');
    const pedidosEntregasTienda = pedidosFiltrados.filter(p => p.tipoDespacho === 'Tienda' || p.tipoDespacho === 'Entrega en tienda');
    const pedidosDelivery = pedidosFiltrados.filter(p => p.tipoDespacho === 'Delivery');

    // CÁLCULOS NETOS PARA CAJA FÍSICA PDF
    const cajaFisicaUsd = metricas.totalEfectivoTienda - metricas.totalVueltosDados;
    const cajaFisicaBs = metricas.totalEfectivoBs; 
    const totalTransfPagoMovilNetoBs = metricas.ventasVES;
    const totalPuntosTDC = metricas.totalPuntoTiendaBs + metricas.totalTarjetaCreditoBs;

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Reporte de Ventas Bluher Sys</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; max-width: 900px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0ea5e9; padding-bottom: 20px; margin-bottom: 30px; }
          .logo { height: 60px; object-fit: contain; }
          h1 { color: #0f172a; font-weight: 900; margin: 0; font-size: 24px; text-transform: uppercase; }
          
          /* Nuevos estilos adaptados al Dashboard UI */
          .dashboard-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 15px; }
          .grid-col-span-2 { grid-column: span 2; }
          .card { border-radius: 16px; padding: 18px; box-sizing: border-box; position: relative; overflow: hidden; }
          .card-shadow { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
          .card-border { border: 1px solid #e2e8f0; background: #ffffff; }
          
          .bg-dark { background: #0f172a; color: white; border-bottom: 4px solid #020617; }
          .bg-orange { background: #ea580c; color: white; border-bottom: 4px solid #9a3412; }
          .bg-emerald { background: #059669; color: white; border-bottom: 4px solid #065f46; }
          
          .bg-light-green { background: #ecfdf5; color: #064e3b; border-bottom: 4px solid #6ee7b7; }
          .bg-light-cyan { background: #f0fdfa; color: #134e4a; border-bottom: 4px solid #5eead4; }
          .bg-light-indigo { background: #eef2ff; color: #312e81; border-bottom: 4px solid #a5b4fc; }
          
          .bg-purple { background: #6b21a8; color: white; border-bottom: 4px solid #3b0764; }
          .bg-light-slate { background: #f8fafc; color: #0f172a; border-bottom: 4px solid #cbd5e1; }
          
          .kpi-title { font-size: 10px; text-transform: uppercase; font-weight: 900; letter-spacing: 0.5px; margin-bottom: 6px; }
          .kpi-value { font-size: 26px; font-weight: 900; margin: 0; }
          .kpi-sub { font-size: 10px; font-weight: 700; margin-top: 8px; opacity: 0.8; line-height: 1.4; }
          
          .flex-row { display: flex; align-items: center; gap: 12px; }
          .icon-box { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
          .icon-orange { background: #ffedd5; color: #ea580c; }
          .icon-blue { background: #e0f2fe; color: #0284c7; }
          .icon-indigo { background: #e0e7ff; color: #4f46e5; }
          
          h2 { font-size: 14px; font-weight: 900; border-left: 4px solid #0ea5e9; padding-left: 8px; margin-top: 40px; color: #0f172a; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
          th, td { border-bottom: 1px solid #e2e8f0; padding: 12px 8px; text-align: left; vertical-align: top; }
          th { background-color: #f1f5f9; color: #475569; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
          .products-list { color: #475569; line-height: 1.5; }
          .zelle-tag { background: #f3e8ff; color: #6b21a8; font-weight: bold; padding: 2px 6px; border-radius: 4px; font-size: 9px; }
          .envio-tag { background: #fff7ed; color: #c2410c; font-weight: bold; padding: 2px 6px; border-radius: 4px; font-size: 9px; display: inline-block; margin-top: 4px; border: 1px solid #ffedd5; }
          .credito-tag { background: #fce7f3; color: #be185d; font-weight: bold; padding: 2px 6px; border-radius: 4px; font-size: 9px; display: inline-block; margin-top: 4px; border: 1px solid #fbcfe8; }
          
          @media print { body { padding: 0; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 20px; background: #fffbeb; color: #b45309; padding: 15px; border-radius: 8px; border: 1px solid #fde68a; font-weight: bold; text-align: center;">
           Elige "Guardar como PDF" (Save as PDF) en el menú de impresión que acaba de aparecer.
        </div>

        <div class="header">
          <div>
            <h1>Reporte de Ventas</h1>
            <p style="color: #64748b; margin-top: 5px; font-size: 14px; font-weight: bold;">Periodo: ${periodoEtiqueta}</p>
          </div>
          <img src="${BRAND_LOGO}" class="logo" alt="Bluher Logo"/>
        </div>

        <div class="dashboard-grid">
           <div class="card bg-dark card-shadow">
              <div class="kpi-title" style="color: #94a3b8;">Total General Bruto ($)</div>
              <div class="kpi-value">$${metricas.totalBrutoGeneralUsd.toFixed(2)}</div>
           </div>
           <div class="card bg-orange card-shadow">
              <div class="kpi-title" style="color: #fed7aa;">Recaudado por Envíos/Delivery ($)</div>
              <div class="kpi-value">$${metricas.totalCobroEnviosUsd.toFixed(2)}</div>
           </div>
           <div class="card bg-emerald card-shadow">
              <div class="kpi-title" style="color: #a7f3d0;">Ventas Netas (Solo Productos) ($)</div>
              <div class="kpi-value">$${metricas.totalNetoProductosUsd.toFixed(2)}</div>
           </div>
        </div>

        <div class="dashboard-grid">
           <div class="card card-border flex-row">
              <div class="icon-box icon-orange">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 18H3c-.6 0-1-.4-1-1V7c0-.6.4-1 1-1h10c.6 0 1 .4 1 1v11"/><path d="M14 9h4l4 4v5c0 .6-.4 1-1 1h-2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
              </div>
              <div>
                 <div class="kpi-title" style="color: #64748b; margin-bottom: 2px;">Ventas en Envíos</div>
                 <div class="kpi-value" style="font-size: 20px; color: #0f172a;">$${metricas.ventasEnviosUsd.toFixed(2)}</div>
              </div>
           </div>
           <div class="card card-border flex-row">
              <div class="icon-box icon-blue">
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              </div>
              <div>
                 <div class="kpi-title" style="color: #64748b; margin-bottom: 2px;">Ventas Delivery</div>
                 <div class="kpi-value" style="font-size: 20px; color: #0f172a;">$${metricas.ventasDeliveryUsd.toFixed(2)}</div>
              </div>
           </div>
           <div class="card card-border flex-row">
              <div class="icon-box icon-indigo">
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7"/></svg>
              </div>
              <div>
                 <div class="kpi-title" style="color: #64748b; margin-bottom: 2px;">Ventas Entrega en Tienda</div>
                 <div class="kpi-value" style="font-size: 20px; color: #0f172a;">$${metricas.ventasTiendaUsd.toFixed(2)}</div>
              </div>
           </div>
        </div>

        <div class="dashboard-grid">
           <div class="card bg-light-green card-shadow">
              <div class="kpi-title" style="color: #065f46;">Caja Física Dólares ($)</div>
              <div class="kpi-value">$${cajaFisicaUsd.toFixed(2)}</div>
              <div class="kpi-sub">Entró: $${metricas.totalEfectivoTienda.toFixed(2)}<br/>Salió (Vueltos): $${metricas.totalVueltosDados.toFixed(2)}</div>
           </div>
           <div class="card bg-light-cyan card-shadow">
              <div class="kpi-title" style="color: #115e59;">Caja Física Bolívares (Bs)</div>
              <div class="kpi-value">Bs. ${cajaFisicaBs.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
              <div class="kpi-sub">Todo en gaveta (Los vueltos se dan digital)</div>
           </div>
           <div class="card bg-light-indigo card-shadow">
              <div class="kpi-title" style="color: #3730a3;">Punto de Venta y TDC (Bs)</div>
              <div class="kpi-value">Bs. ${totalPuntosTDC.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
              <div class="kpi-sub">Punto normal: Bs. ${metricas.totalPuntoTiendaBs.toLocaleString('es-VE')}<br/>Tarjeta (+15%): Bs. ${metricas.totalTarjetaCreditoBs.toLocaleString('es-VE')}</div>
           </div>
        </div>

        <div class="dashboard-grid">
           <div class="card bg-purple card-shadow">
              <div class="kpi-title" style="color: #e9d5ff;">Pagos ZELLE ($)</div>
              <div class="kpi-value">$${metricas.ventasZelle.toFixed(2)}</div>
           </div>
           <div class="card bg-light-slate card-shadow grid-col-span-2">
              <div class="kpi-title" style="color: #475569;">Transferencias y Pago Móvil Netos (Bs)</div>
              <div class="kpi-value">Bs. ${metricas.ventasVES.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
              <div class="kpi-sub" style="color: #64748b;">Bruto ingresado: Bs. ${metricas.ventasVES.toLocaleString('es-VE')}<br/>Salió en Vueltos (Pago Móvil): Bs. ${metricas.totalVueltosBs.toLocaleString('es-VE')}</div>
           </div>
        </div>

        <h2>Rendimiento por Asesora</h2>
    `;
    
    ventasPorAsesora.forEach(asesora => {
       html += `
         <div style="background: #f8fafc; padding: 15px; margin-top: 15px; border-radius: 8px; border-left: 4px solid #0ea5e9;">
            <h3 style="margin: 0 0 10px 0; font-size: 14px;">${asesora.nombre.toUpperCase()}</h3>
            <p style="margin: 0; font-size: 12px; font-weight: bold; color: #475569;">
               Zelle: <span style="color:#6b21a8;">$${asesora.totalZelle.toFixed(2)}</span> | 
               Bolívares / Efectivo: <span style="color:#059669;">$${asesora.totalUsd.toFixed(2)}</span> | 
               Bolívares: <span style="color:#059669;">Bs. ${asesora.totalVes.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
            </p>
         </div>
         <table>
            <thead><tr><th style="width:25%;">Cliente Atendido</th><th style="width:20%;">Teléfono</th><th style="width:20%;">Origen Pedido</th><th style="width:15%; text-align:right;">Monto Bs</th><th style="width:20%; text-align:right;">Monto USD / Zelle</th></tr></thead>
            <tbody>
       `;
       asesora.clientes.forEach(c => {
          const isZelle = c.moneda === 'ZELLE';
          html += `<tr>
             <td><strong>${c.nombre}</strong></td>
             <td>${c.telefono}</td>
             <td><span style="background: #eef2ff; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; color: #4338ca;">${c.origen}</span></td>
             <td style="text-align:right; color:#059669;">${isZelle ? '-' : c.montoVes.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
             <td style="text-align:right; font-weight:bold;">
                $${c.montoUsd.toFixed(2)} ${isZelle ? '<span class="zelle-tag">ZELLE</span>' : ''}
                ${c.costoEnvio > 0 ? `<br><span class="envio-tag">Incluye Envío: $${c.costoEnvio.toFixed(2)}</span>` : ''}
                ${c.creditoRegalo > 0 ? `<br><span class="credito-tag">Crédito/Regalo: -$${c.creditoRegalo.toFixed(2)}</span>` : ''}
             </td>
          </tr>`;
       });
       html += `</tbody></table>`;
    });

    html += `
        <h2 style="margin-top: 50px;">Resumen de Productos Vendidos</h2>
        <div style="font-size: 10px; color: #64748b; margin-top: -5px; margin-bottom: 10px;">
           * El "Valor Real ($)" refleja lo que realmente ingresó por ese producto luego de aplicar descuentos si los hubo (Los obsequios reflejan $0.00).
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 46%;">Producto y Presentación</th>
              <th style="width: 17%; text-align:center;">U. Envíos</th>
              <th style="width: 17%; text-align:center;">U. Recepción</th>
              <th style="width: 20%; text-align:right;">Valor Real ($)</th>
            </tr>
          </thead>
          <tbody>
    `;

    if (listaProductosPDF.length === 0) {
      html += `<tr><td colspan="4" style="text-align:center; padding: 30px; font-style: italic; color: #94a3b8;">No hay productos vendidos en este periodo.</td></tr>`;
    } else {
      listaProductosPDF.forEach(prod => {
         html += `<tr>
           <td><strong>${prod.nombre}</strong></td>
           <td style="text-align:center; font-weight:bold; color:#ea580c;">${prod.unidadesEnvios}</td>
           <td style="text-align:center; font-weight:bold; color:#3b82f6;">${prod.unidadesRecepcion}</td>
           <td style="text-align:right; font-weight:bold; ${prod.valorRealUsd === 0 ? 'color:#94a3b8;' : 'color:#059669;'}">$${prod.valorRealUsd.toFixed(2)}</td>
         </tr>`;
      });
    }
    html += `</tbody></table>`;

    const macroTablaPedidos = (tituloSeccion, listadoPedidos) => {
       let tablaHtml = `<h2 style="margin-top: 50px;">${tituloSeccion} (${listadoPedidos.length})</h2><table>
          <thead>
            <tr>
              <th style="width: 20%;">Cliente / Asesora</th>
              <th style="width: 15%;">Ref. / Origen</th>
              <th style="width: 45%;">Productos Facturados</th>
              <th style="text-align:right; width: 10%;">Bs</th>
              <th style="text-align:right; width: 10%;">USD</th>
            </tr>
          </thead>
          <tbody>`;

       if (listadoPedidos.length === 0) {
          tablaHtml += `<tr><td colspan="5" style="text-align:center; padding: 20px; font-style: italic; color: #94a3b8;">No se registraron órdenes en esta sección.</td></tr>`;
       } else {
          listadoPedidos.forEach(p => {
             const prodsFormat = typeof p.productos === 'string' ? p.productos.replace(/\n/g, '<br>') : JSON.stringify(p.productos);
             const isZelle = p.moneda === 'ZELLE';
             const costoEnvio = parseFloat(p.costoEnvio) || 0;
             const creditoPdf = parseFloat(p.montoCreditoRegaloUsd) || 0;
             
             tablaHtml += `<tr>
               <td><strong>${p.clienteNombre}</strong><br><span style="color:#64748b; font-size:10px;">${p.fechaDespacho}</span><br><span style="font-size:10px; font-weight:bold;">Asesora: ${p.asesora}</span></td>
               <td><span style="background: #f1f5f9; padding: 4px 6px; border-radius: 4px; font-family: monospace;">${p.referencia || 'N/A'}</span><br><span style="font-size:9px; font-weight:bold; color:#4338ca; display:block; margin-top:4px;">${p.origenPedido || 'Sin Origen'}</span></td>
               <td class="products-list">${prodsFormat}</td>
               <td style="text-align:right; font-weight:bold; color:#059669;">${isZelle ? '-' : (p.montoVes || 0).toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
               <td style="text-align:right; font-weight:900; font-size:13px;">
                  $${(p.montoUsd || 0).toFixed(2)} ${isZelle ? '<br><span class="zelle-tag">ZELLE</span>' : ''}
                  ${costoEnvio > 0 ? `<br><span class="envio-tag">Costo: $${costoEnvio.toFixed(2)}</span>` : ''}
                  ${creditoPdf > 0 ? `<br><span class="credito-tag">Crédito/Regalo: -$${creditoPdf.toFixed(2)}</span>` : ''}
               </td>
             </tr>`;
          });
       }
       tablaHtml += `</tbody></table>`;
       return tablaHtml;
    };

    html += macroTablaPedidos("Envíos Nacionales", pedidosEnviosNacionales);
    html += macroTablaPedidos("Entregas en Tienda", pedidosEntregasTienda);
    html += macroTablaPedidos("Delivery", pedidosDelivery);

    html += `
      <div style="margin-top: 50px; border-top: 1px dashed #cbd5e1; padding-top: 20px; color: #94a3b8; font-size: 11px; text-align: center;">
         Documento generado automáticamente por el Sistema de Gestión Bluher Sys el ${new Date().toLocaleString('es-VE')}
      </div>
    </body></html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 1000);
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-6 transition-colors">
        
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
          <div>
            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2"><CalendarDays className="text-sky-600"/> Período del Reporte</h2>
            <p className="text-xs font-medium text-slate-500">Las métricas se recalcularán basadas en las fechas de despacho seleccionadas.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto items-start sm:items-center">
            <div className="flex overflow-x-auto scrollbar-hide gap-2 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 w-full sm:w-max">
              <button onClick={()=>setRangoRango('hoy')} className={`px-5 py-2.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${rangoRango === 'hoy' ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Hoy</button>
              <button onClick={()=>setRangoRango('mes')} className={`px-5 py-2.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${rangoRango === 'mes' ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Mes Actual</button>
              <button onClick={()=>setRangoRango('año')} className={`px-5 py-2.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${rangoRango === 'año' ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Este Año</button>
              <button onClick={()=>setRangoRango('todo')} className={`px-5 py-2.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${rangoRango === 'todo' ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Histórico Total</button>
              <button onClick={()=>setRangoRango('custom')} className={`px-5 py-2.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${rangoRango === 'custom' ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Personalizado</button>
            </div>
            
            {verDinero && (
              <button onClick={imprimirPDFVentas} className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 text-xs shadow-md transition-colors w-full sm:w-auto shrink-0">
                 <FileOutput size={16}/> Exportar PDF
              </button>
            )}
          </div>
        </div>

        {rangoRango === 'custom' && (
          <div className="flex flex-col sm:flex-row gap-4 items-center w-full animate-in slide-in-from-top-4 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
             <div className="flex-1 w-full">
               <label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 ml-2 block">Desde (Fecha)</label>
               <input type="date" value={fechaInicio} onChange={e=>setFechaInicio(e.target.value)} className="w-full p-3 text-sm font-bold rounded-xl border-2 border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none focus:border-sky-500 transition-colors" />
             </div>
             <div className="flex-1 w-full">
               <label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 ml-2 block">Hasta (Fecha)</label>
               <input type="date" value={fechaFin} onChange={e=>setFechaFin(e.target.value)} className="w-full p-3 text-sm font-bold rounded-xl border-2 border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none focus:border-sky-500 transition-colors" />
             </div>
          </div>
        )}
      </div>

      {/* METRICAS PRINCIPALES */}
      {verDinero && (
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-xl flex flex-col justify-center transition-transform hover:scale-105 border-b-4 border-slate-950 relative overflow-hidden">
               <div className="relative z-10">
                 <div className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1">Total General Bruto ($)</div>
                 <div className="text-3xl lg:text-4xl font-black">${metricas.totalBrutoGeneralUsd.toFixed(2)}</div>
                 {metricas.totalVueltosDados > 0 && <div className="text-xs text-red-400 font-bold mt-1">Ya se restaron ${metricas.totalVueltosDados.toFixed(2)} en vueltos USD.</div>}
               </div>
               <DollarSign size={80} className="absolute -right-4 -bottom-4 opacity-10"/>
            </div>

            <div className="bg-orange-600 text-white p-6 rounded-[2rem] shadow-xl flex flex-col justify-center transition-transform hover:scale-105 border-b-4 border-orange-800 relative overflow-hidden">
               <div className="relative z-10">
                 <div className="text-[10px] uppercase font-black tracking-widest opacity-80 text-orange-200 mb-1">Recaudado por Envíos/Delivery ($)</div>
                 <div className="text-3xl lg:text-4xl font-black">${metricas.totalCobroEnviosUsd.toFixed(2)}</div>
               </div>
               <Truck size={80} className="absolute -right-4 -bottom-4 opacity-10"/>
            </div>
            
            <div className="bg-emerald-600 text-white p-6 rounded-[2rem] shadow-xl flex flex-col justify-center transition-transform hover:scale-105 border-b-4 border-emerald-800 relative overflow-hidden">
               <div className="relative z-10">
                 <div className="text-[10px] uppercase font-black tracking-widest opacity-80 text-emerald-200 mb-1">Ventas Netas (Solo Productos) ($)</div>
                 <div className="text-3xl lg:text-4xl font-black">${metricas.totalNetoProductosUsd.toFixed(2)}</div>
               </div>
               <TrendingUp size={80} className="absolute -right-4 -bottom-4 opacity-10"/>
            </div>
         </div>
      )}

      {/* TRES NUEVOS CAMPOS: SEGMENTACIÓN DE VENTAS */}
      {verDinero && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4 transition-colors">
              <div className="w-14 h-14 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-500 rounded-2xl flex items-center justify-center shrink-0">
                <Truck size={28}/>
              </div>
              <div>
                <div className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Ventas en Envíos</div>
                <div className="font-black text-2xl text-slate-800 dark:text-slate-100">${metricas.ventasEnviosUsd.toFixed(2)}</div>
              </div>
           </div>

           <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4 transition-colors">
              <div className="w-14 h-14 bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-500 rounded-2xl flex items-center justify-center shrink-0">
                <ShoppingBag size={28}/>
              </div>
              <div>
                <div className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Ventas Delivery</div>
                <div className="font-black text-2xl text-slate-800 dark:text-slate-100">${metricas.ventasDeliveryUsd.toFixed(2)}</div>
              </div>
           </div>

           <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4 transition-colors">
              <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-500 rounded-2xl flex items-center justify-center shrink-0">
                <Store size={28}/>
              </div>
              <div>
                <div className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Ventas Entrega en Tienda</div>
                <div className="font-black text-2xl text-slate-800 dark:text-slate-100">${metricas.ventasTiendaUsd.toFixed(2)}</div>
              </div>
           </div>
        </div>
      )}

      {/* MÉTRICAS SECUNDARIAS (CAJAS FÍSICAS Y AUDITORÍA) */}
      {(verDinero || verTotalInventario) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           
           {verDinero && (
              <>
                 <div className="bg-emerald-50 text-emerald-900 p-5 rounded-2xl shadow-sm border-b-4 border-emerald-300 relative overflow-hidden">
                     <div className="text-[10px] uppercase font-black tracking-widest opacity-70 mb-1">Caja Física Dólares ($)</div>
                     <div className="text-2xl font-black">${(metricas.totalEfectivoTienda - metricas.totalVueltosDados).toFixed(2)}</div>
                     <div className="text-[11px] font-bold mt-2 opacity-80">
                         Entró: ${metricas.totalEfectivoTienda.toFixed(2)} <br/> 
                         Salió (Vueltos): ${metricas.totalVueltosDados.toFixed(2)}
                     </div>
                 </div>
                 
                 <div className="bg-teal-50 text-teal-900 p-5 rounded-2xl shadow-sm border-b-4 border-teal-300 relative overflow-hidden">
                     <div className="text-[10px] uppercase font-black tracking-widest opacity-70 mb-1">Caja Física Bolívares (Bs)</div>
                     <div className="text-2xl font-black">Bs. {metricas.totalEfectivoBs.toLocaleString('es-VE', {minimumFractionDigits: 2})}</div>
                     <div className="text-[11px] font-bold mt-2 opacity-80">
                         Todo en gaveta (Los vueltos se dan digital)
                     </div>
                 </div>

                 <div className="bg-indigo-50 text-indigo-900 p-5 rounded-2xl shadow-sm border-b-4 border-indigo-300 relative overflow-hidden">
                     <div className="text-[10px] uppercase font-black tracking-widest opacity-70 mb-1">Punto de Venta y TDC (Bs)</div>
                     <div className="text-2xl font-black">Bs. {(metricas.totalPuntoTiendaBs + metricas.totalTarjetaCreditoBs).toLocaleString('es-VE', {minimumFractionDigits: 2})}</div>
                     <div className="text-[11px] font-bold mt-2 opacity-80">
                         Punto normal: Bs. {metricas.totalPuntoTiendaBs.toLocaleString('es-VE', {minimumFractionDigits: 2})} <br/> 
                         Tarjeta (+15%): Bs. {metricas.totalTarjetaCreditoBs.toLocaleString('es-VE', {minimumFractionDigits: 2})}
                     </div>
                 </div>
              </>
           )}

           {verDinero && (
             <>
               <div className="bg-purple-800 text-white p-6 rounded-[2rem] shadow-md flex flex-col justify-center border-b-4 border-purple-950 relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="text-[10px] uppercase font-black tracking-widest opacity-80 text-purple-200 mb-1">Pagos ZELLE ($)</div>
                    <div className="text-2xl lg:text-3xl font-black">${metricas.ventasZelle.toFixed(2)}</div>
                  </div>
                  <DollarSign size={80} className="absolute -right-4 -bottom-4 opacity-10"/>
               </div>
               
               <div className="bg-slate-100 text-slate-800 p-6 rounded-[2rem] shadow-sm flex flex-col justify-center border-b-4 border-slate-300 relative overflow-hidden md:col-span-2">
                  <div className="relative z-10">
                    <div className="text-[10px] uppercase font-black tracking-widest opacity-70 mb-1">Ingresos en Bs Netos</div>
                    <div className="text-xl lg:text-2xl font-black">Bs. {metricas.ventasVES.toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                    <div className="text-[11px] font-bold mt-2 text-slate-500">
                        Bruto ingresado: Bs. {metricas.ventasVES.toLocaleString('es-VE', {minimumFractionDigits: 2})} <br/>
                        Salió en Vueltos (Pago Móvil): Bs. {metricas.totalVueltosBs.toLocaleString('es-VE', {minimumFractionDigits: 2})}
                    </div>
                  </div>
                  <TrendingUp size={80} className="absolute -right-4 -bottom-4 opacity-5"/>
               </div>
             </>
           )}

           {/* CAMPO DE INVENTARIO FÍSICO SOLO VISIBLE PARA ADMINISTRADORES */}
           {verTotalInventario && (
             <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-sm flex flex-col justify-center border-b-4 border-slate-950 relative overflow-hidden col-span-full">
                <div className="relative z-10">
                  <div className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1">Inventario Físico Restante Auditado ($)</div>
                  <div className="text-2xl lg:text-3xl font-black">${totalValInventario.toFixed(2)}</div>
                  <p className="text-[10px] text-slate-500 mt-1 font-semibold">* Suma base (Recepcion + Envios) descontando el total bruto de productos vendidos u obsequiados sin distorsión de ofertas.</p>
                </div>
                <Archive size={80} className="absolute -right-4 -bottom-4 opacity-10"/>
             </div>
           )}
        </div>
      )}

      {verDinero && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4 transition-colors">
            <div className="w-14 h-14 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-500 rounded-2xl flex items-center justify-center shrink-0">
              <Store size={28}/>
            </div>
            <div>
              <div className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">MercadoLibre</div>
              <div className="font-black text-2xl text-slate-800 dark:text-slate-100">${metricas.mlUSD.toFixed(2)}</div>
              <div className="text-[11px] font-bold text-slate-400 mt-0.5">Bs. {metricas.mlVES.toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4 transition-colors">
            <div className="w-14 h-14 bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-500 rounded-2xl flex items-center justify-center shrink-0">
              <Gift size={28}/>
            </div>
            <div>
              <div className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Costo por Obsequios</div>
              <div className="font-black text-2xl text-slate-800 dark:text-slate-100">${metricas.regalosUSD.toFixed(2)}</div>
              <div className="text-[11px] font-bold text-slate-400 mt-0.5">Dinero en crédito/regalos</div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4 transition-colors">
            <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-500 rounded-2xl flex items-center justify-center shrink-0">
              <Percent size={28}/>
            </div>
            <div>
              <div className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Impacto Descuentos</div>
              <div className="font-black text-2xl text-slate-800 dark:text-slate-100">${metricas.descuentosUSD.toFixed(2)}</div>
              <div className="text-[11px] font-bold text-slate-400 mt-0.5">Diferencia Vs precio catálogo</div>
            </div>
          </div>
        </div>
      )}

      {/* TABLA DE ASESORAS */}
      {verDinero && (
        <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
           <div className="flex items-center gap-2 mb-6">
             <Users className="text-sky-600"/>
             <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">Control de Ventas por Asesoras</h3>
           </div>
           
           <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
             <table className="w-full text-left text-sm border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b dark:border-slate-700">
                    <th className="p-4 font-black tracking-wide">Cliente y Teléfono</th>
                    <th className="p-4 font-black tracking-wide">Origen del Pedido</th>
                    <th className="p-4 font-black tracking-wide text-right">Monto Bs</th>
                    <th className="p-4 font-black tracking-wide text-right">Monto Zelle / Restante</th>
                  </tr>
                </thead>
                <tbody>
                   {ventasPorAsesora.length === 0 ? (
                      <tr><td colSpan="4" className="p-8 text-center text-slate-400 font-bold italic">No hay ventas registradas en este periodo.</td></tr>
                   ) : ventasPorAsesora.map((asesora) => (
                      <React.Fragment key={asesora.nombre}>
                         <tr className="bg-sky-50 dark:bg-sky-900/30 border-y border-sky-100 dark:border-sky-800/50">
                            <td colSpan="4" className="p-4">
                               <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                  <span className="font-black text-lg text-sky-800 dark:text-sky-300 uppercase tracking-tighter">{asesora.nombre}</span>
                                  <div className="flex flex-wrap gap-4 text-xs font-bold text-slate-600 dark:text-slate-300">
                                     <span className="bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800/50 shadow-sm">Zelle: ${asesora.totalZelle.toFixed(2)}</span>
                                     <span className="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border dark:border-slate-700 shadow-sm">Bolívares / Efectivo: <span className="text-slate-900 dark:text-white">${asesora.totalUsd.toFixed(2)}</span></span>
                                     <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/50 shadow-sm">Bs. {asesora.totalVes.toLocaleString('es-VE', {minimumFractionDigits:2})}</span>
                                  </div>
                               </div>
                            </td>
                         </tr>
                         {asesora.clientes.map((c, i) => (
                            <tr key={i} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                               <td className="p-4">
                                  <div className="font-bold text-slate-800 dark:text-slate-200">{c.nombre}</div>
                                  <div className="text-xs text-slate-500 font-medium">{c.telefono}</div>
                               </td>
                               <td className="p-4">
                                  <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest border border-indigo-200 dark:border-indigo-800">
                                     {c.origen}
                                  </span>
                               </td>
                               <td className="p-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                  {c.moneda === 'ZELLE' ? '-' : `Bs. ${c.montoVes.toLocaleString('es-VE', {minimumFractionDigits:2})}`}
                               </td>
                               <td className="p-4 text-right flex flex-col items-end gap-1">
                                  <div>
                                     <span className={`font-black text-base ${c.moneda==='ZELLE' ? 'text-purple-600 dark:text-purple-400' : 'text-slate-800 dark:text-slate-200'}`}>
                                        ${c.montoUsd.toFixed(2)}
                                     </span>
                                     {c.moneda === 'ZELLE' && <span className="ml-2 text-[9px] bg-purple-100 text-purple-700 dark:bg-purple-900/50 px-1.5 py-0.5 rounded font-black border border-purple-200 dark:border-purple-800">ZELLE</span>}
                                  </div>
                                  {c.costoEnvio > 0 && (
                                     <div className="text-[9px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest bg-orange-50 dark:bg-orange-900/30 px-2 py-0.5 rounded border border-orange-200 dark:border-orange-800/50 w-max">
                                        Incluye Envío: ${c.costoEnvio.toFixed(2)}
                                     </div>
                                  )}
                                  {c.creditoRegalo > 0 && (
                                     <div className="text-[9px] font-bold text-pink-600 dark:text-pink-400 uppercase tracking-widest bg-pink-50 dark:bg-pink-900/30 px-2 py-0.5 rounded border border-pink-200 dark:border-pink-800/50 w-max">
                                        Crédito: -${c.creditoRegalo.toFixed(2)}
                                     </div>
                                  )}
                               </td>
                            </tr>
                         ))}
                      </React.Fragment>
                   ))}
                </tbody>
             </table>
           </div>
        </div>
      )}

      {/* TOP 10 PRODUCTOS */}
      <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
           <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2"><Sparkles className="text-sky-600"/> Top 10 Productos Más Vendidos</h3>
         </div>
         
         <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-700/50">
            {topProductos.length === 0 ? (
               <div className="p-8 text-center text-slate-400 font-bold italic">No hay ventas registradas en las fechas seleccionadas.</div>
            ) : topProductos.map((prod, idx) => (
               <div key={prod.key} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors rounded-xl gap-4">
                  <div className="flex items-center gap-3 w-full sm:w-1/2">
                     <div className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-400 flex items-center justify-center font-black text-sm shrink-0">{idx + 1}</div>
                     <span className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base leading-tight">{prod.key.replace('|', ' - ')}</span>
                  </div>
                  
                  <div className="flex w-full sm:w-1/2 justify-between sm:justify-end items-center gap-6 pl-11 sm:pl-0">
                     <div className="text-center sm:text-right">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest sm:hidden mb-0.5">Unidades</div>
                        <div className="font-black text-sky-600 dark:text-sky-400 text-lg sm:text-xl">{prod.cantidad}</div>
                     </div>
                     {verDinero && (
                       <div className="text-right">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest sm:hidden mb-0.5">Ingreso Bruto</div>
                          <div className="font-black text-emerald-600 dark:text-emerald-400 text-lg sm:text-xl">${prod.valor.toFixed(2)}</div>
                       </div>
                     )}
                  </div>
               </div>
            ))}
         </div>
      </div>
    </div>
  );
}