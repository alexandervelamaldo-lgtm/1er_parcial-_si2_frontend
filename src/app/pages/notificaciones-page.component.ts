import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';

import { Notificacion } from '../core/models/api.models';
import { EmergencyApiService } from '../core/services/emergency-api.service';


@Component({
  selector: 'app-notificaciones-page',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <section class="notifications-page">
      <div class="page-header">
        <div>
          <h2>Notificaciones</h2>
          <p>Seguimiento de eventos relevantes para el usuario autenticado.</p>
        </div>
        <button (click)="loadData()">Actualizar</button>
      </div>

      <article class="notification-card" *ngFor="let item of notificaciones()">
        <div>
          <strong>{{ item.titulo }}</strong>
          <p>{{ item.mensaje }}</p>
          <small>{{ item.fecha_creacion | date: 'medium' }}</small>
        </div>
        <button *ngIf="!item.leida" (click)="markAsRead(item.id)">Marcar leída</button>
        <span class="read" *ngIf="item.leida">Leída</span>
      </article>
    </section>
  `,
  styles: `
    .notifications-page{display:grid;gap:1rem}
    .page-header{display:flex;justify-content:space-between;align-items:center;gap:1rem}
    .notification-card{display:grid;grid-template-columns:1fr auto;gap:1rem;padding:1.25rem;border-radius:18px;background:#fff;box-shadow:0 10px 30px rgba(15,23,42,.08)}
    .notification-card p{margin:.5rem 0;color:#475569}
    button{padding:.75rem 1rem;border:none;border-radius:12px;background:#2563eb;color:#fff;font-weight:700;cursor:pointer}
    .read{align-self:center;color:#15803d;font-weight:700}
  `
})
export class NotificacionesPageComponent {
  private readonly api = inject(EmergencyApiService);
  readonly notificaciones = signal<Notificacion[]>([]);

  constructor() {
    this.loadData();
  }

  loadData() {
    this.api.getNotificaciones().subscribe((data) => this.notificaciones.set(data));
  }

  markAsRead(notificacionId: number) {
    this.api.marcarNotificacionLeida(notificacionId).subscribe(() => this.loadData());
  }
}
