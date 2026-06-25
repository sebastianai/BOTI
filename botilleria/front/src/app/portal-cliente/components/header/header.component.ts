import { Component, inject, output } from '@angular/core';
import { CarritoService } from '../../services/carrito.service';

@Component({
  selector: 'app-header',
  standalone: true,
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  protected readonly carritoService = inject(CarritoService);

  readonly toggleSidebar = output<void>();
  readonly toggleCarrito = output<void>();

  formatearPrecio(precio: number): string {
    return '$' + precio.toLocaleString('es-CL');
  }
}
