import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { forkJoin } from 'rxjs';
import {
  ReactiveFormsModule,
  FormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors
} from '@angular/forms';
import {
  ProductosService,
  ResultadoImportacion,
  DetalleImportacion
} from '../../portal-cliente/services/productos.service';
import { CategoriasService, Categoria } from '../../portal-cliente/services/categorias.service';
import { Producto } from '../../portal-cliente/models/producto.model';
import { urlImagenProducto } from '../../core/imagen.util';
import { VasosLoadingComponent } from '../../portal-cliente/components/vasos-loading/vasos-loading.component';

function soloNumeros(control: AbstractControl): ValidationErrors | null {
  const valor = control.value;
  if (valor === null || valor === undefined || valor === '') {
    return null;
  }
  return /^-?\d+(\.\d+)?$/.test(String(valor).trim()) ? null : { numeroInvalido: true };
}

type StockBucket = 'con' | 'bajo' | 'sin';

@Component({
  selector: 'app-ajuste-manual-productos',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, VasosLoadingComponent],
  templateUrl: './ajuste-manual-productos.component.html',
  styleUrl: './ajuste-manual-productos.component.scss'
})
export class AjusteManualProductosComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly productosService = inject(ProductosService);
  private readonly categoriasService = inject(CategoriasService);

  protected readonly productos = signal<Producto[]>([]);
  protected readonly categorias = signal<Categoria[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly guardando = signal(false);
  protected readonly formAbierto = signal(false);
  protected readonly idEditando = signal<number | null>(null);

  protected readonly importAbierto = signal(false);
  protected readonly arrastrando = signal(false);
  protected readonly importando = signal(false);
  protected readonly resultadoImport = signal<ResultadoImportacion | null>(null);
  protected readonly pendientesPrecio = signal<DetalleImportacion[]>([]);
  protected readonly filasResolviendo = signal<Set<number>>(new Set());

  protected readonly detalleAplicado = computed(() =>
    this.resultadoImport()?.detalle.filter(d => d.accion !== 'pendiente') ?? []
  );

  protected readonly seleccionados = signal<Set<number>>(new Set());
  protected readonly confirmarEliminacionAbierto = signal(false);
  protected readonly eliminandoSeleccionados = signal(false);

  // ─── Buscador y filtros ────────────────────────────────────────────────
  protected readonly busqueda = signal('');
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

  protected readonly productosFiltrados = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    const fMarcas = this.filtroMarcas();
    const fTipos = this.filtroTipos();
    const fStock = this.filtroStock();

    return this.productos().filter(p => {
      if (q && !p.nombre.toLowerCase().includes(q) && !p.marca.toLowerCase().includes(q)) return false;
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

  protected readonly form: FormGroup = this.fb.group({
    nombre: ['', Validators.required],
    marca: ['', Validators.required],
    categoria: ['', Validators.required],
    precio: [0, [Validators.required, soloNumeros, Validators.min(0)]],
    precioOriginal: [null as number | null, [soloNumeros, Validators.min(0)]],
    grados: [0, [Validators.required, soloNumeros, Validators.min(0)]],
    volumen: ['', Validators.required],
    stock: [0, [Validators.required, soloNumeros, Validators.min(0)]],
    emoji: ['🍷', Validators.required],
    colorFondo: ['linear-gradient(135deg, #4a1040 0%, #8B1A1A 100%)', Validators.required],
    descripcion: ['', Validators.required],
    topVentas: [false],
    promocion: [null as string | null]
  });

  protected errorDeCampo(campo: string): string {
    const control = this.form.get(campo);
    if (!control || !control.touched || control.valid) {
      return '';
    }
    if (control.hasError('required')) return 'Este campo es obligatorio';
    if (control.hasError('numeroInvalido')) return 'Solo se permiten números';
    if (control.hasError('min')) return 'El valor no puede ser negativo';
    return 'Valor inválido';
  }

  ngOnInit(): void {
    this.categoriasService.obtenerCategorias().subscribe({
      next: cats => this.categorias.set(cats)
    });
    this.cargarProductos();
  }

  protected cargarProductos(): void {
    this.cargando.set(true);
    this.error.set('');
    this.productosService.obtenerProductos('Todos', '').subscribe({
      next: productos => {
        this.productos.set(productos);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No pudimos conectar con el servidor. Verifica que el backend esté corriendo.');
        this.cargando.set(false);
      }
    });
  }

  protected abrirFormularioNuevo(): void {
    this.idEditando.set(null);
    this.form.reset({
      nombre: '',
      marca: '',
      categoria: '',
      precio: 0,
      precioOriginal: null,
      grados: 0,
      volumen: '',
      stock: 0,
      emoji: '🍷',
      colorFondo: 'linear-gradient(135deg, #4a1040 0%, #8B1A1A 100%)',
      descripcion: '',
      topVentas: false,
      promocion: null
    });
    this.formAbierto.set(true);
  }

  protected abrirFormularioEditar(producto: Producto): void {
    this.idEditando.set(producto.id);
    this.form.reset({
      nombre: producto.nombre,
      marca: producto.marca,
      categoria: producto.categoria,
      precio: producto.precio,
      precioOriginal: producto.precioOriginal ?? null,
      grados: producto.grados,
      volumen: producto.volumen,
      stock: producto.stock,
      emoji: producto.emoji,
      colorFondo: producto.colorFondo,
      descripcion: producto.descripcion,
      topVentas: producto.topVentas ?? false,
      promocion: producto.promocion ?? null
    });
    this.formAbierto.set(true);
  }

  protected cerrarFormulario(): void {
    this.formAbierto.set(false);
    this.idEditando.set(null);
  }

  protected guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.value;
    const payload: Omit<Producto, 'id'> = {
      nombre: v.nombre,
      marca: v.marca,
      categoria: v.categoria,
      precio: Number(v.precio),
      precioOriginal: v.precioOriginal ? Number(v.precioOriginal) : undefined,
      grados: Number(v.grados),
      volumen: v.volumen,
      stock: Number(v.stock),
      emoji: v.emoji,
      colorFondo: v.colorFondo,
      descripcion: v.descripcion,
      topVentas: !!v.topVentas,
      promocion: v.promocion ?? null
    };

    this.guardando.set(true);
    const id = this.idEditando();
    const peticion = id
      ? this.productosService.actualizarProducto(id, payload)
      : this.productosService.crearProducto(payload);

    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.cerrarFormulario();
        this.cargarProductos();
      },
      error: (err) => {
        this.guardando.set(false);
        this.error.set(err?.error?.error || 'No se pudo guardar el producto');
      }
    });
  }

  protected estaSeleccionado(id: number): boolean {
    return this.seleccionados().has(id);
  }

  protected toggleSeleccion(id: number): void {
    this.seleccionados.update(set => {
      const next = new Set(set);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  protected abrirConfirmarEliminacion(): void {
    if (this.seleccionados().size === 0) {
      return;
    }
    this.error.set('');
    this.confirmarEliminacionAbierto.set(true);
  }

  protected cerrarConfirmarEliminacion(): void {
    if (this.eliminandoSeleccionados()) {
      return;
    }
    this.confirmarEliminacionAbierto.set(false);
  }

  protected confirmarEliminacionMultiple(): void {
    const ids = [...this.seleccionados()];
    if (ids.length === 0) {
      return;
    }

    this.eliminandoSeleccionados.set(true);
    forkJoin(ids.map(id => this.productosService.eliminarProducto(id))).subscribe({
      next: () => {
        this.eliminandoSeleccionados.set(false);
        this.confirmarEliminacionAbierto.set(false);
        this.seleccionados.set(new Set());
        this.cargarProductos();
      },
      error: () => {
        this.eliminandoSeleccionados.set(false);
        this.confirmarEliminacionAbierto.set(false);
        this.error.set('No se pudieron eliminar algunos productos');
        this.seleccionados.set(new Set());
        this.cargarProductos();
      }
    });
  }

  protected formatearPrecio(precio: number): string {
    return '$' + precio.toLocaleString('es-CL');
  }

  protected toggleTopVentas(producto: Producto): void {
    const payload: Omit<Producto, 'id'> = {
      nombre: producto.nombre, marca: producto.marca, categoria: producto.categoria,
      precio: producto.precio, precioOriginal: producto.precioOriginal,
      grados: producto.grados, volumen: producto.volumen, stock: producto.stock,
      emoji: producto.emoji, colorFondo: producto.colorFondo, descripcion: producto.descripcion,
      imagen: producto.imagen, topVentas: !producto.topVentas
    };
    this.productosService.actualizarProducto(producto.id, payload).subscribe({
      next: actualizado => this.productos.update(list => list.map(p => p.id === actualizado.id ? actualizado : p))
    });
  }

  protected abrirImportador(): void {
    this.resultadoImport.set(null);
    this.error.set('');
    this.importAbierto.set(true);
  }

  protected cerrarImportador(): void {
    this.importAbierto.set(false);
    this.arrastrando.set(false);
    this.pendientesPrecio.set([]);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.arrastrando.set(true);
  }

  protected onDragLeave(): void {
    this.arrastrando.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.arrastrando.set(false);
    const archivo = event.dataTransfer?.files?.[0];
    if (archivo) {
      this.procesarArchivo(archivo);
    }
  }

  protected onSeleccionarArchivo(event: Event): void {
    const archivo = (event.target as HTMLInputElement).files?.[0];
    if (archivo) {
      this.procesarArchivo(archivo);
    }
    (event.target as HTMLInputElement).value = '';
  }

  private procesarArchivo(archivo: File): void {
    const nombreValido = /\.(xlsx|xls)$/i.test(archivo.name);
    if (!nombreValido) {
      this.error.set('El archivo debe ser un Excel (.xlsx o .xls)');
      return;
    }

    this.importando.set(true);
    this.resultadoImport.set(null);
    this.pendientesPrecio.set([]);
    this.error.set('');

    this.productosService.importarExcel(archivo).subscribe({
      next: resultado => {
        this.importando.set(false);
        this.resultadoImport.set(resultado);
        this.pendientesPrecio.set(resultado.detalle.filter(d => d.accion === 'pendiente'));
        this.cargarProductos();
      },
      error: () => {
        this.importando.set(false);
        this.error.set('No se pudo procesar el archivo Excel');
      }
    });
  }

  protected estaResolviendo(fila: number): boolean {
    return this.filasResolviendo().has(fila);
  }

  protected aceptarCambioPendiente(item: DetalleImportacion): void {
    if (!item.payloadPendiente || this.estaResolviendo(item.fila)) {
      return;
    }
    this.filasResolviendo.update(s => new Set([...s, item.fila]));

    this.productosService.actualizarProducto(item.id, item.payloadPendiente).subscribe({
      next: () => {
        this.pendientesPrecio.update(lista => lista.filter(i => i.fila !== item.fila));
        this.filasResolviendo.update(s => {
          const next = new Set(s);
          next.delete(item.fila);
          return next;
        });
        this.cargarProductos();
      },
      error: () => {
        this.filasResolviendo.update(s => {
          const next = new Set(s);
          next.delete(item.fila);
          return next;
        });
        this.error.set(`No se pudo aplicar el cambio de precio de "${item.nombre}"`);
      }
    });
  }

  protected cancelarCambioPendiente(item: DetalleImportacion): void {
    this.pendientesPrecio.update(lista => lista.filter(i => i.fila !== item.fila));
  }

  protected aceptarTodosPendientes(): void {
    for (const item of this.pendientesPrecio()) {
      this.aceptarCambioPendiente(item);
    }
  }

  protected descargarExcel(): void {
    this.productosService.exportarExcel().subscribe({
      next: blob => {
        const url = window.URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = 'productos-botilleria.xlsx';
        enlace.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => this.error.set('No se pudo descargar el archivo')
    });
  }

  protected urlImagenProducto(rutaImagen: string | undefined): string {
    return urlImagenProducto(rutaImagen);
  }
}
