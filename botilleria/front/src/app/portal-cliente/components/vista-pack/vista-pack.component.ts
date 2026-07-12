import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { PacksService, PackPortal } from '../../services/packs.service';
import { CarritoService } from '../../services/carrito.service';
import { Producto } from '../../models/producto.model';
import { urlImagenProducto } from '../../../core/imagen.util';

@Component({
  selector: 'app-vista-pack',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './vista-pack.component.html',
  styleUrl: './vista-pack.component.scss'
})
export class VistaPackComponent {
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly packsService = inject(PacksService);
  private readonly carritoService = inject(CarritoService);
  private readonly router = inject(Router);

  protected readonly pack = signal<PackPortal | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly cantidad = signal(1);
  protected readonly agregado = signal(false);

  private readonly packId = toSignal(
    this.activatedRoute.paramMap.pipe(map(p => Number(p.get('id')))),
    { initialValue: 0 }
  );

  constructor() {
    effect(() => {
      const id = this.packId();
      if (id > 0) {
        window.scrollTo(0, 0);
        this.cargando.set(true);
        this.packsService.obtenerUno(id).subscribe({
          next: (p) => { this.pack.set(p); this.cargando.set(false); },
          error: () => { this.error.set('No pudimos cargar el pack'); this.cargando.set(false); }
        });
      }
    }, { allowSignalWrites: true });
  }

  protected incrementar(): void { this.cantidad.update(q => q + 1); }
  protected decrementar(): void { if (this.cantidad() > 1) this.cantidad.update(q => q - 1); }

  protected agregarAlCarrito(): void {
    const p = this.pack();
    if (!p) return;
    const prod = this.packComoProducto(p);
    this.carritoService.agregar(prod);
    if (this.cantidad() > 1) this.carritoService.actualizarCantidad(prod.id, this.cantidad());
    this.agregado.set(true);
    setTimeout(() => this.agregado.set(false), 1500);
  }

  protected volver(): void { this.router.navigate(['/portal-cliente']); }

  protected formatearPrecio(p: number): string { return '$' + p.toLocaleString('es-CL'); }
  protected urlImagen(ruta: string | undefined): string { return urlImagenProducto(ruta); }
  protected imagenPack(url: string | null): string { return this.packsService.imagenUrl(url); }

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
