import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  BackupFrequency,
  BackupItem,
  BackupListResponse,
  BackupService,
  ScheduleResponse,
} from '../../../core/services/gestion-operativa-web/backup.service';

/**
 * Respaldos del tenant — copia de seguridad manual + automática de la base
 * de datos de la organización. Restringida a roles administrativos/operativos
 * por el route guard; el backend revalida el rol y respalda/restaura SOLO la
 * BD del tenant del request (un taller jamás opera sobre la base de otro).
 *
 * Acciones por respaldo: descargar el .dump, restaurar (destructivo, con
 * confirmación) y borrar. La tarjeta de "backup automático" programa copias
 * periódicas (cada hora / diario a una hora / semanal) y poda las más viejas
 * según la retención configurada.
 */
@Component({
  selector: 'app-backup-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="wrap">
      <header class="page-head">
        <div>
          <h2>Respaldos de la base de datos</h2>
          <p>Crea copias de seguridad de tu organización y restáuralas cuando lo necesites.</p>
        </div>
        <div class="head-actions">
          <button class="btn-secondary" (click)="reload()" [disabled]="loading()">
            {{ loading() ? 'Cargando…' : 'Actualizar' }}
          </button>
          <button class="btn-primary" (click)="createNow()" [disabled]="!pgAvailable() || creating()">
            {{ creating() ? 'Creando…' : 'Crear backup ahora' }}
          </button>
        </div>
      </header>

      <div class="alert warn" *ngIf="response() && !pgAvailable()">
        Las herramientas de PostgreSQL (pg_dump/pg_restore) no están disponibles en el servidor,
        por lo que crear y restaurar respaldos está deshabilitado. Avisa al administrador del sistema.
      </div>
      <div class="alert error" *ngIf="errorMessage()">{{ errorMessage() }}</div>
      <div class="alert ok" *ngIf="successMessage()">{{ successMessage() }}</div>

      <!-- Backup automático ------------------------------------------------- -->
      <section class="card schedule" *ngIf="schedule() as sch">
        <div class="card-head">
          <div>
            <h3>Backup automático</h3>
            <p>Programa copias periódicas sin intervención manual.</p>
          </div>
          <label class="switch">
            <input type="checkbox" name="enabled" [(ngModel)]="scheduleForm.enabled" />
            <span>{{ scheduleForm.enabled ? 'Activado' : 'Desactivado' }}</span>
          </label>
        </div>

        <div class="schedule-grid" [class.disabled]="!scheduleForm.enabled">
          <label>
            <span>Frecuencia</span>
            <select name="frequency" [(ngModel)]="scheduleForm.frequency" [disabled]="!scheduleForm.enabled">
              <option value="hourly">Cada hora</option>
              <option value="daily">Diario</option>
              <option value="weekly">Semanal</option>
            </select>
          </label>
          <label *ngIf="scheduleForm.frequency === 'daily'">
            <span>Hora (0–23)</span>
            <input type="number" name="hour" min="0" max="23" [(ngModel)]="scheduleForm.hour" [disabled]="!scheduleForm.enabled" />
          </label>
          <label>
            <span>Copias a conservar</span>
            <input type="number" name="retention" min="1" max="50" [(ngModel)]="scheduleForm.retention" [disabled]="!scheduleForm.enabled" />
          </label>
          <div class="schedule-actions">
            <button class="btn-primary" (click)="saveSchedule()" [disabled]="savingSchedule()">
              {{ savingSchedule() ? 'Guardando…' : 'Guardar programación' }}
            </button>
          </div>
        </div>

        <div class="schedule-meta">
          <span>Última ejecución:
            <strong>{{ sch.last_run ? (sch.last_run | date:'dd/MM/yy HH:mm') : 'Nunca' }}</strong>
          </span>
          <span *ngIf="scheduleForm.enabled && sch.next_run">Próxima estimada:
            <strong>{{ sch.next_run | date:'dd/MM/yy HH:mm' }}</strong>
          </span>
          <span class="hint">Solo las copias automáticas se podan; las manuales se conservan hasta que las borres.</span>
        </div>
      </section>

      <!-- Lista de respaldos ----------------------------------------------- -->
      <table class="backup-table" *ngIf="!loading(); else loadingTpl">
        <thead>
          <tr>
            <th>Fecha y hora</th>
            <th>Tipo</th>
            <th class="num">Tamaño</th>
            <th>Archivo</th>
            <th class="actions-col">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let item of items()">
            <td class="when">{{ item.created_at | date:'dd/MM/yy HH:mm:ss' }}</td>
            <td>
              <span class="chip" [ngClass]="item.kind === 'auto' ? 'k-auto' : 'k-manual'">
                {{ item.kind === 'auto' ? 'Automático' : 'Manual' }}
              </span>
            </td>
            <td class="num size">{{ item.size_human }}</td>
            <td class="file"><code>{{ item.name }}</code></td>
            <td class="actions">
              <button class="btn-link" (click)="download(item)" [disabled]="downloadingName() === item.name">
                {{ downloadingName() === item.name ? 'Descargando…' : 'Descargar' }}
              </button>
              <button class="btn-link warn" (click)="restore(item)" [disabled]="!pgAvailable() || busy()">
                {{ restoringName() === item.name ? 'Restaurando…' : 'Restaurar' }}
              </button>
              <button class="btn-link danger" (click)="remove(item)" [disabled]="busy()">
                {{ deletingName() === item.name ? 'Borrando…' : 'Borrar' }}
              </button>
            </td>
          </tr>
          <tr *ngIf="items().length === 0">
            <td colspan="5" class="empty">Todavía no hay respaldos. Crea el primero con “Crear backup ahora”.</td>
          </tr>
        </tbody>
      </table>
      <ng-template #loadingTpl><p class="loading">Cargando respaldos…</p></ng-template>
    </section>
  `,
  styles: [`
    .wrap { padding: 24px; max-width: 1100px; margin: 0 auto; }
    .page-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin-bottom: 20px; }
    .page-head h2 { margin: 0 0 4px; }
    .page-head p { margin: 0; color: #64748b; }
    .head-actions { display: flex; gap: 8px; align-items: center; }

    .btn-primary { background: #2563eb; color: white; border: none; padding: 9px 18px; border-radius: 10px; font-weight: 700; cursor: pointer; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary { background: #f1f5f9; color: #0f172a; border: none; padding: 8px 14px; border-radius: 10px; cursor: pointer; font-weight: 600; }
    .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-link { background: none; border: none; color: #2563eb; cursor: pointer; padding: 4px 8px; font-weight: 600; }
    .btn-link:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-link.warn { color: #b45309; }
    .btn-link.danger { color: #dc2626; }

    .card { background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(15,23,42,0.06); padding: 18px 20px; margin-bottom: 20px; }
    .card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
    .card-head h3 { margin: 0 0 3px; }
    .card-head p { margin: 0; color: #64748b; font-size: 13px; }

    .switch { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; color: #0f172a; cursor: pointer; white-space: nowrap; }
    .switch input { width: 18px; height: 18px; cursor: pointer; }

    .schedule-grid { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 14px; margin-top: 16px; }
    .schedule-grid.disabled { opacity: 0.55; }
    .schedule-grid label { display: grid; gap: 4px; font-size: 12px; color: #475569; font-weight: 600; }
    .schedule-grid input, .schedule-grid select { padding: 8px 10px; border-radius: 9px; border: 1px solid #cbd5e1; font-size: 14px; min-width: 130px; }
    .schedule-grid input[type=number] { width: 110px; min-width: 0; }
    .schedule-actions { margin-left: auto; }

    .schedule-meta { display: flex; flex-wrap: wrap; gap: 18px; margin-top: 14px; padding-top: 12px; border-top: 1px solid #f1f5f9; font-size: 13px; color: #64748b; }
    .schedule-meta strong { color: #334155; }
    .schedule-meta .hint { color: #94a3b8; font-style: italic; }

    .backup-table { width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(15,23,42,0.06); }
    .backup-table th, .backup-table td { padding: 11px 14px; border-bottom: 1px solid #f1f5f9; text-align: left; vertical-align: middle; }
    .backup-table th { background: #f8fafc; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; white-space: nowrap; }
    .backup-table tbody tr:hover { background: #f8fafc; }
    .backup-table .num { text-align: right; }
    .backup-table .empty { text-align: center; color: #94a3b8; padding: 28px 16px; }
    .backup-table .when { white-space: nowrap; font-variant-numeric: tabular-nums; color: #334155; }
    .backup-table .size { font-variant-numeric: tabular-nums; color: #334155; white-space: nowrap; }
    .backup-table code { font-size: 12px; color: #475569; background: #f1f5f9; padding: 1px 6px; border-radius: 6px; word-break: break-all; }
    .backup-table .actions { white-space: nowrap; }
    .actions-col { text-align: right; }
    .backup-table td.actions { text-align: right; }

    .chip { display: inline-block; font-size: 12px; padding: 2px 9px; border-radius: 999px; font-weight: 600; }
    .chip.k-manual { background: #eef2ff; color: #4338ca; }
    .chip.k-auto { background: #dcfce7; color: #166534; }

    .alert { padding: 12px 16px; border-radius: 10px; margin-bottom: 16px; font-weight: 600; }
    .alert.error { background: #fee2e2; color: #991b1b; }
    .alert.warn { background: #fef3c7; color: #92400e; }
    .alert.ok { background: #dcfce7; color: #166534; }
    .loading { color: #64748b; padding: 28px 4px; }
  `]
})
export class BackupPageComponent {
  private readonly api = inject(BackupService);

  readonly loading = signal<boolean>(true);
  readonly creating = signal<boolean>(false);
  readonly savingSchedule = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly response = signal<BackupListResponse | null>(null);
  readonly schedule = signal<ScheduleResponse | null>(null);

  readonly downloadingName = signal<string | null>(null);
  readonly restoringName = signal<string | null>(null);
  readonly deletingName = signal<string | null>(null);

  scheduleForm: { enabled: boolean; frequency: BackupFrequency; hour: number; retention: number } = {
    enabled: false,
    frequency: 'daily',
    hour: 2,
    retention: 7,
  };

  readonly items = computed<BackupItem[]>(() => this.response()?.items ?? []);
  // Por defecto true: no deshabilitamos botones antes de la primera carga.
  readonly pgAvailable = computed<boolean>(() => this.response()?.pg_available ?? true);
  // Cualquier acción por-archivo en curso bloquea las demás para evitar choques.
  readonly busy = computed<boolean>(() =>
    !!this.downloadingName() || !!this.restoringName() || !!this.deletingName() || this.creating());

  constructor() {
    this.load();
    this.loadSchedule();
  }

  reload(): void {
    this.load();
    this.loadSchedule();
  }

  load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.api.list().subscribe({
      next: (data) => {
        this.response.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.detail || 'No se pudieron cargar los respaldos.');
        this.loading.set(false);
      },
    });
  }

  loadSchedule(): void {
    this.api.getSchedule().subscribe({
      next: (sch) => {
        this.schedule.set(sch);
        this.scheduleForm = {
          enabled: sch.enabled,
          frequency: sch.frequency,
          hour: sch.hour,
          retention: sch.retention,
        };
      },
      error: () => {
        // Silencioso: la lista de respaldos sigue siendo útil sin el schedule.
      },
    });
  }

  createNow(): void {
    if (!this.pgAvailable()) return;
    this.creating.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.api.create().subscribe({
      next: (item) => {
        this.creating.set(false);
        this.successMessage.set(`Respaldo creado: ${item.name} (${item.size_human}).`);
        this.load();
      },
      error: (err) => {
        this.creating.set(false);
        this.errorMessage.set(err?.error?.detail || 'No se pudo crear el respaldo.');
      },
    });
  }

  download(item: BackupItem): void {
    this.downloadingName.set(item.name);
    this.errorMessage.set(null);
    this.api.download(item.name).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = item.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        this.downloadingName.set(null);
      },
      error: (err) => {
        this.downloadingName.set(null);
        this.errorMessage.set(err?.error?.detail || 'No se pudo descargar el respaldo.');
      },
    });
  }

  restore(item: BackupItem): void {
    if (!this.pgAvailable()) return;
    // Restaurar es destructivo: reemplaza los datos actuales por los del
    // respaldo. Exigimos confirmación explícita.
    const ok = window.confirm(
      `¿Restaurar el respaldo "${item.name}"?\n\n` +
      'Esto REEMPLAZARÁ los datos actuales de tu organización por los del respaldo. ' +
      'Esta acción no se puede deshacer.',
    );
    if (!ok) return;
    this.restoringName.set(item.name);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.api.restore(item.name).subscribe({
      next: (res) => {
        this.restoringName.set(null);
        this.successMessage.set(res.detail || 'Respaldo restaurado correctamente.');
      },
      error: (err) => {
        this.restoringName.set(null);
        this.errorMessage.set(err?.error?.detail || 'No se pudo restaurar el respaldo.');
      },
    });
  }

  remove(item: BackupItem): void {
    const ok = window.confirm(`¿Borrar el respaldo "${item.name}"? Esta acción no se puede deshacer.`);
    if (!ok) return;
    this.deletingName.set(item.name);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.api.remove(item.name).subscribe({
      next: () => {
        this.deletingName.set(null);
        this.successMessage.set(`Respaldo "${item.name}" eliminado.`);
        this.load();
      },
      error: (err) => {
        this.deletingName.set(null);
        this.errorMessage.set(err?.error?.detail || 'No se pudo borrar el respaldo.');
      },
    });
  }

  saveSchedule(): void {
    this.savingSchedule.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.api.saveSchedule({
      enabled: this.scheduleForm.enabled,
      frequency: this.scheduleForm.frequency,
      hour: Number(this.scheduleForm.hour),
      retention: Number(this.scheduleForm.retention),
    }).subscribe({
      next: (sch) => {
        this.savingSchedule.set(false);
        this.schedule.set(sch);
        this.successMessage.set('Programación de backup automático guardada.');
      },
      error: (err) => {
        this.savingSchedule.set(false);
        this.errorMessage.set(err?.error?.detail || 'No se pudo guardar la programación.');
      },
    });
  }
}
