import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/autenticacion-acceso/auth.service';


export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.hasToken() && authService.isWebClientBlocked()) {
    authService.resetSession();
    return router.createUrlTree(['/login'], {
      queryParams: { blocked: 'client' }
    });
  }

  if (authService.hasToken()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};

