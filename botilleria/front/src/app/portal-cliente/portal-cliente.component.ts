import { Component, signal } from '@angular/core';
import { HeaderComponent } from './components/header/header.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { ProductosComponent } from './components/productos/productos.component';
import { CarritoComponent } from './components/carrito/carrito.component';

@Component({
  selector: 'app-portal-cliente',
  standalone: true,
  imports: [HeaderComponent, SidebarComponent, ProductosComponent, CarritoComponent],
  templateUrl: './portal-cliente.component.html',
  styleUrl: './portal-cliente.component.scss'
})
export class PortalClienteComponent {
  protected readonly sidebarAbierto = signal(false);
  protected readonly carritoAbierto = signal(false);
  protected readonly categoriaSeleccionada = signal('Todos');

  protected seleccionarCategoria(cat: string): void {
    this.categoriaSeleccionada.set(cat);
    this.sidebarAbierto.set(false);
  }
}
