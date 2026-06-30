import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { API_URL } from './api.config';

export interface UsuarioSesion {
  id: number;
  usuario: string;
  nombre: string;
  correo: string;
  rol: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _token = signal<string | null>(localStorage.getItem('admin_token'));
  private readonly _usuario = signal<UsuarioSesion | null>(
    JSON.parse(localStorage.getItem('admin_usuario') ?? 'null')
  );

  readonly isLoggedIn = computed(() => !!this._token());
  readonly usuario = computed(() => this._usuario());

  login(usuario: string, contrasena: string) {
    return this.http.post<{ token: string; usuario: UsuarioSesion }>(
      `${API_URL}/auth/login`,
      { usuario, contrasena }
    ).pipe(
      tap(res => {
        localStorage.setItem('admin_token', res.token);
        localStorage.setItem('admin_usuario', JSON.stringify(res.usuario));
        this._token.set(res.token);
        this._usuario.set(res.usuario);
      })
    );
  }

  logout(): void {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_usuario');
    this._token.set(null);
    this._usuario.set(null);
    this.router.navigate(['/admin/login']);
  }

  getToken(): string | null {
    return this._token() ?? localStorage.getItem('admin_token');
  }
}
