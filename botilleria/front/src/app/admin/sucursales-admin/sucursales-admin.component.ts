import { Component, inject, signal, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SucursalesService, Sucursal } from '../../portal-cliente/services/sucursales.service';

@Component({
  selector: 'app-sucursales-admin',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './sucursales-admin.component.html',
  styleUrl: './sucursales-admin.component.scss'
})
export class SucursalesAdminComponent implements OnInit {
  private readonly sucursalesService = inject(SucursalesService);
  private readonly fb = inject(FormBuilder);

  protected readonly sucursales  = signal<Sucursal[]>([]);
  protected readonly cargando    = signal(true);
  protected readonly modalAbierto = signal(false);
  protected readonly idEditando  = signal<number | null>(null);
  protected readonly guardando   = signal(false);
  protected readonly errorMsg    = signal('');

  protected readonly form = this.fb.group({
    nombre:    ['', Validators.required],
    direccion: ['', Validators.required],
    principal: [false],
    activa:    [true],
    orden:     [0],
  });

  ngOnInit(): void { this.cargar(); }

  private cargar(): void {
    this.cargando.set(true);
    this.sucursalesService.obtenerTodasAdmin().subscribe({
      next: data => { this.sucursales.set(data); this.cargando.set(false); },
      error: () => { this.cargando.set(false); this.errorMsg.set('Error al cargar sucursales'); }
    });
  }

  protected abrirNuevo(): void {
    this.idEditando.set(null);
    this.errorMsg.set('');
    this.form.reset({ nombre: '', direccion: '', principal: false, activa: true, orden: this.sucursales().length });
    this.modalAbierto.set(true);
  }

  protected abrirEditar(s: Sucursal): void {
    this.idEditando.set(s.id);
    this.errorMsg.set('');
    this.form.reset({ nombre: s.nombre, direccion: s.direccion, principal: s.principal, activa: s.activa, orden: s.orden });
    this.modalAbierto.set(true);
  }

  protected cerrar(): void {
    if (!this.guardando()) { this.modalAbierto.set(false); this.errorMsg.set(''); }
  }

  protected guardar(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.guardando.set(true);
    this.errorMsg.set('');
    const id = this.idEditando();
    const data = this.form.value as Partial<Sucursal>;

    const op = id ? this.sucursalesService.actualizar(id, data) : this.sucursalesService.crear(data);
    op.subscribe({
      next: () => { this.guardando.set(false); this.modalAbierto.set(false); this.cargar(); },
      error: err => { this.guardando.set(false); this.errorMsg.set(err?.error?.error || 'Error al guardar la sucursal'); }
    });
  }

  protected eliminar(s: Sucursal): void {
    if (!confirm(`¿Eliminar la sucursal "${s.nombre}"?`)) return;
    this.sucursalesService.eliminar(s.id).subscribe({
      next: () => this.cargar(),
      error: () => this.errorMsg.set('Error al eliminar la sucursal')
    });
  }

  protected toggleActiva(s: Sucursal): void {
    this.sucursalesService.actualizar(s.id, { activa: !s.activa }).subscribe({
      next: updated => this.sucursales.update(list => list.map(x => x.id === updated.id ? updated : x))
    });
  }
}
