import { Component, input, output, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CarritoService } from '../../services/carrito.service';
import { ItemCarrito } from '../../models/producto.model';
import { urlImagenProducto } from '../../../core/imagen.util';

@Component({
  selector: 'app-carrito',
  standalone: true,
  templateUrl: './carrito.component.html',
  styleUrl: './carrito.component.scss'
})
export class CarritoComponent {
  readonly abierto = input(false);
  readonly cerrar = output<void>();
  readonly irAPagar = output<void>();

  private readonly router = inject(Router);
  protected readonly carritoService = inject(CarritoService);

  protected cotizar(): void {
    this.cerrar.emit();
    this.router.navigate(['/portal-cliente/cotizar']);
  }

  protected formatearPrecio(precio: number): string {
    return '$' + precio.toLocaleString('es-CL');
  }

  protected calcularSubtotal(item: ItemCarrito): number {
    const { producto, cantidad } = item;
    const precio = producto.precio;

    if (producto.promocion === '2x1') {
      const cantidadCobrada = Math.ceil(cantidad / 2);
      return cantidadCobrada * precio;
    } else if (producto.promocion === '3x2') {
      const cantidadCobrada = Math.ceil((cantidad * 2) / 3);
      return cantidadCobrada * precio;
    } else if (producto.precioOriginal) {
      return cantidad * precio;
    } else {
      return cantidad * precio;
    }
  }

  protected obtenerLabelPromocion(promocion: string | null | undefined): string {
    if (promocion === '2x1') return '🎁 2x1';
    if (promocion === '3x2') return '🎁 3x2';
    if (promocion === 'oferta') return '🏷️ Oferta';
    return '';
  }

  protected cambiarCantidad(item: ItemCarrito, delta: number): void {
    this.carritoService.actualizarCantidad(item.producto.id, item.cantidad + delta);
  }

  protected remover(id: number): void {
    this.carritoService.remover(id);
  }

  protected vaciar(): void {
    this.carritoService.vaciar();
  }

  protected urlImagenProducto(rutaImagen: string | undefined): string {
    return urlImagenProducto(rutaImagen);
  }
}
