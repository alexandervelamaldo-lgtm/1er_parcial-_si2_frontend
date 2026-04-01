import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { Solicitud } from '../core/models/api.models';
import { EmergencyApiService } from '../core/services/emergency-api.service';


@Component({
  selector: 'app-solicitud-detalle-page',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink],
  template: `
    <section class="detail-page" *ngIf="solicitud() as solicitud">
      <a routerLink="/solicitudes" class="back-link">← Volver a solicitudes</a>
      <article class="detail-card">
        <h2>Solicitud #{{ solicitud.id }}</h2>
        <p><strong>Tipo:</strong> {{ solicitud.tipo_incidente?.nombre }}</p>
        <p><strong>Estado:</strong> {{ solicitud.estado?.nombre }}</p>
        <p><strong>Prioridad:</strong> {{ solicitud.prioridad }}</p>
        <p><strong>Descripción:</strong> {{ solicitud.descripcion }}</p>
        <p><strong>Ubicación:</strong> {{ solicitud.latitud_incidente }}, {{ solicitud.longitud_incidente }}</p>
        <p><strong>Fecha:</strong> {{ solicitud.fecha_solicitud | date: 'medium' }}</p>
        <p *ngIf="solicitud.tecnico_id"><strong>Técnico asignado:</strong> #{{ solicitud.tecnico_id }}</p>
      </article>
    </section>
  `,
  styles: `
    .detail-page{display:grid;gap:1rem}
    .back-link{color:#2563eb;text-decoration:none;font-weight:700}
    .detail-card{padding:1.5rem;border-radius:18px;background:#fff;box-shadow:0 10px 30px rgba(15,23,42,.08)}
    h2{margin-top:0}
    p{color:#334155}
  `
})
export class SolicitudDetallePageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(EmergencyApiService);

  readonly solicitud = signal<Solicitud | null>(null);

  constructor() {
    const solicitudId = Number(this.route.snapshot.paramMap.get('id'));
    if (solicitudId) {
      this.api.getSolicitud(solicitudId).subscribe((data) => this.solicitud.set(data));
    }
  }
}
