import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { EmergencyApiService } from '../core/services/emergency-api.service';
import { AuthService } from '../core/services/auth.service';
import { EstadoSolicitudOption, Solicitud, Tecnico } from '../core/models/api.models';

@Component({
  selector: 'app-solicitudes-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="management-container">
      <header class="page-header">
        <div class="title-group">
          <h2>Gestión de Solicitudes</h2>
          <p>Asignación de unidades y control de flujo de trabajo</p>
        </div>
        <button (click)="loadData()" class="btn-refresh" [disabled]="isLoading()">
          <span class="icon" [class.spinning]="isLoading()">🔄</span>
          Sincronizar
        </button>
      </header>

      <div class="request-list">
        <div *ngIf="solicitudes().length === 0 && !isLoading()" class="empty-state">
          <div class="empty-icon">📂</div>
          <p>No hay solicitudes pendientes de atención.</p>
        </div>

        <article class="request-card" *ngFor="let solicitud of solicitudes()">
          <div class="request-info">
            <header>
              <span class="id-tag">#{{ solicitud.id }}</span>
              <span class="incident-type">{{ solicitud.tipo_incidente?.nombre }}</span>
              <span class="priority-badge" [attr.data-priority]="solicitud.prioridad">
                {{ solicitud.prioridad }}
              </span>
            </header>
            
            <p class="description">{{ solicitud.descripcion }}</p>
            <div class="secondary-tags">
              <span class="mini-tag" *ngIf="solicitud.requiere_revision_manual">Revisión IA</span>
              <span class="mini-tag" *ngIf="solicitud.cliente_aprobada === false">Pendiente cliente</span>
              <span class="mini-tag success" *ngIf="solicitud.cliente_aprobada === true">Cliente aprobó</span>
              <span class="mini-tag" *ngIf="solicitud.etiquetas_ia">{{ solicitud.etiquetas_ia }}</span>
            </div>
            
            <footer class="metadata">
              <span class="status-indicator">
                <span class="status-dot" [attr.data-status]="solicitud.estado?.nombre"></span>
                Estado: <strong>{{ solicitud.estado?.nombre }}</strong>
              </span>
              <span class="tech-assigned" *ngIf="solicitud.tecnico">
                👤 Técnico: {{ solicitud.tecnico.nombre }}
              </span>
            </footer>
          </div>

          <div class="request-actions">
            <a class="btn-detail" [routerLink]="['/solicitudes', solicitud.id]">
              Ver Historial
            </a>

            <div class="assign-zone" *ngIf="canAssign() && !solicitud.tecnico_id">
              <select [(ngModel)]="selectedTechnicians[solicitud.id]" class="tech-select">
                <option [ngValue]="undefined">Seleccionar Técnico...</option>
                <option *ngFor="let tecnico of availableTechnicians()" [ngValue]="tecnico.id">
                  {{ tecnico.nombre }} (Disponible)
                </option>
              </select>
              <button class="btn-assign" (click)="assign(solicitud.id)">Asignar Unidad</button>
            </div>

            <div class="status-workflow">
              <button
                class="btn-flow attention"
                *ngIf="canAdvanceTo(solicitud, 'EN_ATENCION')"
                (click)="changeStatusByName(solicitud.id, 'EN_ATENCION', 'Servicio iniciado desde panel web')">
                Iniciar Atención
              </button>
              <button
                class="btn-flow success"
                *ngIf="canAdvanceTo(solicitud, 'COMPLETADA')"
                (click)="changeStatusByName(solicitud.id, 'COMPLETADA', 'Caso cerrado desde panel web')">
                Cerrar Caso
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>
  `,
  styles: `
    :host { --primary: #2563eb; --dark: #0f172a; --gray: #64748b; --bg: #f8fafc; }

    .management-container { padding: 2rem; background: var(--bg); min-height: 100vh; }

    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
    .page-header h2 { margin: 0; color: var(--dark); font-size: 1.75rem; }
    .page-header p { margin: 0.25rem 0 0; color: var(--gray); }

    /* Listado */
    .request-list { display: grid; gap: 1.25rem; }

    .request-card {
      display: grid;
      grid-template-columns: 1fr 320px;
      gap: 2rem;
      background: white;
      padding: 1.5rem;
      border-radius: 20px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05);
      border: 1px solid #f1f5f9;
      transition: transform 0.2s;
    }
    .request-card:hover { transform: translateY(-2px); border-color: #e2e8f0; }

    /* Info de la solicitud */
    .request-info header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
    .id-tag { font-family: monospace; font-weight: 800; color: var(--gray); font-size: 1.1rem; }
    .incident-type { font-weight: 700; color: var(--dark); font-size: 1.1rem; }
    
    .priority-badge {
      padding: 0.25rem 0.6rem; border-radius: 6px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase;
      background: #f1f5f9; color: var(--gray);
    }
    .priority-badge[data-priority="CRITICA"] { background: #fee2e2; color: #ef4444; }

    .description { color: #475569; line-height: 1.5; margin-bottom: 0.75rem; font-size: 0.95rem; }
    .secondary-tags { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
    .mini-tag { background: #e2e8f0; color: #334155; border-radius: 999px; padding: 0.25rem 0.55rem; font-size: 0.72rem; font-weight: 700; }
    .mini-tag.success { background: #dcfce7; color: #166534; }

    .metadata { display: flex; gap: 1.5rem; font-size: 0.85rem; color: var(--gray); padding-top: 1rem; border-top: 1px solid #f8fafc; }
    .status-indicator { display: flex; align-items: center; gap: 0.5rem; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #cbd5e1; }
    .status-dot[data-status="EN_CAMINO"] { background: #3b82f6; box-shadow: 0 0 8px #3b82f6; }
    .status-dot[data-status="EN_ATENCION"] { background: #f59e0b; box-shadow: 0 0 8px #f59e0b; }

    /* Acciones */
    .request-actions { display: flex; flex-direction: column; gap: 0.75rem; border-left: 1px solid #f1f5f9; padding-left: 1.5rem; }

    .btn-detail {
      text-align: center; padding: 0.6rem; background: #f1f5f9; color: var(--dark);
      text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 0.85rem; transition: 0.2s;
    }
    .btn-detail:hover { background: #e2e8f0; }

    .assign-zone { display: grid; gap: 0.5rem; padding: 0.75rem; background: #f8fafc; border-radius: 12px; }
    .tech-select { padding: 0.6rem; border: 1.5px solid #e2e8f0; border-radius: 8px; font-size: 0.85rem; }
    .btn-assign { background: var(--primary); color: white; border: none; padding: 0.6rem; border-radius: 8px; font-weight: 700; cursor: pointer; }

    .status-workflow { display: grid; gap: 0.5rem; }
    .btn-flow { padding: 0.75rem; border: none; border-radius: 10px; color: white; font-weight: 700; cursor: pointer; transition: 0.2s; }
    .btn-flow.attention { background: var(--dark); }
    .btn-flow.success { background: #15803d; }
    .btn-flow:hover { opacity: 0.9; transform: scale(1.02); }

    /* Utils */
    .btn-refresh { display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1rem; border: 1.5px solid #e2e8f0; background: white; border-radius: 10px; font-weight: 600; cursor: pointer; }
    .spinning { animation: spin 1s linear infinite; display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .empty-state { text-align: center; padding: 4rem; color: var(--gray); }
    .empty-icon { font-size: 3rem; margin-bottom: 1rem; opacity: 0.5; }

    @media (max-width: 900px) {
      .request-card { grid-template-columns: 1fr; gap: 1rem; }
      .request-actions { border-left: none; padding-left: 0; border-top: 1px solid #f1f5f9; padding-top: 1rem; }
    }
  `
})
export class SolicitudesPageComponent {
  private readonly api = inject(EmergencyApiService);
  private readonly authService = inject(AuthService);

  readonly solicitudes = signal<Solicitud[]>([]);
  readonly tecnicos = signal<Tecnico[]>([]);
  readonly estados = signal<EstadoSolicitudOption[]>([]);
  readonly isLoading = signal(false);

  readonly canAssign = computed(() => this.authService.hasAnyRole(['ADMINISTRADOR', 'OPERADOR']));
  readonly availableTechnicians = computed(() => this.tecnicos().filter((t) => t.disponibilidad));
  
  selectedTechnicians: Record<number, number | undefined> = {};

  constructor() {
    this.loadData();
  }

  loadData() {
    this.isLoading.set(true);
    // Para simplificar, asumimos que todas las llamadas terminan
    this.api.getSolicitudesActivas().subscribe((data) => {
      this.solicitudes.set(data);
      this.isLoading.set(false);
    });
    this.api.getTecnicos().subscribe((data) => this.tecnicos.set(data));
    this.api.getEstadosSolicitud().subscribe((data) => this.estados.set(data));
  }

  assign(solicitudId: number) {
    const tecnicoId = this.selectedTechnicians[solicitudId];
    if (!tecnicoId) return;
    this.api.asignarTecnico(solicitudId, tecnicoId).subscribe(() => this.loadData());
  }

  changeStatusByName(solicitudId: number, estado: string, observacion: string) {
    const estadoId = this.estados().find((item) => item.nombre === estado)?.id;
    if (!estadoId) return;
    this.api.actualizarEstado(solicitudId, estadoId, observacion).subscribe(() => this.loadData());
  }

  canAdvanceTo(solicitud: Solicitud, targetState: string) {
    const currentState = solicitud.estado?.nombre;
    if (!currentState) return false;

    // Lógica unificada: tanto operadores como técnicos pueden avanzar el flujo una vez iniciado
    const validTransitions: Record<string, string> = {
      'EN_CAMINO': 'EN_ATENCION',
      'EN_ATENCION': 'COMPLETADA'
    };

    return validTransitions[currentState] === targetState;
  }
}
