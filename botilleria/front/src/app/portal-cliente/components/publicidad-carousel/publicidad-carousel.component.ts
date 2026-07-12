import {
  Component, inject, OnDestroy, OnInit, signal,
  HostListener, ViewChild, ElementRef, afterNextRender, DestroyRef
} from '@angular/core';
import { PublicidadService, ItemPublicidad } from '../../services/publicidad.service';

@Component({
  selector: 'app-publicidad-carousel',
  standalone: true,
  templateUrl: './publicidad-carousel.component.html',
  styleUrl: './publicidad-carousel.component.scss'
})
export class PublicidadCarouselComponent implements OnInit, OnDestroy {
  private readonly publicidadService = inject(PublicidadService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly items   = signal<ItemPublicidad[]>([]);
  protected readonly indice  = signal(0);
  protected readonly btnTop   = signal('-9999px');
  protected readonly btnPrevL = signal('-9999px');
  protected readonly btnNextL = signal('-9999px');

  private timer?: ReturnType<typeof setInterval>;
  private currentFormato: 'escritorio' | 'movil' = 'escritorio';

  @ViewChild('carousel') carouselRef!: ElementRef<HTMLDivElement>;

  constructor() {
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

  ngOnInit(): void {
    this.cargarPorFormato();
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  @HostListener('window:resize')
  onResize(): void {
    const nuevo = this.getFormato();
    if (nuevo !== this.currentFormato) {
      this.currentFormato = nuevo;
      this.cargarPorFormato();
    }
  }

  private getFormato(): 'escritorio' | 'movil' {
    return window.innerWidth >= 768 ? 'escritorio' : 'movil';
  }

  private cargarPorFormato(): void {
    this.currentFormato = this.getFormato();
    clearInterval(this.timer);
    this.publicidadService.obtener(this.currentFormato).subscribe(data => {
      this.items.set(data);
      this.indice.set(0);
      if (data.length > 1) this.iniciarAuto();
      setTimeout(() => this.actualizarPosBtn(), 100);
    });
  }

  private iniciarAuto(): void {
    this.timer = setInterval(() => {
      this.indice.update(i => (i + 1) % this.items().length);
    }, 4500);
  }

  protected irA(i: number): void {
    this.indice.set(i);
    clearInterval(this.timer);
    if (this.items().length > 1) this.iniciarAuto();
  }

  protected anterior(): void { this.irA((this.indice() - 1 + this.items().length) % this.items().length); }
  protected siguiente(): void { this.irA((this.indice() + 1) % this.items().length); }

  protected imagenUrl(url: string | null): string {
    return this.publicidadService.imagenUrl(url);
  }

  private actualizarPosBtn(): void {
    const el = this.carouselRef?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    this.btnTop.set(`${rect.top + rect.height / 2}px`);
    this.btnPrevL.set(`${rect.left + 4}px`);
    this.btnNextL.set(`${rect.right - 42}px`);
  }
}
