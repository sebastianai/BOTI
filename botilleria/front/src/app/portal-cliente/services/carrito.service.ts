import { Injectable, signal, computed } from '@angular/core';
import { ItemCarrito, Producto } from '../models/producto.model';

@Injectable({ providedIn: 'root' })
export class CarritoService {
  private readonly _items = signal<ItemCarrito[]>([]);

  readonly items = this._items.asReadonly();
  readonly totalItems = computed(() => this._items().reduce((acc, i) => acc + i.cantidad, 0));
  readonly totalPrecio = computed(() =>
    this._items().reduce((acc, i) => acc + this.calcularSubtotal(i), 0)
  );

  private calcularSubtotal(item: ItemCarrito): number {
    const { producto, cantidad } = item;
    const precio = producto.precio;

    if (producto.promocion === '2x1') {
      // 2x1: every 2 units charged as 1 unit
      const cantidadCobrada = Math.ceil(cantidad / 2);
      return cantidadCobrada * precio;
    } else if (producto.promocion === '3x2') {
      // 3x2: every 3 units charged as 2 units
      const cantidadCobrada = Math.ceil((cantidad * 2) / 3);
      return cantidadCobrada * precio;
    } else if (producto.precioOriginal) {
      // Oferta: use the sale price (precio field)
      return cantidad * precio;
    } else {
      // Regular price
      return cantidad * precio;
    }
  }

  calcularPrecioUnidad(producto: Producto): number {
    if (producto.promocion === '2x1') {
      return producto.precio / 2;
    } else if (producto.promocion === '3x2') {
      return (producto.precio * 2) / 3;
    } else {
      return producto.precio;
    }
  }

  agregar(producto: Producto): void {
    this._items.update(items => {
      const idx = items.findIndex(i => i.producto.id === producto.id);
      if (idx >= 0) {
        return items.map((item, i) =>
          i === idx ? { ...item, cantidad: item.cantidad + 1 } : item
        );
      }
      return [...items, { producto, cantidad: 1 }];
    });
  }

  remover(productoId: number): void {
    this._items.update(items => items.filter(i => i.producto.id !== productoId));
  }

  actualizarCantidad(productoId: number, cantidad: number): void {
    if (cantidad <= 0) {
      this.remover(productoId);
      return;
    }
    this._items.update(items =>
      items.map(item =>
        item.producto.id === productoId ? { ...item, cantidad } : item
      )
    );
  }

  vaciar(): void {
    this._items.set([]);
  }
}
