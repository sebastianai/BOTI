export interface Producto {
  id: number;
  nombre: string;
  marca: string;
  precio: number;
  precioOriginal?: number;
  categoria: string;
  descripcion: string;
  grados: number;
  volumen: string;
  emoji: string;
  colorFondo: string;
  stock: number;
  imagen?: string;
  topVentas?: boolean;
  promocion?: string | null;  // 'oferta' | '2x1' | null
}

export interface ItemCarrito {
  producto: Producto;
  cantidad: number;
}
