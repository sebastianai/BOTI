import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { PacksService, Pack, PackProductoItem } from '../../portal-cliente/services/packs.service';
import { API_URL } from '../../core/api.config';

interface ProductoSimple {
  id: number;
  nombre: string;
  marca: string;
  categoria: string;
}

@Component({
  selector: 'app-packs',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule],
  templateUrl: './packs.component.html',
  styleUrl: './packs.component.scss'
})
export class PacksComponent implements OnInit {
  private readonly packsService = inject(PacksService);
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);

  protected readonly packs = signal<Pack[]>([]);
  protected readonly productos = signal<ProductoSimple[]>([]);
  protected readonly cargando = signal(true);
  protected readonly modalAbierto = signal(false);
  protected readonly idEditando = signal<number | null>(null);
  protected readonly guardando = signal(false);
  protected readonly subiendoImagen = signal<number | null>(null);
  protected readonly errorMsg = signal('');
  protected readonly arrastrando = signal<number | null>(null);
  protected readonly imagenSeleccionada = signal<File | null>(null);
  protected readonly previewImagen = signal<string | null>(null);

  // producto_id → cantidad
  protected readonly cantidades = signal<Map<number, number>>(new Map());
  protected readonly seleccionados = signal<Set<number>>(new Set());
  protected readonly busquedaProducto = signal('');

  protected readonly form = this.fb.group({
    nombre:      [''],
    descripcion: [''],
    activo:      [true],
    orden:       [0],
  });

  protected readonly productosFiltrados = computed(() => {
    const q = this.busquedaProducto().toLowerCase().trim();
    if (!q) return this.productos();
    return this.productos().filter(p =>
      p.nombre.toLowerCase().includes(q) ||
      p.categoria.toLowerCase().includes(q) ||
      p.marca.toLowerCase().includes(q)
    );
  });

  ngOnInit(): void {
    this.cargar();
    this.http.get<ProductoSimple[]>(`${API_URL}/productos`).subscribe({
      next: data => this.productos.set(data)
    });
  }

  private cargar(): void {
    this.cargando.set(true);
    this.packsService.obtenerTodos().subscribe({
      next: data => { this.packs.set(data); this.cargando.set(false); },
      error: () => this.cargando.set(false)
    });
  }

  protected abrirNuevo(): void {
    this.idEditando.set(null);
    this.seleccionados.set(new Set());
    this.cantidades.set(new Map());
    this.busquedaProducto.set('');
    this.imagenSeleccionada.set(null);
    this.previewImagen.set(null);
    this.form.reset({ nombre: '', descripcion: '', activo: true, orden: this.packs().length });
    this.modalAbierto.set(true);
  }

  protected abrirEditar(pack: Pack): void {
    this.idEditando.set(pack.id);
    const sel = new Set<number>();
    const cant = new Map<number, number>();
    for (const item of pack.producto_ids) {
      sel.add(item.producto_id);
      cant.set(item.producto_id, item.cantidad);
    }
    this.seleccionados.set(sel);
    this.cantidades.set(cant);
    this.busquedaProducto.set('');
    this.imagenSeleccionada.set(null);
    this.previewImagen.set(null);
    this.form.patchValue({ nombre: pack.nombre, descripcion: pack.descripcion ?? '', activo: pack.activo, orden: pack.orden });
    this.modalAbierto.set(true);
  }

  protected cerrar(): void {
    if (!this.guardando()) { this.modalAbierto.set(false); this.errorMsg.set(''); }
  }

  protected toggleProducto(id: number): void {
    const sel = new Set(this.seleccionados());
    const cant = new Map(this.cantidades());
    if (sel.has(id)) {
      sel.delete(id);
      cant.delete(id);
    } else {
      sel.add(id);
      cant.set(id, 1);
    }
    this.seleccionados.set(sel);
    this.cantidades.set(cant);
  }

  protected estaSeleccionado(id: number): boolean { return this.seleccionados().has(id); }

  protected getCantidad(id: number): number { return this.cantidades().get(id) ?? 1; }

  protected setCantidad(id: number, val: number): void {
    const cant = new Map(this.cantidades());
    cant.set(id, Math.max(1, val));
    this.cantidades.set(cant);
  }

  protected onSeleccionarImagenModal(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      this.imagenSeleccionada.set(file);
      const reader = new FileReader();
      reader.onload = () => this.previewImagen.set(reader.result as string);
      reader.readAsDataURL(file);
    }
    (e.target as HTMLInputElement).value = '';
  }

  protected guardar(): void {
    this.guardando.set(true);
    this.errorMsg.set('');
    const id = this.idEditando();
    const producto_ids: PackProductoItem[] = Array.from(this.seleccionados()).map(pid => ({
      producto_id: pid,
      cantidad: this.cantidades().get(pid) ?? 1
    }));
    const data = { ...this.form.value, producto_ids };

    const op = id
      ? this.packsService.actualizar(id, data as Partial<Pack>)
      : this.packsService.crear(data as Partial<Pack>);

    op.subscribe({
      next: (pack: Pack) => {
        if (this.imagenSeleccionada()) {
          this.packsService.subirImagen(pack.id, this.imagenSeleccionada()!).subscribe({
            next: () => { this.guardando.set(false); this.modalAbierto.set(false); this.cargar(); },
            error: () => {
              this.guardando.set(false);
              this.errorMsg.set('Pack guardado, pero no se pudo subir la imagen');
              setTimeout(() => { this.modalAbierto.set(false); this.cargar(); }, 2000);
            }
          });
        } else {
          this.guardando.set(false);
          this.modalAbierto.set(false);
          this.cargar();
        }
      },
      error: err => { this.guardando.set(false); this.errorMsg.set(err?.error?.error || 'Error al guardar'); }
    });
  }

  protected eliminar(pack: Pack): void {
    if (!confirm(`¿Eliminar el pack "${pack.nombre}"?`)) return;
    this.packsService.eliminar(pack.id).subscribe({ next: () => this.cargar() });
  }

  protected toggleActivo(pack: Pack): void {
    this.packsService.actualizar(pack.id, { activo: !pack.activo }).subscribe({
      next: updated => this.packs.update(list => list.map(p => p.id === updated.id ? updated : p))
    });
  }

  protected onDragOver(e: DragEvent, id: number): void { e.preventDefault(); this.arrastrando.set(id); }
  protected onDragLeave(): void { this.arrastrando.set(null); }
  protected onDrop(e: DragEvent, id: number): void {
    e.preventDefault(); this.arrastrando.set(null);
    const file = e.dataTransfer?.files?.[0];
    if (file) this.subirImagen(id, file);
  }
  protected onSeleccionarImagen(e: Event, id: number): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.subirImagen(id, file);
    (e.target as HTMLInputElement).value = '';
  }

  private subirImagen(id: number, file: File): void {
    this.subiendoImagen.set(id);
    this.packsService.subirImagen(id, file).subscribe({
      next: updated => { this.subiendoImagen.set(null); this.packs.update(list => list.map(p => p.id === updated.id ? updated : p)); },
      error: () => { this.subiendoImagen.set(null); this.errorMsg.set('No se pudo subir la imagen'); }
    });
  }

  protected imagenUrl(url: string | null): string { return this.packsService.imagenUrl(url); }
}
