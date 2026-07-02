import { Component, inject, output, signal } from '@angular/core';
import { CarritoService } from '../../services/carrito.service';
import { PortalConfigService } from '../../../core/portal-config.service';
import { CategoriasService } from '../../services/categorias.service';

@Component({
  selector: 'app-header',
  standalone: true,
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  protected readonly carritoService = inject(CarritoService);
  protected readonly portalConfig = inject(PortalConfigService);
  protected readonly categoriasService = inject(CategoriasService);

  protected categorias = signal<any[]>([]);
  readonly toggleCarrito = output<void>();
  readonly selectCategoria = output<string>();

  constructor() {
    this.categoriasService.obtenerCategorias().subscribe(cats => {
      this.categorias.set(cats);
    });
  }

  protected onSelectCategoria(categoria: string): void {
    this.selectCategoria.emit(categoria);
  }

  formatearPrecio(precio: number): string {
    return '$' + precio.toLocaleString('es-CL');
  }
}
