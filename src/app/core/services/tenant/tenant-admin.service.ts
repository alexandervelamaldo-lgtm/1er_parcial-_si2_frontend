import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { AuthService } from '../autenticacion-acceso/auth.service';

/**
 * Talks to the `/tenants/*` REST endpoints. Kept separate from the
 * authenticated services because the public catalog is fetched *before*
 * the user has a token (so the login dropdown can render).
 *
 * Auth note: this project does NOT use a global auth interceptor — each
 * service that needs the JWT calls `authService.getAuthHeaders()` manually.
 * We follow that same convention here.
 */

export interface TenantPublic {
  key: string;
  label: string;
  is_default: boolean;
}

export interface TenantAdmin extends TenantPublic {
  user_count: number;
  solicitud_count: number;
  suspended: boolean;
}

export interface CreateTenantPayload {
  key: string;
  label: string;
  admin_email: string;
  admin_password: string;
}

@Injectable({ providedIn: 'root' })
export class TenantAdminService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly base = environment.apiUrl;

  /** Public — no JWT required. Used by the login dropdown. */
  listPublic(): Observable<TenantPublic[]> {
    return this.http.get<TenantPublic[]>(`${this.base}/tenants/public`);
  }

  /** Super-admin only. Returns metrics for every tenant. */
  listAdmin(): Observable<TenantAdmin[]> {
    return this.http.get<TenantAdmin[]>(`${this.base}/admin/tenants`, {
      headers: this.auth.getAuthHeaders()
    });
  }

  create(payload: CreateTenantPayload): Observable<TenantAdmin> {
    return this.http.post<TenantAdmin>(`${this.base}/admin/tenants`, payload, {
      headers: this.auth.getAuthHeaders()
    });
  }

  suspend(key: string): Observable<void> {
    return this.http.post<void>(`${this.base}/admin/tenants/${encodeURIComponent(key)}/suspend`, {}, {
      headers: this.auth.getAuthHeaders()
    });
  }

  resume(key: string): Observable<void> {
    return this.http.post<void>(`${this.base}/admin/tenants/${encodeURIComponent(key)}/resume`, {}, {
      headers: this.auth.getAuthHeaders()
    });
  }
}
