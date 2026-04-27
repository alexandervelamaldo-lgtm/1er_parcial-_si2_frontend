import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';

import { EmergencyApiService } from '../../../core/services/gestion-solicitudes/emergency-api.service';
import { Notificacion, Solicitud } from '../../../core/models/gestion-solicitudes/api.models';


@Component({
  selector: 'app-historial-page',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <section class="history-layout">
      <article class="card">
        <h2>Historial de solicitudes</h2>
        <div class="timeline">
          <div *ngFor="let solicitud of solicitudes()">
            <strong>#{{ solicitud.id }} · {{ solicitud.estado?.nombre }}</strong>
            <p>{{ solicitud.descripcion }}</p>
            <small>{{ solicitud.fecha_solicitud | date: 'medium' }}</small>
          </div>
        </div>
      </article>

      <article class="card">
        <h2>Notificaciones</h2>
        <div class="timeline">
          <div *ngFor="let item of notificaciones()">
            <strong>{{ item.titulo }}</strong>
            <p>{{ item.mensaje }}</p>
            <small>{{ item.fecha_creacion | date: 'short' }}</small>
          </div>
        </div>
      </article>
    </section>
  `,
  styles: `
    .history-layout{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem}
    .card{padding:1.2rem;background:#fff;border-radius:18px;box-shadow:0 10px 30px rgba(15,23,42,.08)}
    .timeline{display:grid;gap:1rem}.timeline div{padding:1rem;border-radius:14px;background:#f8fafc}
    h2{margin-top:0}
  `
})
export class HistorialPageComponent {
  private readonly api = inject(EmergencyApiService);
  readonly solicitudes = signal<Solicitud[]>([]);
  readonly notificaciones = signal<Notificacion[]>([]);

  constructor() {
    this.api.getSolicitudes().subscribe((data) => this.solicitudes.set(data.slice(0, 10)));
    this.api.getNotificaciones().subscribe((data) => this.notificaciones.set(data.slice(0, 10)));
  }
}


