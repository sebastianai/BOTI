import { Component, input, output, inject } from '@angular/core';
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

  protected readonly carritoService = inject(CarritoService);

  protected formatearPrecio(precio: number): string {
    return '$' + precio.toLocaleString('es-CL');
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
