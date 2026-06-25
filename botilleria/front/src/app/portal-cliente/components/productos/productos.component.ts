import { Component, input, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, debounceTime, switchMap, tap, catchError, of } from 'rxjs';
import { Producto } from '../../models/producto.model';
import { CarritoService } from '../../services/carrito.service';
import { ProductosService } from '../../services/productos.service';
import { urlImagenProducto } from '../../../core/imagen.util';

@Component({
  selector: 'app-productos',
  standalone: true,
  templateUrl: './productos.component.html',
  styleUrl: './productos.component.scss'
})
export class ProductosComponent {
  readonly categoria = input('Todos');

  private readonly carritoService = inject(CarritoService);
  private readonly productosService = inject(ProductosService);

  protected readonly busqueda = signal('');
  protected readonly cargando = signal(true);
  protected readonly error = signal(false);
  private readonly productoAgregadoIds = signal<Set<number>>(new Set());

  private readonly categoria$ = toObservable(this.categoria);
  private readonly busqueda$ = toObservable(this.busqueda).pipe(debounceTime(300));

  protected readonly productosFiltrados = toSignal(
    combineLatest([this.categoria$, this.busqueda$]).pipe(
      tap(() => {
        this.cargando.set(true);
        this.error.set(false);
      }),
      switchMap(([categoria, busqueda]) =>
        this.productosService.obtenerProductos(categoria, busqueda).pipe(
          catchError(() => {
            this.error.set(true);
            return of<Producto[]>([]);
          })
        )
      ),
      tap(() => this.cargando.set(false))
    ),
    { initialValue: [] as Producto[] }
  );

  protected agregarAlCarrito(producto: Producto): void {
    this.carritoService.agregar(producto);
    this.productoAgregadoIds.update(s => new Set([...s, producto.id]));
    setTimeout(() => {
      this.productoAgregadoIds.update(s => {
        const next = new Set(s);
        next.delete(producto.id);
        return next;
      });
    }, 1200);
  }

  protected estaAgregado(id: number): boolean {
    return this.productoAgregadoIds().has(id);
  }

  protected formatearPrecio(precio: number): string {
    return '$' + precio.toLocaleString('es-CL');
  }

  protected onBuscar(event: Event): void {
    this.busqueda.set((event.target as HTMLInputElement).value);
  }

  protected urlImagenProducto(rutaImagen: string | undefined): string {
    return urlImagenProducto(rutaImagen);
  }
}
