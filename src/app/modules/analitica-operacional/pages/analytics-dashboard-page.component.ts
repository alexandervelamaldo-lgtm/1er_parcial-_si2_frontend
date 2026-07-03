import { CommonModule, DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  AnalyticsService,
  DashboardKPIsResponse,
  TiempoPromedioKPI,
} from '../../../core/services/analytics/analytics.service';

/**
 * Dashboard de analítica operacional para administradores.
 *
 * Muestra los 9 KPIs definidos en el backend (`/analytics/dashboard`):
 *   K1-K4: tiempos promedio (avg + p50 + p95)
 *   K5:    incidentes por tipo (barras horizontales)
 *   K6:    top talleres más eficientes (tabla)
 *   K7:    zonas calientes (tabla geográfica)
 *   K8:    cancelaciones (tasa + desglose)
 *   K9:    cumplimiento SLA (gauges por etapa)
 *
 * Diseño:
 *   - Standalone + signals (convención del proyecto).
 *   - SIN dependencias gráficas externas — usamos SVG inline para
 *     barras/gauges. Mantiene el bundle pequeño.
 *   - Cuando n_muestras=0 mostramos "—", NUNCA "0 min" (el backend no
 *     fabrica datos; nosotros tampoco).
 *   - Tema claro/oscuro respetando las variables CSS globales.
 */
@Component({
  selector: 'app-analytics-dashboard-page',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  template: `
    <section class="wrap">
      <header class="page-head">
        <div>
          <h2>Analítica operacional</h2>
          <p>Indicadores en tiempo real del rendimiento de la plataforma. Cache 60s.</p>
        </div>
        <div class="filters">
          <label>
            <span>Desde</span>
            <input type="date" [(ngModel)]="since" (change)="load()" />
          </label>
          <label>
            <span>Hasta</span>
            <input type="date" [(ngModel)]="until" (change)="load()" />
          </label>
          <button class="btn-primary" (click)="load()" [disabled]="loading()">
            {{ loading() ? 'Cargando…' : 'Refrescar' }}
          </button>
        </div>
      </header>

      <div class="alert error" *ngIf="errorMessage()">{{ errorMessage() }}</div>

      <ng-container *ngIf="data() as d">
        <!-- ── KPIs de tiempo ─────────────────────────────────────── -->
        <div class="kpi-grid">
          <div class="kpi-tile">
            <div class="kpi-label">Tiempo de asignación</div>
            <div class="kpi-value">{{ formatMin(d.tiempo_asignacion.avg_min) }}</div>
            <div class="kpi-sub">
              p50 {{ formatMin(d.tiempo_asignacion.p50_min) }} ·
              p95 {{ formatMin(d.tiempo_asignacion.p95_min) }} ·
              n={{ d.tiempo_asignacion.n_muestras }}
            </div>
          </div>
          <div class="kpi-tile">
            <div class="kpi-label">Tiempo de llegada</div>
            <div class="kpi-value">{{ formatMin(d.tiempo_llegada.avg_min) }}</div>
            <div class="kpi-sub">
              p50 {{ formatMin(d.tiempo_llegada.p50_min) }} ·
              p95 {{ formatMin(d.tiempo_llegada.p95_min) }} ·
              n={{ d.tiempo_llegada.n_muestras }}
            </div>
          </div>
          <div class="kpi-tile">
            <div class="kpi-label">Tiempo de cierre</div>
            <div class="kpi-value">{{ formatMin(d.tiempo_cierre.avg_min) }}</div>
            <div class="kpi-sub">
              p50 {{ formatMin(d.tiempo_cierre.p50_min) }} ·
              p95 {{ formatMin(d.tiempo_cierre.p95_min) }} ·
              n={{ d.tiempo_cierre.n_muestras }}
            </div>
          </div>
          <div class="kpi-tile">
            <div class="kpi-label">Tiempo end-to-end</div>
            <div class="kpi-value">{{ formatMin(d.tiempo_end_to_end.avg_min) }}</div>
            <div class="kpi-sub">
              p50 {{ formatMin(d.tiempo_end_to_end.p50_min) }} ·
              p95 {{ formatMin(d.tiempo_end_to_end.p95_min) }} ·
              n={{ d.tiempo_end_to_end.n_muestras }}
            </div>
          </div>
        </div>

        <div class="row two-cols">
          <!-- ── K5 Incidentes por tipo ──────────────────────────── -->
          <div class="card">
            <h3>Incidentes por tipo</h3>
            <p class="subtitle">Total: {{ d.incidentes_por_tipo.total }}</p>
            <div *ngIf="d.incidentes_por_tipo.items.length === 0" class="empty">
              Sin incidentes en el rango seleccionado.
            </div>
            <div class="bar-list">
              <div class="bar-row" *ngFor="let item of d.incidentes_por_tipo.items">
                <div class="bar-label">{{ item.label }} <span class="muted">({{ item.count }})</span></div>
                <div class="bar-track">
                  <div class="bar-fill" [style.width.%]="item.porcentaje"></div>
                </div>
                <div class="bar-value">{{ item.porcentaje | number:'1.1-1' }}%</div>
              </div>
            </div>
          </div>

          <!-- ── K9 SLA ──────────────────────────────────────────── -->
          <div class="card">
            <h3>Cumplimiento SLA</h3>
            <p class="subtitle">
              Umbrales:
              {{ d.sla.umbrales['sla_asignacion_min'] }}/{{ d.sla.umbrales['sla_llegada_min'] }}/{{ d.sla.umbrales['sla_cierre_min'] }} min
            </p>
            <div class="sla-grid">
              <div class="sla-gauge">
                <div class="gauge" [style.--pct]="(d.sla.sla_asignacion_pct ?? 0)">
                  <svg viewBox="0 0 36 36" class="circular">
                    <path class="track" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                    <path class="fill" [attr.stroke-dasharray]="(d.sla.sla_asignacion_pct ?? 0) + ', 100'"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                  </svg>
                  <span class="gauge-pct">{{ formatPct(d.sla.sla_asignacion_pct) }}</span>
                </div>
                <span class="gauge-label">Asignación</span>
                <span class="muted">n={{ d.sla.n_evaluadas_asignacion }}</span>
              </div>
              <div class="sla-gauge">
                <div class="gauge">
                  <svg viewBox="0 0 36 36" class="circular">
                    <path class="track" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                    <path class="fill" [attr.stroke-dasharray]="(d.sla.sla_llegada_pct ?? 0) + ', 100'"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                  </svg>
                  <span class="gauge-pct">{{ formatPct(d.sla.sla_llegada_pct) }}</span>
                </div>
                <span class="gauge-label">Llegada</span>
                <span class="muted">n={{ d.sla.n_evaluadas_llegada }}</span>
              </div>
              <div class="sla-gauge">
                <div class="gauge">
                  <svg viewBox="0 0 36 36" class="circular">
                    <path class="track" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                    <path class="fill" [attr.stroke-dasharray]="(d.sla.sla_cierre_pct ?? 0) + ', 100'"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                  </svg>
                  <span class="gauge-pct">{{ formatPct(d.sla.sla_cierre_pct) }}</span>
                </div>
                <span class="gauge-label">Cierre</span>
                <span class="muted">n={{ d.sla.n_evaluadas_cierre }}</span>
              </div>
              <div class="sla-gauge global">
                <div class="gauge">
                  <svg viewBox="0 0 36 36" class="circular">
                    <path class="track" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                    <path class="fill" [attr.stroke-dasharray]="(d.sla.sla_global_pct ?? 0) + ', 100'"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                  </svg>
                  <span class="gauge-pct">{{ formatPct(d.sla.sla_global_pct) }}</span>
                </div>
                <span class="gauge-label"><strong>Global</strong></span>
                <span class="muted">n={{ d.sla.n_evaluadas_global }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ── K6 Talleres ranking ──────────────────────────────── -->
        <div class="card">
          <h3>Talleres más eficientes</h3>
          <p class="subtitle">
            Score híbrido (40% llegada + 30% cierre + 20% tasa cierre + 10% rating). Mínimo {{ d.talleres_top.min_casos_para_ranking }} casos.
          </p>
          <table class="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Taller</th>
                <th class="num">Score</th>
                <th class="num">Llegada</th>
                <th class="num">Cierre</th>
                <th class="num">Casos</th>
                <th class="num">Tasa cierre</th>
                <th class="num">Rating</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let t of d.talleres_top.items; let i = index">
                <td>{{ i + 1 }}</td>
                <td>{{ t.nombre }}</td>
                <td class="num">
                  <strong>{{ t.score | number:'1.2-2' }}</strong>
                </td>
                <td class="num">{{ formatMin(t.tiempo_promedio_llegada) }}</td>
                <td class="num">{{ formatMin(t.tiempo_promedio_cierre) }}</td>
                <td class="num">{{ t.casos_atendidos }}</td>
                <td class="num">{{ t.tasa_completadas_pct | number:'1.0-1' }}%</td>
                <td class="num">{{ t.rating_promedio | number:'1.1-1' }}</td>
              </tr>
              <tr *ngIf="d.talleres_top.items.length === 0">
                <td colspan="8" class="empty">Sin talleres con suficientes casos en el rango.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="row two-cols">
          <!-- ── K7 Zonas calientes ──────────────────────────────── -->
          <div class="card">
            <h3>Zonas con más incidentes</h3>
            <p class="subtitle">Top 20 celdas (~111m de lado).</p>
            <table class="data-table compact">
              <thead>
                <tr>
                  <th>Latitud</th>
                  <th>Longitud</th>
                  <th class="num">Incidentes</th>
                  <th>Tipo predominante</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let z of d.zonas_calientes.items">
                  <td><code>{{ z.lat | number:'1.3-3' }}</code></td>
                  <td><code>{{ z.lng | number:'1.3-3' }}</code></td>
                  <td class="num"><strong>{{ z.count }}</strong></td>
                  <td>{{ z.tipo_predominante ?? '—' }}</td>
                </tr>
                <tr *ngIf="d.zonas_calientes.items.length === 0">
                  <td colspan="4" class="empty">Sin datos geográficos en el rango.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- ── K8 Cancelaciones ────────────────────────────────── -->
          <div class="card">
            <h3>Cancelaciones</h3>
            <p class="subtitle">
              Tasa: <strong>{{ d.cancelaciones.tasa_pct | number:'1.1-1' }}%</strong>
              ({{ d.cancelaciones.total_canceladas }} de {{ d.cancelaciones.total_solicitudes }})
            </p>
            <div class="bar-list">
              <div class="bar-row" *ngFor="let entry of cancelMotivos()">
                <div class="bar-label">{{ entry.label }} <span class="muted">({{ entry.count }})</span></div>
                <div class="bar-track">
                  <div class="bar-fill warn" [style.width.%]="entry.pct"></div>
                </div>
                <div class="bar-value">{{ entry.pct | number:'1.0-1' }}%</div>
              </div>
              <div *ngIf="cancelMotivos().length === 0" class="empty">
                Sin cancelaciones en el rango.
              </div>
            </div>
          </div>
        </div>

        <p class="footer-meta">
          Generado: {{ d.generado_en | date:'medium' }} · Rango {{ d.desde }} → {{ d.hasta }}
        </p>
      </ng-container>

      <ng-template #loadingTpl>
        <p class="loading">Cargando datos…</p>
      </ng-template>
    </section>
  `,
  styles: [`
    .wrap { padding: 20px; max-width: 1280px; margin: 0 auto; }
    .page-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; flex-wrap: wrap; margin-bottom: 20px; }
    .page-head h2 { margin: 0 0 4px; }
    .page-head p { margin: 0; color: var(--color-text-muted, #64748B); font-size: 13px; }
    .filters { display: flex; gap: 12px; align-items: flex-end; }
    .filters label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--color-text-muted, #64748B); }
    .filters input { padding: 6px 8px; border: 1px solid var(--color-border, #CBD5E1); border-radius: 6px; }
    .btn-primary { padding: 8px 16px; background: #2563EB; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .alert.error { padding: 10px 14px; background: #FEE2E2; color: #991B1B; border-radius: 6px; margin-bottom: 16px; }

    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .kpi-tile { background: var(--color-card, #FFFFFF); border: 1px solid var(--color-border, #E2E8F0); border-radius: 10px; padding: 16px; }
    .kpi-label { font-size: 12px; color: var(--color-text-muted, #64748B); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
    .kpi-value { font-size: 28px; font-weight: 700; color: #1E40AF; margin-top: 4px; }
    .kpi-sub { font-size: 11px; color: var(--color-text-muted, #94A3B8); margin-top: 6px; }

    .row { display: flex; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
    .row.two-cols > .card { flex: 1 1 calc(50% - 8px); min-width: 320px; }
    .card { background: var(--color-card, #FFFFFF); border: 1px solid var(--color-border, #E2E8F0); border-radius: 10px; padding: 16px; }
    .card h3 { margin: 0 0 4px; font-size: 16px; }
    .subtitle { margin: 0 0 12px; color: var(--color-text-muted, #64748B); font-size: 12px; }
    .empty { color: var(--color-text-muted, #94A3B8); font-style: italic; text-align: center; padding: 12px; }

    .bar-list { display: flex; flex-direction: column; gap: 8px; }
    .bar-row { display: grid; grid-template-columns: 140px 1fr 50px; gap: 8px; align-items: center; font-size: 13px; }
    .bar-label { color: var(--color-text, #0F172A); }
    .bar-track { background: var(--color-border, #E2E8F0); height: 8px; border-radius: 4px; overflow: hidden; }
    .bar-fill { background: linear-gradient(90deg, #60A5FA, #2563EB); height: 100%; }
    .bar-fill.warn { background: linear-gradient(90deg, #FCD34D, #F59E0B); }
    .bar-value { text-align: right; font-weight: 600; font-size: 12px; }
    .muted { color: var(--color-text-muted, #94A3B8); font-size: 11px; }

    .sla-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .sla-gauge { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px; border-radius: 8px; }
    .sla-gauge.global { background: #DBEAFE; }
    .gauge { position: relative; width: 72px; height: 72px; }
    .gauge .circular { width: 100%; height: 100%; transform: rotate(-90deg); }
    .gauge .track { fill: none; stroke: #E2E8F0; stroke-width: 3; }
    .gauge .fill { fill: none; stroke: #2563EB; stroke-width: 3; stroke-linecap: round; transition: stroke-dasharray 0.4s ease; }
    .gauge-pct { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-weight: 700; font-size: 14px; }
    .gauge-label { font-size: 12px; font-weight: 600; }

    .data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .data-table thead { background: var(--color-border, #F1F5F9); }
    .data-table th, .data-table td { padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--color-border, #E2E8F0); }
    .data-table th.num, .data-table td.num { text-align: right; }
    .data-table.compact th, .data-table.compact td { padding: 6px 8px; font-size: 12px; }

    .footer-meta { margin-top: 12px; color: var(--color-text-muted, #94A3B8); font-size: 11px; text-align: right; }
    .loading { text-align: center; color: var(--color-text-muted, #64748B); padding: 40px; }
  `],
})
export class AnalyticsDashboardPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(AnalyticsService);

  readonly data = signal<DashboardKPIsResponse | null>(null);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  /** El rango por defecto es últimos 30 días — coincide con backend. */
  since = this.daysAgo(30);
  until = this.daysAgo(0);

  private intervalId: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.load();
    // Auto-refresh cada 60s mientras la pestaña esté visible.
    this.intervalId = setInterval(() => {
      if (document.visibilityState === 'visible' && !this.loading()) {
        this.load(true);
      }
    }, 60_000);
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  load(silent = false): void {
    if (!silent) {
      this.loading.set(true);
      this.errorMessage.set(null);
    }
    this.api.getDashboard({ since: this.since, until: this.until }).subscribe({
      next: (response) => {
        this.data.set(response);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        const detail = err?.error?.detail || err?.message || 'Error al cargar el dashboard';
        this.errorMessage.set(`No se pudo cargar la analítica: ${detail}`);
      },
    });
  }

  /** Tiempos en minutos → "12 min" o "—" si null. NUNCA mostrar "0 min"
   * a partir de null, eso sería fabricar datos. */
  formatMin(value: number | null | undefined): string {
    if (value == null) return '—';
    if (value < 1) return '<1 min';
    if (value < 60) return `${Math.round(value)} min`;
    const hours = Math.floor(value / 60);
    const mins = Math.round(value % 60);
    return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
  }

  formatPct(value: number | null | undefined): string {
    if (value == null) return '—';
    return `${Math.round(value)}%`;
  }

  /** Convierte `por_motivo` en filas con porcentajes para la barra visual. */
  readonly cancelMotivos = computed(() => {
    const d = this.data();
    if (!d) return [];
    const labels: Record<string, string> = {
      cliente_cancelo: 'Cliente canceló',
      taller_rechazo: 'Taller rechazó',
      timeout: 'Timeout sin asignar',
      otros: 'Otros',
    };
    const total = d.cancelaciones.total_canceladas;
    return Object.entries(d.cancelaciones.por_motivo)
      .map(([key, count]) => ({
        label: labels[key] ?? key,
        count,
        pct: total > 0 ? (count / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  });

  private daysAgo(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }
}
