import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { TenantService } from '../services/tenant/tenant.service';

/**
 * Functional HTTP interceptor that stamps the `X-Tenant` header on every
 * outgoing request, using the value tracked by [TenantService]. The header
 * tells the FastAPI backend which tenant database to route the query to,
 * so the user only ever sees data from their own organization.
 *
 * Why an interceptor (and not the AuthService alone):
 *   Individual services that build their own headers (TrackingService,
 *   AiService, MapboxService, etc.) were forgetting to include the tenant,
 *   which made part of the traffic fall through to the `default` tenant
 *   and silently leak data. This interceptor closes the gap once and for
 *   all — it is impossible to opt out unless the request goes through a
 *   different HttpClient instance.
 *
 * Tradeoff: even calls to public endpoints (login lists, healthchecks) get
 * the header. That is fine — the backend resolver simply ignores it for
 * un-authenticated routes.
 */
export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
  const url = (req.url || '').toLowerCase();
  if (url.includes('/auth/login')) return next(req);

  const tenant = inject(TenantService).getTenant();
  if (!tenant) return next(req);

  // Do not overwrite an explicit X-Tenant that callers may have set on
  // purpose (e.g. the super-admin "switch tenant" feature).
  if (req.headers.has('X-Tenant')) return next(req);

  return next(
    req.clone({
      setHeaders: { 'X-Tenant': tenant }
    })
  );
};
