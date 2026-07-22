import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { API_URL } from '../../core/api.config';

export interface ClienteSesion {
  id: number;
  nombre: string;
  apellido: string;
  rut: string;
  correo: string;
  telefono: string | null;
}

@Injectable({ providedIn: 'root' })
export class ClienteAuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _token = signal<string | null>(localStorage.getItem('cliente_token'));
  private readonly _cliente = signal<ClienteSesion | null>(
    JSON.parse(localStorage.getItem('cliente_data') ?? 'null')
  );

  readonly isLoggedIn = computed(() => !!this._token());
  readonly cliente = computed(() => this._cliente());

  login(rut: string, contrasena: string) {
    return this.http.post<{ token: string; cliente: ClienteSesion }>(
      `${API_URL}/clientes/login`,
      { rut, contrasena }
    ).pipe(
      tap(res => {
        localStorage.setItem('cliente_token', res.token);
        localStorage.setItem('cliente_data', JSON.stringify(res.cliente));
        this._token.set(res.token);
        this._cliente.set(res.cliente);
      })
    );
  }

  logout(): void {
    localStorage.removeItem('cliente_token');
    localStorage.removeItem('cliente_data');
    this._token.set(null);
    this._cliente.set(null);
    this.router.navigate(['/portal-cliente']);
  }

  getToken(): string | null {
    return this._token() ?? localStorage.getItem('cliente_token');
  }
}
