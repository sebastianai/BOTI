import { Component, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap, tap, catchError, of } from 'rxjs';
import { Producto } from '../../models/producto.model';
import { CarritoService } from '../../services/carrito.service';
import { ProductosService } from '../../services/productos.service';
import { CategoriasService, Categoria } from '../../services/categorias.service';
import { PublicidadService, ItemPublicidad } from '../../services/publicidad.service';
import { urlImagenProducto } from '../../../core/imagen.util';
import { BreadcrumbComponent, BreadcrumbItem } from '../breadcrumb/breadcrumb.component';
import { VasosLoadingComponent } from '../vasos-loading/vasos-loading.component';

type Orden = 'default' | 'precio-asc' | 'precio-desc';

@Component({
  selector: 'app-categoria',
  standalone: true,
  imports: [BreadcrumbComponent, VasosLoadingComponent],
  templateUrl: './categoria.component.html',
  styleUrl: './categoria.component.scss'
})
export class CategoriaComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly carritoService = inject(CarritoService);
  private readonly productosService = inject(ProductosService);
  private readonly categoriasService = inject(CategoriasService);
  protected readonly publicidadService = inject(PublicidadService);

  protected readonly categoriaId = toSignal(
    this.route.paramMap.pipe(map(params => params.get('id') ?? '')),
    { initialValue: '' }
  );

  protected readonly categorias = signal<Categoria[]>([]);
  protected readonly cargando = signal(true);
  private readonly productoAgregadoIds = signal<Set<number>>(new Set());

  protected readonly categoriaActual = computed(() =>
    this.categorias().find(c => c.id === this.categoriaId()) ?? null
  );

  protected readonly nombreCategoria = computed(() => this.categoriaActual()?.nombre ?? this.categoriaId());

  protected readonly breadcrumbItems = computed<BreadcrumbItem[]>(() => [
    { label: 'Inicio', path: '/portal-cliente' },
    { label: this.nombreCategoria() }
  ]);

  private readonly categoriaId$ = toObservable(this.categoriaId);

  private readonly productosApi = toSignal(
    this.categoriaId$.pipe(
      tap(() => this.cargando.set(true)),
      switchMap(categoria => categoria
        ? this.productosService.obtenerProductos(categoria, '').pipe(catchError(() => of<Producto[]>([])))
        : of<Producto[]>([])
      ),
      tap(() => this.cargando.set(false))
    ),
    { initialValue: [] as Producto[] }
  );

  protected readonly banner = toSignal(
    this.categoriaId$.pipe(
      switchMap(categoria => categoria
        ? this.publicidadService.obtenerPorCategoria(categoria)
        : of<ItemPublicidad[]>([])
      )
    ),
    { initialValue: [] as ItemPublicidad[] }
  );

  protected readonly bannerActual = computed<ItemPublicidad | null>(() => this.banner()[0] ?? null);

  /* ── Filtros ── */
  protected readonly orden = signal<Orden>('default');
  protected readonly precioMin = signal<number | null>(null);
  protected readonly precioMax = signal<number | null>(null);
  protected readonly marcasSeleccionadas = signal<Set<string>>(new Set());

  protected readonly precioAbierto = signal(false);
  protected readonly marcasAbierto = signal(false);

  protected readonly marcasDisponibles = computed(() =>
    [...new Set(this.productosApi().map(p => p.marca))].sort((a, b) => a.localeCompare(b))
  );

  protected readonly productosFiltrados = computed(() => {
    let items = [...this.productosApi()];
    const min = this.precioMin();
    const max = this.precioMax();
    const marcas = this.marcasSeleccionadas();

    if (min !== null) items = items.filter(p => p.precio >= min);
    if (max !== null) items = items.filter(p => p.precio <= max);
    if (marcas.size > 0) items = items.filter(p => marcas.has(p.marca));

    if (this.orden() === 'precio-asc') items.sort((a, b) => a.precio - b.precio);
    if (this.orden() === 'precio-desc') items.sort((a, b) => b.precio - a.precio);
    return items;
  });

  protected readonly filtrosActivos = computed(() =>
    (this.precioMin() !== null ? 1 : 0) + (this.precioMax() !== null ? 1 : 0) + this.marcasSeleccionadas().size
  );

  constructor() {
    this.categoriasService.obtenerCategorias().subscribe({ next: data => this.categorias.set(data) });
  }

  protected togglePrecio(): void { this.precioAbierto.update(v => !v); }
  protected toggleMarcasPanel(): void { this.marcasAbierto.update(v => !v); }

  protected toggleMarca(marca: string): void {
    this.marcasSeleccionadas.update(set => {
      const next = new Set(set);
      if (next.has(marca)) next.delete(marca); else next.add(marca);
      return next;
    });
  }

  protected onPrecioMinChange(event: Event): void {
    const valor = (event.target as HTMLInputElement).value;
    this.precioMin.set(valor.trim() === '' ? null : Number(valor));
  }

  protected onPrecioMaxChange(event: Event): void {
    const valor = (event.target as HTMLInputElement).value;
    this.precioMax.set(valor.trim() === '' ? null : Number(valor));
  }

  protected limpiarFiltros(): void {
    this.precioMin.set(null);
    this.precioMax.set(null);
    this.marcasSeleccionadas.set(new Set());
  }

  protected onOrden(event: Event): void {
    this.orden.set((event.target as HTMLSelectElement).value as Orden);
  }

  protected agregarAlCarrito(producto: Producto): void {
    this.carritoService.agregar(producto);
    this.productoAgregadoIds.update(s => new Set([...s, producto.id]));
    setTimeout(() => {
      this.productoAgregadoIds.update(s => { const n = new Set(s); n.delete(producto.id); return n; });
    }, 1200);
  }

  protected onProductoClick(producto: Producto): void {
    this.router.navigate(['/portal-cliente/producto', producto.id]);
  }

  protected estaAgregado(id: number): boolean { return this.productoAgregadoIds().has(id); }
  protected formatearPrecio(precio: number): string { return '$' + precio.toLocaleString('es-CL'); }
  protected urlImagenProducto(rutaImagen: string | undefined): string { return urlImagenProducto(rutaImagen); }

  protected badgeLabel(producto: Producto): string | null {
    if (producto.promocion) {
      const labels: Record<string, string> = { '2x1': '2×1', '3x2': '3×2', 'descuento': 'DESCUENTO', 'general': 'PROMO' };
      return labels[producto.promocion] ?? producto.promocion.toUpperCase();
    }
    if (producto.precioOriginal) return 'OFERTA';
    return null;
  }
}
