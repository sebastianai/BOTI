import { Component, signal, inject, effect } from '@angular/core';
import { Router, RouterOutlet, ActivatedRoute, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { HeaderComponent } from './components/header/header.component';
import { ProductosComponent } from './components/productos/productos.component';
import { CarritoComponent } from './components/carrito/carrito.component';
import { ResumenCompraComponent } from './components/resumen-compra/resumen-compra.component';
import { PublicidadCarouselComponent } from './components/publicidad-carousel/publicidad-carousel.component';
import { TopVentasComponent } from './components/top-ventas/top-ventas.component';
import { MapaLocalComponent } from './components/mapa-local/mapa-local.component';
import { PromosPortalComponent } from './components/promos-portal/promos-portal.component';
import { PacksPortalComponent } from './components/packs-portal/packs-portal.component';
import { FooterComponent } from './components/footer/footer.component';

@Component({
  selector: 'app-portal-cliente',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, ProductosComponent, CarritoComponent,
            PublicidadCarouselComponent, TopVentasComponent, MapaLocalComponent,
            PromosPortalComponent, PacksPortalComponent, FooterComponent, ResumenCompraComponent],
  templateUrl: './portal-cliente.component.html',
  styleUrl: './portal-cliente.component.scss'
})
export class PortalClienteComponent {
  protected readonly router = inject(Router);
  protected readonly activatedRoute = inject(ActivatedRoute);
  protected readonly carritoAbierto = signal(false);
  protected readonly resumenCompraAbierto = signal(false);
  protected readonly hasChild = signal(false);
  protected readonly esLogin = signal(false);

  constructor() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.hasChild.set(this.activatedRoute.firstChild !== null);
      this.esLogin.set(this.router.url.startsWith('/portal-cliente/login'));
    });

    this.hasChild.set(this.activatedRoute.firstChild !== null);
    this.esLogin.set(this.router.url.startsWith('/portal-cliente/login'));
  }

  protected abrirResumenCompra(): void {
    this.carritoAbierto.set(false);
    this.resumenCompraAbierto.set(true);
  }
}
