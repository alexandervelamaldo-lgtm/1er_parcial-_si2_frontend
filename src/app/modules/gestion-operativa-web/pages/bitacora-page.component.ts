import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  BitacoraFilters,
  BitacoraItem,
  BitacoraListResponse,
  BitacoraService,
} from '../../../core/services/gestion-operativa-web/bitacora.service';

/**
 * Bitácora del tenant — registro de auditoría de las acciones mutantes
 * (crear/actualizar/eliminar) que `TenantAuditMiddleware` persiste en el
 * backend. Restringida a roles administrativos/operativos por el route
 * guard; el backend vuelve a validar el rol y el aislamiento por tenant,
 * así que es defensa en profundidad.
 */
@Component({
  selector: 'app-bitacora-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="wrap">
      <header class="page-head">
        <div>
          <h2>Bitácora de auditoría</h2>
          <p>Quién hizo qué y cuándo dentro de tu organización. Solo se registran acciones exitosas.</p>
        </div>
        <button class="btn-secondary" (click)="reload()" [disabled]="loading()">
          {{ loading() ? 'Cargando…' : 'Actualizar' }}
        </button>
      </header>

      <!-- Barra de filtros ------------------------------------------------- -->
      <form class="filters" (ngSubmit)="applyFilters()">
        <label>
          <span>Desde</span>
          <input type="date" name="since" [(ngModel)]="form.since" [max]="form.until || null" />
        </label>
        <label>
          <span>Hasta</span>
          <input type="date" name="until" [(ngModel)]="form.until" [min]="form.since || null" />
        </label>
        <label>
          <span>Entidad</span>
          <input name="entidad" [(ngModel)]="form.entidad" list="entidades" placeholder="Todas" autocomplete="off" />
          <datalist id="entidades">
            <option value="solicitud"></option>
            <option value="taller"></option>
            <option value="tecnico"></option>
            <option value="cliente"></option>
            <option value="vehiculo"></option>
            <option value="cotizacion"></option>
            <option value="pago"></option>
          </datalist>
        </label>
        <label class="grow">
          <span>Búsqueda</span>
          <input name="q" [(ngModel)]="form.q" placeholder="Acción o ruta…" autocomplete="off" />
        </label>
        <div class="filter-actions">
          <button type="submit" class="btn-primary" [disabled]="loading()">Filtrar</button>
          <button type="button" class="btn-link" (click)="clearFilters()" [disabled]="loading()">Limpiar</button>
        </div>
      </form>

      <div class="alert error" *ngIf="errorMessage()">{{ errorMessage() }}</div>

      <table class="bitacora-table" *ngIf="!loading(); else loadingTpl">
        <thead>
          <tr>
            <th>Fecha y hora</th>
            <th>Usuario</th>
            <th>Acción</th>
            <th>Entidad</th>
            <th>Petición</th>
            <th class="num">Estado</th>
            <th>IP</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let item of items()">
            <td class="when">{{ item.created_at | date:'dd/MM/yy HH:mm:ss' }}</td>
            <td class="user">
              <span *ngIf="item.user_email">{{ item.user_email }}</span>
              <span *ngIf="!item.user_email && item.user_id !== null" class="muted">#{{ item.user_id }}</span>
              <span *ngIf="!item.user_email && item.user_id === null" class="muted">Anónimo</span>
            </td>
            <td class="accion">{{ item.accion }}</td>
            <td>
              <span class="chip" *ngIf="item.entidad">
                {{ item.entidad }}<span *ngIf="item.entidad_id"> · {{ item.entidad_id }}</span>
              </span>
              <span class="muted" *ngIf="!item.entidad">—</span>
            </td>
            <td class="req">
              <span class="method" [ngClass]="metodoClass(item.metodo)">{{ item.metodo }}</span>
              <code>{{ item.ruta }}</code>
            </td>
            <td class="num">
              <span class="status" [ngClass]="statusClass(item.status_code)">{{ item.status_code }}</span>
            </td>
            <td class="ip"><code *ngIf="item.ip">{{ item.ip }}</code><span class="muted" *ngIf="!item.ip">—</span></td>
          </tr>
          <tr *ngIf="items().length === 0">
            <td colspan="7" class="empty">No hay acciones registradas con estos filtros.</td>
          </tr>
        </tbody>
      </table>
      <ng-template #loadingTpl><p class="loading">Cargando bitácora…</p></ng-template>

      <!-- Paginación ------------------------------------------------------- -->
      <footer class="pager" *ngIf="total() > 0">
        <div class="page-size">
          <span>Por página</span>
          <select [ngModel]="limit()" (ngModelChange)="changePageSize($event)" name="pageSize">
            <option [ngValue]="25">25</option>
            <option [ngValue]="50">50</option>
            <option [ngValue]="100">100</option>
          </select>
        </div>
        <div class="page-info">Mostrando {{ rangeStart() }}–{{ rangeEnd() }} de {{ total() }}</div>
        <div class="page-nav">
          <button class="btn-secondary" (click)="prevPage()" [disabled]="!canPrev() || loading()">‹ Anterior</button>
          <button class="btn-secondary" (click)="nextPage()" [disabled]="!canNext() || loading()">Siguiente ›</button>
        </div>
      </footer>
    </section>
  `,
  styles: [`
    .wrap { padding: 24px; max-width: 1240px; margin: 0 auto; }
    .page-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin-bottom: 20px; }
    .page-head h2 { margin: 0 0 4px; }
    .page-head p { margin: 0; color: #64748b; }

    .btn-primary { background: #2563eb; color: white; border: none; padding: 9px 18px; border-radius: 10px; font-weight: 700; cursor: pointer; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary { background: #f1f5f9; color: #0f172a; border: none; padding: 8px 14px; border-radius: 10px; cursor: pointer; font-weight: 600; }
    .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-link { background: none; border: none; color: #2563eb; cursor: pointer; padding: 4px 8px; font-weight: 600; }
    .btn-link:disabled { opacity: 0.5; cursor: not-allowed; }

    .filters { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; background: white; padding: 16px; border-radius: 12px; box-shadow: 0 2px 8px rgba(15,23,42,0.06); margin-bottom: 18px; }
    .filters label { display: grid; gap: 4px; font-size: 12px; color: #475569; font-weight: 600; }
    .filters label.grow { flex: 1; min-width: 180px; }
    .filters input, .filters select { padding: 8px 10px; border-radius: 9px; border: 1px solid #cbd5e1; font-size: 14px; }
    .filter-actions { display: flex; align-items: center; gap: 6px; }

    .bitacora-table { width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(15,23,42,0.06); }
    .bitacora-table th, .bitacora-table td { padding: 11px 14px; border-bottom: 1px solid #f1f5f9; text-align: left; vertical-align: top; }
    .bitacora-table th { background: #f8fafc; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; white-space: nowrap; }
    .bitacora-table tbody tr:hover { background: #f8fafc; }
    .bitacora-table .num { text-align: right; }
    .bitacora-table .empty { text-align: center; color: #94a3b8; padding: 28px 16px; }
    .bitacora-table .when { white-space: nowrap; font-variant-numeric: tabular-nums; color: #334155; }
    .bitacora-table .accion { font-weight: 600; color: #0f172a; }
    .bitacora-table .user { color: #334155; word-break: break-all; }
    .bitacora-table code { font-size: 12px; color: #475569; background: #f1f5f9; padding: 1px 6px; border-radius: 6px; }
    .req code { display: inline-block; margin-top: 2px; }
    .muted { color: #94a3b8; }

    .chip { display: inline-block; background: #eef2ff; color: #4338ca; font-size: 12px; padding: 2px 9px; border-radius: 999px; font-weight: 600; }
    .method { display: inline-block; font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 6px; margin-right: 6px; letter-spacing: 0.4px; }
    .method.m-create { background: #dcfce7; color: #166534; }
    .method.m-update { background: #fef3c7; color: #92400e; }
    .method.m-delete { background: #fee2e2; color: #991b1b; }
    .method.m-other { background: #e2e8f0; color: #334155; }
    .status { display: inline-block; min-width: 34px; text-align: center; font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 999px; font-variant-numeric: tabular-nums; }
    .status.s-ok { background: #dcfce7; color: #166534; }
    .status.s-redirect { background: #dbeafe; color: #1d4ed8; }
    .status.s-warn { background: #fef3c7; color: #92400e; }
    .status.s-err { background: #fee2e2; color: #991b1b; }

    .alert { padding: 12px 16px; border-radius: 10px; margin-bottom: 16px; font-weight: 600; }
    .alert.error { background: #fee2e2; color: #991b1b; }
    .loading { color: #64748b; padding: 28px 4px; }

    .pager { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 16px; flex-wrap: wrap; }
    .pager .page-size { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #475569; }
    .pager .page-size select { padding: 6px 8px; border-radius: 8px; border: 1px solid #cbd5e1; }
    .pager .page-info { color: #64748b; font-size: 13px; font-variant-numeric: tabular-nums; }
    .pager .page-nav { display: flex; gap: 8px; }
  `]
})
export class BitacoraPageComponent {
  private readonly api = inject(BitacoraService);

  readonly loading = signal<boolean>(true);
  readonly errorMessage = signal<string | null>(null);
  readonly response = signal<BitacoraListResponse | null>(null);
  readonly limit = signal<number>(50);
  readonly offset = signal<number>(0);

  form: { since: string; until: string; entidad: string; q: string } = {
    since: '',
    until: '',
    entidad: '',
    q: '',
  };

  readonly items = computed<BitacoraItem[]>(() => this.response()?.items ?? []);
  readonly total = computed<number>(() => this.response()?.total ?? 0);
  readonly rangeStart = computed<number>(() => (this.total() === 0 ? 0 : this.offset() + 1));
  readonly rangeEnd = computed<number>(() => Math.min(this.offset() + this.items().length, this.total()));
  readonly canPrev = computed<boolean>(() => this.offset() > 0);
  readonly canNext = computed<boolean>(() => this.offset() + this.limit() < this.total());

  constructor() {
    this.load();
  }

  private buildFilters(): BitacoraFilters {
    const f: BitacoraFilters = { limit: this.limit(), offset: this.offset() };
    const since = this.form.since.trim();
    const until = this.form.until.trim();
    if (since) f.since = since;
    // Un valor `date` (YYYY-MM-DD) representa medianoche; para que "hasta"
    // incluya todo el día seleccionado lo extendemos al final del día.
    if (until) f.until = until.length === 10 ? `${until}T23:59:59` : until;
    const entidad = this.form.entidad.trim();
    if (entidad) f.entidad = entidad;
    const q = this.form.q.trim();
    if (q) f.q = q;
    return f;
  }

  load(): void {
    // Validación cliente: feedback inmediato antes de molestar al backend.
    if (this.form.since && this.form.until && this.form.since > this.form.until) {
      this.errorMessage.set("La fecha 'Desde' no puede ser mayor que 'Hasta'.");
      return;
    }
    this.loading.set(true);
    this.errorMessage.set(null);
    this.api.list(this.buildFilters()).subscribe({
      next: (data) => {
        this.response.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.detail || 'No se pudo cargar la bitácora.');
        this.loading.set(false);
      },
    });
  }

  reload(): void {
    this.load();
  }

  applyFilters(): void {
    this.offset.set(0);
    this.load();
  }

  clearFilters(): void {
    this.form = { since: '', until: '', entidad: '', q: '' };
    this.offset.set(0);
    this.load();
  }

  changePageSize(size: number): void {
    this.limit.set(Number(size));
    this.offset.set(0);
    this.load();
  }

  nextPage(): void {
    if (!this.canNext()) return;
    this.offset.set(this.offset() + this.limit());
    this.load();
  }

  prevPage(): void {
    if (!this.canPrev()) return;
    this.offset.set(Math.max(0, this.offset() - this.limit()));
    this.load();
  }

  metodoClass(metodo: string): string {
    switch ((metodo || '').toUpperCase()) {
      case 'POST': return 'm-create';
      case 'PUT':
      case 'PATCH': return 'm-update';
      case 'DELETE': return 'm-delete';
      default: return 'm-other';
    }
  }

  statusClass(code: number): string {
    if (code >= 500) return 's-err';
    if (code >= 400) return 's-warn';
    if (code >= 300) return 's-redirect';
    return 's-ok';
  }
}
