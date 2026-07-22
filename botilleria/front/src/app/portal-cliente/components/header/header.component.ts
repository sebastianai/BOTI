import { Component, inject, output, signal, DestroyRef, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, switchMap, catchError, of } from 'rxjs';
import { CarritoService } from '../../services/carrito.service';
import { PortalConfigService } from '../../../core/portal-config.service';
import { CategoriasService } from '../../services/categorias.service';
import { ProductosService } from '../../services/productos.service';
import { ClienteAuthService } from '../../services/cliente-auth.service';
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
  protected readonly clienteAuth = inject(ClienteAuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected categorias = signal<any[]>([]);
  protected searchQuery = signal('');
  protected searchResults = signal<Producto[]>([]);
  protected searchOpen = signal(false);
  protected menuCuentaAbierto = signal(false);

  readonly toggleCarrito = output<void>();

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
    this.router.navigate(['/portal-cliente/categoria', categoria]);
    this.searchQuery.set('');
    this.searchOpen.set(false);
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

  protected toggleMenuCuenta(): void {
    this.menuCuentaAbierto.update(v => !v);
  }

  protected irARegistro(): void {
    this.menuCuentaAbierto.set(false);
    this.router.navigate(['/portal-cliente/registro']);
  }

  protected irALogin(): void {
    this.menuCuentaAbierto.set(false);
    this.router.navigate(['/portal-cliente/login']);
  }

  protected cerrarSesion(): void {
    this.menuCuentaAbierto.set(false);
    this.clienteAuth.logout();
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.menuCuentaAbierto()) return;
    const target = event.target as HTMLElement;
    if (!target.closest('.header__login-wrap')) {
      this.menuCuentaAbierto.set(false);
    }
  }

  formatearPrecio(precio: number): string {
    return '$' + precio.toLocaleString('es-CL');
  }
}
