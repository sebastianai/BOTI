import { Component, inject, output, signal, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, switchMap, catchError, of } from 'rxjs';
import { CarritoService } from '../../services/carrito.service';
import { PortalConfigService } from '../../../core/portal-config.service';
import { CategoriasService } from '../../services/categorias.service';
import { ProductosService } from '../../services/productos.service';
import { Producto } from '../../models/producto.model';

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
  protected readonly productosService = inject(ProductosService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected categorias = signal<any[]>([]);
  protected searchQuery = signal('');
  protected searchResults = signal<Producto[]>([]);
  protected searchOpen = signal(false);

  readonly toggleCarrito = output<void>();
  readonly selectCategoria = output<string>();

  constructor() {
    this.categoriasService.obtenerCategorias().subscribe(cats => {
      this.categorias.set(cats);
    });

    toObservable(this.searchQuery).pipe(
      debounceTime(300),
      switchMap(query => {
        if (!query.trim()) {
          return of<Producto[]>([]);
        }
        return this.productosService.obtenerProductos('Todos', query).pipe(
          catchError(() => of<Producto[]>([]))
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(results => {
      this.searchResults.set(results);
      this.searchOpen.set(results.length > 0 && this.searchQuery().trim().length > 0);
    });
  }

  protected onSelectCategoria(categoria: string): void {
    this.selectCategoria.emit(categoria);
  }

  protected onSearchChange(query: string): void {
    this.searchQuery.set(query);
  }

  protected onSearchEnter(): void {
    const results = this.searchResults();
    if (results.length > 0) {
      this.navegar(results[0].id);
    }
  }

  protected navegar(productoId: number): void {
    this.router.navigate(['/portal-cliente/producto', productoId]);
    this.searchQuery.set('');
    this.searchOpen.set(false);
  }

  protected navegarInicio(): void {
    this.router.navigate(['/portal-cliente']);
    this.searchQuery.set('');
    this.searchOpen.set(false);
  }

  formatearPrecio(precio: number): string {
    return '$' + precio.toLocaleString('es-CL');
  }
}
