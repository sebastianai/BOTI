import { Injectable, signal, computed } from '@angular/core';
import { ItemCarrito, Producto } from '../models/producto.model';

@Injectable({ providedIn: 'root' })
export class CarritoService {
  private readonly _items = signal<ItemCarrito[]>([]);

  readonly items = this._items.asReadonly();
  readonly totalItems = computed(() => this._items().reduce((acc, i) => acc + i.cantidad, 0));
  readonly totalPrecio = computed(() => this._items().reduce((acc, i) => acc + i.producto.precio * i.cantidad, 0));

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
