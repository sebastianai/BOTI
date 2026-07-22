import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { API_URL } from '../../core/api.config';

export interface Sucursal {
  id: number;
  nombre: string;
  direccion: string;
  principal: boolean;
  activa: boolean;
  orden: number;
  creado_en: string;
  total_pedidos?: number;
}

@Injectable({ providedIn: 'root' })
export class SucursalesService {
  private readonly http = inject(HttpClient);

  obtenerTodas(): Observable<Sucursal[]> {
    return this.http.get<Sucursal[]>(`${API_URL}/sucursales`).pipe(catchError(() => of([])));
  }

  // ─── Admin ──────────────────────────────────────────────────────────────
  obtenerTodasAdmin(): Observable<Sucursal[]> {
    return this.http.get<Sucursal[]>(`${API_URL}/sucursales/todas`);
  }

  crear(data: Partial<Sucursal>): Observable<Sucursal> {
    return this.http.post<Sucursal>(`${API_URL}/sucursales`, data);
  }

  actualizar(id: number, data: Partial<Sucursal>): Observable<Sucursal> {
    return this.http.put<Sucursal>(`${API_URL}/sucursales/${id}`, data);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/sucursales/${id}`);
  }
}
