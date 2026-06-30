import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { API_URL, ASSET_BASE_URL } from '../../core/api.config';

export interface ItemPublicidad {
  id: number;
  titulo: string | null;
  descripcion: string | null;
  imagen_url: string | null;
  enlace: string | null;
  orden: number;
  activo: boolean;
  formato: 'escritorio' | 'movil';
  creado_en: string;
}

@Injectable({ providedIn: 'root' })
export class PublicidadService {
  private readonly http = inject(HttpClient);

  obtener(formato?: 'escritorio' | 'movil'): Observable<ItemPublicidad[]> {
    const params = formato ? `?formato=${formato}` : '';
    return this.http.get<ItemPublicidad[]>(`${API_URL}/publicidad${params}`).pipe(
      catchError(() => of([]))
    );
  }

  obtenerTodos(): Observable<ItemPublicidad[]> {
    return this.http.get<ItemPublicidad[]>(`${API_URL}/publicidad/todos`);
  }

  crear(data: Partial<ItemPublicidad>): Observable<ItemPublicidad> {
    return this.http.post<ItemPublicidad>(`${API_URL}/publicidad`, data);
  }

  actualizar(id: number, data: Partial<ItemPublicidad>): Observable<ItemPublicidad> {
    return this.http.put<ItemPublicidad>(`${API_URL}/publicidad/${id}`, data);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/publicidad/${id}`);
  }

  subirImagen(id: number, file: File): Observable<ItemPublicidad> {
    const fd = new FormData();
    fd.append('imagen', file);
    return this.http.post<ItemPublicidad>(`${API_URL}/publicidad/${id}/imagen`, fd);
  }

  imagenUrl(url: string | null): string {
    if (!url) return '';
    return `${ASSET_BASE_URL}${url}`;
  }
}
