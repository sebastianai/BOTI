import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { API_URL } from '../../core/api.config';
import { Producto } from '../models/producto.model';

export interface Promo {
  id: number;
  nombre: string;
  descripcion: string | null;
  tipo: string;
  activo: boolean;
  orden: number;
  creado_en: string;
  producto_ids: number[];
  porcentaje_descuento: number | null;
}

export interface PromoPortal extends Omit<Promo, 'producto_ids'> {
  productos: Producto[];
}

@Injectable({ providedIn: 'root' })
export class PromosService {
  private readonly http = inject(HttpClient);

  obtener(): Observable<PromoPortal[]> {
    return this.http.get<PromoPortal[]>(`${API_URL}/promos`).pipe(catchError(() => of([])));
  }

  obtenerTodas(): Observable<Promo[]> {
    return this.http.get<Promo[]>(`${API_URL}/promos/todas`);
  }

  crear(data: Partial<Promo>): Observable<Promo> {
    return this.http.post<Promo>(`${API_URL}/promos`, data);
  }

  actualizar(id: number, data: Partial<Promo>): Observable<Promo> {
    return this.http.put<Promo>(`${API_URL}/promos/${id}`, data);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/promos/${id}`);
  }
}
