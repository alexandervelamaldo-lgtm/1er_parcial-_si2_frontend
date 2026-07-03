import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/autenticacion-acceso/auth.service';


/**
 * Picks the right "home" route for a user based on their roles. Critical to
 * avoid redirect loops: every role must have a route they're allowed in.
 *
 *   SUPER_ADMIN → `/super-admin/tenants` (cross-tenant management)
 *   anyone else → `/dashboard` (operational console)
 */
function _landingForRoles(roles: string[]): string {
  if (roles.includes('SUPER_ADMIN')) return '/super-admin/tenants';
  return '/dashboard';
}


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

    // Redirect to the user's own landing page — *not* always /dashboard —
    // otherwise SUPER_ADMIN (who isn't allowed on /dashboard) gets stuck
    // in an infinite redirect loop between two routes that reject them.
    const landing = _landingForRoles(authService.currentRoles());
    return router.createUrlTree([landing]);
  };

