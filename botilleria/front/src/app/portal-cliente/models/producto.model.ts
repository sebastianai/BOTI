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
}

export interface ItemCarrito {
  producto: Producto;
  cantidad: number;
}
