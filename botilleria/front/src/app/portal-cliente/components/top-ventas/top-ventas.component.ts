import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { ProductosService } from '../../services/productos.service';
import { CarritoService } from '../../services/carrito.service';
import { Producto } from '../../models/producto.model';
import { urlImagenProducto } from '../../../core/imagen.util';

@Component({
  selector: 'app-top-ventas',
  standalone: true,
  templateUrl: './top-ventas.component.html',
  styleUrl: './top-ventas.component.scss'
})
export class TopVentasComponent {
  private readonly carritoService = inject(CarritoService);
  private readonly productosService = inject(ProductosService);
  private readonly agregadoIds = signal<Set<number>>(new Set());

  protected readonly productos = toSignal(
    this.productosService.obtenerProductos('Todos', '', true).pipe(
      catchError(() => of<Producto[]>([]))
    ),
    { initialValue: [] as Producto[] }
  );

  protected agregar(p: Producto): void {
    this.carritoService.agregar(p);
    this.agregadoIds.update(s => new Set([...s, p.id]));
    setTimeout(() => this.agregadoIds.update(s => { const n = new Set(s); n.delete(p.id); return n; }), 1200);
  }

  protected estaAgregado(id: number): boolean { return this.agregadoIds().has(id); }
  protected formatearPrecio(p: number): string { return '$' + p.toLocaleString('es-CL'); }
  protected urlImagen(ruta: string | undefined): string { return urlImagenProducto(ruta); }
}
