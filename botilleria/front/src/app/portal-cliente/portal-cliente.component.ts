import { Component, signal } from '@angular/core';
import { HeaderComponent } from './components/header/header.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { ProductosComponent } from './components/productos/productos.component';
import { CarritoComponent } from './components/carrito/carrito.component';
import { PublicidadCarouselComponent } from './components/publicidad-carousel/publicidad-carousel.component';
import { TopVentasComponent } from './components/top-ventas/top-ventas.component';
import { MapaLocalComponent } from './components/mapa-local/mapa-local.component';

@Component({
  selector: 'app-portal-cliente',
  standalone: true,
  imports: [HeaderComponent, SidebarComponent, ProductosComponent, CarritoComponent,
            PublicidadCarouselComponent, TopVentasComponent, MapaLocalComponent],
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
