import {
  Component, input, inject, signal, computed,
  ViewChild, ViewChildren, QueryList, ElementRef,
  effect, afterNextRender, DestroyRef
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

interface CarruselState { pos: number; max: number; }
interface BtnPos { top: string; prevL: string; nextL: string; }
interface GrupoCategoria { categoria: string; productos: Producto[]; }

const OCULTO: BtnPos = { top: '-9999px', prevL: '-9999px', nextL: '-9999px' };

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

  protected readonly productosAgrupados = computed<GrupoCategoria[]>(() => {
    if (this.categoria() !== 'Todos') return [];
    const map = new Map<string, Producto[]>();
    for (const p of this.productosFiltrados()) {
      if (!map.has(p.categoria)) map.set(p.categoria, []);
      map.get(p.categoria)!.push(p);
    }
    return Array.from(map.entries()).map(([categoria, productos]) => ({ categoria, productos }));
  });

  /* ── Single carousel state (category selected) ── */
  private readonly scrollPos = signal(0);
  private readonly scrollMax = signal(9999);
  protected readonly puedeAnterior = computed(() => this.scrollPos() > 4);
  protected readonly puedeSiguiente = computed(() => this.scrollPos() < this.scrollMax() - 4);
  protected readonly btnTop   = signal('-9999px');
  protected readonly btnPrevL = signal('-9999px');
  protected readonly btnNextL = signal('-9999px');

  @ViewChild('wrapper') wrapperRef!: ElementRef<HTMLDivElement>;
  @ViewChild('track')   trackRef!: ElementRef<HTMLDivElement>;

  /* ── Multi carousel state (Todos grouped) ── */
  protected scrollStates   = signal<CarruselState[]>([]);
  protected btnPositions   = signal<BtnPos[]>([]);

  @ViewChildren('groupWrapper') groupWrapperRefs!: QueryList<ElementRef<HTMLDivElement>>;
  @ViewChildren('groupTrack')   groupTrackRefs!: QueryList<ElementRef<HTMLDivElement>>;

  constructor() {
    // Single carousel (specific category)
    effect(() => {
      const esCarrusel = this.esCarrusel();
      this.productosFiltrados();
      if (esCarrusel) {
        setTimeout(() => { this.actualizarBounds(); this.actualizarPosBtn(); }, 100);
      } else {
        this.btnTop.set('-9999px');
        this.btnPrevL.set('-9999px');
        this.btnNextL.set('-9999px');
      }
    }, { allowSignalWrites: true });

    // Group carousels (Todos mode)
    effect(() => {
      const grupos = this.productosAgrupados();
      if (grupos.length === 0) return;
      this.scrollStates.set(grupos.map(() => ({ pos: 0, max: 9999 })));
      this.btnPositions.set(grupos.map(() => ({ ...OCULTO })));
      setTimeout(() => { grupos.forEach((_, i) => this.actualizarPosBtnGrupo(i)); }, 100);
    }, { allowSignalWrites: true });

    afterNextRender(() => {
      const onUpdate = () => {
        if (this.esCarrusel()) {
          this.actualizarPosBtn();
        } else {
          this.productosAgrupados().forEach((_, i) => this.actualizarPosBtnGrupo(i));
        }
      };
      window.addEventListener('scroll', onUpdate, { passive: true });
      window.addEventListener('resize', onUpdate, { passive: true });
      this.destroyRef.onDestroy(() => {
        window.removeEventListener('scroll', onUpdate);
        window.removeEventListener('resize', onUpdate);
      });
    });
  }

  /* ── Single carousel methods ── */
  protected onScrollTrack(): void { this.actualizarBounds(); }

  protected siguiente(): void {
    const el = this.trackRef?.nativeElement;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('.producto-card');
    el.scrollBy({ left: (card ? card.offsetWidth + 20 : 260), behavior: 'smooth' });
  }

  protected anterior(): void {
    const el = this.trackRef?.nativeElement;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('.producto-card');
    el.scrollBy({ left: -(card ? card.offsetWidth + 20 : 260), behavior: 'smooth' });
  }

  /* ── Group carousel methods ── */
  protected onScrollGrupo(i: number): void {
    const el = this.groupTrackRefs.get(i)?.nativeElement;
    if (!el) return;
    const states = [...this.scrollStates()];
    states[i] = { pos: el.scrollLeft, max: el.scrollWidth - el.clientWidth };
    this.scrollStates.set(states);
  }

  protected siguienteGrupo(i: number): void {
    const el = this.groupTrackRefs.get(i)?.nativeElement;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('.producto-card');
    el.scrollBy({ left: (card ? card.offsetWidth + 20 : 260), behavior: 'smooth' });
  }

  protected anteriorGrupo(i: number): void {
    const el = this.groupTrackRefs.get(i)?.nativeElement;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('.producto-card');
    el.scrollBy({ left: -(card ? card.offsetWidth + 20 : 260), behavior: 'smooth' });
  }

  protected puedeAnteriorGrupo(i: number): boolean {
    return (this.scrollStates()[i]?.pos ?? 0) > 4;
  }

  protected puedeSiguienteGrupo(i: number): boolean {
    const s = this.scrollStates()[i];
    return s ? s.pos < s.max - 4 : true;
  }

  protected btnTopGrupo(i: number): string   { return this.btnPositions()[i]?.top   ?? '-9999px'; }
  protected btnPrevLGrupo(i: number): string  { return this.btnPositions()[i]?.prevL ?? '-9999px'; }
  protected btnNextLGrupo(i: number): string  { return this.btnPositions()[i]?.nextL ?? '-9999px'; }

  /* ── Shared helpers ── */
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

  private actualizarPosBtnGrupo(i: number): void {
    const wrapper = this.groupWrapperRefs.get(i)?.nativeElement;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const positions = [...this.btnPositions()];
    positions[i] = {
      top:   `${rect.top + rect.height / 2}px`,
      prevL: `${rect.left - 22}px`,
      nextL: `${rect.right - 22}px`
    };
    this.btnPositions.set(positions);
  }
}
