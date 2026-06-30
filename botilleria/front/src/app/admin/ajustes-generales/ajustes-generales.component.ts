import { Component, inject, signal, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { PortalConfigService, DisenoPortal } from '../../core/portal-config.service';
import { API_URL } from '../../core/api.config';

@Component({
  selector: 'app-ajustes-generales',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './ajustes-generales.component.html',
  styleUrl: './ajustes-generales.component.scss'
})
export class AjustesGeneralesComponent implements OnInit {
  private readonly http = inject(HttpClient);
  protected readonly portalConfig = inject(PortalConfigService);
  private readonly fb = inject(FormBuilder);

  protected readonly guardando = signal(false);
  protected readonly subiendoLogo = signal(false);
  protected readonly mensajeExito = signal('');
  protected readonly errorMsg = signal('');
  protected readonly arrastrando = signal(false);
  protected readonly logoPreview = signal<string | null>(null);

  protected readonly form = this.fb.group({
    nombre_negocio: ['', Validators.required],
    tagline:        ['', Validators.required],
    descripcion:    [''],
    telefono:       [''],
    email:          [''],
    direccion:      [''],
    color_primario: [''],
    color_acento:   [''],
    mapa_url:       [''],
  });

  ngOnInit(): void {
    const cfg = this.portalConfig.config();
    this.form.patchValue({
      nombre_negocio: cfg.nombre_negocio,
      tagline:        cfg.tagline,
      descripcion:    cfg.descripcion ?? '',
      telefono:       cfg.telefono ?? '',
      email:          cfg.email ?? '',
      direccion:      cfg.direccion ?? '',
      color_primario: cfg.color_primario,
      color_acento:   cfg.color_acento,
      mapa_url:       cfg.mapa_url ?? '',
    });
  }

  protected guardar(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.guardando.set(true);
    this.mensajeExito.set('');
    this.errorMsg.set('');
    this.http.put<DisenoPortal>(`${API_URL}/portal-config`, this.form.value).subscribe({
      next: cfg => {
        this.guardando.set(false);
        this.mensajeExito.set('¡Cambios guardados correctamente!');
        this.portalConfig.actualizarConfig(cfg);
        setTimeout(() => this.mensajeExito.set(''), 3000);
      },
      error: err => {
        this.guardando.set(false);
        this.errorMsg.set(err?.error?.error || 'No se pudo guardar');
      }
    });
  }

  protected onDragOver(e: DragEvent): void { e.preventDefault(); this.arrastrando.set(true); }
  protected onDragLeave(): void { this.arrastrando.set(false); }
  protected onDrop(e: DragEvent): void {
    e.preventDefault(); this.arrastrando.set(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) this.subirLogo(file);
  }
  protected onSeleccionarLogo(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.subirLogo(file);
    (e.target as HTMLInputElement).value = '';
  }

  private subirLogo(file: File): void {
    const reader = new FileReader();
    reader.onload = () => this.logoPreview.set(reader.result as string);
    reader.readAsDataURL(file);

    const fd = new FormData();
    fd.append('logo', file);
    this.subiendoLogo.set(true);
    this.errorMsg.set('');
    this.http.post<DisenoPortal>(`${API_URL}/portal-config/logo`, fd).subscribe({
      next: cfg => {
        this.subiendoLogo.set(false);
        this.mensajeExito.set('¡Logo actualizado!');
        this.portalConfig.actualizarConfig(cfg);
        setTimeout(() => this.mensajeExito.set(''), 3000);
      },
      error: err => {
        this.subiendoLogo.set(false);
        this.logoPreview.set(null);
        this.errorMsg.set(err?.error?.error || 'No se pudo subir el logo');
      }
    });
  }
}
