import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { EmergencyApiService } from '../../../core/services/gestion-solicitudes/emergency-api.service';
import { TrackingService } from '../../../core/services/tracking/tracking.service';
import { KpisResumen, Solicitud, SolicitudSeguimiento, Taller } from '../../../core/models/gestion-solicitudes/api.models';
import { environment } from '../../../../environments/environment';
import { AppIconComponent, IconName } from '../../../shared/components/app-icon/app-icon.component';
import { ActiveRoute, IncidentePunto, MapaPickerComponent, TallerPunto } from '../../../shared/components/mapa-picker/mapa-picker.component';

const IN_ROUTE_STATES = ['EN_CAMINO', 'EN_ATENCION', 'ASIGNADA', 'ACEPTADA'];
const MAX_ACTIVE_ROUTES = 5;
const KPI_AUTO_REFRESH_MS = 15 * 60 * 1000;

type KpiRange = 'today' | 'week' | 'month' | 'all';

type KpiSummaryCard = {
  label: string;
  value: string;
  meta: string;
  icon: IconName;
  tone: 'blue' | 'violet' | 'green' | 'red' | 'amber';
};

type KpiTrendModel = {
  hasData: boolean;
  totalPath: string;
  completadosPath: string;
  maxValue: number;
  labels: Array<{ x: number; label: string }>;
};

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, DatePipe, MapaPickerComponent, AppIconComponent],
  template: `
    <section class="dashboard-shell">
      <header class="hero-panel">
        <div class="hero-copy">
          <div class="live-indicator">
            <span class="dot"></span>
            SISTEMA EN VIVO
          </div>
          <h2>Panel de Control Operativo</h2>
          <p>
            Visualiza solicitudes activas, ubicaciones geográficas y avance de atención en un tablero más
            ordenado y legible.
          </p>
          <div class="hero-meta">
            <span class="hero-chip">
              <app-icon name="pin" [size]="12" />
              {{ mapa().length }} solicitudes con ubicación
            </span>
            <span class="hero-chip">
              <app-icon name="wrench" [size]="12" />
              {{ talleresMapa().length }} talleres visibles
            </span>
            <span class="hero-chip">
              <app-icon name="car" [size]="12" />
              {{ tecnicos().length }} unidades rastreadas
            </span>
          </div>
        </div>

        <div class="hero-actions">
          <div class="hero-card">
            <span class="eyebrow">Lectura rápida</span>
            <strong>{{ criticas() > 0 ? 'Atención prioritaria requerida' : 'Operación estable' }}</strong>
            <p>
              {{ criticas() > 0 ? criticas() + ' solicitudes críticas requieren seguimiento inmediato.' : 'No hay alertas críticas pendientes en este momento.' }}
            </p>
          </div>
          <button (click)="loadData()" [disabled]="isLoading()" class="btn-refresh">
            <span class="icon" [class.spinning]="isLoading()"><app-icon name="refresh" [size]="16" /></span>
            {{ isLoading() ? 'Sincronizando...' : 'Actualizar datos' }}
          </button>
          <button *ngIf="isDev" (click)="seedAndReload()" [disabled]="isLoading()" class="btn-refresh">
            <app-icon name="download" [size]="16" />
            Sembrar demo (dev)
          </button>
          <p *ngIf="errorMessage() as message">{{ message }}</p>
        </div>
      </header>

      <section class="surface-card mobile-kpi-panel" *ngIf="kpis() as data">
        <div class="mobile-kpi-head">
          <div>
            <span class="section-kicker">KPI Dashboard</span>
            <h3><app-icon name="trending-up" [size]="16" /> Rendimiento operativo</h3>
            <p>Replica el tablero KPI móvil con el mismo cálculo, filtro temporal y refresco en vivo por tenant.</p>
          </div>

          <div class="mobile-kpi-actions">
            <div class="range-chip-group">
              <button
                *ngFor="let option of kpiRangeOptions"
                type="button"
                class="range-chip"
                [class.active]="kpiRange() === option.value"
                (click)="setKpiRange(option.value)"
              >
                {{ option.label }}
              </button>
            </div>

            <div class="kpi-action-buttons">
              <button type="button" class="btn-secondary" (click)="exportKpiCsv()" [disabled]="!kpis()">
                <app-icon name="download" [size]="16" />
                Exportar CSV
              </button>
              <button type="button" class="btn-secondary" (click)="loadData()" [disabled]="isLoading()">
                <app-icon name="refresh" [size]="16" />
                {{ isLoading() ? 'Actualizando…' : 'Actualizar KPI' }}
              </button>
            </div>
          </div>
        </div>

        <div class="mobile-kpi-grid">
          <article class="mobile-kpi-card" [attr.data-tone]="card.tone" *ngFor="let card of kpiSummaryCards()">
            <div class="mobile-kpi-icon"><app-icon [name]="card.icon" [size]="18" /></div>
            <div class="mobile-kpi-copy">
              <span class="mobile-kpi-label">{{ card.label }}</span>
              <strong class="mobile-kpi-value">{{ card.value }}</strong>
              <small class="mobile-kpi-meta">{{ card.meta }}</small>
            </div>
          </article>
        </div>

        <div class="mobile-kpi-content">
          <article class="mobile-kpi-chart-card">
            <div class="chart-head">
              <h4>Incidentes por tipo</h4>
              <span>{{ kpiIncidentItems().length }} categorías</span>
            </div>
            <div class="empty-block small" *ngIf="kpiIncidentItems().length === 0">
              <span>Sin datos de incidentes en el rango seleccionado.</span>
            </div>
            <div class="kpi-bar-list" *ngIf="kpiIncidentItems().length > 0">
              <div class="kpi-bar-row" *ngFor="let item of kpiIncidentItems()">
                <div class="kpi-bar-topline">
                  <strong>{{ item.label }}</strong>
                  <span>{{ item.count }}</span>
                </div>
                <div class="kpi-bar-track">
                  <div class="kpi-bar-fill" [style.width.%]="item.pct"></div>
                </div>
                <small>{{ item.pct | number:'1.0-1' }}%</small>
              </div>
            </div>
          </article>

          <article class="mobile-kpi-chart-card">
            <div class="chart-head">
              <h4>{{ kpiTrendTitle() }}</h4>
              <div class="trend-legend">
                <span><i class="dot total"></i>Total</span>
                <span><i class="dot completados"></i>Completados</span>
              </div>
            </div>
            <div class="empty-block small" *ngIf="!kpiTrend().hasData">
              <span>Sin datos de tendencia para el rango seleccionado.</span>
            </div>
            <div class="kpi-trend-shell" *ngIf="kpiTrend().hasData">
              <svg viewBox="0 0 640 220" preserveAspectRatio="none" class="kpi-trend-chart">
                <line x1="32" y1="24" x2="32" y2="188" class="axis-line" />
                <line x1="32" y1="188" x2="616" y2="188" class="axis-line" />
                <path [attr.d]="kpiTrend().totalPath" class="trend-line total"></path>
                <path [attr.d]="kpiTrend().completadosPath" class="trend-line completados"></path>
              </svg>
              <div class="trend-labels">
                <span *ngFor="let label of kpiTrend().labels" [style.left.%]="label.x">{{ label.label }}</span>
              </div>
            </div>
          </article>
        </div>

        <footer class="mobile-kpi-footer">
          <span>Rango: {{ kpiRangeLabel() }}</span>
          <span>Actualizado: {{ formatKpiTimestamp(data.calculado_en) }}</span>
          <span>Cache servidor: {{ data.cache_ttl_segundos }}s</span>
        </footer>
      </section>

      <section class="stats-grid">
        <article class="stat-card">
          <div class="stat-icon blue"><app-icon name="signal" [size]="20" /></div>
          <div class="stat-content">
            <span class="label">Solicitudes activas</span>
            <strong class="value">{{ solicitudes().length }}</strong>
            <small class="meta-line">Base operativa actual</small>
          </div>
        </article>

        <article class="stat-card critical" [class.pulse]="criticas() > 0">
          <div class="stat-icon red"><app-icon name="alert" [size]="20" /></div>
          <div class="stat-content">
            <span class="label">Críticas</span>
            <strong class="value">{{ criticas() }}</strong>
            <small class="meta-line">Necesitan priorización</small>
          </div>
        </article>

        <article class="stat-card">
          <div class="stat-icon green"><app-icon name="wrench" [size]="20" /></div>
          <div class="stat-content">
            <span class="label">Con taller</span>
            <strong class="value">{{ asignadas() }}</strong>
            <small class="meta-line">Asignadas o en servicio</small>
          </div>
        </article>

        <article class="stat-card">
          <div class="stat-icon violet"><app-icon name="pin" [size]="20" /></div>
          <div class="stat-content">
            <span class="label">Geolocalizadas</span>
            <strong class="value">{{ mapa().length }}</strong>
            <small class="meta-line">Con coordenadas activas</small>
          </div>
        </article>

        <article class="stat-card">
          <div class="stat-icon blue"><app-icon name="clock" [size]="20" /></div>
          <div class="stat-content">
            <span class="label">Asignación prom.</span>
            <strong class="value">
              {{ kpis()?.tiempo_asignacion_promedio_min != null ? (kpis()!.tiempo_asignacion_promedio_min | number:'1.0-2') + ' min' : '--' }}
            </strong>
            <small class="meta-line">Velocidad operativa</small>
          </div>
        </article>

        <article class="stat-card">
          <div class="stat-icon amber"><app-icon name="car" [size]="20" /></div>
          <div class="stat-content">
            <span class="label">Llegada prom.</span>
            <strong class="value">
              {{ kpis()?.tiempo_llegada_promedio_min != null ? (kpis()!.tiempo_llegada_promedio_min | number:'1.0-2') + ' min' : '--' }}
            </strong>
            <small class="meta-line">Tiempo de desplazamiento</small>
          </div>
        </article>
      </section>

      <section class="workspace-grid">
        <article class="surface-card map-hub">
          <div class="section-heading">
            <div>
              <span class="section-kicker">Vista geográfica</span>
              <h3><app-icon name="map" [size]="16" /> Mapa de solicitudes y talleres</h3>
              <p>El mapa concentra incidentes, talleres y unidades; el panel lateral resume las solicitudes con ubicación para evitar desorden visual.</p>
            </div>
            <span class="count-pill">{{ mapa().length }} ubicaciones</span>
          </div>

          <div class="map-hub-layout">
            <div class="map-stage">
              <app-mapa-picker
                [incidentPoints]="mapa()"
                [technicians]="tecnicos()"
                [workshops]="talleresMapa()"
                [activeRoutes]="activeRoutes()"
                (incidentSelected)="openIncident($event)"
                (routeSelected)="openIncident($event.solicitudId)"
              />
            </div>

            <aside class="map-sidebar">
              <div class="mini-stats">
                <article class="mini-stat">
                  <span class="mini-label">Incidentes visibles</span>
                  <strong>{{ mapa().length }}</strong>
                </article>
                <article class="mini-stat">
                  <span class="mini-label">Talleres activos</span>
                  <strong>{{ talleresMapa().length }}</strong>
                </article>
                <article class="mini-stat">
                  <span class="mini-label">Unidades en rastreo</span>
                  <strong>{{ tecnicos().length }}</strong>
                </article>
              </div>

              <div class="list-block">
                <div class="subheader">
                  <h4>Actividad geográfica</h4>
                  <span>{{ incidenciasGeograficas().length }}</span>
                </div>

                <button
                  *ngFor="let punto of incidenciasGeograficas()"
                  type="button"
                  class="location-card"
                  (click)="openIncident(punto.id)"
                >
                  <div class="location-icon" [attr.data-status]="punto.estado">
                    <app-icon name="pin" [size]="12" />
                  </div>
                  <div class="location-body">
                    <div class="location-topline">
                      <span class="mono">#{{ punto.id }}</span>
                      <span class="status-chip" [attr.data-tone]="incidentTone(punto.estado)">{{ punto.estado }}</span>
                    </div>
                    <p>{{ punto.descripcion }}</p>
                    <small>{{ punto.latitud_incidente | number:'1.4-4' }}, {{ punto.longitud_incidente | number:'1.4-4' }}</small>
                  </div>
                </button>

                <div class="empty-block" *ngIf="incidenciasGeograficas().length === 0">
                  <app-icon name="folder" [size]="16" />
                  <span>No hay solicitudes con ubicación para mostrar.</span>
                </div>
              </div>
            </aside>
          </div>
        </article>

        <div class="insights-stack">

          <!-- ── Monitoreo operativo: alertas del flujo cliente↔taller-directo ── -->
          <article class="surface-card monitoring-card" *ngIf="hayAlertasOperativas()">
            <div class="section-heading compact">
              <div>
                <span class="section-kicker">Monitoreo en vivo</span>
                <h3><app-icon name="alert" [size]="16" /> Requiere supervisión del operador</h3>
                <p class="subtle">
                  El cliente elige al taller directamente. Aquí solo aparecen los casos que escapan al flujo normal —
                  talleres lentos en responder o solicitudes con rechazos consecutivos.
                </p>
              </div>
            </div>

            <div class="monitoring-grid">
              <section class="monitoring-cell warning" *ngIf="propuestasEstancadas().length > 0">
                <header>
                  <h4>⏱ Propuestas estancadas</h4>
                  <span class="count">{{ propuestasEstancadas().length }}</span>
                </header>
                <p class="subtle">El taller seleccionado lleva +5 min sin aceptar ni rechazar.</p>
                <button
                  *ngFor="let item of propuestasEstancadas().slice(0, 4)"
                  type="button"
                  class="alert-row"
                  (click)="openIncident(item.id)">
                  <strong>#{{ item.id }} · {{ item.tipo_incidente?.nombre || 'Incidente' }}</strong>
                  <small>{{ item.descripcion }}</small>
                  <span class="ago">{{ item.fecha_solicitud | date: 'dd/MM HH:mm' }}</span>
                </button>
              </section>

              <section class="monitoring-cell critical" *ngIf="solicitudesEscaladas().length > 0">
                <header>
                  <h4>🔴 Solicitudes escaladas</h4>
                  <span class="count">{{ solicitudesEscaladas().length }}</span>
                </header>
                <p class="subtle">3+ talleres consecutivos rechazaron — necesita "Modo emergencia" desde el detalle.</p>
                <button
                  *ngFor="let item of solicitudesEscaladas().slice(0, 4)"
                  type="button"
                  class="alert-row"
                  (click)="openIncident(item.id)">
                  <strong>#{{ item.id }} · {{ item.tipo_incidente?.nombre || 'Incidente' }}</strong>
                  <small>{{ item.taller_rechazos_consecutivos }} rechazos · {{ item.descripcion }}</small>
                  <span class="ago">{{ item.fecha_solicitud | date: 'dd/MM HH:mm' }}</span>
                </button>
              </section>
            </div>
          </article>

          <article class="surface-card">
            <div class="section-heading compact">
              <div>
                <span class="section-kicker">Agrupación operativa</span>
                <h3><app-icon name="alert" [size]="16" /> Solicitudes priorizadas</h3>
              </div>
            </div>

            <div class="lane-grid">
              <section class="request-lane critical">
                <div class="lane-header">
                  <h4>Críticas</h4>
                  <span>{{ solicitudesCriticas().length }}</span>
                </div>
                <button
                  *ngFor="let solicitud of solicitudesCriticas()"
                  type="button"
                  class="request-chip"
                  (click)="openIncident(solicitud.id)"
                >
                  <div>
                    <strong>#{{ solicitud.id }} · {{ solicitud.tipo_incidente?.nombre || 'Incidente' }}</strong>
                    <p>{{ solicitud.descripcion }}</p>
                  </div>
                  <span class="status-chip" data-tone="critical">{{ solicitud.prioridad }}</span>
                </button>
                <div class="empty-block small" *ngIf="solicitudesCriticas().length === 0">
                  <span>Sin alertas críticas.</span>
                </div>
              </section>

              <section class="request-lane in-progress">
                <div class="lane-header">
                  <h4>En ruta y atención</h4>
                  <span>{{ solicitudesEnCurso().length }}</span>
                </div>
                <button
                  *ngFor="let solicitud of solicitudesEnCurso()"
                  type="button"
                  class="request-chip"
                  (click)="openIncident(solicitud.id)"
                >
                  <div>
                    <strong>#{{ solicitud.id }} · {{ solicitud.tipo_incidente?.nombre || 'Incidente' }}</strong>
                    <p>{{ solicitud.estado?.nombre || 'Sin estado' }}</p>
                  </div>
                  <span class="status-chip" [attr.data-tone]="stateTone(solicitud.estado?.nombre)">{{ solicitud.estado?.nombre || 'N/D' }}</span>
                </button>
                <div class="empty-block small" *ngIf="solicitudesEnCurso().length === 0">
                  <span>No hay servicios en curso.</span>
                </div>
              </section>

              <section class="request-lane pending">
                <div class="lane-header">
                  <h4>Pendientes de acción</h4>
                  <span>{{ solicitudesPendientes().length }}</span>
                </div>
                <button
                  *ngFor="let solicitud of solicitudesPendientes()"
                  type="button"
                  class="request-chip"
                  (click)="openIncident(solicitud.id)"
                >
                  <div>
                    <strong>#{{ solicitud.id }} · {{ solicitud.tipo_incidente?.nombre || 'Incidente' }}</strong>
                    <p>{{ solicitud.tecnico_id ? 'Con taller asignado' : 'Esperando asignación' }}</p>
                  </div>
                  <span class="status-chip" [attr.data-tone]="priorityTone(solicitud.prioridad)">{{ solicitud.prioridad }}</span>
                </button>
                <div class="empty-block small" *ngIf="solicitudesPendientes().length === 0">
                  <span>No hay pendientes sin atender.</span>
                </div>
              </section>
            </div>
          </article>

          <article class="surface-card">
            <div class="section-heading compact">
              <div>
                <span class="section-kicker">Actividad reciente</span>
                <h3><app-icon name="clock" [size]="16" /> Últimas solicitudes</h3>
              </div>
            </div>
            <div class="timeline-list">
              <button
                *ngFor="let solicitud of solicitudesRecientes()"
                type="button"
                class="timeline-item"
                (click)="openIncident(solicitud.id)"
              >
                <div class="timeline-dot" [attr.data-tone]="priorityTone(solicitud.prioridad)"></div>
                <div class="timeline-body">
                  <div class="timeline-topline">
                    <strong>#{{ solicitud.id }} · {{ solicitud.tipo_incidente?.nombre || 'Incidente' }}</strong>
                    <span>{{ solicitud.fecha_solicitud | date: 'HH:mm' }}</span>
                  </div>
                  <p>{{ solicitud.descripcion }}</p>
                  <div class="timeline-meta">
                    <span class="status-chip" [attr.data-tone]="stateTone(solicitud.estado?.nombre)">{{ solicitud.estado?.nombre || 'Sin estado' }}</span>
                    <span class="status-chip outline">{{ solicitud.prioridad }}</span>
                  </div>
                </div>
              </button>
            </div>
          </article>
        </div>
      </section>

      <article class="surface-card table-card">
        <div class="section-heading">
          <div>
            <span class="section-kicker">Registro consolidado</span>
            <h3><app-icon name="clipboard" [size]="16" /> Todas las solicitudes</h3>
            <p>Consulta rápida de incidentes con prioridad, estado, fecha y navegación directa al detalle.</p>
          </div>
        </div>
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Incidente</th>
                <th>Estado</th>
                <th>Prioridad</th>
                <th>Taller</th>
                <th>Fecha y Hora</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let solicitud of solicitudesOrdenadas()" [class.row-critical]="solicitud.prioridad === 'CRITICA'" (click)="openIncident(solicitud.id)">
                <td><span class="mono">#{{ solicitud.id }}</span></td>
                <td>
                  <div class="incident-type">
                    <strong>{{ solicitud.tipo_incidente?.nombre || 'Incidente' }}</strong>
                    <small>{{ solicitud.descripcion }}</small>
                  </div>
                </td>
                <td>
                  <span class="status-chip" [attr.data-tone]="stateTone(solicitud.estado?.nombre)">{{ solicitud.estado?.nombre || 'Sin estado' }}</span>
                </td>
                <td>
                  <span class="status-chip" [attr.data-tone]="priorityTone(solicitud.prioridad)">{{ solicitud.prioridad }}</span>
                </td>
                <td>{{ solicitud.tecnico?.nombre || 'Sin asignar' }}</td>
                <td class="date-col">{{ solicitud.fecha_solicitud | date: 'dd/MM/yyyy HH:mm' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    </section>
  `,
  styles: `
    .mobile-kpi-panel {
      display: grid;
      gap: 18px;
      padding: 20px;
      margin-bottom: 24px;
      border: 1px solid rgba(148, 163, 184, 0.18);
      background:
        radial-gradient(circle at top right, rgba(59, 130, 246, 0.08), transparent 26%),
        linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96));
    }
    .mobile-kpi-head {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
    }
    .mobile-kpi-head h3,
    .chart-head h4 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      color: #0f172a;
    }
    .mobile-kpi-head p {
      margin: 6px 0 0;
      color: #64748b;
      max-width: 760px;
    }
    .mobile-kpi-actions {
      display: grid;
      gap: 12px;
      justify-items: end;
    }
    .range-chip-group,
    .kpi-action-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
    }
    .range-chip,
    .btn-secondary {
      border: 1px solid rgba(148, 163, 184, 0.28);
      background: white;
      color: #0f172a;
      border-radius: 999px;
      padding: 9px 14px;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.18s ease;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .range-chip.active,
    .range-chip:hover,
    .btn-secondary:hover {
      border-color: rgba(37, 99, 235, 0.45);
      background: rgba(37, 99, 235, 0.08);
      color: #1d4ed8;
    }
    .range-chip:disabled,
    .btn-secondary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .mobile-kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 12px;
    }
    .mobile-kpi-card {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 16px;
      border-radius: 18px;
      border: 1px solid rgba(148, 163, 184, 0.18);
      background: rgba(255, 255, 255, 0.94);
      min-height: 102px;
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
    }
    .mobile-kpi-icon {
      width: 42px;
      height: 42px;
      border-radius: 14px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .mobile-kpi-card[data-tone='blue'] .mobile-kpi-icon {
      background: rgba(59, 130, 246, 0.12);
      color: #2563eb;
    }
    .mobile-kpi-card[data-tone='violet'] .mobile-kpi-icon {
      background: rgba(168, 85, 247, 0.12);
      color: #7c3aed;
    }
    .mobile-kpi-card[data-tone='green'] .mobile-kpi-icon {
      background: rgba(34, 197, 94, 0.12);
      color: #16a34a;
    }
    .mobile-kpi-card[data-tone='red'] .mobile-kpi-icon {
      background: rgba(239, 68, 68, 0.12);
      color: #dc2626;
    }
    .mobile-kpi-card[data-tone='amber'] .mobile-kpi-icon {
      background: rgba(249, 115, 22, 0.12);
      color: #ea580c;
    }
    .mobile-kpi-copy {
      display: grid;
      gap: 4px;
    }
    .mobile-kpi-label {
      color: #64748b;
      font-size: 0.9rem;
      font-weight: 600;
    }
    .mobile-kpi-value {
      color: #0f172a;
      font-size: clamp(1.45rem, 1.1rem + 1vw, 2rem);
      line-height: 1;
    }
    .mobile-kpi-meta {
      color: #94a3b8;
      font-size: 0.84rem;
    }
    .mobile-kpi-content {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
    }
    .mobile-kpi-chart-card {
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid rgba(148, 163, 184, 0.16);
      padding: 18px;
      display: grid;
      gap: 14px;
      min-height: 280px;
    }
    .chart-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
    }
    .chart-head span {
      color: #64748b;
      font-size: 0.85rem;
      font-weight: 600;
    }
    .kpi-bar-list {
      display: grid;
      gap: 12px;
    }
    .kpi-bar-row {
      display: grid;
      gap: 6px;
    }
    .kpi-bar-topline {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      color: #0f172a;
    }
    .kpi-bar-track {
      width: 100%;
      height: 10px;
      border-radius: 999px;
      background: rgba(148, 163, 184, 0.18);
      overflow: hidden;
    }
    .kpi-bar-fill {
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #2563eb, #7c3aed);
    }
    .kpi-trend-shell {
      display: grid;
      gap: 10px;
    }
    .kpi-trend-chart {
      width: 100%;
      height: 220px;
      overflow: visible;
    }
    .axis-line {
      stroke: rgba(148, 163, 184, 0.55);
      stroke-width: 1.5;
    }
    .trend-line {
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 3;
    }
    .trend-line.total { stroke: #2563eb; }
    .trend-line.completados { stroke: #16a34a; stroke-dasharray: 8 6; }
    .trend-labels {
      position: relative;
      min-height: 18px;
      font-size: 0.78rem;
      color: #64748b;
    }
    .trend-labels span {
      position: absolute;
      transform: translateX(-50%);
      white-space: nowrap;
    }
    .trend-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      color: #64748b;
      font-size: 0.82rem;
      font-weight: 600;
    }
    .trend-legend span {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .trend-legend .dot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      display: inline-block;
    }
    .trend-legend .dot.total { background: #2563eb; }
    .trend-legend .dot.completados { background: #16a34a; }
    .mobile-kpi-footer {
      display: flex;
      flex-wrap: wrap;
      gap: 12px 18px;
      color: #64748b;
      font-size: 0.84rem;
      border-top: 1px solid rgba(148, 163, 184, 0.16);
      padding-top: 12px;
    }
    @media (max-width: 920px) {
      .mobile-kpi-head {
        grid-template-columns: 1fr;
        display: grid;
      }
      .mobile-kpi-actions,
      .range-chip-group,
      .kpi-action-buttons {
        justify-items: start;
        justify-content: flex-start;
      }
    }
    @media (max-width: 640px) {
      .mobile-kpi-panel {
        padding: 16px;
      }
      .mobile-kpi-grid {
        grid-template-columns: 1fr;
      }
      .mobile-kpi-content {
        grid-template-columns: 1fr;
      }
    }
    /* Monitoring widgets (Fase 6 — operador modo observador) ─────────── */
    .monitoring-card { border-left: 4px solid #f59e0b; }
    .monitoring-card .section-heading .subtle { color: #64748b; font-size: 0.85rem; margin-top: 4px; }
    .monitoring-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 12px;
      padding: 12px 16px 16px;
    }
    .monitoring-cell {
      border-radius: 12px;
      padding: 14px;
      background: #fef3c7;
      border: 1px solid #fbbf24;
    }
    .monitoring-cell.critical { background: #fee2e2; border-color: #f87171; }
    .monitoring-cell header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .monitoring-cell header h4 { margin: 0; font-size: 0.95rem; }
    .monitoring-cell .count {
      background: rgba(0,0,0,0.12); padding: 2px 10px; border-radius: 999px;
      font-weight: 700; font-size: 0.85rem;
    }
    .monitoring-cell .subtle { color: #475569; font-size: 0.78rem; margin: 0 0 10px; }
    .alert-row {
      width: 100%; text-align: left; background: rgba(255,255,255,0.85); border: none;
      border-radius: 8px; padding: 8px 10px; margin-bottom: 6px; cursor: pointer;
      display: grid; grid-template-columns: 1fr auto; gap: 4px 8px;
      transition: background 0.15s ease;
    }
    .alert-row:hover { background: white; }
    .alert-row strong { font-size: 0.85rem; color: #0f172a; }
    .alert-row small { font-size: 0.75rem; color: #475569; grid-column: 1 / -1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .alert-row .ago { font-size: 0.7rem; color: #64748b; font-variant-numeric: tabular-nums; }
  `
})
export class DashboardPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(EmergencyApiService);
  private readonly router = inject(Router);
  private readonly tracking = inject(TrackingService);
  private realtimeReloadTimer: number | null = null;
  private kpiAutoRefreshTimer: number | null = null;
  private reloadQueuedWhileLoading = false;

  readonly isDev = !environment.production;
  readonly solicitudes = signal<Solicitud[]>([]);
  readonly mapa = signal<IncidentePunto[]>([]); // Tipado más estricto
  readonly talleres = signal<Taller[]>([]);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly tecnicos = computed(() => this.tracking.tecnicos());
  readonly kpis = signal<KpisResumen | null>(null);
  readonly kpiRange = signal<KpiRange>('month');
  readonly kpiRangeOptions = [
    { value: 'today' as const, label: 'Hoy' },
    { value: 'week' as const, label: '7 días' },
    { value: 'month' as const, label: '30 días' },
    { value: 'all' as const, label: 'Todo' }
  ];
  readonly kpiSummaryCards = computed<KpiSummaryCard[]>(() => {
    const kpis = this.kpis();
    if (!kpis) return [];
    return [
      {
        label: 'Total',
        value: String(kpis.total_solicitudes ?? 0),
        meta: 'Solicitudes registradas',
        icon: 'signal',
        tone: 'blue'
      },
      {
        label: 'Activas',
        value: String(kpis.solicitudes_activas ?? 0),
        meta: 'Base operativa actual',
        icon: 'clock',
        tone: 'violet'
      },
      {
        label: 'Completadas',
        value: String(kpis.solicitudes_completadas ?? 0),
        meta: this.formatKpiPct(kpis.tasa_completados ?? 0),
        icon: 'check',
        tone: 'green'
      },
      {
        label: 'Canceladas',
        value: String(kpis.solicitudes_canceladas ?? 0),
        meta: this.formatKpiPct(kpis.tasa_cancelacion ?? 0),
        icon: 'alert',
        tone: 'red'
      },
      {
        label: 'T. asignación',
        value: this.formatKpiMin(kpis.tiempo_asignacion_promedio_min),
        meta: 'Pendiente a asignada',
        icon: 'clock',
        tone: 'blue'
      },
      {
        label: 'T. llegada',
        value: this.formatKpiMin(kpis.tiempo_llegada_promedio_min),
        meta: 'Asignada a atención',
        icon: 'car',
        tone: 'amber'
      },
      {
        label: 'T. atención',
        value: this.formatKpiMin(kpis.tiempo_atencion_promedio_min),
        meta: 'Atención a cierre',
        icon: 'wrench',
        tone: 'green'
      },
      {
        label: 'Talleres top',
        value: String(kpis.talleres?.length ?? 0),
        meta: 'Con actividad en el rango',
        icon: 'trending-up',
        tone: 'violet'
      }
    ];
  });
  readonly kpiIncidentItems = computed(() => {
    const source = this.kpis()?.incidentes_por_tipo ?? {};
    const entries = Object.entries(source)
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count);
    const max = entries[0]?.count ?? 0;
    return entries.map((item) => ({
      ...item,
      pct: max > 0 ? (item.count / max) * 100 : 0
    }));
  });
  readonly kpiTrend = computed<KpiTrendModel>(() => {
    const series = this.kpis()?.solicitudes_por_dia ?? [];
    if (series.length === 0) {
      return { hasData: false, totalPath: '', completadosPath: '', maxValue: 0, labels: [] };
    }
    const width = 640;
    const height = 220;
    const left = 32;
    const right = 24;
    const top = 24;
    const bottom = 32;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const maxValue = Math.max(1, ...series.map((item) => Math.max(item.total ?? 0, item.completados ?? 0)));
    const xFor = (index: number) =>
      left + (series.length === 1 ? plotWidth / 2 : (index / Math.max(1, series.length - 1)) * plotWidth);
    const yFor = (value: number) => top + plotHeight - (value / maxValue) * plotHeight;
    const buildPath = (selector: (item: KpisResumen['solicitudes_por_dia'][number]) => number) =>
      series
        .map((item, index) => `${index === 0 ? 'M' : 'L'} ${xFor(index).toFixed(1)} ${yFor(selector(item) ?? 0).toFixed(1)}`)
        .join(' ');
    const step = Math.max(1, Math.floor((series.length - 1) / 4));
    const labels = series
      .map((item, index) => ({ item, index }))
      .filter(({ index }) => index === 0 || index === series.length - 1 || index % step === 0)
      .map(({ item, index }) => ({
        x: ((xFor(index) - left) / plotWidth) * 100,
        label: item.fecha?.length >= 10 ? item.fecha.substring(5) : item.fecha
      }));
    return {
      hasData: true,
      totalPath: buildPath((item) => item.total ?? 0),
      completadosPath: buildPath((item) => item.completados ?? 0),
      maxValue,
      labels
    };
  });
  readonly talleresMapa = computed<TallerPunto[]>(() =>
    this.talleres()
      .filter((item) => item.disponible !== false)
      .map((item) => ({
        id: item.id,
        nombre: item.nombre,
        direccion: item.direccion,
        lat: item.latitud,
        lng: item.longitud,
        disponible: item.disponible,
        categoria: item.categoria?.nombre ?? null
      }))
  );

  readonly solicitudesOrdenadas = computed(() =>
    [...this.solicitudes()].sort(
      (left, right) => new Date(right.fecha_solicitud).getTime() - new Date(left.fecha_solicitud).getTime()
    )
  );
  readonly incidenciasGeograficas = computed(() =>
    [...this.mapa()].sort((left, right) => right.id - left.id).slice(0, 8)
  );
  readonly solicitudesCriticas = computed(() =>
    this.solicitudesOrdenadas().filter((item) => item.prioridad === 'CRITICA').slice(0, 4)
  );

  constructor() {
    effect(() => {
      const notificationVersion = this.tracking.notificationRefreshVersion();
      const kpiVersion = this.tracking.kpiRefreshVersion();
      if (notificationVersion === 0 && kpiVersion === 0) return;
      this.scheduleRealtimeReload();
    });
  }
  readonly solicitudesEnCurso = computed(() =>
    this.solicitudesOrdenadas()
      .filter((item) => ['ASIGNADA', 'EN_CAMINO', 'EN_ATENCION'].includes(this.normalizeState(item.estado?.nombre)))
      .slice(0, 4)
  );
  readonly solicitudesPendientes = computed(() =>
    this.solicitudesOrdenadas()
      .filter((item) => !item.tecnico_id || ['ACTIVO', 'PENDIENTE'].includes(this.normalizeState(item.estado?.nombre)))
      .slice(0, 4)
  );
  readonly solicitudesRecientes = computed(() => this.solicitudesOrdenadas().slice(0, 5));
  readonly criticas = computed(() => this.solicitudes().filter((item) => item.prioridad === 'CRITICA').length);
  readonly asignadas = computed(() => this.solicitudes().filter((item) => item.tecnico_id).length);

  // ── Widgets de monitoreo del flujo cliente↔taller-directo ─────────────
  // El operador ya no asigna manualmente; su rol es vigilar dos casos críticos:
  //
  //   1) Propuestas estancadas: el cliente eligió taller pero el taller
  //      no responde en > 5 min. Probablemente el taller está saturado
  //      o se desconectó — el operador puede asignar manualmente como
  //      "modo emergencia".
  //
  //   2) Solicitudes escaladas: 3+ talleres consecutivos rechazaron.
  //      El backend ya notificó automáticamente; este widget lo refuerza.
  /// Umbral en milisegundos para considerar una PROPUESTA_TALLER "estancada".
  private static readonly STALE_PROPOSAL_MS = 5 * 60 * 1000;

  readonly propuestasEstancadas = computed(() => {
    const now = Date.now();
    return this.solicitudesOrdenadas().filter((item) => {
      if (this.normalizeState(item.estado?.nombre) !== 'PROPUESTA_TALLER') return false;
      const created = new Date(item.fecha_solicitud).getTime();
      if (!Number.isFinite(created)) return false;
      // Sumamos fecha_asignacion si existe (es cuando entró a PROPUESTA);
      // si no existe usamos fecha_solicitud como aproximación conservadora.
      const reference = item.fecha_asignacion ? new Date(item.fecha_asignacion).getTime() : created;
      return now - reference >= DashboardPageComponent.STALE_PROPOSAL_MS;
    });
  });

  readonly solicitudesEscaladas = computed(() =>
    this.solicitudesOrdenadas().filter(
      (item) => (item.taller_rechazos_consecutivos ?? 0) >= 3,
    ),
  );

  readonly hayAlertasOperativas = computed(
    () => this.propuestasEstancadas().length > 0 || this.solicitudesEscaladas().length > 0,
  );

  /// In-route service tracking (incident → workshop polylines + ETA pills),
  /// keyed by solicitudId so we can refresh individual entries via WS later.
  readonly seguimientosActivos = signal<Record<number, SolicitudSeguimiento>>({});

  /// Routes ready to be drawn on the dashboard map. Combines seguimientos with
  /// the talleres signal to resolve workshop coordinates.
  readonly activeRoutes = computed<ActiveRoute[]>(() => {
    const tallerById = new Map<number, Taller>();
    for (const t of this.talleres()) tallerById.set(t.id, t);

    const result: ActiveRoute[] = [];
    for (const seg of Object.values(this.seguimientosActivos())) {
      // Incident coordinate: prefer the explicit servicio location, fallback to cliente.
      const incLat = seg.latitud_servicio ?? seg.latitud_cliente ?? null;
      const incLng = seg.longitud_servicio ?? seg.longitud_cliente ?? null;
      if (incLat == null || incLng == null) continue;

      // Workshop coordinate: prefer the seguimiento payload, fallback to the
      // talleres signal (since older backends may not include lat/lng there).
      let wsLat = seg.latitud_taller ?? null;
      let wsLng = seg.longitud_taller ?? null;
      if ((wsLat == null || wsLng == null) && seg.taller_id != null) {
        const t = tallerById.get(seg.taller_id);
        wsLat = t?.latitud ?? null;
        wsLng = t?.longitud ?? null;
      }
      if (wsLat == null || wsLng == null) continue;

      result.push({
        solicitudId: seg.solicitud_id,
        incident: { lat: incLat, lng: incLng },
        workshop: { lat: wsLat, lng: wsLng },
        color: seg.route_color || '#f97316',
        label: seg.taller_nombre || `#${seg.solicitud_id}`,
        fallbackEtaMin: seg.eta_min ?? undefined
      });
    }
    return result;
  });

  ngOnInit() {
    this.loadData();
    this.startKpiAutoRefresh();
    this.tracking.connect();
  }

  ngOnDestroy(): void {
    if (this.realtimeReloadTimer) {
      window.clearTimeout(this.realtimeReloadTimer);
      this.realtimeReloadTimer = null;
    }
    if (this.kpiAutoRefreshTimer) {
      window.clearInterval(this.kpiAutoRefreshTimer);
      this.kpiAutoRefreshTimer = null;
    }
    this.tracking.disconnect();
  }

  loadData() {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    const errors: string[] = [];
    const kpiDesde = this.buildDateQuery();

    forkJoin({
      solicitudes: this.api.getSolicitudesActivas().pipe(
        catchError((err) => {
          errors.push(this.formatError('Solicitudes activas', err));
          return of([] as Solicitud[]);
        })
      ),
      mapa: this.api.getMapaSolicitudes().pipe(
        catchError((err) => {
          errors.push(this.formatError('Mapa', err));
          return of([] as Array<Record<string, string | number>>);
        })
      ),
      talleres: this.api.getTalleres().pipe(
        catchError((err) => {
          errors.push(this.formatError('Talleres', err));
          return of([] as Taller[]);
        })
      ),
      kpis: this.api.getKpisResumen(kpiDesde).pipe(
        catchError((err) => {
          errors.push(this.formatError('KPIs', err));
          return of(null);
        })
      )
    })
      .pipe(
        finalize(() => {
          this.isLoading.set(false);
          if (this.reloadQueuedWhileLoading) {
            this.reloadQueuedWhileLoading = false;
            this.scheduleRealtimeReload();
          }
        })
      )
      .subscribe(({ solicitudes, mapa, talleres, kpis }) => {
        this.solicitudes.set(solicitudes);
        this.mapa.set(mapa as unknown as IncidentePunto[]);
        this.talleres.set(talleres);
        this.kpis.set(kpis);
        this.errorMessage.set(errors.length > 0 ? errors.join(' | ') : null);
        // Fire-and-forget: refresh in-route seguimientos so the dashboard map
        // can draw real routes + ETAs without blocking the main load.
        void this._loadActiveRoutes();
      });
  }

  setKpiRange(range: KpiRange) {
    if (this.kpiRange() === range) return;
    this.kpiRange.set(range);
    this.loadData();
  }

  kpiTrendTitle() {
    switch (this.kpiRange()) {
      case 'today':
        return 'Tendencia de hoy';
      case 'week':
        return 'Tendencia diaria (7 dias)';
      case 'month':
        return 'Tendencia diaria (30 dias)';
      case 'all':
      default:
        return 'Tendencia historica';
    }
  }

  kpiRangeLabel() {
    switch (this.kpiRange()) {
      case 'today':
        return 'Hoy';
      case 'week':
        return 'Ultimos 7 dias';
      case 'month':
        return 'Ultimos 30 dias';
      case 'all':
      default:
        return 'Todo el historico';
    }
  }

  formatKpiMin(value: number | null | undefined) {
    return value == null ? '--' : `${value.toFixed(1)} min`;
  }

  formatKpiPct(value: number | null | undefined) {
    return `${((value ?? 0) * 100).toFixed(1)}%`;
  }

  formatKpiTimestamp(value: string | null | undefined) {
    if (!value) return '--';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  exportKpiCsv() {
    const data = this.kpis();
    if (!data) return;
    const csvRow = (...values: unknown[]) => values.map((value) => this.escapeCsvValue(value)).join(',');

    const rows: string[] = [
      csvRow('KPI Dashboard', this.formatKpiTimestamp(data.calculado_en)),
      csvRow('Rango', this.kpiRangeLabel()),
      '',
      csvRow('Metrica', 'Valor'),
      csvRow('Total solicitudes', data.total_solicitudes),
      csvRow('Solicitudes activas', data.solicitudes_activas),
      csvRow('Solicitudes completadas', data.solicitudes_completadas),
      csvRow('Solicitudes canceladas', data.solicitudes_canceladas),
      csvRow('Tasa completados', this.formatKpiPct(data.tasa_completados)),
      csvRow('Tasa cancelacion', this.formatKpiPct(data.tasa_cancelacion)),
      csvRow('Tiempo asignacion promedio', this.formatKpiMin(data.tiempo_asignacion_promedio_min)),
      csvRow('Tiempo llegada promedio', this.formatKpiMin(data.tiempo_llegada_promedio_min)),
      csvRow('Tiempo atencion promedio', this.formatKpiMin(data.tiempo_atencion_promedio_min)),
      '',
      csvRow('Incidentes por tipo', 'Total'),
      ...Object.entries(data.incidentes_por_tipo ?? {}).map(([label, count]) =>
        csvRow(label, count)
      ),
      '',
      csvRow('Solicitudes por dia'),
      csvRow('Fecha', 'Total', 'Completados', 'Cancelados'),
      ...(data.solicitudes_por_dia ?? []).map((item) =>
        csvRow(item.fecha, item.total, item.completados, item.cancelados)
      ),
      '',
      csvRow('Talleres'),
      csvRow('Taller ID', 'Nombre', 'Total solicitudes', 'Completados', 'Tasa completados', 'T. atencion prom.'),
      ...(data.talleres ?? []).map((item) =>
        csvRow(
          item.taller_id,
          item.taller_nombre,
          item.total_solicitudes,
          item.completados,
          this.formatKpiPct(item.tasa_completados),
          this.formatKpiMin(item.tiempo_atencion_promedio_min),
        )
      ),
    ];

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kpi-dashboard-${this.kpiRange()}-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  private scheduleRealtimeReload() {
    if (this.isLoading()) {
      this.reloadQueuedWhileLoading = true;
      return;
    }
    if (this.realtimeReloadTimer) {
      window.clearTimeout(this.realtimeReloadTimer);
    }
    // solicitud_update and kpi_refresh often arrive together; debounce them
    // into a single dashboard refresh.
    this.realtimeReloadTimer = window.setTimeout(() => {
      this.realtimeReloadTimer = null;
      if (this.isLoading()) {
        this.reloadQueuedWhileLoading = true;
        return;
      }
      this.loadData();
    }, 250);
  }

  private startKpiAutoRefresh() {
    if (this.kpiAutoRefreshTimer) {
      window.clearInterval(this.kpiAutoRefreshTimer);
    }
    this.kpiAutoRefreshTimer = window.setInterval(() => {
      if (document.hidden || this.isLoading()) return;
      this.loadData();
    }, KPI_AUTO_REFRESH_MS);
  }

  /// Loads SolicitudSeguimiento for every in-route solicitud (limited to
  /// MAX_ACTIVE_ROUTES). Failures are silently ignored per solicitud.
  private async _loadActiveRoutes(): Promise<void> {
    const inRoute = this.solicitudes()
      .filter((s) => IN_ROUTE_STATES.includes(this.normalizeState(s.estado?.nombre)))
      .slice(0, MAX_ACTIVE_ROUTES);

    if (inRoute.length === 0) {
      if (Object.keys(this.seguimientosActivos()).length > 0) {
        this.seguimientosActivos.set({});
      }
      return;
    }

    const results = await Promise.all(
      inRoute.map(
        (s) =>
          new Promise<{ id: number; seg: SolicitudSeguimiento | null }>((resolve) => {
            this.api.getSeguimientoSolicitud(s.id).subscribe({
              next: (seg) => resolve({ id: s.id, seg }),
              error: () => resolve({ id: s.id, seg: null })
            });
          })
      )
    );

    const next: Record<number, SolicitudSeguimiento> = {};
    for (const { id, seg } of results) {
      if (seg) next[id] = seg;
    }
    this.seguimientosActivos.set(next);
  }

  seedAndReload() {
    if (!this.isDev) return;
    if (this.isLoading()) return;

    const confirmed = window.confirm('Esto borrará y recreará datos demo en la base de datos. ¿Continuar?');
    if (!confirmed) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.api
      .seedDevData('RESET')
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: () => this.loadData(),
        error: (err) => this.errorMessage.set(this.formatError('Seed', err))
      });
  }

  openIncident(id: number) {
    void this.router.navigate(['/solicitudes', id]);
  }

  priorityTone(priority: Solicitud['prioridad'] | string | null | undefined) {
    switch (String(priority || '').toUpperCase()) {
      case 'CRITICA':
        return 'critical';
      case 'ALTA':
        return 'warning';
      case 'MEDIA':
        return 'info';
      case 'BAJA':
        return 'success';
      default:
        return 'neutral';
    }
  }

  stateTone(state: string | null | undefined) {
    switch (this.normalizeState(state)) {
      case 'EN_CAMINO':
      case 'ASIGNADA':
        return 'info';
      case 'EN_ATENCION':
        return 'warning';
      case 'COMPLETADA':
        return 'success';
      case 'CANCELADA':
      case 'RECHAZADA':
        return 'critical';
      default:
        return 'neutral';
    }
  }

  incidentTone(state: string | null | undefined) {
    const normalized = this.normalizeState(state);
    if (normalized === 'CRITICA') return 'critical';
    if (normalized === 'ACTIVO') return 'info';
    return 'neutral';
  }

  private formatError(label: string, err: unknown) {
    const anyErr = err as { status?: number; message?: string; error?: unknown };
    const status = anyErr?.status != null ? ` (${anyErr.status})` : '';
    const rawDetail =
      (anyErr?.error as { detail?: unknown } | undefined)?.detail ?? anyErr?.message ?? 'Error';
    const detail =
      typeof rawDetail === 'string'
        ? rawDetail
        : (() => {
            try {
              return JSON.stringify(rawDetail);
            } catch {
              return String(rawDetail);
            }
          })();
    return `${label}${status}: ${detail}`;
  }

  private normalizeState(state: string | null | undefined) {
    return String(state || '').trim().toUpperCase();
  }

  private buildDateQuery() {
    const now = new Date();
    switch (this.kpiRange()) {
      case 'today':
        return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      case 'all':
      default:
        return null;
    }
  }

  private escapeCsvValue(value: unknown) {
    const normalized = String(value ?? '');
    if (!/[",\n]/.test(normalized)) {
      return normalized;
    }
    return `"${normalized.replace(/"/g, '""')}"`;
  }
}

export {};
