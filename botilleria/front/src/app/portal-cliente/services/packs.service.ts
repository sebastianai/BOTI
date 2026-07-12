import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { API_URL, ASSET_BASE_URL } from '../../core/api.config';
import { Producto } from '../models/producto.model';

export interface PackProductoItem {
  producto_id: number;
  cantidad: number;
}

export interface Pack {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  emoji: string;
  color_fondo: string;
  imagen_url: string | null;
  activo: boolean;
  orden: number;
  creado_en: string;
  producto_ids: PackProductoItem[];
}

export interface PackPortal extends Omit<Pack, 'producto_ids'> {
  productos: (Producto & { cantidad: number })[];
}

@Injectable({ providedIn: 'root' })
export class PacksService {
  private readonly http = inject(HttpClient);

  obtener(): Observable<PackPortal[]> {
    return this.http.get<PackPortal[]>(`${API_URL}/packs`).pipe(catchError(() => of([])));
  }

  obtenerTodos(): Observable<Pack[]> {
    return this.http.get<Pack[]>(`${API_URL}/packs/todos`);
  }

  crear(data: Partial<Pack>): Observable<Pack> {
    return this.http.post<Pack>(`${API_URL}/packs`, data);
  }

  actualizar(id: number, data: Partial<Pack>): Observable<Pack> {
    return this.http.put<Pack>(`${API_URL}/packs/${id}`, data);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/packs/${id}`);
  }

  obtenerUno(id: number): Observable<PackPortal> {
    return this.http.get<PackPortal>(`${API_URL}/packs/${id}`);
  }

  subirImagen(id: number, file: File): Observable<Pack> {
    const fd = new FormData();
    fd.append('imagen', file);
    return this.http.post<Pack>(`${API_URL}/packs/${id}/imagen`, fd);
  }

  imagenUrl(url: string | null): string {
    if (!url) return '';
    return `${ASSET_BASE_URL}${url}`;
  }
}
