import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getToken();
  if (token) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }
  return next(req).pipe(
    catchError(err => {
      // Solo cerramos la sesión de administrador si esta request efectivamente
      // llevaba el token de admin adjunto: un 401 en un endpoint público (ej.
      // login de cliente con credenciales incorrectas) no debe expulsar al admin.
      if (err.status === 401 && token) auth.logout();
      return throwError(() => err);
    })
  );
};
