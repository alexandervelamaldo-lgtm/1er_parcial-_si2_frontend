import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { Notificacion } from '../core/models/api.models';
import { EmergencyApiService } from '../core/services/emergency-api.service';

@Component({
  selector: 'app-notificaciones-page',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <section class="management-container">
      <header class="page-header">
        <div class="title-group">
          <h2>Centro de Notificaciones</h2>
          <p>Registro histórico y alertas en tiempo real</p>
        </div>
        <div class="header-actions">
          <div class="unread-counter" *ngIf="pendientes() > 0">
            {{ pendientes() }} pendientes
          </div>
          <button (click)="loadData()" class="btn-refresh" [disabled]="isLoading()">
            <span class="icon" [class.spinning]="isLoading()">🔄</span>
            Sincronizar
          </button>
        </div>
      </header>

      <div class="notifications-feed">
        <div *ngIf="notificaciones().length === 0 && !isLoading()" class="empty-state">
          <div class="empty-icon">🔔</div>
          <p>No tienes notificaciones por el momento.</p>
        </div>

        <article 
          class="notification-card" 
          *ngFor="let item of notificaciones()" 
          [class.is-new]="!item.leida"
        >
          <div class="status-indicator">
            <div class="dot" [class.active]="!item.leida"></div>
          </div>

          <div class="notification-body">
            <header>
              <strong class="title">{{ item.titulo }}</strong>
              <span class="time-stamp">{{ item.fecha_creacion | date: 'shortTime' }}</span>
            </header>
            <p class="message">{{ item.mensaje }}</p>
            <footer class="meta">
              <span class="full-date">{{ item.fecha_creacion | date: 'mediumDate' }}</span>
              <span class="separator" *ngIf="item.leida">·</span>
              <span class="read-tag" *ngIf="item.leida">Visto</span>
            </footer>
          </div>

          <div class="notification-actions">
            <button 
              *ngIf="!item.leida" 
              (click)="markAsRead(item.id)" 
              class="btn-mark"
              title="Marcar como leída"
            >
              ✓
            </button>
          </div>
        </article>
      </div>
    </section>
  `,
  styles: `
    :host { --primary: #2563eb; --success: #15803d; --dark: #0f172a; --gray: #64748b; --bg: #f8fafc; }

    .management-container { padding: 2rem; background: var(--bg); min-height: 100vh; font-family: 'Inter', sans-serif; }

    /* Header */
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
    .title-group h2 { margin: 0; color: var(--dark); font-size: 1.75rem; letter-spacing: -0.5px; }
    .title-group p { margin: 0.25rem 0 0; color: var(--gray); }

    .header-actions { display: flex; align-items: center; gap: 1rem; }
    .unread-counter { background: #fee2e2; color: #ef4444; padding: 0.4rem 0.8rem; border-radius: 100px; font-size: 0.75rem; font-weight: 800; }

    /* Feed */
    .notifications-feed { display: flex; flex-direction: column; gap: 1rem; max-width: 800px; margin: 0 auto; }

    .notification-card {
      display: grid;
      grid-template-columns: 40px 1fr auto;
      gap: 1rem;
      padding: 1.25rem;
      background: white;
      border-radius: 20px;
      border: 1px solid #f1f5f9;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
      transition: all 0.2s ease;
    }
    .notification-card.is-new { border-left: 4px solid var(--primary); background: #fdfefe; box-shadow: 0 10px 15px -3px rgba(37,99,235,0.08); }
    .notification-card:hover { transform: scale(1.01); border-color: #e2e8f0; }

    /* Dot Indicator */
    .status-indicator { display: flex; justify-content: center; padding-top: 0.25rem; }
    .dot { width: 10px; height: 10px; border-radius: 50%; background: #e2e8f0; }
    .dot.active { background: var(--primary); box-shadow: 0 0 10px rgba(37,99,235,0.5); }

    /* Body content */
    .notification-body header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.5rem; }
    .title { color: var(--dark); font-size: 1.05rem; }
    .time-stamp { font-size: 0.75rem; color: var(--gray); font-weight: 600; }
    .message { margin: 0 0 0.75rem; color: #475569; line-height: 1.5; font-size: 0.95rem; }
    
    .meta { font-size: 0.75rem; color: var(--gray); display: flex; align-items: center; gap: 0.5rem; }
    .read-tag { color: var(--success); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }

    /* Actions */
    .notification-actions { display: flex; align-items: center; }
    .btn-mark {
      width: 36px; height: 36px; border-radius: 10px; border: none;
      background: #f1f5f9; color: var(--gray); cursor: pointer;
      font-size: 1.2rem; transition: 0.2s;
    }
    .btn-mark:hover { background: var(--primary); color: white; transform: rotate(10deg); }

    /* Utils */
    .btn-refresh { display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1rem; border: 1.5px solid #e2e8f0; background: white; border-radius: 12px; font-weight: 600; cursor: pointer; }
    .spinning { animation: spin 1s linear infinite; display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .empty-state { text-align: center; padding: 5rem 1rem; color: var(--gray); }
    .empty-icon { font-size: 3rem; margin-bottom: 1rem; opacity: 0.3; }

    @media (max-width: 900px) {
      .management-container { padding: 1rem; }
      .page-header { flex-direction: column; align-items: stretch; gap: 1rem; }
      .header-actions { justify-content: space-between; flex-wrap: wrap; }
      .notifications-feed { max-width: none; }
    }

    @media (max-width: 640px) {
      .notification-card { grid-template-columns: 1fr; }
      .status-indicator { justify-content: flex-start; padding-top: 0; }
      .notification-body header { flex-direction: column; align-items: flex-start; gap: 0.35rem; }
      .notification-actions { justify-content: flex-end; }
      .meta { flex-wrap: wrap; }
    }
  `
})
export class NotificacionesPageComponent implements OnInit {
  private readonly api = inject(EmergencyApiService);
  
  readonly notificaciones = signal<Notificacion[]>([]);
  readonly isLoading = signal(false);

  // Computado para el badge del header
  readonly pendientes = computed(() => 
    this.notificaciones().filter(n => !n.leida).length
  );

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.isLoading.set(true);
    this.api.getNotificaciones().subscribe({
      next: (data) => {
        this.notificaciones.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  markAsRead(id: number) {
    this.api.marcarNotificacionLeida(id).subscribe(() => this.loadData());
  }
}

export {};
