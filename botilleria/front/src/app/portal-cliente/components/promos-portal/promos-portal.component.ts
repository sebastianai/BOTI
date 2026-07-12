import {
  Component, inject, signal, computed,
  ViewChildren, QueryList, ElementRef,
  effect, afterNextRender, DestroyRef
} from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { PromosService, PromoPortal } from '../../services/promos.service';
import { CarritoService } from '../../services/carrito.service';
import { Producto } from '../../models/producto.model';
import { urlImagenProducto } from '../../../core/imagen.util';

interface CarruselState { pos: number; max: number; }
interface BtnPos { top: string; prevL: string; nextL: string; }

const OCULTO: BtnPos = { top: '-9999px', prevL: '-9999px', nextL: '-9999px' };

@Component({
  selector: 'app-promos-portal',
  standalone: true,
  templateUrl: './promos-portal.component.html',
  styleUrl: './promos-portal.component.scss'
})
export class PromosPortalComponent {
  private readonly promosService = inject(PromosService);
  private readonly carritoService = inject(CarritoService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly agregadoIds = signal<Set<number>>(new Set());

  protected readonly promos = toSignal(
    this.promosService.obtener().pipe(catchError(() => of<PromoPortal[]>([]))),
    { initialValue: [] as PromoPortal[] }
  );

  protected scrollStates = signal<CarruselState[]>([]);
  protected btnPositions = signal<BtnPos[]>([]);

  @ViewChildren('carouselWrapper') wrapperRefs!: QueryList<ElementRef<HTMLDivElement>>;
  @ViewChildren('carouselTrack')   trackRefs!: QueryList<ElementRef<HTMLDivElement>>;

  constructor() {
    effect(() => {
      const n = this.promos().length;
      if (n > 0) {
        setTimeout(() => {
          this.scrollStates.set(Array.from({ length: n }, () => ({ pos: 0, max: 9999 })));
          this.btnPositions.set(Array.from({ length: n }, () => ({ ...OCULTO })));
          for (let i = 0; i < n; i++) this.actualizarPosBtn(i);
        }, 100);
      }
    });

    afterNextRender(() => {
      const onUpdate = () => {
        for (let i = 0; i < this.promos().length; i++) this.actualizarPosBtn(i);
      };
      window.addEventListener('scroll', onUpdate, { passive: true });
      window.addEventListener('resize', onUpdate, { passive: true });
      this.destroyRef.onDestroy(() => {
        window.removeEventListener('scroll', onUpdate);
        window.removeEventListener('resize', onUpdate);
      });
    });
  }

  protected onScroll(i: number): void {
    const track = this.trackRefs.get(i)?.nativeElement;
    if (!track) return;
    const states = [...this.scrollStates()];
    states[i] = { pos: track.scrollLeft, max: track.scrollWidth - track.clientWidth };
    this.scrollStates.set(states);
  }

  protected siguiente(i: number): void {
    const track = this.trackRefs.get(i)?.nativeElement;
    if (!track) return;
    const card = track.querySelector<HTMLElement>('.producto-card');
    const step = card ? card.offsetWidth + 20 : 260;
    track.scrollBy({ left: step, behavior: 'smooth' });
  }

  protected anterior(i: number): void {
    const track = this.trackRefs.get(i)?.nativeElement;
    if (!track) return;
    const card = track.querySelector<HTMLElement>('.producto-card');
    const step = card ? card.offsetWidth + 20 : 260;
    track.scrollBy({ left: -step, behavior: 'smooth' });
  }

  protected puedeAnterior(i: number): boolean {
    return (this.scrollStates()[i]?.pos ?? 0) > 4;
  }

  protected puedeSiguiente(i: number): boolean {
    const s = this.scrollStates()[i];
    return s ? s.pos < s.max - 4 : true;
  }

  protected btnTop(i: number):   string { return this.btnPositions()[i]?.top   ?? '-9999px'; }
  protected btnPrevL(i: number): string { return this.btnPositions()[i]?.prevL ?? '-9999px'; }
  protected btnNextL(i: number): string { return this.btnPositions()[i]?.nextL ?? '-9999px'; }

  protected agregar(p: Producto): void {
    this.carritoService.agregar(p);
    this.agregadoIds.update(s => new Set([...s, p.id]));
    setTimeout(() => this.agregadoIds.update(s => { const n = new Set(s); n.delete(p.id); return n; }), 1200);
  }

  protected onProductoClick(producto: Producto): void {
    this.router.navigate(['/portal-cliente/producto', producto.id]);
  }

  protected estaAgregado(id: number): boolean { return this.agregadoIds().has(id); }
  protected formatearPrecio(p: number): string { return '$' + p.toLocaleString('es-CL'); }
  protected urlImagen(ruta: string | undefined): string { return urlImagenProducto(ruta); }

  protected tipoLabel(tipo: string): string {
    const labels: Record<string, string> = {
      '2x1': '2×1', '3x2': '3×2', 'descuento': 'DESCUENTO', 'general': 'PROMO',
    };
    return labels[tipo] ?? tipo.toUpperCase();
  }

  private actualizarPosBtn(i: number): void {
    const wrapper = this.wrapperRefs.get(i)?.nativeElement;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const positions = [...this.btnPositions()];
    positions[i] = {
      top:   `${rect.top + rect.height / 2}px`,
      prevL: `${rect.left - 22}px`,
      nextL: `${rect.right - 22}px`,
    };
    this.btnPositions.set(positions);
  }
}
