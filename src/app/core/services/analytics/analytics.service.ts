import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { AuthService } from '../autenticacion-acceso/auth.service';

/**
 * Cliente del módulo de analítica operacional `/analytics/*`.
 *
 * Convenciones del proyecto:
 *   - No usamos interceptor global de auth; cada service llama a
 *     `auth.getAuthHeaders()` para incluir el JWT y el X-Tenant.
 *   - Los tiempos vienen del backend en MINUTOS (no segundos).
 *   - Los porcentajes vienen en escala 0-100 (no 0-1).
 *   - Cualquier métrica con `n_muestras: 0` debe mostrarse como "—" en
 *     la UI, NO como cero — el backend nunca fabrica valores.
 */

export interface TiempoPromedioKPI {
  avg_min: number | null;
  p50_min: number | null;
  p95_min: number | null;
  n_muestras: number;
  unidad: string;
}

export interface IncidentesPorTipoItem {
  tipo: string;
  label: string;
  count: number;
  porcentaje: number;
}

export interface IncidentesPorTipoKPI {
  total: number;
  items: IncidentesPorTipoItem[];
}

export interface TallerRankingItem {
  taller_id: number;
  nombre: string;
  score: number;
  tiempo_promedio_llegada: number | null;
  tiempo_promedio_cierre: number | null;
  casos_atendidos: number;
  rating_promedio: number;
  tasa_completadas_pct: number;
}

export interface TalleresRankingKPI {
  items: TallerRankingItem[];
  min_casos_para_ranking: number;
}

export interface ZonaCalienteItem {
  lat: number;
  lng: number;
  count: number;
  tipo_predominante: string | null;
  tipos_top: [string, number][];
}

export interface ZonasCalientesKPI {
  items: ZonaCalienteItem[];
}

export interface CancelacionesKPI {
  total_canceladas: number;
  total_solicitudes: number;
  tasa_pct: number;
  por_motivo: Record<string, number>;
}

export interface SlaKPI {
  sla_asignacion_pct: number | null;
  sla_llegada_pct: number | null;
  sla_cierre_pct: number | null;
  sla_global_pct: number | null;
  umbrales: Record<string, number>;
  n_evaluadas_asignacion: number;
  n_evaluadas_llegada: number;
  n_evaluadas_cierre: number;
  n_evaluadas_global: number;
}

export interface SerieTemporalPunto {
  fecha: string;
  count: number;
  por_tipo: Record<string, number>;
}

export interface DashboardKPIsResponse {
  desde: string;
  hasta: string;
  taller_id_filtro: number | null;
  generado_en: string;
  tiempo_asignacion: TiempoPromedioKPI;
  tiempo_llegada: TiempoPromedioKPI;
  tiempo_cierre: TiempoPromedioKPI;
  tiempo_end_to_end: TiempoPromedioKPI;
  incidentes_por_tipo: IncidentesPorTipoKPI;
  talleres_top: TalleresRankingKPI;
  zonas_calientes: ZonasCalientesKPI;
  cancelaciones: CancelacionesKPI;
  sla: SlaKPI;
}

export interface SerieTemporalResponse {
  desde: string;
  hasta: string;
  puntos: SerieTemporalPunto[];
}

export interface DashboardFilters {
  since?: string;   // ISO date YYYY-MM-DD
  until?: string;
  tallerId?: number | null;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly base = environment.apiUrl;

  getDashboard(filters: DashboardFilters = {}): Observable<DashboardKPIsResponse> {
    let params = new HttpParams();
    if (filters.since) params = params.set('since', filters.since);
    if (filters.until) params = params.set('until', filters.until);
    if (filters.tallerId != null) params = params.set('taller_id', String(filters.tallerId));
    return this.http.get<DashboardKPIsResponse>(`${this.base}/analytics/dashboard`, {
      headers: this.auth.getAuthHeaders(),
      params,
    });
  }

  getSerieTemporal(filters: DashboardFilters = {}): Observable<SerieTemporalResponse> {
    let params = new HttpParams();
    if (filters.since) params = params.set('since', filters.since);
    if (filters.until) params = params.set('until', filters.until);
    if (filters.tallerId != null) params = params.set('taller_id', String(filters.tallerId));
    return this.http.get<SerieTemporalResponse>(
      `${this.base}/analytics/incidentes/serie-temporal`,
      { headers: this.auth.getAuthHeaders(), params },
    );
  }
}
