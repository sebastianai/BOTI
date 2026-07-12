import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { PromosService, Promo } from '../../portal-cliente/services/promos.service';
import { API_URL } from '../../core/api.config';

interface ProductoSimple {
  id: number;
  nombre: string;
  marca: string;
  categoria: string;
}

@Component({
  selector: 'app-promos',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule],
  templateUrl: './promos.component.html',
  styleUrl: './promos.component.scss'
})
export class PromosComponent implements OnInit {
  private readonly promosService = inject(PromosService);
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);

  protected readonly promos = signal<Promo[]>([]);
  protected readonly productos = signal<ProductoSimple[]>([]);
  protected readonly cargando = signal(true);
  protected readonly modalAbierto = signal(false);
  protected readonly idEditando = signal<number | null>(null);
  protected readonly guardando = signal(false);
  protected readonly errorMsg = signal('');
  protected readonly seleccionados = signal<Set<number>>(new Set());
  protected readonly busquedaProducto = signal('');

  protected readonly form = this.fb.group({
    nombre:      [''],
    descripcion: [''],
    tipo:        ['general'],
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
    this.promosService.obtenerTodas().subscribe({
      next: data => { this.promos.set(data); this.cargando.set(false); },
      error: () => this.cargando.set(false)
    });
  }

  protected abrirNuevo(): void {
    this.idEditando.set(null);
    this.seleccionados.set(new Set());
    this.busquedaProducto.set('');
    this.form.reset({ nombre: '', descripcion: '', tipo: 'general', activo: true, orden: this.promos().length });
    this.modalAbierto.set(true);
  }

  protected abrirEditar(promo: Promo): void {
    this.idEditando.set(promo.id);
    this.seleccionados.set(new Set(promo.producto_ids));
    this.busquedaProducto.set('');
    this.form.patchValue({
      nombre: promo.nombre,
      descripcion: promo.descripcion ?? '',
      tipo: promo.tipo,
      activo: promo.activo,
      orden: promo.orden
    });
    this.modalAbierto.set(true);
  }

  protected cerrar(): void {
    if (!this.guardando()) {
      this.modalAbierto.set(false);
      this.errorMsg.set('');
    }
  }

  protected toggleProducto(id: number): void {
    const set = new Set(this.seleccionados());
    if (set.has(id)) { set.delete(id); } else { set.add(id); }
    this.seleccionados.set(set);
  }

  protected estaSeleccionado(id: number): boolean {
    return this.seleccionados().has(id);
  }

  protected guardar(): void {
    this.guardando.set(true);
    this.errorMsg.set('');
    const id = this.idEditando();
    const data = {
      ...this.form.value,
      producto_ids: Array.from(this.seleccionados())
    };
    const op = id
      ? this.promosService.actualizar(id, data as Partial<Promo>)
      : this.promosService.crear(data as Partial<Promo>);

    op.subscribe({
      next: () => { this.guardando.set(false); this.modalAbierto.set(false); this.cargar(); },
      error: err => { this.guardando.set(false); this.errorMsg.set(err?.error?.error || 'Error al guardar'); }
    });
  }

  protected eliminar(promo: Promo): void {
    if (!confirm(`¿Eliminar la promoción "${promo.nombre}"?`)) return;
    this.promosService.eliminar(promo.id).subscribe({ next: () => this.cargar() });
  }

  protected toggleActivo(promo: Promo): void {
    this.promosService.actualizar(promo.id, { activo: !promo.activo }).subscribe({
      next: updated => this.promos.update(list => list.map(p => p.id === updated.id ? updated : p))
    });
  }

  protected tipoLabel(tipo: string): string {
    const labels: Record<string, string> = {
      '2x1': '2×1',
      '3x2': '3×2',
      'descuento': 'Descuento',
      'general': 'General'
    };
    return labels[tipo] ?? tipo;
  }
}
