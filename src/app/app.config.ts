import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { tenantInterceptor } from './core/interceptors/tenant.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    // The tenant interceptor stamps `X-Tenant: <key>` on every outgoing
    // request so backend tenant routing works for *all* services, not just
    // those that remember to call AuthService.getAuthHeaders().
    // The auth interceptor stamps `Authorization: Bearer <token>` on calls to
    // our own API and, on a 401, clears the stale session and redirects to
    // /login (so an expired JWT no longer leaves the UI in a zombie state).
    provideHttpClient(withInterceptors([tenantInterceptor, authInterceptor])),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
};

