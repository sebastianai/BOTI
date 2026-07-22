import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { PacksService, Pack, PackProductoItem } from '../../portal-cliente/services/packs.service';
import { API_URL } from '../../core/api.config';

interface ProductoSimple {
  id: number;
  nombre: string;
  marca: string;
  categoria: string;
  precio: number;
  stock: number;
}

type StockBucket = 'con' | 'bajo' | 'sin';
type EstadoPack = 'activo' | 'inactivo';

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

  // ─── Búsqueda y filtro de la lista de packs ───────────────────────────
  protected readonly busquedaPacks = signal('');
  protected readonly filtroPanelPacksAbierto = signal(false);
  protected readonly filtroEstados = signal<Set<EstadoPack>>(new Set());

  protected readonly estadosPack: { valor: EstadoPack; label: string }[] = [
    { valor: 'activo', label: 'Activo' },
    { valor: 'inactivo', label: 'Inactivo' },
  ];

  protected readonly packsFiltrados = computed(() => {
    const q = this.busquedaPacks().toLowerCase().trim();
    const fEstados = this.filtroEstados();

    return this.packs().filter(p => {
      if (q && !p.nombre.toLowerCase().includes(q) && !(p.descripcion ?? '').toLowerCase().includes(q)) return false;
      if (fEstados.size > 0) {
        const estado: EstadoPack = p.activo ? 'activo' : 'inactivo';
        if (!fEstados.has(estado)) return false;
      }
      return true;
    });
  });

  protected readonly filtrosPacksActivos = computed(() => this.filtroEstados().size);

  protected toggleFiltroPanelPacks(): void {
    this.filtroPanelPacksAbierto.update(v => !v);
  }

  protected toggleFiltroEstado(estado: EstadoPack): void {
    this.filtroEstados.update(set => {
      const next = new Set(set);
      if (next.has(estado)) next.delete(estado); else next.add(estado);
      return next;
    });
  }

  protected limpiarFiltrosPacks(): void {
    this.filtroEstados.set(new Set());
  }
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

  // ─── Filtros del picker de productos ──────────────────────────────────
  protected readonly filtroPanelAbierto = signal(false);
  protected readonly filtroMarcas = signal<Set<string>>(new Set());
  protected readonly filtroTipos = signal<Set<string>>(new Set());
  protected readonly filtroStock = signal<Set<StockBucket>>(new Set());

  protected readonly stockBuckets: { valor: StockBucket; label: string }[] = [
    { valor: 'con', label: 'Con stock' },
    { valor: 'bajo', label: 'Stock bajo (≤ 10)' },
    { valor: 'sin', label: 'Sin stock' },
  ];

  protected readonly marcasDisponibles = computed(() =>
    [...new Set(this.productos().map(p => p.marca))].sort((a, b) => a.localeCompare(b))
  );
  protected readonly tiposDisponibles = computed(() =>
    [...new Set(this.productos().map(p => p.categoria))].sort((a, b) => a.localeCompare(b))
  );

  private stockBucketDe(stock: number): StockBucket {
    if (stock <= 0) return 'sin';
    if (stock <= 10) return 'bajo';
    return 'con';
  }

  protected readonly form = this.fb.group({
    nombre:      [''],
    descripcion: [''],
    activo:      [true],
    orden:       [0],
    precio:      [0, [Validators.required, Validators.min(0)]],
  });

  protected readonly productosFiltrados = computed(() => {
    const q = this.busquedaProducto().toLowerCase().trim();
    const fMarcas = this.filtroMarcas();
    const fTipos = this.filtroTipos();
    const fStock = this.filtroStock();

    return this.productos().filter(p => {
      if (q && !p.nombre.toLowerCase().includes(q) && !p.categoria.toLowerCase().includes(q) && !p.marca.toLowerCase().includes(q)) return false;
      if (fMarcas.size > 0 && !fMarcas.has(p.marca)) return false;
      if (fTipos.size > 0 && !fTipos.has(p.categoria)) return false;
      if (fStock.size > 0 && !fStock.has(this.stockBucketDe(p.stock))) return false;
      return true;
    });
  });

  protected readonly filtrosActivos = computed(() =>
    this.filtroMarcas().size + this.filtroTipos().size + this.filtroStock().size
  );

  protected toggleFiltroPanel(): void {
    this.filtroPanelAbierto.update(v => !v);
  }

  private toggleEnSet<T>(sig: ReturnType<typeof signal<Set<T>>>, valor: T): void {
    sig.update(set => {
      const next = new Set(set);
      if (next.has(valor)) next.delete(valor); else next.add(valor);
      return next;
    });
  }

  protected toggleFiltroMarca(marca: string): void { this.toggleEnSet(this.filtroMarcas, marca); }
  protected toggleFiltroTipo(tipo: string): void { this.toggleEnSet(this.filtroTipos, tipo); }
  protected toggleFiltroStock(bucket: StockBucket): void { this.toggleEnSet(this.filtroStock, bucket); }

  protected limpiarFiltros(): void {
    this.filtroMarcas.set(new Set());
    this.filtroTipos.set(new Set());
    this.filtroStock.set(new Set());
  }

  // ─── Resumen de precios ────────────────────────────────────────────────
  protected readonly detalleSeleccionados = computed(() => {
    const mapaProductos = new Map(this.productos().map(p => [p.id, p]));
    return Array.from(this.seleccionados())
      .map(id => {
        const producto = mapaProductos.get(id);
        const cantidad = this.cantidades().get(id) ?? 1;
        if (!producto) return null;
        return { producto, cantidad, subtotal: producto.precio * cantidad };
      })
      .filter((d): d is { producto: ProductoSimple; cantidad: number; subtotal: number } => d !== null)
      .sort((a, b) => a.producto.nombre.localeCompare(b.producto.nombre));
  });

  protected readonly sumaProductos = computed(() =>
    this.detalleSeleccionados().reduce((acc, d) => acc + d.subtotal, 0)
  );

  protected formatearPrecio(precio: number): string {
    return '$' + Math.round(precio).toLocaleString('es-CL');
  }

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
    this.limpiarFiltros();
    this.filtroPanelAbierto.set(false);
    this.imagenSeleccionada.set(null);
    this.previewImagen.set(null);
    this.form.reset({ nombre: '', descripcion: '', activo: true, orden: this.packs().length, precio: 0 });
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
    this.limpiarFiltros();
    this.filtroPanelAbierto.set(false);
    this.imagenSeleccionada.set(null);
    this.previewImagen.set(null);
    this.form.patchValue({ nombre: pack.nombre, descripcion: pack.descripcion ?? '', activo: pack.activo, orden: pack.orden, precio: pack.precio });
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
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
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
