export const BRAND_LOGO = "logobluher.jpg"; 

export const ROLES = {
  ADMIN: 'Administrador',
  ADMINISTRACION: 'Administración',
  VENTAS: 'Ventas',
  DESPACHO: 'Despacho',
  AUDITORIA: 'Auditoría'
};

export const DEFAULT_CATALOGO = [
  { categoria: "Cirugías Capilares", productos: [ 
      { nombre: "Cirugía Clásica", presentaciones: ["Litro", "1/2 Litro", "Galón"], precios: [25, 15, 80], imagen: "" }, 
      { nombre: "Cirugía Chocolate", presentaciones: ["Litro", "1/2 Litro", "Galón"], precios: [25, 15, 80], imagen: "" } 
    ] 
  },
  { categoria: "Alisados", productos: [ 
      { nombre: "Alisado Clásico", presentaciones: ["1 Litro", "300ml"], precios: [30, 12], imagen: "" }, 
      { nombre: "Alisado Chocolate", presentaciones: ["1 Litro", "300ml"], precios: [30, 12], imagen: "" } 
    ] 
  },
  { categoria: "Shampoos y Cuidado", productos: [ 
      { nombre: "Shampoo Tradicional", presentaciones: ["Litro", "1/2 Litro"], precios: [10, 6], imagen: "" }, 
      { nombre: "Anti-Residuos", presentaciones: ["1 Litro", "1/2 Litro"], precios: [12, 7], imagen: "" } 
    ] 
  },
  { categoria: "Boosters y Terapias", productos: [ 
      { nombre: "Booster de Hidratacion", presentaciones: ["Unidad"], precios: [5], imagen: "" },
      { nombre: "Booster de Reparacion", presentaciones: ["Unidad"], precios: [5], imagen: "" },
      { nombre: "Booster de Nutricion", presentaciones: ["Unidad"], precios: [5], imagen: "" },
      { nombre: "Booster Profesional", presentaciones: ["Unidad"], precios: [8], imagen: "" },
      { nombre: "Terapia Antifrizz", presentaciones: ["500gr"], precios: [20], imagen: "" } 
    ] 
  },
  { categoria: "Complementos Automáticos", productos: [
      { nombre: "Concentrado", presentaciones: ["Unidad"], precios: [0], imagen: "" }
    ]
  }
];