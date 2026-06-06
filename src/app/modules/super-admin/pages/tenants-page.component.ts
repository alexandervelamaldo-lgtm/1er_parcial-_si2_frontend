import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CreateTenantPayload, TenantAdmin, TenantAdminService } from '../../../core/services/tenant/tenant-admin.service';

/**
 * Super-admin panel: list, create, and suspend tenants.
 *
 * Visible only to users with the ``SUPER_ADMIN`` role — the backend
 * enforces it via ``_require_super_admin`` on every `/admin/tenants*`
 * route, so even if the route guard fails, no data leaks.
 */
@Component({
  selector: 'app-tenants-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="wrap">
      <header class="page-head">
        <div>
          <h2>Administración de tenants</h2>
          <p>Cada tenant es una organización con su propia base de datos. Los datos nunca se mezclan.</p>
        </div>
        <button class="btn-primary" (click)="openCreateModal()" [disabled]="loading()">+ Nuevo tenant</button>
      </header>

      <div class="alert error" *ngIf="errorMessage()">{{ errorMessage() }}</div>
      <div class="alert ok" *ngIf="successMessage()">{{ successMessage() }}</div>

      <table class="tenants-table" *ngIf="!loading(); else loadingTpl">
        <thead>
          <tr>
            <th>Clave</th>
            <th>Nombre</th>
            <th class="num">Usuarios</th>
            <th class="num">Solicitudes</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let t of tenants()" [class.is-default]="t.is_default" [class.is-suspended]="t.suspended">
            <td><code>{{ t.key }}</code> <span class="badge" *ngIf="t.is_default">default</span></td>
            <td>{{ t.label }}</td>
            <td class="num">{{ t.user_count >= 0 ? t.user_count : '—' }}</td>
            <td class="num">{{ t.solicitud_count >= 0 ? t.solicitud_count : '—' }}</td>
            <td>
              <span class="status" [class.active]="!t.suspended" [class.suspended]="t.suspended">
                {{ t.suspended ? 'Suspendido' : 'Activo' }}
              </span>
            </td>
            <td class="actions">
              <button class="btn-link" *ngIf="!t.suspended && !t.is_default" (click)="suspend(t)">Suspender</button>
              <button class="btn-link" *ngIf="t.suspended" (click)="resume(t)">Reactivar</button>
            </td>
          </tr>
          <tr *ngIf="tenants().length === 0">
            <td colspan="6" class="empty">Aún no hay tenants — crea el primero con el botón superior.</td>
          </tr>
        </tbody>
      </table>
      <ng-template #loadingTpl><p class="loading">Cargando tenants…</p></ng-template>

      <!-- Create modal ----------------------------------------------------- -->
      <div class="modal" *ngIf="createOpen()" (click)="closeCreate()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <header><h3>Nuevo tenant</h3></header>
          <form (ngSubmit)="submitCreate()" #f="ngForm">
            <label>
              <span>Clave (slug)</span>
              <input name="key" [(ngModel)]="form.key" required pattern="[a-z0-9_]+"
                     placeholder="auxilio_norte" autocomplete="off" />
              <small>Solo minúsculas, números y guión bajo.</small>
            </label>
            <label>
              <span>Nombre comercial</span>
              <input name="label" [(ngModel)]="form.label" required minlength="3"
                     placeholder="Red de talleres Auxilio Norte" autocomplete="off" />
            </label>
            <label>
              <span>Email del admin</span>
              <input name="admin_email" [(ngModel)]="form.admin_email" required type="email"
                     placeholder="admin@auxilionorte.com" autocomplete="off" />
            </label>
            <label>
              <span>Contraseña del admin</span>
              <input name="admin_password" [(ngModel)]="form.admin_password" required minlength="8"
                     type="password" autocomplete="new-password" />
            </label>
            <footer>
              <button type="button" class="btn-secondary" (click)="closeCreate()">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="!f.valid || saving()">
                {{ saving() ? 'Creando…' : 'Crear tenant' }}
              </button>
            </footer>
          </form>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .wrap { padding: 24px; max-width: 1100px; margin: 0 auto; }
    .page-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin-bottom: 24px; }
    .page-head h2 { margin: 0 0 4px; }
    .page-head p { margin: 0; color: #64748b; }
    .btn-primary { background: #2563eb; color: white; border: none; padding: 10px 18px; border-radius: 10px; font-weight: 700; cursor: pointer; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary { background: #f1f5f9; color: #0f172a; border: none; padding: 10px 16px; border-radius: 10px; cursor: pointer; }
    .btn-link { background: none; border: none; color: #2563eb; cursor: pointer; padding: 4px 8px; font-weight: 600; }

    .tenants-table { width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(15,23,42,0.06); }
    .tenants-table th, .tenants-table td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; text-align: left; }
    .tenants-table th { background: #f8fafc; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; }
    .tenants-table tbody tr:hover { background: #f8fafc; }
    .tenants-table tr.is-default code { color: #2563eb; font-weight: 700; }
    .tenants-table tr.is-suspended { opacity: 0.55; }
    .tenants-table .num { text-align: right; font-variant-numeric: tabular-nums; }
    .tenants-table .empty { text-align: center; color: #94a3b8; padding: 28px 16px; }

    .badge { background: #dbeafe; color: #1d4ed8; font-size: 10px; padding: 2px 6px; border-radius: 999px; margin-left: 6px; font-weight: 700; }
    .status { padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
    .status.active { background: #dcfce7; color: #166534; }
    .status.suspended { background: #fef3c7; color: #92400e; }

    .alert { padding: 12px 16px; border-radius: 10px; margin-bottom: 16px; font-weight: 600; }
    .alert.error { background: #fee2e2; color: #991b1b; }
    .alert.ok { background: #dcfce7; color: #166534; }
    .loading { color: #64748b; }

    .modal { position: fixed; inset: 0; background: rgba(15,23,42,0.55); display: grid; place-items: center; z-index: 50; }
    .modal-card { background: white; border-radius: 16px; padding: 24px; width: min(480px, 92vw); }
    .modal-card header h3 { margin: 0 0 16px; }
    .modal-card form { display: grid; gap: 14px; }
    .modal-card label { display: grid; gap: 4px; font-size: 13px; color: #334155; font-weight: 600; }
    .modal-card label input { padding: 10px 12px; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 14px; }
    .modal-card label small { color: #64748b; font-size: 11px; font-weight: 400; }
    .modal-card footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }
  `]
})
export class TenantsPageComponent {
  private readonly api = inject(TenantAdminService);

  readonly tenants = signal<TenantAdmin[]>([]);
  readonly loading = signal<boolean>(true);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly createOpen = signal<boolean>(false);
  readonly saving = signal<boolean>(false);

  form: CreateTenantPayload = { key: '', label: '', admin_email: '', admin_password: '' };

  /** Total tenants across the platform — used by the dashboard summary card. */
  readonly totalTenants = computed(() => this.tenants().length);

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.api.listAdmin().subscribe({
      next: (data) => {
        this.tenants.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.detail || 'No se pudo cargar la lista de tenants');
        this.loading.set(false);
      }
    });
  }

  openCreateModal(): void {
    this.form = { key: '', label: '', admin_email: '', admin_password: '' };
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.createOpen.set(true);
  }

  closeCreate(): void {
    if (this.saving()) return;
    this.createOpen.set(false);
  }

  submitCreate(): void {
    this.saving.set(true);
    this.errorMessage.set(null);
    this.api.create(this.form).subscribe({
      next: (t) => {
        this.successMessage.set(`Tenant "${t.label}" creado. Recuerda agregarlo a TENANT_DATABASES en .env para que sobreviva al reinicio.`);
        this.saving.set(false);
        this.createOpen.set(false);
        this.reload();
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.detail || 'No se pudo crear el tenant');
        this.saving.set(false);
      }
    });
  }

  suspend(t: TenantAdmin): void {
    if (!confirm(`¿Suspender el tenant "${t.label}"? Los usuarios no podrán iniciar sesión.`)) return;
    this.api.suspend(t.key).subscribe({
      next: () => this.reload(),
      error: (err) => this.errorMessage.set(err?.error?.detail || 'No se pudo suspender'),
    });
  }

  resume(t: TenantAdmin): void {
    this.api.resume(t.key).subscribe({
      next: () => this.reload(),
      error: (err) => this.errorMessage.set(err?.error?.detail || 'No se pudo reactivar'),
    });
  }
}
