import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';

import { EmergencyApiService } from '../../../core/services/gestion-solicitudes/emergency-api.service';
import { Notificacion, Solicitud } from '../../../core/models/gestion-solicitudes/api.models';
import { AppIconComponent } from '../../../shared/components/app-icon/app-icon.component';


@Component({
  selector: 'app-historial-page',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterModule, AppIconComponent],
  template: `
    <section class="management-container">
      <header class="page-header">
        <div class="title-group">
          <h2>Historial</h2>
          <p>Registro de solicitudes y actividad del sistema</p>
        </div>
        <div class="header-actions">
          <a class="btn-primary" routerLink="/solicitudes/nueva">
            <app-icon name="alert" [size]="16" />
            Registrar accidente
          </a>
          <button (click)="loadData()" class="btn-refresh" [disabled]="isLoading()">
            <span class="icon" [class.spinning]="isLoading()" aria-hidden="true">
              <app-icon name="refresh" [size]="16" />
            </span>
            Actualizar
          </button>
        </div>
      </header>

      <div class="history-grid">
        <article class="history-card">
          <div class="card-header">
            <div class="card-title">
              <app-icon name="clipboard" [size]="18" />
              <h3>Solicitudes recientes</h3>
            </div>
            <span class="counter-badge">{{ solicitudes().length }}</span>
          </div>

          <div class="timeline-feed" *ngIf="solicitudes().length; else emptyRequests">
            <div class="timeline-entry" *ngFor="let solicitud of solicitudes()" [routerLink]="['/solicitudes', solicitud.id]">
              <div class="entry-indicator">
                <div class="indicator-dot" [attr.data-status]="solicitud.estado?.nombre"></div>
                <div class="indicator-line"></div>
              </div>
              <div class="entry-content">
                <div class="entry-header">
                  <div class="entry-title">
                    <span class="entry-id">#{{ solicitud.id }}</span>
                    <strong>{{ solicitud.tipo_incidente?.nombre || 'Incidente' }}</strong>
                  </div>
                  <span class="entry-status" [attr.data-tone]="stateTone(solicitud.estado?.nombre)">
                    {{ solicitud.estado?.nombre || 'Sin estado' }}
                  </span>
                </div>
                <p class="entry-desc">{{ solicitud.descripcion }}</p>
                <div class="entry-meta">
                  <span class="meta-item">
                    <app-icon name="clock" [size]="12" />
                    {{ solicitud.fecha_solicitud | date: 'dd MMM yyyy, HH:mm' }}
                  </span>
                  <span class="meta-item" *ngIf="solicitud.tecnico">
                    <app-icon name="wrench" [size]="12" />
                    {{ solicitud.tecnico.nombre }}
                  </span>
                  <span class="priority-pill" [attr.data-priority]="solicitud.prioridad">
                    {{ solicitud.prioridad }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <ng-template #emptyRequests>
            <div class="empty-state" *ngIf="!isLoading()">
              <div class="empty-icon"><app-icon name="folder" [size]="32" /></div>
              <p>No hay solicitudes registradas</p>
            </div>
          </ng-template>
        </article>

        <article class="history-card">
          <div class="card-header">
            <div class="card-title">
              <app-icon name="bell" [size]="18" />
              <h3>Actividad reciente</h3>
            </div>
            <span class="counter-badge">{{ notificaciones().length }}</span>
          </div>

          <div class="notification-feed" *ngIf="notificaciones().length; else emptyNotifs">
            <div class="notif-entry" *ngFor="let item of notificaciones()" [class.unread]="!item.leida">
              <div class="notif-icon-wrap">
                <app-icon name="bell" [size]="14" />
              </div>
              <div class="notif-content">
                <strong>{{ item.titulo }}</strong>
                <p>{{ item.mensaje }}</p>
                <span class="notif-time">{{ item.fecha_creacion | date: 'dd MMM, HH:mm' }}</span>
              </div>
            </div>
          </div>

          <ng-template #emptyNotifs>
            <div class="empty-state" *ngIf="!isLoading()">
              <div class="empty-icon"><app-icon name="bell" [size]="32" /></div>
              <p>Sin notificaciones recientes</p>
            </div>
          </ng-template>
        </article>
      </div>
    </section>
  `,
  styles: `
    :host {
      --primary: #2563eb;
      --primary-hover: #1d4ed8;
      --dark: #0f172a;
      --gray: #64748b;
      --bg: #f8fafc;
      --surface: #ffffff;
      --line: rgba(148, 163, 184, 0.15);
    }

    .management-container {
      padding: 2rem;
      background: var(--bg);
      min-height: 100vh;
      font-family: 'Inter', sans-serif;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      gap: 1rem;
    }

    .title-group h2 {
      margin: 0;
      color: var(--dark);
      font-size: 1.75rem;
      letter-spacing: -0.5px;
      font-weight: 800;
    }

    .title-group p {
      margin: 0.25rem 0 0;
      color: var(--gray);
      font-size: 0.9rem;
    }

    .header-actions {
      display: flex;
      gap: 0.75rem;
      align-items: center;
    }

    .btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      border: none;
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: #fff;
      border-radius: 12px;
      padding: 0.75rem 1.2rem;
      font-weight: 700;
      font-size: 0.88rem;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
    }

    .btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(37, 99, 235, 0.35);
    }

    .btn-refresh {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.65rem 1rem;
      border: 1.5px solid #e2e8f0;
      background: white;
      border-radius: 12px;
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-refresh:hover {
      border-color: #cbd5e1;
      background: #f8fafc;
    }

    .icon { display: inline-flex; align-items: center; justify-content: center; }
    .spinning { animation: spin 1s linear infinite; display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Grid */
    .history-grid {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 1.5rem;
      align-items: start;
    }

    .history-card {
      background: var(--surface);
      border-radius: 20px;
      border: 1px solid var(--line);
      box-shadow: 0 4px 20px rgba(15, 23, 42, 0.04);
      overflow: hidden;
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--line);
      background: rgba(248, 250, 252, 0.5);
    }

    .card-title {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      color: var(--dark);

      h3 {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 700;
      }
    }

    .counter-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      height: 28px;
      padding: 0 0.55rem;
      border-radius: 999px;
      background: #eff6ff;
      color: #1d4ed8;
      font-size: 0.75rem;
      font-weight: 800;
    }

    /* Timeline */
    .timeline-feed {
      padding: 0.75rem;
    }

    .timeline-entry {
      display: grid;
      grid-template-columns: 24px 1fr;
      gap: 0.75rem;
      cursor: pointer;
      padding: 0.85rem;
      border-radius: 14px;
      transition: background 0.2s, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);

      &:hover {
        background: rgba(241, 245, 249, 0.8);
        transform: translateX(2px);
      }
    }

    .entry-indicator {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-top: 0.35rem;
    }

    .indicator-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #cbd5e1;
      box-shadow: 0 0 0 3px rgba(226, 232, 240, 0.6);
      flex-shrink: 0;
    }

    .indicator-dot[data-status="EN_CAMINO"] { background: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2); }
    .indicator-dot[data-status="EN_ATENCION"] { background: #f59e0b; box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.2); }
    .indicator-dot[data-status="COMPLETADA"] { background: #22c55e; box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.2); }
    .indicator-dot[data-status="CANCELADA"] { background: #ef4444; box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2); }
    .indicator-dot[data-status="ASIGNADA"] { background: #6366f1; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2); }

    .indicator-line {
      width: 2px;
      flex: 1;
      background: linear-gradient(to bottom, #e2e8f0, transparent);
      margin-top: 0.35rem;
      min-height: 16px;
    }

    .entry-content {
      min-width: 0;
    }

    .entry-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 0.35rem;
    }

    .entry-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-width: 0;

      strong {
        font-size: 0.9rem;
        color: var(--dark);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    .entry-id {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--gray);
      flex-shrink: 0;
    }

    .entry-status {
      padding: 0.25rem 0.6rem;
      border-radius: 999px;
      font-size: 0.65rem;
      font-weight: 800;
      background: #e2e8f0;
      color: #475569;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .entry-status[data-tone="info"] { background: #dbeafe; color: #1d4ed8; }
    .entry-status[data-tone="warning"] { background: #fef3c7; color: #92400e; }
    .entry-status[data-tone="success"] { background: #dcfce7; color: #166534; }
    .entry-status[data-tone="critical"] { background: #fee2e2; color: #dc2626; }

    .entry-desc {
      margin: 0;
      color: #475569;
      font-size: 0.84rem;
      line-height: 1.45;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .entry-meta {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-top: 0.5rem;
      flex-wrap: wrap;
    }

    .meta-item {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.72rem;
      color: var(--gray);
      font-weight: 600;
    }

    .priority-pill {
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      font-size: 0.65rem;
      font-weight: 800;
      background: #f1f5f9;
      color: var(--gray);
    }

    .priority-pill[data-priority="CRITICA"] { background: #fee2e2; color: #dc2626; }
    .priority-pill[data-priority="ALTA"] { background: #ffedd5; color: #c2410c; }
    .priority-pill[data-priority="MEDIA"] { background: #dbeafe; color: #1d4ed8; }
    .priority-pill[data-priority="BAJA"] { background: #dcfce7; color: #166534; }

    /* Notifications */
    .notification-feed {
      padding: 0.75rem;
    }

    .notif-entry {
      display: grid;
      grid-template-columns: 36px 1fr;
      gap: 0.75rem;
      padding: 0.85rem;
      border-radius: 12px;
      transition: background 0.2s;

      &:hover {
        background: rgba(241, 245, 249, 0.7);
      }

      &.unread {
        background: rgba(239, 246, 255, 0.5);
        border-left: 3px solid var(--primary);
      }
    }

    .notif-icon-wrap {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: #f1f5f9;
      display: grid;
      place-items: center;
      color: var(--gray);
    }

    .notif-entry.unread .notif-icon-wrap {
      background: #dbeafe;
      color: var(--primary);
    }

    .notif-content {
      min-width: 0;

      strong {
        display: block;
        font-size: 0.88rem;
        color: var(--dark);
        margin-bottom: 0.15rem;
      }

      p {
        margin: 0;
        color: #475569;
        font-size: 0.82rem;
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
    }

    .notif-time {
      display: inline-block;
      margin-top: 0.35rem;
      font-size: 0.7rem;
      color: var(--gray);
      font-weight: 600;
    }

    /* Empty */
    .empty-state {
      text-align: center;
      padding: 3rem 1.5rem;
      color: var(--gray);
    }

    .empty-icon {
      margin-bottom: 0.75rem;
      opacity: 0.35;
      display: inline-flex;
    }

    .empty-state p {
      font-size: 0.9rem;
    }

    /* Responsive */
    @media (max-width: 1000px) {
      .history-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 900px) {
      .management-container { padding: 1rem; }
      .page-header { flex-direction: column; align-items: stretch; gap: 1rem; }
      .header-actions { flex-wrap: wrap; }
      .btn-primary, .btn-refresh { width: 100%; justify-content: center; }
    }

    @media (max-width: 640px) {
      .timeline-entry { grid-template-columns: 16px 1fr; gap: 0.5rem; padding: 0.65rem; }
      .entry-header { flex-direction: column; align-items: flex-start; gap: 0.35rem; }
      .notif-entry { grid-template-columns: 1fr; }
      .notif-icon-wrap { display: none; }
    }
  `
})
export class HistorialPageComponent {
  private readonly api = inject(EmergencyApiService);
  readonly solicitudes = signal<Solicitud[]>([]);
  readonly notificaciones = signal<Notificacion[]>([]);
  readonly isLoading = signal(false);

  constructor() {
    this.loadData();
  }

  loadData() {
    this.isLoading.set(true);
    this.api.getSolicitudes().subscribe({
      next: (data) => {
        this.solicitudes.set(data.slice(0, 12));
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
    this.api.getNotificaciones().subscribe({
      next: (data) => this.notificaciones.set(data.slice(0, 10)),
      error: () => {}
    });
  }

  stateTone(state: string | null | undefined): string {
    switch (String(state || '').toUpperCase()) {
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
}
