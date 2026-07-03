import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AUTH_TOKEN_STORAGE_KEY } from '../services/autenticacion-acceso/auth.service';

/**
 * Interceptor de autenticación. Cumple dos funciones complementarias al
 * `tenantInterceptor`:
 *
 *  1) Estampa `Authorization: Bearer <token>` en TODA petición a NUESTRO
 *     backend. Igual que el tenant header, esto cierra el hueco de servicios
 *     que arman sus propios headers y se olvidan del token (el bug que dejaba
 *     el registro de push como `user=anon` → 401). El token JAMÁS se adjunta a
 *     URLs de terceros (Mapbox, Firebase, Google): solo a `environment.apiUrl`,
 *     para no filtrar el JWT fuera de nuestro dominio.
 *
 *  2) Ante un 401 de nuestra API (token ausente / vencido / inválido) limpia el
 *     token guardado y redirige a /login. Antes no había manejo global: cuando
 *     el JWT expiraba (vida útil 30 min) la UI seguía "logueada" pero cada
 *     llamada fallaba en silencio. Ahora el usuario vuelve a autenticarse en
 *     lugar de quedar en una sesión zombie.
 *
 * No inyecta `AuthService` a propósito: hacerlo crearía un ciclo de DI
 * (AuthService construye HttpClient, que ejecuta este interceptor). Por eso lee
 * el token directo de localStorage vía la constante compartida.
 */

// El login/registro devuelven 401 como parte de su flujo normal (credenciales
// incorrectas). Ahí NO debemos forzar logout/redirección.
const NO_REDIRECT_PATHS = ['/auth/login', '/auth/register'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const isApiUrl = req.url.startsWith(environment.apiUrl);

  let outgoing = req;
  if (isApiUrl && !req.headers.has('Authorization')) {
    const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    if (token) {
      outgoing = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
    }
  }

  return next(outgoing).pipe(
    catchError((error: unknown) => {
      const isAuthFlow = NO_REDIRECT_PATHS.some((path) => req.url.includes(path));
      if (error instanceof HttpErrorResponse && error.status === 401 && isApiUrl && !isAuthFlow) {
        localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
        const onLogin = router.url.split('?')[0] === '/login';
        if (!onLogin) {
          void router.navigate(['/login'], { queryParams: { expired: '1' } });
        }
      }
      return throwError(() => error);
    })
  );
};
