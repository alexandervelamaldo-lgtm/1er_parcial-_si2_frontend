import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { AuthService } from '../autenticacion-acceso/auth.service';

/**
 * Cliente del endpoint `/backups` — respaldo manual + automático por tenant.
 *
 * Convenciones del proyecto:
 *   - No hay interceptor global de auth; cada service adjunta el JWT y el
 *     header `X-Tenant` vía `auth.getAuthHeaders()`.
 *   - El backend resuelve el tenant del request y respalda/restaura SOLO la
 *     BD de ese tenant. Un taller jamás opera sobre la base de otro.
 */

export type BackupKind = 'manual' | 'auto';
export type BackupFrequency = 'hourly' | 'daily' | 'weekly';

export interface BackupItem {
  name: string;
  size_bytes: number;
  size_human: string;
  created_at: string;
  kind: BackupKind;
}

export interface BackupListResponse {
  items: BackupItem[];
  total: number;
  // pg_dump/pg_restore presentes en el servidor. Si es false la UI avisa y
  // deshabilita crear/restaurar.
  pg_available: boolean;
}

export interface ScheduleConfig {
  enabled: boolean;
  frequency: BackupFrequency;
  hour: number;       // 0-23, solo aplica a frecuencia "daily"
  retention: number;  // cuántos respaldos automáticos conservar
}

export interface ScheduleResponse extends ScheduleConfig {
  last_run: string | null;
  next_run: string | null;
}

export interface MessageResponse {
  detail: string;
}

@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly base = environment.apiUrl;

  list(): Observable<BackupListResponse> {
    return this.http.get<BackupListResponse>(`${this.base}/backups`, {
      headers: this.auth.getAuthHeaders(),
    });
  }

  create(): Observable<BackupItem> {
    return this.http.post<BackupItem>(`${this.base}/backups`, {}, {
      headers: this.auth.getAuthHeaders(),
    });
  }

  download(name: string): Observable<Blob> {
    return this.http.get(`${this.base}/backups/${encodeURIComponent(name)}/download`, {
      headers: this.auth.getAuthHeaders(),
      responseType: 'blob',
    });
  }

  restore(name: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(
      `${this.base}/backups/${encodeURIComponent(name)}/restore`,
      {},
      { headers: this.auth.getAuthHeaders() },
    );
  }

  remove(name: string): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(`${this.base}/backups/${encodeURIComponent(name)}`, {
      headers: this.auth.getAuthHeaders(),
    });
  }

  getSchedule(): Observable<ScheduleResponse> {
    return this.http.get<ScheduleResponse>(`${this.base}/backups/schedule`, {
      headers: this.auth.getAuthHeaders(),
    });
  }

  saveSchedule(config: ScheduleConfig): Observable<ScheduleResponse> {
    return this.http.put<ScheduleResponse>(`${this.base}/backups/schedule`, config, {
      headers: this.auth.getAuthHeaders(),
    });
  }
}
