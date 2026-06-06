import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { AuthService } from '../autenticacion-acceso/auth.service';

/**
 * Cliente del endpoint `/bitacora` — auditoría de acciones de usuario.
 *
 * Convenciones del proyecto:
 *   - No hay interceptor global de auth; cada service adjunta el JWT y el
 *     header `X-Tenant` vía `auth.getAuthHeaders()`.
 *   - El backend ya acota la consulta al tenant del request (la sesión que
 *     inyecta `get_db` está atada al schema/DB del tenant), por lo que la
 *     bitácora que se ve aquí es SOLO la del tenant actual. Un usuario del
 *     taller A jamás verá las acciones del taller B.
 */

export interface BitacoraItem {
  id: number;
  created_at: string;
  user_id: number | null;
  user_email: string | null;
  accion: string;
  metodo: string;
  ruta: string;
  status_code: number;
  entidad: string | null;
  entidad_id: string | null;
  ip: string | null;
}

export interface BitacoraListResponse {
  items: BitacoraItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface BitacoraFilters {
  since?: string | null;   // ISO 8601 (YYYY-MM-DD o datetime completo)
  until?: string | null;
  userId?: number | null;
  entidad?: string | null;
  q?: string | null;
  limit?: number;
  offset?: number;
}

@Injectable({ providedIn: 'root' })
export class BitacoraService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly base = environment.apiUrl;

  list(filters: BitacoraFilters = {}): Observable<BitacoraListResponse> {
    let params = new HttpParams();
    if (filters.since) params = params.set('since', filters.since);
    if (filters.until) params = params.set('until', filters.until);
    if (filters.userId != null) params = params.set('user_id', String(filters.userId));
    if (filters.entidad) params = params.set('entidad', filters.entidad);
    if (filters.q) params = params.set('q', filters.q);
    if (filters.limit != null) params = params.set('limit', String(filters.limit));
    if (filters.offset != null) params = params.set('offset', String(filters.offset));
    return this.http.get<BitacoraListResponse>(`${this.base}/bitacora`, {
      headers: this.auth.getAuthHeaders(),
      params,
    });
  }
}
