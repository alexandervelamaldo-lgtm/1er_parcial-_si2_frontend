import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';

import { EmergencyApiService } from '../core/services/emergency-api.service';
import { Solicitud } from '../core/models/api.models';


@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <section class="page">
      <div class="page-header">
        <div>
          <h2>Dashboard operativo</h2>
          <p>Vista general de emergencias activas y prioridades.</p>
        </div>
        <button (click)="loadData()">Actualizar</button>
      </div>

      <div class="stats">
        <article>
          <span>Total activas</span>
          <strong>{{ solicitudes().length }}</strong>
        </article>
        <article>
          <span>Prioridad crítica</span>
          <strong>{{ criticas() }}</strong>
        </article>
        <article>
          <span>Con técnico asignado</span>
          <strong>{{ asignadas() }}</strong>
        </article>
      </div>

      <div class="map-panel">
        <h3>Mapa resumido de incidentes</h3>
        <div class="map-grid">
          <article *ngFor="let punto of mapa()">
            <span>#{{ punto['id'] }}</span>
            <strong>{{ punto['estado'] }}</strong>
            <p>{{ punto['descripcion'] }}</p>
            <small>{{ punto['latitud_incidente'] }}, {{ punto['longitud_incidente'] }}</small>
          </article>
        </div>
      </div>

      <div class="table-card">
        <h3>Solicitudes activas</h3>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Incidente</th>
              <th>Estado</th>
              <th>Prioridad</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let solicitud of solicitudes()">
              <td>#{{ solicitud.id }}</td>
              <td>{{ solicitud.tipo_incidente?.nombre }}</td>
              <td>{{ solicitud.estado?.nombre }}</td>
              <td><span class="badge" [class.critica]="solicitud.prioridad === 'CRITICA'">{{ solicitud.prioridad }}</span></td>
              <td>{{ solicitud.fecha_solicitud | date: 'short' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  `,
  styles: `
    .page{display:grid;gap:1.5rem}
    .page-header{display:flex;justify-content:space-between;align-items:center;gap:1rem}
    .page-header h2{margin:0;color:#0f172a}
    .page-header p{margin:.35rem 0 0;color:#475569}
    button{padding:.85rem 1rem;border:none;border-radius:12px;background:#0f172a;color:#fff;font-weight:700;cursor:pointer}
    .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem}
    .stats article,.table-card,.map-panel{padding:1.25rem;border-radius:18px;background:#fff;box-shadow:0 10px 30px rgba(15,23,42,.08)}
    .stats span{display:block;color:#64748b}.stats strong{font-size:2rem;color:#0f172a}
    .map-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem}
    .map-grid article{padding:1rem;border-radius:14px;background:#eff6ff}
    table{width:100%;border-collapse:collapse}
    th,td{padding:.85rem;text-align:left;border-bottom:1px solid #e2e8f0}
    .badge{padding:.2rem .6rem;border-radius:999px;background:#dbeafe;color:#1d4ed8;font-weight:700}
    .badge.critica{background:#fee2e2;color:#b91c1c}
  `
})
export class DashboardPageComponent {
  private readonly api = inject(EmergencyApiService);

  readonly solicitudes = signal<Solicitud[]>([]);
  readonly mapa = signal<Array<Record<string, string | number>>>([]);
  readonly criticas = computed(() => this.solicitudes().filter((item) => item.prioridad === 'CRITICA').length);
  readonly asignadas = computed(() => this.solicitudes().filter((item) => item.tecnico_id).length);

  constructor() {
    this.loadData();
  }

  loadData() {
    this.api.getSolicitudesActivas().subscribe((data) => this.solicitudes.set(data));
    this.api.getMapaSolicitudes().subscribe((data) => this.mapa.set(data));
  }
}
