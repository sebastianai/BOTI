import {
  Component, inject, signal, computed,
  ViewChild, ElementRef, effect, afterNextRender, DestroyRef
} from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { PacksService, PackPortal } from '../../services/packs.service';
import { CarritoService } from '../../services/carrito.service';
import { Producto } from '../../models/producto.model';

@Component({
  selector: 'app-packs-portal',
  standalone: true,
  templateUrl: './packs-portal.component.html',
  styleUrl: './packs-portal.component.scss'
})
export class PacksPortalComponent {
  private readonly packsService = inject(PacksService);
  private readonly carritoService = inject(CarritoService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly agregadoIds = signal<Set<number>>(new Set());

  protected readonly packs = toSignal(
    this.packsService.obtener().pipe(catchError(() => of<PackPortal[]>([]))),
    { initialValue: [] as PackPortal[] }
  );

  private readonly scrollPos = signal(0);
  private readonly scrollMax = signal(9999);

  protected readonly puedeAnterior = computed(() => this.scrollPos() > 4);
  protected readonly puedeSiguiente = computed(() => this.scrollPos() < this.scrollMax() - 4);

  /* Posición fija de los botones (viewport-relative) */
  protected readonly btnTop   = signal('-9999px');
  protected readonly btnPrevL = signal('-9999px');
  protected readonly btnNextL = signal('-9999px');

  @ViewChild('wrapper') wrapperRef!: ElementRef<HTMLDivElement>;
  @ViewChild('track')   trackRef!: ElementRef<HTMLDivElement>;

  constructor() {
    /* Actualizar scroll bounds cuando los packs cargan */
    effect(() => {
      if (this.packs().length > 0) {
        setTimeout(() => {
          this.actualizarBounds();
          this.actualizarPosBtn();
        }, 100);
      }
    });

    /* Escuchar scroll y resize de la ventana */
    afterNextRender(() => {
      const onUpdate = () => this.actualizarPosBtn();
      window.addEventListener('scroll', onUpdate, { passive: true });
      window.addEventListener('resize', onUpdate, { passive: true });
      this.destroyRef.onDestroy(() => {
        window.removeEventListener('scroll', onUpdate);
        window.removeEventListener('resize', onUpdate);
      });
    });
  }

  protected onScroll(): void {
    this.actualizarBounds();
  }

  protected siguiente(): void {
    const el = this.trackRef.nativeElement;
    const card = el.querySelector<HTMLElement>('.producto-card');
    const step = card ? card.offsetWidth + 20 : 260;
    el.scrollBy({ left: step, behavior: 'smooth' });
  }

  protected anterior(): void {
    const el = this.trackRef.nativeElement;
    const card = el.querySelector<HTMLElement>('.producto-card');
    const step = card ? card.offsetWidth + 20 : 260;
    el.scrollBy({ left: -step, behavior: 'smooth' });
  }

  protected agregar(pack: PackPortal): void {
    const prod = this.packComoProducto(pack);
    this.carritoService.agregar(prod);
    this.agregadoIds.update(s => new Set([...s, pack.id]));
    setTimeout(() => this.agregadoIds.update(s => { const n = new Set(s); n.delete(pack.id); return n; }), 1200);
  }

  protected onPackClick(pack: PackPortal): void {
    this.router.navigate(['/portal-cliente/pack', pack.id]);
  }

  protected estaAgregado(id: number): boolean { return this.agregadoIds().has(id); }
  protected formatearPrecio(p: number): string { return '$' + p.toLocaleString('es-CL'); }
  protected imagenUrl(url: string | null): string { return this.packsService.imagenUrl(url); }

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
    this.btnTop.set(`${rect.top + 242}px`);
    this.btnPrevL.set(`${rect.left - 22}px`);
    this.btnNextL.set(`${rect.right - 22}px`);
  }

  private packComoProducto(pack: PackPortal): Producto {
    return {
      id: pack.id,
      nombre: pack.nombre,
      marca: 'Pack',
      precio: pack.precio,
      categoria: 'Pack',
      descripcion: pack.descripcion ?? '',
      grados: 0,
      volumen: '',
      emoji: pack.emoji,
      colorFondo: pack.color_fondo,
      stock: 99,
      imagen: pack.imagen_url ?? undefined,
    };
  }
}
