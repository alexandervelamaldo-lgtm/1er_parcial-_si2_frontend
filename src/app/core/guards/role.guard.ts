import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';


export const roleGuard =
  (roles: string[]): CanActivateFn =>
  () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.hasToken()) {
      return router.createUrlTree(['/login']);
    }

    if (!authService.currentProfile()) {
      return true;
    }

    if (authService.hasAnyRole(roles)) {
      return true;
    }

    return router.createUrlTree(['/dashboard']);
  };
