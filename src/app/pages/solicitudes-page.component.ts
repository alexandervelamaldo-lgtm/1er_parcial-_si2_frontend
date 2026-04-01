import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { EmergencyApiService } from '../core/services/emergency-api.service';
import { AuthService } from '../core/services/auth.service';
import { Solicitud, Tecnico } from '../core/models/api.models';


@Component({
  selector: 'app-solicitudes-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="page-card">
      <div class="page-header">
        <div>
          <h2>Gestión de solicitudes</h2>
          <p>Asignación de técnicos y seguimiento del ciclo de atención.</p>
        </div>
        <button (click)="loadData()">Recargar</button>
      </div>

      <article class="request-card" *ngFor="let solicitud of solicitudes()">
        <div>
          <strong>#{{ solicitud.id }} · {{ solicitud.tipo_incidente?.nombre }}</strong>
          <p>{{ solicitud.descripcion }}</p>
          <small>Estado: {{ solicitud.estado?.nombre }} · Prioridad: {{ solicitud.prioridad }}</small>
        </div>
        <div class="actions">
          <a class="detail-link" [routerLink]="['/solicitudes', solicitud.id]">Ver detalle</a>
          <select *ngIf="canAssign()" [(ngModel)]="selectedTechnicians[solicitud.id]">
            <option [ngValue]="undefined">Seleccionar técnico</option>
            <option *ngFor="let tecnico of tecnicos()" [ngValue]="tecnico.id">{{ tecnico.nombre }}</option>
          </select>
          <button *ngIf="canAssign()" (click)="assign(solicitud.id)">Asignar</button>
          <button class="secondary" (click)="changeStatus(solicitud.id, 4, 'Servicio en atención desde la web')">En atención</button>
          <button class="success" (click)="changeStatus(solicitud.id, 5, 'Caso cerrado desde la web')">Cerrar caso</button>
        </div>
      </article>
    </section>
  `,
  styles: `
    .page-card{display:grid;gap:1rem}
    .page-header{display:flex;justify-content:space-between;align-items:center}
    .request-card{display:grid;grid-template-columns:1fr auto;gap:1rem;padding:1.25rem;border-radius:18px;background:#fff;box-shadow:0 10px 30px rgba(15,23,42,.08)}
    .request-card p{margin:.4rem 0;color:#475569}
    .actions{display:grid;gap:.75rem;align-content:start}
    .detail-link{padding:.8rem 1rem;border-radius:12px;background:#e2e8f0;color:#0f172a;text-decoration:none;font-weight:700;text-align:center}
    select,button{padding:.8rem 1rem;border-radius:12px;border:1px solid #cbd5e1}
    button{background:#2563eb;color:#fff;border:none;font-weight:700;cursor:pointer}
    .secondary{background:#0f172a}
    .success{background:#15803d}
  `
})
export class SolicitudesPageComponent {
  private readonly api = inject(EmergencyApiService);
  private readonly authService = inject(AuthService);

  readonly solicitudes = signal<Solicitud[]>([]);
  readonly tecnicos = signal<Tecnico[]>([]);
  readonly canAssign = computed(() => this.authService.hasAnyRole(['ADMINISTRADOR', 'OPERADOR']));
  selectedTechnicians: Record<number, number | undefined> = {};

  constructor() {
    this.loadData();
  }

  loadData() {
    this.api.getSolicitudesActivas().subscribe((data) => this.solicitudes.set(data));
    this.api.getTecnicos().subscribe((data) => this.tecnicos.set(data));
  }

  assign(solicitudId: number) {
    const tecnicoId = this.selectedTechnicians[solicitudId];
    if (!tecnicoId) {
      return;
    }
    this.api.asignarTecnico(solicitudId, tecnicoId).subscribe(() => this.loadData());
  }

  changeStatus(solicitudId: number, estadoId: number, observacion: string) {
    this.api.actualizarEstado(solicitudId, estadoId, observacion).subscribe(() => this.loadData());
  }
}
