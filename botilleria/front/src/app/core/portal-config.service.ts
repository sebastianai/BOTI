import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { API_URL, ASSET_BASE_URL } from './api.config';

export interface DisenoPortal {
  id: number;
  nombre_negocio: string;
  tagline: string;
  logo_url: string | null;
  descripcion: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  color_primario: string;
  color_acento: string;
  mapa_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  nombre_pestana: string;
  actualizado_en: string;
}

const DEFAULT_CONFIG: DisenoPortal = {
  id: 1,
  nombre_negocio: 'Botillería',
  tagline: 'Premium',
  logo_url: null,
  descripcion: null,
  telefono: null,
  email: null,
  direccion: null,
  color_primario: '#1c3829',
  color_acento: '#c9a227',
  mapa_url: null,
  instagram_url: null,
  facebook_url: null,
  nombre_pestana: 'MI BOTI',
  actualizado_en: ''
};

@Injectable({ providedIn: 'root' })
export class PortalConfigService {
  private readonly http = inject(HttpClient);
  private readonly _config = signal<DisenoPortal>(DEFAULT_CONFIG);
  private readonly _cargado = signal(false);

  readonly config = this._config.asReadonly();
  readonly cargado = this._cargado.asReadonly();

  constructor() {
    this.cargar();
  }

  cargar(): void {
    this.http.get<DisenoPortal>(`${API_URL}/portal-config`).pipe(
      catchError(() => of(DEFAULT_CONFIG))
    ).subscribe(cfg => {
      this._config.set(cfg);
      this._cargado.set(true);
    });
  }

  actualizarConfig(cfg: DisenoPortal): void {
    this._config.set(cfg);
  }

  logoUrl(logoPath: string | null): string {
    if (!logoPath) return 'assets/img/logo-4vasos-negro.png';
    return `${ASSET_BASE_URL}${logoPath}`;
  }

  productoImageUrl(imagenPath: string | null | undefined): string {
    if (!imagenPath) return 'assets/img/vacio_producto.png';
    // Si ya contiene la ruta completa, devolverla con la base URL
    if (imagenPath.startsWith('/uploads/')) {
      return `${ASSET_BASE_URL}${imagenPath}`;
    }
    // Si es solo el nombre del archivo, agregar la ruta de productos
    return `${ASSET_BASE_URL}/uploads/productos/${imagenPath}`;
  }
}
