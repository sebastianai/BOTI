import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreadcrumbComponent } from '../breadcrumb/breadcrumb.component';
import { ProductosService } from '../../services/productos.service';
import { CarritoService } from '../../services/carrito.service';
import { PortalConfigService } from '../../../core/portal-config.service';
import { Producto } from '../../models/producto.model';

@Component({
  selector: 'app-vista-producto',
  standalone: true,
  imports: [CommonModule, BreadcrumbComponent],
  templateUrl: './vista-producto.component.html',
  styleUrl: './vista-producto.component.scss'
})
export class VistaProductoComponent {
  private activatedRoute = inject(ActivatedRoute);
  private productosService = inject(ProductosService);
  private carritoService = inject(CarritoService);
  private router = inject(Router);
  protected readonly portalConfig = inject(PortalConfigService);

  cantidad = signal(1);
  breadcrumbItems = signal<any[]>([{ label: 'Inicio', path: '/portal-cliente' }]);

  private productoId = toSignal(
    this.activatedRoute.paramMap.pipe(
      map(params => Number(params.get('id')))
    ),
    { initialValue: 0 }
  );

  producto = signal<Producto | null>(null);
  cargando = signal(true);
  error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.productoId();
      if (id > 0) {
        window.scrollTo(0, 0);
        this.cargando.set(true);
        this.productosService.obtenerProducto(id).subscribe({
          next: (prod) => {
            this.producto.set(prod);
            this.breadcrumbItems.set([
              { label: 'Inicio', path: '/portal-cliente' },
              { label: prod.nombre }
            ]);
            this.cargando.set(false);
          },
          error: (err) => {
            this.error.set('No pudimos cargar el producto');
            this.cargando.set(false);
          }
        });
      }
    }, { allowSignalWrites: true });
  }

  incrementarCantidad() {
    this.cantidad.update(q => q + 1);
  }

  decrementarCantidad() {
    if (this.cantidad() > 1) {
      this.cantidad.update(q => q - 1);
    }
  }

  agregarAlCarrito() {
    const prod = this.producto();
    if (prod) {
      this.carritoService.agregar(prod);
      if (this.cantidad() > 1) {
        this.carritoService.actualizarCantidad(prod.id, this.cantidad());
      }
      alert('Producto agregado al carrito');
    }
  }

  formatearPrecio(precio: number): string {
    return '$' + precio.toLocaleString('es-CL');
  }

  calcularPrecioXLitro(precio: number, volumen: string): string {
    const volumeNum = Number(volumen.replace('ml', '').replace('cc', '').trim());
    if (volumeNum && volumeNum > 0) {
      const precioXLitro = (precio / volumeNum) * 1000;
      return '$' + precioXLitro.toLocaleString('es-CL', { maximumFractionDigits: 0 });
    }
    return '-';
  }
}
