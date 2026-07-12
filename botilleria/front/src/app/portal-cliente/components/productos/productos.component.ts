import {
  Component, input, inject, signal, computed,
  ViewChild, ElementRef, effect, afterNextRender, DestroyRef
} from '@angular/core';
import { Router } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, debounceTime, switchMap, tap, catchError, of } from 'rxjs';
import { Producto } from '../../models/producto.model';
import { CarritoService } from '../../services/carrito.service';
import { ProductosService } from '../../services/productos.service';
import { urlImagenProducto } from '../../../core/imagen.util';
import { VasosLoadingComponent } from '../vasos-loading/vasos-loading.component';

type Orden = 'default' | 'precio-asc' | 'precio-desc';

@Component({
  selector: 'app-productos',
  standalone: true,
  imports: [VasosLoadingComponent],
  templateUrl: './productos.component.html',
  styleUrl: './productos.component.scss'
})
export class ProductosComponent {
  readonly categoria = input('Todos');

  private readonly carritoService = inject(CarritoService);
  private readonly productosService = inject(ProductosService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly busqueda = signal('');
  protected readonly cargando = signal(true);
  protected readonly error = signal(false);
  protected readonly orden = signal<Orden>('default');
  protected readonly soloOfertas = signal(false);
  private readonly productoAgregadoIds = signal<Set<number>>(new Set());

  protected readonly esCarrusel = computed(() => this.categoria() !== 'Todos');

  private readonly categoria$ = toObservable(this.categoria);
  private readonly busqueda$ = toObservable(this.busqueda).pipe(debounceTime(300));

  private readonly productosApi = toSignal(
    combineLatest([this.categoria$, this.busqueda$]).pipe(
      tap(() => { this.cargando.set(true); this.error.set(false); }),
      switchMap(([categoria, busqueda]) =>
        this.productosService.obtenerProductos(categoria, busqueda).pipe(
          catchError(() => { this.error.set(true); return of<Producto[]>([]); })
        )
      ),
      tap(() => this.cargando.set(false))
    ),
    { initialValue: [] as Producto[] }
  );

  protected readonly productosFiltrados = computed(() => {
    let items = [...(this.productosApi() ?? [])];
    if (this.soloOfertas()) items = items.filter(p => !!p.precioOriginal);
    if (this.orden() === 'precio-asc') items.sort((a, b) => a.precio - b.precio);
    if (this.orden() === 'precio-desc') items.sort((a, b) => b.precio - a.precio);
    return items;
  });

  /* ── Carousel state ── */
  private readonly scrollPos = signal(0);
  private readonly scrollMax = signal(9999);
  protected readonly puedeAnterior = computed(() => this.scrollPos() > 4);
  protected readonly puedeSiguiente = computed(() => this.scrollPos() < this.scrollMax() - 4);

  protected readonly btnTop   = signal('-9999px');
  protected readonly btnPrevL = signal('-9999px');
  protected readonly btnNextL = signal('-9999px');

  @ViewChild('wrapper') wrapperRef!: ElementRef<HTMLDivElement>;
  @ViewChild('track')   trackRef!: ElementRef<HTMLDivElement>;

  constructor() {
    effect(() => {
      /* Re-calculate when category or products change (carousel mode may have appeared) */
      const _ = this.esCarrusel();
      const __ = this.productosFiltrados().length;
      if (this.esCarrusel()) {
        setTimeout(() => { this.actualizarBounds(); this.actualizarPosBtn(); }, 100);
      } else {
        this.btnTop.set('-9999px');
        this.btnPrevL.set('-9999px');
        this.btnNextL.set('-9999px');
      }
    });

    afterNextRender(() => {
      const onUpdate = () => { if (this.esCarrusel()) this.actualizarPosBtn(); };
      window.addEventListener('scroll', onUpdate, { passive: true });
      window.addEventListener('resize', onUpdate, { passive: true });
      this.destroyRef.onDestroy(() => {
        window.removeEventListener('scroll', onUpdate);
        window.removeEventListener('resize', onUpdate);
      });
    });
  }

  protected onScrollTrack(): void { this.actualizarBounds(); }

  protected siguiente(): void {
    const el = this.trackRef?.nativeElement;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('.producto-card');
    const step = card ? card.offsetWidth + 20 : 260;
    el.scrollBy({ left: step, behavior: 'smooth' });
  }

  protected anterior(): void {
    const el = this.trackRef?.nativeElement;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('.producto-card');
    const step = card ? card.offsetWidth + 20 : 260;
    el.scrollBy({ left: -step, behavior: 'smooth' });
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
  protected onBuscar(event: Event): void { this.busqueda.set((event.target as HTMLInputElement).value); }
  protected onOrden(event: Event): void { this.orden.set((event.target as HTMLSelectElement).value as Orden); }
  protected urlImagenProducto(rutaImagen: string | undefined): string { return urlImagenProducto(rutaImagen); }

  protected badgeLabel(producto: Producto): string | null {
    if (producto.promocion) {
      const labels: Record<string, string> = { '2x1': '2×1', '3x2': '3×2', 'descuento': 'DESCUENTO', 'general': 'PROMO' };
      return labels[producto.promocion] ?? producto.promocion.toUpperCase();
    }
    if (producto.precioOriginal) return 'OFERTA';
    return null;
  }

  private actualizarBounds(): void {
    const el = this.trackRef?.nativeElement;
    if (!el) return;
    this.scrollPos.set(el.scrollLeft);
    this.scrollMax.set(el.scrollWidth - el.clientWidth);
  }

  private actualizarPosBtn(): void {
    const el = this.wrapperRef?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    this.btnTop.set(`${rect.top + rect.height / 2}px`);
    this.btnPrevL.set(`${rect.left - 22}px`);
    this.btnNextL.set(`${rect.right - 22}px`);
  }
}
