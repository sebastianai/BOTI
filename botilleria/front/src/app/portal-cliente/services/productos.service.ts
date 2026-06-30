import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../../core/api.config';
import { Producto } from '../models/producto.model';

export interface ErrorImportacion {
  fila: number;
  mensaje: string;
}

export interface CambioCampo {
  campo: string;
  anterior: unknown;
  nuevo: unknown;
}

export interface AlertaPrecio {
  precioAnterior: number;
  precioNuevo: number;
  porcentaje: number;
}

export interface DetalleImportacion {
  fila: number;
  id: number;
  nombre: string;
  accion: 'creado' | 'actualizado' | 'pendiente';
  cambios: CambioCampo[];
  alertaPrecio?: AlertaPrecio;
  payloadPendiente?: Omit<Producto, 'id'>;
}

export interface ResultadoImportacion {
  creados: number;
  actualizados: number;
  sinCambios: number;
  pendientes: number;
  errores: ErrorImportacion[];
  detalle: DetalleImportacion[];
}

@Injectable({ providedIn: 'root' })
export class ProductosService {
  private readonly http = inject(HttpClient);

  obtenerProductos(categoria: string, busqueda: string, soloTopVentas = false): Observable<Producto[]> {
    let params = new HttpParams();
    if (categoria && categoria !== 'Todos') params = params.set('categoria', categoria);
    if (busqueda) params = params.set('busqueda', busqueda);
    if (soloTopVentas) params = params.set('top_ventas', 'true');
    return this.http.get<Producto[]>(`${API_URL}/productos`, { params });
  }

  crearProducto(producto: Omit<Producto, 'id'>): Observable<Producto> {
    return this.http.post<Producto>(`${API_URL}/productos`, producto);
  }

  actualizarProducto(id: number, producto: Omit<Producto, 'id'>): Observable<Producto> {
    return this.http.put<Producto>(`${API_URL}/productos/${id}`, producto);
  }

  eliminarProducto(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/productos/${id}`);
  }

  exportarExcel(): Observable<Blob> {
    return this.http.get(`${API_URL}/productos/exportar/excel`, { responseType: 'blob' });
  }

  importarExcel(archivo: File): Observable<ResultadoImportacion> {
    const formData = new FormData();
    formData.append('archivo', archivo);
    return this.http.post<ResultadoImportacion>(`${API_URL}/productos/importar/excel`, formData);
  }
}
