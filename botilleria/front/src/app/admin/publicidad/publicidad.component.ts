import { Component, inject, signal, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { PublicidadService, ItemPublicidad } from '../../portal-cliente/services/publicidad.service';

@Component({
  selector: 'app-publicidad',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './publicidad.component.html',
  styleUrl: './publicidad.component.scss'
})
export class PublicidadComponent implements OnInit {
  private readonly publicidadService = inject(PublicidadService);
  private readonly fb = inject(FormBuilder);

  protected readonly items = signal<ItemPublicidad[]>([]);
  protected readonly cargando = signal(true);
  protected readonly modalAbierto = signal(false);
  protected readonly idEditando = signal<number | null>(null);
  protected readonly guardando = signal(false);
  protected readonly subiendoImagen = signal<number | null>(null);
  protected readonly errorMsg = signal('');
  protected readonly arrastrando = signal<number | null>(null);
  protected readonly imagenSeleccionada = signal<File | null>(null);
  protected readonly previewImagen = signal<string | null>(null);

  protected readonly form = this.fb.group({
    titulo:      [''],
    descripcion: [''],
    enlace:      [''],
    orden:       [0],
    activo:      [true],
    formato:     ['escritorio'],
  });

  ngOnInit(): void { this.cargar(); }

  private cargar(): void {
    this.cargando.set(true);
    this.publicidadService.obtenerTodos().subscribe({
      next: data => { this.items.set(data); this.cargando.set(false); },
      error: () => this.cargando.set(false)
    });
  }

  protected abrirNuevo(): void {
    this.idEditando.set(null);
    this.imagenSeleccionada.set(null);
    this.previewImagen.set(null);
    this.form.reset({ titulo: '', descripcion: '', enlace: '', orden: this.items().length, activo: true, formato: 'escritorio' });
    this.modalAbierto.set(true);
  }

  protected abrirEditar(item: ItemPublicidad): void {
    this.idEditando.set(item.id);
    this.imagenSeleccionada.set(null);
    this.previewImagen.set(null);
    this.form.patchValue({ titulo: item.titulo ?? '', descripcion: item.descripcion ?? '', enlace: item.enlace ?? '', orden: item.orden, activo: item.activo, formato: item.formato ?? 'escritorio' });
    this.modalAbierto.set(true);
  }

  protected cerrar(): void { if (!this.guardando()) { this.modalAbierto.set(false); this.errorMsg.set(''); this.imagenSeleccionada.set(null); this.previewImagen.set(null); } }

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
    const op = id
      ? this.publicidadService.actualizar(id, this.form.value as Partial<ItemPublicidad>)
      : this.publicidadService.crear(this.form.value as Partial<ItemPublicidad>);

    op.subscribe({
      next: (item: ItemPublicidad) => {
        // Si hay imagen seleccionada, subirla
        if (this.imagenSeleccionada()) {
          this.publicidadService.subirImagen(item.id, this.imagenSeleccionada()!).subscribe({
            next: () => {
              this.guardando.set(false);
              this.modalAbierto.set(false);
              this.imagenSeleccionada.set(null);
              this.previewImagen.set(null);
              this.cargar();
            },
            error: () => {
              this.guardando.set(false);
              this.errorMsg.set('Publicidad guardada, pero no se pudo subir la imagen');
              setTimeout(() => this.modalAbierto.set(false), 2000);
            }
          });
        } else {
          this.guardando.set(false);
          this.modalAbierto.set(false);
          this.imagenSeleccionada.set(null);
          this.previewImagen.set(null);
          this.cargar();
        }
      },
      error: err => { this.guardando.set(false); this.errorMsg.set(err?.error?.error || 'Error al guardar'); }
    });
  }

  protected eliminar(item: ItemPublicidad): void {
    if (!confirm(`¿Eliminar "${item.titulo ?? 'este banner'}"?`)) return;
    this.publicidadService.eliminar(item.id).subscribe({ next: () => this.cargar() });
  }

  protected toggleActivo(item: ItemPublicidad): void {
    this.publicidadService.actualizar(item.id, { activo: !item.activo }).subscribe({
      next: updated => this.items.update(list => list.map(i => i.id === updated.id ? updated : i))
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
    this.publicidadService.subirImagen(id, file).subscribe({
      next: updated => { this.subiendoImagen.set(null); this.items.update(list => list.map(i => i.id === updated.id ? updated : i)); },
      error: () => { this.subiendoImagen.set(null); this.errorMsg.set('No se pudo subir la imagen'); }
    });
  }

  protected imagenUrl(url: string | null): string { return this.publicidadService.imagenUrl(url); }
}
