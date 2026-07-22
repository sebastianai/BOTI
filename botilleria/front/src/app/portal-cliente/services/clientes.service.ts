import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../../core/api.config';

export interface RegistroClientePayload {
  nombre: string;
  apellido: string;
  rut: string;
  correo: string;
  telefono: string;
  fechaNacimiento: string;
  genero: string;
  contrasena: string;
}

export interface ClienteRegistrado {
  id: number;
  nombre: string;
  apellido: string;
  correo: string;
}

@Injectable({ providedIn: 'root' })
export class ClientesService {
  private readonly http = inject(HttpClient);

  registrar(payload: RegistroClientePayload): Observable<ClienteRegistrado> {
    return this.http.post<ClienteRegistrado>(`${API_URL}/clientes/registro`, payload);
  }
}
