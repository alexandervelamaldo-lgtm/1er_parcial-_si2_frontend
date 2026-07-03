import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/autenticacion-acceso/auth.service';


/**
 * Sends each role to the right "home" route when they hit `/`.
 *
 * Without this, the static redirect `''` → `dashboard` would trap
 * SUPER_ADMIN users in an infinite loop (the dashboard guard rejects them
 * → bounces back to `/` → again to `dashboard` → …).
 */
export const homeRedirectGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.hasToken()) {
    return router.createUrlTree(['/login']);
  }

  const roles = auth.currentRoles();
  if (roles.includes('SUPER_ADMIN')) {
    return router.createUrlTree(['/super-admin/tenants']);
  }
  return router.createUrlTree(['/dashboard']);
};
