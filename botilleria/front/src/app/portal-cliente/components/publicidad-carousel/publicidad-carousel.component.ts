import { Component, inject, OnDestroy, OnInit, signal, HostListener } from '@angular/core';
import { PublicidadService, ItemPublicidad } from '../../services/publicidad.service';

@Component({
  selector: 'app-publicidad-carousel',
  standalone: true,
  templateUrl: './publicidad-carousel.component.html',
  styleUrl: './publicidad-carousel.component.scss'
})
export class PublicidadCarouselComponent implements OnInit, OnDestroy {
  private readonly publicidadService = inject(PublicidadService);

  protected readonly items = signal<ItemPublicidad[]>([]);
  protected readonly indice = signal(0);
  private timer?: ReturnType<typeof setInterval>;
  private currentFormato: 'escritorio' | 'movil' = 'escritorio';

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
}
